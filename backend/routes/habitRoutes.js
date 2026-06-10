const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const habitController = require('../controllers/habitController');

// Get all habits
router.get('/', protect, habitController.getHabits);

// Get single habit by ID
router.get('/:id', protect, habitController.getHabitById);

// Create a new habit
router.post('/', protect, habitController.createHabit);

// Update a habit
router.put('/:id', protect, habitController.updateHabit);

// Delete a habit
router.delete('/:id', protect, habitController.deleteHabit);

// Mark a habit as completed for today
router.put('/:id/complete', protect, habitController.completeHabit);

module.exports = router;
