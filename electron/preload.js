// Minimal bridge between the sandboxed renderer and the update logic in the
// main process. Kept to update-related calls only — everything else in the
// app talks to the embedded Express server over HTTP.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('bickleApp', {
  getVersion: () => ipcRenderer.invoke('app:get-version'),
  getUpdateState: () => ipcRenderer.invoke('app:get-update-state'),
  checkForUpdates: () => ipcRenderer.invoke('app:check-updates'),
  installUpdate: () => ipcRenderer.invoke('app:install-update'),
  openReleases: () => ipcRenderer.invoke('app:open-releases'),
  onUpdateState: (callback) => {
    const handler = (_event, nextState) => callback(nextState);
    ipcRenderer.on('app:update-state', handler);
    return () => ipcRenderer.removeListener('app:update-state', handler);
  },
});
