const mongoose = require('mongoose');

// Disappearing-message policies a profile can pick for a conversation.
// 'viewed' keeps a message on screen for the reader and deletes it the moment
// that reader leaves the chat; the timed modes stamp an absolute expiry when
// the message is sent.
const DISAPPEAR_MODES = ['off', '1h', '24h', '7d', 'viewed'];

// A direct conversation between two profiles. Chat belongs exclusively to the
// real accounts — guest sessions are blocked from /api/chat entirely, so
// conversations never carry a guestSession partition.
const conversationSchema = new mongoose.Schema({
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  }],
  lastMessage: {
    text: { type: String, default: '' },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    at: { type: Date },
  },
  // Which profiles currently share this conversation; either participant may
  // change it. New messages snapshot it as their own disappear policy, and a
  // change re-stamps everything already in the chat — the rule always
  // governs the whole history, not just the messages sent after it.
  disappearMode: {
    type: String,
    enum: DISAPPEAR_MODES,
    default: 'off',
  },
}, {
  timestamps: true,
});

conversationSchema.index({ participants: 1 });

const messageSchema = new mongoose.Schema({
  conversation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true,
    index: true,
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  // Empty for attachment-only messages; 'system' marks settings notices.
  type: {
    type: String,
    enum: ['text', 'system'],
    default: 'text',
  },
  text: {
    type: String,
    trim: true,
    maxlength: 4000,
    default: '',
  },
  attachment: {
    url: { type: String },
    name: { type: String },
    mime: { type: String },
    size: { type: Number },
    kind: { type: String, enum: ['image', 'video', 'audio', 'file'] },
  },
  // Policy snapshot taken when the message was created.
  disappear: {
    type: String,
    enum: DISAPPEAR_MODES,
    default: 'off',
  },
  // Absolute expiry for the timed modes.
  expiresAt: { type: Date },
  // Set once every participant has read a 'viewed' message; the message is
  // deleted from the server when that reader leaves the chat.
  viewedAt: { type: Date },
  // Profiles that have seen this message (sender counts as read on send).
  readBy: [{
    type: mongoose.Schema.Types.ObjectId,
  }],
}, {
  timestamps: true,
});

messageSchema.index({ conversation: 1, createdAt: 1 });

module.exports = {
  Conversation: mongoose.model('Conversation', conversationSchema),
  Message: mongoose.model('Message', messageSchema),
  DISAPPEAR_MODES,
};
