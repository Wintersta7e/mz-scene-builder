// ============================================
// Initialization & Event Binding
// ============================================

import { state } from './state.js';
import { initElements, getElements } from './elements.js';
import { logger } from './logger.js';
import { eventBus, Events } from './event-bus.js';
import { addEvent, deleteSelectedEvent, clearScene } from './events.js';
import { initDragDrop, newScene, loadScene, saveScene } from './file-ops.js';
import { openProject, openProjectPath } from './project.js';
import { updateRecentProjectsDropdown, initRecentProjectsDropdown } from './settings.js';
import { toggleGrid, toggleSnapToGrid } from './grid.js';
import { showAboutModal, showShortcutsModal } from './modals.js';
import { startAutosave, stopAutosave, checkAutosaveRecovery } from './autosave.js';
import { initTimeline, renderTimeline, onTimelineClick } from './timeline/index.js';
import { initMinimapEvents, teardownMinimapEvents, updateCachedContainerWidth } from './timeline/minimap.js';
import { renderProperties } from './properties/index.js';
import { setupPropertyDelegation } from './properties/bind-input.js';
import { renderPreviewAtFrame, resizePreviewCanvas } from './preview/index.js';
import { closeImagePicker } from './preview/image-picker.js';
import { filterImages } from './preview/image-browser.js';
import { togglePlayback, stopPlayback } from './playback.js';
import { markDirty } from './undo-redo.js';
import { handleKeyboardMove, setSaveCallback } from './keyboard.js';
import {
  openExportModal,
  doExportToMap,
  initExportDropdowns,
  closeExportModal,
  quickExport,
  updateQuickExportButton
} from './export.js';

function render() {
  renderTimeline();
  renderProperties();
  renderPreviewAtFrame(state.currentFrame);
  updateQuickExportButton();
}

function setupEventBusListeners() {
  // Full render
  eventBus.on(Events.RENDER, render);

  // Individual renders
  eventBus.on(Events.RENDER_TIMELINE, renderTimeline);
  eventBus.on(Events.RENDER_PREVIEW, (/** @type {number | undefined} */ frame) => {
    renderPreviewAtFrame(frame !== undefined ? frame : state.currentFrame);
  });
  // Project loaded - resize preview and update quick export button
  eventBus.on(Events.PROJECT_LOADED, () => {
    resizePreviewCanvas();
    updateQuickExportButton();
  });

  // Recent project opened (mediator for settings -> project circular dependency)
  eventBus.on(Events.OPEN_RECENT_PROJECT, (/** @type {string} */ path) => {
    openProjectPath(path).catch((err) => {
      logger.error('Failed to open recent project:', err);
    });
  });
}

function initResizeHandles() {
  const root = document.documentElement;
  const resizeLeft = document.getElementById('resize-left');
  const resizeRight = document.getElementById('resize-right');
  const resizeTimeline = document.getElementById('resize-timeline');

  if (!resizeLeft || !resizeRight || !resizeTimeline) {
    logger.warn('Resize handles missing from DOM; skipping init');
    return;
  }

  // Min/max constraints (px)
  const LIB_MIN = 180;
  const LIB_MAX = 400;
  const PROPS_MIN = 220;
  const PROPS_MAX = 420;
  const TL_MIN = 180;
  const TL_MAX = 540;

  /** @type {'left' | 'right' | 'timeline' | null} */
  let dragging = null;
  let startX = 0;
  let startY = 0;
  let startSize = 0;

  /** @param {string} name */
  function readVarPx(name) {
    const v = getComputedStyle(root).getPropertyValue(name).trim();
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  }

  /**
   * @param {number} val
   * @param {number} min
   * @param {number} max
   */
  function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

  resizeLeft.addEventListener('mousedown', (e) => {
    dragging = 'left';
    startX = e.clientX;
    startSize = readVarPx('--lib-w');
    resizeLeft.classList.add('dragging');
    e.preventDefault();
  });

  resizeRight.addEventListener('mousedown', (e) => {
    dragging = 'right';
    startX = e.clientX;
    startSize = readVarPx('--props-w');
    resizeRight.classList.add('dragging');
    e.preventDefault();
  });

  resizeTimeline.addEventListener('mousedown', (e) => {
    dragging = 'timeline';
    startY = e.clientY;
    startSize = readVarPx('--tl-h');
    resizeTimeline.classList.add('dragging');
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!dragging) return;

    if (dragging === 'left') {
      const next = clamp(startSize + (e.clientX - startX), LIB_MIN, LIB_MAX);
      root.style.setProperty('--lib-w', `${next}px`);
    } else if (dragging === 'right') {
      const next = clamp(startSize - (e.clientX - startX), PROPS_MIN, PROPS_MAX);
      root.style.setProperty('--props-w', `${next}px`);
    } else if (dragging === 'timeline') {
      const next = clamp(startSize - (e.clientY - startY), TL_MIN, TL_MAX);
      root.style.setProperty('--tl-h', `${next}px`);
    }
  });

  document.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = null;
    resizeLeft.classList.remove('dragging');
    resizeRight.classList.remove('dragging');
    resizeTimeline.classList.remove('dragging');
    resizePreviewCanvas();
    updateCachedContainerWidth();
  });
}

function wireTopRail() {
  const els = getElements();
  const sceneNameInput = /** @type {HTMLInputElement} */ (els.sceneNameInput);

  // ----- Scene-name input -----
  // Persisting the typed name ties into a future scene-rename feature; for now we
  // just trim and reflect (so empty input falls back to the placeholder name).
  sceneNameInput.addEventListener('change', () => {
    const next = sceneNameInput.value.trim() || 'Untitled Scene';
    sceneNameInput.value = next;
  });

  // ----- Saved-time pill -----
  /**
   * @param {number | null} ts
   * @returns {string}
   */
  function formatRelative(ts) {
    if (!ts) return 'unsaved';
    const sec = Math.max(0, Math.round((Date.now() - ts) / 1000));
    if (sec < 5) return 'saved just now';
    if (sec < 60) return `saved ${sec}s ago`;
    const min = Math.round(sec / 60);
    if (min < 60) return `saved ${min}m ago`;
    const hr = Math.round(min / 60);
    return `saved ${hr}h ago`;
  }

  /** @type {number | null} */
  let lastSaveTs = null;
  function refreshSavedTime() {
    els.sceneSavedTime.textContent = formatRelative(lastSaveTs);
  }
  eventBus.on(Events.AUTOSAVE_SUCCESS, (/** @type {{ timestamp: number }} */ payload) => {
    lastSaveTs = payload.timestamp;
    refreshSavedTime();
  });
  // Tick every 10s so "12s ago" / "2m ago" stays current without re-emitting.
  setInterval(refreshSavedTime, 10_000);

  // ----- Scene/project path → folder name + scene-name input default -----
  function refreshScenePath() {
    const proj = state.projectPath;
    const scene = state.currentScenePath;
    els.sceneFolderName.textContent = proj ? proj.split(/[\\/]/).filter(Boolean).pop() || 'project' : 'no project';
    if (scene && document.activeElement !== sceneNameInput) {
      const base = scene.split(/[\\/]/).pop() || '';
      sceneNameInput.value = base.replace(/\.mzscene$/i, '') || 'Untitled Scene';
    }
  }
  eventBus.on(Events.SCENE_PATH_CHANGED, refreshScenePath);
  eventBus.on(Events.PROJECT_LOADED, refreshScenePath);
  refreshScenePath();

  // ----- Segmented control (visual only — Plan F wires real behavior) -----
  /** @type {HTMLElement[]} */
  const segs = [els.segDesign, els.segPreview, els.segInspect];
  for (const seg of segs) {
    seg.addEventListener('click', () => {
      for (const s of segs) {
        const isActive = s === seg;
        s.classList.toggle('is-active', isActive);
        s.setAttribute('aria-selected', String(isActive));
      }
    });
  }

  // ----- Settings stub (Plan F provides the panel) -----
  els.btnSettings.addEventListener('click', () => {
    logger.info('Settings panel TBD (Plan F)');
  });

  // ----- Recent button mirrors the existing recent-projects dropdown -----
  els.btnRecent.addEventListener('click', () => {
    const dd = document.getElementById('recent-projects-dropdown');
    if (dd) dd.classList.toggle('is-open');
  });
}

function init() {
  // Initialize DOM elements cache
  const elements = initElements();

  // Log startup
  logger.info('Timeline Scene Builder initializing...');

  // Set up event bus listeners for rendering
  setupEventBusListeners();

  // Set up property delegation
  setupPropertyDelegation(elements.propertiesPanel);

  // Keyboard save callback (not render-related)
  setSaveCallback(saveScene);

  // Toolbar buttons
  elements.openProject.addEventListener('click', openProject);
  elements.newScene.addEventListener('click', newScene);
  elements.loadScene.addEventListener('click', loadScene);
  elements.saveScene.addEventListener('click', saveScene);
  elements.exportMap.addEventListener('click', openExportModal);
  elements.quickExport.addEventListener('click', quickExport);

  // Event buttons
  elements.addPicture.addEventListener('click', () => {
    addEvent('showPicture');
    renderProperties();
  });
  elements.addMove.addEventListener('click', () => {
    addEvent('movePicture');
    renderProperties();
  });
  elements.addRotate.addEventListener('click', () => {
    addEvent('rotatePicture');
    renderProperties();
  });
  elements.addTint.addEventListener('click', () => {
    addEvent('tintPicture');
    renderProperties();
  });
  elements.addErase.addEventListener('click', () => {
    addEvent('erasePicture');
    renderProperties();
  });
  elements.addText.addEventListener('click', () => {
    addEvent('showText');
    renderProperties();
  });
  elements.addWait.addEventListener('click', () => {
    addEvent('wait');
    renderProperties();
  });
  elements.addFlash.addEventListener('click', () => {
    addEvent('screenFlash');
    renderProperties();
  });
  elements.deleteEvent.addEventListener('click', () => {
    deleteSelectedEvent();
    renderProperties();
  });
  elements.clearScene.addEventListener('click', () => {
    clearScene().catch((err) => logger.error('clearScene failed:', err));
  });

  // Timeline controls
  elements.btnPlay.addEventListener('click', togglePlayback);
  elements.btnStop.addEventListener('click', stopPlayback);
  elements.timelineTrack.addEventListener('click', (e) => {
    onTimelineClick(e);
    renderPreviewAtFrame(state.currentFrame);
  });
  const lengthInput = /** @type {HTMLInputElement} */ (elements.timelineLengthInput);
  lengthInput.addEventListener('change', () => {
    state.timelineLength = Math.max(60, parseInt(lengthInput.value, 10) || 300);
    lengthInput.value = String(state.timelineLength);
    markDirty();
    renderTimeline();
  });

  // Initialize timeline
  initTimeline();

  // Search (debounced for large image sets)
  let searchTimer = null;
  elements.imageSearch.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(filterImages, 150);
  });

  // Keyboard controls
  document.addEventListener('keydown', handleKeyboardMove);

  // Export modal (custom dropdowns)
  initExportDropdowns();
  elements.doExport.addEventListener('click', doExportToMap);

  // Modal close buttons
  const btnCloseImagePicker = document.getElementById('btn-close-image-picker');
  const btnCloseExportModal = document.getElementById('btn-close-export-modal');
  const btnCancelExport = document.getElementById('btn-cancel-export');
  if (btnCloseImagePicker) btnCloseImagePicker.addEventListener('click', closeImagePicker);
  if (btnCloseExportModal) btnCloseExportModal.addEventListener('click', closeExportModal);
  if (btnCancelExport) btnCancelExport.addEventListener('click', closeExportModal);

  // Grid toggle buttons
  const btnGrid = document.getElementById('btn-toggle-grid');
  const btnSnap = document.getElementById('btn-toggle-snap');
  if (btnGrid) btnGrid.addEventListener('click', toggleGrid);
  if (btnSnap) btnSnap.addEventListener('click', toggleSnapToGrid);

  // About and Help modals
  const btnAbout = document.getElementById('btn-about');
  const btnHelp = document.getElementById('btn-help');
  if (btnAbout) btnAbout.addEventListener('click', showAboutModal);
  if (btnHelp) btnHelp.addEventListener('click', showShortcutsModal);

  // Initialize features
  initDragDrop();
  updateRecentProjectsDropdown();
  initRecentProjectsDropdown();
  initMinimapEvents();
  initResizeHandles();
  wireTopRail();

  // Initial preview canvas resize
  requestAnimationFrame(() => resizePreviewCanvas());

  // Autosave
  startAutosave();

  // Check for autosave recovery on startup
  setTimeout(() => checkAutosaveRecovery(openProjectPath), 500);

  // Clean up on close
  window.addEventListener('beforeunload', () => {
    stopPlayback();
    stopAutosave();
    teardownMinimapEvents();
  });

  logger.info('Timeline Scene Builder initialized');
}

export { init, render };
