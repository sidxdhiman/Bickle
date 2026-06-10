import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Check, X, Edit, Trash2, CalendarDays, BarChart, Sun } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { TasksSkeleton } from '../components/Skeletons'; // Reusing task skeleton for loading state

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
      <div className="bg-background border border-border w-full max-w-md max-h-[90vh] overflow-y-auto relative rounded-lg shadow-xl">
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
  const [habits, setHabits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState(null);

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

  const handleCompleteHabit = async (habit) => {
    try {
      const res = await axios.put(`/habits/${habit._id}/complete`);
      setHabits(prev => prev.map(h => h._id === habit._id ? res.data : h));
    } catch (error) {
      console.error('Error completing habit:', error.response?.data?.msg || error.message);
      alert(error.response?.data?.msg || 'Failed to complete habit');
    }
  };

  const checkIfCompletedToday = (completedDates) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return completedDates.some(dateString => {
      const date = new Date(dateString);
      date.setHours(0, 0, 0, 0);
      return date.getTime() === today.getTime();
    });
  };

  if (loading) return <TasksSkeleton />;

  return (
    <div className="flex flex-col h-full max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 gap-6">
      <header className="flex items-center justify-between pb-4 border-b border-border">
        <h1 className="text-2xl font-bold tracking-tight">Habit Tracker ({habits.length})</h1>
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

      <div className="flex-1 overflow-y-auto pr-2 -mr-2">
        {habits.length > 0 ? (
          <div className="space-y-4">
            {habits.map(habit => {
              const completedToday = checkIfCompletedToday(habit.completedDates);
              return (
                <div
                  key={habit._id}
                  className="bg-secondary border border-border rounded-md p-4 flex items-center justify-between gap-4"
                >
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                      {habit.name}
                      {habit.streak > 0 && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 flex items-center gap-1">
                          <Sun className="w-3 h-3" /> {habit.streak} Day Streak
                        </span>
                      )}
                    </h3>
                    {habit.description && <p className="text-sm text-muted-foreground mt-1">{habit.description}</p>}
                    <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                      <CalendarDays className="w-3 h-3" /> {habit.frequency.charAt(0).toUpperCase() + habit.frequency.slice(1)}
                      {habit.lastCompleted && ` - Last completed: ${new Date(habit.lastCompleted).toLocaleDateString()}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCompleteHabit(habit)}
                      disabled={completedToday}
                      className={cn(
                        "p-2 rounded-full transition-colors",
                        completedToday
                          ? "bg-green-500 text-white cursor-not-allowed opacity-70"
                          : "bg-primary text-primary-foreground hover:bg-primary/90"
                      )}
                      title={completedToday ? "Completed today" : "Mark as complete today"}
                    >
                      <Check className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => {
                        setEditingHabit(habit);
                        setIsModalOpen(true);
                      }}
                      className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-full transition-colors"
                      title="Edit habit"
                    >
                      <Edit className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDeleteHabit(habit._id)}
                      className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full transition-colors"
                      title="Delete habit"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <BarChart className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg">No habits found.</p>
            <p className="text-sm">Start tracking a new habit to see your progress!</p>
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
