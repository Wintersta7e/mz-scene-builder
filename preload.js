// ============================================
// Preload Script - IPC Bridge
// ============================================
// With contextIsolation: false, we attach directly to window
// instead of using contextBridge.

const { ipcRenderer, shell } = require('electron');

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

// Expose APIs to renderer via window object
window.api = {
  isDev,
  // IPC invoke with channel validation
  invoke: (channel, ...args) => {
    if (ALLOWED_CHANNELS.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args);
    }
    throw new Error(`IPC channel "${channel}" is not allowed`);
  },

  // Shell operations (limited)
  openExternal: (url) => {
    // Only allow specific URLs
    const allowedHosts = ['itch.io', 'github.com'];
    try {
      const urlObj = new URL(url);
      if (allowedHosts.some(host => urlObj.hostname.endsWith(host))) {
        return shell.openExternal(url);
      }
    } catch (e) {
      // Invalid URL
    }
    console.warn('Blocked attempt to open URL:', url);
    return Promise.resolve();
  }
};
