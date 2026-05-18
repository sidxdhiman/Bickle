const Note = require('../models/Note');
const Category = require('../models/Category');

exports.createNote = async (req, res) => {
  try {
    const noteData = {
      ...req.body,
      user: req.user._id,
      title: req.body.title || 'Untitled Note',
      content: req.body.content ?? '',
      category: req.body.category || 'General',
    };
    const note = await Note.create(noteData);
    res.status(201).json(note);
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: error.message });
  }
};

exports.getNotes = async (req, res) => {
  try {
    const { category, search } = req.query;
    const filter = { user: req.user._id };

    if (category) filter.category = category;
    if (search) filter.$text = { $search: search };

    const notes = await Note.find(filter).sort({ isPinned: -1, lastEdited: -1 });
    res.json(notes);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateNote = async (req, res) => {
  try {
    const note = await Note.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { ...req.body, lastEdited: Date.now() },
      { new: true }
    );
    if (!note) return res.status(404).json({ message: 'Note not found' });
    res.json(note);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteNote = async (req, res) => {
  try {
    const note = await Note.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!note) return res.status(404).json({ message: 'Note not found' });
    res.json({ message: 'Note deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getCategories = async (req, res) => {
  try {
    const categories = await Category.find({ user: req.user._id }).sort({ name: 1 }).lean();
    if (categories.length === 0) {
      const noteCategories = await Note.distinct('category', { user: req.user._id });
      return res.json(noteCategories.filter(Boolean));
    }
    res.json(categories.map(cat => cat.name));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createCategory = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Category name is required' });
    }
    const categoryName = name.trim();
    const existing = await Category.findOne({ user: req.user._id, name: categoryName });
    if (existing) {
      return res.status(200).json(existing.name);
    }
    const category = await Category.create({ user: req.user._id, name: categoryName });
    res.status(201).json(category.name);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'Category already exists' });
    }
    res.status(500).json({ message: error.message });
  }
};

exports.updateCategory = async (req, res) => {
  try {
    const oldName = req.params.name;
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Category name is required' });
    }
    const newName = name.trim();
    const category = await Category.findOneAndUpdate(
      { user: req.user._id, name: oldName },
      { name: newName },
      { new: true }
    );
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    await Note.updateMany({ user: req.user._id, category: oldName }, { category: newName });
    res.json(category.name);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'Category already exists' });
    }
    res.status(500).json({ message: error.message });
  }
};

exports.deleteCategory = async (req, res) => {
  try {
    const categoryName = req.params.name;
    const category = await Category.findOneAndDelete({ user: req.user._id, name: categoryName });
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    await Note.updateMany({ user: req.user._id, category: categoryName }, { category: 'General' });
    res.json({ message: 'Category deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
