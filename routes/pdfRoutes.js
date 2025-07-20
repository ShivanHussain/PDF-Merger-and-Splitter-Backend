import express from 'express';
import { 
  uploadFiles, 
  mergePdfs, 
  splitPdf, 
  getOperationStatus,
  downloadFile,
  getOperationHistory, 
  downloadOperationResult,
  previewOperationResult,
  bulkDownload
} from '../controller/pdfController.js';
import { uploadMiddleware } from '../middlewares/uploadMiddleware.js';
import { validateMergeRequest, validateSplitRequest } from '../middlewares/validation.js';

const router = express.Router();

// Upload files endpoint
router.post('/upload', uploadMiddleware, uploadFiles);

// Merge PDFs endpoint
router.post('/merge', uploadMiddleware, validateMergeRequest, mergePdfs);

// Split PDF endpoint
router.post('/split', uploadMiddleware, validateSplitRequest, splitPdf);

// Get operation status
router.get('/status/:operationId', getOperationStatus);

// Download processed file
router.get('/download/:filename', downloadFile);

// Get operation history (last 50 operations)
router.get('/history', getOperationHistory);

// Operation-based download/preview routes
router.get('/download-operation/:operationId', downloadOperationResult);

router.get('/preview-operation/:operationId', previewOperationResult);

// Bulk download (zip)
router.get('/bulk-download/:operationId', bulkDownload);

// Health check for PDF operations
router.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'PDF operations service is running',
    timestamp: new Date().toISOString()
  });
});

export default router;