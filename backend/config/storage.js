// Upload root resolution. Defaults to backend/uploads (dev + API-only mode);
// startServer({ uploadDir }) points it at Electron's userData folder before
// the first request. Every consumer resolves through the getter at request
// time so the override applies even though routes load at require time.

const path = require('path');

let uploadRoot = path.join(__dirname, '..', 'uploads');

const setUploadRoot = (dir) => {
  if (dir) uploadRoot = dir;
};

const getUploadRoot = () => uploadRoot;

module.exports = { setUploadRoot, getUploadRoot };
