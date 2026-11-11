const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
require('dotenv').config();

if (!process.env.JWT_SECRET) {
  console.warn('Warning: JWT_SECRET is not set. Using an insecure development secret.');
  process.env.JWT_SECRET = 'bickle-dev-secret-change-me';
}

const { openDatabase, closeDatabase } = require('./db');
const { setUploadRoot, getUploadRoot } = require('./config/storage');

const app = express();

// Dist hosting state — startServer({ serveDist, distDir }) flips these before
// the listener opens; the request-time guards below keep registration at
// module load (so the error handler stays last).
const dist = {
  enabled: process.env.SERVE_DIST === '1',
  dir: path.join(__dirname, '..', 'frontend', 'dist'),
};

// Middleware
app.use(cors());
app.use(express.json({ limit: '3mb' }));

// Uploads at both roots: stored paths are /uploads/... and the frontend
// prefixes its API origin (/bickle) onto them, so /bickle/uploads must answer
// too (the dev proxy rewrites the same way).
const uploadsStatic = (req, res, next) =>
  express.static(getUploadRoot())(req, res, next);
app.use('/uploads', uploadsStatic);
app.use('/bickle/uploads', uploadsStatic);

// Routes — mounted under /api (dev/proxy contract) and /bickle/api (the
// axios baseURL baked into the built frontend). Same router instances.
const routeTables = [
  ['auth', require('./routes/authRoutes')],
  ['chat', require('./routes/chatRoutes')],
  ['lists', require('./routes/listRoutes')],
  ['tasks', require('./routes/taskRoutes')],
  ['guest', require('./routes/guestRoutes')],
  ['calendar', require('./routes/calendarRoutes')],
  ['notes', require('./routes/noteRoutes')],
  ['sleep', require('./routes/sleepRoutes')],
  ['money', require('./routes/moneyRoutes')],
  ['settings', require('./routes/settingsRoutes')],
  ['habits', require('./routes/habitRoutes')],
  ['whiteboards', require('./routes/whiteboardRoutes')],
  ['art', require('./routes/artRoutes')],
];
for (const prefix of ['/api', '/bickle/api']) {
  for (const [name, router] of routeTables) {
    app.use(`${prefix}/${name}`, router);
  }
}

app.get('/', (req, res) => {
  if (dist.enabled) return res.redirect('/bickle/');
  res.send('Bickle API is running...');
});

// Built frontend under /bickle (BrowserRouter basename). Registered before
// the error handler so sendFile failures route into it.
app.use('/bickle', (req, res, next) => {
  if (!dist.enabled) return next();
  express.static(dist.dir)(req, res, next);
});
app.get('/bickle/*', (req, res, next) => {
  if (!dist.enabled || req.path.startsWith('/bickle/api/')) return next();
  res.sendFile(path.join(dist.dir, 'index.html'), (error) => {
    if (error) next(error);
  });
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ message: err.message });
  }
  if (err.status) {
    return res.status(err.status).json({ message: err.message });
  }
  console.error(err);
  res.status(500).json({ message: err.message || 'Something went wrong' });
});

// Boot-time housekeeping: wipe partitions left behind by expired/revoked
// guest sessions, then make sure the seeded profile accounts exist.
const cleanupPartitions = async () => {
  try {
    const { purgeStaleSessions } = require('./utils/purgeGuestSession');
    const purged = await purgeStaleSessions();
    if (purged > 0) console.log(`Purged data from ${purged} stale guest session(s)`);
  } catch (error) {
    console.warn('Stale guest session purge failed:', error.message);
  }
  try {
    const { ensureProfileAccounts } = require('./utils/seedProfiles');
    await ensureProfileAccounts();
  } catch (error) {
    console.warn('Profile seed failed:', error.message);
  }
};

// Opens the database, runs boot housekeeping and starts listening.
// Returns { app, server, port } — the Electron main process uses the
// returned port (it passes 0 for an ephemeral port).
const startServer = async (options = {}) => {
  const sqlitePath = options.sqlitePath
    || process.env.SQLITE_PATH
    || path.join(__dirname, 'data', 'bickle.db');
  const port = options.port !== undefined ? options.port : Number(process.env.PORT) || 9000;
  const uploadDir = options.uploadDir || process.env.UPLOAD_DIR;
  if (uploadDir) setUploadRoot(uploadDir);
  if (options.serveDist !== undefined) dist.enabled = Boolean(options.serveDist);
  if (options.distDir) dist.dir = options.distDir;

  openDatabase(sqlitePath);
  await cleanupPartitions();

  return new Promise((resolve, reject) => {
    const server = app.listen(port, '127.0.0.1', () => {
      const actualPort = server.address().port;
      console.log(`Server running on port ${actualPort}`);
      resolve({ app, server, port: actualPort });
    });
    server.on('error', reject);
  });
};

// CLI entry (node server.js) — skipped when the Electron main process
// requires this module to start the server itself.
if (require.main === module) {
  const cleanExit = () => {
    closeDatabase();
    process.exit(0);
  };
  process.on('SIGINT', cleanExit);
  process.on('SIGTERM', cleanExit);

  startServer().catch((error) => {
    console.error('Failed to start server:', error.message || error);
    process.exit(1);
  });
}

module.exports = { app, startServer };
