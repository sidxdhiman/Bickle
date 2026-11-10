const { insert, find, query, updateWhere, findAndDelete, buildWhere } = require('../db/helpers');
const { scopeFilter, scopeFields, sanitizeBody } = require('../middleware/scope');

exports.createEvent = async (req, res) => {
  try {
    const body = sanitizeBody(req.body);
    if (body.recurrence && body.recurrence.frequency === 'none') {
      delete body.recurrence;
    }
    const event = insert('calendar_events', { ...body, ...scopeFields(req) });
    res.status(201).json(event);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getEvents = async (req, res) => {
  try {
    const { start, end } = req.query;
    const where = scopeFilter(req);

    let events;
    if (start && end) {
      const scope = buildWhere(where);
      events = query(
        'calendar_events',
        `SELECT * FROM "calendar_events" ${scope.sql || 'WHERE 1=1'} ` +
          'AND "start" >= ? AND "end" <= ? ORDER BY "start" ASC',
        [...scope.params, new Date(start).toISOString(), new Date(end).toISOString()]
      );
    } else {
      events = find('calendar_events', where, { orderBy: '"start" ASC' });
    }
    res.json(events);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateEvent = async (req, res) => {
  try {
    const body = sanitizeBody(req.body);
    if (body.recurrence && body.recurrence.frequency === 'none') {
      delete body.recurrence;
    }
    const event = updateWhere(
      'calendar_events',
      { _id: req.params.id, ...scopeFilter(req) },
      body
    );
    if (!event) return res.status(404).json({ message: 'Event not found' });
    res.json(event);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteEvent = async (req, res) => {
  try {
    const event = findAndDelete('calendar_events', { _id: req.params.id, ...scopeFilter(req) });
    if (!event) return res.status(404).json({ message: 'Event not found' });
    res.json({ message: 'Event deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.syncTasksToCalendar = async (req, res) => {
  try {
    const scope = buildWhere(scopeFilter(req));
    const tasks = query(
      'tasks',
      `SELECT * FROM "tasks" ${scope.sql || 'WHERE 1=1'} AND "dueDate" IS NOT NULL`,
      scope.params
    );

    const events = tasks.map(task => ({
      title: `📅 ${task.title}`,
      start: task.dueDate,
      end: new Date(new Date(task.dueDate).setHours(23, 59, 59)),
      color: task.priority === 'high' ? '#ef4444' : '#6366f1',
      task: task._id,
      user: req.dataScope.user
    }));

    // This is a simplified sync that returns virtual events.
    // In a real scenario, we might persist these or handle them dynamically.
    res.json(events);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
