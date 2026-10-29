const mongoose = require('mongoose');

const whiteboardSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  guestSession: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'GuestSession',
    default: null,
    index: true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
    default: 'Untitled Board',
  },
  elements: {
    type: Array,
    default: [],
  },
  background: {
    type: String,
    default: 'grid',
  },
  lastEdited: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('Whiteboard', whiteboardSchema);
