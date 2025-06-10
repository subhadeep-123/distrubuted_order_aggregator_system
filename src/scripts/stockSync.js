const axios = require('axios');
const { Sequelize, DataTypes } = require('sequelize');

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

const Stock = sequelize.define('Stock', {
  sku: DataTypes.STRING,
  vendor: DataTypes.STRING,
  quantity: DataTypes.INTEGER
});

const VENDORS = [
  { url: process.env.VENDOR_A_URL || 'http://localhost:3001', id: 'vendor-a' },
  { url: process.env.VENDOR_B_URL || 'http://localhost:3002', id: 'vendor-b' }
];

async function syncStock() {
  try {
    console.log('Starting stock sync...');
    await sequelize.authenticate();
    
    for (const vendor of VENDORS) {
      console.log(`Syncing from ${vendor.id}...`);
      
      try {
        const response = await axios.get(`${vendor.url}/stock`, { timeout: 5000 });
        
        for (const item of response.data) {
          await Stock.upsert({
            sku: item.sku,
            vendor: vendor.id,
            quantity: item.quantity
          });
        }
        
        console.log(`Synced ${response.data.length} items from ${vendor.id}`);
      } catch (error) {
        console.error(`Failed to sync from ${vendor.id}:`, error.message);
      }
    }
    
    console.log('Stock sync complete!');
    process.exit(0);
    
  } catch (error) {
    console.error('Stock sync failed:', error);
    process.exit(1);
  }
}

syncStock(); 