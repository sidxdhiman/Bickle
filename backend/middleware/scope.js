const jwt = require('jsonwebtoken');
const User = require('../models/User');
const GuestSession = require('../models/GuestSession');
const { purgeGuestData } = require('../utils/purgeGuestSession');

// Query fragment scoping reads/writes to the caller's data partition.
// Owner:  { user: id, guestSession: null }   — matches all legacy docs (missing field == null)
// Guest:  { user: ownerId, guestSession: sid } — only their temporary partition
const scopeFilter = (req, ownerKey = 'user') => ({
  [ownerKey]: req.dataScope.user,
  guestSession: req.dataScope.guestSession,
});

// Fields stamped on creates so new docs land in the caller's partition.
const scopeFields = (req) => ({
  user: req.dataScope.user,
  guestSession: req.dataScope.guestSession,
});

// Strip partition/identity keys from client bodies — a hostile guest must not
// be able to move a doc into the owner partition (or anywhere else) by echoing
// crafted fields. Ownership always comes from the token, never the body.
const sanitizeBody = (body) => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return {};
  const { _id, id, user, userId, guestSession, owner, __v, ...rest } = body;
  return rest;
};

// Attaches dataScope when a valid token is present, otherwise falls back to the
// public/owner partition. Used by the public art showcase reads: guests only
// ever see their own session's work, everyone else sees non-guest art.
const optionalScope = async (req, res, next) => {
  req.dataScope = { user: null, guestSession: null };
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) return next();
    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.guest) {
      const session = await GuestSession.findById(decoded.sessionId);
      if (session && session.isLive()) {
        req.dataScope = { user: decoded.id, guestSession: session._id };
        req.guest = { sessionId: session._id, allowedPages: session.allowedPages };
      } else if (decoded.sessionId) {
        purgeGuestData(decoded.sessionId).catch(() => {});
      }
      return next();
    }

    const user = await User.findById(decoded.id).select('-password');
    if (user) {
      req.dataScope = { user: user._id, guestSession: null };
      req.user = user;
    }
  } catch (error) {
    // Expired/invalid token → public scope (guest data never leaks here).
  }
  next();
};

module.exports = { scopeFilter, scopeFields, sanitizeBody, optionalScope };
