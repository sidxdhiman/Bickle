const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { deleteWhere, tx } = require('../db/helpers');

// Delete all user data (owner only — never reachable by a guest session)
const deleteAllData = async (req, res) => {
  try {
    if (req.guest) {
      return res.status(403).json({ message: 'Guests cannot delete data' });
    }
    const userId = req.dataScope.user;

    // One transaction: a partial wipe would leave the app in a half-reset
    // state (the Mongo original was five non-atomic deleteManys).
    tx(() => {
      // Delete all tasks
      deleteWhere('tasks', { user: userId });

      // Delete all task lists
      deleteWhere('task_lists', { user: userId });

      // Delete all notes
      deleteWhere('notes', { user: userId });

      // Delete all calendar events
      deleteWhere('calendar_events', { user: userId });

      // Delete all sleep records
      deleteWhere('sleeps', { user: userId });
    });

    res.status(200).json({ message: 'All data deleted successfully' });
  } catch (error) {
    console.error('Error deleting all data:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

router.delete('/delete-all-data', protect, deleteAllData);

module.exports = router;
