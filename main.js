const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const fsPromises = fs.promises;
const { convertToMZFormat, isPathSafe } = require('./src/lib/mz-converter');
const { logger, isDev } = require('./src/lib/main-logger');

// Async helper to check if path exists
async function pathExists(p) {
  try {
    await fsPromises.access(p);
    return true;
  } catch {
    return false;
  }
}

// Use software rendering to avoid GPU errors
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('use-gl', 'swiftshader');

let mainWindow;
let projectPath = null;

function createWindow() {
  // Get primary display scale factor for HiDPI support
  const { screen } = require('electron');
  const primaryDisplay = screen.getPrimaryDisplay();
  const _scaleFactor = primaryDisplay.scaleFactor || 1;

  mainWindow = new BrowserWindow({
    width: 1600,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    show: false, // Don't show until maximized
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      nodeIntegration: true, // Required for CommonJS require() in renderer
      contextIsolation: false, // Disabled to allow require() in renderer scripts
      preload: path.join(__dirname, 'preload.js'),
      zoomFactor: 1.0 // No auto-scaling - user can adjust with Ctrl+/Ctrl-
    },
    title: 'Timeline Scene Builder'
  });

  // Maximize and show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.maximize();
    mainWindow.show();
  });

  logger.info('Window created');
  mainWindow.loadFile('src/index.html');

  // Allow manual zoom with Ctrl+Plus/Minus
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.control) {
      if (input.key === '=' || input.key === '+') {
        mainWindow.webContents.setZoomFactor(mainWindow.webContents.getZoomFactor() + 0.1);
        event.preventDefault();
      } else if (input.key === '-') {
        mainWindow.webContents.setZoomFactor(Math.max(0.5, mainWindow.webContents.getZoomFactor() - 0.1));
        event.preventDefault();
      } else if (input.key === '0') {
        mainWindow.webContents.setZoomFactor(1.5);
        event.preventDefault();
      }
    }
  });

  // Open DevTools in dev mode
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(() => {
  logger.info('App ready', isDev ? '(dev mode)' : '(production mode)');
  Menu.setApplicationMenu(null); // Hide default menu bar
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC Handlers

// Open project folder
ipcMain.handle('open-project', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Select RPG Maker MZ Project Folder'
  });

  if (!result.canceled && result.filePaths.length > 0) {
    projectPath = result.filePaths[0];

    // Verify it's an MZ project
    const gameFile = path.join(projectPath, 'game.rmmzproject');
    if (!(await pathExists(gameFile))) {
      logger.warn('Invalid MZ project folder (game.rmmzproject not found):', projectPath);
      return { error: 'Not a valid RPG Maker MZ project folder (game.rmmzproject not found)' };
    }

    logger.info('Project opened:', projectPath);
    return { path: projectPath };
  }
  return null;
});

// Set project path directly (for recent projects)
ipcMain.handle('set-project-path', async (event, projPath) => {
  if (!projPath) return { error: 'No path provided' };

  // Verify it's a valid RPG Maker MZ project
  const gameFile = path.join(projPath, 'game.rmmzproject');
  if (!(await pathExists(gameFile))) {
    logger.warn('set-project-path: invalid MZ project folder:', projPath);
    return { error: 'Not a valid RPG Maker MZ project folder' };
  }

  projectPath = projPath;
  logger.info('Project path set:', projectPath);
  return { success: true, path: projectPath };
});

// Get screen resolution from System.json
ipcMain.handle('get-screen-resolution', async () => {
  if (!projectPath) return { width: 816, height: 624 }; // Default RPG Maker MZ

  const systemPath = path.join(projectPath, 'data', 'System.json');
  if (!(await pathExists(systemPath))) {
    return { width: 816, height: 624 }; // Default RPG Maker MZ
  }

  try {
    const data = JSON.parse(await fsPromises.readFile(systemPath, 'utf8'));
    const width = data.advanced?.screenWidth || 816;
    const height = data.advanced?.screenHeight || 624;
    logger.debug('Screen resolution:', width, 'x', height);
    return { width, height };
  } catch {
    logger.debug('Failed to read System.json, using defaults');
    return { width: 816, height: 624 }; // Default on error
  }
});

// Get pictures folder structure (lazy loading - only folder names first)
ipcMain.handle('get-pictures-folders', async () => {
  if (!projectPath) return { error: 'No project loaded' };

  const picturesPath = path.join(projectPath, 'img', 'pictures');
  if (!(await pathExists(picturesPath))) {
    logger.warn('Pictures folder not found:', picturesPath);
    return { error: 'Pictures folder not found' };
  }

  logger.debug('Scanning pictures folders:', picturesPath);
  return await scanDirectory(picturesPath, picturesPath);
});

async function scanDirectory(dirPath, basePath, depth = 0) {
  const items = [];
  const entries = await fsPromises.readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const relativePath = path.relative(basePath, fullPath);

    if (entry.isDirectory()) {
      // Skip claude_only folders
      if (entry.name === 'claude_only') continue;

      items.push({
        type: 'folder',
        name: entry.name,
        path: relativePath.replace(/\\/g, '/'),
        children: depth < 2 ? await scanDirectory(fullPath, basePath, depth + 1) : null // Lazy load deeper
      });
    } else if (entry.name.toLowerCase().endsWith('.png')) {
      items.push({
        type: 'file',
        name: entry.name.replace('.png', ''),
        path: relativePath.replace(/\\/g, '/').replace('.png', '')
      });
    }
  }

  return items;
}

// Get folder contents (for lazy loading) - returns both subfolders and images
ipcMain.handle('get-folder-contents', async (event, folderPath) => {
  if (!projectPath) return { error: 'No project loaded' };

  const picturesBase = path.join(projectPath, 'img', 'pictures');
  if (!isPathSafe(picturesBase, folderPath)) {
    logger.warn('Blocked unsafe folder path:', folderPath);
    return { error: 'Invalid folder path' };
  }

  const fullPath = path.join(picturesBase, folderPath);
  if (!(await pathExists(fullPath))) {
    logger.warn('Folder not found:', fullPath);
    return { error: 'Folder not found' };
  }

  logger.debug('Loading folder contents:', folderPath);

  const items = [];
  const entries = await fsPromises.readdir(fullPath, { withFileTypes: true });

  for (const entry of entries) {
    // Skip claude_only folders
    if (entry.name === 'claude_only') continue;

    if (entry.isDirectory()) {
      const relativePath = path.join(folderPath, entry.name).replace(/\\/g, '/');
      items.push({
        type: 'folder',
        name: entry.name,
        path: relativePath,
        children: null // Will be lazy loaded when expanded
      });
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.png')) {
      const relativePath = path.join(folderPath, entry.name.replace('.png', '')).replace(/\\/g, '/');
      items.push({
        type: 'file',
        name: entry.name.replace('.png', ''),
        path: relativePath
      });
    }
  }

  return items;
});

// Get thumbnail for lazy loading (returns base64)
ipcMain.handle('get-thumbnail', async (event, imagePath) => {
  if (!projectPath) return null;

  const picturesBase = path.join(projectPath, 'img', 'pictures');
  if (!isPathSafe(picturesBase, imagePath + '.png')) {
    logger.warn('Blocked unsafe thumbnail path:', imagePath);
    return null;
  }

  const fullPath = path.join(picturesBase, imagePath + '.png');
  if (!(await pathExists(fullPath))) return null;

  try {
    const data = await fsPromises.readFile(fullPath);
    return `data:image/png;base64,${data.toString('base64')}`;
  } catch {
    logger.debug('Failed to read thumbnail:', imagePath);
    return null;
  }
});

// Get full image path for preview
ipcMain.handle('get-image-path', async (event, imagePath) => {
  if (!projectPath) return null;

  const picturesBase = path.join(projectPath, 'img', 'pictures');
  if (!isPathSafe(picturesBase, imagePath + '.png')) {
    logger.warn('Blocked unsafe image path:', imagePath);
    return null;
  }

  const fullPath = path.join(picturesBase, imagePath + '.png');
  if (!(await pathExists(fullPath))) return null;

  return fullPath;
});

// Export events to a Map JSON file (insert into specific event)
ipcMain.handle('export-to-map', async (event, { events: evtList, mapId, eventId, pageIndex }) => {
  if (!projectPath) return { error: 'No project loaded' };

  const mapFile = path.join(projectPath, 'data', `Map${String(mapId).padStart(3, '0')}.json`);
  if (!(await pathExists(mapFile))) {
    return { error: `Map file not found: Map${String(mapId).padStart(3, '0')}.json` };
  }

  logger.info('Export to map:', { mapId, eventId, pageIndex });

  try {
    const mapData = JSON.parse(await fsPromises.readFile(mapFile, 'utf-8'));
    const mzCommands = convertToMZFormat(evtList);

    // Find the event
    const mapEvent = mapData.events.find((e) => e && e.id === eventId);
    if (!mapEvent) {
      return { error: `Event ID ${eventId} not found in map` };
    }

    const page = mapEvent.pages[pageIndex || 0];
    if (!page) {
      return { error: `Page ${pageIndex || 0} not found in event` };
    }

    // Insert commands before the terminating null command
    const insertIndex = page.list.length - 1; // Before the {code: 0}
    page.list.splice(insertIndex, 0, ...mzCommands);

    // Save the map file
    await fsPromises.writeFile(mapFile, JSON.stringify(mapData, null, 2));

    logger.info('Export success:', mzCommands.length, 'commands written');
    return { success: true, commandCount: mzCommands.length };
  } catch (e) {
    logger.error('Export failed:', e.message);
    return { error: e.message };
  }
});

// Get list of maps in project
ipcMain.handle('get-maps', async () => {
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
    return { error: e.message };
  }
});

// Get events in a map
ipcMain.handle('get-map-events', async (event, mapId) => {
  if (!projectPath) return { error: 'No project loaded' };

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
    return { error: e.message };
  }
});

// Save scene to file
ipcMain.handle('save-scene', async (event, sceneData) => {
  const result = await dialog.showSaveDialog(mainWindow, {
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
});

// Load scene from file
ipcMain.handle('load-scene', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
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
});

// Autosave handlers
const os = require('os');
const AUTOSAVE_PATH = path.join(os.tmpdir(), 'timeline-scene-builder', 'autosave.mzscene');

async function ensureAutosaveDir() {
  const dir = path.dirname(AUTOSAVE_PATH);
  if (!(await pathExists(dir))) {
    await fsPromises.mkdir(dir, { recursive: true });
  }
}

ipcMain.handle('autosave-write', async (event, sceneData) => {
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
  } catch {
    logger.debug('Failed to read autosave');
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

ipcMain.handle('autosave-exists', async () => {
  return await pathExists(AUTOSAVE_PATH);
});
