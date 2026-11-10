const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { get, all, findOne, insert, updateById } = require('../db/helpers');
const { hashPassword, comparePassword } = require('../utils/passwords');
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

// Mongoose's lowercase+trim setters on the email path, applied at the edges.
const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

// Public: powers the login profile picker. Exposes display names only —
// never emails, avatars or password material. Profiles created from the app
// are listed after the seeded ones and sign in with their username as key.
exports.listProfiles = async (req, res) => {
  try {
    const profiles = [];
    const seeded = [];
    for (const profile of PROFILES) {
      const user = findProfileUser(profile);
      if (user) seeded.push(user._id);
      profiles.push({ key: profile.key, username: user?.username || profile.username });
    }
    const created = seeded.length === 0
      ? all('SELECT "_id", "username" FROM "users" ORDER BY "createdAt" ASC')
      : all(
        `SELECT "_id", "username" FROM "users"
         WHERE "_id" NOT IN (${seeded.map(() => '?').join(', ')})
         ORDER BY "createdAt" ASC`,
        seeded,
      );
    for (const user of created) {
      profiles.push({ key: user.username, username: user.username });
    }
    res.json(profiles);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Mints a brand-new sign-in for somebody else. Any signed-in profile may do
// it (guests may not) — the new account gets the whole app with its own
// private data partition, exactly like the seeded profiles.
exports.createProfile = async (req, res) => {
  try {
    if (req.guest) {
      return res.status(403).json({ message: 'Guests cannot create profiles' });
    }

    const username = String((req.body && req.body.username) || '').trim();
    const password = String((req.body && req.body.password) || '');

    if (!username || username.length > 32) {
      return res.status(400).json({ message: 'Username must be 1-32 characters' });
    }
    // The picker keys of the seeded profiles must stay unique — a created
    // profile called "me" would be unreachable from the login screen.
    if (profileByKey(username)) {
      return res.status(400).json({ message: 'That username is reserved' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const existing = all('SELECT "username" FROM "users"');
    if (existing.some((u) => u.username.toLowerCase() === username.toLowerCase())) {
      return res.status(400).json({ message: 'That username is already taken' });
    }

    // The schema needs a unique email, but these profiles only ever sign in
    // through the picker — a synthetic local address satisfies it.
    const slug =
      username.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'profile';
    const email = `${slug}-${crypto.randomBytes(3).toString('hex')}@bickle.local`;

    const user = insert('users', {
      username,
      email,
      password: await hashPassword(password),
    });
    res.status(201).json(publicUser(user));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.registerUser = async (req, res) => {
  try {
    const username = String((req.body && req.body.username) || '').trim();
    const email = normalizeEmail(req.body && req.body.email);
    const { password } = req.body;

    const userExists = get(
      'SELECT "_id" FROM "users" WHERE "email" = ? OR "username" = ?',
      [email, username],
    );
    if (userExists) {
      return res.status(400).json({ message: 'User already exists with this email or username' });
    }

    const user = insert('users', {
      username,
      email,
      password: await hashPassword(password),
    });

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
    const { password, profile } = req.body;
    const email = normalizeEmail(req.body && req.body.email);

    let user = null;
    if (profile) {
      const definition = profileByKey(profile);
      // Seeded profiles resolve through config (legacy emails and all);
      // created ones sign in with their username as the picker key.
      user = definition
        ? findProfileUser(definition)
        : findOne('users', { username: String(profile).trim() });
      if (!user) {
        return res.status(400).json({ message: 'Unknown profile' });
      }
    } else {
      user = findOne('users', { email });
    }

    if (!user || !(await comparePassword(password, user.password))) {
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

    if (avatar !== undefined) {
      if (!(avatar === null || avatar === ''
        || (typeof avatar === 'string' && avatar.startsWith('data:image/') && avatar.length <= 2000000))) {
        return res.status(400).json({ message: 'Avatar must be an image data URL under 2MB' });
      }
    }

    const patch = {};
    if (avatar !== undefined) {
      patch.avatar = avatar === null || avatar === '' ? '' : avatar;
    }

    const user = updateById('users', req.user._id, patch);
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }
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
  // req.user already arrived without the password column (see middleware/auth).
  res.json(req.user);
};
