const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  createList, getLists, updateList, deleteList,
  createTask, getTasks, updateTask, deleteTask
} = require('../controllers/taskController');

// List Routes
router.route('/').get(protect, getLists).post(protect, createList);
router.route('/:id').put(protect, updateList).delete(protect, deleteList);

// Task Routes (Nested under /tasks but we'll use a separate endpoint for clarity)
router.use('/tasks', (req, res, next) => next()); // Placeholder for potential specific task middleware

module.exports = router;
