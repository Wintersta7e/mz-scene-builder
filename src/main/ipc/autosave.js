// ============================================
// IPC: autosave write / read / delete / exists
//
// Stores a single autosave snapshot under the OS temp dir. The renderer
// writes every 3 minutes (via the autosave module) and reads at startup
// to offer recovery.
// ============================================

const { ipcMain } = require('electron');
const os = require('node:os');
const path = require('node:path');
const fsPromises = require('node:fs').promises;

const { logger } = require('../../lib/main-logger');
const { pathExists } = require('../util');

const AUTOSAVE_PATH = path.join(os.tmpdir(), 'timeline-scene-builder', 'autosave.mzscene');

async function ensureAutosaveDir() {
  const dir = path.dirname(AUTOSAVE_PATH);
  if (!(await pathExists(dir))) {
    await fsPromises.mkdir(dir, { recursive: true });
  }
}

function register() {
  ipcMain.handle('autosave-write', async (_event, sceneData) => {
    try {
      await ensureAutosaveDir();
      await fsPromises.writeFile(AUTOSAVE_PATH, JSON.stringify(sceneData, null, 2));
      logger.debug('Autosave written');
      return { success: true };
    } catch (e) {
      return { error: e.message };
    }
  });

  ipcMain.handle('autosave-read', async () => {
    try {
      if (!(await pathExists(AUTOSAVE_PATH))) return null;
      const data = await fsPromises.readFile(AUTOSAVE_PATH, 'utf-8');
      logger.debug('Autosave read');
      return JSON.parse(data);
    } catch (e) {
      logger.warn('Failed to read autosave file:', e.message);
      return null;
    }
  });

  ipcMain.handle('autosave-delete', async () => {
    try {
      if (await pathExists(AUTOSAVE_PATH)) {
        await fsPromises.unlink(AUTOSAVE_PATH);
        logger.debug('Autosave deleted');
      }
      return { success: true };
    } catch (e) {
      return { error: e.message };
    }
  });

  ipcMain.handle('autosave-exists', async () => pathExists(AUTOSAVE_PATH));
}

module.exports = { register, AUTOSAVE_PATH };
