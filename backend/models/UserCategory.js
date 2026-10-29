const mongoose = require('mongoose');

const userCategorySchema = new mongoose.Schema({
  userId: {
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
  type: {
    type: String,
    enum: ['income', 'expense'],
    required: true,
  },
  color: {
    type: String,
    default: '#3B82F6',
  },
}, {
  timestamps: true,
});

// Unique per partition: no duplicate category names within one data scope.
userCategorySchema.index({ userId: 1, guestSession: 1, name: 1, type: 1 }, { unique: true });

module.exports = mongoose.model('UserCategory', userCategorySchema);
