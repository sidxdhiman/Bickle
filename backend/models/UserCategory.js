const mongoose = require('mongoose');

const userCategorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
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

// Ensure user can't have duplicate category names
userCategorySchema.index({ userId: 1, name: 1, type: 1 }, { unique: true });

module.exports = mongoose.model('UserCategory', userCategorySchema);
