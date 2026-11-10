// Per-table column metadata used by helpers.mapRow / helpers.docToRow.
//
//   bools — INTEGER 0/1 columns that must come back as real true/false
//   json  — TEXT columns holding JSON that must be parsed on read and
//           stringified on read; NULL means "key omitted" (mongoose parity
//           for paths like message.attachment that have no default)
//   noUpdatedAt — Habit's schema has no mongoose timestamps option, so its
//           API documents never carried updatedAt
//
// conversation_participants and message_read_by are junction tables: they
// are never serialized directly, so they need no metadata.

const TABLES = {
  users: { bools: ['showcase'], json: ['preferences'] },

  guest_sessions: {
    bools: ['active'],
    json: ['allowedPages', 'pageAccess', 'sharedItems'],
  },

  conversations: { bools: [], json: ['lastMessage'] },
  messages: { bools: [], json: ['attachment'] },

  task_lists: { bools: ['isFavorite'], json: ['statuses'] },
  tasks: { bools: ['isStarred'], json: ['tags'] },
  calendar_events: { bools: ['allDay'], json: ['recurrence'] },
  habits: { bools: [], json: ['completedDates'], noUpdatedAt: true },
  notes: { bools: ['isPinned'], json: ['tags'] },
  categories: { bools: [], json: [] },
  sleeps: { bools: [], json: [] },
  transactions: { bools: [], json: [] },
  user_categories: { bools: [], json: [] },
  whiteboards: { bools: [], json: ['elements'] },

  art_blogs: { bools: ['sharedCopy'], json: ['images'] },
  art_photos: { bools: ['sharedCopy'], json: [] },
  art_videos: { bools: ['sharedCopy'], json: [] },
  art_music: { bools: ['sharedCopy'], json: ['peaks'] },
};

module.exports = { TABLES };
