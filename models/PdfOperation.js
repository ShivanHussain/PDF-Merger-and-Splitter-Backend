import mongoose from 'mongoose';

const pdfOperationSchema = new mongoose.Schema({
  operationId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  operationType: {
    type: String,
    required: true,
    enum: ['merge', 'split']
  },
  status: {
    type: String,
    required: true,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending'
  },
  inputFiles: [{
    originalName: String,
    filename: String,
    path: String,
    size: Number,
    mimetype: String
  }],
  outputFiles: [{
    filename: String,
    path: String,
    size: Number,
    downloadUrl: String
  }],
  metadata: {
    totalPages: Number,
    pageRanges: [String],
    mergeOrder: [Number],
    splitOptions: {
      splitType: {
        type: String,
        enum: ['pages', 'range', 'size']
      },
      pageRanges: [String],
      pagesPerFile: Number
    }
  },
  processing: {
    startTime: Date,
    endTime: Date,
    duration: Number,
    errorMessage: String
  },
  clientInfo: {
    ipAddress: String,
    userAgent: String
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
pdfOperationSchema.index({ createdAt: 1 });
pdfOperationSchema.index({ status: 1 });
pdfOperationSchema.index({ operationType: 1 });

// Virtual for operation duration
pdfOperationSchema.virtual('processingDuration').get(function() {
  if (this.processing.startTime && this.processing.endTime) {
    return this.processing.endTime - this.processing.startTime;
  }
  return null;
});

// Methods
pdfOperationSchema.methods.markAsProcessing = function() {
  this.status = 'processing';
  this.processing.startTime = new Date();
  return this.save();
};

pdfOperationSchema.methods.markAsCompleted = function(outputFiles) {
  this.status = 'completed';
  this.processing.endTime = new Date();
  this.processing.duration = this.processing.endTime - this.processing.startTime;
  this.outputFiles = outputFiles;
  return this.save();
};

pdfOperationSchema.methods.markAsFailed = function(errorMessage) {
  this.status = 'failed';
  this.processing.endTime = new Date();
  this.processing.errorMessage = errorMessage;
  return this.save();
};

// Statics
pdfOperationSchema.statics.findByOperationId = function(operationId) {
  return this.findOne({ operationId });
};

pdfOperationSchema.statics.getOperationStats = function() {
  return this.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);
};

// TTL index - documents will be automatically deleted after 7 days
pdfOperationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 604800 });

export const PdfOperation = mongoose.model('PdfOperation', pdfOperationSchema);