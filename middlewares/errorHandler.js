import { config } from '../config/config.js';
import { debugError } from '../utils/debugLogger.js';

// Custom error class
export class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Development error response
const sendErrorDev = (err, res) => {
  res.status(err.statusCode || 500).json({
    success: false,
    error: err.name || 'Error',
    message: err.message,
    stack: err.stack,
    ...(err.errors && { errors: err.errors })
  });
};

// Production error response
const sendErrorProd = (err, res) => {
  // Operational, trusted error: send message to client
  if (err.isOperational) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      error: err.name || 'Error'
    });
  } else {
    // Programming or other unknown error: don't leak error details
    debugError('ERROR :', err);
    
    res.status(500).json({
      success: false,
      message: 'Something went wrong!',
      error: 'Internal Server Error'
    });
  }
};

// Handle specific MongoDB errors
const handleCastErrorDB = (err) => {
  const message = `Invalid ${err.path}: ${err.value}`;
  return new AppError(message, 400);
};

const handleDuplicateFieldsDB = (err) => {
  const value = err.errmsg.match(/(["'])(\\?.)*?\1/)[0];
  const message = `Duplicate field value: ${value}. Please use another value!`;
  return new AppError(message, 400);
};

const handleValidationErrorDB = (err) => {
  const errors = Object.values(err.errors).map(el => el.message);
  const message = `Invalid input data. ${errors.join('. ')}`;
  return new AppError(message, 400);
};

// Handle JWT errors
const handleJWTError = () =>
  new AppError('Invalid token. Please log in again!', 401);

const handleJWTExpiredError = () =>
  new AppError('Your token has expired! Please log in again.', 401);

// Main error handling middleware
export const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  let error = { ...err };
  error.message = err.message;

  // Log error for debugging
  debugError('Error occurred:', {
    message: err.message,
    statusCode: err.statusCode,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    timestamp: new Date().toISOString()
  });

  // Handle specific error types
  if (err.name === 'CastError') error = handleCastErrorDB(error);
  if (err.code === 11000) error = handleDuplicateFieldsDB(error);
  if (err.name === 'ValidationError') error = handleValidationErrorDB(error);
  if (err.name === 'JsonWebTokenError') error = handleJWTError();
  if (err.name === 'TokenExpiredError') error = handleJWTExpiredError();

  // Handle Multer errors
  if (err.name === 'MulterError') {
    let message;
    switch (err.code) {
      case 'LIMIT_FILE_SIZE':
        message = 'File size too large. Maximum allowed size is 50MB.';
        break;
      case 'LIMIT_FILE_COUNT':
        message = 'Too many files. Maximum allowed is 10 files.';
        break;
      case 'LIMIT_UNEXPECTED_FILE':
        message = 'Unexpected file field.';
        break;
      default:
        message = `Upload error: ${err.message}`;
    }
    error = new AppError(message, 400);
  }

  // Send appropriate error response
  if (config.nodeEnv === 'development') {
    sendErrorDev(error, res);
  } else {
    sendErrorProd(error, res);
  }
};

// Async error wrapper
export const catchAsync = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// 404 handler
export const notFound = (req, res, next) => {
  const err = new AppError(`Not found - ${req.originalUrl}`, 404);
  next(err);
};

// Unhandled promise rejection handler
process.on('unhandledRejection', (err, promise) => {
  debugError('Unhandled Promise Rejection at:', promise, 'reason:', err);
  process.exit(1);
});

// Uncaught exception handler
process.on('uncaughtException', (err) => {
  debugError('Uncaught Exception thrown:', err);
  process.exit(1);
});