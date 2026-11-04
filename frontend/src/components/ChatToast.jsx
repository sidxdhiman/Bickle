import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { onChatArrival } from '../hooks/useChatUnread';

const VISIBLE_MS = 5000;

const GRADIENTS = [
  'from-indigo-500 to-sky-400',
  'from-pink-500 to-rose-400',
  'from-amber-400 to-orange-500',
  'from-emerald-400 to-teal-500',
  'from-violet-500 to-fuchsia-400',
];

const gradientFor = (name = '') =>
  GRADIENTS[[...name].reduce((sum, char) => sum + char.charCodeAt(0), 0) % GRADIENTS.length];

// Small in-app popup: whenever the other profile messages and this page is
// NOT the chat, surface the sender + preview; clicking jumps into the thread.
const ChatToast = () => {
  const [arrival, setArrival] = useState(null);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const timeoutRef = useRef(null);
  const onChatPageRef = useRef(false);

  onChatPageRef.current = pathname === '/chat';

  useEffect(() => {
    const unsubscribe = onChatArrival((event) => {
      if (onChatPageRef.current) return;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setArrival(event);
      timeoutRef.current = setTimeout(() => setArrival(null), VISIBLE_MS);
    });
    return () => {
      unsubscribe();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  // Opening the chat dismisses any pending popup immediately.
  useEffect(() => {
    if (pathname === '/chat' && arrival) setArrival(null);
  }, [pathname, arrival]);

  if (!arrival) return null;

  return (
    <button
      type="button"
      onClick={() => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setArrival(null);
        navigate('/chat');
      }}
      className="fixed right-4 top-20 z-[80] w-72 max-w-[calc(100vw-2rem)] flex items-start gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-left shadow-xl shadow-black/15 transition hover:bg-accent"
      style={{ animation: 'chatToastIn 0.2s ease-out' }}
    >
      <span
        className={`shrink-0 w-9 h-9 rounded-full bg-gradient-to-br ${gradientFor(arrival.sender)} p-[2px] flex items-center justify-center`}
      >
        <span className="w-full h-full rounded-full bg-background flex items-center justify-center text-sm font-bold">
          {(arrival.sender || '?').slice(0, 1).toUpperCase()}
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <MessageCircle className="w-3.5 h-3.5 text-primary shrink-0" />
          <span className="text-sm font-semibold truncate">{arrival.sender}</span>
          <span className="ml-auto text-[10px] text-muted-foreground shrink-0">now</span>
        </span>
        <span className="mt-0.5 block text-xs text-muted-foreground line-clamp-2 break-words">
          {arrival.preview}
        </span>
      </span>
      <style>{`@keyframes chatToastIn { from { opacity: 0; transform: translateY(-8px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }`}</style>
    </button>
  );
};

export default ChatToast;
