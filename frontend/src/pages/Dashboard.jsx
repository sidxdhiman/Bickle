import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { CheckCircle, Clock, Calendar, FileText, TrendingUp, AlertCircle } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const Dashboard = () => {
  const [stats, setStats] = useState({
    tasksDue: 0,
    tasksCompleted: 0,
    upcomingEvents: 0,
    notes: 0,
    overdueTasks: 0
  });
  const [recentTasks, setRecentTasks] = useState([]);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [tasksRes, eventsRes, notesRes] = await Promise.all([
          axios.get('/tasks'),
          axios.get('/calendar'),
          axios.get('/notes')
        ]);

        const tasks = tasksRes.data;
        const events = eventsRes.data;
        const notes = notesRes.data;

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

    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-1/3 mb-2"></div>
          <div className="h-4 bg-muted rounded w-1/2"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="p-6 rounded-2xl bg-muted animate-pulse h-24"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Welcome back! 👋</h1>
        <p className="text-muted-foreground">Here's what's happening with your productivity today.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="p-6 rounded-2xl bg-secondary border border-border hover:border-primary/50 transition-all duration-300 cursor-pointer group">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">Tasks Due Today</p>
            <Clock className="w-5 h-5 text-muted-foreground" />
          </div>
          <p className="text-3xl font-bold group-hover:text-primary transition-colors">{stats.tasksDue}</p>
          {stats.overdueTasks > 0 && (
            <p className="text-xs text-red-500 mt-1">{stats.overdueTasks} overdue</p>
          )}
        </div>

        <div className="p-6 rounded-2xl bg-secondary border border-border hover:border-primary/50 transition-all duration-300 cursor-pointer group">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">Completed Tasks</p>
            <CheckCircle className="w-5 h-5 text-muted-foreground" />
          </div>
          <p className="text-3xl font-bold group-hover:text-primary transition-colors">{stats.tasksCompleted}</p>
          <p className="text-xs text-green-500 mt-1">Total completed</p>
        </div>

        <div className="p-6 rounded-2xl bg-secondary border border-border hover:border-primary/50 transition-all duration-300 cursor-pointer group">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">Upcoming Events</p>
            <Calendar className="w-5 h-5 text-muted-foreground" />
          </div>
          <p className="text-3xl font-bold group-hover:text-primary transition-colors">{stats.upcomingEvents}</p>
          <p className="text-xs text-blue-500 mt-1">Scheduled ahead</p>
        </div>

        <div className="p-6 rounded-2xl bg-secondary border border-border hover:border-primary/50 transition-all duration-300 cursor-pointer group">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">Notes</p>
            <FileText className="w-5 h-5 text-muted-foreground" />
          </div>
          <p className="text-3xl font-bold group-hover:text-primary transition-colors">{stats.notes}</p>
          <p className="text-xs text-purple-500 mt-1">Total notes</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 p-6 rounded-2xl bg-secondary border border-border">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Recent Tasks
          </h3>
          {recentTasks.length > 0 ? (
            <div className="space-y-3">
              {recentTasks.map((task) => (
                <div key={task._id} className="flex items-center justify-between p-3 rounded-lg bg-background border border-border">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-3 h-3 rounded-full",
                      task.status === 'completed' ? "bg-green-500" :
                      task.priority === 'high' ? "bg-red-500" :
                      task.priority === 'medium' ? "bg-orange-500" : "bg-blue-500"
                    )} />
                    <div>
                      <p className="font-medium">{task.title}</p>
                      <p className="text-sm text-muted-foreground">{task.status}</p>
                    </div>
                  </div>
                  {task.dueDate && (
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Due</p>
                      <p className="text-sm font-medium">{new Date(task.dueDate).toLocaleDateString()}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No tasks yet. Create your first task to get started!</p>
            </div>
          )}
        </div>

        <div className="p-6 rounded-2xl bg-secondary border border-border">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Upcoming Events
          </h3>
          {upcomingEvents.length > 0 ? (
            <div className="space-y-3">
              {upcomingEvents.map((event) => (
                <div key={event._id} className="p-3 rounded-lg bg-background border border-border">
                  <p className="font-medium">{event.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(event.start).toLocaleDateString()} at {new Date(event.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  {event.location && (
                    <p className="text-sm text-muted-foreground">{event.location}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No upcoming events. Schedule your first event!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
