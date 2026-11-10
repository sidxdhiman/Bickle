import { useEffect, useState } from 'react';
import axios from 'axios';
import { useAccess } from '../context/AccessContext';

// One shared poller for chat unread counts, no matter how many components
// (top nav bell, dock tile, sidebar row, arrival toast) display them.
let count = 0;
let latest = null;
let timer = null;
let arrivalSeq = 0;
const listeners = new Set();
const arrivalListeners = new Set();

const publish = () => listeners.forEach((listener) => listener());

const poll = async () => {
  try {
    const res = await axios.get('/chat/unread-count');
    const next = typeof res.data?.count === 'number' ? res.data.count : 0;
    const rose = next > count;
    latest = res.data.latest || null;
    if (rose && res.data.latest) {
      // Edge-triggered: only a rising count emits an arrival, so a steady
      // unread state never re-pops the toast.
      arrivalSeq += 1;
      const arrival = { ...res.data.latest, seq: arrivalSeq };
      arrivalListeners.forEach((listener) => listener(arrival));
    }
    if (next !== count) {
      count = next;
      publish();
    }
  } catch (error) {
    // Guests and signed-out browsers simply have no unread chat.
    latest = null;
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
  }, 4000);
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

// Subscribe to "the other profile just messaged me" events (toast popup).
// Returns an unsubscribe function.
export const onChatArrival = (listener) => {
  arrivalListeners.add(listener);
  return () => arrivalListeners.delete(listener);
};

// Latest unread message (sender + preview) from the last poll — the
// notification bell shows it under the chat row.
export const getChatLatest = () => latest;

export default useChatUnread;
