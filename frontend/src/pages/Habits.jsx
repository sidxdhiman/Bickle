import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Plus, Check, X, Edit, Trash2, CalendarDays, BarChart3, Flame, ListChecks, PartyPopper } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { TasksSkeleton } from '../components/Skeletons'; // Reusing task skeleton for loading state
import { HabitHeatmap, MiniStrip, isCompletedOn } from '../components/HabitHeatmap';
import { peek, stash } from '../utils/pageCache';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const HabitModal = ({ isOpen, onClose, onSubmit, habit = null }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    frequency: 'daily',
  });

  useEffect(() => {
    if (habit) {
      setFormData({
        name: habit.name || '',
        description: habit.description || '',
        frequency: habit.frequency || 'daily',
      });
    } else {
      setFormData({
        name: '',
        description: '',
        frequency: 'daily',
      });
    }
  }, [isOpen, habit]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-6">
      <div className="bg-background border border-border w-full max-w-md max-h-[90vh] overflow-y-auto relative rounded-2xl shadow-xl">
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-border">
          <h2 className="text-lg sm:text-xl font-bold">{habit ? 'Edit Habit' : 'Create New Habit'}</h2>
          <button
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-foreground mb-2">Habit Name</label>
            <input
              autoFocus
              required
              type="text"
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
              className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-sm transition-colors"
              placeholder="Enter habit name..."
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-foreground mb-2">Description (Optional)</label>
            <textarea
              value={formData.description}
              onChange={e => setFormData({...formData, description: e.target.value})}
              className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-sm resize-none transition-colors"
              rows={3}
              placeholder="Describe your habit..."
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-foreground mb-2">Frequency</label>
            <select
              value={formData.frequency}
              onChange={e => setFormData({...formData, frequency: e.target.value})}
              className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-sm transition-colors"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-secondary text-secondary-foreground py-2 rounded-md hover:bg-secondary/80 transition-colors text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 bg-primary text-primary-foreground py-2 rounded-md hover:bg-primary/90 transition-colors text-sm font-medium"
            >
              {habit ? 'Update Habit' : 'Create Habit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const Habits = () => {
  const [habits, setHabits] = useState(() => peek('habits')?.habits ?? []);
  const [loading, setLoading] = useState(() => !peek('habits'));
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState(null);
  const [togglingId, setTogglingId] = useState(null);

  const today = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);

  const fetchHabits = async () => {
    try {
      const res = await axios.get('/habits');
      setHabits(res.data);
    } catch (error) {
      console.error('Error fetching habits:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHabits();
  }, []);

  // Keep the cache in sync so revisiting the page is instant
  useEffect(() => {
    if (!loading) stash('habits', { habits });
  }, [loading, habits]);

  const handleCreateHabit = async (habitData) => {
    try {
      const res = await axios.post('/habits', habitData);
      setHabits(prev => [res.data, ...prev]);
    } catch (error) {
      console.error('Error creating habit:', error);
    }
  };

  const handleUpdateHabit = async (habitData) => {
    try {
      const res = await axios.put(`/habits/${editingHabit._id}`, habitData);
      setHabits(prev => prev.map(habit => habit._id === editingHabit._id ? res.data : habit));
      setEditingHabit(null);
    } catch (error) {
      console.error('Error updating habit:', error);
    }
  };

  const handleDeleteHabit = async (id) => {
    if (window.confirm('Are you sure you want to delete this habit?')) {
      try {
        await axios.delete(`/habits/${id}`);
        setHabits(prev => prev.filter(habit => habit._id !== id));
      } catch (error) {
        console.error('Error deleting habit:', error);
      }
    }
  };

  // Toggle: mark done for today, or undo if already done today
  const handleToggleHabit = async (habit) => {
    const completed = isCompletedOn(habit.completedDates, today);
    setTogglingId(habit._id);
    try {
      const res = completed
        ? await axios.put(`/habits/${habit._id}/uncomplete`)
        : await axios.put(`/habits/${habit._id}/complete`);
      setHabits(prev => prev.map(h => h._id === habit._id ? res.data : h));
    } catch (error) {
      console.error('Error updating habit:', error.response?.data?.msg || error.message);
      alert(error.response?.data?.msg || 'Failed to update habit');
    } finally {
      setTogglingId(null);
    }
  };

  const doneToday = habits.filter(h => isCompletedOn(h.completedDates, today)).length;
  const bestStreak = habits.reduce((max, h) => Math.max(max, h.streak || 0), 0);

  if (loading) return <TasksSkeleton />;

  return (
    <div className="flex flex-col h-full max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Habit Tracker</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {habits.length === 0
              ? 'Build better routines, one day at a time.'
              : doneToday === habits.length
                ? "You're all caught up for today!"
                : `${doneToday} of ${habits.length} done today`}
          </p>
        </div>
        <button
          onClick={() => {
            setEditingHabit(null);
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Add Habit
        </button>
      </header>

      {habits.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="p-4 rounded-2xl bg-secondary border border-border">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-muted-foreground">Done Today</p>
              <ListChecks className="w-4 h-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold">
              {doneToday}
              <span className="text-base text-muted-foreground font-medium">/{habits.length}</span>
            </p>
          </div>
          <div className="p-4 rounded-2xl bg-secondary border border-border">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-muted-foreground">Best Streak</p>
              <Flame className="w-4 h-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold">
              {bestStreak}
              <span className="text-base text-muted-foreground font-medium"> days</span>
            </p>
          </div>
          <div className="p-4 rounded-2xl bg-secondary border border-border col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-muted-foreground">Active Habits</p>
              <CalendarDays className="w-4 h-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold">{habits.length}</p>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto pr-2 -mr-2 space-y-6">
        {habits.length > 0 ? (
          <>
            <section>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Today's Habits
              </h2>
              <div className="space-y-3">
                {habits.map(habit => {
                  const completedToday = isCompletedOn(habit.completedDates, today);
                  return (
                    <div
                      key={habit._id}
                      className={cn(
                        'bg-secondary border rounded-xl p-4 flex items-start sm:items-center gap-3 sm:gap-4 transition-colors',
                        completedToday ? 'border-green-500/30' : 'border-border'
                      )}
                    >
                      <button
                        onClick={() => handleToggleHabit(habit)}
                        disabled={togglingId === habit._id}
                        className={cn(
                          'w-8 h-8 rounded-full flex items-center justify-center transition-all flex-shrink-0 border-2 mt-0.5 sm:mt-0',
                          completedToday
                            ? 'bg-green-500 border-green-500 text-white'
                            : 'border-muted-foreground/40 hover:border-primary hover:bg-primary/10 text-transparent hover:text-primary'
                        )}
                        title={completedToday ? "Undo today's completion" : 'Mark as done today'}
                      >
                        <Check className="w-4 h-4" strokeWidth={3} />
                      </button>
                      <div className="flex-1 min-w-0">
                        <h3 className={cn('font-semibold', completedToday && 'text-muted-foreground')}>
                          {habit.name}
                        </h3>
                        {habit.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">{habit.description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          {habit.streak > 0 && (
                            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-500 flex items-center gap-1">
                              <Flame className="w-3 h-3" /> {habit.streak} day streak
                            </span>
                          )}
                          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <CalendarDays className="w-3 h-3" />
                            {habit.frequency.charAt(0).toUpperCase() + habit.frequency.slice(1)}
                          </span>
                          <MiniStrip completedDates={habit.completedDates} />
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0 self-center">
                        <button
                          onClick={() => {
                            setEditingHabit(habit);
                            setIsModalOpen(true);
                          }}
                          className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-full transition-colors"
                          title="Edit habit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteHabit(habit._id)}
                          className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full transition-colors"
                          title="Delete habit"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              {doneToday === habits.length && (
                <div className="mt-3 p-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-500 text-sm flex items-center gap-2">
                  <PartyPopper className="w-4 h-4 flex-shrink-0" />
                  All habits completed today. Great job!
                </div>
              )}
            </section>

            <HabitHeatmap habits={habits} />
          </>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <BarChart3 className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg">No habits yet.</p>
            <p className="text-sm">Create your first habit to start tracking your progress.</p>
          </div>
        )}
      </div>

      <HabitModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={editingHabit ? handleUpdateHabit : handleCreateHabit}
        habit={editingHabit}
      />
    </div>
  );
};

export default Habits;
