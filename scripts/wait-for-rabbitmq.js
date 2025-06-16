const amqp = require('amqplib');

async function waitForRabbitmq() {
  const rabbitmqUrl = process.env.RABBITMQ_URL || 'amqp://admin:password@rabbitmq:5672';

  const maxRetries = 30;
  const baseDelay = 1000; // 1 second

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Attempting to connect to RabbitMQ (attempt ${attempt}/${maxRetries})...`);
      const connection = await amqp.connect(rabbitmqUrl);
      console.log('RabbitMQ connection established successfully!');
      await connection.close();
      return;
    } catch (error) {
      console.log(`RabbitMQ connection failed: ${error.message}`);
      
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
  waitForRabbitmq();
}

module.exports = { waitForRabbitmq }; 