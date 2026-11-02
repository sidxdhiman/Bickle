const { Conversation, Message } = require('../models/Chat');
const User = require('../models/User');

const MAX_MESSAGE_LENGTH = 4000;

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

// Lazily creates the 1:1 conversation with every other profile and returns
// the list with peer info, last message and unread counts.
exports.listConversations = async (req, res) => {
  try {
    if (denyGuest(req, res)) return;
    const me = req.dataScope.user;

    const peers = await User.find({ _id: { $ne: me } }).select('username avatar');
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

// Lightweight unread total for nav badges — never creates conversations.
exports.unreadCount = async (req, res) => {
  try {
    if (denyGuest(req, res)) return;
    const me = req.dataScope.user;

    const conversations = await Conversation.find({ participants: me }).select('_id');
    if (conversations.length === 0) return res.json({ count: 0 });

    const count = await Message.countDocuments({
      conversation: { $in: conversations.map((c) => c._id) },
      sender: { $ne: me },
      readBy: { $ne: me },
    });
    res.json({ count });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getMessages = async (req, res) => {
  try {
    if (denyGuest(req, res)) return;
    const conversation = await findOwnedConversation(req);
    if (!conversation) return res.status(404).json({ message: 'Conversation not found' });

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
    if (!text) return res.status(400).json({ message: 'Message text is required' });
    if (text.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({ message: `Messages are limited to ${MAX_MESSAGE_LENGTH} characters` });
    }

    const me = req.dataScope.user;
    const message = await Message.create({
      conversation: conversation._id,
      sender: me,
      text,
      readBy: [me],
    });

    conversation.lastMessage = { text, sender: me, at: message.createdAt };
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
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
