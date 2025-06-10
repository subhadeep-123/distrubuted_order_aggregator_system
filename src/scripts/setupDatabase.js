const { Sequelize, DataTypes } = require('sequelize');

const sequelize = new Sequelize(
  process.env.DB_NAME || 'order_aggregator',
  process.env.DB_USER || 'postgres', 
  process.env.DB_PASSWORD || 'password',
  {
    host: process.env.DB_HOST || 'localhost',
    dialect: 'postgres',
    logging: console.log
  }
);

// Define models
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

async function setupDatabase() {
  try {
    console.log('Connecting to database...');
    await sequelize.authenticate();
    
    console.log('Creating tables...');
    await sequelize.sync({ force: true });
    
    console.log('Seeding products...');
    await Product.bulkCreate([
      { sku: 'LAPTOP-001', name: 'Gaming Laptop', price: 1299.99 },
      { sku: 'MOUSE-001', name: 'Gaming Mouse', price: 89.99 },
      { sku: 'KEYBOARD-001', name: 'Mechanical Keyboard', price: 149.99 }
    ]);
    
    console.log('Database setup complete!');
    process.exit(0);
    
  } catch (error) {
    console.error('Database setup failed:', error);
    process.exit(1);
  }
}

setupDatabase(); 