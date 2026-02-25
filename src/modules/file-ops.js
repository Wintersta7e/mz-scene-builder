// ============================================
// File Operations (Scene Save/Load, Drag-Drop)
// ============================================

// Use secure API exposed via preload script
const api = window.api;
const { state } = require('./state');
const { getElements } = require('./elements');
const { markClean, checkUnsavedChanges } = require('./undo-redo');
const { logger } = require('./logger');
const { eventBus, Events } = require('./event-bus');
const { resetInsertOrderCounter } = require('./utils');

// Reset insert order counter based on loaded events
function syncInsertOrderCounter(events) {
  const maxOrder = events.reduce((max, e) => Math.max(max, e._insertOrder || 0), 0);
  resetInsertOrderCounter(maxOrder);
}

function initDragDrop() {
  document.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
  });

  document.addEventListener('drop', async (e) => {
    e.preventDefault();
    e.stopPropagation();

    const files = Array.from(e.dataTransfer.files);
    const mzsceneFile = files.find((f) => f.name.endsWith('.mzscene'));

    if (mzsceneFile) {
      logger.debug('Drag-drop detected .mzscene file:', mzsceneFile.name);
      if (await checkUnsavedChanges()) {
        loadSceneFromFile(mzsceneFile);
      }
    }
  });
}

// Load scene from a File object (drag-drop)
async function loadSceneFromFile(file) {
  try {
    const elements = getElements();
    const text = await file.text();
    const data = JSON.parse(text);
    state.events = data.events || [];
    syncInsertOrderCounter(state.events);
    state.timelineLength = data.timelineLength || 300;
    elements.timelineLengthInput.value = state.timelineLength;
    state.currentScenePath = file.name;

    state.selectedEventIndex = -1;
    state.undoStack = [];
    state.redoStack = [];

    eventBus.emit(Events.RENDER);
    markClean();
    logger.info('Loaded scene from:', file.name);
  } catch (e) {
    logger.error('Failed to load scene:', e);
  }
}

async function newScene() {
  if (!(await checkUnsavedChanges())) return;

  logger.info('New scene created');
  state.events = [];
  state.selectedEventIndex = -1;
  state.currentFrame = 0;
  state.currentScenePath = null;
  state.undoStack = [];
  state.redoStack = [];
  eventBus.emit(Events.RENDER);
  markClean();
}

async function saveScene() {
  const sceneData = {
    version: 1,
    timelineLength: state.timelineLength,
    events: state.events
  };
  const result = await api.invoke('save-scene', sceneData);
  if (result) {
    state.currentScenePath = result;
    logger.info('Scene saved:', result);
    markClean();
  }
}

async function loadScene() {
  if (!(await checkUnsavedChanges())) return;

  const elements = getElements();
  const sceneData = await api.invoke('load-scene');
  if (sceneData) {
    state.events = sceneData.events || [];
    syncInsertOrderCounter(state.events);
    state.timelineLength = sceneData.timelineLength || 300;
    elements.timelineLengthInput.value = state.timelineLength;
    state.selectedEventIndex = state.events.length > 0 ? 0 : -1;
    state.currentFrame = 0;
    state.undoStack = [];
    state.redoStack = [];
    eventBus.emit(Events.RENDER);
    markClean();
  }
}

module.exports = {
  initDragDrop,
  loadSceneFromFile,
  newScene,
  saveScene,
  loadScene
};
