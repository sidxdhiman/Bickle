const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const User = require('../models/User');
const Task = require('../models/Task');
const TaskList = require('../models/TaskList');
const Note = require('../models/Note');
const CalendarEvent = require('../models/CalendarEvent');
const Sleep = require('../models/Sleep');

// Delete all user data
const deleteAllData = async (req, res) => {
  try {
    const userId = req.user.id;

    // Delete all tasks
    await Task.deleteMany({ user: userId });

    // Delete all task lists
    await TaskList.deleteMany({ user: userId });

    // Delete all notes
    await Note.deleteMany({ user: userId });

    // Delete all calendar events
    await CalendarEvent.deleteMany({ user: userId });

    // Delete all sleep records
    await Sleep.deleteMany({ user: userId });

    res.status(200).json({ message: 'All data deleted successfully' });
  } catch (error) {
    console.error('Error deleting all data:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

router.delete('/delete-all-data', protect, deleteAllData);

module.exports = router;