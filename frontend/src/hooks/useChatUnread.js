import { useEffect, useState } from 'react';
import axios from 'axios';
import { useAccess } from '../context/AccessContext';

// One shared poller for chat unread counts, no matter how many components
// (top nav bell, dock tile, sidebar row) display the badge.
let count = 0;
let timer = null;
const listeners = new Set();

const publish = () => listeners.forEach((listener) => listener());

const poll = async () => {
  try {
    const res = await axios.get('/chat/unread-count');
    const next = typeof res.data?.count === 'number' ? res.data.count : 0;
    if (next !== count) {
      count = next;
      publish();
    }
  } catch (error) {
    // Guests and signed-out browsers simply have no unread chat.
    if (count !== 0) {
      count = 0;
      publish();
    }
  }
};

const ensurePolling = () => {
  poll();
  if (timer) return;
  timer = setInterval(() => {
    if (document.visibilityState === 'visible') poll();
  }, 10000);
};

export const useChatUnread = () => {
  const { isGuest } = useAccess();
  const [, force] = useState(0);

  useEffect(() => {
    if (isGuest) return undefined;
    const listener = () => force((value) => value + 1);
    listeners.add(listener);
    ensurePolling();
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0 && timer) {
        clearInterval(timer);
        timer = null;
      }
    };
  }, [isGuest]);

  return isGuest ? 0 : count;
};

export default useChatUnread;
