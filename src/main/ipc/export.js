// ============================================
// IPC: maps list, map events, export-to-map
// ============================================

const { ipcMain } = require('electron');
const path = require('node:path');
const fsPromises = require('node:fs').promises;

const { convertToMZFormat } = require('../../lib/mz-converter');
const { logger } = require('../../lib/main-logger');
const { getProjectPath } = require('../state');
const { pathExists } = require('../util');

function register() {
  // List maps from MapInfos.json. Returns [{ id, name }, ...] or { error }.
  ipcMain.handle('get-maps', async () => {
    const projectPath = getProjectPath();
    if (!projectPath) return { error: 'No project loaded' };

    const mapInfoFile = path.join(projectPath, 'data', 'MapInfos.json');
    if (!(await pathExists(mapInfoFile))) {
      return { error: 'MapInfos.json not found' };
    }

    try {
      const mapInfos = JSON.parse(await fsPromises.readFile(mapInfoFile, 'utf-8'));
      const maps = mapInfos.filter((m) => m).map((m) => ({ id: m.id, name: m.name }));
      logger.debug('Loaded', maps.length, 'maps');
      return maps;
    } catch (e) {
      logger.error('Failed to load maps:', e.message);
      return { error: e.message };
    }
  });

  // List events for a single map. Returns [{ id, name, pages }, ...] or { error }.
  ipcMain.handle('get-map-events', async (_event, mapId) => {
    const projectPath = getProjectPath();
    if (!projectPath) return { error: 'No project loaded' };

    if (!Number.isInteger(mapId) || mapId < 1 || mapId > 999) {
      return { error: 'Invalid map ID' };
    }

    const mapFile = path.join(projectPath, 'data', `Map${String(mapId).padStart(3, '0')}.json`);
    if (!(await pathExists(mapFile))) {
      return { error: 'Map file not found' };
    }

    try {
      const mapData = JSON.parse(await fsPromises.readFile(mapFile, 'utf-8'));
      const events = mapData.events.filter((e) => e).map((e) => ({ id: e.id, name: e.name, pages: e.pages.length }));
      logger.debug('Map', mapId, ':', events.length, 'events');
      return events;
    } catch (e) {
      logger.error('Failed to load map events for map', mapId, ':', e.message);
      return { error: e.message };
    }
  });

  // Replace the command list of a target event page with the renderer's
  // sequence (preserving the trailing `code: 0` terminator). The renderer
  // pre-validates the inputs but we re-check at the boundary.
  ipcMain.handle('export-to-map', async (_event, { events: evtList, mapId, eventId, pageIndex }) => {
    const projectPath = getProjectPath();
    if (!projectPath) return { error: 'No project loaded' };

    if (!Number.isInteger(mapId) || mapId < 1 || mapId > 999) {
      return { error: 'Invalid map ID' };
    }
    if (!Number.isInteger(eventId) || eventId < 1) {
      return { error: 'Invalid event ID' };
    }
    const safePageIndex = pageIndex ?? 0;
    if (!Number.isInteger(safePageIndex) || safePageIndex < 0) {
      return { error: 'Invalid page index' };
    }

    const mapFile = path.join(projectPath, 'data', `Map${String(mapId).padStart(3, '0')}.json`);
    if (!(await pathExists(mapFile))) {
      return { error: `Map file not found: Map${String(mapId).padStart(3, '0')}.json` };
    }

    logger.info('Export to map:', { mapId, eventId, pageIndex: safePageIndex });

    try {
      const mapData = JSON.parse(await fsPromises.readFile(mapFile, 'utf-8'));
      const mzCommands = convertToMZFormat(evtList);

      const mapEvent = mapData.events.find((e) => e && e.id === eventId);
      if (!mapEvent) {
        return { error: `Event ID ${eventId} not found in map` };
      }

      const page = mapEvent.pages[safePageIndex];
      if (!page) {
        return { error: `Page ${safePageIndex} not found in event` };
      }

      if (page.list.length === 0 || page.list[page.list.length - 1]?.code !== 0) {
        return { error: 'Invalid event page structure: missing terminating command' };
      }

      // Replace existing content, keeping only the terminating {code: 0}.
      const terminator = page.list[page.list.length - 1];
      page.list = [...mzCommands, terminator];

      await fsPromises.writeFile(mapFile, JSON.stringify(mapData, null, 2));

      logger.info('Export success:', mzCommands.length, 'commands written');
      return { success: true, commandCount: mzCommands.length };
    } catch (e) {
      logger.error('Export failed:', e.message);
      return { error: e.message };
    }
  });
}

module.exports = { register };
