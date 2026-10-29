import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, CornerDownLeft, LayoutDashboard, CheckSquare, Calendar as CalendarIcon,
  FileText, Moon, DollarSign, Timer, Globe, Tally4, PenTool, FilePen, Palette,
  StickyNote, CalendarClock, Settings, ListTodo, Layers, Image, Video, Music,
  PanelTop, Wallet, Workflow,
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { PAGES } from '../config/pages';
import { useAccess } from '../context/AccessContext';
import { getAllSearchItems, reindexAll } from '../utils/searchIndex';
import { fuzzyScore, fuzzySearch } from '../utils/fuzzy';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const PAGE_ICONS = {
  dashboard: LayoutDashboard, tasks: CheckSquare, habits: Tally4, focus: Timer,
  calendar: CalendarIcon, notes: FileText, whiteboard: PenTool, 'pdf-editor': FilePen,
  sleep: Moon, money: DollarSign, translator: Globe, art: Palette, settings: Settings,
  workflows: Workflow,
};

const TYPE_META = {
  habit: { label: 'Habits', icon: Tally4 },
  task: { label: 'Tasks', icon: CheckSquare },
  note: { label: 'Notes', icon: StickyNote },
  blog: { label: 'Blogs', icon: FilePen },
  list: { label: 'Lists', icon: ListTodo },
  event: { label: 'Events', icon: CalendarClock },
  photo: { label: 'Photos', icon: Image },
  video: { label: 'Videos', icon: Video },
  music: { label: 'Music', icon: Music },
  board: { label: 'Whiteboards', icon: PanelTop },
  sleep: { label: 'Sleep', icon: Moon },
  transaction: { label: 'Money', icon: Wallet },
};

// Group ordering + per-group caps so top results stay scannable
const TYPE_ORDER = ['habit', 'task', 'note', 'blog', 'event', 'list', 'photo', 'video', 'music', 'board', 'sleep', 'transaction'];
const TYPE_CAPS = { habit: 6, task: 6, note: 5, blog: 5, event: 4, list: 3, photo: 3, video: 3, music: 3, board: 3, sleep: 3, transaction: 3 };

const SearchPalette = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { allowedPages } = useAccess();
  const [query, setQuery] = useState('');
  const [docs, setDocs] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const hydrate = useCallback(async () => {
    const items = await getAllSearchItems();
    setDocs(items);
  }, []);

  // On open: hydrate from IndexedDB instantly, then revalidate in background
  useEffect(() => {
    if (!isOpen) return;
    setQuery('');
    setActiveIndex(0);
    hydrate();
    reindexAll()
      .then(() => hydrate())
      .catch(() => {/* keep current docs */});
  }, [isOpen, hydrate]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  const results = useMemo(() => {
    const q = query.trim();
    const groups = [];

    // Pages — always available instantly
    const pagePool = PAGES.filter(p => allowedPages.includes(p.key));
    if (!q) {
      groups.push({
        key: 'pages',
        label: 'Pages',
        items: pagePool.map(p => ({
          id: `page-${p.key}`,
          icon: PAGE_ICONS[p.key] || p.icon,
          title: p.label,
          subtitle: 'Go to page',
          to: p.path,
        })),
      });
    } else {
      const pageHits = fuzzySearch(q, pagePool, p => p.label, p => [p.key], 4)
        .map(({ item: p }) => ({
          id: `page-${p.key}`,
          icon: PAGE_ICONS[p.key] || p.icon,
          title: p.label,
          subtitle: 'Page',
          to: p.path,
        }));
      if (pageHits.length) groups.push({ key: 'pages', label: 'Pages', items: pageHits });
    }

    if (!q || docs.length === 0) return groups;

    // Index docs — score title at full weight, searchable text at a discount
    const byType = new Map();
    for (const doc of docs) {
      const titleScore = fuzzyScore(q, doc.title);
      const textScore = fuzzyScore(q, doc.text) * 0.6;
      const score = Math.max(titleScore, textScore);
      if (score <= 0) continue;
      if (!byType.has(doc.type)) byType.set(doc.type, []);
      byType.get(doc.type).push({ doc, score });
    }

    for (const type of TYPE_ORDER) {
      const hits = byType.get(type);
      if (!hits || !hits.length) continue;
      hits.sort((a, b) => b.score - a.score);
      const meta = TYPE_META[type] || { label: type, icon: FileText };
      groups.push({
        key: type,
        label: meta.label,
        items: hits.slice(0, TYPE_CAPS[type] || 4).map(({ doc }) => ({
          id: doc.id,
          icon: meta.icon,
          title: doc.title,
          subtitle: doc.subtitle,
          to: doc.to,
        })),
      });
    }

    return groups;
  }, [query, docs, allowedPages]);

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
            placeholder="Search habits, tasks, notes, blogs…"
            className="flex-1 bg-transparent py-3.5 text-sm focus:outline-none placeholder:text-muted-foreground"
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="hidden sm:block text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5 bg-secondary leading-none">
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
                  {group.label}
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
