const jwt = require('jsonwebtoken');
const User = require('../models/User');
const GuestSession = require('../models/GuestSession');
const { pageKeyForUrl } = require('../config/pages');
const { purgeGuestData } = require('../utils/purgeGuestSession');

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Guests resolve to the owner account for auth, but every query is
      // scoped to their own temporary partition (guestSession).
      if (decoded.guest) {
        const session = await GuestSession.findById(decoded.sessionId);
        if (!session || !session.isLive()) {
          // Lazy cleanup: the session died (expired/revoked) — wipe its data.
          if (decoded.sessionId) purgeGuestData(decoded.sessionId).catch(() => {});
          return res.status(401).json({ message: 'This access link has expired or was ended' });
        }

        const user = await User.findById(decoded.id).select('-password');
        if (!user) {
          return res.status(401).json({ message: 'User not found' });
        }

        const pageKey = pageKeyForUrl(req.originalUrl);
        if (pageKey && !session.allowedPages.includes(pageKey)) {
          return res.status(403).json({ message: 'Your access does not include this area' });
        }

        req.user = user;
        req.guest = { sessionId: session._id, allowedPages: session.allowedPages };
        req.dataScope = { user: user._id, guestSession: session._id };
        return next();
      }

      const user = await User.findById(decoded.id).select('-password');
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
          const session = await GuestSession.findById(expired.sessionId);
          if (!session || !session.isLive()) {
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
