const { waitForDatabase } = require('./wait-for-db');
const { spawn } = require('child_process');

async function startWorker() {
  try {
    console.log('Starting worker startup sequence...');
    
    // Wait for database to be ready
    await waitForDatabase();
    
    // Start the worker
    console.log('Starting worker...');
    const child = spawn('node', ['src/workers/orderWorker.js'], {
      stdio: 'inherit',
      env: process.env
    });
    
    // Forward exit codes
    child.on('exit', (code) => {
      process.exit(code);
    });
    
    // Handle process termination
    process.on('SIGTERM', () => {
      console.log('Received SIGTERM, shutting down worker gracefully...');
      child.kill('SIGTERM');
    });
    
    process.on('SIGINT', () => {
      console.log('Received SIGINT, shutting down worker gracefully...');
      child.kill('SIGINT');
    });
    
  } catch (error) {
    console.error('Worker startup failed:', error);
    process.exit(1);
  }
}

startWorker(); 