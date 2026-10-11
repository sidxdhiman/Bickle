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
