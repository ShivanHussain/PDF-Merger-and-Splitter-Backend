// fileCleanup.js
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config/config.js';
import debugLib from 'debug';

const debug = debugLib('app:cleanup');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Clean up old files based on configuration
export const cleanupFiles = async () => {
  const maxAge = config.tempFileLifetime * 60 * 60 * 1000; // Convert hours to milliseconds
  const now = Date.now();

  const directories = [
    path.join(__dirname, '..', 'uploads'),
    path.join(__dirname, '..', 'processed'),
    path.join(__dirname, '..', 'temp')
  ];

  debug('Starting file cleanup process...');
  let totalFilesRemoved = 0;
  let totalSizeFreed = 0;

  try {
    for (const directory of directories) {
      try {
        const files = await fs.readdir(directory);
        
        for (const file of files) {
          const filePath = path.join(directory, file);
          
          try {
            const stats = await fs.stat(filePath);
            
            // Check if file is older than maxAge
            if (now - stats.mtime.getTime() > maxAge) {
              await fs.unlink(filePath);
              totalFilesRemoved++;
              totalSizeFreed += stats.size;
              debug(`Removed old file: ${file} (${formatBytes(stats.size)})`);
            }
          } catch (fileError) {
            debug(`Error processing file ${file}: ${fileError.message}`);
          }
        }
      } catch (dirError) {
        debug(`Error accessing directory ${directory}: ${dirError.message}`);
      }
    }

    debug(`Cleanup completed: ${totalFilesRemoved} files removed, ${formatBytes(totalSizeFreed)} freed`);
  } catch (error) {
    debug(`File cleanup failed: ${error}`);
  }
};

// Format bytes to human readable format
const formatBytes = (bytes, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

// Clean up specific operation files
export const cleanupOperationFiles = async (operationId) => {
  const directories = [
    path.join(__dirname, '..', 'uploads'),
    path.join(__dirname, '..', 'processed')
  ];

  try {
    for (const directory of directories) {
      const files = await fs.readdir(directory);
      
      for (const file of files) {
        if (file.includes(operationId)) {
          const filePath = path.join(directory, file);
          try {
            await fs.unlink(filePath);
            debug(`Cleaned up operation file: ${file}`);
          } catch (error) {
            debug(`Failed to clean up file ${file}: ${error.message}`);
          }
        }
      }
    }
  } catch (error) {
    debug(`Failed to cleanup operation ${operationId}: ${error}`);
  }
};

// Get directory size and file count
export const getDirectoryStats = async (directoryPath) => {
  try {
    const files = await fs.readdir(directoryPath);
    let totalSize = 0;
    let fileCount = 0;

    for (const file of files) {
      try {
        const filePath = path.join(directoryPath, file);
        const stats = await fs.stat(filePath);
        
        if (stats.isFile()) {
          totalSize += stats.size;
          fileCount++;
        }
      } catch (error) {
        debug(`Error getting stats for ${file}: ${error.message}`);
      }
    }

    return {
      fileCount,
      totalSize,
      formattedSize: formatBytes(totalSize)
    };
  } catch (error) {
    debug(`Error getting directory stats for ${directoryPath}: ${error}`);
    return {
      fileCount: 0,
      totalSize: 0,
      formattedSize: '0 Bytes'
    };
  }
};
