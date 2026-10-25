const fs = require('fs');
const path = require('path');
const multer = require('multer');

const UPLOAD_ROOT = path.join(__dirname, '..', 'uploads', 'art');

const KINDS = {
  images: {
    dir: 'images',
    maxSize: 25 * 1024 * 1024,
    extensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.heif', '.avif', '.bmp', '.tif', '.tiff'],
    accepts: (type) => type.startsWith('image/'),
  },
  videos: {
    dir: 'videos',
    maxSize: 500 * 1024 * 1024,
    extensions: ['.mp4', '.m4v', '.mov', '.webm', '.mkv', '.avi'],
    accepts: (type) => type.startsWith('video/'),
  },
  music: {
    dir: 'music',
    maxSize: 200 * 1024 * 1024,
    extensions: ['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac', '.opus'],
    accepts: (type) => type.startsWith('audio/'),
  },
};

const makeUpload = (kind) => {
  const config = KINDS[kind];
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(UPLOAD_ROOT, config.dir);
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).slice(0, 12).toLowerCase();
      cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
    },
  });

  return multer({
    storage,
    limits: { fileSize: config.maxSize },
    fileFilter: (req, file, cb) => {
      const extension = path.extname(file.originalname || '').toLowerCase();
      const generic = file.mimetype === 'application/octet-stream';
      if (config.accepts(file.mimetype) || (generic && config.extensions.includes(extension))) {
        return cb(null, true);
      }
      const error = new Error(`This file type cannot be uploaded here (${file.mimetype || extension || 'unknown'})`);
      error.status = 400;
      cb(error);
    },
  });
};

module.exports = { makeUpload, UPLOAD_ROOT };
