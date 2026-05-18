const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
    default: 'Untitled Note',
  },
  content: {
    type: String,
    default: '',
    trim: true,
  },
  category: {
    type: String,
    default: 'General',
    trim: true,
  },
  tags: [String],
  isPinned: {
    type: Boolean,
    default: false,
  },
  lastEdited: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

// Text index for search functionality
noteSchema.index({ title: 'text', content: 'text', tags: 'text' });

module.exports = mongoose.model('Note', noteSchema);
