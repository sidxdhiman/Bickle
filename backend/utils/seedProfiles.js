const { findOne, insert, updateById, count } = require('../db/helpers');
const { hashPassword, comparePassword } = require('./passwords');
const { PROFILES, SEED_PASSWORD } = require('../config/profiles');

// Resolves a profile key to its user row, tolerating pre-profile databases
// where the owner account still had legacy credentials.
const findProfileUser = (profile) => {
  let user = findOne('users', { email: profile.email });
  if (!user && profile.key === 'me') {
    user = findOne('users', { email: 'dev@bickle.com' });
  }
  if (!user) {
    user = findOne('users', { username: profile.username });
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
      const user = findProfileUser(profile);

      if (!user) {
        insert('users', {
          email: profile.email,
          username: profile.username,
          password: await hashPassword(SEED_PASSWORD),
          showcase: profile.showcase,
          avatar: '',
        });
        continue;
      }

      const patch = {};

      if (!user.email) {
        patch.email = profile.email;
      } else if (profile.key === 'me' && user.email === 'dev@bickle.com') {
        patch.email = profile.email;
      }

      // Seed accounts keep deterministic credentials — there is no
      // password-reset UI, so the boot seed is the source of truth.
      if (!(await comparePassword(SEED_PASSWORD, user.password))) {
        patch.password = await hashPassword(SEED_PASSWORD);
      }

      if (!user.username) {
        patch.username = profile.username;
      } else if (user.username !== profile.username) {
        const clash = findOne('users', { username: profile.username });
        if (!clash || clash._id === user._id) patch.username = profile.username;
      }

      if (user.showcase !== profile.showcase) patch.showcase = profile.showcase;
      if (!user.avatar) patch.avatar = '';

      if (Object.keys(patch).length > 0) updateById('users', user._id, patch);
    } catch (error) {
      console.warn(`Profile seed failed for "${profile.key}":`, error.message);
    }
  }

  // Safety net: never leave the DB without a showcase profile.
  try {
    const flagged = count('users', { showcase: true });
    if (flagged === 0) {
      const fallback = findProfileUser(PROFILES[0]);
      if (fallback && !fallback.showcase) {
        updateById('users', fallback._id, { showcase: true });
      }
    }
  } catch (error) {
    console.warn('Showcase profile fix-up failed:', error.message);
  }
};

module.exports = { ensureProfileAccounts, findProfileUser };
