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
  // Per-module permission: { notes: 'view' | 'edit' }. Anything not listed
  // (or a legacy session without this map) is treated as full edit access.
  pageAccess: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  // Specific owner items copied into the guest's partition when the link
  // was created ({ page, itemId, title, payload? }).
  sharedItems: {
    type: [new mongoose.Schema({
      page: { type: String, required: true },
      itemId: { type: String, required: true },
      title: { type: String, default: '' },
      payload: { type: mongoose.Schema.Types.Mixed },
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
