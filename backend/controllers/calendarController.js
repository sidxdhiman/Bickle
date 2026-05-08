const CalendarEvent = require('../models/CalendarEvent');
const Task = require('../models/Task');

exports.createEvent = async (req, res) => {
  try {
    const event = await CalendarEvent.create({ ...req.body, user: req.user._id });
    res.status(201).json(event);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getEvents = async (req, res) => {
  try {
    const { start, end } = req.query;
    const filter = { user: req.user._id };

    if (start && end) {
      filter.start = { $gte: new Date(start) };
      filter.end = { $lte: new Date(end) };
    }

    const events = await CalendarEvent.find(filter).sort({ start: 1 });
    res.json(events);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateEvent = async (req, res) => {
  try {
    const event = await CalendarEvent.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      req.body,
      { new: true }
    );
    if (!event) return res.status(404).json({ message: 'Event not found' });
    res.json(event);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteEvent = async (req, res) => {
  try {
    const event = await CalendarEvent.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!event) return res.status(404).json({ message: 'Event not found' });
    res.json({ message: 'Event deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.syncTasksToCalendar = async (req, res) => {
  try {
    const tasks = await Task.find({
      user: req.user._id,
      dueDate: { $exists: true }
    });

    const events = tasks.map(task => ({
      title: `📅 ${task.title}`,
      start: task.dueDate,
      end: new Date(new Date(task.dueDate).setHours(23, 59, 59)),
      color: task.priority === 'high' ? '#ef4444' : '#6366f1',
      task: task._id,
      user: req.user._id
    }));

    // This is a simplified sync that returns virtual events.
    // In a real scenario, we might persist these or handle them dynamically.
    res.json(events);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
