import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Search, CornerDownLeft, LayoutDashboard, CheckSquare, Calendar as CalendarIcon,
  FileText, Moon, DollarSign, Timer, Globe, Tally4, PenTool, FilePen, Palette,
  ListChecks, StickyNote, CalendarClock, Settings,
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { PAGES } from '../config/pages';
import { useAccess } from '../context/AccessContext';
import { peek } from '../utils/pageCache';
import { fuzzySearch } from '../utils/fuzzy';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const PAGE_ICONS = {
  dashboard: LayoutDashboard, tasks: CheckSquare, habits: Tally4, focus: Timer,
  calendar: CalendarIcon, notes: FileText, whiteboard: PenTool, 'pdf-editor': FilePen,
  sleep: Moon, money: DollarSign, translator: Globe, art: Palette, settings: Settings,
};

const GROUP_LABELS = {
  pages: 'Pages',
  habits: 'Habits',
  tasks: 'Tasks',
  notes: 'Notes',
  events: 'Events',
};

// Module-level index with a short TTL so reopening the palette is instant
// but data stays reasonably fresh.
let indexCache = null;
let indexCacheAt = 0;
const INDEX_TTL_MS = 45000;

const emptyIndex = { habits: [], tasks: [], notes: [], events: [] };

const seedFromPageCache = () => ({
  habits: peek('habits')?.habits ?? [],
  tasks: peek('tasks')?.tasks ?? [],
  notes: peek('notes')?.notes ?? [],
  events: peek('calendar')?.events ?? [],
});

const fetchIndex = async () => {
  const [habits, tasks, notes, events] = await Promise.all([
    axios.get('/habits').then(r => r.data).catch(() => null),
    axios.get('/tasks').then(r => r.data).catch(() => null),
    axios.get('/notes').then(r => r.data).catch(() => null),
    axios.get('/calendar').then(r => r.data).catch(() => null),
  ]);
  return {
    habits: habits ?? [],
    tasks: tasks ?? [],
    notes: notes ?? [],
    events: events ?? [],
  };
};

const SearchPalette = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { allowedPages } = useAccess();
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(() => indexCache ?? seedFromPageCache());
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  // Load/refresh the search index when the palette opens
  useEffect(() => {
    if (!isOpen) return;
    setQuery('');
    setActiveIndex(0);

    // Instant paint from last-known or page-cache data
    const seed = indexCache ?? seedFromPageCache();
    setIndex(seed);

    const now = Date.now();
    if (!indexCache || now - indexCacheAt > INDEX_TTL_MS) {
      fetchIndex().then(fresh => {
        indexCache = fresh;
        indexCacheAt = Date.now();
        setIndex(fresh);
      }).catch(() => {/* keep seed */});
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  // Build flat grouped results on every keystroke (pure in-memory, instant)
  const results = useMemo(() => {
    const q = query.trim();
    const groups = [];

    // Pages — always available, no fetch needed
    const pagePool = PAGES.filter(p => allowedPages.includes(p.key));
    if (!q) {
      groups.push({
        key: 'pages',
        items: pagePool.map(p => ({
          id: `page-${p.key}`,
          icon: PAGE_ICONS[p.key] || p.icon,
          title: p.label,
          subtitle: 'Go to page',
          to: p.path,
        })),
      });
    } else {
      const pageHits = fuzzySearch(
        q, pagePool,
        p => p.label,
        p => [p.key],
        5,
      ).map(({ item: p }) => ({
        id: `page-${p.key}`,
        icon: PAGE_ICONS[p.key] || p.icon,
        title: p.label,
        subtitle: 'Page',
        to: p.path,
      }));
      if (pageHits.length) groups.push({ key: 'pages', items: pageHits });
    }

    if (!q) return groups; // empty query → just pages

    const habitHits = fuzzySearch(
      q, index.habits,
      h => h.name,
      h => [h.description, h.frequency],
      8,
    ).map(({ item: h }) => ({
      id: `habit-${h._id}`,
      icon: Tally4,
      title: h.name,
      subtitle: h.streak > 0 ? `Habit · ${h.streak} day streak` : 'Habit',
      to: `/habits?habit=${h._id}`,
    }));
    if (habitHits.length) groups.push({ key: 'habits', items: habitHits });

    const taskHits = fuzzySearch(
      q, index.tasks,
      t => t.title,
      t => [t.description, ...(t.tags || [])],
      8,
    ).map(({ item: t }) => ({
      id: `task-${t._id}`,
      icon: CheckSquare,
      title: t.title,
      subtitle: t.status === 'completed' ? 'Task · completed' : 'Task',
      to: `/tasks?taskId=${t._id}`,
    }));
    if (taskHits.length) groups.push({ key: 'tasks', items: taskHits });

    const noteHits = fuzzySearch(
      q, index.notes,
      n => n.title || 'Untitled',
      n => [(n.content || '').slice(0, 300), n.category],
      6,
    ).map(({ item: n }) => ({
      id: `note-${n._id}`,
      icon: StickyNote,
      title: n.title || 'Untitled',
      subtitle: n.category ? `Note · ${n.category}` : 'Note',
      to: `/notes?noteId=${n._id}`,
    }));
    if (noteHits.length) groups.push({ key: 'notes', items: noteHits });

    const eventHits = fuzzySearch(
      q, index.events,
      e => e.title,
      e => [e.description, e.location],
      5,
    ).map(({ item: e }) => ({
      id: `event-${e._id}`,
      icon: CalendarClock,
      title: e.title,
      subtitle: 'Event · calendar',
      to: '/calendar',
    }));
    if (eventHits.length) groups.push({ key: 'events', items: eventHits });

    return groups;
  }, [query, index, allowedPages]);

  // Flat list for keyboard navigation
  const flat = useMemo(() => results.flatMap(g => g.items), [results]);

  useEffect(() => { setActiveIndex(0); }, [query]);

  useEffect(() => {
    const el = listRef.current?.querySelector('[data-active="true"]');
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, results]);

  const go = useCallback((item) => {
    if (!item) return;
    onClose();
    navigate(item.to);
  }, [navigate, onClose]);

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => (flat.length ? (i + 1) % flat.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => (flat.length ? (i - 1 + flat.length) % flat.length : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      go(flat[activeIndex]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  let runningIndex = -1;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-black/60 backdrop-blur-sm p-4 pt-[10vh]"
      onClick={onClose}
    >
      <div
        className="bg-background border border-border w-full max-w-lg rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[70vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 border-b border-border">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search habits, tasks, notes, pages…"
            className="flex-1 bg-transparent py-3.5 text-sm focus:outline-none placeholder:text-muted-foreground"
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="hidden sm:block text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5 bg-secondary">
            esc
          </kbd>
        </div>

        <div ref={listRef} className="flex-1 overflow-y-auto py-2">
          {flat.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">
              {query.trim()
                ? `No results for “${query.trim()}”`
                : 'Type to search everything'}
            </div>
          ) : (
            results.map(group => (
              <div key={group.key} className="mb-1">
                <p className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {GROUP_LABELS[group.key] || group.key}
                </p>
                {group.items.map(item => {
                  runningIndex += 1;
                  const idx = runningIndex;
                  const active = idx === activeIndex;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      data-active={active}
                      onClick={() => go(item)}
                      onMouseEnter={() => setActiveIndex(idx)}
                      className={cn(
                        'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                        active ? 'bg-primary/15 text-foreground' : 'hover:bg-accent/50'
                      )}
                    >
                      <Icon className={cn('w-4 h-4 shrink-0', active ? 'text-primary' : 'text-muted-foreground')} />
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-medium truncate">{item.title}</span>
                        {item.subtitle && (
                          <span className="block text-xs text-muted-foreground truncate">{item.subtitle}</span>
                        )}
                      </span>
                      {active && <CornerDownLeft className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div className="px-4 py-2 border-t border-border text-[10px] text-muted-foreground flex items-center gap-3">
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  );
};

export default SearchPalette;
