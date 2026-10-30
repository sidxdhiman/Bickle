const mongoose = require('mongoose');

const artMusicSchema = new mongoose.Schema({
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
  // True for copies cloned from the owner into a guest session — their url
  // points at the owner's file, which must never be deleted by guest cleanup.
  sharedCopy: {
    type: Boolean,
    default: false,
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
  madeAt: {
    type: Date,
    default: null,
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
  duration: {
    type: Number,
    default: 0,
  },
  peaks: {
    type: [Number],
    default: [],
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('ArtMusic', artMusicSchema);
