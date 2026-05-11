const mongoose = require('mongoose');

const sleepSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  date: {
    type: Date,
    required: true,
  },
  sleepStart: {
    type: Date,
    required: true,
  },
  sleepEnd: {
    type: Date,
    required: true,
  },
  duration: {
    type: Number, // in minutes
    required: true,
  },
  quality: {
    type: String,
    enum: ['poor', 'fair', 'good', 'excellent'],
    default: 'good',
  },
  notes: {
    type: String,
    trim: true,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('Sleep', sleepSchema);