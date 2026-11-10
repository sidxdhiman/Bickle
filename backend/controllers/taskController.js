const { insert, find, updateWhere, findAndDelete, deleteWhere, tx } = require('../db/helpers');
const { scopeFilter, scopeFields, sanitizeBody } = require('../middleware/scope');

// Same defaults the TaskList pre('save') hook used to inject.
const DEFAULT_STATUSES = [
  { id: 'todo', label: 'To Do', color: '#64748b' },
  { id: 'in-progress', label: 'In Progress', color: '#3b82f6' },
  { id: 'completed', label: 'Completed', color: '#10b981' },
];

// --- TaskList Controllers ---

exports.createList = async (req, res) => {
  try {
    const body = sanitizeBody(req.body);
    if (!body.statuses || body.statuses.length === 0) body.statuses = DEFAULT_STATUSES;
    const list = insert('task_lists', { ...body, ...scopeFields(req) });
    res.status(201).json(list);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getLists = async (req, res) => {
  try {
    const lists = find('task_lists', scopeFilter(req), {
      orderBy: '"isFavorite" DESC, "name" ASC',
    });
    res.json(lists);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateList = async (req, res) => {
  try {
    const list = updateWhere(
      'task_lists',
      { _id: req.params.id, ...scopeFilter(req) },
      sanitizeBody(req.body)
    );
    if (!list) return res.status(404).json({ message: 'List not found' });
    res.json(list);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteList = async (req, res) => {
  try {
    const deleted = tx(() => {
      const list = findAndDelete('task_lists', { _id: req.params.id, ...scopeFilter(req) });
      if (!list) return null;
      deleteWhere('tasks', { list: req.params.id, ...scopeFilter(req) });
      return list;
    });
    if (!deleted) return res.status(404).json({ message: 'List not found' });
    res.json({ message: 'List and associated tasks deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update list statuses
exports.updateListStatuses = async (req, res) => {
  try {
    const { statuses } = req.body;
    const list = updateWhere(
      'task_lists',
      { _id: req.params.id, ...scopeFilter(req) },
      { statuses }
    );
    if (!list) return res.status(404).json({ message: 'List not found' });
    res.json(list);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// --- Task Controllers ---

exports.createTask = async (req, res) => {
  try {
    const body = sanitizeBody(req.body);
    // mongoose Date cast parity: the empty string from date inputs is null.
    if (body.dueDate === '') body.dueDate = null;
    const task = insert('tasks', { ...body, ...scopeFields(req) });
    res.status(201).json(task);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getTasks = async (req, res) => {
  try {
    const { listId } = req.query;
    const where = scopeFilter(req);
    if (listId) where.list = listId;

    const tasks = find('tasks', where, { orderBy: '"order" ASC, "createdAt" DESC' });
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateTask = async (req, res) => {
  try {
    const body = sanitizeBody(req.body);
    if (body.dueDate === '') body.dueDate = null;
    const task = updateWhere('tasks', { _id: req.params.id, ...scopeFilter(req) }, body);
    if (!task) return res.status(404).json({ message: 'Task not found' });
    res.json(task);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteTask = async (req, res) => {
  try {
    const task = findAndDelete('tasks', { _id: req.params.id, ...scopeFilter(req) });
    if (!task) return res.status(404).json({ message: 'Task not found' });
    res.json({ message: 'Task deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
