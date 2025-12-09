// backend/src/middleware/fileUpload.js
const multer = require('multer');

/**
 * Multer configuration for CSV file uploads
 */
const storage = multer.memoryStorage(); // Store in memory for immediate processing

const fileFilter = (req, file, cb) => {
  // Accept only CSV files
  if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
    cb(null, true);
  } else {
    cb(new Error('Only CSV files are allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1 // Single file upload
  }
});

/**
 * Middleware for single CSV file upload
 */
const uploadCSV = upload.single('recipientsFile');

/**
 * Error handling middleware for multer
 */
function handleUploadError(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'File too large',
        message: 'CSV file must be less than 10MB'
      });
    }
    return res.status(400).json({
      error: 'File upload error',
      message: err.message
    });
  } else if (err) {
    return res.status(400).json({
      error: 'File upload error',
      message: err.message
    });
  }
  next();
}

module.exports = {
  uploadCSV,
  handleUploadError
};
