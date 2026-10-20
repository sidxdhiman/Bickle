import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'bickle-dock-settings';
const CHANGE_EVENT = 'bickle-dock-settings-change';

export const DEFAULT_DOCK_SETTINGS = {
  position: 'bottom',
  size: 44,
  magnification: 160,
  magnificationEnabled: true,
  color: 'auto',
  opacity: 0.85,
  showLabels: true,
};

export const loadDockSettings = () => {
  if (typeof window === 'undefined') return { ...DEFAULT_DOCK_SETTINGS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_DOCK_SETTINGS };
    return { ...DEFAULT_DOCK_SETTINGS, ...JSON.parse(raw) };
  } catch (error) {
    return { ...DEFAULT_DOCK_SETTINGS };
  }
};

const persist = (settings) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    // Storage may be unavailable; the in-memory event still updates the UI.
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: settings }));
};

export const useDockSettings = () => {
  const [settings, setSettings] = useState(loadDockSettings);

  useEffect(() => {
    const onChange = (event) => setSettings(event.detail || loadDockSettings());
    const onStorage = (event) => {
      if (event.key === STORAGE_KEY) setSettings(loadDockSettings());
    };
    window.addEventListener(CHANGE_EVENT, onChange);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(CHANGE_EVENT, onChange);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const updateSetting = useCallback((patch) => {
    persist({ ...loadDockSettings(), ...patch });
  }, []);

  const resetSettings = useCallback(() => {
    persist({ ...DEFAULT_DOCK_SETTINGS });
  }, []);

  return [settings, updateSetting, resetSettings];
};
