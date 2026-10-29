const fs = require('fs/promises');
const path = require('path');
const Task = require('../models/Task');
const TaskList = require('../models/TaskList');
const Note = require('../models/Note');
const Category = require('../models/Category');
const Habit = require('../models/Habit');
const Sleep = require('../models/Sleep');
const Transaction = require('../models/Transaction');
const UserCategory = require('../models/UserCategory');
const CalendarEvent = require('../models/CalendarEvent');
const Whiteboard = require('../models/Whiteboard');
const ArtBlog = require('../models/ArtBlog');
const ArtPhoto = require('../models/ArtPhoto');
const ArtVideo = require('../models/ArtVideo');
const ArtMusic = require('../models/ArtMusic');
const GuestSession = require('../models/GuestSession');

const MODELS = [
  Task, TaskList, Note, Category, Habit, Sleep, Transaction, UserCategory,
  CalendarEvent, Whiteboard, ArtBlog, ArtPhoto, ArtVideo, ArtMusic,
];

const UPLOAD_ROOT = path.join(__dirname, '..', 'uploads', 'art');
const PUBLIC_PREFIX = '/uploads/art/';

const removeFile = async (publicPath) => {
  if (typeof publicPath !== 'string' || !publicPath.startsWith(PUBLIC_PREFIX)) return;
  const relative = publicPath.slice(PUBLIC_PREFIX.length);
  const target = path.resolve(UPLOAD_ROOT, relative);
  if (!target.startsWith(path.resolve(UPLOAD_ROOT) + path.sep)) return;
  try {
    await fs.unlink(target);
  } catch (error) {
    // The file may already be gone.
  }
};

// Best-effort cleanup of guest-uploaded art files before the docs disappear.
const removeGuestArtFiles = async (sessionId) => {
  try {
    const [blogs, photos, videos, music] = await Promise.all([
      ArtBlog.find({ guestSession: sessionId }).lean(),
      ArtPhoto.find({ guestSession: sessionId }).lean(),
      ArtVideo.find({ guestSession: sessionId }).lean(),
      ArtMusic.find({ guestSession: sessionId }).lean(),
    ]);
    const urls = [
      ...photos.map((d) => d.url),
      ...videos.map((d) => d.url),
      ...music.map((d) => d.url),
      ...blogs.flatMap((d) => [d.url, ...(d.images || [])]),
    ];
    await Promise.all(urls.map(removeFile));
  } catch (error) {
    // Best effort — docs still get purged below.
  }
};

// Delete every document belonging to one guest session: its temporary partition.
const purgeGuestData = async (sessionId) => {
  if (!sessionId) return;
  await removeGuestArtFiles(sessionId);
  await Promise.all(MODELS.map((Model) => Model.deleteMany({ guestSession: sessionId })));
};

// Purge data for every session that is no longer live (expired or revoked).
const purgeStaleSessions = async () => {
  const stale = await GuestSession.find({
    $or: [{ active: false }, { expiresAt: { $lte: new Date() } }],
  }).select('_id');
  await Promise.all(stale.map((s) => purgeGuestData(s._id)));
  return stale.length;
};

module.exports = { purgeGuestData, purgeStaleSessions };
