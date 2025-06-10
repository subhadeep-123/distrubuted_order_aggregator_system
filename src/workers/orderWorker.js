const amqp = require('amqplib');
const axios = require('axios');
const { Sequelize, DataTypes } = require('sequelize');

// Database connection
const sequelize = new Sequelize(
  process.env.DB_NAME || 'order_aggregator',
  process.env.DB_USER || 'postgres', 
  process.env.DB_PASSWORD || 'password',
  {
    host: process.env.DB_HOST || 'localhost',
    dialect: 'postgres',
    logging: false
  }
);

// Models (same as app.js)
const Stock = sequelize.define('Stock', {
  sku: DataTypes.STRING,
  vendor: DataTypes.STRING,
  quantity: DataTypes.INTEGER
});

const Order = sequelize.define('Order', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  customerId: DataTypes.STRING,
  items: DataTypes.JSON,
  status: { type: DataTypes.STRING, defaultValue: 'pending' },
  total: DataTypes.DECIMAL(10, 2)
});

// Assignment requirement: Reduce stock atomically both local and vendor
async function processOrder(orderData) {
  const transaction = await sequelize.transaction();
  const vendorUpdates = [];
  
  try {
    // Process each item in the order
    const items = orderData.items || [{ sku: orderData.productId, quantity: orderData.quantity }];
    
    for (const item of items) {
      const stocks = await Stock.findAll({
        where: { sku: item.sku },
        transaction
      });
      
      let remainingQuantity = item.quantity;
      
      // Reserve stock from each vendor and prepare vendor updates
      for (const stock of stocks) {
        if (remainingQuantity <= 0) break;
        
        const reserveQty = Math.min(stock.quantity, remainingQuantity);
        
        // Update local stock
        await stock.update(
          { quantity: stock.quantity - reserveQty },
          { transaction }
        );
        
        // Prepare vendor stock update
        vendorUpdates.push({
          vendor: stock.vendor,
          sku: item.sku,
          quantity: reserveQty
        });
        
        remainingQuantity -= reserveQty;
      }
      
      if (remainingQuantity > 0) {
        throw new Error(`Insufficient stock for ${item.sku}`);
      }
    }
    
    // Update vendor stocks atomically (requirement: both local and vendor)
    await updateVendorStocks(vendorUpdates);
    
    // Update order status
    await Order.update(
      { status: 'completed' },
      { where: { id: orderData.id }, transaction }
    );
    
    await transaction.commit();
    console.log(`Order ${orderData.id} processed successfully`);
    
  } catch (error) {
    await transaction.rollback();
    
    // Attempt to rollback vendor stock changes
    await rollbackVendorStocks(vendorUpdates);
    
    // Mark order as failed
    await Order.update(
      { status: 'failed' },
      { where: { id: orderData.id } }
    );
    
    console.error(`Order ${orderData.id} failed:`, error.message);
  }
}

// Update vendor stocks via API calls (assignment requirement)
async function updateVendorStocks(updates) {
  const VENDOR_URLS = {
    'vendor-a': process.env.VENDOR_A_URL || 'http://localhost:3001',
    'vendor-b': process.env.VENDOR_B_URL || 'http://localhost:3002'
  };
  
  for (const update of updates) {
    try {
      const vendorUrl = VENDOR_URLS[update.vendor];
      if (vendorUrl) {
        await axios.post(`${vendorUrl}/reduce-stock`, {
          sku: update.sku,
          quantity: update.quantity
        }, { timeout: 5000 });
      }
    } catch (error) {
      console.error(`Failed to update vendor ${update.vendor} stock:`, error.message);
      // Don't throw - continue with best effort
    }
  }
}

// Rollback vendor stock changes on failure
async function rollbackVendorStocks(updates) {
  const VENDOR_URLS = {
    'vendor-a': process.env.VENDOR_A_URL || 'http://localhost:3001',
    'vendor-b': process.env.VENDOR_B_URL || 'http://localhost:3002'
  };
  
  for (const update of updates) {
    try {
      const vendorUrl = VENDOR_URLS[update.vendor];
      if (vendorUrl) {
        await axios.post(`${vendorUrl}/restore-stock`, {
          sku: update.sku,
          quantity: update.quantity
        }, { timeout: 5000 });
      }
    } catch (error) {
      console.error(`Failed to rollback vendor ${update.vendor} stock:`, error.message);
    }
  }
}

async function startWorker() {
  try {
    await sequelize.authenticate();
    
    const connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://admin:password@localhost:5672');
    const channel = await connection.createChannel();
    
    // Setup queues with retry logic (assignment requirement)
    await channel.assertQueue('orders', { durable: true });
    await channel.assertQueue('orders.retry', { 
      durable: true,
      arguments: {
        'x-message-ttl': 60000, // 1 minute delay
        'x-dead-letter-exchange': '',
        'x-dead-letter-routing-key': 'orders'
      }
    });
    await channel.assertQueue('orders.failed', { durable: true });
    
    await channel.prefetch(1);
    
    console.log('Worker started, waiting for orders...');
    
    // Assignment requirement: Include basic retry logic for failures
    await channel.consume('orders', async (message) => {
      if (message) {
        try {
          const orderData = JSON.parse(message.content.toString());
          const retryCount = (message.properties.headers && message.properties.headers.retryCount) || 0;
          
          await processOrder(orderData);
          channel.ack(message);
          
        } catch (error) {
          console.error('Error processing message:', error);
          
          const retryCount = (message.properties.headers && message.properties.headers.retryCount) || 0;
          const maxRetries = 3;
          
          if (retryCount < maxRetries) {
            // Retry with exponential backoff
            console.log(`Retrying order ${orderData.id}, attempt ${retryCount + 1}/${maxRetries}`);
            
            await channel.publish('', 'orders.retry', message.content, {
              headers: { retryCount: retryCount + 1 },
              persistent: true
            });
            
            channel.ack(message);
          } else {
            // Max retries reached, send to failed queue
            console.error(`Order ${orderData.id} failed after ${maxRetries} attempts`);
            
            await channel.publish('', 'orders.failed', message.content, {
              headers: { 
                retryCount: retryCount,
                failedAt: new Date().toISOString(),
                error: error.message 
              },
              persistent: true
            });
            
            channel.ack(message);
          }
        }
      }
    });
    
  } catch (error) {
    console.error('Worker startup failed:', error);
    process.exit(1);
  }
}

startWorker(); 