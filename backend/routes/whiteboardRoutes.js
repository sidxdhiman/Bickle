const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  createWhiteboard, getWhiteboards, getWhiteboard, updateWhiteboard, deleteWhiteboard
} = require('../controllers/whiteboardController');

router.route('/').get(protect, getWhiteboards).post(protect, createWhiteboard);
router.route('/:id')
  .get(protect, getWhiteboard)
  .put(protect, updateWhiteboard)
  .delete(protect, deleteWhiteboard);

module.exports = router;
