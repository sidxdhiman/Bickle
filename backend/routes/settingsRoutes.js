const crypto = require('crypto');
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { deleteWhere, tx, find, findOne, insert, updateById } = require('../db/helpers');

// Backup tables in dependency order: parents first so reference remaps
// (tasks.list, calendar task links) resolve to the freshly generated ids.
// Chat and Art are deliberately absent: conversations belong to specific
// people and media files live on disk, so neither survives a file transfer.
const BACKUP_TABLES = [
  { key: 'taskLists', table: 'task_lists', scope: 'user' },
  { key: 'categories', table: 'categories', scope: 'user', unique: ['name'] },
  { key: 'userCategories', table: 'user_categories', scope: 'userId', unique: ['name', 'type'] },
  { key: 'tasks', table: 'tasks', scope: 'user', refs: [{ col: 'list', map: 'taskLists', required: true }] },
  { key: 'calendarEvents', table: 'calendar_events', scope: 'user', refs: [{ col: 'task', map: 'tasks' }] },
  { key: 'habits', table: 'habits', scope: 'userId' },
  { key: 'notes', table: 'notes', scope: 'user' },
  { key: 'sleeps', table: 'sleeps', scope: 'user' },
  { key: 'transactions', table: 'transactions', scope: 'userId' },
  { key: 'whiteboards', table: 'whiteboards', scope: 'user' },
];

const FINGERPRINTS_KEY = 'importFingerprints';

const stripPartition = (row) => {
  const copy = { ...row };
  delete copy.user;
  delete copy.userId; // habits/transactions/user_categories scope on userId
  delete copy.guestSession;
  return copy;
};

const readPreferences = (userId) => {
  const usersRow = findOne('users', { _id: userId });
  return usersRow && usersRow.preferences && typeof usersRow.preferences === 'object'
    ? usersRow.preferences
    : {};
};

const writePreferences = (userId, patch) => {
  updateById('users', userId, { preferences: patch });
};

// Full JSON dump of the caller's owner-partition data. The login screen's
// "import on account creation" flow consumes exactly this shape.
const exportData = async (req, res) => {
  try {
    if (req.guest) {
      return res.status(403).json({ message: 'Guests cannot export data' });
    }
    const userId = req.dataScope.user;

    const data = {};
    for (const { key, table, scope } of BACKUP_TABLES) {
      const rows = find(table, { [scope]: userId, guestSession: null }, { orderBy: '"createdAt" ASC' });
      data[key] = rows.map(stripPartition);
    }

    const preferences = { ...readPreferences(userId) };
    delete preferences[FINGERPRINTS_KEY]; // import bookkeeping never leaves the machine

    res.json({
      app: 'bickle',
      kind: 'bickle-export',
      version: 1,
      exportedAt: new Date().toISOString(),
      data: { ...data, preferences },
    });
  } catch (error) {
    console.error('Error exporting data:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Restore a bickle-export backup into the caller's partition. Every row is
// re-id'd (uuids stay unique across accounts that share the same file) and
// cross-table references are remapped; the whole restore is one transaction
// so a malformed file can never half-import.
const importData = async (req, res) => {
  try {
    if (req.guest) {
      return res.status(403).json({ message: 'Guests cannot import data' });
    }
    const userId = req.dataScope.user;
    const body = req.body;

    if (!body || body.kind !== 'bickle-export' || !body.data || typeof body.data !== 'object' || Array.isArray(body.data)) {
      return res.status(400).json({ message: "This file doesn't look like a Bickle export" });
    }
    if (body.version && Number(body.version) > 1) {
      return res.status(400).json({ message: 'This export was made by a newer version of Bickle' });
    }

    // Fingerprint guard: re-importing the same file (double-click, retry
    // after a network blip) must not duplicate rows.
    const fingerprint = crypto.createHash('sha256').update(JSON.stringify(body.data)).digest('hex');
    const preferences = readPreferences(userId);
    const fingerprints = Array.isArray(preferences[FINGERPRINTS_KEY]) ? preferences[FINGERPRINTS_KEY] : [];
    if (fingerprints.includes(fingerprint)) {
      return res.status(400).json({ message: 'This backup has already been imported' });
    }

    const imported = {};
    const idMaps = {};
    let total = 0;

    tx(() => {
      for (const spec of BACKUP_TABLES) {
        idMaps[spec.key] = {};
        imported[spec.key] = 0;
        const rows = body.data[spec.key];
        if (!Array.isArray(rows)) continue;

        // Unique-name columns (note categories, money categories) collide
        // with defaults a fresh account already has - skip instead of abort.
        const seen = new Set();
        if (spec.unique) {
          for (const existing of find(spec.table, { [spec.scope]: userId, guestSession: null })) {
            seen.add(spec.unique.map((col) => existing[col]).join(' | '));
          }
        }

        for (const row of rows) {
          if (!row || typeof row !== 'object' || Array.isArray(row)) continue;

          if (spec.unique) {
            const key = spec.unique.map((col) => row[col]).join(' | ');
            if (seen.has(key)) continue;
            seen.add(key);
          }

          const doc = stripPartition(row);
          delete doc._id;

          let skip = false;
          for (const ref of spec.refs || []) {
            const oldRef = doc[ref.col];
            if (oldRef === null || oldRef === undefined || oldRef === '') {
              if (ref.required) skip = true;
              else doc[ref.col] = null;
              continue;
            }
            const newRef = idMaps[ref.map][oldRef];
            if (!newRef) {
              if (ref.required) skip = true;
              else doc[ref.col] = null;
              continue;
            }
            doc[ref.col] = newRef;
          }
          if (skip) continue;

          doc[spec.scope] = userId;
          doc.guestSession = null;
          const created = insert(spec.table, doc);
          if (row._id) idMaps[spec.key][row._id] = created._id;
          imported[spec.key] += 1;
          total += 1;
        }
      }

      // Theme/font/notifications ride along; the previous fingerprints stay
      // (the exporter's own list must not leak into the importer's guard).
      const incoming = body.data.preferences;
      const merged = {
        ...preferences,
        ...(incoming && typeof incoming === 'object' && !Array.isArray(incoming) ? incoming : {}),
        [FINGERPRINTS_KEY]: [...fingerprints, fingerprint].slice(-10),
      };
      writePreferences(userId, merged);
    });

    res.status(200).json({ message: 'Import complete', imported, total });
  } catch (error) {
    console.error('Error importing data:', error);
    res.status(400).json({ message: `Could not import this backup: ${error.message}` });
  }
};

// Delete all user data (owner only - never reachable by a guest session)
const deleteAllData = async (req, res) => {
  try {
    if (req.guest) {
      return res.status(403).json({ message: 'Guests cannot delete data' });
    }
    const userId = req.dataScope.user;

    // One transaction: a partial wipe would leave the app in a half-reset
    // state (the Mongo original was five non-atomic deleteManys).
    tx(() => {
      deleteWhere('tasks', { user: userId });
      deleteWhere('task_lists', { user: userId });
      deleteWhere('notes', { user: userId });
      deleteWhere('calendar_events', { user: userId });
      deleteWhere('sleeps', { user: userId });
    });

    res.status(200).json({ message: 'All data deleted successfully' });
  } catch (error) {
    console.error('Error deleting all data:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

router.get('/export', protect, exportData);
router.post('/import', protect, importData);
router.delete('/delete-all-data', protect, deleteAllData);

module.exports = router;
