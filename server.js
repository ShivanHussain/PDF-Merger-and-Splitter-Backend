// server.js
import app from './app.js';
import { connectDB } from './config/database.js';
import { config } from './config/config.js';
import { cleanupFiles } from './utils/fileCleanup.js';
import { debugApp } from './utils/debugLogger.js';

// Connect to DB
connectDB();

// Start server
const server = app.listen(config.port, () => {
  debugApp(`Server running on port ${config.port}`);
  debugApp(`Environment: ${config.nodeEnv}`);
  debugApp(`MongoDB: ${config.mongodbUri.includes('localhost') ? 'Local' : 'Cloud'}`);
  debugApp(`API Base URL: http://localhost:${config.port}`);
});

// Scheduled file cleanup
setInterval(() => {
  debugApp('Running scheduled file cleanup...');
  cleanupFiles();
}, config.fileCleanupInterval * 60 * 60 * 1000);

// Graceful shutdown
process.on('SIGTERM', () => {
  debugApp('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    debugApp('Process terminated');
    process.exit(0);
  });
});

process.on('unhandledRejection', (reason, promise) => {
  debugApp('Unhandled Rejection:', reason);
  server.close(() => {
    debugApp('Server shut down due to unhandled rejection');
    process.exit(1);
  });
});