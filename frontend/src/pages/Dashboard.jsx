import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { CheckCircle, Clock, Calendar, FileText, TrendingUp, AlertCircle, Tally4, Check } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { DashboardSkeleton } from '../components/Skeletons';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const Dashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    tasksDue: 0,
    tasksCompleted: 0,
    upcomingEvents: 0,
    notes: 0,
    overdueTasks: 0
  });
  const [recentTasks, setRecentTasks] = useState([]);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [habits, setHabits] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    try {
      const [tasksRes, eventsRes, notesRes, habitsRes] = await Promise.all([
        axios.get('/tasks'),
        axios.get('/calendar'),
        axios.get('/notes'),
        axios.get('/habits').catch(() => ({ data: [] }))
      ]);

      const tasks = tasksRes.data;
      const events = eventsRes.data;
      const notes = notesRes.data;
      const habitsData = habitsRes.data;

      setHabits(habitsData);

      // Calculate stats
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const tasksDue = tasks.filter(task =>
        task.dueDate &&
        new Date(task.dueDate) >= today &&
        new Date(task.dueDate) < tomorrow &&
        task.status !== 'completed'
      ).length;

      const tasksCompleted = tasks.filter(task => task.status === 'completed').length;
      const overdueTasks = tasks.filter(task =>
        task.dueDate &&
        new Date(task.dueDate) < today &&
        task.status !== 'completed'
      ).length;

      const upcomingEventsCount = events.filter(event =>
        new Date(event.start) >= today
      ).length;

      setStats({
        tasksDue,
        tasksCompleted,
        upcomingEvents: upcomingEventsCount,
        notes: notes.length,
        overdueTasks
      });

      // Get recent tasks (last 5)
      const recent = tasks
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
        .slice(0, 5);
      setRecentTasks(recent);

      // Get upcoming events (next 5)
      const upcoming = events
        .filter(event => new Date(event.start) >= today)
        .sort((a, b) => new Date(a.start) - new Date(b.start))
        .slice(0, 5);
      setUpcomingEvents(upcoming);

    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleCompleteHabit = async (habitId) => {
    try {
      await axios.put(`/habits/${habitId}/complete`);
      fetchDashboardData();
    } catch (error) {
      console.error('Failed to complete habit:', error);
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

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
      <header className="text-center sm:text-left">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Welcome back! 👋</h1>
        <p className="text-sm sm:text-base text-muted-foreground">Here's what's happening with your productivity today.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div
          onClick={() => navigate('/tasks')}
          className="p-5 sm:p-6 rounded-2xl bg-secondary border border-border hover:border-primary/50 transition-all duration-300 cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs sm:text-sm text-muted-foreground">Tasks Due Today</p>
            <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold group-hover:text-primary transition-colors">{stats.tasksDue}</p>
          {stats.overdueTasks > 0 && (
            <p className="text-xs text-red-500 mt-1">{stats.overdueTasks} overdue</p>
          )}
        </div>

        <div
          onClick={() => navigate('/tasks')}
          className="p-5 sm:p-6 rounded-2xl bg-secondary border border-border hover:border-primary/50 transition-all duration-300 cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs sm:text-sm text-muted-foreground">Completed Tasks</p>
            <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold group-hover:text-primary transition-colors">{stats.tasksCompleted}</p>
          <p className="text-xs text-green-500 mt-1">Total completed</p>
        </div>

        <div
          onClick={() => navigate('/calendar')}
          className="p-5 sm:p-6 rounded-2xl bg-secondary border border-border hover:border-primary/50 transition-all duration-300 cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs sm:text-sm text-muted-foreground">Upcoming Events</p>
            <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold group-hover:text-primary transition-colors">{stats.upcomingEvents}</p>
          <p className="text-xs text-blue-500 mt-1">Scheduled ahead</p>
        </div>

        <div
          onClick={() => navigate('/notes')}
          className="p-5 sm:p-6 rounded-2xl bg-secondary border border-border hover:border-primary/50 transition-all duration-300 cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs sm:text-sm text-muted-foreground">Notes</p>
            <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold group-hover:text-primary transition-colors">{stats.notes}</p>
          <p className="text-xs text-purple-500 mt-1">Total notes</p>
        </div>

        <div
          onClick={() => navigate('/habits')}
          className="p-5 sm:p-6 rounded-2xl bg-secondary border border-border hover:border-primary/50 transition-all duration-300 cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs sm:text-sm text-muted-foreground">Active Habits</p>
            <Tally4 className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold group-hover:text-primary transition-colors">{habits.length}</p>
          <p className="text-xs text-cyan-500 mt-1">Tracking today</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="lg:col-span-2 p-5 sm:p-6 rounded-2xl bg-secondary border border-border">
          <h3
            onClick={() => navigate('/tasks')}
            className="text-base sm:text-lg font-semibold mb-4 flex items-center gap-2 cursor-pointer hover:text-primary transition-colors"
          >
            <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
            Recent Tasks
          </h3>
          {recentTasks.length > 0 ? (
            <div className="space-y-2 sm:space-y-3">
              {recentTasks.map((task) => (
                <div
                  key={task._id}
                  onClick={() => navigate('/tasks')}
                  className="flex items-center justify-between p-3 rounded-lg bg-background border border-border cursor-pointer hover:border-primary/50 transition-colors"
                >
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className={cn(
                      "w-2 h-2 sm:w-3 sm:h-3 rounded-full",
                      task.status === 'completed' ? "bg-green-500" :
                      task.priority === 'high' ? "bg-red-500" :
                      task.priority === 'medium' ? "bg-orange-500" : "bg-blue-500"
                    )} />
                    <div>
                      <p className="font-medium text-sm sm:text-base">{task.title}</p>
                      <p className="text-xs text-muted-foreground">{task.status}</p>
                    </div>
                  </div>
                  {task.dueDate && (
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Due</p>
                      <p className="text-xs sm:text-sm font-medium">{new Date(task.dueDate).toLocaleDateString()}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 sm:py-8 text-muted-foreground">
              <FileText className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm sm:text-base">No tasks yet. Create your first task to get started!</p>
            </div>
          )}
        </div>

        <div className="p-5 sm:p-6 rounded-2xl bg-secondary border border-border flex flex-col gap-4">
          <h3
            onClick={() => navigate('/habits')}
            className="text-base sm:text-lg font-semibold flex items-center gap-2 cursor-pointer hover:text-primary transition-colors"
          >
            <Tally4 className="w-4 h-4 sm:w-5 sm:h-5" />
            Daily Habits
          </h3>
          {habits.length > 0 ? (
            <div className="space-y-2 flex-1">
              {habits.slice(0, 5).map((habit) => {
                const completedToday = checkIfCompletedToday(habit.completedDates);
                return (
                  <div
                    key={habit._id}
                    className="p-3 rounded-lg bg-background border border-border flex items-center justify-between group hover:border-primary/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{habit.name}</p>
                      {habit.streak > 0 && (
                        <p className="text-xs text-cyan-500">{habit.streak} day streak</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleCompleteHabit(habit._id)}
                      disabled={completedToday}
                      className={cn(
                        "p-1.5 rounded-full transition-colors flex-shrink-0 ml-2",
                        completedToday
                          ? "bg-green-500 text-white cursor-not-allowed opacity-70"
                          : "bg-muted text-muted-foreground hover:bg-primary hover:text-primary-foreground"
                      )}
                      title={completedToday ? "Completed today" : "Mark as complete"}
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-6 sm:py-8 text-muted-foreground flex-1 flex flex-col items-center justify-center">
              <Tally4 className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm sm:text-base">No habits yet. Create one!</p>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-6">
        <div className="p-5 sm:p-6 rounded-2xl bg-secondary border border-border">
          <h3
            onClick={() => navigate('/calendar')}
            className="text-base sm:text-lg font-semibold mb-4 flex items-center gap-2 cursor-pointer hover:text-primary transition-colors"
          >
            <Calendar className="w-4 h-4 sm:w-5 sm:h-5" />
            Upcoming Events
          </h3>
          {upcomingEvents.length > 0 ? (
            <div className="space-y-2 sm:space-y-3">
              {upcomingEvents.map((event) => (
                <div
                  key={event._id}
                  onClick={() => navigate('/calendar')}
                  className="p-3 rounded-lg bg-background border border-border cursor-pointer hover:border-primary/50 transition-colors"
                >
                  <p className="font-medium text-sm sm:text-base">{event.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(event.start).toLocaleDateString()} at {new Date(event.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  {event.location && (
                    <p className="text-xs text-muted-foreground">{event.location}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 sm:py-8 text-muted-foreground">
              <Calendar className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm sm:text-base">No upcoming events. Schedule your first event!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
