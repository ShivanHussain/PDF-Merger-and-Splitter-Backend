# PDF Merger & Splitter

##Project Overview

**Build Your Own PDF Merger and Splitter** is a versatile web application that allows users to combine multiple PDF files into a single document or divide a single PDF into multiple documents.
## ✨ Features

- **Merge multiple PDF files** - Combine several PDFs into one document
- **Split PDFs into separate documents** - Divide PDFs by page range or individual pages
- **Custom page arrangement** - Reorder pages before merging
- **Secure processing** - Files are processed securely without internet connection requirement
- **Split PDF by page range** - Extract specific page ranges
- **Quick and efficient** processing
- **User-friendly interface** - Intuitive drag-and-drop functionality
- **No registration required** - Start using immediately

## Technology Stack Options

### JavaScript Stack (Recommended)

- **Backend Framework:** Express.js
- **Runtime:** Node.js
- **Database:** MongoDB
- **PDF Processing:** pdf-lib, multer


## Prerequisites

- Node.js (v14 or higher)
- MongoDB (v4.4 or higher)
- npm or yarn package manager

## Installation & Setup

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/pdf-merger-splitter.git
cd pdf-merger-splitter
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Configuration
Create a `.env` file in the root directory:
```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/pdf-merger-splitter
NODE_ENV=development
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=50MB
```

### 4. Start MongoDB
```bash
# On Windows
net start MongoDB

# On macOS/Linux
sudo systemctl start mongod
```

### 5. Run the Application
```bash
# Development mode
npm run dev

# Production mode
npm start
```

The application will be available at `http://localhost:3000`

## Project Structure

```
pdf-merger-splitter/
|
├──config/
|   ├──config.env
|   ├──database.js
|   └──config.js
├── controllers/
│    └──  pdfController.js
├── middleware/
│    ├── uploadMiddleware.js
│    └── errorHandler.js
|    └── validation.js
├── models/
│    └── PdfOperation.js
├── Processed/
├── routes/
│    └── pdfRoutes.js  
├── services/
│    └── pdfService.js
├── temp/
├── uploads/
├── utils/
│    └── appError.js
|    ├── asyncHandler.js
|    ├── debugLogger.js
|    └── fileCleanup.js
├── app.js
├── package.json
├── server.js
└── README.md
```

## Dependencies

### Core Dependencies
```json
{
  "express": "^4.18.0",
  "mongoose": "^7.0.0",
  "pdf-lib": "^1.17.1",
  "multer": "^1.4.5",
  "cors": "^2.8.5",
  "dotenv": "^16.0.0",
  "helmet": "^6.0.0",
  "debug": "^4.4.1",
  "joi": "^17.9.2",
  "uuid": "^9.0.0"
}
```

### Development Dependencies
```json
{
  "nodemon": "^2.0.22",
  "jest": "^29.5.0",
  "supertest": "^6.3.3"
}
```

## API Endpoints

### PDF Operations
- `POST /api/pdf/merge` - Merge multiple PDF files
- `POST /api/pdf/split` - Split PDF by page range
- `POST /api/pdf/split-all` - Split PDF into individual pages
- `GET /api/pdf/download/:id` - Download processed PDF
- `DELETE /api/pdf/:id` - Delete PDF file

### File Upload
- `POST /api/upload` - Upload PDF files
- `GET /api/upload/status/:id` - Check upload status

## Usage Examples

### Merging PDFs
```javascript
// Frontend example
const formData = new FormData();
formData.append('files', file1);
formData.append('files', file2);

fetch('/api/pdf/merge', {
  method: 'POST',
  body: formData
})
.then(response => response.json())
.then(data => console.log(data));
```

### Splitting PDF
```javascript
// Split by page range
const splitData = {
  file: pdfFile,
  startPage: 1,
  endPage: 5
};

fetch('/api/pdf/split', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(splitData)
});
```

## Testing

Run tests using:
```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## Security Features

- File type validation (PDF only)
- File size limits
- Sanitized file names
- Temporary file cleanup
- CORS protection
- Helmet security headers


## Support

For support and questions:
- Create an issue in the GitHub repository
- Contact the development team


**Note:** This is a backend intermediate level project designed for learning purposes. Feel free to extend and modify according to your requirements.