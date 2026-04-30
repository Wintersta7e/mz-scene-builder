// ============================================
// Electron Main Process — Orchestrator
//
// Window lifecycle, app-level wiring, log + crash hooks. IPC handlers
// live in `src/main/ipc/` per-domain modules and are registered after
// `app.whenReady()` so they can resolve `app.getPath()` and rely on the
// main window already existing.
// ============================================

const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('node:path');
const { logger, isDev, attachFile: attachLogFile, getLogFilePath } = require('./src/lib/main-logger');
const { setMainWindow } = require('./src/main/state');
const projectIpc = require('./src/main/ipc/project');
const pictureIpc = require('./src/main/ipc/picture');
const exportIpc = require('./src/main/ipc/export');
const sceneIpc = require('./src/main/ipc/scene');
const autosaveIpc = require('./src/main/ipc/autosave');

// Use software rendering to avoid GPU errors on machines whose drivers
// don't play well with Chromium's compositor.
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('use-gl', 'swiftshader');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    show: false, // Don't show until maximized
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      preload: path.join(__dirname, 'preload.js'),
      zoomFactor: 1.0
    },
    title: 'Timeline Scene Builder'
  });

  setMainWindow(mainWindow);

  mainWindow.once('ready-to-show', () => {
    mainWindow.maximize();
    mainWindow.show();
  });

  logger.info('Window created');
  mainWindow.loadFile('src/index.html');

  // Manual zoom (Ctrl+Plus/Minus/0) and DevTools toggle (F12 /
  // Ctrl+Shift+I). The default Electron menu — which would normally
  // carry these accelerators — is suppressed in production, so wire
  // them locally.
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.control) {
      if (input.key === '=' || input.key === '+') {
        mainWindow.webContents.setZoomFactor(mainWindow.webContents.getZoomFactor() + 0.1);
        event.preventDefault();
      } else if (input.key === '-') {
        mainWindow.webContents.setZoomFactor(Math.max(0.5, mainWindow.webContents.getZoomFactor() - 0.1));
        event.preventDefault();
      } else if (input.key === '0') {
        mainWindow.webContents.setZoomFactor(1.0);
        event.preventDefault();
      } else if (input.shift && (input.key === 'I' || input.key === 'i')) {
        toggleDevTools();
        event.preventDefault();
      }
    } else if (input.key === 'F12') {
      toggleDevTools();
      event.preventDefault();
    }
  });

  function toggleDevTools() {
    if (mainWindow.webContents.isDevToolsOpened()) {
      mainWindow.webContents.closeDevTools();
    } else {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
  }

  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(() => {
  // Resolve the persistent log path now that `app.getPath` is available.
  attachLogFile(path.join(app.getPath('logs'), 'main.log'));
  logger.info('App ready', isDev ? '(dev mode)' : '(production mode)');
  logger.info('Log file:', getLogFilePath());
  logger.info('Versions:', {
    app: app.getVersion(),
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
    platform: process.platform,
    arch: process.arch
  });
  Menu.setApplicationMenu(null); // Hide default menu bar
  createWindow();

  // Register IPC handlers after the window exists so handlers that need
  // the window (native dialogs in scene.js) can grab it via state.
  projectIpc.register();
  pictureIpc.register();
  exportIpc.register();
  sceneIpc.register();
  autosaveIpc.register();
});

// Renderer-side log forwarding. The renderer dispatches each log call
// through this IPC channel so main + renderer messages land in the same
// chronological file. The payload is intentionally a plain object: the
// renderer pre-stringifies its arguments to avoid IPC clone failures on
// DOM nodes / functions.
ipcMain.on('log-message', (_event, payload) => {
  if (!payload || typeof payload !== 'object') return;
  const level = String(payload.level || 'info').toLowerCase();
  const args = Array.isArray(payload.args) ? payload.args : [];
  const fn = logger[level] || logger.info;
  fn('[renderer]', ...args);
});

// Crash hooks — make sure unhandled errors land in the file.
process.on('uncaughtException', (err) => {
  logger.error('uncaughtException:', err);
});
process.on('unhandledRejection', (reason) => {
  logger.error('unhandledRejection:', reason);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
