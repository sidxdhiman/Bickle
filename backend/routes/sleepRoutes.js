const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  createSleep, getSleeps, updateSleep, deleteSleep,
  getSleepTime, getWakeTime
} = require('../controllers/sleepController');

router.route('/').get(protect, getSleeps).post(protect, createSleep);
router.route('/:id').put(protect, updateSleep).delete(protect, deleteSleep);

// Analyzer routes
router.get('/analyzer/sleep-time', protect, getSleepTime);
router.get('/analyzer/wake-time', protect, getWakeTime);

module.exports = router;