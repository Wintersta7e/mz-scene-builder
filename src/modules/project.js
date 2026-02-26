// ============================================
// Project Management
// ============================================

// Use secure API exposed via preload script
const api = window.api;
import { state } from './state.js';
import { getElements } from './elements.js';
import { checkUnsavedChanges, markClean } from './undo-redo.js';
import { addRecentProject } from './settings.js';
import { logger } from './logger.js';
import { showError } from './notifications.js';
import { eventBus, Events } from './event-bus.js';
import { prerenderMapsDropdown } from './export.js';
import { renderFolderTree } from './preview/image-browser.js';

async function openProject() {
  if (!(await checkUnsavedChanges())) return;

  try {
    const result = await api.invoke('open-project');
    if (result && !result.error) {
      await openProjectPath(result.path);
    } else if (result && result.error) {
      showError(result.error);
    }
  } catch (err) {
    logger.error('Failed to open project:', err);
    showError('Failed to open project: ' + err.message);
  }
}

async function openProjectPath(projPath) {
  try {
    const elements = getElements();

    const result = await api.invoke('set-project-path', projPath);
    if (result.error) {
      showError(result.error);
      return;
    }

    // Clear existing scene when switching projects
    state.events = [];
    state.selectedEventIndex = -1;
    state.currentFrame = 0;
    state.currentScenePath = null;
    state.undoStack = [];
    state.redoStack = [];
    state.cachedMaps = null;
    state.cachedMapEvents = {};
    markClean();

    state.projectPath = projPath;
    logger.info('Project opened:', projPath);
    elements.projectName.textContent = projPath.split(/[/\\]/).pop();
    enableButtons(true);
    await loadFolderStructure();
    await loadScreenResolution();
    addRecentProject(projPath);

    // Prefetch maps list for export modal (don't await - let it load in background)
    prefetchMaps();

    // Render timeline to show empty state
    eventBus.emit(Events.RENDER_TIMELINE);
  } catch (err) {
    logger.error('Failed to open project path:', err);
    showError('Failed to open project: ' + err.message);
  }
}

async function prefetchMaps() {
  try {
    const maps = await api.invoke('get-maps');
    if (!maps.error) {
      state.cachedMaps = maps;
      logger.debug(`Prefetched ${maps.length} maps`);

      // Pre-render dropdown options
      prerenderMapsDropdown();
    }
  } catch (err) {
    logger.error('Failed to prefetch maps:', err);
  }
}

function enableButtons(enabled) {
  const elements = getElements();
  elements.newScene.disabled = !enabled;
  elements.loadScene.disabled = !enabled;
  elements.saveScene.disabled = !enabled;
  elements.exportMap.disabled = !enabled;
  elements.addPicture.disabled = !enabled;
  elements.addMove.disabled = !enabled;
  elements.addRotate.disabled = !enabled;
  elements.addTint.disabled = !enabled;
  elements.addErase.disabled = !enabled;
  elements.addText.disabled = !enabled;
  elements.addWait.disabled = !enabled;
  elements.addFlash.disabled = !enabled;
  elements.clearScene.disabled = !enabled;
  elements.imageSearch.disabled = !enabled;
  elements.btnPlay.disabled = !enabled;
  elements.btnStop.disabled = !enabled;
}

async function loadFolderStructure() {
  try {
    const elements = getElements();

    const result = await api.invoke('get-pictures-folders');
    if (result && !result.error) {
      state.folderStructure = result;
      renderFolderTree(elements.imageBrowser, result);
    } else {
      logger.warn('Failed to load folder structure:', result?.error);
    }
  } catch (err) {
    logger.error('Failed to load folder structure:', err);
    showError('Failed to load folder structure: ' + err.message);
  }
}

async function loadScreenResolution() {
  try {
    const result = await api.invoke('get-screen-resolution');
    if (result) {
      state.screenWidth = result.width;
      state.screenHeight = result.height;
      logger.debug('Screen resolution:', result.width, 'x', result.height);

      const previewHeader = document.querySelector('.preview-header h3');
      if (previewHeader) {
        previewHeader.textContent = `Preview (${state.screenWidth}x${state.screenHeight})`;
      }

      eventBus.emit(Events.PROJECT_LOADED);
    }
  } catch (err) {
    logger.error('Failed to load screen resolution:', err);
    showError('Failed to load screen resolution: ' + err.message);
  }
}

export {
  openProject,
  openProjectPath,
  enableButtons,
  loadFolderStructure,
  loadScreenResolution
};
