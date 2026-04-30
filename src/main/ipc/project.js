// ============================================
// IPC: project lifecycle + screen resolution
// ============================================

const { ipcMain, dialog } = require('electron');
const path = require('node:path');
const fsPromises = require('node:fs').promises;

const { logger } = require('../../lib/main-logger');
const { getProjectPath, setProjectPath, getMainWindow } = require('../state');
const { pathExists } = require('../util');

function register() {
  // Open project folder via native picker. Returns { path } on success or
  // { error } when validation fails. Setting the path is the renderer's
  // job — see `set-project-path` below.
  ipcMain.handle('open-project', async () => {
    const result = await dialog.showOpenDialog(getMainWindow(), {
      properties: ['openDirectory'],
      title: 'Select RPG Maker MZ Project Folder'
    });

    if (!result.canceled && result.filePaths.length > 0) {
      const candidate = result.filePaths[0];

      const gameFile = path.join(candidate, 'game.rmmzproject');
      if (!(await pathExists(gameFile))) {
        logger.warn('Invalid MZ project folder (game.rmmzproject not found):', candidate);
        return { error: 'Not a valid RPG Maker MZ project folder (game.rmmzproject not found)' };
      }

      setProjectPath(candidate);
      logger.info('Project opened:', candidate);
      return { path: candidate };
    }
    return null;
  });

  // Set project path directly (used when re-opening from the recent list).
  ipcMain.handle('set-project-path', async (_event, projPath) => {
    if (!projPath || typeof projPath !== 'string' || !path.isAbsolute(projPath) || projPath.includes('\0')) {
      return { error: 'Invalid project path' };
    }

    const gameFile = path.join(projPath, 'game.rmmzproject');
    if (!(await pathExists(gameFile))) {
      logger.warn('set-project-path: invalid MZ project folder:', projPath);
      return { error: 'Not a valid RPG Maker MZ project folder' };
    }

    setProjectPath(projPath);
    logger.info('Project path set:', projPath);
    return { success: true, path: projPath };
  });

  // Read the screen resolution recorded in the project's System.json. Falls
  // back to the RPG Maker MZ defaults (816x624) if the file is missing or
  // unparseable.
  ipcMain.handle('get-screen-resolution', async () => {
    const projectPath = getProjectPath();
    if (!projectPath) return { width: 816, height: 624 };

    const systemPath = path.join(projectPath, 'data', 'System.json');
    if (!(await pathExists(systemPath))) {
      return { width: 816, height: 624 };
    }

    try {
      const data = JSON.parse(await fsPromises.readFile(systemPath, 'utf8'));
      const width = data.advanced?.screenWidth ?? 816;
      const height = data.advanced?.screenHeight ?? 624;
      logger.debug('Screen resolution:', width, 'x', height);
      return { width, height };
    } catch (e) {
      logger.warn('Failed to read System.json, using defaults:', e.message);
      return { width: 816, height: 624 };
    }
  });
}

module.exports = { register };
