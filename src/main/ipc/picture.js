// ============================================
// IPC: picture folders, lazy contents, thumbnails, full paths
// ============================================

const { ipcMain } = require('electron');
const path = require('node:path');
const fsPromises = require('node:fs').promises;

const { isPathSafe } = require('../../lib/mz-converter');
const { logger } = require('../../lib/main-logger');
const { getProjectPath } = require('../state');
const { pathExists, requireProject } = require('../util');

// Folders named `claude_only` are excluded everywhere — they hold
// project-internal assets the renderer should never surface.
const HIDDEN_FOLDER = 'claude_only';

async function scanDirectory(dirPath, basePath, depth = 0) {
  const items = [];
  let entries;
  try {
    entries = await fsPromises.readdir(dirPath, { withFileTypes: true });
  } catch (e) {
    logger.warn('Failed to read directory, skipping:', dirPath, e.message);
    return items;
  }

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const relativePath = path.relative(basePath, fullPath);

    if (entry.isDirectory()) {
      if (entry.name === HIDDEN_FOLDER) continue;
      items.push({
        type: 'folder',
        name: entry.name,
        path: relativePath.replace(/\\/g, '/'),
        // Lazy-load below depth 2 so opening a project doesn't recurse the
        // entire pictures tree up front.
        children: depth < 2 ? await scanDirectory(fullPath, basePath, depth + 1) : null
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

function register() {
  // Initial folder structure (lazy beyond depth 2).
  ipcMain.handle('get-pictures-folders', async () => {
    const proj = requireProject();
    if (proj.error) return proj;

    const picturesPath = path.join(proj.projectPath, 'img', 'pictures');
    if (!(await pathExists(picturesPath))) {
      logger.warn('Pictures folder not found:', picturesPath);
      return { error: 'Pictures folder not found' };
    }

    logger.debug('Scanning pictures folders:', picturesPath);
    return await scanDirectory(picturesPath, picturesPath);
  });

  // Lazy-load contents for a folder requested by the renderer (subfolders
  // + images, never the deeper tree). All paths are validated against
  // the pictures base via isPathSafe.
  ipcMain.handle('get-folder-contents', async (_event, folderPath) => {
    const proj = requireProject();
    if (proj.error) return proj;

    const picturesBase = path.join(proj.projectPath, 'img', 'pictures');
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
    let entries;
    try {
      entries = await fsPromises.readdir(fullPath, { withFileTypes: true });
    } catch (e) {
      logger.error('Failed to read folder contents:', fullPath, e.message);
      return { error: `Failed to read folder: ${e.message}` };
    }

    for (const entry of entries) {
      if (entry.name === HIDDEN_FOLDER) continue;

      if (entry.isDirectory()) {
        const relativePath = path.join(folderPath, entry.name).replace(/\\/g, '/');
        items.push({
          type: 'folder',
          name: entry.name,
          path: relativePath,
          children: null
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

  // Read a thumbnail and return it as a data URL. isPathSafe blocks any
  // attempt to escape the pictures base.
  ipcMain.handle('get-thumbnail', async (_event, imagePath) => {
    const projectPath = getProjectPath();
    if (!projectPath) return null;

    const picturesBase = path.join(projectPath, 'img', 'pictures');
    if (!isPathSafe(picturesBase, `${imagePath}.png`)) {
      logger.warn('Blocked unsafe thumbnail path:', imagePath);
      return null;
    }

    const fullPath = path.join(picturesBase, `${imagePath}.png`);
    if (!(await pathExists(fullPath))) return null;

    try {
      const data = await fsPromises.readFile(fullPath);
      return `data:image/png;base64,${data.toString('base64')}`;
    } catch {
      logger.debug('Failed to read thumbnail:', imagePath);
      return null;
    }
  });

  // Resolve the absolute path for a picture so the renderer can use it as
  // the <img> src attribute. Same path-safety rules as thumbnails.
  ipcMain.handle('get-image-path', async (_event, imagePath) => {
    const projectPath = getProjectPath();
    if (!projectPath) return null;

    const picturesBase = path.join(projectPath, 'img', 'pictures');
    if (!isPathSafe(picturesBase, `${imagePath}.png`)) {
      logger.warn('Blocked unsafe image path:', imagePath);
      return null;
    }

    const fullPath = path.join(picturesBase, `${imagePath}.png`);
    if (!(await pathExists(fullPath))) return null;

    return fullPath;
  });
}

module.exports = { register };
