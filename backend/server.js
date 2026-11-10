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

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '3mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/chat', require('./routes/chatRoutes'));
app.use('/api/lists', require('./routes/listRoutes'));
app.use('/api/tasks', require('./routes/taskRoutes'));
app.use('/api/guest', require('./routes/guestRoutes'));
app.use('/api/calendar', require('./routes/calendarRoutes'));
app.use('/api/notes', require('./routes/noteRoutes'));
app.use('/api/sleep', require('./routes/sleepRoutes'));
app.use('/api/money', require('./routes/moneyRoutes'));
app.use('/api/settings', require('./routes/settingsRoutes'));
app.use('/api/habits', require('./routes/habitRoutes'));
app.use('/api/whiteboards', require('./routes/whiteboardRoutes'));
app.use('/api/art', require('./routes/artRoutes'));

app.get('/', (req, res) => {
  res.send('Bickle API is running...');
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
