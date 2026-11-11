const {
  all, get, query, queryOne, insert, findById, updateById, run, tx, nowIso,
} = require('../db/helpers');
const { PROFILES } = require('../config/profiles');
const { findProfileUser } = require('../utils/seedProfiles');
const { kindOf } = require('../middleware/chatUpload');

const MAX_MESSAGE_LENGTH = 4000;

const DISAPPEAR_MODES = ['off', '1h', '24h', '7d', 'viewed'];
const DISAPPEAR_TTLS = { '1h': 60 * 60 * 1000, '24h': 24 * 60 * 60 * 1000, '7d': 7 * 24 * 60 * 60 * 1000 };
const DISAPPEAR_LABELS = {
  off: 'Off',
  '1h': '1 hour',
  '24h': '24 hours',
  '7d': '1 week',
  viewed: 'after viewing',
};

// Chat is reserved for the real profiles. (Guest tokens are rejected earlier
// by the page map; this is defense in depth.)
const denyGuest = (req, res) => {
  if (req.guest) {
    res.status(403).json({ message: 'Chat is not available for shared sessions' });
    return true;
  }
  return false;
};

const getParticipants = (conversationId) =>
  all('SELECT "userId" FROM "conversation_participants" WHERE "conversationId" = ?', [conversationId])
    .map((row) => row.userId);

const isParticipant = (conversationId, userId) =>
  !!get(
    'SELECT 1 AS ok FROM "conversation_participants" WHERE "conversationId" = ? AND "userId" = ?',
    [conversationId, userId]
  );

const findOwnedConversation = async (req) => {
  const conversation = findById('conversations', req.params.id);
  if (!conversation || !isParticipant(conversation._id, req.dataScope.user)) return null;
  return conversation;
};

const messagePreview = (message) =>
  message.text || (message.attachment && message.attachment.name) || 'Attachment';

// readBy lives in the junction table now, but the chat UI reads it off each
// message (unread ticks in the thread) — so responses hydrate it back on.
const hydrateReadBy = (messages) => {
  if (messages.length === 0) return messages;
  const ids = messages.map((m) => m._id);
  const rows = all(
    `SELECT "messageId", "userId" FROM "message_read_by" WHERE "messageId" IN (${ids
      .map(() => '?')
      .join(', ')})`,
    ids
  );
  const byMessage = new Map();
  for (const row of rows) {
    if (!byMessage.has(row.messageId)) byMessage.set(row.messageId, []);
    byMessage.get(row.messageId).push(row.userId);
  }
  return messages.map((m) => ({ ...m, readBy: byMessage.get(m._id) || [] }));
};

// Keeps the conversation preview pointing at the newest surviving message.
const syncLastMessage = (conversation) => {
  const last = queryOne(
    'messages',
    'SELECT * FROM "messages" WHERE "conversation" = ? ORDER BY "createdAt" DESC LIMIT 1',
    [conversation._id]
  );
  updateById('conversations', conversation._id, {
    lastMessage: last
      ? { text: messagePreview(last), sender: last.sender, at: last.createdAt }
      : { text: '', sender: null, at: null },
  });
};

// Removes messages whose timed policy has run out, then refreshes the
// preview. 'viewed' messages are NOT purged here — they are deleted by
// leaveConversation the moment the reader walks away (and by updateSettings
// the moment the rule lands on messages everyone already read). Lazy — runs
// on every read path, which is plenty for a two-profile chat.
const purgeExpired = (conversation) => {
  const where = '"conversation" = ? AND "expiresAt" IS NOT NULL AND "expiresAt" <= ?';
  const params = [conversation._id, nowIso()];
  const deleted = tx(() => {
    // Junction rows go first: the second DELETE's subquery still needs the
    // messages to exist while the read-by rows are removed.
    run(`DELETE FROM "message_read_by" WHERE "messageId" IN (SELECT "_id" FROM "messages" WHERE ${where})`, params);
    return run(`DELETE FROM "messages" WHERE ${where}`, params).changes;
  });
  if (deleted > 0) syncLastMessage(conversation);
  return deleted;
};

// Unread filter shared by the list badge and the nav counter: messages in
// these conversations that somebody else sent and I have not read yet.
const unreadClause = (conversationIds, me) => {
  const placeholders = conversationIds.map(() => '?').join(', ');
  return {
    sql:
      `m."conversation" IN (${placeholders}) AND m."sender" != ? ` +
      'AND NOT EXISTS (SELECT 1 FROM "message_read_by" rb ' +
      'WHERE rb."messageId" = m."_id" AND rb."userId" = ?)',
    params: [...conversationIds, me, me],
  };
};

// Lazily creates the 1:1 conversation with every other profile and returns
// the list with peer info, last message and unread counts.
exports.listConversations = async (req, res) => {
  try {
    if (denyGuest(req, res)) return;
    const me = req.dataScope.user;

    // Only the profile accounts are chat contacts — stray legacy/test users
    // in the users collection must never show up in the conversation list.
    const profileIds = [];
    for (const profile of PROFILES) {
      const user = findProfileUser(profile);
      if (user && String(user._id) !== String(me)) profileIds.push(user._id);
    }
    const peers = profileIds.length
      ? query(
          'users',
          `SELECT "_id", "username", "avatar" FROM "users" WHERE "_id" IN (${profileIds
            .map(() => '?')
            .join(', ')})`,
          profileIds
        )
      : [];
    const conversations = query(
      'conversations',
      'SELECT c.* FROM "conversations" c WHERE EXISTS ' +
        '(SELECT 1 FROM "conversation_participants" p ' +
        'WHERE p."conversationId" = c."_id" AND p."userId" = ?)',
      [me]
    );

    const participantsById = new Map(
      conversations.map((c) => [c._id, getParticipants(c._id)])
    );

    const rows = [];
    for (const peer of peers) {
      let conversation =
        conversations.find(
          (c) =>
            (participantsById.get(c._id) || []).length === 2 &&
            (participantsById.get(c._id) || []).some((id) => String(id) === String(peer._id)) &&
            (participantsById.get(c._id) || []).some((id) => String(id) === String(me))
        ) || null;
      if (!conversation) {
        conversation = tx(() => {
          const created = insert('conversations', {});
          run(
            'INSERT INTO "conversation_participants" ("conversationId", "userId") VALUES (?, ?), (?, ?)',
            [created._id, me, created._id, peer._id]
          );
          return created;
        });
      }

      purgeExpired(conversation);

      const unreadCount = get(
        'SELECT COUNT(*) AS n FROM "messages" m WHERE m."conversation" = ? ' +
          'AND m."sender" != ? ' +
          'AND NOT EXISTS (SELECT 1 FROM "message_read_by" rb ' +
          'WHERE rb."messageId" = m."_id" AND rb."userId" = ?)',
        [conversation._id, me, me]
      ).n;

      rows.push({
        _id: conversation._id,
        peer: {
          _id: peer._id,
          username: peer.username,
          avatar: peer.avatar || '',
        },
        disappearMode: conversation.disappearMode || 'off',
        lastMessage: conversation.lastMessage && conversation.lastMessage.text
          ? conversation.lastMessage
          : null,
        unreadCount,
        updatedAt: conversation.updatedAt,
      });
    }

    rows.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Lightweight unread total for nav badges and arrival toasts — never creates
// conversations. `latest` gives the popup its preview text.
exports.unreadCount = async (req, res) => {
  try {
    if (denyGuest(req, res)) return;
    const me = req.dataScope.user;

    const conversations = query(
      'conversations',
      'SELECT c."_id" FROM "conversations" c WHERE EXISTS ' +
        '(SELECT 1 FROM "conversation_participants" p ' +
        'WHERE p."conversationId" = c."_id" AND p."userId" = ?)',
      [me]
    );
    if (conversations.length === 0) return res.json({ count: 0, latest: null });

    for (const conversation of conversations) {
      purgeExpired(conversation);
    }

    const unread = unreadClause(conversations.map((c) => c._id), me);
    const count = get(`SELECT COUNT(*) AS n FROM "messages" m WHERE ${unread.sql}`, unread.params).n;

    let latest = null;
    if (count > 0) {
      const message = queryOne(
        'messages',
        'SELECT m.*, u."username" AS senderName FROM "messages" m ' +
          `LEFT JOIN "users" u ON u."_id" = m."sender" WHERE ${unread.sql} ` +
          'ORDER BY m."createdAt" DESC LIMIT 1',
        unread.params
      );
      if (message) {
        latest = {
          sender: message.senderName ? message.senderName : 'Someone',
          preview: messagePreview(message),
          type: message.type,
          conversation: String(message.conversation),
        };
      }
    }
    res.json({ count, latest });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getMessages = async (req, res) => {
  try {
    if (denyGuest(req, res)) return;
    const conversation = await findOwnedConversation(req);
    if (!conversation) return res.status(404).json({ message: 'Conversation not found' });

    purgeExpired(conversation);

    let sql = 'SELECT * FROM "messages" WHERE "conversation" = ?';
    const params = [conversation._id];
    const after = req.query.after ? new Date(req.query.after) : null;
    // $gte + client-side de-dupe keeps polling safe when two messages land
    // in the same millisecond as the cursor.
    if (after && !Number.isNaN(after.getTime())) {
      sql += ' AND "createdAt" >= ?';
      params.push(after.toISOString());
    }
    sql += ' ORDER BY "createdAt" ASC LIMIT 500';

    const messages = hydrateReadBy(query('messages', sql, params));
    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.sendMessage = async (req, res) => {
  try {
    if (denyGuest(req, res)) return;
    const conversation = await findOwnedConversation(req);
    if (!conversation) return res.status(404).json({ message: 'Conversation not found' });

    const text = typeof req.body.text === 'string' ? req.body.text.trim() : '';
    if (text.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({ message: `Messages are limited to ${MAX_MESSAGE_LENGTH} characters` });
    }

    let attachment = null;
    if (req.file) {
      attachment = {
        url: `/uploads/chat/${req.file.filename}`,
        name: (req.file.originalname || 'file').slice(0, 200),
        mime: req.file.mimetype || 'application/octet-stream',
        size: req.file.size,
        kind: kindOf(req.file.mimetype, req.file.originalname),
      };
    }
    if (!text && !attachment) {
      return res.status(400).json({ message: 'Message text or an attachment is required' });
    }

    const mode = DISAPPEAR_MODES.includes(conversation.disappearMode)
      ? conversation.disappearMode
      : 'off';

    const me = req.dataScope.user;
    const doc = {
      conversation: conversation._id,
      sender: me,
      type: 'text',
      text,
      disappear: mode,
    };
    if (mode !== 'off' && mode !== 'viewed') {
      doc.expiresAt = new Date(Date.now() + DISAPPEAR_TTLS[mode]);
    }
    if (attachment) doc.attachment = attachment;

    const message = tx(() => {
      const created = insert('messages', doc);
      run('INSERT INTO "message_read_by" ("messageId", "userId") VALUES (?, ?)', [created._id, me]);
      updateById('conversations', conversation._id, {
        lastMessage: {
          text: messagePreview(created),
          sender: me,
          at: created.createdAt,
        },
      });
      return created;
    });

    res.status(201).json({ ...message, readBy: [me] });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.markRead = async (req, res) => {
  try {
    if (denyGuest(req, res)) return;
    const conversation = await findOwnedConversation(req);
    if (!conversation) return res.status(404).json({ message: 'Conversation not found' });

    const me = req.dataScope.user;
    tx(() => {
      const targets = all(
        'SELECT m."_id" AS id FROM "messages" m WHERE m."conversation" = ? AND m."sender" != ? ' +
          'AND NOT EXISTS (SELECT 1 FROM "message_read_by" rb ' +
          'WHERE rb."messageId" = m."_id" AND rb."userId" = ?)',
        [conversation._id, me, me]
      );
      for (const target of targets) {
        run('INSERT OR IGNORE INTO "message_read_by" ("messageId", "userId") VALUES (?, ?)', [
          target.id,
          me,
        ]);
      }

      // Once every participant has seen a 'viewed' message it is marked as
      // viewed: the sender's client animates it away, and the reader's next
      // leave call deletes it from the server.
      const now = nowIso();
      run(
        'UPDATE "messages" SET "viewedAt" = ?, "updatedAt" = ? ' +
          'WHERE "conversation" = ? AND "disappear" = \'viewed\' AND "viewedAt" IS NULL ' +
          'AND NOT EXISTS (SELECT 1 FROM "conversation_participants" p ' +
          'WHERE p."conversationId" = ? AND NOT EXISTS (SELECT 1 FROM "message_read_by" rb ' +
          'WHERE rb."messageId" = "messages"."_id" AND rb."userId" = p."userId"))',
        [now, now, conversation._id, conversation._id]
      );
    });

    purgeExpired(conversation);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Called by the client when the reader closes or switches threads: every
// 'viewed' message they have already seen is deleted for good (their side of
// the conversation), and any timed expiries are flushed while we are here.
exports.leaveConversation = async (req, res) => {
  try {
    if (denyGuest(req, res)) return;
    const conversation = await findOwnedConversation(req);
    if (!conversation) return res.status(404).json({ message: 'Conversation not found' });

    const me = req.dataScope.user;
    const deleted = tx(() => {
      const where = '"conversation" = ? AND "disappear" = \'viewed\' AND "viewedAt" IS NOT NULL AND "sender" != ?';
      const params = [conversation._id, me];
      run(`DELETE FROM "message_read_by" WHERE "messageId" IN (SELECT "_id" FROM "messages" WHERE ${where})`, params);
      return run(`DELETE FROM "messages" WHERE ${where}`, params).changes;
    });
    // The preview must not keep quoting a message that just left.
    if (deleted > 0) syncLastMessage(conversation);
    purgeExpired(conversation);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Wipes every message in the conversation so both profiles can start over.
// Either participant may do it; the sidebar preview resets with the messages.
exports.clearMessages = async (req, res) => {
  try {
    if (denyGuest(req, res)) return;
    const conversation = await findOwnedConversation(req);
    if (!conversation) return res.status(404).json({ message: 'Conversation not found' });

    const deleted = tx(() => {
      run('DELETE FROM "message_read_by" WHERE "messageId" IN (SELECT "_id" FROM "messages" WHERE "conversation" = ?)', [
        conversation._id,
      ]);
      const gone = run('DELETE FROM "messages" WHERE "conversation" = ?', [conversation._id]).changes;
      updateById('conversations', conversation._id, {
        lastMessage: { text: '', sender: null, at: null },
      });
      return gone;
    });

    res.json({ ok: true, deleted });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Either profile may change the disappearing-message policy at any time; the
// change lands as a system message both sides can see. The new rule is not
// just for messages sent from now on — it reaches back through everything
// already in the conversation, so 'after viewing' governs every message that
// has ever been sent in the chat.
exports.updateSettings = async (req, res) => {
  try {
    if (denyGuest(req, res)) return;
    const conversation = await findOwnedConversation(req);
    if (!conversation) return res.status(404).json({ message: 'Conversation not found' });

    const mode = req.body && req.body.mode;
    if (!DISAPPEAR_MODES.includes(mode)) {
      return res.status(400).json({ message: `Mode must be one of: ${DISAPPEAR_MODES.join(', ')}` });
    }

    const me = req.dataScope.user;
    const systemMessage = tx(() => {
      updateById('conversations', conversation._id, { disappearMode: mode });

      if (mode === 'viewed') {
        // Everyone has already seen these — under 'after viewing' they are
        // gone the moment the rule lands, not the next time somebody leaves.
        // The doomed set is computed before any delete: removing read-by
        // rows first would change what "read by everyone" means.
        const doomed = all(
          'SELECT "_id" FROM "messages" WHERE "conversation" = ? ' +
            'AND NOT EXISTS (SELECT 1 FROM "conversation_participants" p ' +
            'WHERE p."conversationId" = ? AND NOT EXISTS (SELECT 1 FROM "message_read_by" rb ' +
            'WHERE rb."messageId" = "messages"."_id" AND rb."userId" = p."userId"))',
          [conversation._id, conversation._id]
        ).map((row) => row._id);
        if (doomed.length > 0) {
          const placeholders = doomed.map(() => '?').join(', ');
          run(`DELETE FROM "message_read_by" WHERE "messageId" IN (${placeholders})`, doomed);
          run(`DELETE FROM "messages" WHERE "_id" IN (${placeholders})`, doomed);
        }
        // The survivors have not been seen by everyone yet: they follow the
        // viewed rule from now on and disappear the moment their reader does.
        run(
          'UPDATE "messages" SET "disappear" = \'viewed\', "expiresAt" = NULL, ' +
            '"viewedAt" = NULL, "updatedAt" = ? WHERE "conversation" = ?',
          [nowIso(), conversation._id]
        );
      } else {
        // Timed rules and 'off' re-stamp the whole history too, so switching
        // away from 'viewed' also brings back anything that was waiting to be
        // deleted after viewing.
        const expiresAt =
          mode === 'off' ? null : new Date(Date.now() + DISAPPEAR_TTLS[mode]);
        run(
          'UPDATE "messages" SET "disappear" = ?, "expiresAt" = ?, "viewedAt" = NULL, ' +
            '"updatedAt" = ? WHERE "conversation" = ?',
          [mode, expiresAt, nowIso(), conversation._id]
        );
      }

      const user = get('SELECT "username" FROM "users" WHERE "_id" = ?', [me]);
      const label = DISAPPEAR_LABELS[mode];
      const created = insert('messages', {
        conversation: conversation._id,
        sender: me,
        type: 'system',
        text: `${user.username} changed the settings to ${label}`,
        disappear: mode,
        ...(mode !== 'off' && mode !== 'viewed'
          ? { expiresAt: new Date(Date.now() + DISAPPEAR_TTLS[mode]) }
          : {}),
      });
      run('INSERT INTO "message_read_by" ("messageId", "userId") VALUES (?, ?)', [created._id, me]);
      updateById('conversations', conversation._id, {
        lastMessage: {
          text: created.text,
          sender: me,
          at: created.createdAt,
        },
      });
      return created;
    });

    res.json({ mode, message: { ...systemMessage, readBy: [me] } });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
