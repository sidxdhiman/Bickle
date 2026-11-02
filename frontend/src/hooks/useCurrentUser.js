import { useEffect, useState } from 'react';
import axios from 'axios';
import { useAccess } from '../context/AccessContext';

// Shared, always-fresh view of the signed-in profile so the top bar, profile
// modal and chat all agree on the same name/avatar.
let cached = null;
const listeners = new Set();

const publish = (user) => listeners.forEach((listener) => listener(user));

export const refreshUser = async () => {
  try {
    const res = await axios.get('/auth/me');
    if (res.data && !res.data.isGuest) {
      cached = res.data;
      publish(cached);
      return cached;
    }
  } catch (error) {
    // Not signed in / guest — leave the cache untouched.
  }
  return cached;
};

export const useCurrentUser = () => {
  const { isGuest } = useAccess();
  const [user, setUser] = useState(cached);

  useEffect(() => {
    if (isGuest) return undefined;
    const listener = (next) => setUser(next);
    listeners.add(listener);
    refreshUser();
    return () => listeners.delete(listener);
  }, [isGuest]);

  return isGuest ? null : user;
};

export default useCurrentUser;
