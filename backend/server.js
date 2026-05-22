const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/lists', require('./routes/listRoutes'));
app.use('/api/tasks', require('./routes/taskRoutes'));
app.use('/api/calendar', require('./routes/calendarRoutes'));
app.use('/api/notes', require('./routes/noteRoutes'));
app.use('/api/sleep', require('./routes/sleepRoutes'));
app.use('/api/settings', require('./routes/settingsRoutes'));

app.get('/', (req, res) => {
  res.send('Bickle API is running...');
});

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  let mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/bickle';

  if (!process.env.MONGODB_URI) {
    console.warn('Warning: MONGODB_URI is not set. Trying mongodb://127.0.0.1:27017/bickle first.');
  }

  try {
    await mongoose.connect(mongoURI);
    console.log('Connected to MongoDB');
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
    return;
  } catch (err) {
    console.error('MongoDB connection error:', err.message || err);
    // If in development, fallback to an in-memory MongoDB
    if (process.env.NODE_ENV !== 'production') {
      try {
        console.warn('Local MongoDB not available — starting in-memory MongoDB for development.');
        const { MongoMemoryServer } = require('mongodb-memory-server');
        const mongod = await MongoMemoryServer.create();
        const memUri = mongod.getUri();
        await mongoose.connect(memUri);
        console.log('Connected to in-memory MongoDB');
        app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
        // stop in-memory server on exit
        const cleanExit = async () => {
          await mongoose.disconnect();
          await mongod.stop();
          process.exit(0);
        };
        process.on('SIGINT', cleanExit);
        process.on('SIGTERM', cleanExit);
        return;
      } catch (memErr) {
        console.error('In-memory MongoDB failed to start:', memErr);
        process.exit(1);
      }
    }

    process.exit(1);
  }
};

startServer();
