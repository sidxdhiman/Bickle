const { insert, find, findOne, updateWhere, findAndDelete, nowIso } = require('../db/helpers');
const { scopeFilter, scopeFields } = require('../middleware/scope');

exports.createWhiteboard = async (req, res) => {
  try {
    const board = insert('whiteboards', {
      ...scopeFields(req),
      title: req.body.title || 'Untitled Board',
      elements: Array.isArray(req.body.elements) ? req.body.elements : [],
      background: req.body.background || 'grid',
      lastEdited: nowIso(),
    });
    res.status(201).json(board);
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: error.message });
  }
};

exports.getWhiteboards = async (req, res) => {
  try {
    const boards = find('whiteboards', scopeFilter(req), { orderBy: '"lastEdited" DESC' });
    res.json(boards);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getWhiteboard = async (req, res) => {
  try {
    const board = findOne('whiteboards', { _id: req.params.id, ...scopeFilter(req) });
    if (!board) return res.status(404).json({ message: 'Whiteboard not found' });
    res.json(board);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateWhiteboard = async (req, res) => {
  try {
    const update = { lastEdited: nowIso() };
    if (req.body.title !== undefined) update.title = req.body.title;
    if (Array.isArray(req.body.elements)) update.elements = req.body.elements;
    if (req.body.background !== undefined) update.background = req.body.background;

    const board = updateWhere(
      'whiteboards',
      { _id: req.params.id, ...scopeFilter(req) },
      update
    );
    if (!board) return res.status(404).json({ message: 'Whiteboard not found' });
    res.json(board);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteWhiteboard = async (req, res) => {
  try {
    const board = findAndDelete('whiteboards', { _id: req.params.id, ...scopeFilter(req) });
    if (!board) return res.status(404).json({ message: 'Whiteboard not found' });
    res.json({ message: 'Whiteboard deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
