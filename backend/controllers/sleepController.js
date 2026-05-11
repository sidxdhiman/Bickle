const Sleep = require('../models/Sleep');

// --- Sleep Record Controllers ---

exports.createSleep = async (req, res) => {
  try {
    const { date, sleepStart, sleepEnd, quality, notes } = req.body;
    const sleepStartDate = new Date(sleepStart);
    const sleepEndDate = new Date(sleepEnd);
    const duration = Math.round((sleepEndDate - sleepStartDate) / (1000 * 60)); // minutes

    const sleep = await Sleep.create({
      user: req.user._id,
      date: new Date(date),
      sleepStart: sleepStartDate,
      sleepEnd: sleepEndDate,
      duration,
      quality,
      notes,
    });
    res.status(201).json(sleep);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getSleeps = async (req, res) => {
  try {
    const sleeps = await Sleep.find({ user: req.user._id }).sort({ date: -1 });
    res.json(sleeps);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateSleep = async (req, res) => {
  try {
    const { date, sleepStart, sleepEnd, quality, notes } = req.body;
    const sleepStartDate = new Date(sleepStart);
    const sleepEndDate = new Date(sleepEnd);
    const duration = Math.round((sleepEndDate - sleepStartDate) / (1000 * 60));

    const sleep = await Sleep.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      {
        date: new Date(date),
        sleepStart: sleepStartDate,
        sleepEnd: sleepEndDate,
        duration,
        quality,
        notes,
      },
      { new: true }
    );
    if (!sleep) return res.status(404).json({ message: 'Sleep record not found' });
    res.json(sleep);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteSleep = async (req, res) => {
  try {
    const sleep = await Sleep.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!sleep) return res.status(404).json({ message: 'Sleep record not found' });
    res.json({ message: 'Sleep record deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// --- Sleep Analyzer ---

// Calculate when to sleep to wake up at target time
exports.getSleepTime = async (req, res) => {
  try {
    const { wakeTime, cycles = 5 } = req.query; // default 5 cycles (7.5 hours)
    const wakeDate = new Date(wakeTime);
    const cycleMinutes = 90;

    const sleepTimes = [];
    for (let i = cycles; i >= 3; i--) { // suggest 3 to cycles
      const sleepTime = new Date(wakeDate.getTime() - i * cycleMinutes * 60 * 1000);
      sleepTimes.push({
        cycles: i,
        sleepTime: sleepTime.toISOString(),
        duration: i * cycleMinutes,
      });
    }

    res.json({ wakeTime: wakeDate.toISOString(), suggestions: sleepTimes });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Calculate wake up times if sleeping now
exports.getWakeTime = async (req, res) => {
  try {
    const { sleepTime, cycles = 4 } = req.query; // default 4 suggestions
    const sleepDate = sleepTime ? new Date(sleepTime) : new Date();
    const cycleMinutes = 90;

    const wakeTimes = [];
    for (let i = 3; i <= cycles + 2; i++) { // 3 to 4-5 suggestions
      const wakeTime = new Date(sleepDate.getTime() + i * cycleMinutes * 60 * 1000);
      wakeTimes.push({
        cycles: i,
        wakeTime: wakeTime.toISOString(),
        duration: i * cycleMinutes,
      });
    }

    res.json({ sleepTime: sleepDate.toISOString(), suggestions: wakeTimes });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};