import { useEffect, useState } from 'react';

// window.bickleApp is injected by the Electron preload — it is absent when
// the frontend runs in a plain browser (vite dev, hosted builds).
export const getDesktopApi = () =>
  typeof window !== 'undefined' && window.bickleApp ? window.bickleApp : null;

export const useAppUpdate = () => {
  const [state, setState] = useState({
    phase: 'idle',
    version: null,
    canInstall: false,
    percent: null,
    error: null,
  });
  const [currentVersion, setCurrentVersion] = useState('');

  useEffect(() => {
    const api = getDesktopApi();
    if (!api) return undefined;
    let alive = true;
    api
      .getUpdateState()
      .then((next) => {
        if (alive && next) setState(next);
      })
      .catch(() => {});
    api
      .getVersion()
      .then((version) => {
        if (alive && version) setCurrentVersion(version);
      })
      .catch(() => {});
    const off = api.onUpdateState((next) => {
      if (alive && next) setState(next);
    });
    return () => {
      alive = false;
      if (typeof off === 'function') off();
    };
  }, []);

  return {
    ...state,
    currentVersion,
    supported: !!getDesktopApi(),
  };
};

export const updateStatusText = ({ phase, version, percent, error }) => {
  switch (phase) {
    case 'checking':
      return 'Checking for updates…';
    case 'uptodate':
      return 'You’re up to date.';
    case 'available':
      return version ? `Bickle ${version} is available.` : 'A new version is available.';
    case 'downloading':
      return `Downloading update…${percent != null ? ` ${percent}%` : ''}`;
    case 'ready':
      return version ? `Bickle ${version} has been downloaded — restart to finish.` : 'Update downloaded — restart to finish.';
    case 'error':
      return error ? `Update check failed: ${error}` : 'Couldn’t check for updates.';
    default:
      return 'Bickle checks for updates automatically when it starts.';
  }
};

export default useAppUpdate;
