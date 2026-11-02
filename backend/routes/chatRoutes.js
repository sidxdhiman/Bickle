const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  listConversations,
  unreadCount,
  getMessages,
  sendMessage,
  markRead,
} = require('../controllers/chatController');

router.get('/', protect, listConversations);
router.get('/unread-count', protect, unreadCount);
router.get('/:id/messages', protect, getMessages);
router.post('/:id/messages', protect, sendMessage);
router.post('/:id/read', protect, markRead);

module.exports = router;
