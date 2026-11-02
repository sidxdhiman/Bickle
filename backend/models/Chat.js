const mongoose = require('mongoose');

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
  text: {
    type: String,
    required: true,
    trim: true,
    maxlength: 4000,
  },
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
};
