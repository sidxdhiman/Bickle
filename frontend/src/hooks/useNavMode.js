import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'bickle-nav-mode';
const CHANGE_EVENT = 'bickle-nav-mode-change';

export const useNavMode = () => {
  const [mode, setMode] = useState(() => {
    if (typeof window === 'undefined') return 'dock';
    return localStorage.getItem(STORAGE_KEY) === 'sidebar' ? 'sidebar' : 'dock';
  });

  useEffect(() => {
    const onChange = (event) => setMode(event.detail === 'sidebar' ? 'sidebar' : 'dock');
    const onStorage = (event) => {
      if (event.key === STORAGE_KEY) setMode(event.newValue === 'sidebar' ? 'sidebar' : 'dock');
    };
    window.addEventListener(CHANGE_EVENT, onChange);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(CHANGE_EVENT, onChange);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const setNavMode = useCallback((next) => {
    const value = next === 'sidebar' ? 'sidebar' : 'dock';
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch (error) {
      // Storage may be unavailable; the event still updates the UI.
    }
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: value }));
  }, []);

  return [mode, setNavMode];
};
