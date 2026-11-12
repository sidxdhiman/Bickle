// Self-update for the desktop app. AppImage and Windows builds download and
// install updates themselves through electron-updater against the GitHub
// releases feed; builds that cannot install themselves (e.g. the deb, which
// needs apt/root) check the releases API and hand the user a download link.

const { app, ipcMain, shell } = require('electron');

const OWNER = 'sidxdhiman';
const REPO = 'Bickle';
const RELEASES_API = `https://api.github.com/repos/${OWNER}/${REPO}/releases/latest`;
const RELEASES_URL = `https://github.com/${OWNER}/${REPO}/releases/latest`;
const STARTUP_CHECK_DELAY_MS = 12000;

let targetWindow = null;
let autoUpdater = null;
let checking = false;
let startupTimer = 0;

const state = {
  phase: 'idle', // idle | checking | uptodate | available | downloading | ready | error
  version: null, // latest version found (when available/downloading/ready)
  canInstall: false, // true when this build can install the update itself
  percent: null, // download progress when downloading
  error: null,
};

// AppImage sets $APPIMAGE at runtime; Windows/macOS installers are always
// self-updatable. Anything else (deb, plain folder) can only notify.
const supportsSelfInstall = () =>
  process.platform === 'win32' || process.platform === 'darwin' || !!process.env.APPIMAGE;

const publish = (patch) => {
  Object.assign(state, patch);
  if (targetWindow && !targetWindow.isDestroyed() && !targetWindow.webContents.isDestroyed()) {
    targetWindow.webContents.send('app:update-state', { ...state });
  }
};

const newerThanCurrent = (version) => {
  const current = app.getVersion().split('.').map((n) => parseInt(n, 10) || 0);
  const next = String(version).split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(current.length, next.length); i += 1) {
    const a = next[i] || 0;
    const b = current[i] || 0;
    if (a !== b) return a > b;
  }
  return false;
};

const latestFromGitHub = async () => {
  const response = await fetch(RELEASES_API, {
    headers: { Accept: 'application/vnd.github+json' },
  });
  if (!response.ok) throw new Error(`Release check failed (HTTP ${response.status})`);
  const release = await response.json();
  const version = String(release.tag_name || '').replace(/^v/, '');
  return /^\d+\.\d+\.\d+/.test(version) ? version : null;
};

const wireAutoUpdater = () => {
  autoUpdater.autoDownload = true;
  autoUpdater.on('checking-for-update', () => publish({ phase: 'checking', error: null }));
  autoUpdater.on('update-available', (info) =>
    publish({ phase: 'available', version: info.version, canInstall: true, error: null })
  );
  autoUpdater.on('update-not-available', () => publish({ phase: 'uptodate', error: null }));
  autoUpdater.on('download-progress', (progress) =>
    publish({ phase: 'downloading', percent: Math.round(progress.percent) })
  );
  autoUpdater.on('update-downloaded', (info) =>
    publish({ phase: 'ready', version: info.version, canInstall: true, percent: null, error: null })
  );
  autoUpdater.on('error', (error) => {
    // A failed background check should not interrupt the user — the state
    // only surfaces in Settings and in the (non-error) update banner.
    publish({ phase: 'error', error: (error && error.message) || String(error) });
  });
};

const check = async () => {
  if (checking) return { ...state };
  checking = true;
  publish({ phase: 'checking', error: null });
  try {
    if (supportsSelfInstall() && autoUpdater) {
      // State updates arrive through the autoUpdater events above.
      await autoUpdater.checkForUpdates();
    } else {
      const latest = await latestFromGitHub();
      if (latest && newerThanCurrent(latest)) {
        publish({ phase: 'available', version: latest, canInstall: false });
      } else {
        publish({ phase: 'uptodate' });
      }
    }
  } catch (error) {
    publish({ phase: 'error', error: (error && error.message) || String(error) });
  } finally {
    checking = false;
  }
  return { ...state };
};

const install = async () => {
  if (state.phase === 'ready' && autoUpdater) {
    try {
      // Replaces the running AppImage / runs the NSIS installer, then relaunches.
      autoUpdater.quitAndInstall();
      return;
    } catch (error) {
      // Fall through to the manual path below.
    }
  }
  await shell.openExternal(RELEASES_URL);
};

ipcMain.handle('app:get-version', () => app.getVersion());
ipcMain.handle('app:get-update-state', () => ({ ...state }));
ipcMain.handle('app:check-updates', () => check());
ipcMain.handle('app:install-update', () => install());
ipcMain.handle('app:open-releases', () => shell.openExternal(RELEASES_URL));

const init = (win) => {
  targetWindow = win;
  // Dev runs from source with no packaged feed — only update installed apps.
  if (!app.isPackaged) return;
  if (supportsSelfInstall()) {
    try {
      autoUpdater = require('electron-updater').autoUpdater;
      wireAutoUpdater();
    } catch (error) {
      autoUpdater = null;
    }
  }
  // Give the window (and the startup splash) room to breathe first.
  startupTimer = setTimeout(() => {
    check().catch(() => {});
  }, STARTUP_CHECK_DELAY_MS);
};

const dispose = () => {
  clearTimeout(startupTimer);
  targetWindow = null;
};

module.exports = { init, dispose, check };
