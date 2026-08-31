const fs = require('fs');
const path = require('path');
const multer = require('multer');
const ApiError = require('../utils/ApiError');

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// The stored extension is derived from this map (keyed by the *validated*
// mimetype), never from the client-supplied original filename — the two are
// independently attacker-controlled and can be made to disagree (e.g.
// filename "x.svg" with Content-Type: image/png). Letting the filename pick
// the extension would let a file with disallowed, executable content type
// (SVG with an embedded <script>, or arbitrary HTML) get stored with that
// extension and then served by express.static with a matching, browser-
// executable Content-Type — exactly what the mimetype allowlist below is
// supposed to prevent.
const MIME_EXTENSIONS = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'video/mp4': '.mp4',
  'video/quicktime': '.mov',
  'video/webm': '.webm',
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = MIME_EXTENSIONS[file.mimetype];
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${ext}`);
  },
});

const upload = multer({
  storage,
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

function mediaTypeFor(mimetype) {
  return mimetype.startsWith('video/') ? 'video' : 'image';
}

module.exports = { upload, mediaTypeFor, UPLOAD_DIR };
