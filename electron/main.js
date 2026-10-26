// Gully Foam War desktop app (Electron main process)
const { app, BrowserWindow, ipcMain, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');

if (!app.requestSingleInstanceLock()) { app.quit(); }
// If a PC's GPU is blocked or missing, fall back to software WebGL instead of failing to start.
app.commandLine.appendSwitch('enable-unsafe-swiftshader');
app.commandLine.appendSwitch('ignore-gpu-blocklist');

let win = null;
const statePath = () => path.join(app.getPath('userData'), 'window.json');
function loadState() { try { return JSON.parse(fs.readFileSync(statePath(), 'utf8')); } catch (e) { return {}; } }
function saveState(s) { try { fs.writeFileSync(statePath(), JSON.stringify(s)); } catch (e) { /* not fatal */ } }

function notifyFullscreen() { if (win && !win.isDestroyed()) win.webContents.send('fullscreen', win.isFullScreen()); }

function createWindow() {
  const st = loadState();
  win = new BrowserWindow({
    width: st.w || 1280, height: st.h || 720, minWidth: 960, minHeight: 540,
    fullscreen: !!st.fullscreen, show: false, backgroundColor: '#141c12',
    title: 'Gully Foam War', autoHideMenuBar: true,
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false, sandbox: true,
      backgroundThrottling: false
    }
  });
  Menu.setApplicationMenu(null);
  win.loadFile(path.join(__dirname, '..', 'index.html'));
  win.once('ready-to-show', () => win.show());
  win.webContents.on('did-finish-load', notifyFullscreen);

  win.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11' || (input.alt && input.key === 'Enter')) { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
    if (input.control && input.shift && input.key.toLowerCase() === 'i') { win.webContents.toggleDevTools(); e.preventDefault(); }
  });
  win.on('enter-full-screen', notifyFullscreen);
  win.on('leave-full-screen', notifyFullscreen);
  win.on('close', () => { const b = win.getNormalBounds(); saveState({ w: b.width, h: b.height, fullscreen: win.isFullScreen() }); });

  // Links open in the real browser; the game window never navigates away.
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('file:')) e.preventDefault(); });
}

ipcMain.on('quit', () => app.quit());
ipcMain.on('set-fullscreen', (e, v) => { if (win) win.setFullScreen(!!v); });

app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
