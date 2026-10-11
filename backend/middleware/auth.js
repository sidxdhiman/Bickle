const jwt = require('jsonwebtoken');
const User = require('../models/User');
const GuestSession = require('../models/GuestSession');
const { pageKeyForUrl } = require('../config/pages');

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Guests act on behalf of the owner, limited to the granted modules.
      if (decoded.guest) {
        const session = await GuestSession.findById(decoded.sessionId);
        if (!session || !session.isLive()) {
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
        return next();
      }

      const user = await User.findById(decoded.id).select('-password');
      if (!user) {
        return res.status(401).json({ message: 'User not found' });
      }

      req.user = user;
      next();
    } catch (error) {
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }
};

module.exports = { protect };
