import { v4 as uuidv4 } from 'uuid';
import { PdfOperation } from '../models/PdfOperation.js';
import { mergePdfFiles, splitPdfFile } from '../services/pdfService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/appError.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { debugPdfController } from '../utils/debugLogger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Upload files handler
export const uploadFiles = asyncHandler(async (req, res) => {
  if (!req.files || req.files.length === 0) {
    throw new AppError('No files uploaded', 400);
  }

  const operationId = uuidv4();
  const inputFiles = req.files.map(file => ({
    originalName: file.originalname,
    filename: file.filename,
    path: file.path,
    size: file.size,
    mimetype: file.mimetype
  }));

  const operation = new PdfOperation({
    operationId,
    operationType: 'upload',
    status: 'completed',
    inputFiles,
    clientInfo: {
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    }
  });

  await operation.save();

  res.status(200).json({
    success: true,
    message: 'Files uploaded successfully',
    data: {
      operationId,
      files: inputFiles.map(file => ({
        originalName: file.originalName,
        filename: file.filename,
        size: file.size,
        previewUrl: `/api/pdf/preview/${file.filename}`,
        downloadUrl: `/api/pdf/download/${file.filename}`
      }))
    }
  });
});

// Merge PDFs handler
export const mergePdfs = asyncHandler(async (req, res) => {
    
  if (!req.files || req.files.length < 2) {
    throw new AppError('At least 2 PDF files are required for merging', 400);
  }

  const operationId = uuidv4();
  const { mergeOrder = [] } = req.body;
  
  const inputFiles = req.files.map((file, index) => ({
    originalName: file.originalname,
    filename: file.filename,
    path: file.path,
    size: file.size,
    mimetype: file.mimetype,
    order: mergeOrder[index] || index
  }));

  // Create operation record
  const operation = new PdfOperation({
    operationId,
    operationType: 'merge',
    status: 'pending',
    inputFiles: inputFiles.map(({ order, ...file }) => file),
    metadata: {
      mergeOrder: mergeOrder.length > 0 ? mergeOrder : inputFiles.map((_, i) => i)
    },
    clientInfo: {
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    }
  });

  await operation.save();

  // Start processing in background
  processMergeOperation(operation, inputFiles, mergeOrder);

  res.status(202).json({
    success: true,
    message: 'Merge operation started',
    data: {
      operationId,
      status: 'processing',
      statusUrl: `/api/pdf/status/${operationId}`,
      previewUrl: `/api/pdf/preview-operation/${operationId}`,
      downloadUrl: `/api/pdf/download-operation/${operationId}`
    }
  });
});

// Split PDF handler
export const splitPdf = asyncHandler(async (req, res) => {
  if (!req.files || req.files.length !== 1) {
    throw new AppError('Exactly one PDF file is required for splitting', 400);
  }

  const operationId = uuidv4();
  const { 
    splitType = 'pages', 
    pageRanges = [], 
    pagesPerFile = 1 
  } = req.body;

  const inputFile = req.files[0];
  const inputFiles = [{
    originalName: inputFile.originalname,
    filename: inputFile.filename,
    path: inputFile.path,
    size: inputFile.size,
    mimetype: inputFile.mimetype
  }];

  // Create operation record
  const operation = new PdfOperation({
    operationId,
    operationType: 'split',
    status: 'pending',
    inputFiles,
    metadata: {
      splitOptions: {
        splitType,
        pageRanges: Array.isArray(pageRanges) ? pageRanges : [pageRanges].filter(Boolean),
        pagesPerFile: parseInt(pagesPerFile) || 1
      }
    },
    clientInfo: {
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    }
  });

  await operation.save();

  // Start processing in background
  processSplitOperation(operation, inputFile, { splitType, pageRanges, pagesPerFile });

  res.status(202).json({
    success: true,
    message: 'Split operation started',
    data: {
      operationId,
      status: 'processing',
      statusUrl: `/api/pdf/status/${operationId}`,
      previewUrl: `/api/pdf/preview-operation/${operationId}`,
      downloadUrl: `/api/pdf/download-operation/${operationId}`
    }
  });
});

// Get operation status
export const getOperationStatus = asyncHandler(async (req, res) => {
  const { operationId } = req.params;

  const operation = await PdfOperation.findByOperationId(operationId);
  if (!operation) {
    throw new AppError('Operation not found', 404);
  }

  const response = {
    success: true,
    data: {
      operationId: operation.operationId,
      operationType: operation.operationType,
      status: operation.status,
      createdAt: operation.createdAt,
      inputFiles: operation.inputFiles.map(file => ({
        originalName: file.originalName,
        size: file.size,
        previewUrl: `/api/pdf/preview/${file.filename}`,
        downloadUrl: `/api/pdf/download/${file.filename}`
      }))
    }
  };

  if (operation.status === 'completed' && operation.outputFiles.length > 0) {
    response.data.outputFiles = operation.outputFiles.map(file => ({
      filename: file.filename,
      size: file.size,
      previewUrl: `/api/pdf/preview/${file.filename}`,
      downloadUrl: `/api/pdf/download/${file.filename}`
    }));
  }

  if (operation.status === 'failed') {
    response.data.error = operation.processing.errorMessage;
  }

  if (operation.processing.duration) {
    response.data.processingTime = `${operation.processing.duration}ms`;
  }

  res.json(response);
});

// Download file by filename
export const downloadFile = asyncHandler(async (req, res) => {
  const { filename } = req.params;
  const filePath = path.join(__dirname, '..', 'processed', filename);

  try {
    await fs.access(filePath);
    
    // Set appropriate headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    res.download(filePath, filename, (err) => {
      if (err) {
        debugPdfController('Download error:', err);
        throw new AppError('File download failed', 500);
      }
    });
  } catch (error) {
    throw new AppError('File not found', 404);
  }
});

// Preview file by filename
export const previewFile = asyncHandler(async (req, res) => {
  const { filename } = req.params;
  const filePath = path.join(__dirname, '..', 'processed', filename);

  try {
    await fs.access(filePath);
    
    // Set headers for inline PDF viewing
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    // Send file for preview
    res.sendFile(filePath);
  } catch (error) {
    throw new AppError('File not found for preview', 404);
  }
});

// Download operation result (for completed operations)
export const downloadOperationResult = asyncHandler(async (req, res) => {
  const { operationId } = req.params;

  const operation = await PdfOperation.findByOperationId(operationId);
  if (!operation) {
    throw new AppError('Operation not found', 404);
  }

  if (operation.status !== 'completed') {
    throw new AppError('Operation not completed yet', 400);
  }

  if (!operation.outputFiles || operation.outputFiles.length === 0) {
    throw new AppError('No output files available', 404);
  }

  // For single file operations (like merge), download directly
  if (operation.outputFiles.length === 1) {
    const outputFile = operation.outputFiles[0];
    const filePath = path.join(__dirname, '..', 'processed', outputFile.filename);
    
    try {
      await fs.access(filePath);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${outputFile.filename}"`);
      
      res.download(filePath, outputFile.filename);
    } catch (error) {
      throw new AppError('Output file not found', 404);
    }
  } 
  // For multiple files (like split), create zip or provide list
  else {
    res.json({
      success: true,
      message: 'Multiple files available for download',
      data: {
        operationId,
        outputFiles: operation.outputFiles.map(file => ({
          filename: file.filename,
          size: file.size,
          downloadUrl: `/api/pdf/download/${file.filename}`,
          previewUrl: `/api/pdf/preview/${file.filename}`
        }))
      }
    });
  }
});

// Preview operation result
export const previewOperationResult = asyncHandler(async (req, res) => {
  const { operationId } = req.params;
  const { fileIndex = 0 } = req.query;

  const operation = await PdfOperation.findByOperationId(operationId);
  if (!operation) {
    throw new AppError('Operation not found', 404);
  }

  if (operation.status !== 'completed') {
    throw new AppError('Operation not completed yet', 400);
  }

  if (!operation.outputFiles || operation.outputFiles.length === 0) {
    throw new AppError('No output files available', 404);
  }

  const fileIdx = parseInt(fileIndex);
  if (fileIdx >= operation.outputFiles.length) {
    throw new AppError('File index out of range', 400);
  }

  const outputFile = operation.outputFiles[fileIdx];
  const filePath = path.join(__dirname, '..', 'processed', outputFile.filename);

  try {
    await fs.access(filePath);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${outputFile.filename}"`);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    
    res.sendFile(filePath);
  } catch (error) {
    throw new AppError('Output file not found for preview', 404);
  }
});

// Get operation history
export const getOperationHistory = asyncHandler(async (req, res) => {
  const { page = 1, limit = 50, status, operationType } = req.query;
  
  const filter = {};
  if (status) filter.status = status;
  if (operationType) filter.operationType = operationType;

  const operations = await PdfOperation.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .select('operationId operationType status createdAt processing.duration inputFiles outputFiles');

  const total = await PdfOperation.countDocuments(filter);

  const operationsWithUrls = operations.map(op => ({
    ...op.toObject(),
    previewUrl: `/api/pdf/preview-operation/${op.operationId}`,
    downloadUrl: `/api/pdf/download-operation/${op.operationId}`,
    statusUrl: `/api/pdf/status/${op.operationId}`
  }));

  res.json({
    success: true,
    data: {
      operations: operationsWithUrls,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    }
  });
});

// Bulk download multiple files as zip
export const bulkDownload = asyncHandler(async (req, res) => {
  const { operationId } = req.params;

  const operation = await PdfOperation.findByOperationId(operationId);
  if (!operation) {
    throw new AppError('Operation not found', 404);
  }

  if (operation.status !== 'completed') {
    throw new AppError('Operation not completed yet', 400);
  }

  if (!operation.outputFiles || operation.outputFiles.length === 0) {
    throw new AppError('No output files available', 404);
  }

  // If only one file, redirect to direct download
  if (operation.outputFiles.length === 1) {
    return res.redirect(`/api/pdf/download/${operation.outputFiles[0].filename}`);
  }

  // For multiple files, you would typically create a zip
  // This is a placeholder - you'd need to implement zip creation
  const archiver = require('archiver');
  const archive = archiver('zip', { zlib: { level: 9 } });

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${operationId}-files.zip"`);

  archive.pipe(res);

  // Add each file to the archive
  for (const outputFile of operation.outputFiles) {
    const filePath = path.join(__dirname, '..', 'processed', outputFile.filename);
    try {
      await fs.access(filePath);
      archive.file(filePath, { name: outputFile.filename });
    } catch (error) {
      debugPdfController(`File not found for zip: ${outputFile.filename}`);
    }
  }

  archive.finalize();
});

// Background processing functions
async function processMergeOperation(operation, inputFiles, mergeOrder) {
  try {
    await operation.markAsProcessing();

    const orderedFiles = mergeOrder && mergeOrder.length > 0 
      ? mergeOrder.map(index => inputFiles[index]).filter(Boolean)
      : inputFiles;

    const outputPath = await mergePdfFiles(orderedFiles, operation.operationId);
    const stats = await fs.stat(outputPath);
    
    const outputFiles = [{
      filename: path.basename(outputPath),
      path: outputPath,
      size: stats.size,
      downloadUrl: `/api/pdf/download/${path.basename(outputPath)}`,
      previewUrl: `/api/pdf/preview/${path.basename(outputPath)}`
    }];

    await operation.markAsCompleted(outputFiles);
  } catch (error) {
    debugPdfController('Merge operation failed:', error);
    await operation.markAsFailed(error.message);
  }
}

async function processSplitOperation(operation, inputFile, options) {
  try {
    await operation.markAsProcessing();

    const outputPaths = await splitPdfFile(inputFile.path, operation.operationId, options);
    
    const outputFiles = await Promise.all(
      outputPaths.map(async (outputPath) => {
        const stats = await fs.stat(outputPath);
        return {
          filename: path.basename(outputPath),
          path: outputPath,
          size: stats.size,
          downloadUrl: `/api/pdf/download/${path.basename(outputPath)}`,
          previewUrl: `/api/pdf/preview/${path.basename(outputPath)}`
        };
      })
    );

    await operation.markAsCompleted(outputFiles);
  } catch (error) {
    debugPdfController('Split operation failed:', error);
    await operation.markAsFailed(error.message);
  }
}