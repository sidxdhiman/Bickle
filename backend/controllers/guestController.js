const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const GuestSession = require('../models/GuestSession');
const { GRANTABLE_PAGE_KEYS } = require('../config/pages');
const { purgeGuestData } = require('../utils/purgeGuestSession');
const { cloneSharedItems, PAGE_SOURCES } = require('../utils/cloneSharedItems');

const serializeSharedItems = (items) =>
  (items || []).map((item) => ({
    page: item.page,
    itemId: item.itemId,
    title: item.title,
    ...(item.payload !== undefined ? { payload: item.payload } : {}),
  }));

const serialize = (session) => ({
  _id: session._id,
  label: session.label,
  allowedPages: session.allowedPages,
  pageAccess: session.pageAccess || {},
  sharedItems: serializeSharedItems(session.sharedItems),
  token: session.token,
  expiresAt: session.expiresAt,
  active: session.active && session.expiresAt.getTime() > Date.now(),
  createdAt: session.createdAt,
});

exports.createSession = async (req, res) => {
  try {
    const { label, durationMinutes, allowedPages, pageAccess } = req.body;

    const minutes = Number(durationMinutes);
    if (!Number.isFinite(minutes) || minutes <= 0) {
      return res.status(400).json({ message: 'A valid duration in minutes is required' });
    }

    const pages = Array.isArray(allowedPages)
      ? allowedPages.filter((page) => GRANTABLE_PAGE_KEYS.includes(page))
      : [];

    // Per-module read/write permissions: { pageKey: 'view' | 'edit' }.
    const access = {};
    if (pageAccess && typeof pageAccess === 'object' && !Array.isArray(pageAccess)) {
      for (const [page, mode] of Object.entries(pageAccess)) {
        if (!GRANTABLE_PAGE_KEYS.includes(page)) continue;
        if (mode !== 'view' && mode !== 'edit') continue;
        access[page] = mode;
      }
    }

    // Specific items to share ({ page, itemId, title?, payload? }).
    const rawItems = Array.isArray(req.body.sharedItems) ? req.body.sharedItems : [];
    const seen = new Set();
    const items = [];
    for (const raw of rawItems) {
      if (!raw || !GRANTABLE_PAGE_KEYS.includes(raw.page)) continue;
      const itemId = typeof raw.itemId === 'string' ? raw.itemId.trim().slice(0, 64) : '';
      if (!itemId) continue;
      const key = `${raw.page}:${itemId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({
        page: raw.page,
        itemId,
        title: typeof raw.title === 'string' ? raw.title.slice(0, 140) : '',
        payload: raw.payload !== undefined ? raw.payload : undefined,
      });
    }
    // Sharing items implies the module itself is enabled.
    for (const page of items.map((i) => i.page)) {
      if (!pages.includes(page)) pages.push(page);
    }

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
      pageAccess: access,
      token,
      expiresAt,
    });

    if (items.length) {
      // DB-backed pages are copied into the guest partition; the rest
      // (workflows) ride along as a payload injected on the guest's device.
      const cloned = await cloneSharedItems({
        ownerId: req.user._id,
        sessionId,
        items,
      });
      const cloneable = new Set(Object.keys(PAGE_SOURCES));
      const passthrough = items
        .filter((i) => !cloneable.has(i.page))
        .map((i) => ({ page: i.page, itemId: i.itemId, title: i.title, payload: i.payload }));
      const sharedItems = [...cloned, ...passthrough];
      if (sharedItems.length) {
        session.sharedItems = sharedItems;
        await session.save();
      }
    }

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
    // Revoked → the guest's temporary partition is wiped immediately.
    await purgeGuestData(session._id);
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
      pageAccess: session.pageAccess || {},
      sharedItems: (session.sharedItems || []).map((s) => ({
        page: s.page,
        itemId: s.itemId,
        title: s.title,
        ...(s.payload !== undefined ? { payload: s.payload } : {}),
      })),
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
    // Guest-ended session → wipe its temporary partition too.
    await purgeGuestData(session._id);
    res.json({ message: 'Session ended' });
  } catch (error) {
    res.status(401).json({ message: 'Invalid access link' });
  }
};
