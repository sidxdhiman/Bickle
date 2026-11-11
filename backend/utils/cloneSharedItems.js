const { find, insert, tx } = require('../db/helpers');

// Which tables back each shareable page. Owner docs only live in the
// null-guestSession partition, so clones can never pick up foreign items.
// `shared` marks tables that carry the sharedCopy flag (art media points at
// the owner's files; the flag keeps deletes from unlinking them).
const PAGE_SOURCES = {
  notes: [{ table: 'notes', ownerKey: 'user', label: 'Note' }],
  tasks: 'tasks',
  calendar: [{ table: 'calendar_events', ownerKey: 'user', label: 'CalendarEvent', strip: ['task'] }],
  habits: [{ table: 'habits', ownerKey: 'userId', label: 'Habit' }],
  sleep: [{ table: 'sleeps', ownerKey: 'user', label: 'Sleep' }],
  money: [{ table: 'transactions', ownerKey: 'userId', label: 'Transaction' }],
  whiteboard: [{ table: 'whiteboards', ownerKey: 'user', label: 'Whiteboard' }],
  art: [
    { table: 'art_blogs', ownerKey: 'user', label: 'ArtBlog', shared: true },
    { table: 'art_photos', ownerKey: 'user', label: 'ArtPhoto', shared: true },
    { table: 'art_videos', ownerKey: 'user', label: 'ArtVideo', shared: true },
    { table: 'art_music', ownerKey: 'user', label: 'ArtMusic', shared: true },
  ],
};

// Row → insert payload: identity/partition stamps are re-derived, everything
// else (user/userId, list, content, …) carries over. user/userId stays: the
// copies belong to the same owner, only the guestSession partition changes.
const cloneBody = (doc) => {
  const { _id, createdAt, updatedAt, guestSession, sharedCopy, ...rest } = doc;
  return rest;
};

const titleOf = (doc, label) =>
  String(doc.title || doc.name || doc.description
    || (doc.date ? new Date(doc.date).toLocaleDateString() : '')
    || label).slice(0, 140);

const fetchOwned = (table, ownerKey, ownerId, ids) =>
  find(table, { [ownerKey]: ownerId, guestSession: null, _id: ids });

// Copy the selected owner items into the guest session's temporary partition.
// Guests then see them through their normal scoped reads; the partition purge
// on session end cleans everything up automatically.
const cloneSharedItems = async ({ ownerId, sessionId, items }) => {
  const saved = [];
  const idsByPage = {};
  for (const item of items || []) {
    if (!item || typeof item.itemId !== 'string' || !item.itemId) continue;
    (idsByPage[item.page] = idsByPage[item.page] || []).push(item.itemId);
  }

  for (const [page, ids] of Object.entries(idsByPage)) {
    const sources = PAGE_SOURCES[page];
    if (!sources) continue;

    if (sources === 'tasks') {
      const tasks = fetchOwned('tasks', 'user', ownerId, ids);
      const listIds = [...new Set(tasks.map((t) => String(t.list)))];
      const lists = listIds.length ? fetchOwned('task_lists', 'user', ownerId, listIds) : [];
      const listIdMap = {};
      if (lists.length) {
        tx(() => {
          for (const list of lists) {
            const copy = insert('task_lists', {
              ...cloneBody(list),
              guestSession: sessionId,
            });
            listIdMap[String(list._id)] = copy._id;
          }
        });
      }
      const shareable = tasks.filter((t) => listIdMap[String(t.list)]);
      if (shareable.length) {
        tx(() => {
          for (const task of shareable) {
            insert('tasks', {
              ...cloneBody(task),
              list: listIdMap[String(task.list)],
              guestSession: sessionId,
            });
          }
        });
        shareable.forEach((t) => saved.push({ page, itemId: t._id, title: titleOf(t, 'Task') }));
      }
      continue;
    }

    for (const { table, ownerKey, label, strip, shared } of sources) {
      const docs = fetchOwned(table, ownerKey, ownerId, ids);
      if (!docs.length) continue;
      tx(() => {
        for (const doc of docs) {
          const body = cloneBody(doc);
          if (strip) strip.forEach((key) => delete body[key]);
          insert(table, {
            ...body,
            guestSession: sessionId,
            ...(shared ? { sharedCopy: true } : {}),
          });
        }
      });
      docs.forEach((d) => saved.push({ page, itemId: d._id, title: titleOf(d, label) }));
    }
  }

  return saved;
};

module.exports = { cloneSharedItems, PAGE_SOURCES };
