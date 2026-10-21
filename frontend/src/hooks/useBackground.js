import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'bickle-background';
const CHANGE_EVENT = 'bickle-background-change';

export const DEFAULT_BACKGROUND_SETTINGS = {
  type: 'none', // 'none' | 'preset' | 'custom'
  presetId: null,
  customImage: null, // data URL
  accentAuto: true,
  accentHex: null, // resolved accent while accentAuto is on
  manualAccent: null, // hex chosen while accentAuto is off
  scrimOpacity: 0.4,
};

export const loadBackgroundSettings = () => {
  if (typeof window === 'undefined') return { ...DEFAULT_BACKGROUND_SETTINGS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_BACKGROUND_SETTINGS };
    return { ...DEFAULT_BACKGROUND_SETTINGS, ...JSON.parse(raw) };
  } catch (error) {
    return { ...DEFAULT_BACKGROUND_SETTINGS };
  }
};

const persist = (settings) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    // Storage may be unavailable or full; the in-memory event still updates the UI.
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: settings }));
};

export const saveBackgroundSettings = (patch) => {
  persist({ ...loadBackgroundSettings(), ...patch });
};

export const useBackground = () => {
  const [settings, setSettings] = useState(loadBackgroundSettings);

  useEffect(() => {
    const onChange = (event) => setSettings(event.detail || loadBackgroundSettings());
    const onStorage = (event) => {
      if (event.key === STORAGE_KEY) setSettings(loadBackgroundSettings());
    };
    window.addEventListener(CHANGE_EVENT, onChange);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(CHANGE_EVENT, onChange);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const updateSetting = useCallback((patch) => {
    persist({ ...loadBackgroundSettings(), ...patch });
  }, []);

  const resetSettings = useCallback(() => {
    persist({ ...DEFAULT_BACKGROUND_SETTINGS });
  }, []);

  return [settings, updateSetting, resetSettings];
};
