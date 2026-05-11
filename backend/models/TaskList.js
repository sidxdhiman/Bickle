const mongoose = require('mongoose');

const taskListSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  isFavorite: {
    type: Boolean,
    default: false,
  },
  color: {
    type: String,
    default: '#6366f1',
  },
  statuses: [{
    id: {
      type: String,
      required: true,
    },
    label: {
      type: String,
      required: true,
    },
    color: {
      type: String,
      default: '#6366f1',
    },
  }],
}, {
  timestamps: true,
});

// Set default statuses if not provided
taskListSchema.pre('save', function(next) {
  if (!this.statuses || this.statuses.length === 0) {
    this.statuses = [
      { id: 'todo', label: 'To Do', color: '#64748b' },
      { id: 'in-progress', label: 'In Progress', color: '#3b82f6' },
      { id: 'completed', label: 'Completed', color: '#10b981' },
    ];
  }
  next();
});

module.exports = mongoose.model('TaskList', taskListSchema);
