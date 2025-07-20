import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { AppError } from '../utils/appError.js';
import { debugUpload } from '../utils/debugLogger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '..', 'uploads');
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp and random string
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    const extension = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, extension);
    const sanitizedBaseName = baseName.replace(/[^a-zA-Z0-9\-_]/g, '_');
    
    cb(null, `${sanitizedBaseName}-${uniqueSuffix}${extension}`);
  }
});

// File filter function
const fileFilter = (req, file, cb) => {
  // Check if file is PDF
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new AppError('Only PDF files are allowed', 400), false);
  }
};

// Configure multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
    files: 10 // Maximum 10 files
  }
});

// Error handler for multer
const handleMulterError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    let message;
    
    switch (error.code) {
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
        message = `Upload error: ${error.message}`;
    }
    
    return res.status(400).json({
      success: false,
      message,
      error: 'UPLOAD_ERROR'
    });
  }
  
  next(error);
};

// Upload middleware
export const uploadMiddleware = (req, res, next) => {
  const uploadHandler = upload.array('files', 10);
  
  uploadHandler(req, res, (error) => {
    if (error) {
      return handleMulterError(error, req, res, next);
    }
    
    // Additional validation
    if (req.files && req.files.length > 0) {
      // Validate each file
      for (const file of req.files) {
        if (!file.originalname.toLowerCase().endsWith('.pdf')) {
          return res.status(400).json({
            success: false,
            message: `Invalid file type for ${file.originalname}. Only PDF files are allowed.`,
            error: 'INVALID_FILE_TYPE'
          });
        }
        
        if (file.size === 0) {
          return res.status(400).json({
            success: false,
            message: `Empty file detected: ${file.originalname}`,
            error: 'EMPTY_FILE'
          });
        }
      }
      
      debugUpload(`Uploaded ${req.files.length} files:`, req.files.map(f => f.originalname));
    }
    
    next();
  });
};