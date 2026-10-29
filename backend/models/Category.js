const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
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
  name: {
    type: String,
    required: true,
    trim: true,
  },
}, {
  timestamps: true,
});

// Unique per partition: owner (guestSession null) and each guest session
// can independently hold a category with the same name.
categorySchema.index({ user: 1, guestSession: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Category', categorySchema);
