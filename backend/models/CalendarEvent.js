const mongoose = require('mongoose');

const calendarEventSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  start: {
    type: Date,
    required: true,
  },
  end: {
    type: Date,
    required: true,
  },
  allDay: {
    type: Boolean,
    default: false,
  },
  color: {
    type: String,
    default: '#6366f1',
  },
  recurrence: {
    frequency: {
      type: String,
      enum: ['none', 'daily', 'weekdays', 'weekly', 'monthly'],
      default: 'none',
    },
    interval: {
      type: Number,
      default: 1,
      min: 1,
    },
    endDate: {
      type: Date,
    },
  },
  task: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task',
  },
  location: {
    type: String,
    trim: true,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('CalendarEvent', calendarEventSchema);
