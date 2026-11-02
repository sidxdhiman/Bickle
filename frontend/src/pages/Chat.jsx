import React, { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Loader2, MessageCircle, SendHorizontal } from 'lucide-react';
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

  const activeIdRef = useRef(null);
  const messagesRef = useRef(null);
  const textareaRef = useRef(null);

  const active = conversations.find((c) => c._id === activeId) || null;

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

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

  // Thread: full load on open, then poll with an `after` cursor for new
  // messages while this conversation is on screen.
  useEffect(() => {
    setMessages([]);
    setDraft('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    if (!activeId) return undefined;
    let cancelled = false;
    let cursor = null;

    const load = async () => {
      try {
        const query = cursor ? `?after=${encodeURIComponent(cursor)}` : '';
        const res = await axios.get(`/chat/${activeId}/messages${query}`);
        if (cancelled) return;
        setMessages((prev) => {
          const merged = [...prev];
          for (const message of res.data) {
            const index = merged.findIndex((existing) => existing._id === message._id);
            if (index === -1) merged.push(message);
            else merged[index] = message;
          }
          merged.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
          return merged;
        });
        if (res.data.length > 0) {
          cursor = res.data[res.data.length - 1].createdAt;
        }
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
    };
  }, [activeId]);

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
    if (!text || !activeId || sending) return;

    setSending(true);
    try {
      const res = await axios.post(`/chat/${activeId}/messages`, { text });
      setMessages((prev) =>
        prev.some((m) => m._id === res.data._id) ? prev : [...prev, res.data]
      );
      setDraft('');
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
      setConversations((prev) =>
        prev.map((c) =>
          c._id === activeId
            ? {
                ...c,
                lastMessage: { text: res.data.text, sender: res.data.sender, at: res.data.createdAt },
                updatedAt: res.data.createdAt,
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

  const selectConversation = (id) => setActiveId(id);

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
                <p className="text-[11px] text-muted-foreground">Private conversation</p>
              </div>
            </header>

            <div ref={messagesRef} className="flex-1 overflow-y-auto px-4 py-4">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center gap-3">
                  <Avatar user={active.peer} size="w-16 h-16" text="text-xl" />
                  <p className="font-semibold">{active.peer.username}</p>
                  <p className="text-sm text-muted-foreground max-w-xs">
                    This is the beginning of your private conversation with {active.peer.username}. Say hi.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {messages.map((message) => {
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
                          }`}
                        >
                          {message.text}
                          <span
                            className={`mt-1 block text-[10px] ${
                              mine ? 'text-primary-foreground/60' : 'text-muted-foreground'
                            }`}
                          >
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

            <form onSubmit={handleSend} className="flex items-end gap-2 border-t border-border p-3">
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
                disabled={sending || !draft.trim()}
                aria-label="Send message"
                className="shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-primary text-primary-foreground transition hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <SendHorizontal className="w-4 h-4" />
              </button>
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
    </div>
  );
};

export default Chat;
