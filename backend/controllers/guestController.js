const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const GuestSession = require('../models/GuestSession');
const { GRANTABLE_PAGE_KEYS } = require('../config/pages');

const serialize = (session) => ({
  _id: session._id,
  label: session.label,
  allowedPages: session.allowedPages,
  token: session.token,
  expiresAt: session.expiresAt,
  active: session.active && session.expiresAt.getTime() > Date.now(),
  createdAt: session.createdAt,
});

exports.createSession = async (req, res) => {
  try {
    const { label, durationMinutes, allowedPages } = req.body;

    const minutes = Number(durationMinutes);
    if (!Number.isFinite(minutes) || minutes <= 0) {
      return res.status(400).json({ message: 'A valid duration in minutes is required' });
    }

    const pages = Array.isArray(allowedPages)
      ? allowedPages.filter((page) => GRANTABLE_PAGE_KEYS.includes(page))
      : [];
    if (pages.length === 0) {
      return res.status(400).json({ message: 'Select at least one module to share' });
    }

    const sessionId = new mongoose.Types.ObjectId();
    const expiresAt = new Date(Date.now() + minutes * 60 * 1000);
    const token = jwt.sign(
      { id: req.user._id, guest: true, sessionId },
      process.env.JWT_SECRET,
      { expiresIn: `${minutes}m` }
    );

    const session = await GuestSession.create({
      _id: sessionId,
      owner: req.user._id,
      label: (label || '').trim() || 'Guest',
      allowedPages: pages,
      token,
      expiresAt,
    });

    res.status(201).json(serialize(session));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.listSessions = async (req, res) => {
  try {
    const sessions = await GuestSession.find({ owner: req.user._id }).sort({ createdAt: -1 });
    res.json(sessions.map(serialize));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.revokeSession = async (req, res) => {
  try {
    const session = await GuestSession.findOneAndUpdate(
      { _id: req.params.id, owner: req.user._id },
      { active: false },
      { new: true }
    );
    if (!session) return res.status(404).json({ message: 'Session not found' });
    res.json(serialize(session));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getSession = async (req, res) => {
  try {
    const decoded = jwt.verify(req.params.token, process.env.JWT_SECRET);
    if (!decoded.guest) {
      return res.status(401).json({ message: 'Invalid access link' });
    }

    const session = await GuestSession.findById(decoded.sessionId);
    if (!session || !session.isLive()) {
      return res.status(410).json({ message: 'This access link has expired or was ended' });
    }

    res.json({
      allowedPages: session.allowedPages,
      expiresAt: session.expiresAt,
      label: session.label,
      active: true,
    });
  } catch (error) {
    res.status(401).json({ message: 'Invalid access link' });
  }
};

// Public: a guest can end their own session so the owner sees it as ended.
exports.endSessionByToken = async (req, res) => {
  try {
    const decoded = jwt.verify(req.params.token, process.env.JWT_SECRET);
    if (!decoded.guest) {
      return res.status(401).json({ message: 'Invalid access link' });
    }

    const session = await GuestSession.findById(decoded.sessionId);
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    session.active = false;
    await session.save();
    res.json({ message: 'Session ended' });
  } catch (error) {
    res.status(401).json({ message: 'Invalid access link' });
  }
};
