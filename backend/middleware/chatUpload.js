const fs = require('fs');
const path = require('path');
const multer = require('multer');

const CHAT_UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'chat');

// Chat accepts essentially anything people share in messages — images, video,
// audio, documents and archives — with two hard rules: a25MB cap, and no
// types that could execute in the browser when the static /uploads route
// serves them back (html/svg/script) or run on the machine (executables).
const ALLOWED_EXTENSIONS = new Set([
  // images
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.bmp', '.tif', '.tiff', '.heic', '.heif',
  // video
  '.mp4', '.m4v', '.mov', '.webm', '.mkv', '.avi',
  // audio
  '.mp3', '.wav', '.m4a', '.aac', '.ogg', '.opus', '.flac',
  // documents & archives
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.csv', '.rtf', '.md',
  '.zip', '.rar', '.7z', '.gz',
]);

const BLOCKED_EXTENSIONS = new Set([
  '.html', '.htm', '.xhtml', '.svg', '.js', '.mjs', '.jsx', '.ts', '.sh', '.bash', '.zsh',
  '.exe', '.msi', '.bat', '.cmd', '.com', '.scr', '.app', '.deb', '.rpm', '.dmg', '.pkg',
]);

const BLOCKED_MIME = new Set([
  'text/html', 'application/xhtml+xml', 'image/svg+xml',
  'application/javascript', 'text/javascript', 'application/x-sh',
]);

const MAX_SIZE = 25 * 1024 * 1024;

const kindOf = (mimetype = '', filename = '') => {
  const ext = path.extname(filename).toLowerCase();
  if (mimetype.startsWith('image/') || ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.bmp', '.heic', '.heif'].includes(ext)) return 'image';
  if (mimetype.startsWith('video/') || ['.mp4', '.m4v', '.mov', '.webm', '.mkv', '.avi'].includes(ext)) return 'video';
  if (mimetype.startsWith('audio/') || ['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.opus', '.flac'].includes(ext)) return 'audio';
  return 'file';
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Never throw here: a synchronous exception inside multer's callback
    // escapes Express and takes the whole process down. Route it through cb
    // so the request fails with a normal error response instead.
    try {
      fs.mkdirSync(CHAT_UPLOAD_DIR, { recursive: true });
      cb(null, CHAT_UPLOAD_DIR);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).slice(0, 12).toLowerCase();
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_SIZE },
  fileFilter: (req, file, cb) => {
    const extension = path.extname(file.originalname || '').toLowerCase();
    const mimetype = (file.mimetype || '').toLowerCase();
    const generic = mimetype === 'application/octet-stream';

    if (BLOCKED_EXTENSIONS.has(extension) || BLOCKED_MIME.has(mimetype)) {
      const error = new Error(`This file type cannot be shared in chat (${extension || mimetype || 'unknown'})`);
      error.status = 400;
      return cb(error);
    }
    if (ALLOWED_EXTENSIONS.has(extension) || (!generic && (mimetype.startsWith('image/') || mimetype.startsWith('video/') || mimetype.startsWith('audio/') || mimetype === 'application/pdf'))) {
      return cb(null, true);
    }
    const error = new Error(`This file type cannot be shared in chat (${mimetype || extension || 'unknown'})`);
    error.status = 400;
    cb(error);
  },
});

module.exports = { upload, kindOf, CHAT_UPLOAD_DIR, MAX_SIZE };
