// ============================================
// Main Process Shared State
//
// Mutable state shared between main.js and the IPC handler modules in
// `src/main/ipc/`. Kept tiny and explicit — only the values that more
// than one module needs to read or write live here.
// ============================================

let projectPath = null;
let mainWindow = null;

module.exports = {
  getProjectPath: () => projectPath,
  setProjectPath: (p) => {
    projectPath = p;
  },
  getMainWindow: () => mainWindow,
  setMainWindow: (w) => {
    mainWindow = w;
  }
};
