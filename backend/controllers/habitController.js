const Habit = require('../models/Habit');
const { scopeFilter } = require('../middleware/scope');

// Normalize any date to its local midnight timestamp (day-level identity)
const dayKey = (d) => {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};

// Recompute a streak from raw completion dates.
// Counts consecutive days backwards from today (or yesterday if today isn't
// done yet, so an in-progress day doesn't zero out a live streak).
const computeStreak = (completedDates) => {
  const days = new Set((completedDates || []).map(dayKey));
  if (days.size === 0) return 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let cursor = new Date(today);
  if (!days.has(cursor.getTime())) {
    cursor.setDate(cursor.getDate() - 1);
    if (!days.has(cursor.getTime())) return 0;
  }

  let streak = 0;
  while (days.has(cursor.getTime())) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
};

// @desc    Get all habits for a user
// @route   GET /api/habits
// @access  Private
exports.getHabits = async (req, res) => {
  try {
    const habits = await Habit.find(scopeFilter(req, 'userId')).sort({ createdAt: -1 });
    res.json(habits);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

// @desc    Get a single habit by ID
// @route   GET /api/habits/:id
// @access  Private
exports.getHabitById = async (req, res) => {
  try {
    const habit = await Habit.findOne({ _id: req.params.id, ...scopeFilter(req, 'userId') });
    if (!habit) {
      return res.status(404).json({ msg: 'Habit not found' });
    }
    res.json(habit);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Habit not found' });
    }
    res.status(500).send('Server Error');
  }
};

// @desc    Create a new habit
// @route   POST /api/habits
// @access  Private
exports.createHabit = async (req, res) => {
  const { name, description, frequency } = req.body;

  // Basic validation
  if (!name) {
    return res.status(400).json({ msg: 'Name is required' });
  }

  try {
    const newHabit = new Habit({
      userId: req.dataScope.user,
      guestSession: req.dataScope.guestSession,
      name,
      description,
      frequency,
    });

    const habit = await newHabit.save();
    res.status(201).json(habit);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

// @desc    Update a habit
// @route   PUT /api/habits/:id
// @access  Private
exports.updateHabit = async (req, res) => {
  const { name, description, frequency, lastCompleted, streak } = req.body;

  // Build habit object
  const habitFields = {};
  if (name) habitFields.name = name;
  if (description) habitFields.description = description;
  if (frequency) habitFields.frequency = frequency;
  if (lastCompleted) habitFields.lastCompleted = lastCompleted;
  if (streak !== undefined) habitFields.streak = streak;

  try {
    const habit = await Habit.findOneAndUpdate(
      { _id: req.params.id, ...scopeFilter(req, 'userId') },
      { $set: habitFields },
      { new: true }
    );

    if (!habit) {
      return res.status(404).json({ msg: 'Habit not found' });
    }

    res.json(habit);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Habit not found' });
    }
    res.status(500).send('Server Error');
  }
};

// @desc    Delete a habit
// @route   DELETE /api/habits/:id
// @access  Private
exports.deleteHabit = async (req, res) => {
  try {
    const habit = await Habit.findOneAndDelete({ _id: req.params.id, ...scopeFilter(req, 'userId') });

    if (!habit) {
      return res.status(404).json({ msg: 'Habit not found' });
    }

    res.json({ msg: 'Habit removed' });
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Habit not found' });
    }
    res.status(500).send('Server Error');
  }
};

// @desc    Mark a habit as completed for today
// @route   PUT /api/habits/:id/complete
// @access  Private
exports.completeHabit = async (req, res) => {
  try {
    const habit = await Habit.findOne({ _id: req.params.id, ...scopeFilter(req, 'userId') });

    if (!habit) {
      return res.status(404).json({ msg: 'Habit not found' });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const alreadyCompletedToday = (habit.completedDates || []).some((d) => {
      const ts = new Date(d).getTime();
      return ts >= today.getTime() && ts < tomorrow.getTime();
    });

    if (alreadyCompletedToday) {
      return res.status(400).json({ msg: 'Habit already completed today' });
    }

    habit.completedDates.push(Date.now());
    habit.lastCompleted = Date.now();
    habit.streak = computeStreak(habit.completedDates);

    await habit.save();
    res.json(habit);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

// @desc    Undo a habit's completion for today
// @route   PUT /api/habits/:id/uncomplete
// @access  Private
exports.uncompleteHabit = async (req, res) => {
  try {
    const habit = await Habit.findOne({ _id: req.params.id, ...scopeFilter(req, 'userId') });

    if (!habit) {
      return res.status(404).json({ msg: 'Habit not found' });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const remaining = (habit.completedDates || []).filter((d) => {
      const ts = new Date(d).getTime();
      return ts < today.getTime() || ts >= tomorrow.getTime();
    });

    if (remaining.length === (habit.completedDates || []).length) {
      return res.status(400).json({ msg: 'Habit not completed today' });
    }

    habit.completedDates = remaining;
    habit.streak = computeStreak(remaining);

    // Point lastCompleted at the most recent remaining day (or clear it)
    if (remaining.length > 0) {
      const latest = remaining.reduce((max, d) => (new Date(d) > new Date(max) ? d : max), remaining[0]);
      habit.lastCompleted = latest;
    } else {
      habit.lastCompleted = null;
    }

    await habit.save();
    res.json(habit);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};
