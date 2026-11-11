const fs = require('fs/promises');
const path = require('path');
const { query, all, deleteWhere, tx, nowIso } = require('../db/helpers');
const { getUploadRoot } = require('../config/storage');

// The 14 partitioned tables — guest data lives in rows whose guestSession
// column matches the session id. Mirrors the old MODELS list exactly.
const PARTITIONED_TABLES = [
  'tasks', 'task_lists', 'notes', 'categories', 'habits', 'sleeps',
  'transactions', 'user_categories', 'calendar_events', 'whiteboards',
  'art_blogs', 'art_photos', 'art_videos', 'art_music',
];

const PUBLIC_PREFIX = '/uploads/art/';

const removeFile = async (publicPath) => {
  if (typeof publicPath !== 'string' || !publicPath.startsWith(PUBLIC_PREFIX)) return;
  const root = path.resolve(path.join(getUploadRoot(), 'art'));
  const relative = publicPath.slice(PUBLIC_PREFIX.length);
  const target = path.resolve(root, relative);
  if (!target.startsWith(root + path.sep)) return;
  try {
    await fs.unlink(target);
  } catch (error) {
    // The file may already be gone.
  }
};

// Best-effort cleanup of guest-uploaded art files before the docs disappear.
// Shared copies (sharedCopy: true) point at the OWNER's files — never delete
// those. (Mongo's {$ne: true} matches our sharedCopy = 0 exactly, since the
// column is NOT NULL with a default.)
const removeGuestArtFiles = async (sessionId) => {
  try {
    const photoUrls = query('art_photos',
      'SELECT "url" FROM "art_photos" WHERE "guestSession" = ? AND "sharedCopy" = 0', [sessionId]);
    const videoUrls = query('art_videos',
      'SELECT "url" FROM "art_videos" WHERE "guestSession" = ? AND "sharedCopy" = 0', [sessionId]);
    const musicUrls = query('art_music',
      'SELECT "url" FROM "art_music" WHERE "guestSession" = ? AND "sharedCopy" = 0', [sessionId]);
    const blogRows = query('art_blogs',
      'SELECT "images" FROM "art_blogs" WHERE "guestSession" = ? AND "sharedCopy" = 0', [sessionId]);

    const urls = [
      ...photoUrls.map((row) => row.url),
      ...videoUrls.map((row) => row.url),
      ...musicUrls.map((row) => row.url),
      ...blogRows.flatMap((row) => row.images || []),
    ];
    await Promise.all(urls.map(removeFile));
  } catch (error) {
    // Best effort — docs still get purged below.
  }
};

// Delete every row belonging to one guest session: its temporary partition.
const purgeGuestData = async (sessionId) => {
  if (!sessionId) return;
  await removeGuestArtFiles(sessionId);
  tx(() => {
    for (const table of PARTITIONED_TABLES) {
      deleteWhere(table, { guestSession: sessionId });
    }
  });
};

// Purge data for every session that is no longer live (expired or revoked).
const purgeStaleSessions = async () => {
  const stale = all(
    'SELECT "_id" FROM "guest_sessions" WHERE "active" = 0 OR "expiresAt" <= ?',
    [nowIso()],
  );
  for (const session of stale) {
    await purgeGuestData(session._id);
  }
  return stale.length;
};

module.exports = { purgeGuestData, purgeStaleSessions };
