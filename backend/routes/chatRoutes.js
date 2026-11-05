const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { upload } = require('../middleware/chatUpload');
const {
  listConversations,
  unreadCount,
  getMessages,
  sendMessage,
  markRead,
  updateSettings,
  leaveConversation,
} = require('../controllers/chatController');

router.get('/', protect, listConversations);
router.get('/unread-count', protect, unreadCount);
router.put('/:id/settings', protect, updateSettings);
// multer passes plain JSON bodies straight through, so text-only messages
// keep working while multipart requests carry an attachment.
router.post('/:id/messages', protect, upload.single('file'), sendMessage);
router.get('/:id/messages', protect, getMessages);
router.post('/:id/read', protect, markRead);
router.post('/:id/leave', protect, leaveConversation);

module.exports = router;
