const Habit = require('../models/Habit');

// @desc    Get all habits for a user
// @route   GET /api/habits
// @access  Private
exports.getHabits = async (req, res) => {
  try {
    const habits = await Habit.find({ userId: req.user.id }).sort({ createdAt: -1 });
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
    const habit = await Habit.findById(req.params.id);
    if (!habit) {
      return res.status(404).json({ msg: 'Habit not found' });
    }
    // Ensure user owns habit
    if (habit.userId.toString() !== req.user.id) {
      return res.status(401).json({ msg: 'Not authorized' });
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
      userId: req.user.id,
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
    let habit = await Habit.findById(req.params.id);

    if (!habit) {
      return res.status(404).json({ msg: 'Habit not found' });
    }

    // Ensure user owns habit
    if (habit.userId.toString() !== req.user.id) {
      return res.status(401).json({ msg: 'Not authorized' });
    }

    habit = await Habit.findByIdAndUpdate(
      req.params.id,
      { $set: habitFields },
      { new: true }
    );

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
    const habit = await Habit.findById(req.params.id);

    if (!habit) {
      return res.status(404).json({ msg: 'Habit not found' });
    }

    // Ensure user owns habit
    if (habit.userId.toString() !== req.user.id) {
      return res.status(401).json({ msg: 'Not authorized' });
    }

    await Habit.findByIdAndDelete(req.params.id);

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
    let habit = await Habit.findById(req.params.id);

    if (!habit) {
      return res.status(404).json({ msg: 'Habit not found' });
    }

    // Ensure user owns habit
    if (habit.userId.toString() !== req.user.id) {
      return res.status(401).json({ msg: 'Not authorized' });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const lastCompletedDate = habit.lastCompleted ? new Date(habit.lastCompleted) : null;
    if (lastCompletedDate) lastCompletedDate.setHours(0, 0, 0, 0);

    if (lastCompletedDate && lastCompletedDate.getTime() === today.getTime()) {
      return res.status(400).json({ msg: 'Habit already completed today' });
    }

    // Check if yesterday was completed to maintain streak
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    let newStreak = habit.streak;
    if (lastCompletedDate && lastCompletedDate.getTime() === yesterday.getTime()) {
      newStreak++;
    } else if (!lastCompletedDate || lastCompletedDate.getTime() < yesterday.getTime()) {
      newStreak = 1; // Reset streak if not completed yesterday
    }

    habit.lastCompleted = Date.now();
    habit.streak = newStreak;
    habit.completedDates.push(Date.now());

    await habit.save();
    res.json(habit);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};
