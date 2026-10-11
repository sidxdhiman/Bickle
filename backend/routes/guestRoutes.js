const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  createSession, listSessions, revokeSession, getSession, endSessionByToken,
} = require('../controllers/guestController');

// Public: validate a shared access link.
router.get('/session/:token', getSession);
// Public: a guest ends their own session.
router.post('/session/:token/end', endSessionByToken);

// Owner management routes.
router.route('/').get(protect, listSessions).post(protect, createSession);
router.route('/:id').delete(protect, revokeSession);

module.exports = router;
