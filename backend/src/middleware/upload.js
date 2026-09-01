const multer = require('multer');
const ApiError = require('../utils/ApiError');
const { MIME_EXTENSIONS } = require('../services/storage');

// Memory storage, not disk: files must reach services/storage.js as buffers
// so they can go straight to Supabase Storage (or, in local dev without
// Supabase configured, be written out ourselves) — see storage.js for why
// nothing here writes to disk directly.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024, files: 20 },
  fileFilter: (req, file, cb) => {
    if (!MIME_EXTENSIONS[file.mimetype]) {
      // An ApiError (not a plain Error) so middleware/errorHandler.js's
      // `instanceof ApiError` branch returns a clean 400 with this message,
      // instead of falling through to a generic 500.
      return cb(new ApiError(400, `Unsupported file type: ${file.mimetype}`));
    }
    cb(null, true);
  },
});

module.exports = { upload };
