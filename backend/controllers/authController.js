const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { PROFILES, profileByKey } = require('../config/profiles');
const { findProfileUser } = require('../utils/seedProfiles');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

const publicUser = (user) => ({
  _id: user._id,
  username: user.username,
  email: user.email,
  avatar: user.avatar || '',
  showcase: !!user.showcase,
});

// Public: powers the login profile picker. Exposes display names only —
// never emails, avatars or password material.
exports.listProfiles = async (req, res) => {
  try {
    const profiles = [];
    for (const profile of PROFILES) {
      const user = await findProfileUser(profile);
      profiles.push({ key: profile.key, username: user?.username || profile.username });
    }
    res.json(profiles);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.registerUser = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    const userExists = await User.findOne({ $or: [{ email }, { username }] });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists with this email or username' });
    }

    const user = await User.create({ username, email, password });

    res.status(201).json({
      _id: user._id,
      username: user.username,
      email: user.email,
      token: generateToken(user._id),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.loginUser = async (req, res) => {
  try {
    const { email, password, profile } = req.body;

    let user = null;
    if (profile) {
      const definition = profileByKey(profile);
      if (!definition) {
        return res.status(400).json({ message: 'Unknown profile' });
      }
      user = await findProfileUser(definition);
    } else {
      user = await User.findOne({ email });
    }

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    res.json({
      ...publicUser(user),
      token: generateToken(user._id),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Profile edits (avatar) for the logged-in account. Guests never get here —
// chat/profile routes sit behind `protect` plus the guest page block.
exports.updateMe = async (req, res) => {
  try {
    if (req.guest) {
      return res.status(403).json({ message: 'Guests cannot edit the profile' });
    }
    const { avatar } = req.body;
    const user = await User.findById(req.user._id);

    if (avatar !== undefined) {
      if (avatar === null || avatar === '') {
        user.avatar = '';
      } else if (typeof avatar === 'string' && avatar.startsWith('data:image/') && avatar.length <= 2000000) {
        user.avatar = avatar;
      } else {
        return res.status(400).json({ message: 'Avatar must be an image data URL under 2MB' });
      }
    }

    await user.save();
    res.json(publicUser(user));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getMe = async (req, res) => {
  // Guests must never receive the owner's profile/contact details.
  if (req.guest) {
    return res.json({
      _id: req.user._id,
      username: 'Guest',
      isGuest: true,
      allowedPages: req.guest.allowedPages,
    });
  }
  res.json(req.user);
};
