const mongoose = require('mongoose');

const artPhotoSchema = new mongoose.Schema({
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
    default: '',
    trim: true,
  },
  description: {
    type: String,
    default: '',
    trim: true,
  },
  location: {
    type: String,
    default: '',
    trim: true,
  },
  takenAt: {
    type: Date,
    default: null,
  },
  camera: {
    type: String,
    default: '',
    trim: true,
  },
  url: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    default: '',
  },
  size: {
    type: Number,
    default: 0,
  },
  width: {
    type: Number,
    default: 0,
  },
  height: {
    type: Number,
    default: 0,
  },
  source: {
    type: String,
    enum: ['upload', 'blog'],
    default: 'upload',
  },
  blog: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ArtBlog',
    default: null,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('ArtPhoto', artPhotoSchema);
