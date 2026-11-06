import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { Check, Download, FileText, Loader2, MessageCircle, Paperclip, SendHorizontal, Timer, Trash2, X } from 'lucide-react';
import { useCurrentUser } from '../hooks/useCurrentUser';

const GRADIENTS = [
  'from-indigo-500 to-sky-400',
  'from-pink-500 to-rose-400',
  'from-amber-400 to-orange-500',
  'from-emerald-400 to-teal-500',
  'from-violet-500 to-fuchsia-400',
];

const gradientFor = (name = '') =>
  GRADIENTS[[...name].reduce((sum, char) => sum + char.charCodeAt(0), 0) % GRADIENTS.length];

// Matches the backend's DISAPPEAR_MODES; either profile may pick any of them.
const DISAPPEAR_OPTIONS = [
  { key: 'off', label: 'Off', hint: 'Keep messages forever' },
  { key: '1h', label: 'After 1 hour' },
  { key: '24h', label: 'After 24 hours' },
  { key: '7d', label: 'After 1 week' },
  { key: 'viewed', label: 'After viewing' },
];

const modePhrase = (key) =>
  ({
    '1h': 'after 1 hour',
    '24h': 'after 24 hours',
    '7d': 'after 1 week',
    viewed: 'after viewing',
  }[key] || '');

// Mirrors the backend's timed purge so expiring messages leave the screen at
// the same moment they leave the server, even between polls. 'viewed' messages
// are handled separately: ones this reader already saw in an earlier session
// never come back, received ones stay until this reader leaves the thread,
// and own ones animate away the moment the other side reads them.
const SWOOSH_MS = 650;
const isVisibleNow = (message) => {
  if (message.expiresAt && new Date(message.expiresAt).getTime() <= Date.now()) return false;
  return true;
};

const formatSize = (bytes) => {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const Avatar = ({ user, size = 'w-10 h-10', text = 'text-sm' }) => (
  <span className={`${size} shrink-0 rounded-full overflow-hidden bg-gradient-to-br ${gradientFor(user?.username)} p-[2px]`}>
    <span
      className={`flex w-full h-full items-center justify-center rounded-full bg-background text-foreground font-semibold overflow-hidden ${text}`}
    >
      {user?.avatar ? (
        <img src={user.avatar} alt="" className="w-full h-full object-cover" />
      ) : (
        (user?.username || '?').slice(0, 1).toUpperCase()
      )}
    </span>
  </span>
);

const formatTime = (ts) =>
  new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const Chat = () => {
  const me = useCurrentUser();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [pendingFile, setPendingFile] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [updatingSettings, setUpdatingSettings] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [vanishing, setVanishing] = useState(() => new Set());

  const activeIdRef = useRef(null);
  const messagesRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const knownViewedRef = useRef(new Map());
  // 'viewed' messages that opened this thread already seen — they must not
  // resurface here, only messages that gain viewedAt while we watch stay.
  const viewedAtLoadRef = useRef(null);
  // Bumped whenever a message lands locally, so a refresh that was already
  // in flight cannot wipe it off the screen before the server echoes it back.
  const localAddRef = useRef(0);

  const active = conversations.find((c) => c._id === activeId) || null;
  const visibleMessages = messages.filter((message) => {
    if (!isVisibleNow(message)) return false;
    // 'viewed' messages that were already read when this thread opened are
    // gone for good — unless the rule itself changed and brought them back.
    if (
      message.viewedAt &&
      viewedAtLoadRef.current &&
      viewedAtLoadRef.current.has(message._id)
    ) {
      return false;
    }
    const mine = me ? String(message.sender) === String(me._id) : false;
    // My own messages are gone for good once read — unless mid-swoosh.
    if (mine && message.viewedAt && !vanishing.has(message._id)) return false;
    return true;
  });

  // Attachment URLs are stored server-relative (/uploads/...); the API origin
  // (e.g. /bickle) turns them into paths nginx and the dev proxy both serve.
  const uploadOrigin = (axios.defaults.baseURL || '').replace(/\/api\/?$/, '');
  const resolveUploadUrl = (url) => (url && url.startsWith('/uploads') ? `${uploadOrigin}${url}` : url);

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  // Closing or refreshing the tab must still flush the messages this reader
  // has seen — the unmount cleanup cannot be trusted once the page is going
  // away, and a keepalive request is the only one that survives the unload.
  useEffect(() => {
    const flushOnUnload = () => {
      const id = activeIdRef.current;
      if (!id) return;
      const auth = axios.defaults.headers.common['Authorization'];
      fetch(`${axios.defaults.baseURL || ''}/chat/${id}/leave`, {
        method: 'POST',
        keepalive: true,
        headers: {
          'Content-Type': 'application/json',
          ...(auth ? { Authorization: auth } : {}),
        },
        body: '{}',
      }).catch(() => {});
    };
    window.addEventListener('pagehide', flushOnUnload);
    return () => window.removeEventListener('pagehide', flushOnUnload);
  }, []);

  // The delete-chat dialog behaves like the app's other modals: Escape and
  // the backdrop dismiss it without touching anything.
  useEffect(() => {
    if (!clearOpen) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') setClearOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [clearOpen]);

  // Conversation list: initial load + light refresh for previews/unread.
  useEffect(() => {
    let cancelled = false;

    const load = async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const res = await axios.get('/chat');
        if (cancelled) return;
        setConversations(res.data);
        if (!activeIdRef.current && res.data.length > 0) {
          setActiveId(res.data[0]._id);
        }
        setError('');
      } catch (err) {
        if (!cancelled && !silent) {
          setError(err.response?.data?.message || 'Could not load conversations.');
        }
      } finally {
        if (!cancelled && !silent) setLoading(false);
      }
    };

    load();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') load(true);
    }, 10000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  // Thread: full load on open, then a full refresh while this conversation is
  // on screen. The server is the source of truth, so messages deleted by the
  // disappearing policy (or re-stamped when the rule changes) drop off the
  // screen the next time the thread refreshes. Leaving the thread (switch or
  // unmount) flushes everything this reader has already seen.
  useEffect(() => {
    setMessages([]);
    setVanishing(new Set());
    knownViewedRef.current = new Map();
    viewedAtLoadRef.current = null;
    setDraft('');
    setPendingFile(null);
    setSettingsOpen(false);
    setClearOpen(false);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    if (!activeId) return undefined;
    let cancelled = false;

    const load = async () => {
      const version = localAddRef.current;
      try {
        const res = await axios.get(`/chat/${activeId}/messages`);
        if (cancelled) return;
        // Remember which messages opened this thread already viewed: those
        // never show again, while ones that gain viewedAt while we watch
        // stay on screen until this reader leaves.
        if (!viewedAtLoadRef.current) {
          viewedAtLoadRef.current = new Set(
            res.data.filter((message) => message.viewedAt).map((message) => message._id)
          );
        }
        setMessages((prev) => {
          // A message that landed while this refresh was in flight is missing
          // from the response — merge it back rather than drop it. The next
          // version-stable refresh reconciles deletions as usual.
          if (localAddRef.current !== version) {
            const ids = new Set(res.data.map((message) => message._id));
            const kept = prev.filter((message) => !ids.has(message._id));
            if (kept.length === 0) return res.data;
            return [...res.data, ...kept].sort(
              (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
            );
          }
          return res.data;
        });
        setError('');
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.message || 'Could not load messages.');
      }
    };

    load();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, 3000);
    return () => {
      cancelled = true;
      clearInterval(timer);
      // Best-effort: deleting what this reader has seen is the whole point.
      axios.post(`/chat/${activeId}/leave`, {}).catch(() => {});
    };
  }, [activeId]);

  // Own messages that gain viewedAt while on screen swoosh out, then are
  // hidden; ones that arrive already viewed never animate (initial load).
  useEffect(() => {
    const next = new Map();
    const newlyViewed = [];
    for (const message of messages) {
      const viewed = Boolean(message.viewedAt);
      const wasViewed = knownViewedRef.current.get(message._id);
      if (me && String(message.sender) === String(me._id) && viewed && wasViewed === false) {
        newlyViewed.push(message._id);
      }
      next.set(message._id, viewed);
    }
    knownViewedRef.current = next;
    if (newlyViewed.length === 0) return;
    setVanishing((prev) => {
      const updated = new Set(prev);
      newlyViewed.forEach((id) => updated.add(id));
      return updated;
    });
    // Not tied to this effect's cleanup: a late removal is harmless, and the
    // next poll would otherwise cancel the timer mid-animation.
    setTimeout(() => {
      setVanishing((prev) => {
        const updated = new Set(prev);
        newlyViewed.forEach((id) => updated.delete(id));
        return updated;
      });
    }, SWOOSH_MS);
  }, [messages, me]);

  const markRead = useCallback(async (conversationId) => {
    try {
      await axios.post(`/chat/${conversationId}/read`, {});
    } catch (err) {
      // Read receipts are best-effort.
    }
    setConversations((prev) =>
      prev.map((c) => (c._id === conversationId ? { ...c, unreadCount: 0 } : c))
    );
  }, []);

  // While this conversation is open, everything from the other side is read.
  useEffect(() => {
    if (!activeId || !me || messages.length === 0) return;
    const hasUnreadFromPeer = messages.some(
      (m) => String(m.sender) !== String(me._id) && !(m.readBy || []).some((id) => String(id) === String(me._id))
    );
    if (hasUnreadFromPeer) markRead(activeId);
  }, [activeId, me, messages, markRead]);

  // Stick to the newest message on arrival.
  useEffect(() => {
    const el = messagesRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, activeId]);

  const growTextarea = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  };

  const handleSend = async (event) => {
    event.preventDefault();
    const text = draft.trim();
    if ((!text && !pendingFile) || !activeId || sending) return;

    setSending(true);
    try {
      let res;
      if (pendingFile) {
        const form = new FormData();
        if (text) form.append('text', text);
        form.append('file', pendingFile);
        res = await axios.post(`/chat/${activeId}/messages`, form);
      } else {
        res = await axios.post(`/chat/${activeId}/messages`, { text });
      }
      const sentMessage = res.data;
      localAddRef.current += 1;
      setMessages((prev) =>
        prev.some((m) => m._id === sentMessage._id) ? prev : [...prev, sentMessage]
      );
      setDraft('');
      setPendingFile(null);
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
      const preview = sentMessage.text || sentMessage.attachment?.name || 'Attachment';
      setConversations((prev) =>
        prev.map((c) =>
          c._id === activeId
            ? {
                ...c,
                lastMessage: { text: preview, sender: sentMessage.sender, at: sentMessage.createdAt },
                updatedAt: sentMessage.createdAt,
              }
            : c
        )
      );
    } catch (err) {
      setError(err.response?.data?.message || 'Message could not be sent.');
    } finally {
      setSending(false);
    }
  };

  const changeMode = async (mode) => {
    if (updatingSettings || !activeId) return;
    setUpdatingSettings(true);
    try {
      const res = await axios.put(`/chat/${activeId}/settings`, { mode });
      setSettingsOpen(false);
      const systemMessage = res.data.message;
      // The new rule reaches back through the whole history, so reload the
      // thread: messages it already covers must leave the screen right now.
      try {
        const fresh = await axios.get(`/chat/${activeId}/messages`);
        setMessages(fresh.data);
      } catch {
        setMessages((prev) =>
          prev.some((m) => m._id === systemMessage._id) ? prev : [...prev, systemMessage]
        );
      }
      localAddRef.current += 1;
      setConversations((prev) =>
        prev.map((c) =>
          c._id === activeId
            ? {
                ...c,
                disappearMode: res.data.mode,
                lastMessage: { text: systemMessage.text, sender: systemMessage.sender, at: systemMessage.createdAt },
                updatedAt: systemMessage.createdAt,
              }
            : c
        )
      );
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not update chat settings.');
    } finally {
      setUpdatingSettings(false);
    }
  };

  // Wipes the whole thread on the server so both sides start over. Local
  // state goes with it; the sidebar preview is reset by the same request.
  const confirmClearChat = async () => {
    if (!activeId || clearing) return;
    setClearing(true);
    try {
      await axios.post(`/chat/${activeId}/clear`, {});
      setMessages([]);
      setVanishing(new Set());
      knownViewedRef.current = new Map();
      viewedAtLoadRef.current = null;
      setConversations((prev) =>
        prev.map((c) => (c._id === activeId ? { ...c, lastMessage: null } : c))
      );
      setClearOpen(false);
      setError('');
    } catch (err) {
      setClearOpen(false);
      setError(err.response?.data?.message || 'Could not delete the chat.');
    } finally {
      setClearing(false);
    }
  };

  const openClear = () => {
    setSettingsOpen(false);
    setClearOpen(true);
  };

  const selectConversation = (id) => setActiveId(id);

  const renderAttachment = (message) => {
    const attachment = message.attachment;
    if (!attachment) return null;
    const url = resolveUploadUrl(attachment.url);

    if (attachment.kind === 'image') {
      return (
        <img
          src={url}
          alt={attachment.name || 'image'}
          loading="lazy"
          onClick={() => window.open(url, '_blank')}
          className="block max-w-[240px] max-h-[300px] object-cover rounded-xl cursor-pointer border border-border/40"
        />
      );
    }
    if (attachment.kind === 'video') {
      return <video src={url} controls playsInline className="block max-w-[260px] rounded-xl" />;
    }
    if (attachment.kind === 'audio') {
      return <audio src={url} controls className="w-56 h-9" />;
    }
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        download
        className="flex items-center gap-2.5 rounded-xl bg-background/40 border border-border/50 px-3 py-2 transition hover:bg-background/70"
      >
        <FileText className="w-5 h-5 shrink-0 opacity-80" />
        <span className="min-w-0">
          <span className="block text-xs font-medium truncate max-w-[160px]">{attachment.name}</span>
          <span className="block text-[10px] text-muted-foreground">{formatSize(attachment.size)}</span>
        </span>
        <Download className="w-4 h-4 shrink-0 opacity-60" />
      </a>
    );
  };

  const activeMode = active ? active.disappearMode || 'off' : 'off';
  const activePhrase = modePhrase(activeMode);

  return (
    <div className="flex h-full overflow-hidden rounded-2xl border border-border bg-card/60 backdrop-blur-xl shadow-lg shadow-black/5">
      {/* Conversation list */}
      <aside
        className={`w-full sm:w-80 shrink-0 border-r border-border flex-col ${
          activeId ? 'hidden sm:flex' : 'flex'
        }`}
      >
        <div className="px-4 py-4 border-b border-border">
          <h1 className="text-lg font-bold tracking-tight">Messages</h1>
          <p className="text-xs text-muted-foreground">Private one-to-one chats</p>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading && conversations.length === 0 && (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          )}
          {!loading && conversations.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">
              No conversations yet. Your chats will appear here.
            </p>
          )}
          {conversations.map((conversation) => (
            <button
              key={conversation._id}
              type="button"
              onClick={() => selectConversation(conversation._id)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-b border-border/40 ${
                conversation._id === activeId ? 'bg-primary/10' : 'hover:bg-accent/60'
              }`}
            >
              <Avatar user={conversation.peer} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold truncate">{conversation.peer.username}</span>
                  {conversation.lastMessage && (
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {formatTime(conversation.lastMessage.at || conversation.updatedAt)}
                    </span>
                  )}
                </span>
                <span className="mt-0.5 flex items-center gap-2">
                  <span className="flex-1 text-xs text-muted-foreground truncate">
                    {conversation.lastMessage ? conversation.lastMessage.text : 'Say hi'}
                  </span>
                  {conversation.disappearMode && conversation.disappearMode !== 'off' && (
                    <Timer className="w-3 h-3 shrink-0 text-muted-foreground" />
                  )}
                  {conversation.unreadCount > 0 && (
                    <span className="shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                      {conversation.unreadCount}
                    </span>
                  )}
                </span>
              </span>
            </button>
          ))}
        </div>
      </aside>

      {/* Thread */}
      <section
        className={`flex-1 min-w-0 flex-col ${activeId ? 'flex' : 'hidden sm:flex'}`}
      >
        {active ? (
          <>
            <header className="flex items-center gap-3 px-4 py-3 border-b border-border bg-secondary/40">
              <button
                type="button"
                onClick={() => setActiveId(null)}
                className="sm:hidden -ml-1 p-1 text-muted-foreground hover:text-foreground"
                aria-label="Back to conversations"
              >
                ←
              </button>
              <Avatar user={active.peer} />
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-tight truncate">{active.peer.username}</p>
                <p className="text-[11px] text-muted-foreground">
                  {activePhrase ? `Disappears ${activePhrase}` : 'Private conversation'}
                </p>
              </div>
              <div className="ml-auto relative">
                <button
                  type="button"
                  onClick={() => setSettingsOpen((open) => !open)}
                  aria-label="Chat settings"
                  className={`p-2 rounded-lg transition-colors ${
                    settingsOpen || activeMode !== 'off'
                      ? 'text-primary bg-primary/10'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                  }`}
                >
                  <Timer className="w-4 h-4" />
                </button>
                {settingsOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setSettingsOpen(false)} />
                    <div className="absolute right-0 top-full mt-1 z-20 w-56 rounded-xl border border-border bg-card py-1 shadow-xl shadow-black/10">
                      <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Delete messages
                      </p>
                      {DISAPPEAR_OPTIONS.map((option) => (
                        <button
                          key={option.key}
                          type="button"
                          disabled={updatingSettings}
                          onClick={() => changeMode(option.key)}
                          className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-left transition hover:bg-accent disabled:opacity-50"
                        >
                          <span>
                            {option.label}
                            {option.hint && (
                              <span className="block text-[10px] text-muted-foreground">{option.hint}</span>
                            )}
                          </span>
                          {activeMode === option.key && <Check className="w-4 h-4 shrink-0 text-primary" />}
                        </button>
                      ))}
                      <p className="px-3 py-2 text-[10px] text-muted-foreground border-t border-border/60 mt-1">
                        Either of you can change this. Every message in the chat follows the new rule; a notice is posted to the chat.
                      </p>
                      <button
                        type="button"
                        onClick={openClear}
                        disabled={updatingSettings}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-destructive transition hover:bg-destructive/10 disabled:opacity-50 border-t border-border/60"
                      >
                        <Trash2 className="w-4 h-4 shrink-0" />
                        Delete entire chat
                      </button>
                    </div>
                  </>
                )}
              </div>
            </header>

            <div ref={messagesRef} className="flex-1 overflow-y-auto px-4 py-4">
              <style>{`@keyframes chatSwoosh { to { transform: translateX(72px) scale(0.85); opacity: 0; filter: blur(4px); } } .chat-swoosh-out { animation: chatSwoosh ${SWOOSH_MS}ms cubic-bezier(0.4, 0, 0.2, 1) forwards; }`}</style>
              {visibleMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center gap-3">
                  <Avatar user={active.peer} size="w-16 h-16" text="text-xl" />
                  <p className="font-semibold">{active.peer.username}</p>
                  <p className="text-sm text-muted-foreground max-w-xs">
                    This is the beginning of your private conversation with {active.peer.username}. Say hi.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {visibleMessages.map((message) => {
                    if (message.type === 'system') {
                      return (
                        <div key={message._id} className="flex justify-center py-1">
                          <span className="max-w-[85%] text-center text-[11px] text-muted-foreground bg-secondary/70 border border-border/50 rounded-full px-3 py-1">
                            {message.text}
                          </span>
                        </div>
                      );
                    }

                    const mine = me ? String(message.sender) === String(me._id) : false;
                    return (
                      <div
                        key={message._id}
                        className={`flex items-end gap-2 ${mine ? 'justify-end' : 'justify-start'}`}
                      >
                        {!mine && <Avatar user={active.peer} size="w-7 h-7" text="text-[10px]" />}
                        <div
                          className={`max-w-[75%] px-3.5 py-2 text-sm leading-relaxed break-words whitespace-pre-wrap ${
                            mine
                              ? 'bg-primary text-primary-foreground rounded-2xl rounded-br-md'
                              : 'bg-secondary text-foreground border border-border/60 rounded-2xl rounded-bl-md'
                          } ${vanishing.has(message._id) ? 'chat-swoosh-out' : ''}`}
                        >
                          {message.text}
                          {message.attachment && (
                            <span className={`block ${message.text ? 'mt-1.5' : ''}`}>
                              {renderAttachment(message)}
                            </span>
                          )}
                          <span
                            className={`mt-1 flex items-center gap-1 text-[10px] ${
                              mine ? 'text-primary-foreground/60' : 'text-muted-foreground'
                            }`}
                          >
                            {message.disappear && message.disappear !== 'off' && (
                              <Timer className="w-3 h-3" />
                            )}
                            {formatTime(message.createdAt)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {error && (
              <div className="mx-4 mb-2 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {error}
              </div>
            )}

            <form onSubmit={handleSend} className="flex flex-col gap-2 border-t border-border p-3">
              {pendingFile && (
                <div className="flex items-center gap-2 self-start max-w-full rounded-xl border border-border bg-secondary/60 px-3 py-2">
                  <Paperclip className="w-4 h-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 truncate text-xs font-medium">{pendingFile.name}</span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">{formatSize(pendingFile.size)}</span>
                  <button
                    type="button"
                    onClick={() => setPendingFile(null)}
                    aria-label="Remove attachment"
                    className="shrink-0 p-0.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              <div className="flex items-end gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files && event.target.files[0];
                    if (file) setPendingFile(file);
                    event.target.value = '';
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current && fileInputRef.current.click()}
                  aria-label="Attach a file"
                  className="shrink-0 w-10 h-10 flex items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition hover:text-foreground hover:border-primary"
                >
                  <Paperclip className="w-4 h-4" />
                </button>
                <textarea
                  ref={textareaRef}
                  rows={1}
                  value={draft}
                  onChange={(event) => {
                    setDraft(event.target.value);
                    growTextarea();
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      handleSend(event);
                    }
                  }}
                  placeholder={`Message ${active.peer.username}...`}
                  className="flex-1 max-h-32 resize-none rounded-2xl border border-border bg-background px-4 py-2.5 text-sm outline-none transition focus:border-primary"
                />
                <button
                  type="submit"
                  disabled={sending || (!draft.trim() && !pendingFile)}
                  aria-label="Send message"
                  className="shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-primary text-primary-foreground transition hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <SendHorizontal className="w-4 h-4" />
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 px-6">
            <MessageCircle className="w-12 h-12 text-muted-foreground opacity-40" />
            <p className="text-sm text-muted-foreground">
              {loading ? 'Loading your conversations...' : 'Select a conversation to start chatting.'}
            </p>
            {!loading && error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        )}
      </section>

      {clearOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={() => setClearOpen(false)}
          >
            <div
              className="w-full max-w-sm rounded-2xl border border-border bg-background shadow-2xl overflow-hidden"
              onClick={(event) => event.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="clear-chat-title"
            >
              <div className="p-5 text-center space-y-3">
                <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 border border-destructive/30 flex items-center justify-center">
                  <Trash2 className="w-6 h-6 text-destructive" />
                </div>
                <h2 id="clear-chat-title" className="text-lg font-bold leading-tight">
                  Delete entire chat?
                </h2>
                <p className="text-sm text-muted-foreground">
                  Every message between you and {active?.peer?.username || 'this contact'} will be
                  removed for both of you. This cannot be undone.
                </p>
              </div>
              <div className="flex gap-2 px-5 pb-5">
                <button
                  type="button"
                  onClick={() => setClearOpen(false)}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-border bg-secondary/60 text-sm font-medium transition hover:bg-accent"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmClearChat}
                  disabled={clearing}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium transition hover:bg-destructive/90 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {clearing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  Delete
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

export default Chat;
