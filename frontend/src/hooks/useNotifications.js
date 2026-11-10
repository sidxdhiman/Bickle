import { useEffect, useState } from 'react';
import axios from 'axios';
import { useAccess } from '../context/AccessContext';
import { useChatUnread, getChatLatest } from './useChatUnread';
import { buildRecurringOccurrences } from '../utils/recurrence';

// One shared source for the bell: derives reminders from tasks, calendar
// events (with recurrence), habits and chat unread — same singleton pattern
// as useChatUnread so multiple mounts never spawn duplicate pollers.
const POLL_MS = 45000;
const DISMISS_KEY = 'bickle-notifications-dismissed';
const DISMISS_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const DISMISS_MAX = 300;

let data = { tasks: [], events: [], habits: [] };
let allowedPagesCache = null;
let chatCountSeen = -1; // unknown until the first poll result arrives
const listeners = new Set();
let timer = null;

const publish = () => listeners.forEach((listener) => listener());

const loadDismissed = () => {
  try {
    const raw = JSON.parse(localStorage.getItem(DISMISS_KEY) || '{}');
    const now = Date.now();
    const cleaned = {};
    for (const [id, at] of Object.entries(raw)) {
      if (now - at < DISMISS_TTL_MS) cleaned[id] = at;
    }
    return cleaned;
  } catch (error) {
    return {};
  }
};

let dismissed = loadDismissed();

const saveDismissed = () => {
  try {
    const entries = Object.entries(dismissed).sort((a, b) => b[1] - a[1]).slice(0, DISMISS_MAX);
    localStorage.setItem(DISMISS_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch (error) {
    /* storage full or unavailable — dismissals just won't persist */
  }
};

const refresh = async () => {
  const allowed = allowedPagesCache;
  if (!allowed) return;
  const jobs = [];
  if (allowed.includes('tasks')) jobs.push(['tasks', axios.get('/tasks')]);
  if (allowed.includes('calendar')) jobs.push(['events', axios.get('/calendar')]);
  if (allowed.includes('habits')) jobs.push(['habits', axios.get('/habits')]);
  if (jobs.length === 0) return;

  const results = await Promise.allSettled(jobs.map(([, request]) => request));
  let changed = false;
  results.forEach((result, index) => {
    const [field] = jobs[index];
    if (result.status === 'fulfilled') {
      const next = result.value.data || [];
      if (JSON.stringify(next) !== JSON.stringify(data[field])) {
        data[field] = next;
        changed = true;
      }
    }
  });
  if (changed) publish();
};

const ensurePolling = () => {
  refresh();
  if (timer) return;
  timer = setInterval(() => {
    if (document.visibilityState === 'visible') refresh();
  }, POLL_MS);
};

// ---------- derivation ----------

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

const dayKey = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const timeLabel = (date) => new Date(date).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

export const NOTIFICATION_GROUPS = [
  { key: 'chat', label: 'Chat' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'events', label: 'Calendar' },
  { key: 'habits', label: 'Habits' },
];

const buildItems = ({ allowedPages, chatUnread, now }) => {
  const items = [];
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const todayKey = dayKey(now);

  if (allowedPages.includes('tasks')) {
    for (const task of data.tasks) {
      if (!task?.dueDate || task.status === 'completed') continue;
      const due = endOfDay(task.dueDate);
      if (due < now) {
        const daysLate = Math.max(1, Math.round((todayStart - startOfDay(task.dueDate)) / 86400000));
        items.push({
          id: `task:${task._id}:overdue`,
          group: 'tasks',
          urgent: true,
          title: task.title,
          subtitle: daysLate === 1 ? 'Overdue since yesterday' : `${daysLate} days overdue`,
          to: `/tasks?taskId=${task._id}`,
          sortAt: due.getTime(),
        });
      } else if (startOfDay(task.dueDate).getTime() === todayStart.getTime()) {
        items.push({
          id: `task:${task._id}:today`,
          group: 'tasks',
          title: task.title,
          subtitle: task.priority === 'high' ? 'Due today · high priority' : 'Due today',
          to: `/tasks?taskId=${task._id}`,
          sortAt: due.getTime(),
        });
      }
    }
  }

  if (allowedPages.includes('calendar')) {
    // The API returns ISO strings; recurrence expansion needs real Dates
    // (the Calendar page does the same conversion before calling it).
    const occurrences = data.events.flatMap((event) => buildRecurringOccurrences({
      ...event,
      start: new Date(event.start),
      end: new Date(event.end),
    }, todayStart, todayEnd));
    for (const occurrence of occurrences) {
      const start = new Date(occurrence.start);
      const end = new Date(occurrence.end);
      // Still running (or yet to start today), but only surface it if it
      // belongs to today — a plain event tomorrow is not a notification.
      if (end < now || start > todayEnd) continue;
      const running = !occurrence.allDay && start <= now;
      items.push({
        id: `event:${occurrence._id || occurrence.id}:${dayKey(start)}`,
        group: 'events',
        urgent: running,
        title: occurrence.title,
        subtitle: occurrence.allDay
          ? 'All day today'
          : running
            ? 'Happening now'
            : `Today at ${timeLabel(start)}`,
        to: '/calendar',
        sortAt: start.getTime(),
      });
    }
  }

  if (allowedPages.includes('habits')) {
    for (const habit of data.habits) {
      const done = (habit.completedDates || []).some((date) => dayKey(date) === todayKey);
      if (done) continue;
      items.push({
        id: `habit:${habit._id}:${todayKey}`,
        group: 'habits',
        title: habit.name,
        subtitle: habit.streak > 0 ? `${habit.streak}-day streak — keep it alive` : 'Not marked yet today',
        to: `/habits?habit=${habit._id}`,
        sortAt: habit.streak || 0,
      });
    }
  }

  if (allowedPages.includes('chat') && chatUnread > 0) {
    const preview = getChatLatest();
    items.push({
      id: 'chat:unread',
      group: 'chat',
      urgent: true,
      dismissible: false,
      title: chatUnread === 1 ? '1 unread message' : `${chatUnread} unread messages`,
      subtitle: preview ? `${preview.sender}: ${preview.preview}` : 'Open chat to catch up',
      to: '/chat',
      sortAt: 0,
    });
  }

  return items;
};

const sortGroup = (key, items) => items.slice().sort((a, b) => {
  if (key === 'habits') return (b.sortAt || 0) - (a.sortAt || 0);
  return (b.urgent ? 1 : 0) - (a.urgent ? 1 : 0) || a.sortAt - b.sortAt;
});

export const useNotifications = () => {
  const { isGuest, allowedPages } = useAccess();
  const chatUnread = useChatUnread();
  const [, force] = useState(0);

  useEffect(() => {
    if (isGuest) return undefined;
    allowedPagesCache = allowedPages;
    const listener = () => force((value) => value + 1);
    listeners.add(listener);
    ensurePolling();
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      listeners.delete(listener);
      document.removeEventListener('visibilitychange', onVisible);
      if (listeners.size === 0 && timer) {
        clearInterval(timer);
        timer = null;
      }
    };
  }, [isGuest, allowedPages]);

  // A fresh message should re-surface the chat row even if the previous
  // unread state was dismissed — dismissal silences one arrival, not chat.
  // Skipped on the first observation so a "Clear all" from a previous
  // session survives a reload until a genuinely new message arrives.
  useEffect(() => {
    if (isGuest) return;
    if (chatCountSeen >= 0 && chatUnread > chatCountSeen && dismissed['chat:unread']) {
      delete dismissed['chat:unread'];
      saveDismissed();
      publish();
    }
    chatCountSeen = chatUnread;
  }, [chatUnread, isGuest]);

  const now = new Date();
  const allItems = isGuest
    ? []
    : buildItems({ allowedPages, chatUnread, now });
  // The chat row has no × (you can't dismiss a single message count), but
  // "Clear all" silences it too — until a new message re-surfaces it below.
  const items = allItems.filter((item) => !dismissed[item.id]);

  const groups = NOTIFICATION_GROUPS
    .map((group) => ({ ...group, items: sortGroup(group.key, items.filter((item) => item.group === group.key)) }))
    .filter((group) => group.items.length > 0);

  const dismiss = (id) => {
    if (id === 'chat:unread') return;
    dismissed[id] = Date.now();
    saveDismissed();
    publish();
  };

  const dismissAll = (ids) => {
    const stamp = Date.now();
    let touched = false;
    ids.forEach((id) => {
      if (!dismissed[id]) {
        dismissed[id] = stamp;
        touched = true;
      }
    });
    if (!touched) return;
    saveDismissed();
    publish();
  };

  const refreshNow = () => {
    if (!isGuest) refresh();
  };

  return {
    items,
    groups,
    total: items.length,
    dismissibleIds: items.map((item) => item.id),
    dismiss,
    dismissAll,
    refreshNow,
  };
};

export default useNotifications;
