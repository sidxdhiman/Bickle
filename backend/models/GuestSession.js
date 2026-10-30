const mongoose = require('mongoose');

const guestSessionSchema = new mongoose.Schema({
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  label: {
    type: String,
    trim: true,
    default: 'Guest',
  },
  allowedPages: {
    type: [String],
    default: [],
  },
  // Specific owner items copied into the guest's partition when the link
  // was created ({ page, itemId, title }).
  sharedItems: {
    type: [new mongoose.Schema({
      page: { type: String, required: true },
      itemId: { type: mongoose.Schema.Types.ObjectId, required: true },
      title: { type: String, default: '' },
    }, { _id: false })],
    default: [],
  },
  token: {
    type: String,
    required: true,
    unique: true,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
  active: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

guestSessionSchema.methods.isLive = function isLive() {
  return this.active && this.expiresAt.getTime() > Date.now();
};

module.exports = mongoose.model('GuestSession', guestSessionSchema);
