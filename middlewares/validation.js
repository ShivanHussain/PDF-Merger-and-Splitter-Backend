import Joi from 'joi';
import { AppError } from '../utils/appError.js';

// Validation schemas
const mergeSchema = Joi.object({
  mergeOrder: Joi.array().items(Joi.number().integer().min(0)).optional()
});

const splitSchema = Joi.object({
  splitType: Joi.string().valid('pages', 'range', 'size').default('pages'),
  pageRanges: Joi.alternatives().try(
    Joi.array().items(Joi.string().pattern(/^\d+(-\d+)?$/)),
    Joi.string().pattern(/^\d+(-\d+)?$/)
  ).optional(),
  pagesPerFile: Joi.number().integer().min(1).max(100).default(1)
});

// Validation middleware factory
const createValidationMiddleware = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errorMessage = error.details
        .map(detail => detail.message)
        .join(', ');
      
      throw new AppError(`Validation error: ${errorMessage}`, 400);
    }

    // Replace req.body with validated and sanitized data
    req.body = value;
    next();
  };
};

// Merge request validation
export const validateMergeRequest = (req, res, next) => {
  // Ensure at least 2 PDF files are uploaded
  if (!req.files || req.files.length < 2) {
    return res.status(400).json({
      success: false,
      message: 'At least 2 PDF files are required for merging',
      error: 'INSUFFICIENT_FILES'
    });
  }

  const { mergeOrder } = req.body;

  if (mergeOrder) {
    let parsedOrder;

    try {
      // Handle both stringified JSON and array cases
      if (typeof mergeOrder === 'string') {
        parsedOrder = JSON.parse(mergeOrder);
      } else if (Array.isArray(mergeOrder)) {
        parsedOrder = mergeOrder.map(i => parseInt(i));
      } else {
        throw new Error();
      }

      if (!Array.isArray(parsedOrder)) {
        throw new Error();
      }

      // Validate bounds
      for (const index of parsedOrder) {
        if (isNaN(index) || index < 0 || index >= req.files.length) {
          return res.status(400).json({
            success: false,
            message: `Invalid index "${index}" in mergeOrder. Must be between 0 and ${req.files.length - 1}`,
            error: 'INVALID_MERGE_ORDER_INDEX'
          });
        }
      }

      // Check for duplicates
      const unique = new Set(parsedOrder);
      if (unique.size !== parsedOrder.length) {
        return res.status(400).json({
          success: false,
          message: 'Duplicate indices found in merge order',
          error: 'DUPLICATE_INDICES'
        });
      }

      req.body.mergeOrder = parsedOrder;
    } catch {
      return res.status(400).json({
        success: false,
        message: 'mergeOrder must be a valid JSON array of indices like [1,0]',
        error: 'INVALID_MERGE_ORDER_FORMAT'
      });
    }
  }

  next();
};


// Split request validation
export const validateSplitRequest = (req, res, next) => {
  // Check if exactly one file is provided
  if (!req.files || req.files.length !== 1) {
    return res.status(400).json({
      success: false,
      message: 'Exactly one PDF file is required for splitting',
      error: 'INVALID_FILE_COUNT'
    });
  }

  // Validate split parameters
  const { error, value } = splitSchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true
  });

  if (error) {
    const errorMessage = error.details
      .map(detail => detail.message)
      .join(', ');
    
    return res.status(400).json({
      success: false,
      message: `Validation error: ${errorMessage}`,
      error: 'VALIDATION_ERROR'
    });
  }

  // Additional validation for page ranges
  const { splitType, pageRanges } = value;
  
  if (splitType === 'range') {
    if (!pageRanges || (Array.isArray(pageRanges) && pageRanges.length === 0)) {
      return res.status(400).json({
        success: false,
        message: 'Page ranges are required when split type is "range"',
        error: 'MISSING_PAGE_RANGES'
      });
    }

    // Validate page range format
    const ranges = Array.isArray(pageRanges) ? pageRanges : [pageRanges];
    for (const range of ranges) {
      if (!range.match(/^\d+(-\d+)?$/)) {
        return res.status(400).json({
          success: false,
          message: `Invalid page range format: ${range}. Use formats like "1", "1-5", "3-7"`,
          error: 'INVALID_PAGE_RANGE_FORMAT'
        });
      }

      // Validate range values
      if (range.includes('-')) {
        const [start, end] = range.split('-').map(num => parseInt(num));
        if (start >= end) {
          return res.status(400).json({
            success: false,
            message: `Invalid page range: ${range}. Start page must be less than end page`,
            error: 'INVALID_PAGE_RANGE_VALUES'
          });
        }
      }
    }
  }

  req.body = value;
  next();
};

// Generic request validation middleware
export const validateRequest = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
      allowUnknown: false
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));

      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors,
        error: 'VALIDATION_ERROR'
      });
    }

    req.body = value;
    next();
  };
};

// Query parameter validation
export const validateQuery = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errorMessage = error.details
        .map(detail => detail.message)
        .join(', ');
      
      return res.status(400).json({
        success: false,
        message: `Query validation error: ${errorMessage}`,
        error: 'QUERY_VALIDATION_ERROR'
      });
    }

    req.query = value;
    next();
  };
};