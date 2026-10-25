const mongoose = require('mongoose');

const artBlogSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
  },
  content: {
    type: String,
    default: '',
  },
  images: [String],
}, {
  timestamps: true,
});

artBlogSchema.index({ title: 'text', content: 'text' });

module.exports = mongoose.model('ArtBlog', artBlogSchema);
