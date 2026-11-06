const { Conversation, Message, DISAPPEAR_MODES } = require('../models/Chat');
const User = require('../models/User');
const { PROFILES } = require('../config/profiles');
const { findProfileUser } = require('../utils/seedProfiles');
const { kindOf } = require('../middleware/chatUpload');

const MAX_MESSAGE_LENGTH = 4000;

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

const isParticipant = (conversation, userId) =>
  conversation.participants.some((id) => String(id) === String(userId));

const findOwnedConversation = async (req) => {
  const conversation = await Conversation.findById(req.params.id);
  if (!conversation || !isParticipant(conversation, req.dataScope.user)) return null;
  return conversation;
};

const messagePreview = (message) =>
  message.text || (message.attachment && message.attachment.name) || 'Attachment';

// Keeps the conversation preview pointing at the newest surviving message.
const syncLastMessage = async (conversation) => {
  const last = await Message.findOne({ conversation: conversation._id })
    .sort({ createdAt: -1 })
    .select('text sender createdAt attachment');
  conversation.lastMessage = last
    ? { text: messagePreview(last), sender: last.sender, at: last.createdAt }
    : { text: '', sender: null, at: null };
  await conversation.save();
};

// Removes messages whose timed policy has run out, then refreshes the
// preview. 'viewed' messages are NOT purged here — they are deleted by
// leaveConversation the moment the reader walks away (and by updateSettings
// the moment the rule lands on messages everyone already read). Lazy — runs
// on every read path, which is plenty for a two-profile chat.
const purgeExpired = async (conversation) => {
  const expired = await Message.find({
    conversation: conversation._id,
    expiresAt: { $lte: new Date(Date.now()) },
  }).select('_id');

  if (expired.length === 0) return expired.length;

  await Message.deleteMany({ _id: { $in: expired.map((m) => m._id) } });
  await syncLastMessage(conversation);
  return expired.length;
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
      const user = await findProfileUser(profile);
      if (user && String(user._id) !== String(me)) profileIds.push(user._id);
    }
    const peers = profileIds.length
      ? await User.find({ _id: { $in: profileIds } }).select('username avatar')
      : [];
    const conversations = await Conversation.find({ participants: me });

    const byPeerPair = (conversation) =>
      conversation.participants.map(String).filter((id) => id !== String(me))[0];

    const existingByPeer = new Map(
      conversations
        .filter((c) => c.participants.length === 2)
        .map((c) => [byPeerPair(c), c])
    );

    const rows = [];
    for (const peer of peers) {
      let conversation = existingByPeer.get(String(peer._id)) || null;
      if (!conversation) {
        conversation = await Conversation.create({ participants: [me, peer._id] });
      }

      await purgeExpired(conversation);

      const unreadCount = await Message.countDocuments({
        conversation: conversation._id,
        sender: { $ne: me },
        readBy: { $ne: me },
      });

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

    const conversations = await Conversation.find({ participants: me }).select('_id');
    if (conversations.length === 0) return res.json({ count: 0, latest: null });

    for (const conversation of conversations) {
      await purgeExpired(conversation);
    }

    const filter = {
      conversation: { $in: conversations.map((c) => c._id) },
      sender: { $ne: me },
      readBy: { $ne: me },
    };
    const count = await Message.countDocuments(filter);

    let latest = null;
    if (count > 0) {
      const message = await Message.find(filter)
        .sort({ createdAt: -1 })
        .limit(1)
        .populate('sender', 'username');
      if (message[0]) {
        latest = {
          sender: message[0].sender ? message[0].sender.username : 'Someone',
          preview: messagePreview(message[0]),
          type: message[0].type,
          conversation: String(message[0].conversation),
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

    await purgeExpired(conversation);

    const filter = { conversation: conversation._id };
    const after = req.query.after ? new Date(req.query.after) : null;
    // $gte + client-side de-dupe keeps polling safe when two messages land
    // in the same millisecond as the cursor.
    if (after && !Number.isNaN(after.getTime())) {
      filter.createdAt = { $gte: after };
    }

    const messages = await Message.find(filter).sort({ createdAt: 1 }).limit(500);
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
      readBy: [me],
      disappear: mode,
    };
    if (mode !== 'off' && mode !== 'viewed') {
      doc.expiresAt = new Date(Date.now() + DISAPPEAR_TTLS[mode]);
    }
    if (attachment) doc.attachment = attachment;

    const message = await Message.create(doc);

    conversation.lastMessage = {
      text: messagePreview(message),
      sender: me,
      at: message.createdAt,
    };
    await conversation.save();

    res.status(201).json(message);
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
    await Message.updateMany(
      { conversation: conversation._id, sender: { $ne: me }, readBy: { $ne: me } },
      { $addToSet: { readBy: me } }
    );

    // Once every participant has seen a 'viewed' message it is marked as
    // viewed: the sender's client animates it away, and the reader's next
    // leave call deletes it from the server.
    await Message.updateMany(
      {
        conversation: conversation._id,
        disappear: 'viewed',
        viewedAt: null,
        readBy: { $all: conversation.participants },
      },
      { viewedAt: new Date() }
    );

    await purgeExpired(conversation);
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
    const gone = await Message.deleteMany({
      conversation: conversation._id,
      disappear: 'viewed',
      viewedAt: { $ne: null },
      sender: { $ne: me },
    });
    // The preview must not keep quoting a message that just left.
    if (gone.deletedCount > 0) await syncLastMessage(conversation);
    await purgeExpired(conversation);
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

    const gone = await Message.deleteMany({ conversation: conversation._id });
    conversation.lastMessage = { text: '', sender: null, at: null };
    await conversation.save();

    res.json({ ok: true, deleted: gone.deletedCount });
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

    conversation.disappearMode = mode;
    await conversation.save();

    if (mode === 'viewed') {
      // Everyone has already seen these — under 'after viewing' they are
      // gone the moment the rule lands, not the next time somebody leaves.
      // (The conversation preview is rewritten by the notice posted below.)
      await Message.deleteMany({
        conversation: conversation._id,
        readBy: { $all: conversation.participants },
      });
      // The survivors have not been seen by everyone yet: they follow the
      // viewed rule from now on and disappear the moment their reader does.
      await Message.updateMany(
        { conversation: conversation._id },
        { $set: { disappear: 'viewed', expiresAt: null, viewedAt: null } }
      );
    } else {
      // Timed rules and 'off' re-stamp the whole history too, so switching
      // away from 'viewed' also brings back anything that was waiting to be
      // deleted after viewing.
      const expiresAt =
        mode === 'off' ? null : new Date(Date.now() + DISAPPEAR_TTLS[mode]);
      await Message.updateMany(
        { conversation: conversation._id },
        { $set: { disappear: mode, expiresAt, viewedAt: null } }
      );
    }

    const me = req.dataScope.user;
    const user = await User.findById(me).select('username');
    const label = DISAPPEAR_LABELS[mode];
    const systemMessage = await Message.create({
      conversation: conversation._id,
      sender: me,
      type: 'system',
      text: `${user.username} changed the settings to ${label}`,
      readBy: [me],
      disappear: mode,
      ...(mode !== 'off' && mode !== 'viewed'
        ? { expiresAt: new Date(Date.now() + DISAPPEAR_TTLS[mode]) }
        : {}),
    });

    conversation.lastMessage = {
      text: systemMessage.text,
      sender: me,
      at: systemMessage.createdAt,
    };
    await conversation.save();

    res.json({ mode, message: systemMessage });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
