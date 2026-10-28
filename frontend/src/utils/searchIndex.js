// IndexedDB-backed global search index.
// Every searchable entity is stored as one flat doc so the command palette
// can hydrate instantly (even offline) and rank thousands of items in memory.
// The index is refreshed: on app boot, when the palette opens (TTL), and
// whenever a page mutates its data (syncSearchType / upsert / remove).

import axios from 'axios';

const DB_NAME = 'bickle-search';
const DB_VERSION = 1;
const STORE = 'items';

let dbPromise = null;

const openDB = () => {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('type', 'type', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('IndexedDB blocked'));
  }).catch(err => {
    dbPromise = null; // allow retry on next call
    throw err;
  });
  return dbPromise;
};

const runTx = (mode, fn) =>
  openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const store = t.objectStore(STORE);
        let out;
        try {
          out = fn(store);
        } catch (err) {
          reject(err);
          return;
        }
        t.oncomplete = () => resolve(out && typeof out.result !== 'undefined' ? out.result : out);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      })
  );

// ---------------------------------------------------------------------------
// Doc mappers: mongo entity → { id, type, title, subtitle, text, to }
// ---------------------------------------------------------------------------

const fmtDate = (d) => {
  try {
    return new Date(d).toLocaleDateString();
  } catch {
    return '';
  }
};

const MAPPERS = {
  habit: (h) => ({
    title: h.name,
    subtitle: h.streak > 0 ? `Habit · ${h.streak} day streak` : 'Habit',
    text: [h.name, h.description, h.frequency].filter(Boolean).join(' '),
    to: `/habits?habit=${h._id}`,
  }),
  task: (t) => ({
    title: t.title,
    subtitle: t.status === 'completed' ? 'Task · completed' : 'Task',
    text: [t.title, t.description, ...(t.tags || [])].filter(Boolean).join(' '),
    to: `/tasks?taskId=${t._id}`,
  }),
  list: (l) => ({
    title: l.name,
    subtitle: 'Task list',
    text: [l.name, l.description].filter(Boolean).join(' '),
    to: '/tasks',
  }),
  note: (n) => ({
    title: n.title || 'Untitled',
    subtitle: n.category ? `Note · ${n.category}` : 'Note',
    text: [n.title, n.content, n.category].filter(Boolean).join(' '),
    to: `/notes?noteId=${n._id}`,
  }),
  event: (e) => ({
    title: e.title,
    subtitle: `Event · ${fmtDate(e.start)}`,
    text: [e.title, e.description, e.location].filter(Boolean).join(' '),
    to: '/calendar',
  }),
  blog: (b) => ({
    title: b.title,
    subtitle: 'Art · blog',
    text: [b.title, b.content].filter(Boolean).join(' '),
    to: '/art',
  }),
  photo: (p) => ({
    title: p.title || p.name,
    subtitle: 'Art · photo',
    text: [p.title, p.description, p.location, p.camera, p.name].filter(Boolean).join(' '),
    to: '/art',
  }),
  video: (v) => ({
    title: v.title || v.name,
    subtitle: 'Art · video',
    text: [v.title, v.description, v.location, v.name].filter(Boolean).join(' '),
    to: '/art',
  }),
  music: (m) => ({
    title: m.title || m.name,
    subtitle: 'Art · music',
    text: [m.title, m.description, m.name].filter(Boolean).join(' '),
    to: '/art',
  }),
  board: (b) => ({
    title: b.title || 'Untitled Board',
    subtitle: 'Whiteboard',
    text: b.title || '',
    to: '/whiteboard',
  }),
  sleep: (s) => ({
    title: s.notes ? s.notes.slice(0, 60) : `Sleep · ${fmtDate(s.date || s.createdAt)}`,
    subtitle: s.quality ? `Sleep · ${s.quality}` : 'Sleep record',
    text: [s.notes, s.quality].filter(Boolean).join(' '),
    to: '/sleep',
  }),
  transaction: (t) => ({
    title: t.description || `${t.type || 'txn'} · ${t.amount}`,
    subtitle: `Money · ${t.category}`,
    text: [t.description, t.category, String(t.amount ?? ''), t.type].filter(Boolean).join(' '),
    to: '/money',
  }),
};

export const SEARCH_TYPES = Object.keys(MAPPERS);

export const toSearchDoc = (type, entity) => {
  const map = MAPPERS[type];
  if (!map || !entity || !entity._id) return null;
  const mapped = map(entity);
  if (!mapped.title) return null;
  return {
    id: `${type}:${entity._id}`,
    type,
    title: mapped.title,
    subtitle: mapped.subtitle || '',
    text: mapped.text || '',
    to: mapped.to,
  };
};

// ---------------------------------------------------------------------------
// CRUD on the index
// ---------------------------------------------------------------------------

export const putSearchItems = async (items) => {
  const docs = items.filter(Boolean);
  if (!docs.length) return;
  await runTx('readwrite', (store) => {
    docs.forEach((d) => store.put(d));
  });
};

export const removeSearchItems = async (ids) => {
  if (!ids.length) return;
  await runTx('readwrite', (store) => {
    ids.forEach((id) => store.delete(id));
  });
};

export const clearSearchType = async (type) => {
  await runTx('readwrite', (store) => {
    const idx = store.index('type');
    const req = idx.openCursor(IDBKeyRange.only(type));
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };
  });
};

export const getAllSearchItems = async () => {
  try {
    const db = await openDB();
    return await new Promise((resolve, reject) => {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
};

// Replace every doc of a type with the given entities.
// Pass { replace: false } for partial syncs (e.g. month-scoped transactions)
// so entries from other fetches are kept and just upserted.
export const syncSearchType = async (type, entities, { replace = true } = {}) => {
  const docs = (entities || []).map((e) => toSearchDoc(type, e)).filter(Boolean);
  if (replace) await clearSearchType(type);
  if (docs.length) await putSearchItems(docs);
};

export const upsertSearchDoc = async (type, entity) => {
  const doc = toSearchDoc(type, entity);
  if (doc) await putSearchItems([doc]);
};

export const removeSearchDoc = async (type, mongoId) => {
  await removeSearchItems([`${type}:${mongoId}`]);
};

// ---------------------------------------------------------------------------
// Full reindex: fetch every collection in parallel and rewrite the index.
// Per-type failures are skipped (never clears a type we couldn't fetch).
// TTL-guarded so boot + palette-open calls don't hammer the API.
// ---------------------------------------------------------------------------

let lastReindexAt = 0;
const REINDEX_TTL_MS = 45000;

const get = (url, config) => axios.get(url, config).then((r) => r.data).catch(() => null);

export const reindexAll = async ({ force = false } = {}) => {
  const now = Date.now();
  if (!force && now - lastReindexAt < REINDEX_TTL_MS) return false;
  lastReindexAt = now;

  const nowDate = new Date();
  const [habits, tasks, lists, notes, events, blogs, photos, videos, music, boards, sleeps, transactions] =
    await Promise.all([
      get('/habits'),
      get('/tasks'),
      get('/lists'),
      get('/notes'),
      get('/calendar'),
      get('/art/blogs'),
      get('/art/photos'),
      get('/art/videos'),
      get('/art/music'),
      get('/whiteboards'),
      get('/sleep'),
      get('/money/transactions', {
        params: { year: nowDate.getFullYear(), month: nowDate.getMonth() + 1 },
      }),
    ]);

  const jobs = [];
  if (habits) jobs.push(syncSearchType('habit', habits));
  if (tasks) jobs.push(syncSearchType('task', tasks));
  if (lists) jobs.push(syncSearchType('list', lists));
  if (notes) jobs.push(syncSearchType('note', notes));
  if (events) jobs.push(syncSearchType('event', events));
  if (blogs) jobs.push(syncSearchType('blog', blogs));
  if (photos) jobs.push(syncSearchType('photo', photos));
  if (videos) jobs.push(syncSearchType('video', videos));
  if (music) jobs.push(syncSearchType('music', music));
  if (boards) jobs.push(syncSearchType('board', boards));
  if (sleeps) jobs.push(syncSearchType('sleep', sleeps));
  // Month-scoped: upsert only so other months' transactions survive
  if (transactions) jobs.push(syncSearchType('transaction', transactions, { replace: false }));

  await Promise.all(jobs);
  return true;
};

// Wipe the index (called on logout so another account's data never shows).
export const clearSearchIndex = async () => {
  lastReindexAt = 0;
  await runTx('readwrite', (store) => store.clear());
};
