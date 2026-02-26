// ============================================
// Preload Script - IPC Bridge
// ============================================
// With contextIsolation: true, we use contextBridge
// to safely expose APIs to the renderer.

const { contextBridge, ipcRenderer, shell } = require('electron');

// Whitelist of allowed IPC channels
const ALLOWED_CHANNELS = [
  'open-project',
  'set-project-path',
  'get-screen-resolution',
  'get-pictures-folders',
  'get-folder-contents',
  'get-thumbnail',
  'get-image-path',
  'export-to-map',
  'get-maps',
  'get-map-events',
  'save-scene',
  'load-scene',
  'autosave-write',
  'autosave-read',
  'autosave-delete',
  'autosave-exists'
];

// Check if dev mode
const isDev = process.argv.includes('--dev');

// Expose APIs to renderer via contextBridge
contextBridge.exposeInMainWorld('api', {
  isDev,
  // IPC invoke with channel validation
  invoke: (channel, ...args) => {
    if (ALLOWED_CHANNELS.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args);
    }
    return Promise.reject(new Error(`IPC channel "${channel}" is not allowed`));
  },

  // Shell operations (limited)
  openExternal: (url) => {
    // Only allow specific URLs
    const allowedHosts = ['github.com'];
    try {
      const urlObj = new URL(url);
      if (allowedHosts.some((host) => urlObj.hostname.endsWith(host))) {
        return shell.openExternal(url);
      }
    } catch {
      // Invalid URL
    }
    console.warn('Blocked attempt to open URL:', url);
    return Promise.resolve();
  }
});
