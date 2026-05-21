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
      const win = getMainWindow();
      const opts = {
        title: 'Save Scene',
        defaultPath: projectPath ? path.join(projectPath, 'scenes') : undefined,
        filters: [{ name: 'Scene Files', extensions: ['mzscene'] }]
      };
      const result = win ? await dialog.showSaveDialog(win, opts) : await dialog.showSaveDialog(opts);

      if (!result.canceled && result.filePath) {
        await fsPromises.writeFile(result.filePath, JSON.stringify(sceneData, null, 2));
        logger.info('Scene saved:', result.filePath);
        return result.filePath;
      }
      return null;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.error('Failed to save scene:', msg);
      return { error: msg };
    }
  });

  ipcMain.handle('load-scene', async () => {
    try {
      const win = getMainWindow();
      const opts = {
        title: 'Load Scene',
        filters: [{ name: 'Scene Files', extensions: ['mzscene'] }],
        properties: /** @type {Array<'openFile'>} */ (['openFile'])
      };
      const result = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts);

      if (!result.canceled && result.filePaths.length > 0) {
        const filePath = result.filePaths[0];
        const data = await fsPromises.readFile(filePath, 'utf-8');
        logger.info('Scene loaded:', filePath);
        return { data: JSON.parse(data), filePath };
      }
      return null;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.error('Failed to load scene:', msg);
      return { error: msg };
    }
  });
}

module.exports = { register };
