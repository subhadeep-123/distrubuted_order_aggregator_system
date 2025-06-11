const { waitForDatabase } = require('./wait-for-db');
const { spawn } = require('child_process');

async function start() {
  try {
    console.log('Starting application startup sequence...');
    
    // Wait for database to be ready
    await waitForDatabase();
    
    // Start the main application
    console.log('Starting main application...');
    const child = spawn('node', ['src/app.js'], {
      stdio: 'inherit',
      env: process.env
    });
    
    // Forward exit codes
    child.on('exit', (code) => {
      process.exit(code);
    });
    
    // Handle process termination
    process.on('SIGTERM', () => {
      console.log('Received SIGTERM, shutting down gracefully...');
      child.kill('SIGTERM');
    });
    
    process.on('SIGINT', () => {
      console.log('Received SIGINT, shutting down gracefully...');
      child.kill('SIGINT');
    });
    
  } catch (error) {
    console.error('Application startup failed:', error);
    process.exit(1);
  }
}

start(); 