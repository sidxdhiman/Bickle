// The two first-class profiles of this Personal OS. Both get identical
// permissions — every module, settings and sharing included — but each one's
// data lives in its own partition and is never visible to the other.
//
// Login happens by profile key (never by guessing emails from the client):
//   POST /api/auth/login  { profile: 'me' | 'd', password }
const PROFILES = [
  { key: 'me', username: 'Sidharth', email: 'sid@bickle.com', showcase: true },
  { key: 'd', username: 'D', email: 'd@bickle.com', showcase: false },
];

// Accounts are seeded at boot so both profiles always exist with known
// credentials. Override with SEED_PASSWORD when deploying.
const SEED_PASSWORD = process.env.SEED_PASSWORD || '0]Hyisgh';

const profileByKey = (key) => PROFILES.find((profile) => profile.key === key) || null;

module.exports = { PROFILES, SEED_PASSWORD, profileByKey };
