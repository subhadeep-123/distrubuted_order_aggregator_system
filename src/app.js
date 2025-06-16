const express = require('express');
const cors = require('cors');
const { Sequelize, DataTypes } = require('sequelize');
const amqp = require('amqplib');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path} - Body:`, req.body);
  
  // Override res.json to log responses
  const originalJson = res.json;
  res.json = function(data) {
    console.log(`[${timestamp}] Response ${res.statusCode}:`, data);
    return originalJson.call(this, data);
  };
  
  next();
});

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

// Simple Models
const Product = sequelize.define('Product', {
  sku: { type: DataTypes.STRING, primaryKey: true },
  name: DataTypes.STRING,
  price: DataTypes.DECIMAL(10, 2)
});

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

// Vendor URLs
const VENDORS = [
  process.env.VENDOR_A_URL || 'http://localhost:3001',
  process.env.VENDOR_B_URL || 'http://localhost:3002'
];

// Queue connection
let channel;
async function connectQueue() {
  try {
    console.log('🔗 Connecting to RabbitMQ...');
    const connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://admin:password@localhost:5672');
    channel = await connection.createChannel();
    await channel.assertQueue('orders', { durable: true });
    console.log('✅ Queue connected successfully');
  } catch (error) {
    console.error('❌ Queue connection failed:', error);
  }
}

// Sync stock from vendors
async function syncStock() {
  try {
    console.log('📦 Starting stock synchronization...');
    for (const vendorUrl of VENDORS) {
      console.log(`🔄 Syncing stock from ${vendorUrl}`);
      const response = await axios.get(`${vendorUrl}/stock`);
      const vendorId = vendorUrl.includes('3001') ? 'vendor-a' : 'vendor-b';
      
      console.log(`📊 Received ${response.data.length} items from ${vendorId}`);
      for (const item of response.data) {
        await Stock.upsert({
          sku: item.sku,
          vendor: vendorId,
          quantity: item.quantity
        });
        console.log(`   ✓ ${item.sku}: ${item.quantity} units`);
      }
    }
    console.log('✅ Stock synced from all vendors');
  } catch (error) {
    console.error('❌ Stock sync failed:', error);
  }
}

// Routes
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Assignment requirement: POST /order endpoint
app.post('/order', async (req, res) => {
  try {
    const { productId, quantity, customerId } = req.body;
    console.log(`🛒 Processing order: Customer ${customerId} wants ${quantity}x ${productId}`);
    
    // Simple validation (as per assignment requirements)
    if (!productId || !quantity || !customerId) {
      console.log('❌ Validation failed: Missing required fields');
      return res.status(400).json({ error: 'productId, quantity, and customerId required' });
    }

    // Check local stock availability
    const totalStock = await Stock.sum('quantity', {
      where: { sku: productId }
    });
    console.log(`📊 Available stock for ${productId}: ${totalStock || 0} units`);
    
    if (!totalStock || totalStock < quantity) {
      console.log(`❌ Insufficient stock: Need ${quantity}, have ${totalStock || 0}`);
      return res.status(400).json({ 
        error: `Insufficient stock for ${productId}` 
      });
    }

    // Create order
    const order = await Order.create({
      customerId,
      items: [{ sku: productId, quantity }],
      status: 'pending'
    });
    console.log(`✅ Order created with ID: ${order.id}`);

    // Send to queue for atomic processing
    if (channel) {
      await channel.sendToQueue('orders', Buffer.from(JSON.stringify({
        ...order.toJSON(),
        productId,
        quantity
      })), { persistent: true });
      console.log(`📤 Order ${order.id} sent to processing queue`);
    } else {
      console.log('⚠️ Queue not available, order created but not queued for processing');
    }

    res.json({ success: true, orderId: order.id });
  } catch (error) {
    console.error('❌ Order creation failed:', error);
    res.status(500).json({ error: 'Order creation failed' });
  }
});

// Keep existing endpoint for compatibility  
app.post('/api/orders', async (req, res) => {
  try {
    const { customerId, items } = req.body;
    
    if (!customerId || !items || !Array.isArray(items)) {
      return res.status(400).json({ error: 'Invalid order data' });
    }

    // Check stock availability
    for (const item of items) {
      const totalStock = await Stock.sum('quantity', {
        where: { sku: item.sku }
      });
      
      if (!totalStock || totalStock < item.quantity) {
        return res.status(400).json({ 
          error: `Insufficient stock for ${item.sku}` 
        });
      }
    }

    const order = await Order.create({
      customerId,
      items,
      status: 'pending'
    });

    if (channel) {
      await channel.sendToQueue('orders', Buffer.from(JSON.stringify(order)), { persistent: true });
    }

    res.json({ success: true, orderId: order.id });
  } catch (error) {
    console.error('Order creation failed:', error);
    res.status(500).json({ error: 'Order creation failed' });
  }
});

app.get('/api/orders', async (req, res) => {
  try {
    const orders = await Order.findAll();
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// Initialize
async function init() {
  try {
    await sequelize.authenticate();
    await sequelize.sync({ force: true });
    
    // Seed some products
    await Product.bulkCreate([
      { sku: 'LAPTOP-001', name: 'Gaming Laptop', price: 1299.99 },
      { sku: 'MOUSE-001', name: 'Gaming Mouse', price: 89.99 },
      { sku: 'KEYBOARD-001', name: 'Mechanical Keyboard', price: 149.99 }
    ]);

    await connectQueue();
    await syncStock();
    
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Initialization failed:', error);
    process.exit(1);
  }
}

init(); 