// ============================================
// Main Process Utilities
// ============================================

const path = require('node:path');
const fsPromises = require('node:fs').promises;
const { getProjectPath } = require('./state');

/** @param {string} p */
async function pathExists(p) {
  try {
    await fsPromises.access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolve the current project path or build the standard `{ error }`
 * response IPC handlers send to the renderer when no project is loaded.
 *
 * @returns {{ projectPath: string; error: null } | { projectPath: null; error: string }}
 */
function requireProject() {
  const projectPath = getProjectPath();
  if (!projectPath) return { projectPath: null, error: 'No project loaded' };
  return { projectPath, error: null };
}

/**
 * Path to a project's Map###.json data file (zero-padded to 3 digits).
 *
 * @param {string} projectPath
 * @param {number} mapId
 */
function mapFilePath(projectPath, mapId) {
  return path.join(projectPath, 'data', `Map${String(mapId).padStart(3, '0')}.json`);
}

module.exports = { pathExists, requireProject, mapFilePath };
