const express = require('express');
const router = express.Router();
const { registerUser, loginUser, getMe, listProfiles, updateMe, createProfile } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

// Public: login profile picker + credential exchange.
router.get('/profiles', listProfiles);
router.post('/register', registerUser);
router.post('/login', loginUser);

// Signed-in profiles mint new sign-ins for other people (never guests).
router.post('/create-profile', protect, createProfile);

router.get('/me', protect, getMe);
router.put('/me', protect, updateMe);

module.exports = router;
