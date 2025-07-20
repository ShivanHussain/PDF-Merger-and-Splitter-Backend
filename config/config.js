import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { debugConfig } from '../utils/debugLogger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env') });

export const config = {
  // Server
  port: parseInt(process.env.PORT) || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Database
  mongodbUri: process.env.NODE_ENV === 'production' 
    ? process.env.MONGODB_URI_PROD 
    : process.env.MONGODB_URI || 'mongodb://localhost:27017/pdf-merger-splitter',
  
  // File Upload
  maxFileSize: process.env.MAX_FILE_SIZE || '50MB',
  uploadPath: process.env.UPLOAD_PATH || './uploads',
  processedPath: process.env.PROCESSED_PATH || './processed',
  
  // Security
  jwtSecret: process.env.JWT_SECRET || 'fallback-secret-key',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  
  // Rate Limiting
  rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW) || 15,
  rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  
  // Cleanup
  fileCleanupInterval: parseInt(process.env.FILE_CLEANUP_INTERVAL) || 24,
  tempFileLifetime: parseInt(process.env.TEMP_FILE_LIFETIME) || 2
};

// Validation
const requiredEnvVars = ['MONGODB_URI'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0 && config.nodeEnv === 'production') {
  debugConfig('Missing required environment variables:', missingVars);
  process.exit(1);
}