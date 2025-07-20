// app.js
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

import { config } from './config/config.js';
import pdfRoutes from './routes/pdfRoutes.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { debugApp } from './utils/debugLogger.js'; 

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

//Create necessary directories
const createDirectories = () => {
  const dirs = [
    join(__dirname, 'uploads'),
    join(__dirname, 'processed'),
    join(__dirname, 'temp')
  ];
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      debugApp(`Created directory: ${dir}`);
    }
  });
};
createDirectories();

//Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
debugApp('Helmet configured');

//CORS
app.use(cors({
  origin: config.corsOrigin,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
debugApp('CORS configured');

//Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimitWindow * 60 * 1000,
  max: config.rateLimitMaxRequests,
  message: {
    error: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/', limiter);
debugApp('Rate limiter applied');

//Body parsing and compression
app.use(compression());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
debugApp('Middleware: compression, JSON parser, URL-encoded parser');

//Logging
if (config.nodeEnv === 'development') {
  app.use(morgan('dev'));
  debugApp('Morgan in dev mode');
} else {
  app.use(morgan('combined'));
  debugApp('Morgan in production mode');
}

//Static files
app.use('/uploads', express.static(join(__dirname, 'uploads')));
app.use('/processed', express.static(join(__dirname, 'processed')));
debugApp('Static file routes configured');

//Health check route
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'PDF Merger & Splitter API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});
debugApp('Health route ready');

//Main PDF API routes
app.use('/api/pdf', pdfRoutes);
debugApp('PDF routes mounted');

//Root route
app.get('/', (req, res) => {
  res.json({
    message: 'PDF Merger & Splitter API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      merge: '/api/pdf/merge',
      split: '/api/pdf/split',
      upload: '/api/pdf/upload'
    }
  });
});

//404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`
  });
  debugApp(`404 - Route not found: ${req.originalUrl}`);
});

//Error middleware
app.use(errorHandler);
debugApp('Error handler registered');

export default app;
