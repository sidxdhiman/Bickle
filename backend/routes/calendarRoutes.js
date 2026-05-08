const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  createEvent, getEvents, updateEvent, deleteEvent, syncTasksToCalendar
} = require('../controllers/calendarController');

router.route('/').get(protect, getEvents).post(protect, createEvent);
router.route('/:id').put(protect, updateEvent).delete(protect, deleteEvent);
router.get('/sync-tasks', protect, syncTasksToCalendar);

module.exports = router;
