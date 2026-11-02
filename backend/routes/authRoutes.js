const express = require('express');
const router = express.Router();
const { registerUser, loginUser, getMe, listProfiles, updateMe } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

// Public: login profile picker + credential exchange.
router.get('/profiles', listProfiles);
router.post('/register', registerUser);
router.post('/login', loginUser);

router.get('/me', protect, getMe);
router.put('/me', protect, updateMe);

module.exports = router;
