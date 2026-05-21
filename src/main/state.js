// ============================================
// Main Process Shared State
//
// Mutable state shared between main.js and the IPC handler modules in
// `src/main/ipc/`. Kept tiny and explicit — only the values that more
// than one module needs to read or write live here.
// ============================================

/** @type {string | null} */
let projectPath = null;
/** @type {import('electron').BrowserWindow | null} */
let mainWindow = null;

module.exports = {
  getProjectPath: () => projectPath,
  /** @param {string | null} p */
  setProjectPath: (p) => {
    projectPath = p;
  },
  getMainWindow: () => mainWindow,
  /** @param {import('electron').BrowserWindow | null} w */
  setMainWindow: (w) => {
    mainWindow = w;
  }
};
