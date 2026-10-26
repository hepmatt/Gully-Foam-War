// Exposes a tiny, safe API to the game page. The page detects the desktop build through window.GullyApp.
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('GullyApp', {
  quit: () => ipcRenderer.send('quit'),
  setFullscreen: (v) => ipcRenderer.send('set-fullscreen', !!v),
  onFullscreen: (cb) => ipcRenderer.on('fullscreen', (e, v) => cb(!!v)),
  platform: process.platform
});
