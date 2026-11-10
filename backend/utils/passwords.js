const bcrypt = require('bcryptjs');

// Password hashing used to live in the User model's pre('save') hook; with
// SQLite every write path hashes explicitly through these helpers.

const hashPassword = async (plain) => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plain, salt);
};

const comparePassword = async (plain, hash) => bcrypt.compare(plain, hash);

module.exports = { hashPassword, comparePassword };
