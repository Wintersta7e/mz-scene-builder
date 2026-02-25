// ============================================
// DOM Elements Cache
// ============================================

let elements = null;

function initElements() {
  elements = {
    openProject: document.getElementById('btn-open-project'),
    projectName: document.getElementById('project-name'),
    newScene: document.getElementById('btn-new-scene'),
    loadScene: document.getElementById('btn-load-scene'),
    saveScene: document.getElementById('btn-save-scene'),
    exportMap: document.getElementById('btn-export-map'),
    quickExport: document.getElementById('btn-quick-export'),
    imageBrowser: document.getElementById('image-browser'),
    imageSearch: document.getElementById('image-search'),
    previewCanvas: document.getElementById('preview-canvas'),
    propertiesPanel: document.getElementById('properties-panel'),
    addPicture: document.getElementById('btn-add-picture'),
    addMove: document.getElementById('btn-add-move'),
    addRotate: document.getElementById('btn-add-rotate'),
    addTint: document.getElementById('btn-add-tint'),
    addErase: document.getElementById('btn-add-erase'),
    addText: document.getElementById('btn-add-text'),
    addWait: document.getElementById('btn-add-wait'),
    addFlash: document.getElementById('btn-add-flash'),
    deleteEvent: document.getElementById('btn-delete-event'),
    clearScene: document.getElementById('btn-clear-scene'),
    // Timeline elements
    btnPlay: document.getElementById('btn-play'),
    btnStop: document.getElementById('btn-stop'),
    currentFrameDisplay: document.getElementById('current-frame'),
    timelineLengthInput: document.getElementById('timeline-length'),
    timelineLanes: document.getElementById('timeline-lanes'),
    timelineTrack: document.getElementById('timeline-track'),
    timelineRuler: document.getElementById('timeline-ruler'),
    timelineEvents: document.getElementById('timeline-events'),
    timelineCursor: document.getElementById('timeline-cursor'),
    // Minimap elements
    timelineMinimap: document.getElementById('timeline-minimap'),
    minimapCanvas: document.getElementById('minimap-canvas'),
    minimapViewport: document.getElementById('minimap-viewport'),
    minimapCursor: document.getElementById('minimap-cursor'),
    imagePickerModal: document.getElementById('image-picker-modal'),
    pickerFolders: document.getElementById('picker-folders'),
    pickerImages: document.getElementById('picker-images'),
    exportModal: document.getElementById('export-modal'),
    doExport: document.getElementById('btn-do-export'),
    // Virtual dropdown containers for export
    exportMapSelect: document.getElementById('export-map-select'),
    exportEventSelect: document.getElementById('export-event-select'),
    exportPageSelect: document.getElementById('export-page-select')
  };
  return elements;
}

function getElements() {
  if (!elements) {
    throw new Error('Elements not initialized. Call initElements() first.');
  }
  return elements;
}

module.exports = { initElements, getElements };
