// ============================================
// Project Management
// ============================================

// Use secure API exposed via preload script
const api = window.api;
const { state } = require('./state');
const { getElements } = require('./elements');
const { checkUnsavedChanges, markClean } = require('./undo-redo');
const { addRecentProject } = require('./settings');
const { logger } = require('./logger');
const { showError } = require('./notifications');
const { eventBus, Events } = require('./event-bus');

async function openProject() {
  if (!(await checkUnsavedChanges())) return;

  const result = await api.invoke('open-project');
  if (result && !result.error) {
    await openProjectPath(result.path);
  } else if (result && result.error) {
    showError(result.error);
  }
}

async function openProjectPath(projPath) {
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
}

async function prefetchMaps() {
  const maps = await api.invoke('get-maps');
  if (!maps.error) {
    state.cachedMaps = maps;
    logger.debug(`Prefetched ${maps.length} maps`);

    // Pre-render dropdown options
    const { prerenderMapsDropdown } = require('./export');
    prerenderMapsDropdown();
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
  const { renderFolderTree } = require('./preview/image-browser');
  const elements = getElements();

  const result = await api.invoke('get-pictures-folders');
  if (result && !result.error) {
    state.folderStructure = result;
    renderFolderTree(elements.imageBrowser, result);
  } else {
    logger.warn('Failed to load folder structure:', result?.error);
  }
}

async function loadScreenResolution() {
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
}

module.exports = {
  openProject,
  openProjectPath,
  enableButtons,
  loadFolderStructure,
  loadScreenResolution
};
