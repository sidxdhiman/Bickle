import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  AlertCircle
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import axios from 'axios';
import { CalendarSkeleton } from '../components/Skeletons';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const startOfDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const endOfDay = (date) => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

const isSameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const isInRange = (day, start, end) => {
  const normalizedDay = startOfDay(day).getTime();
  return normalizedDay >= startOfDay(start).getTime() && normalizedDay <= endOfDay(end).getTime();
};

const buildMonthGrid = (date) => {
  const firstOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  const start = new Date(firstOfMonth);
  start.setDate(firstOfMonth.getDate() - firstOfMonth.getDay());

  return Array.from({ length: 42 }).map((_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
};

const getWeekDays = (date) => {
  const start = new Date(date);
  start.setDate(date.getDate() - date.getDay());
  return Array.from({ length: 7 }).map((_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
};

const getMonthInputValue = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
const formatDateInputValue = (date) => date
  ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  : '';
const formatShortDate = (date) => date.toLocaleDateString('default', { month: 'short', day: 'numeric' });
const formatFullDate = (date) => date.toLocaleDateString('default', { month: 'long', day: 'numeric', year: 'numeric' });

const getDaysBetween = (start, end) => Math.floor((end - start) / (24 * 60 * 60 * 1000));
const getMonthDifference = (start, end) => (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());

const addDays = (date, amount) => {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
};

const addMonths = (date, amount) => {
  const next = new Date(date);
  const day = next.getDate();
  next.setMonth(next.getMonth() + amount);
  if (next.getDate() !== day) {
    next.setDate(0);
  }
  return next;
};

const getViewRange = (currentDate, view) => {
  if (view === 'month') {
    const firstOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const start = new Date(firstOfMonth);
    start.setDate(firstOfMonth.getDate() - firstOfMonth.getDay());
    const lastOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    const end = new Date(lastOfMonth);
    end.setDate(lastOfMonth.getDate() + (6 - lastOfMonth.getDay()));
    return [startOfDay(start), endOfDay(end)];
  }

  if (view === 'week') {
    const start = new Date(currentDate);
    start.setDate(currentDate.getDate() - currentDate.getDay());
    const end = addDays(start, 6);
    return [startOfDay(start), endOfDay(end)];
  }

  return [startOfDay(currentDate), endOfDay(currentDate)];
};

const buildRecurringOccurrences = (event, rangeStart, rangeEnd) => {
  if (!event.recurrence || event.recurrence.frequency === 'none') {
    return [event];
  }

  const frequency = event.recurrence.frequency;
  const interval = Math.max(1, Number(event.recurrence.interval) || 1);
  const duration = event.end.getTime() - event.start.getTime();
  const eventStart = startOfDay(event.start);
  const recurrenceEnd = event.recurrence.endDate ? startOfDay(new Date(event.recurrence.endDate)) : null;
  const effectiveEnd = recurrenceEnd && recurrenceEnd < rangeEnd ? recurrenceEnd : rangeEnd;

  if (effectiveEnd < eventStart || rangeEnd < eventStart) {
    return [];
  }

  const occurrences = [];
  let current = new Date(eventStart);

  const addOccurrence = (date) => {
    const start = new Date(date);
    start.setHours(event.start.getHours(), event.start.getMinutes(), event.start.getSeconds(), event.start.getMilliseconds());
    const end = new Date(start.getTime() + duration);
    occurrences.push({
      ...event,
      start,
      end,
      occurrenceDate: new Date(start),
    });
  };

  if (frequency === 'daily') {
    while (current <= effectiveEnd) {
      if (current >= rangeStart) addOccurrence(current);
      current = addDays(current, interval);
    }
    return occurrences;
  }

  if (frequency === 'weekdays') {
    while (current <= effectiveEnd) {
      const day = current.getDay();
      if (current >= rangeStart && day !== 0 && day !== 6) addOccurrence(current);
      current = addDays(current, 1);
    }
    return occurrences;
  }

  if (frequency === 'weekly') {
    while (current <= effectiveEnd) {
      if (current >= rangeStart) addOccurrence(current);
      current = addDays(current, interval * 7);
    }
    return occurrences;
  }

  if (frequency === 'monthly') {
    while (current <= effectiveEnd) {
      if (current >= rangeStart) addOccurrence(current);
      current = addMonths(current, interval);
    }
    return occurrences;
  }

  return [];
};

const parseTimeToMinutes = (time) => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

const formatMinutesToTime = (minutes) => {
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};

const sortCalendarItems = (items) => items.slice().sort((a, b) => {
  if (a.source !== b.source) {
    return a.source === 'event' ? -1 : 1;
  }
  return new Date(a.start) - new Date(b.start);
});

const createTaskEvents = (tasks) => {
  const now = new Date();
  return tasks
    .filter((task) => task.dueDate)
    .map((task) => {
      const due = new Date(task.dueDate);
      const start = now < due ? startOfDay(now) : startOfDay(due);
      const end = endOfDay(due);
      const overdue = end < now && task.status !== 'completed';
      return {
        id: `task-${task._id}`,
        title: task.title,
        start,
        end,
        allDay: true,
        color: overdue ? '#ef4444' : '#f59e0b',
        source: 'task',
        taskId: task._id,
        location: '',
        description: task.description || 'Task deadline',
        isOverdue: overdue,
        dueDate: task.dueDate,
      };
    });
};

const CalendarEntryModal = ({
  isOpen,
  date,
  lists,
  mode,
  onClose,
  onCreateTask,
  onCreateEvent,
  onUpdateEvent,
  onDeleteEvent,
  editingEvent,
  setMode
}) => {
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    list: lists[0]?._id || '',
    priority: 'medium',
    status: 'todo',
    dueDate: date ? formatDateInputValue(date) : ''
  });

  const [eventForm, setEventForm] = useState({
    title: '',
    description: '',
    location: '',
    date: date ? formatDateInputValue(date) : '',
    startTime: '09:00',
    endTime: '10:00',
    allDay: false,
    repeatFrequency: 'none',
    repeatInterval: 1,
    repeatEndDate: ''
  });
  const [eventDuration, setEventDuration] = useState(60);

  useEffect(() => {
    setTaskForm((prev) => ({
      ...prev,
      list: lists[0]?._id || prev.list,
      dueDate: date ? formatDateInputValue(date) : prev.dueDate,
    }));
  }, [date, lists]);

  useEffect(() => {
    setEventForm((prev) => ({
      ...prev,
      date: date ? formatDateInputValue(date) : prev.date,
    }));
  }, [date]);

  useEffect(() => {
    if (editingEvent) {
      const startDate = new Date(editingEvent.start);
      const endDate = new Date(editingEvent.end);
      setEventForm({
        title: editingEvent.title || '',
        description: editingEvent.description || '',
        location: editingEvent.location || '',
        date: formatDateInputValue(startDate),
        startTime: editingEvent.allDay ? '00:00' : formatMinutesToTime(startDate.getHours() * 60 + startDate.getMinutes()),
        endTime: editingEvent.allDay ? '23:59' : formatMinutesToTime(endDate.getHours() * 60 + endDate.getMinutes()),
        allDay: editingEvent.allDay || false,
        repeatFrequency: editingEvent.recurrence?.frequency || 'none',
        repeatInterval: editingEvent.recurrence?.interval || 1,
        repeatEndDate: editingEvent.recurrence?.endDate ? formatDateInputValue(new Date(editingEvent.recurrence.endDate)) : ''
      });
    } else {
      setEventForm((prev) => ({
        ...prev,
        title: '',
        description: '',
        location: '',
        date: date ? formatDateInputValue(date) : prev.date,
        startTime: '09:00',
        endTime: '10:00',
        allDay: false
      }));
    }
  }, [editingEvent, date]);

  useEffect(() => {
    setEventDuration(60);
  }, [mode]);

  const handleStartTimeChange = (value) => {
    const startMinutes = parseTimeToMinutes(value);
    const duration = Math.max(eventDuration, 60);
    const endMinutes = Math.min(startMinutes + duration, 23 * 60 + 59);
    setEventForm((prev) => ({ ...prev, startTime: value, endTime: formatMinutesToTime(endMinutes) }));
  };

  const handleEndTimeChange = (value) => {
    const startMinutes = parseTimeToMinutes(eventForm.startTime);
    const endMinutes = parseTimeToMinutes(value);
    if (endMinutes > startMinutes) {
      setEventDuration(endMinutes - startMinutes);
    }
    setEventForm((prev) => ({ ...prev, endTime: value }));
  };

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (mode === 'task') {
      await onCreateTask(taskForm);
      onClose();
      return;
    }

    const start = new Date(`${eventForm.date}T${eventForm.allDay ? '00:00' : eventForm.startTime}`);
    let end = new Date(`${eventForm.date}T${eventForm.allDay ? '23:59' : eventForm.endTime}`);
    if (end <= start) {
      end = new Date(start);
      end.setHours(start.getHours() + 1);
    }

    const eventPayload = {
      title: eventForm.title,
      description: eventForm.description,
      location: eventForm.location,
      start,
      end,
      allDay: eventForm.allDay,
      color: '#6366f1'
    };

    if (eventForm.repeatFrequency && eventForm.repeatFrequency !== 'none') {
      eventPayload.recurrence = {
        frequency: eventForm.repeatFrequency,
        interval: Number(eventForm.repeatInterval) || 1,
        ...(eventForm.repeatEndDate ? { endDate: new Date(eventForm.repeatEndDate) } : {})
      };
    }

    if (editingEvent && onUpdateEvent) {
      await onUpdateEvent(editingEvent._id, eventPayload);
    } else {
      await onCreateEvent(eventPayload);
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-background border border-border w-full max-w-xl max-h-[90vh] overflow-y-auto relative rounded-2xl shadow-2xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 border-b border-border">
          <div>
            <h2 className="text-xl font-semibold">{editingEvent ? 'Edit' : 'Add'} {mode === 'task' ? 'Task' : 'Event'}</h2>
            <p className="text-sm text-muted-foreground">{editingEvent ? 'Update the selected event' : `Create an item for ${date ? formatFullDate(date) : 'the selected date'}`}</p>
          </div>
          <div className="flex gap-2 rounded-full bg-secondary p-1">
            {['task', 'event'].map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setMode(option)}
                className={cn(
                  'px-4 py-2 rounded-full text-sm transition-all',
                  mode === option ? 'bg-primary text-white' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {option === 'task' ? 'Task' : 'Event'}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {mode === 'task' ? (
            <>
              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">Title</label>
                <input
                  required
                  value={taskForm.title}
                  onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Task title"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">Description</label>
                <textarea
                  value={taskForm.description}
                  onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  rows={3}
                  placeholder="Task notes"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">Due Date</label>
                  <input
                    required
                    type="date"
                    value={taskForm.dueDate}
                    onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">List</label>
                  <select
                    required
                    value={taskForm.list}
                    onChange={(e) => setTaskForm({ ...taskForm, list: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {lists.map((list) => (
                      <option key={list._id} value={list._id}>{list.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">Priority</label>
                  <select
                    value={taskForm.priority}
                    onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">Status</label>
                  <select
                    value={taskForm.status}
                    onChange={(e) => setTaskForm({ ...taskForm, status: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="todo">To Do</option>
                    <option value="in-progress">In Progress</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <span className="text-xs text-muted-foreground">Tasks created here are added to the Tasks page and will appear with a deadline.</span>
                </div>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">Title</label>
                <input
                  required
                  value={eventForm.title}
                  onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Event title"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">Location</label>
                <input
                  required
                  value={eventForm.location}
                  onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Where is this happening?"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">Description</label>
                <textarea
                  value={eventForm.description}
                  onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  rows={3}
                  placeholder="Add notes, agenda, or guests"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">Date</label>
                  <input
                    required
                    type="date"
                    value={eventForm.date}
                    onChange={(e) => setEventForm({ ...eventForm, date: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="flex items-end gap-2">
                  <label className="block text-sm font-semibold text-foreground mb-2 w-full">All day</label>
                  <input
                    type="checkbox"
                    checked={eventForm.allDay}
                    onChange={(e) => setEventForm({ ...eventForm, allDay: e.target.checked })}
                    className="h-4 w-4 rounded border border-border text-primary focus:ring-primary"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">Repeat</label>
                  <select
                    value={eventForm.repeatFrequency}
                    onChange={(e) => setEventForm({ ...eventForm, repeatFrequency: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="none">Does not repeat</option>
                    <option value="daily">Daily</option>
                    <option value="weekdays">Weekdays</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
                {eventForm.repeatFrequency !== 'none' && (
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">Repeat every</label>
                    <input
                      type="number"
                      min={1}
                      value={eventForm.repeatInterval}
                      onChange={(e) => setEventForm({ ...eventForm, repeatInterval: Number(e.target.value) })}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {eventForm.repeatFrequency === 'daily' && 'days'}
                      {eventForm.repeatFrequency === 'weekdays' && 'weekdays'}
                      {eventForm.repeatFrequency === 'weekly' && 'weeks'}
                      {eventForm.repeatFrequency === 'monthly' && 'months'}
                    </p>
                  </div>
                )}
                {eventForm.repeatFrequency !== 'none' && (
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">Ends on</label>
                    <input
                      type="date"
                      value={eventForm.repeatEndDate}
                      onChange={(e) => setEventForm({ ...eventForm, repeatEndDate: e.target.value })}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                )}
              </div>
              {!eventForm.allDay && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">Start</label>
                    <input
                      required
                      type="time"
                      value={eventForm.startTime}
                      onChange={(e) => handleStartTimeChange(e.target.value)}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">End</label>
                    <input
                      required
                      type="time"
                      value={eventForm.endTime}
                      onChange={(e) => handleEndTimeChange(e.target.value)}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>
              )}
            </>
          )}

          <div className="flex flex-col gap-3 pt-4 border-t border-border sm:flex-row">
            {editingEvent && onDeleteEvent && (
              <button
                type="button"
                onClick={async () => {
                  await onDeleteEvent(editingEvent._id);
                  onClose();
                }}
                className="w-full sm:w-auto rounded-md border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 transition-colors"
              >
                Delete
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:flex-1 bg-secondary text-secondary-foreground py-2 rounded-md hover:bg-secondary/80 transition-colors text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="w-full sm:flex-1 bg-primary text-primary-foreground py-2 rounded-md hover:bg-primary/90 transition-colors text-sm font-medium"
            >
              {editingEvent ? 'Update Event' : `Save ${mode === 'task' ? 'Task' : 'Event'}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const DayDetailsModal = ({ isOpen, date, items, onClose, onAdd, onEditEvent }) => {
  if (!isOpen || !date) return null;
  const eventItems = items.filter((item) => item.source === 'event');
  const taskItems = items.filter((item) => item.source === 'task');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-3xl overflow-y-auto rounded-3xl border border-border bg-background shadow-2xl">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between border-b border-border">
          <div>
            <h2 className="text-xl font-semibold">{formatFullDate(date)}</h2>
            <p className="text-sm text-muted-foreground">Review events and deadlines for this day.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onAdd('event')}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Event
            </button>
            <button
              type="button"
              onClick={() => onAdd('task')}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent/80 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Task
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Close
            </button>
          </div>
        </div>

        <div className="space-y-6 p-5">
          <div className="rounded-3xl border border-border bg-secondary/50 p-4">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <p className="text-sm font-semibold text-foreground">Events</p>
                <p className="text-xs text-muted-foreground">{eventItems.length} scheduled</p>
              </div>
            </div>
            {eventItems.length > 0 ? (
              <div className="space-y-3">
                {eventItems.map((item) => (
                  <div key={item._id || item.id || `${item.title}-${item.start}`} className="rounded-2xl border border-border bg-background p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-semibold text-foreground">{item.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{item.location || 'No location'}</p>
                        {item.recurrence?.frequency && item.recurrence.frequency !== 'none' && (
                          <span className="inline-flex mt-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                            Repeats {item.recurrence.frequency}{item.recurrence.interval > 1 ? ` every ${item.recurrence.interval}` : ''}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                          {item.allDay ? 'All day' : `${new Date(item.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(item.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                        </span>
                        <button
                          type="button"
                          onClick={() => onEditEvent(item)}
                          className="rounded-full border border-border bg-secondary px-3 py-1 text-[11px] font-semibold text-foreground hover:bg-accent/80 transition-colors"
                        >
                          Edit
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-3xl border border-dashed border-border bg-background p-4 text-sm text-muted-foreground">No events for this day.</div>
            )}
          </div>

          <div className="rounded-3xl border border-border bg-secondary/50 p-4">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <p className="text-sm font-semibold text-foreground">Tasks</p>
                <p className="text-xs text-muted-foreground">{taskItems.length} deadline{taskItems.length === 1 ? '' : 's'}</p>
              </div>
            </div>
            {taskItems.length > 0 ? (
              <div className="space-y-3">
                {taskItems.map((item) => (
                  <button key={item.id} type="button" onClick={() => onOpenTask && onOpenTask(item.taskId)} className="rounded-2xl border border-border bg-background p-4 text-left w-full">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-semibold text-foreground">{item.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{item.description || 'No description'}</p>
                      </div>
                      <span className="rounded-full bg-yellow-100 dark:bg-yellow-900/20 px-3 py-1 text-xs font-semibold text-yellow-800 dark:text-yellow-200">
                        Due {new Date(item.dueDate).toLocaleDateString('default', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-3xl border border-dashed border-border bg-background p-4 text-sm text-muted-foreground">No tasks due on this day.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const CalendarPage = () => {
  const [view, setView] = useState('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [tasks, setTasks] = useState([]);
  const [events, setEvents] = useState([]);
  const [lists, setLists] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('task');
  const today = new Date();
  const [selectedDate, setSelectedDate] = useState(today);
  const [editingEvent, setEditingEvent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [taskRes, eventRes, listRes] = await Promise.all([
          axios.get('/tasks'),
          axios.get('/calendar'),
          axios.get('/lists')
        ]);

        setTasks(taskRes.data);
        setEvents(eventRes.data.map((event) => ({
          ...event,
          start: new Date(event.start),
          end: new Date(event.end)
        })));
        setLists(listRes.data);
      } catch (error) {
        console.error('Failed to load calendar data', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const refreshCalendar = async () => {
    setLoading(true);
    try {
      const [taskRes, eventRes] = await Promise.all([
        axios.get('/tasks'),
        axios.get('/calendar')
      ]);
      setTasks(taskRes.data);
      setEvents(eventRes.data.map((event) => ({
        ...event,
        start: new Date(event.start),
        end: new Date(event.end)
      })));
    } catch (error) {
      console.error('Failed to refresh calendar data', error);
    } finally {
      setLoading(false);
    }
  };

  const [rangeStart, rangeEnd] = getViewRange(currentDate, view);
  const visibleEvents = events.flatMap((event) => buildRecurringOccurrences(event, rangeStart, rangeEnd));
  const allItems = sortCalendarItems([...visibleEvents.map((event) => ({ ...event, source: 'event' })), ...createTaskEvents(tasks)]);

  const getItemsForDate = (date) =>
    allItems.filter((item) => isInRange(date, item.start, item.end));

  const handlePrev = () => {
    setCurrentDate((prev) => {
      const next = new Date(prev);
      if (view === 'month') {
        next.setMonth(next.getMonth() - 1);
      } else if (view === 'week') {
        next.setDate(next.getDate() - 7);
      } else {
        next.setDate(next.getDate() - 1);
      }
      return next;
    });
  };

  const handleNext = () => {
    setCurrentDate((prev) => {
      const next = new Date(prev);
      if (view === 'month') {
        next.setMonth(next.getMonth() + 1);
      } else if (view === 'week') {
        next.setDate(next.getDate() + 7);
      } else {
        next.setDate(next.getDate() + 1);
      }
      return next;
    });
  };

  const handleMonthChange = (e) => {
    const [year, month] = e.target.value.split('-').map(Number);
    if (!Number.isNaN(year) && !Number.isNaN(month)) {
      setCurrentDate(new Date(year, month - 1, 1));
    }
  };

  const [isDayDetailsOpen, setIsDayDetailsOpen] = useState(false);

  const openDayDetails = (date) => {
    setSelectedDate(date);
    setIsDayDetailsOpen(true);
  };

  const navigate = useNavigate();

  const openTaskInList = (taskId) => {
    setIsDayDetailsOpen(false);
    navigate(`/tasks?taskId=${taskId}`);
  };

  const handleItemClick = (item) => {
    if (item.source === 'task' && item.taskId) {
      openTaskInList(item.taskId);
    } else if (item.source === 'event') {
      openEditModal(item);
    }
  };

  const openAddModal = (mode) => {
    setEditingEvent(null);
    setModalMode(mode);
    setIsDayDetailsOpen(false);
    setIsModalOpen(true);
  };

  const openEditModal = (event) => {
    setSelectedDate(new Date(event.start));
    setModalMode('event');
    setEditingEvent(event);
    setIsDayDetailsOpen(false);
    setIsModalOpen(true);
  };

  const handleCreateTask = async (taskData) => {
    try {
      const body = {
        ...taskData,
        list: taskData.list || lists[0]?._id,
      };
      await axios.post('/tasks', body);
      await refreshCalendar();
    } catch (error) {
      console.error('Failed to create task from calendar', error);
    }
  };

  const handleCreateEvent = async (eventData) => {
    try {
      await axios.post('/calendar', eventData);
      await refreshCalendar();
    } catch (error) {
      console.error('Failed to create calendar event', error);
    }
  };

  const handleUpdateEvent = async (eventId, eventData) => {
    try {
      await axios.put(`/calendar/${eventId}`, eventData);
      await refreshCalendar();
    } catch (error) {
      console.error('Failed to update calendar event', error);
    }
  };

  const handleDeleteEvent = async (eventId) => {
    try {
      await axios.delete(`/calendar/${eventId}`);
      await refreshCalendar();
    } catch (error) {
      console.error('Failed to delete calendar event', error);
    }
  };

  return (
    <div className="h-full flex flex-col gap-6">
      <DayDetailsModal
        isOpen={isDayDetailsOpen}
        date={selectedDate}
        items={getItemsForDate(selectedDate)}
        onClose={() => setIsDayDetailsOpen(false)}
        onAdd={openAddModal}
        onEditEvent={openEditModal}
        onOpenTask={openTaskInList}
      />
      <CalendarEntryModal
        isOpen={isModalOpen}
        date={selectedDate}
        lists={lists}
        mode={modalMode}
        setMode={setModalMode}
        onClose={() => {
          setIsModalOpen(false);
          setEditingEvent(null);
        }}
        onCreateTask={handleCreateTask}
        onCreateEvent={handleCreateEvent}
        onUpdateEvent={handleUpdateEvent}
        onDeleteEvent={handleDeleteEvent}
        editingEvent={editingEvent}
      />

      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-4 sm:gap-6">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Calendar</h1>
              <p className="text-muted-foreground">View events, deadlines, and today’s schedule.</p>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-secondary p-1 border border-border">
              {['month', 'week', 'day'].map((option) => (
                <button
                  key={option}
                  onClick={() => setView(option)}
                  className={cn(
                    'px-3 py-1 rounded-full text-sm transition-all capitalize',
                    view === option ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setCurrentDate(new Date())}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent/80 transition-colors"
            >
              <CalendarIcon className="w-4 h-4" />
              Today
            </button>

            <input
              type="month"
              value={getMonthInputValue(currentDate)}
              onChange={handleMonthChange}
              className="rounded-full border border-border bg-background px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handlePrev}
            className="rounded-full border border-border bg-background p-2 hover:bg-accent/70 transition-colors"
            title="Previous"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="min-w-[160px] rounded-full border border-border bg-secondary px-4 py-2 text-center text-sm font-medium">
            {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
          </div>
          <button
            onClick={handleNext}
            className="rounded-full border border-border bg-background p-2 hover:bg-accent/70 transition-colors"
            title="Next"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setSelectedDate(today);
              setModalMode('event');
              setIsModalOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Entry
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-hidden bg-secondary/50 border border-border rounded-3xl">
        {loading ? (
          <CalendarSkeleton />
        ) : view === 'month' ? (
          <div className="h-full flex flex-col p-4">
            <div className="sticky top-0 z-10 grid grid-cols-7 border-b border-border pb-3 bg-secondary/50">
              {days.map((day) => (
                <div key={day} className="py-3 text-center text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  {day}
                </div>
              ))}
            </div>
            <div className="overflow-auto flex-1">
              <div className="grid grid-cols-7 gap-px bg-border">
                {buildMonthGrid(currentDate).map((date) => {
                const inCurrentMonth = date.getMonth() === currentDate.getMonth();
                const dayEvents = getItemsForDate(date);
                const isToday = isSameDay(date, today);
                const dueTasks = tasks.filter((task) => task.dueDate && isSameDay(new Date(task.dueDate), date) && task.status !== 'completed');
                return (
                  <button
                    key={date.toISOString()}
                    type="button"
                    onClick={() => openDayDetails(date)}
                    className={cn(
                      'min-h-[100px] w-full overflow-hidden bg-background p-3 text-left transition-colors',
                      !inCurrentMonth && 'bg-muted/50 text-muted-foreground',
                      isToday && 'ring-2 ring-primary/50 bg-primary/5',
                      'hover:bg-accent/40'
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn('text-sm font-semibold', isToday ? 'text-primary' : 'text-foreground')}>
                        {date.getDate()}
                      </span>
                      <div className="flex items-center gap-1">
                        {dueTasks.length > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 dark:bg-yellow-900/20 px-2 py-0.5 text-[10px] font-semibold text-yellow-800 dark:text-yellow-200">
                            <AlertCircle className="w-3 h-3" />
                            {dueTasks.length}
                          </span>
                        )}
                        {isToday && (
                          <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-white">Today</span>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 space-y-1">
                      {dayEvents.slice(0, 3).map((item) => (
                        <button
                          type="button"
                          key={item._id || item.id || `${item.title}-${date.toISOString()}`}
                          onClick={() => handleItemClick(item)}
                          className="overflow-hidden rounded-xl px-2 py-1 text-[11px] font-semibold text-white text-left w-full"
                          style={{ backgroundColor: item.color }}
                        >
                          {item.title}
                        </button>
                      ))}
                      {dayEvents.length > 3 && (
                        <div className="text-[11px] text-muted-foreground">+{dayEvents.length - 3} more</div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
            </div>
          </div>
        ) : view === 'week' ? (
          <div className="h-full overflow-auto p-4">
            <div className="grid grid-cols-7 gap-2">
              {getWeekDays(currentDate).map((date) => {
                const dayEvents = getItemsForDate(date);
                const dueTasks = tasks.filter((task) => task.dueDate && isSameDay(new Date(task.dueDate), date) && task.status !== 'completed');
                return (
                  <button
                    key={date.toISOString()}
                    type="button"
                    onClick={() => openDayDetails(date)}
                    className="rounded-3xl border border-border bg-background p-4 text-left hover:bg-accent/40 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">{date.toLocaleString('default', { weekday: 'short' })}</p>
                        <p className="text-lg font-semibold">{date.getDate()}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {dueTasks.length > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 dark:bg-yellow-900/20 px-2 py-0.5 text-[10px] font-semibold text-yellow-800 dark:text-yellow-200">
                            <AlertCircle className="w-3 h-3" />
                            {dueTasks.length}
                          </span>
                        )}
                        {isSameDay(date, today) && (
                          <span className="rounded-full bg-primary px-2 py-1 text-[11px] font-semibold text-white">Today</span>
                        )}
                      </div>
                    </div>
                    <div className="space-y-3">
                      {dayEvents.length ? dayEvents.map((item) => (
                        <button key={item._id || item.id || `${item.title}-${date.toISOString()}` } type="button" onClick={() => handleItemClick(item)} className="rounded-2xl border border-border bg-secondary/70 p-3 text-left w-full">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            <span>{item.allDay ? 'All day' : `${new Date(item.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(item.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}</span>
                          </div>
                          <p className="mt-2 text-sm font-semibold text-foreground">{item.title}</p>
                          <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                        </button>
                      )) : (
                        <div className="rounded-3xl border border-dashed border-border bg-secondary/40 p-4 text-sm text-muted-foreground">No items</div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="h-full overflow-auto p-4">
            <div className="rounded-3xl border border-border bg-background p-6">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
                <div>
                  <p className="text-sm text-muted-foreground">{formatFullDate(currentDate)}</p>
                  <h2 className="text-2xl font-semibold">Day view</h2>
                </div>
                {isSameDay(currentDate, today) && (
                  <span className="rounded-full bg-primary px-3 py-1 text-sm font-semibold text-white">Today</span>
                )}
              </div>
              <div className="space-y-4">
                {getItemsForDate(currentDate).map((item) => (
                  <button key={item._id || item.id || `${item.title}-${currentDate.toISOString()}` } type="button" onClick={() => handleItemClick(item)} className="rounded-3xl border border-border bg-secondary/70 p-5 text-left w-full">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{item.title}</p>
                        <p className="text-xs text-muted-foreground">{item.source === 'task' ? 'Task deadline' : item.location}</p>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {item.allDay ? 'All day' : `${new Date(item.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(item.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                        </span>
                        {item.location && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {item.location}
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">{item.description}</p>
                  </button>
                ))}
                {getItemsForDate(currentDate).length === 0 && (
                  <div className="rounded-3xl border border-dashed border-border bg-secondary/40 p-6 text-sm text-muted-foreground">No entries for this day. Click on a date to add one.</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CalendarPage;
