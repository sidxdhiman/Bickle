import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'bickle-workflows';
const CHANGE_EVENT = 'bickle-workflows-change';

export const makeId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

export const FOLDER_COLORS = ['#8b5cf6', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

const createDefaultState = () => {
  const personal = { id: makeId(), name: 'Personal', color: '#8b5cf6' };
  const office = { id: makeId(), name: 'Office', color: '#0ea5e9' };
  return { folders: [personal, office], workflows: [], runs: [], selectedFolderId: personal.id };
};

const loadState = () => {
  const fallback = createDefaultState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    const folders =
      Array.isArray(parsed.folders) && parsed.folders.length
        ? parsed.folders
        : fallback.folders;
    const selectedFolderId = folders.some((f) => f.id === parsed.selectedFolderId)
      ? parsed.selectedFolderId
      : folders[0].id;
    return {
      folders,
      workflows: Array.isArray(parsed.workflows) ? parsed.workflows : [],
      runs: Array.isArray(parsed.runs) ? parsed.runs : [],
      selectedFolderId,
    };
  } catch (error) {
    return fallback;
  }
};

const persist = (state) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    // Storage may be full or unavailable; UI still works in memory.
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: state }));
};

export const useWorkflows = () => {
  const [state, setState] = useState(loadState);

  useEffect(() => {
    const onChange = (event) => setState(event.detail);
    const onStorage = (event) => {
      if (event.key === STORAGE_KEY) setState(loadState());
    };
    window.addEventListener(CHANGE_EVENT, onChange);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(CHANGE_EVENT, onChange);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const update = useCallback((mutator) => {
    setState((prev) => {
      const next = mutator(prev) || prev;
      persist(next);
      return next;
    });
  }, []);

  return [state, update];
};
