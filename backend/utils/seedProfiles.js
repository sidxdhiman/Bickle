const User = require('../models/User');
const { PROFILES, SEED_PASSWORD } = require('../config/profiles');

// Resolves a profile key to its user document, tolerating pre-profile
// databases where the owner account still had legacy credentials.
const findProfileUser = async (profile) => {
  let user = await User.findOne({ email: profile.email });
  if (!user && profile.key === 'me') {
    user = await User.findOne({ email: 'dev@bickle.com' });
  }
  if (!user) {
    user = await User.findOne({ username: profile.username });
  }
  return user;
};

// Keeps the two profile accounts present and loginable.
//
// The "me" profile adopts the legacy owner account (dev@bickle.com) when one
// exists, so every note/task/art item created before profiles were introduced
// stays with its original owner. Exactly one account carries showcase: true —
// that profile's art powers the public Sid-Art site.
const ensureProfileAccounts = async () => {
  for (const profile of PROFILES) {
    try {
      const user = (await findProfileUser(profile)) || new User({ password: SEED_PASSWORD });

      if (!user.email) {
        user.email = profile.email;
      } else if (profile.key === 'me' && user.email === 'dev@bickle.com') {
        user.email = profile.email;
      }

      // Seed accounts keep deterministic credentials — there is no
      // password-reset UI, so the boot seed is the source of truth.
      if (!(await user.comparePassword(SEED_PASSWORD))) user.password = SEED_PASSWORD;
      if (!user.username) {
        user.username = profile.username;
      } else if (user.username !== profile.username) {
        const clash = await User.findOne({ username: profile.username, _id: { $ne: user._id } });
        if (!clash) user.username = profile.username;
      }
      if (user.showcase !== profile.showcase) user.showcase = profile.showcase;
      if (!user.avatar) user.avatar = '';

      await user.save();
    } catch (error) {
      console.warn(`Profile seed failed for "${profile.key}":`, error.message);
    }
  }

  // Safety net: never leave the DB without a showcase profile.
  try {
    const flagged = await User.countDocuments({ showcase: true });
    if (flagged === 0) {
      const fallback = await findProfileUser(PROFILES[0]);
      if (fallback && !fallback.showcase) {
        fallback.showcase = true;
        await fallback.save();
      }
    }
  } catch (error) {
    console.warn('Showcase profile fix-up failed:', error.message);
  }
};

module.exports = { ensureProfileAccounts, findProfileUser };
