import { PDFDocument } from 'pdf-lib';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { debugPdf } from '../utils/debugLogger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Merge multiple PDF files into one
export async function mergePdfFiles(inputFiles, operationId) {
  try {
    // Create a new PDF document
    const mergedPdf = await PDFDocument.create();
    
    // Sort files by order if provided
    const sortedFiles = inputFiles.sort((a, b) => (a.order || 0) - (b.order || 0));
    
    // Process each input file
    for (const file of sortedFiles) {
      debugPdf(`Processing file: ${file.originalName}`);
      
      // Read the PDF file
      const pdfBytes = await fs.readFile(file.path);
      const pdf = await PDFDocument.load(pdfBytes);
      
      // Get all pages from the current PDF
      const pageCount = pdf.getPageCount();
      const pageIndices = Array.from({ length: pageCount }, (_, i) => i);
      
      // Copy pages to the merged document
      const copiedPages = await mergedPdf.copyPages(pdf, pageIndices);
      
      // Add each copied page to the merged document
      copiedPages.forEach(page => mergedPdf.addPage(page));
      
      debugPdf(`Added ${pageCount} pages from ${file.originalName}`);
    }
    
    // Save the merged PDF
    const mergedPdfBytes = await mergedPdf.save();
    
    // Create output path
    const processedDir = path.join(__dirname, '..', 'processed');
    await fs.mkdir(processedDir, { recursive: true });
    
    const outputFileName = `merged_${operationId}_${Date.now()}.pdf`;
    const outputPath = path.join(processedDir, outputFileName);
    
    // Write the merged PDF to file
    await fs.writeFile(outputPath, mergedPdfBytes);
    
    debugPdf(`Merge completed: ${outputPath}`);
    return outputPath;
    
  } catch (error) {
    debugPdf('Error merging PDFs:', error);
    throw new Error(`Failed to merge PDFs: ${error.message}`);
  }
}

// Split a PDF file based on various criteria
export async function splitPdfFile(inputPath, operationId, options = {}) {
  try {
    const { splitType = 'pages', pageRanges = [], pagesPerFile = 1 } = options;
    
    // Read the input PDF
    const pdfBytes = await fs.readFile(inputPath);
    const pdf = await PDFDocument.load(pdfBytes);
    const totalPages = pdf.getPageCount();
    
    debugPdf(`Splitting PDF with ${totalPages} pages using ${splitType} method`);
    
    const processedDir = path.join(__dirname, '..', 'processed');
    await fs.mkdir(processedDir, { recursive: true });
    
    const outputPaths = [];
    
    switch (splitType) {
      case 'pages':
        // Split by individual pages
        for (let i = 0; i < totalPages; i++) {
          const newPdf = await PDFDocument.create();
          const [copiedPage] = await newPdf.copyPages(pdf, [i]);
          newPdf.addPage(copiedPage);
          
          const pdfBytes = await newPdf.save();
          const outputFileName = `split_${operationId}_page_${i + 1}_${Date.now()}.pdf`;
          const outputPath = path.join(processedDir, outputFileName);
          
          await fs.writeFile(outputPath, pdfBytes);
          outputPaths.push(outputPath);
        }
        break;
        
      case 'range':
        // Split by page ranges
        if (pageRanges.length === 0) {
          throw new Error('Page ranges must be provided for range splitting');
        }
        
        for (let rangeIndex = 0; rangeIndex < pageRanges.length; rangeIndex++) {
          const range = pageRanges[rangeIndex];
          const { startPage, endPage } = parsePageRange(range, totalPages);
          
          const newPdf = await PDFDocument.create();
          const pageIndices = [];
          
          for (let i = startPage - 1; i < endPage; i++) {
            pageIndices.push(i);
          }
          
          const copiedPages = await newPdf.copyPages(pdf, pageIndices);
          copiedPages.forEach(page => newPdf.addPage(page));
          
          const pdfBytes = await newPdf.save();
          const outputFileName = `split_${operationId}_range_${startPage}-${endPage}_${Date.now()}.pdf`;
          const outputPath = path.join(processedDir, outputFileName);
          
          await fs.writeFile(outputPath, pdfBytes);
          outputPaths.push(outputPath);
        }
        break;
        
      case 'size':
        // Split by number of pages per file
        const validPagesPerFile = Math.max(1, parseInt(pagesPerFile));
        const numberOfFiles = Math.ceil(totalPages / validPagesPerFile);
        
        for (let fileIndex = 0; fileIndex < numberOfFiles; fileIndex++) {
          const startPage = fileIndex * validPagesPerFile;
          const endPage = Math.min(startPage + validPagesPerFile, totalPages);
          
          const newPdf = await PDFDocument.create();
          const pageIndices = [];
          
          for (let i = startPage; i < endPage; i++) {
            pageIndices.push(i);
          }
          
          const copiedPages = await newPdf.copyPages(pdf, pageIndices);
          copiedPages.forEach(page => newPdf.addPage(page));
          
          const pdfBytes = await newPdf.save();
          const outputFileName = `split_${operationId}_part_${fileIndex + 1}_${Date.now()}.pdf`;
          const outputPath = path.join(processedDir, outputFileName);
          
          await fs.writeFile(outputPath, pdfBytes);
          outputPaths.push(outputPath);
        }
        break;
        
      default:
        throw new Error(`Unsupported split type: ${splitType}`);
    }
    
    debugPdf(`Split completed: ${outputPaths.length} files created`);
    return outputPaths;
    
  } catch (error) {
    debugPdf('Error splitting PDF:', error);
    throw new Error(`Failed to split PDF: ${error.message}`);
  }
}

// Parse page range string (e.g., "1-5", "3", "7-10")
function parsePageRange(range, totalPages) {
  const rangeStr = range.toString().trim();
  
  if (rangeStr.includes('-')) {
    const [start, end] = rangeStr.split('-').map(num => parseInt(num.trim()));
    
    if (isNaN(start) || isNaN(end) || start < 1 || end > totalPages || start > end) {
      throw new Error(`Invalid page range: ${range}. Pages must be between 1 and ${totalPages}`);
    }
    
    return { startPage: start, endPage: end };
  } else {
    const pageNum = parseInt(rangeStr);
    
    if (isNaN(pageNum) || pageNum < 1 || pageNum > totalPages) {
      throw new Error(`Invalid page number: ${range}. Pages must be between 1 and ${totalPages}`);
    }
    
    return { startPage: pageNum, endPage: pageNum };
  }
}

// Get PDF metadata
export async function getPdfMetadata(filePath) {
  try {
    const pdfBytes = await fs.readFile(filePath);
    const pdf = await PDFDocument.load(pdfBytes);
    
    const pageCount = pdf.getPageCount();
    const title = pdf.getTitle() || '';
    const author = pdf.getAuthor() || '';
    const subject = pdf.getSubject() || '';
    const creator = pdf.getCreator() || '';
    const producer = pdf.getProducer() || '';
    const creationDate = pdf.getCreationDate() || null;
    const modificationDate = pdf.getModificationDate() || null;
    
    return {
      pageCount,
      title,
      author,
      subject,
      creator,
      producer,
      creationDate,
      modificationDate
    };
  } catch (error) {
    debug('Error reading PDF metadata:', error);
    throw new Error(`Failed to read PDF metadata: ${error.message}`);
  }
}

// Validate PDF file
export async function validatePdfFile(filePath) {
  try {
    const pdfBytes = await fs.readFile(filePath);
    const pdf = await PDFDocument.load(pdfBytes);
    
    const pageCount = pdf.getPageCount();
    
    if (pageCount === 0) {
      throw new Error('PDF file has no pages');
    }
    
    return {
      isValid: true,
      pageCount,
      fileSize: pdfBytes.length
    };
  } catch (error) {
    debugPdf('PDF validation failed:', error);
    return {
      isValid: false,
      error: error.message
    };
  }
}