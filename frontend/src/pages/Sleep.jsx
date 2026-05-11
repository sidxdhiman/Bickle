import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Plus, Moon, Sun, Clock, TrendingUp, X, Calendar
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const SleepModal = ({ isOpen, onClose, onSubmit, sleep = null }) => {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    sleepStartDate: new Date().toISOString().split('T')[0],
    sleepStartTime: '',
    sleepEndDate: new Date().toISOString().split('T')[0],
    sleepEndTime: '',
    quality: 'good',
    notes: ''
  });

  useEffect(() => {
    if (sleep) {
      const sleepStart = new Date(sleep.sleepStart);
      const sleepEnd = new Date(sleep.sleepEnd);
      setFormData({
        date: new Date(sleep.date).toISOString().split('T')[0],
        sleepStartDate: sleepStart.toISOString().split('T')[0],
        sleepStartTime: sleepStart.toTimeString().slice(0, 5),
        sleepEndDate: sleepEnd.toISOString().split('T')[0],
        sleepEndTime: sleepEnd.toTimeString().slice(0, 5),
        quality: sleep.quality,
        notes: sleep.notes || ''
      });
    } else {
      // Set default times for new entries
      const now = new Date();
      const defaultStartTime = new Date(now.getTime() - 8 * 60 * 60 * 1000); // 8 hours ago
      setFormData(prev => ({
        ...prev,
        sleepStartTime: defaultStartTime.toTimeString().slice(0, 5),
        sleepEndTime: now.toTimeString().slice(0, 5)
      }));
    }
  }, [sleep]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    // Combine date and time into datetime strings
    const sleepStart = new Date(`${formData.sleepStartDate}T${formData.sleepStartTime}`);
    const sleepEnd = new Date(`${formData.sleepEndDate}T${formData.sleepEndTime}`);

    const submitData = {
      date: formData.date,
      sleepStart: sleepStart.toISOString(),
      sleepEnd: sleepEnd.toISOString(),
      quality: formData.quality,
      notes: formData.notes
    };

    onSubmit(submitData);
    if (!sleep) {
      const now = new Date();
      const defaultStartTime = new Date(now.getTime() - 8 * 60 * 60 * 1000);
      setFormData({
        date: new Date().toISOString().split('T')[0],
        sleepStartDate: new Date().toISOString().split('T')[0],
        sleepStartTime: defaultStartTime.toTimeString().slice(0, 5),
        sleepEndDate: new Date().toISOString().split('T')[0],
        sleepEndTime: now.toTimeString().slice(0, 5),
        quality: 'good',
        notes: ''
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-background border border-border w-full max-w-md max-h-[90vh] overflow-y-auto p-4 sm:p-6 relative rounded-lg">
        <button onClick={onClose} className="absolute top-2 right-2 sm:top-4 sm:right-4 text-muted-foreground hover:text-foreground">
          <X className="w-5 h-5" />
        </button>
        <h2 className="text-lg sm:text-xl font-bold mb-4 sm:mb-6 pr-8">{sleep ? 'Edit Sleep Record' : 'Add Sleep Record'}</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-muted-foreground">Date</label>
            <input
              required
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-muted-foreground">Sleep Start</label>
            <div className="flex gap-2">
              <input
                required
                type="date"
                value={formData.sleepStartDate}
                onChange={(e) => setFormData({ ...formData, sleepStartDate: e.target.value })}
                className="flex-1 px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              />
              <input
                required
                type="time"
                value={formData.sleepStartTime}
                onChange={(e) => setFormData({ ...formData, sleepStartTime: e.target.value })}
                className="flex-1 px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-muted-foreground">Sleep End</label>
            <div className="flex gap-2">
              <input
                required
                type="date"
                value={formData.sleepEndDate}
                onChange={(e) => setFormData({ ...formData, sleepEndDate: e.target.value })}
                className="flex-1 px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              />
              <input
                required
                type="time"
                value={formData.sleepEndTime}
                onChange={(e) => setFormData({ ...formData, sleepEndTime: e.target.value })}
                className="flex-1 px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-muted-foreground">Quality</label>
            <select
              value={formData.quality}
              onChange={(e) => setFormData({ ...formData, quality: e.target.value })}
              className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-sm"
            >
              <option value="poor">Poor</option>
              <option value="fair">Fair</option>
              <option value="good">Good</option>
              <option value="excellent">Excellent</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-muted-foreground">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-sm resize-none"
              rows={3}
              placeholder="Optional notes about your sleep..."
            />
          </div>
          <button
            type="submit"
            className="w-full bg-primary text-primary-foreground py-2 rounded-md hover:bg-primary/90 transition-colors text-sm font-medium"
          >
            {sleep ? 'Update' : 'Add'} Sleep Record
          </button>
        </form>
      </div>
    </div>
  );
};

const AnalyzerModal = ({ isOpen, onClose }) => {
  const [mode, setMode] = useState('sleep'); // 'sleep' or 'wake'
  const [targetDate, setTargetDate] = useState(new Date().toISOString().split('T')[0]);
  const [targetTime, setTargetTime] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Set default time to next hour for wake time, or current time for sleep time
    const now = new Date();
    if (mode === 'sleep') {
      const nextHour = new Date(now.getTime() + 60 * 60 * 1000);
      setTargetTime(nextHour.toTimeString().slice(0, 5));
    } else {
      setTargetTime(now.toTimeString().slice(0, 5));
    }
  }, [mode]);

  const handleAnalyze = async () => {
    if (!targetDate || !targetTime) return;
    setLoading(true);
    try {
      const targetDateTime = new Date(`${targetDate}T${targetTime}`);
      let url, params;
      if (mode === 'sleep') {
        url = '/sleep/analyzer/sleep-time';
        params = { wakeTime: targetDateTime.toISOString() };
      } else {
        url = '/sleep/analyzer/wake-time';
        params = { sleepTime: targetDateTime.toISOString() };
      }
      const res = await axios.get(url, { params });
      setSuggestions(res.data.suggestions);
    } catch (error) {
      console.error('Analysis failed:', error);
    }
    setLoading(false);
  };

  const formatTime = (isoString) => {
    return new Date(isoString).toLocaleString();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-background border border-border w-full max-w-lg max-h-[90vh] overflow-y-auto p-4 sm:p-6 relative rounded-lg">
        <button onClick={onClose} className="absolute top-2 right-2 sm:top-4 sm:right-4 text-muted-foreground hover:text-foreground">
          <X className="w-5 h-5" />
        </button>
        <h2 className="text-lg sm:text-xl font-bold mb-4 sm:mb-6 pr-8">Sleep Analyzer</h2>

        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setMode('sleep')}
            className={cn("flex-1 py-2 px-3 sm:px-4 rounded-md transition-colors text-sm sm:text-base", mode === 'sleep' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground')}
          >
            When to Sleep
          </button>
          <button
            onClick={() => setMode('wake')}
            className={cn("flex-1 py-2 px-3 sm:px-4 rounded-md transition-colors text-sm sm:text-base", mode === 'wake' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground')}
          >
            When to Wake
          </button>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-1 text-muted-foreground">
            {mode === 'sleep' ? 'Desired Wake Time' : 'Sleep Time'}
          </label>
          <div className="flex gap-2">
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="flex-1 px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-sm"
            />
            <input
              type="time"
              value={targetTime}
              onChange={(e) => setTargetTime(e.target.value)}
              className="flex-1 px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-sm"
            />
          </div>
        </div>

        <button
          onClick={handleAnalyze}
          disabled={!targetDate || !targetTime || loading}
          className="w-full bg-primary text-primary-foreground py-2 rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 mb-4 text-sm font-medium"
        >
          {loading ? 'Analyzing...' : 'Analyze'}
        </button>

        {suggestions.length > 0 && (
          <div>
            <h3 className="font-semibold mb-2 text-sm sm:text-base">Suggestions:</h3>
            <div className="space-y-2">
              {suggestions.map((suggestion, index) => (
                <div key={index} className="bg-secondary p-3 rounded-md">
                  <div className="flex justify-between items-center text-sm">
                    <span className="font-medium">
                      {mode === 'sleep' ? formatTime(suggestion.sleepTime) : formatTime(suggestion.wakeTime)}
                    </span>
                    <span className="text-xs sm:text-sm text-muted-foreground">
                      {suggestion.cycles} cycles ({suggestion.duration} min)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const Sleep = () => {
  const [sleeps, setSleeps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [analyzerOpen, setAnalyzerOpen] = useState(false);
  const [editingSleep, setEditingSleep] = useState(null);

  useEffect(() => {
    fetchSleeps();
  }, []);

  const fetchSleeps = async () => {
    try {
      const res = await axios.get('/sleep');
      setSleeps(res.data);
    } catch (error) {
      console.error('Failed to fetch sleeps:', error);
    }
    setLoading(false);
  };

  const handleCreateSleep = async (data) => {
    try {
      await axios.post('/sleep', data);
      fetchSleeps();
      setModalOpen(false);
    } catch (error) {
      console.error('Failed to create sleep:', error);
    }
  };

  const handleUpdateSleep = async (data) => {
    try {
      await axios.put(`/sleep/${editingSleep._id}`, data);
      fetchSleeps();
      setModalOpen(false);
      setEditingSleep(null);
    } catch (error) {
      console.error('Failed to update sleep:', error);
    }
  };

  const handleDeleteSleep = async (id) => {
    if (window.confirm('Are you sure you want to delete this sleep record?')) {
      try {
        await axios.delete(`/sleep/${id}`);
        fetchSleeps();
      } catch (error) {
        console.error('Failed to delete sleep:', error);
      }
    }
  };

  const formatDuration = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const getQualityColor = (quality) => {
    switch (quality) {
      case 'poor': return 'text-red-500';
      case 'fair': return 'text-yellow-500';
      case 'good': return 'text-green-500';
      case 'excellent': return 'text-blue-500';
      default: return 'text-muted-foreground';
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-full">Loading...</div>;
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 sm:mb-6 gap-4">
        <h1 className="text-xl sm:text-2xl font-bold">Sleep Tracker</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setAnalyzerOpen(true)}
            className="flex items-center gap-2 bg-secondary text-secondary-foreground px-3 sm:px-4 py-2 rounded-md hover:bg-secondary/80 transition-colors text-sm sm:text-base"
          >
            <TrendingUp className="w-4 h-4" />
            Analyzer
          </button>
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-3 sm:px-4 py-2 rounded-md hover:bg-primary/90 transition-colors text-sm sm:text-base"
          >
            <Plus className="w-4 h-4" />
            Add Sleep
          </button>
        </div>
      </div>

      <div className="grid gap-4">
        {sleeps.map((sleep) => (
          <div key={sleep._id} className="bg-card border border-border p-4 rounded-lg">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2 gap-2">
              <div className="flex items-center gap-2">
                <Moon className="w-5 h-5 text-primary" />
                <span className="font-medium text-sm sm:text-base">
                  {new Date(sleep.date).toLocaleDateString()}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn("text-xs sm:text-sm font-medium", getQualityColor(sleep.quality))}>
                  {sleep.quality}
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={() => {
                      setEditingSleep(sleep);
                      setModalOpen(true);
                    }}
                    className="text-muted-foreground hover:text-foreground text-xs sm:text-sm"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteSleep(sleep._id)}
                    className="text-muted-foreground hover:text-destructive text-xs sm:text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-xs sm:text-sm text-muted-foreground mb-2">
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                <span className="truncate">
                  {new Date(sleep.sleepStart).toLocaleTimeString()} - {new Date(sleep.sleepEnd).toLocaleTimeString()}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Sun className="w-4 h-4" />
                {formatDuration(sleep.duration)}
              </div>
            </div>
            {sleep.notes && (
              <p className="text-xs sm:text-sm text-muted-foreground mt-2">{sleep.notes}</p>
            )}
          </div>
        ))}
      </div>

      {sleeps.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <Moon className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p className="text-sm sm:text-base">No sleep records yet. Add your first sleep entry!</p>
        </div>
      )}

      <SleepModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingSleep(null);
        }}
        onSubmit={editingSleep ? handleUpdateSleep : handleCreateSleep}
        sleep={editingSleep}
      />

      <AnalyzerModal
        isOpen={analyzerOpen}
        onClose={() => setAnalyzerOpen(false)}
      />
    </div>
  );
};

export default Sleep;