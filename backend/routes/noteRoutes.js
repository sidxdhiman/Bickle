const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  createNote, getNotes, updateNote, deleteNote,
  getCategories, createCategory, updateCategory, deleteCategory
} = require('../controllers/noteController');

router.route('/').get(protect, getNotes).post(protect, createNote);
router.route('/categories').get(protect, getCategories).post(protect, createCategory);
router.route('/categories/:name').put(protect, updateCategory).delete(protect, deleteCategory);
router.route('/:id').put(protect, updateNote).delete(protect, deleteNote);

module.exports = router;
