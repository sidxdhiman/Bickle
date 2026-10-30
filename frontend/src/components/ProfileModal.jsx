import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, LogOut, Copy, Check, Clock, Shield, User, Link2, RefreshCw, CheckCircle2, Ban, Paperclip, ChevronDown, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { GRANTABLE_PAGES } from '../config/pages';
import { clearSearchIndex } from '../utils/searchIndex';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const DURATION_PRESETS = [5, 10, 30, 60];

// Pages whose items can be picked and copied into the guest session.
// Focus, Translator, Workflows and PDF Editor hold no server-side items.
const SHAREABLE_PAGES = {
  notes: {
    label: 'Notes',
    load: async () => {
      const res = await axios.get('/notes');
      return res.data.map((n) => ({ id: n._id, title: n.title || 'Untitled Note', meta: n.category }));
    },
  },
  tasks: {
    label: 'Tasks',
    load: async () => {
      const [tasksRes, listsRes] = await Promise.all([axios.get('/tasks'), axios.get('/lists')]);
      const listName = Object.fromEntries((listsRes.data || []).map((l) => [l._id, l.name]));
      return (tasksRes.data || []).map((t) => ({ id: t._id, title: t.title, meta: listName[t.list] }));
    },
  },
  calendar: {
    label: 'Calendar',
    load: async () => {
      const res = await axios.get('/calendar');
      return (res.data || []).map((e) => ({
        id: e._id,
        title: e.title,
        meta: new Date(e.start).toLocaleDateString(),
      }));
    },
  },
  habits: {
    label: 'Habits',
    load: async () => {
      const res = await axios.get('/habits');
      return (res.data || []).map((h) => ({ id: h._id, title: h.name, meta: h.frequency }));
    },
  },
  sleep: {
    label: 'Sleep',
    load: async () => {
      const res = await axios.get('/sleep');
      return (res.data || []).map((s) => ({
        id: s._id,
        title: `Sleep · ${new Date(s.date).toLocaleDateString()}`,
        meta: s.quality || '',
      }));
    },
  },
  money: {
    label: 'Money',
    load: async () => {
      const res = await axios.get('/money/transactions/all');
      return (res.data || []).map((t) => ({
        id: t._id,
        title: t.description || t.category,
        meta: `${t.type === 'income' ? '+' : '−'}${t.amount}`,
      }));
    },
  },
  whiteboard: {
    label: 'Whiteboards',
    load: async () => {
      const res = await axios.get('/whiteboards');
      return (res.data || []).map((w) => ({ id: w._id, title: w.title || 'Untitled Board' }));
    },
  },
  art: {
    label: 'Art',
    load: async () => {
      const [blogs, photos, videos, music] = await Promise.all([
        axios.get('/art/blogs'),
        axios.get('/art/photos'),
        axios.get('/art/videos'),
        axios.get('/art/music'),
      ]);
      return [
        ...(blogs.data || []).map((d) => ({ id: d._id, title: d.title || 'Untitled blog', meta: 'Blog' })),
        ...(photos.data || []).map((d) => ({ id: d._id, title: d.title || d.name || 'Photo', meta: 'Photo' })),
        ...(videos.data || []).map((d) => ({ id: d._id, title: d.title || d.name || 'Video', meta: 'Video' })),
        ...(music.data || []).map((d) => ({ id: d._id, title: d.title || d.name || 'Track', meta: 'Music' })),
      ];
    },
  },
};

const formatRemaining = (expiresAt) => {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return 'Ended';
  const totalSec = Math.floor(ms / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  if (mins >= 60) {
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  }
  return `${mins}m ${secs.toString().padStart(2, '0')}s`;
};

const TABS = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'access', label: 'Grant Access', icon: Shield },
  { id: 'sessions', label: 'Live Sessions', icon: Clock },
];

const ProfileModal = ({ isOpen, onClose }) => {
  const [tab, setTab] = useState('profile');
  const [profilePic, setProfilePic] = useState(null);
  const navigate = useNavigate();

  // Grant access form
  const [label, setLabel] = useState('');
  const [duration, setDuration] = useState(10);
  const [pages, setPages] = useState([]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createdLink, setCreatedLink] = useState('');
  const [copied, setCopied] = useState(false);

  // Per-item sharing: { [pageKey]: [itemId] } + lazily loaded picker catalogs
  const [itemSelections, setItemSelections] = useState({});
  const [openPicker, setOpenPicker] = useState(null);
  const [pickerCatalogs, setPickerCatalogs] = useState({});
  const [pickerSearch, setPickerSearch] = useState('');

  // Sessions
  const [sessions, setSessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (isOpen) {
      setProfilePic(localStorage.getItem('profilePic'));
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleEscape = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [isOpen]);

  const fetchSessions = async (silent = false) => {
    if (!silent) setLoadingSessions(true);
    try {
      const res = await axios.get('/guest');
      setSessions(res.data);
    } catch (error) {
      console.error('Error fetching sessions:', error);
    } finally {
      if (!silent) setLoadingSessions(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchSessions();
      setCreatedLink('');
      setCreateError('');
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const interval = setInterval(() => fetchSessions(true), 5000);
    return () => clearInterval(interval);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const data = reader.result;
      localStorage.setItem('profilePic', data);
      setProfilePic(data);
    };
    reader.readAsDataURL(file);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('backendToken');
    localStorage.removeItem('authUnlocked');
    localStorage.removeItem('profilePic');
    clearSearchIndex().catch(() => {});
    onClose();
    navigate('/');
    setTimeout(() => window.location.reload(), 50);
  };

  const togglePage = (key) => {
    setPages((prev) => {
      if (prev.includes(key)) {
        // Deselecting a module also clears any items picked inside it.
        setItemSelections((items) => {
          if (!items[key]) return items;
          const next = { ...items };
          delete next[key];
          return next;
        });
        return prev.filter((p) => p !== key);
      }
      return [...prev, key];
    });
  };

  const toggleItem = (pageKey, itemId) => {
    setItemSelections((prev) => {
      const current = prev[pageKey] || [];
      return {
        ...prev,
        [pageKey]: current.includes(itemId)
          ? current.filter((id) => id !== itemId)
          : [...current, itemId],
      };
    });
  };

  const toggleItemPicker = async (pageKey) => {
    setPickerSearch('');
    if (openPicker === pageKey) {
      setOpenPicker(null);
      return;
    }
    setOpenPicker(pageKey);
    if (pickerCatalogs[pageKey]) return;
    setPickerCatalogs((prev) => ({ ...prev, [pageKey]: { items: [], loading: true, error: '' } }));
    try {
      const items = await SHAREABLE_PAGES[pageKey].load();
      setPickerCatalogs((prev) => ({ ...prev, [pageKey]: { items, loading: false, error: '' } }));
    } catch (error) {
      console.error('Error loading shareable items:', error);
      setPickerCatalogs((prev) => ({
        ...prev,
        [pageKey]: { items: [], loading: false, error: 'Could not load your items.' },
      }));
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreateError('');
    if (pages.length === 0) {
      setCreateError('Select at least one module to share.');
      return;
    }
    const sharedItems = [];
    for (const [pageKey, ids] of Object.entries(itemSelections)) {
      if (!pages.includes(pageKey)) continue;
      const catalog = pickerCatalogs[pageKey]?.items || [];
      for (const id of ids || []) {
        const found = catalog.find((item) => item.id === id);
        sharedItems.push({ page: pageKey, itemId: id, title: found?.title || '' });
      }
    }
    setCreating(true);
    try {
      const res = await axios.post('/guest', {
        label: label.trim() || 'Guest',
        durationMinutes: Number(duration),
        allowedPages: pages,
        sharedItems,
      });
      const link = `${window.location.origin}/guest/${res.data.token}`;
      setCreatedLink(link);
      setSessions((prev) => [res.data, ...prev]);
      setLabel('');
      setPages([]);
      setItemSelections({});
      setOpenPicker(null);
      setPickerCatalogs({});
    } catch (error) {
      console.error('Error creating session:', error);
      setCreateError(error.response?.data?.message || 'Failed to create access link.');
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async (value) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (error) {
      console.error('Clipboard unavailable', error);
    }
  };

  const handleRevoke = async (id) => {
    if (!window.confirm('End this session right now? The person will lose access immediately.')) return;
    try {
      await axios.delete(`/guest/${id}`);
      setSessions((prev) => prev.map((s) => (s._id === id ? { ...s, active: false } : s)));
    } catch (error) {
      console.error('Error ending session:', error);
    }
  };

  const activeCount = sessions.filter((s) => s.active).length;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-background border border-border w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 sm:p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full overflow-hidden border border-border bg-accent flex items-center justify-center">
              {profilePic ? (
                <img src={profilePic} alt="profile" className="w-full h-full object-cover" />
              ) : (
                <User className="w-5 h-5 text-muted-foreground" />
              )}
            </div>
            <div>
              <h2 className="text-lg font-bold leading-tight">Account & Sharing</h2>
              <p className="text-xs text-muted-foreground">Manage your profile and temporary guest access</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-3 sm:px-5 pt-3 border-b border-border">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'flex items-center gap-2 px-3 sm:px-4 py-2 text-sm font-medium rounded-t-lg transition-colors',
                tab === t.id
                  ? 'bg-secondary text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
              )}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
              {t.id === 'sessions' && activeCount > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded-full bg-green-500/15 text-green-500 font-semibold">
                  {activeCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6">
          {tab === 'profile' && (
            <div className="max-w-md mx-auto flex flex-col items-center gap-4">
              <div className="w-28 h-28 rounded-full overflow-hidden border border-border bg-accent">
                {profilePic ? (
                  <img src={profilePic} alt="profile" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">No image</div>
                )}
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold">Sidharth</p>
                <p className="text-sm text-muted-foreground">Pro Plan</p>
              </div>
              <label className="w-full text-center px-4 py-2.5 bg-secondary border border-border rounded-lg cursor-pointer hover:bg-accent transition-colors text-sm font-medium">
                Change profile picture
                <input type="file" accept="image/*" onChange={handleFile} className="hidden" />
              </label>
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 transition-colors text-sm font-medium"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          )}

          {tab === 'access' && (
            <form onSubmit={handleCreate} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-2">Who is this for? (optional)</label>
                  <input
                    type="text"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="e.g. Priya"
                    className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">Access duration (minutes)</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min="1"
                      value={duration}
                      onChange={(e) => setDuration(e.target.value)}
                      className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                    />
                    <div className="flex gap-1">
                      {DURATION_PRESETS.map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setDuration(preset)}
                          className={cn(
                            'px-2 py-1 text-xs rounded-md border transition-colors',
                            Number(duration) === preset
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'border-border text-muted-foreground hover:bg-accent'
                          )}
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-semibold">What can they access?</label>
                  <div className="flex gap-3 text-xs">
                    <button type="button" onClick={() => setPages(GRANTABLE_PAGES.map((p) => p.key))} className="text-primary hover:underline">
                      Select all
                    </button>
                    <button type="button" onClick={() => setPages([])} className="text-muted-foreground hover:underline">
                      Clear
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {GRANTABLE_PAGES.map((page) => {
                    const selected = pages.includes(page.key);
                    return (
                      <button
                        type="button"
                        key={page.key}
                        onClick={() => togglePage(page.key)}
                        className={cn(
                          'flex items-center gap-2 px-3 py-2 rounded-lg border text-sm text-left transition-colors',
                          selected
                            ? 'border-primary bg-primary/10 text-foreground'
                            : 'border-border text-muted-foreground hover:bg-accent'
                        )}
                      >
                        <page.icon className="w-4 h-4 shrink-0" />
                        <span className="flex-1 truncate">{page.label}</span>
                        {selected && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground mt-2">Everything not selected will be hidden and blocked for them.</p>
              </div>

              {pages.some((key) => SHAREABLE_PAGES[key]) && (
                <div>
                  <label className="block text-sm font-semibold mb-1">Share specific items (optional)</label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Pick items to copy into their session — like a particular note. Leave empty to give them a fresh, empty workspace.
                  </p>
                  <div className="space-y-2">
                    {pages.filter((key) => SHAREABLE_PAGES[key]).map((key) => {
                      const meta = SHAREABLE_PAGES[key];
                      const selected = itemSelections[key] || [];
                      const open = openPicker === key;
                      const catalog = pickerCatalogs[key];
                      const visibleItems = (catalog?.items || []).filter(
                        (item) =>
                          !pickerSearch ||
                          (item.title || '').toLowerCase().includes(pickerSearch.toLowerCase())
                      );
                      return (
                        <div key={key} className="border border-border rounded-lg overflow-hidden">
                          <button
                            type="button"
                            onClick={() => toggleItemPicker(key)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent/50 transition-colors"
                          >
                            <ChevronDown
                              className={cn('w-4 h-4 shrink-0 text-muted-foreground transition-transform', open ? 'rotate-0' : '-rotate-90')}
                            />
                            <span className="font-medium">{meta.label}</span>
                            {selected.length > 0 && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary font-semibold">
                                {selected.length} selected
                              </span>
                            )}
                            <span className="ml-auto text-xs text-muted-foreground shrink-0">
                              {selected.length ? 'Items shared' : 'Empty workspace'}
                            </span>
                          </button>
                          {open && (
                            <div className="border-t border-border bg-secondary/20 p-2 max-h-52 overflow-y-auto space-y-1">
                              {catalog?.loading && (
                                <p className="text-xs text-muted-foreground flex items-center gap-2 p-2">
                                  <Loader2 className="w-3 h-3 animate-spin" /> Loading your items…
                                </p>
                              )}
                              {catalog?.error && (
                                <p className="text-xs text-destructive p-2">{catalog.error}</p>
                              )}
                              {!catalog?.loading && !catalog?.error && (catalog?.items || []).length === 0 && (
                                <p className="text-xs text-muted-foreground p-2">Nothing here yet.</p>
                              )}
                              {!catalog?.loading && !catalog?.error && (catalog?.items || []).length > 0 && (
                                <>
                                  <div className="flex items-center gap-2 px-1 pb-1">
                                    <input
                                      value={pickerSearch}
                                      onChange={(e) => setPickerSearch(e.target.value)}
                                      placeholder="Search items…"
                                      className="flex-1 px-2 py-1 text-xs bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                                    />
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setItemSelections((prev) => ({
                                          ...prev,
                                          [key]:
                                            selected.length === catalog.items.length
                                              ? []
                                              : catalog.items.map((item) => item.id),
                                        }))
                                      }
                                      className="shrink-0 text-[11px] text-primary hover:underline"
                                    >
                                      {selected.length === catalog.items.length ? 'Clear' : 'Select all'}
                                    </button>
                                  </div>
                                  {visibleItems.map((item) => (
                                    <label
                                      key={item.id}
                                      className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-accent/40 cursor-pointer"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={selected.includes(item.id)}
                                        onChange={() => toggleItem(key, item.id)}
                                        className="rounded border-border"
                                      />
                                      <span className="flex-1 truncate">{item.title}</span>
                                      {item.meta && (
                                        <span className="text-[11px] text-muted-foreground shrink-0">{item.meta}</span>
                                      )}
                                    </label>
                                  ))}
                                  {visibleItems.length === 0 && (
                                    <p className="text-xs text-muted-foreground p-2">No items match your search.</p>
                                  )}
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {createError && (
                <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-md text-destructive text-sm">
                  {createError}
                </div>
              )}

              {createdLink && (
                <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg space-y-2">
                  <p className="text-sm font-medium text-green-500 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" /> Access link ready — share it with them
                  </p>
                  <div className="flex gap-2">
                    <input
                      readOnly
                      value={createdLink}
                      className="flex-1 px-3 py-2 bg-background border border-border rounded-md text-xs font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => handleCopy(createdLink)}
                      className="shrink-0 flex items-center gap-1 px-3 py-2 bg-secondary border border-border rounded-md text-sm hover:bg-accent"
                    >
                      {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-border">
                <button
                  type="submit"
                  disabled={creating}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm font-semibold disabled:opacity-50"
                >
                  <Link2 className="w-4 h-4" />
                  {creating ? 'Generating...' : 'Generate access link'}
                </button>
              </div>
            </form>
          )}

          {tab === 'sessions' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {activeCount > 0 ? `${activeCount} active session${activeCount > 1 ? 's' : ''}` : 'No active sessions'}
                </p>
                <button
                  onClick={fetchSessions}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm bg-secondary border border-border rounded-md hover:bg-accent"
                >
                  <RefreshCw className={cn('w-3.5 h-3.5', loadingSessions && 'animate-spin')} />
                  Refresh
                </button>
              </div>

              {sessions.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground text-sm">
                  <Shield className="w-10 h-10 mx-auto mb-3 opacity-50" />
                  You haven&apos;t shared access with anyone yet.
                </div>
              ) : (
                sessions.map((session) => {
                  const live = session.active && new Date(session.expiresAt).getTime() > now;
                  return (
                    <div key={session._id} className="border border-border rounded-lg p-4 bg-secondary/30">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold truncate">{session.label}</p>
                            <span
                              className={cn(
                                'text-[10px] px-2 py-0.5 rounded-full font-semibold',
                                live ? 'bg-green-500/15 text-green-500' : 'bg-muted text-muted-foreground'
                              )}
                            >
                              {live ? 'LIVE' : 'ENDED'}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {live ? (
                              <span className="text-foreground font-medium">{formatRemaining(session.expiresAt)} remaining</span>
                            ) : (
                              'Session no longer active'
                            )}
                          </p>
                        </div>
                        {live && (
                          <button
                            onClick={() => handleRevoke(session._id)}
                            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-destructive/10 text-destructive border border-destructive/30 rounded-md hover:bg-destructive/20"
                          >
                            <Ban className="w-3.5 h-3.5" />
                            End now
                          </button>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {session.allowedPages.map((key) => (
                          <span key={key} className="text-[11px] px-2 py-0.5 rounded-full bg-accent text-foreground">
                            {GRANTABLE_PAGES.find((p) => p.key === key)?.label || key}
                          </span>
                        ))}
                      </div>
                      {(session.sharedItems || []).length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {session.sharedItems.slice(0, 6).map((item, idx) => (
                            <span
                              key={`${item.itemId}-${idx}`}
                              className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/25"
                            >
                              <Paperclip className="w-3 h-3" />
                              {item.title || GRANTABLE_PAGES.find((p) => p.key === item.page)?.label || item.page}
                            </span>
                          ))}
                          {session.sharedItems.length > 6 && (
                            <span className="text-[11px] text-muted-foreground self-center">
                              +{session.sharedItems.length - 6} more
                            </span>
                          )}
                        </div>
                      )}
                      <div className="mt-3 flex gap-2">
                        <input
                          readOnly
                          value={`${window.location.origin}/guest/${session.token}`}
                          className="flex-1 px-3 py-1.5 bg-background border border-border rounded-md text-[11px] font-mono"
                        />
                        <button
                          onClick={() => handleCopy(`${window.location.origin}/guest/${session.token}`)}
                          className="shrink-0 p-1.5 bg-secondary border border-border rounded-md hover:bg-accent"
                          title="Copy link"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ProfileModal;
