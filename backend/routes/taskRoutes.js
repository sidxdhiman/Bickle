const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  createTask, getTasks, updateTask, deleteTask
} = require('../controllers/taskController');

router.route('/').get(protect, getTasks).post(protect, createTask);
router.route('/:id').put(protect, updateTask).delete(protect, deleteTask);

module.exports = router;
