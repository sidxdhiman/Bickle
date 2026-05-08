const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  createNote, getNotes, updateNote, deleteNote, getCategories
} = require('../controllers/noteController');

router.route('/').get(protect, getNotes).post(protect, createNote);
router.route('/categories').get(protect, getCategories);
router.route('/:id').put(protect, updateNote).delete(protect, deleteNote);

module.exports = router;
