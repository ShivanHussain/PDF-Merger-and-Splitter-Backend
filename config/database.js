import mongoose from 'mongoose';
import { config } from './config.js';
import { debugDatabase } from '../utils/debugLogger.js';
import debug from 'debug';

export const connectDB = async () => {
  try {
    const options = {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      useNewUrlParser: true,
      useUnifiedTopology: true
    };

    const conn = await mongoose.connect(config.mongodbUri, options);
    
    debugDatabase(`MongoDB Connected: ${conn.connection.host}`);
    
    // Connection event handlers
    mongoose.connection.on('error', (err) => {
      debugDatabase('MongoDB connection error:', err);
    });
    
    mongoose.connection.on('disconnected', () => {
      debugDatabase('MongoDB disconnected');
    });
    
    mongoose.connection.on('reconnected', () => {
      debugDatabase('MongoDB reconnected');
    });
    
    // Graceful shutdown
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      debugDatabase('MongoDB connection closed through app termination');
      process.exit(0);
    });
    
  } catch (error) {
    debugDatabase('Database connection failed:', error.message);
    process.exit(1);
  }
};