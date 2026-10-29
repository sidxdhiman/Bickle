const Note = require('../models/Note');
const Category = require('../models/Category');
const { scopeFilter, scopeFields, sanitizeBody } = require('../middleware/scope');

exports.createNote = async (req, res) => {
  try {
    const body = sanitizeBody(req.body);
    const noteData = {
      ...body,
      ...scopeFields(req),
      title: body.title || 'Untitled Note',
      content: body.content ?? '',
      category: body.category || 'General',
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
    const filter = scopeFilter(req);

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
      { _id: req.params.id, ...scopeFilter(req) },
      { ...sanitizeBody(req.body), lastEdited: Date.now() },
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
    const note = await Note.findOneAndDelete({ _id: req.params.id, ...scopeFilter(req) });
    if (!note) return res.status(404).json({ message: 'Note not found' });
    res.json({ message: 'Note deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getCategories = async (req, res) => {
  try {
    const categories = await Category.find(scopeFilter(req)).sort({ name: 1 }).lean();
    if (categories.length === 0) {
      const noteCategories = await Note.distinct('category', scopeFilter(req));
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
    const existing = await Category.findOne({ ...scopeFilter(req), name: categoryName });
    if (existing) {
      return res.status(200).json(existing.name);
    }
    const category = await Category.create({ ...scopeFields(req), name: categoryName });
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
    if (oldName === newName) {
      return res.json(newName);
    }
    const category = await Category.findOneAndUpdate(
      { ...scopeFilter(req), name: oldName },
      { name: newName },
      { new: true }
    );
    if (!category) {
      // Category existed only as a note-derived name (no doc) — persist the new name.
      try {
        await Category.create({ ...scopeFields(req), name: newName });
      } catch (createError) {
        if (createError.code !== 11000) throw createError;
      }
    }
    await Note.updateMany({ ...scopeFilter(req), category: oldName }, { category: newName });
    res.json(newName);
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
    // Idempotent: sidebar categories can be derived from notes (no Category doc),
    // so a missing doc must not fail the delete.
    await Category.deleteOne({ ...scopeFilter(req), name: categoryName });
    await Note.updateMany({ ...scopeFilter(req), category: categoryName }, { category: 'General' });
    res.json({ message: 'Category deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
