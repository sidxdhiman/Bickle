const {
  insert, find, findOne, query, run, updateById, updateWhere, findAndDelete,
  deleteWhere, buildWhere, tx, nowIso,
} = require('../db/helpers');
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
      lastEdited: body.lastEdited || nowIso(),
    };
    const note = insert('notes', noteData);
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
    const scope = buildWhere(scopeFilter(req));
    let statement = `SELECT * FROM "notes" ${scope.sql || 'WHERE 1=1'}`;
    const values = [...scope.params];

    if (category) {
      statement += ' AND "category" = ?';
      values.push(category);
    }
    if (search) {
      // Multi-term LIKE over title/content/tags — every term must match.
      for (const term of String(search).split(/\s+/).filter(Boolean)) {
        const like = `%${term.replace(/[\\%_]/g, '\\$&')}%`;
        statement += " AND (\"title\" LIKE ? ESCAPE '\\' OR \"content\" LIKE ? ESCAPE '\\' OR \"tags\" LIKE ? ESCAPE '\\')";
        values.push(like, like, like);
      }
    }
    statement += ' ORDER BY "isPinned" DESC, "lastEdited" DESC';

    const notes = query('notes', statement, values);
    res.json(notes);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateNote = async (req, res) => {
  try {
    const note = updateWhere(
      'notes',
      { _id: req.params.id, ...scopeFilter(req) },
      { ...sanitizeBody(req.body), lastEdited: nowIso() }
    );
    if (!note) return res.status(404).json({ message: 'Note not found' });
    res.json(note);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteNote = async (req, res) => {
  try {
    const note = findAndDelete('notes', { _id: req.params.id, ...scopeFilter(req) });
    if (!note) return res.status(404).json({ message: 'Note not found' });
    res.json({ message: 'Note deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getCategories = async (req, res) => {
  try {
    const categories = find('categories', scopeFilter(req), { orderBy: '"name" ASC' });
    if (categories.length === 0) {
      const scope = buildWhere(scopeFilter(req));
      const rows = query(
        'notes',
        `SELECT DISTINCT "category" FROM "notes" ${scope.sql || 'WHERE 1=1'}`,
        scope.params
      );
      return res.json(rows.map((row) => row.category).filter(Boolean));
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
    const existing = findOne('categories', { ...scopeFilter(req), name: categoryName });
    if (existing) {
      return res.status(200).json(existing.name);
    }
    const category = insert('categories', { ...scopeFields(req), name: categoryName });
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

    tx(() => {
      const category = findOne('categories', { ...scopeFilter(req), name: oldName });
      if (category) {
        updateById('categories', category._id, { name: newName });
      } else {
        // Category existed only as a note-derived name (no doc) — persist the new name.
        try {
          insert('categories', { ...scopeFields(req), name: newName });
        } catch (createError) {
          if (createError.code !== 11000) throw createError;
        }
      }
      const scope = buildWhere({ ...scopeFilter(req), category: oldName });
      run(
        `UPDATE "notes" SET "category" = ?, "updatedAt" = ? ${scope.sql || 'WHERE 1=1'}`,
        [newName, nowIso(), ...scope.params]
      );
    });

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
    tx(() => {
      deleteWhere('categories', { ...scopeFilter(req), name: categoryName });
      const scope = buildWhere({ ...scopeFilter(req), category: categoryName });
      run(
        `UPDATE "notes" SET "category" = 'General', "updatedAt" = ? ${scope.sql || 'WHERE 1=1'}`,
        [nowIso(), ...scope.params]
      );
    });
    res.json({ message: 'Category deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
