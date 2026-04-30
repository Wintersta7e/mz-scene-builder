// ============================================
// IPC: save / load .mzscene files via native dialogs
// ============================================

const { ipcMain, dialog } = require('electron');
const path = require('node:path');
const fsPromises = require('node:fs').promises;

const { logger } = require('../../lib/main-logger');
const { getProjectPath, getMainWindow } = require('../state');

function register() {
  ipcMain.handle('save-scene', async (_event, sceneData) => {
    try {
      const projectPath = getProjectPath();
      const result = await dialog.showSaveDialog(getMainWindow(), {
        title: 'Save Scene',
        defaultPath: projectPath ? path.join(projectPath, 'scenes') : undefined,
        filters: [{ name: 'Scene Files', extensions: ['mzscene'] }]
      });

      if (!result.canceled && result.filePath) {
        await fsPromises.writeFile(result.filePath, JSON.stringify(sceneData, null, 2));
        logger.info('Scene saved:', result.filePath);
        return result.filePath;
      }
      return null;
    } catch (e) {
      logger.error('Failed to save scene:', e.message);
      return { error: e.message };
    }
  });

  ipcMain.handle('load-scene', async () => {
    try {
      const result = await dialog.showOpenDialog(getMainWindow(), {
        title: 'Load Scene',
        filters: [{ name: 'Scene Files', extensions: ['mzscene'] }],
        properties: ['openFile']
      });

      if (!result.canceled && result.filePaths.length > 0) {
        const data = await fsPromises.readFile(result.filePaths[0], 'utf-8');
        logger.info('Scene loaded:', result.filePaths[0]);
        return JSON.parse(data);
      }
      return null;
    } catch (e) {
      logger.error('Failed to load scene:', e.message);
      return { error: e.message };
    }
  });
}

module.exports = { register };
