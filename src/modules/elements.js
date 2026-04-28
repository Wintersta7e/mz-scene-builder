// ============================================
// DOM Elements Cache
// ============================================

/** @type {Record<string, HTMLElement> | null} */
let elements = null;

function initElements() {
  /**
   * Resolve a required element by ID, throwing with a clear message if missing.
   * Used to satisfy strict TypeScript without scattering null checks.
   * @param {string} id
   * @returns {HTMLElement}
   */
  const $ = (id) => {
    const el = document.getElementById(id);
    if (!el) throw new Error(`Required DOM element #${id} not found in index.html`);
    return el;
  };

  elements = {
    openProject: $('btn-open-project'),
    newScene: $('btn-new-scene'),
    loadScene: $('btn-load-scene'),
    saveScene: $('btn-save-scene'),
    exportMap: $('btn-export-map'),
    quickExport: $('btn-quick-export'),
    imageBrowser: $('image-browser'),
    imageSearch: $('image-search'),
    libraryFolders: $('library-folders'),
    libraryCount: $('library-count'),
    previewCanvas: $('preview-canvas'),
    stageVignette: $('stage-vignette'),
    stageFlash: $('stage-flash'),
    stageSlate: $('stage-slate'),
    slateScene: $('slate-scene'),
    slateTake: $('slate-take'),
    slateTime: $('slate-time'),
    slateFrame: $('slate-frame'),
    stageRec: $('stage-rec'),
    stageRecLabel: $('stage-rec-label'),
    propertiesPanel: $('properties-panel'),
    addPicture: $('btn-add-picture'),
    addMove: $('btn-add-move'),
    addRotate: $('btn-add-rotate'),
    addTint: $('btn-add-tint'),
    addErase: $('btn-add-erase'),
    addText: $('btn-add-text'),
    addWait: $('btn-add-wait'),
    addFlash: $('btn-add-flash'),
    deleteEvent: $('btn-delete-event'),
    duplicateEvent: $('btn-duplicate-event'),
    clearScene: $('btn-clear-scene'),
    // Timeline elements
    btnPlay: $('btn-play'),
    btnStop: $('btn-stop'),
    btnSkipBack: $('btn-skip-back'),
    btnSkipFwd: $('btn-skip-fwd'),
    timelineLengthInput: $('timeline-length'),
    timelineLanes: $('timeline-lanes'),
    timelineTrack: $('timeline-track'),
    timelineRuler: $('timeline-ruler'),
    timelineEvents: $('timeline-events'),
    timelineCursor: $('timeline-cursor'),
    // Minimap elements
    timelineMinimap: $('timeline-minimap'),
    minimapTrack: $('minimap-track'),
    minimapViewport: $('minimap-viewport'),
    minimapCursor: $('minimap-cursor'),
    imagePickerModal: $('image-picker-modal'),
    pickerFolders: $('picker-folders'),
    pickerImages: $('picker-images'),
    exportModal: $('export-modal'),
    doExport: $('btn-do-export'),
    // Virtual dropdown containers for export
    exportMapSelect: $('export-map-select'),
    exportEventSelect: $('export-event-select'),
    exportPageSelect: $('export-page-select'),
    // Top rail (redesign-A)
    sceneMeta: $('scene-meta'),
    sceneNameInput: $('scene-name-input'),
    sceneFolderName: $('scene-folder-name'),
    sceneSavedTime: $('scene-saved-time'),
    segDesign: $('seg-design'),
    segPreview: $('seg-preview'),
    segInspect: $('seg-inspect'),
    btnSettings: $('btn-settings'),
    btnRecent: $('btn-recent'),
    // Transport readout cells (redesign-D)
    readoutFrame: $('readout-frame'),
    readoutTime: $('readout-time'),
    readoutEvents: $('readout-events')
  };

  return elements;
}

function getElements() {
  if (!elements) {
    throw new Error('Elements not initialized. Call initElements() first.');
  }
  return elements;
}

export { initElements, getElements };
