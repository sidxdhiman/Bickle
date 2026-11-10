const jwt = require('jsonwebtoken');
const { findById } = require('../db/helpers');
const { pageKeyForUrl } = require('../config/pages');
const { purgeGuestData } = require('../utils/purgeGuestSession');
const { isSessionLive } = require('../utils/sessionLive');

// The token's user row without password material — mongoose used to strip it
// with .select('-password'); every consumer (getMe included) expects that.
const safeUser = (user) => {
  if (!user) return null;
  const { password, ...rest } = user;
  return rest;
};

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Guests resolve to the owner account for auth, but every query is
      // scoped to their own temporary partition (guestSession).
      if (decoded.guest) {
        const session = findById('guest_sessions', decoded.sessionId);
        if (!isSessionLive(session)) {
          // Lazy cleanup: the session died (expired/revoked) — wipe its data.
          if (decoded.sessionId) purgeGuestData(decoded.sessionId).catch(() => {});
          return res.status(401).json({ message: 'This access link has expired or was ended' });
        }

        const user = safeUser(findById('users', decoded.id));
        if (!user) {
          return res.status(401).json({ message: 'User not found' });
        }

        const pageKey = pageKeyForUrl(req.originalUrl);
        if (pageKey && !session.allowedPages.includes(pageKey)) {
          return res.status(403).json({ message: 'Your access does not include this area' });
        }

        // Read-only modules: guests may only GET (no create/update/delete).
        const isReadOnly = pageKey
          && (session.pageAccess || {})[pageKey] === 'view'
          && !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
        if (isReadOnly) {
          return res.status(403).json({ message: 'This area was shared as view-only' });
        }

        req.user = user;
        req.guest = {
          sessionId: session._id,
          allowedPages: session.allowedPages,
          pageAccess: session.pageAccess || {},
        };
        req.dataScope = { user: user._id, guestSession: session._id };
        return next();
      }

      const user = safeUser(findById('users', decoded.id));
      if (!user) {
        return res.status(401).json({ message: 'User not found' });
      }

      req.user = user;
      req.dataScope = { user: user._id, guestSession: null };
      next();
    } catch (error) {
      // Signature-invalid tokens never purge (unverifiable sessionId = DoS vector).
      // Signed-but-expired guest tokens do: purge once the session is dead.
      try {
        const expired = jwt.verify(token, process.env.JWT_SECRET, { ignoreExpiration: true });
        if (expired.guest && expired.sessionId) {
          const session = findById('guest_sessions', expired.sessionId);
          if (!isSessionLive(session)) {
            purgeGuestData(expired.sessionId).catch(() => {});
          }
        }
      } catch (ignored) {
        // Not a valid signed token — nothing to clean up.
      }
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }
};

module.exports = { protect };
