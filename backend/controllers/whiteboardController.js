const Whiteboard = require('../models/Whiteboard');
const { scopeFilter, scopeFields } = require('../middleware/scope');

exports.createWhiteboard = async (req, res) => {
  try {
    const board = await Whiteboard.create({
      ...scopeFields(req),
      title: req.body.title || 'Untitled Board',
      elements: Array.isArray(req.body.elements) ? req.body.elements : [],
      background: req.body.background || 'grid',
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
    const boards = await Whiteboard.find(scopeFilter(req)).sort({ lastEdited: -1 });
    res.json(boards);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getWhiteboard = async (req, res) => {
  try {
    const board = await Whiteboard.findOne({ _id: req.params.id, ...scopeFilter(req) });
    if (!board) return res.status(404).json({ message: 'Whiteboard not found' });
    res.json(board);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateWhiteboard = async (req, res) => {
  try {
    const update = { lastEdited: Date.now() };
    if (req.body.title !== undefined) update.title = req.body.title;
    if (Array.isArray(req.body.elements)) update.elements = req.body.elements;
    if (req.body.background !== undefined) update.background = req.body.background;

    const board = await Whiteboard.findOneAndUpdate(
      { _id: req.params.id, ...scopeFilter(req) },
      update,
      { new: true }
    );
    if (!board) return res.status(404).json({ message: 'Whiteboard not found' });
    res.json(board);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteWhiteboard = async (req, res) => {
  try {
    const board = await Whiteboard.findOneAndDelete({ _id: req.params.id, ...scopeFilter(req) });
    if (!board) return res.status(404).json({ message: 'Whiteboard not found' });
    res.json({ message: 'Whiteboard deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
