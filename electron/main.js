// Electron main process: boots the embedded Express server on an ephemeral
// localhost port, then points a window at the served frontend dist. The app
// is the server — no terminal, no MongoDB, data lives in the userData folder.

const { app, BrowserWindow, shell, dialog } = require('electron');
const path = require('path');
const { startServer } = require('../backend/server');
const { closeDatabase } = require('../backend/db');
const updater = require('./updater');

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  // A second launch focuses the running window instead of sharing the DB
  // from two processes.
  app.quit();
} else {
  let mainWindow = null;
  let httpServer = null;

  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  // Terminal/system signals (pkill, session logout) must take the graceful
  // path too — Electron does not route SIGTERM through before-quit on its
  // own, which would leave SQLite to recover from the WAL on next boot.
  const gracefulQuit = () => app.quit();
  process.on('SIGINT', gracefulQuit);
  process.on('SIGTERM', gracefulQuit);

  const createWindow = (port) => {
    mainWindow = new BrowserWindow({
      width: 1280,
      height: 800,
      minWidth: 940,
      minHeight: 620,
      show: false,
      autoHideMenuBar: true,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        preload: path.join(__dirname, 'preload.js'),
      },
    });

    mainWindow.once('ready-to-show', () => mainWindow.show());

    // Anything that is not our own server opens in the system browser; our
    // own URLs (the "Go to Art Site" button) open as a real app window.
    const isLocal = (url) => url.startsWith(`http://127.0.0.1:${port}`)
      || url.startsWith(`http://localhost:${port}`);

    const applyWindowPolicies = (contents) => {
      contents.setWindowOpenHandler(({ url }) => {
        if (!isLocal(url)) {
          shell.openExternal(url);
          return { action: 'deny' };
        }
        return {
          action: 'allow',
          overrideBrowserWindowOptions: {
            autoHideMenuBar: true,
            webPreferences: {
              contextIsolation: true,
              nodeIntegration: false,
              sandbox: true,
              preload: path.join(__dirname, 'preload.js'),
            },
          },
        };
      });

      contents.on('will-navigate', (event, url) => {
        if (!isLocal(url)) {
          event.preventDefault();
          shell.openExternal(url);
        }
      });

      // Windows opened by the renderer inherit the same rules, so external
      // links inside them (contact links on the art site) still hand off to
      // the system browser instead of hijacking the window.
      contents.on('did-create-window', (childWindow) => {
        applyWindowPolicies(childWindow.webContents);
      });
    };

    applyWindowPolicies(mainWindow.webContents);

    if (process.argv.includes('--dev')) {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    }

    mainWindow.loadURL(`http://127.0.0.1:${port}/bickle/`);
    updater.init(mainWindow);
    return mainWindow;
  };

  const boot = async () => {
    const userData = app.getPath('userData');
    const { server, port } = await startServer({
      port: 0,
      sqlitePath: path.join(userData, 'bickle.db'),
      uploadDir: path.join(userData, 'uploads'),
      serveDist: true,
      distDir: path.join(__dirname, '..', 'frontend', 'dist'),
    });
    httpServer = server;
    createWindow(port);
  };

  app.whenReady().then(boot).catch((error) => {
    dialog.showErrorBox('Bickle failed to start', error.stack || String(error));
    app.quit();
  });

  // The embedded server lives and dies with the window set — quitting closes
  // the listener and flushes SQLite before the process exits.
  app.on('window-all-closed', () => {
    app.quit();
  });

  app.on('before-quit', () => {
    updater.dispose();
    try {
      if (httpServer) httpServer.close();
    } catch (error) {
      // Already closed.
    }
    try {
      closeDatabase();
    } catch (error) {
      // Never opened or already closed.
    }
  });
}
