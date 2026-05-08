const TaskList = require('../models/TaskList');
const Task = require('../models/Task');

// --- TaskList Controllers ---

exports.createList = async (req, res) => {
  try {
    const list = await TaskList.create({ ...req.body, user: req.user._id });
    res.status(201).json(list);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getLists = async (req, res) => {
  try {
    const lists = await TaskList.find({ user: req.user._id }).sort({ isFavorite: -1, name: 1 });
    res.json(lists);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateList = async (req, res) => {
  try {
    const list = await TaskList.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      req.body,
      { new: true }
    );
    if (!list) return res.status(404).json({ message: 'List not found' });
    res.json(list);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteList = async (req, res) => {
  try {
    const list = await TaskList.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!list) return res.status(404).json({ message: 'List not found' });
    await Task.deleteMany({ list: req.params.id });
    res.json({ message: 'List and associated tasks deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// --- Task Controllers ---

exports.createTask = async (req, res) => {
  try {
    const task = await Task.create({ ...req.body, user: req.user._id });
    res.status(201).json(task);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getTasks = async (req, res) => {
  try {
    const { listId } = req.query;
    const filter = { user: req.user._id };
    if (listId) filter.list = listId;

    const tasks = await Task.find(filter).sort({ order: 1, createdAt: -1 });
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateTask = async (req, res) => {
  try {
    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      req.body,
      { new: true }
    );
    if (!task) return res.status(404).json({ message: 'Task not found' });
    res.json(task);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteTask = async (req, res) => {
  try {
    const task = await Task.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!task) return res.status(404).json({ message: 'Task not found' });
    res.json({ message: 'Task deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
