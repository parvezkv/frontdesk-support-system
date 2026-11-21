const app = require('./app');
const config = require('./config/env');

const server = app.listen(config.port, () => {
  console.log(`🚀 Frontdesk API server running on port ${config.port} (${config.nodeEnv})`);
  console.log(`📡 Health check available at: http://localhost:${config.port}/api/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received. Closing HTTP server...');
  server.close(() => {
    console.log('HTTP server closed.');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received. Closing HTTP server...');
  server.close(() => {
    console.log('HTTP server closed.');
    process.exit(0);
  });
});
