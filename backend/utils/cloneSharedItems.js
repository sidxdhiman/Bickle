const mongoose = require('mongoose');
const Task = require('../models/Task');
const TaskList = require('../models/TaskList');
const Note = require('../models/Note');
const Habit = require('../models/Habit');
const Sleep = require('../models/Sleep');
const Transaction = require('../models/Transaction');
const CalendarEvent = require('../models/CalendarEvent');
const Whiteboard = require('../models/Whiteboard');
const ArtBlog = require('../models/ArtBlog');
const ArtPhoto = require('../models/ArtPhoto');
const ArtVideo = require('../models/ArtVideo');
const ArtMusic = require('../models/ArtMusic');

// Which models back each shareable page. Owner docs only live in the
// null-guestSession partition, so clones can never pick up foreign items.
const PAGE_SOURCES = {
  notes: [{ Model: Note, ownerKey: 'user' }],
  tasks: 'tasks',
  calendar: [{ Model: CalendarEvent, ownerKey: 'user' }],
  habits: [{ Model: Habit, ownerKey: 'userId' }],
  sleep: [{ Model: Sleep, ownerKey: 'user' }],
  money: [{ Model: Transaction, ownerKey: 'userId' }],
  whiteboard: [{ Model: Whiteboard, ownerKey: 'user' }],
  art: [
    { Model: ArtBlog, ownerKey: 'user' },
    { Model: ArtPhoto, ownerKey: 'user' },
    { Model: ArtVideo, ownerKey: 'user' },
    { Model: ArtMusic, ownerKey: 'user' },
  ],
};

const cleanDoc = (doc) => {
  const obj = doc.toObject();
  delete obj._id;
  delete obj.id;
  delete obj.__v;
  delete obj.guestSession;
  delete obj.createdAt;
  delete obj.updatedAt;
  delete obj.sharedCopy;
  // user/userId stays: the copies belong to the same owner, only the
  // guestSession partition field changes.
  return obj;
};

const fetchOwned = (Model, ownerKey, ownerId, ids) =>
  Model.find({ [ownerKey]: ownerId, guestSession: null, _id: { $in: ids } });

const titleOf = (doc, Model) =>
  String(doc.title || doc.name || doc.description
    || (doc.date ? new Date(doc.date).toLocaleDateString() : '')
    || Model.modelName).slice(0, 140);

// Copy the selected owner items into the guest session's temporary partition.
// Guests then see them through their normal scoped reads; the partition purge
// on session end cleans everything up automatically.
const cloneSharedItems = async ({ ownerId, sessionId, items }) => {
  const saved = [];
  const idsByPage = {};
  for (const item of items || []) {
    if (!item || !mongoose.isValidObjectId(item.itemId)) continue;
    (idsByPage[item.page] = idsByPage[item.page] || []).push(String(item.itemId));
  }

  for (const [page, ids] of Object.entries(idsByPage)) {
    const sources = PAGE_SOURCES[page];
    if (!sources) continue;

    if (sources === 'tasks') {
      const tasks = await fetchOwned(Task, 'user', ownerId, ids);
      const listIds = [...new Set(tasks.map((t) => String(t.list)))];
      const lists = listIds.length ? await fetchOwned(TaskList, 'user', ownerId, listIds) : [];
      const listIdMap = {};
      if (lists.length) {
        const listCopies = await TaskList.insertMany(lists.map((l) => ({
          ...cleanDoc(l),
          guestSession: sessionId,
          sharedCopy: true,
        })));
        lists.forEach((l, i) => { listIdMap[String(l._id)] = listCopies[i]._id; });
      }
      const shareable = tasks.filter((t) => listIdMap[String(t.list)]);
      if (shareable.length) {
        await Task.insertMany(shareable.map((t) => ({
          ...cleanDoc(t),
          list: listIdMap[String(t.list)],
          guestSession: sessionId,
          sharedCopy: true,
        })));
        shareable.forEach((t) => saved.push({ page, itemId: t._id, title: titleOf(t, Task) }));
      }
      continue;
    }

    for (const { Model, ownerKey } of sources) {
      const docs = await fetchOwned(Model, ownerKey, ownerId, ids);
      if (!docs.length) continue;
      await Model.insertMany(docs.map((d) => {
        const base = cleanDoc(d);
        if (Model === CalendarEvent) delete base.task; // never point at owner refs
        return { ...base, guestSession: sessionId, sharedCopy: true };
      }));
      docs.forEach((d) => saved.push({ page, itemId: d._id, title: titleOf(d, Model) }));
    }
  }

  return saved;
};

module.exports = { cloneSharedItems };
