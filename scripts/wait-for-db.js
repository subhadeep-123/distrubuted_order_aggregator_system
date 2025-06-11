const { Sequelize } = require('sequelize');

async function waitForDatabase() {
  const dbHost = process.env.DB_HOST || 'localhost';
  const dbName = process.env.DB_NAME || 'order_aggregator';
  const dbUser = process.env.DB_USER || 'postgres';
  const dbPassword = process.env.DB_PASSWORD || 'password';

  const sequelize = new Sequelize(dbName, dbUser, dbPassword, {
    host: dbHost,
    dialect: 'postgres',
    logging: false,
  });

  const maxRetries = 30;
  const baseDelay = 1000; // 1 second

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Attempting to connect to database (attempt ${attempt}/${maxRetries})...`);
      await sequelize.authenticate();
      console.log('Database connection established successfully!');
      await sequelize.close();
      return;
    } catch (error) {
      console.log(`Database connection failed: ${error.message}`);
      
      if (attempt === maxRetries) {
        console.error('Max retries reached. Exiting...');
        process.exit(1);
      }

      // Exponential backoff with jitter
      const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), 30000) + Math.random() * 1000;
      console.log(`Waiting ${Math.round(delay)}ms before next attempt...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

if (require.main === module) {
  waitForDatabase();
}

module.exports = { waitForDatabase }; 