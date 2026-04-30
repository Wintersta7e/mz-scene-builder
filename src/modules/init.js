// ============================================
// Initialization & Event Binding
// ============================================

import { state } from './state.js';
import { initElements, getElements } from './elements.js';
import { logger } from './logger.js';
import { eventBus, Events } from './event-bus.js';
import { addEvent, deleteSelectedEvent, duplicateSelectedEvent, clearScene } from './events.js';
import { initDragDrop, newScene, loadScene, saveScene } from './file-ops.js';
import { openProject, openProjectPath } from './project.js';
import { updateRecentProjectsDropdown, initRecentProjectsDropdown } from './settings.js';
import { toggleGrid, toggleSnapToGrid } from './grid.js';
import { showAboutModal, showShortcutsModal } from './modals.js';
import { startAutosave, stopAutosave, checkAutosaveRecovery } from './autosave.js';
import { initTimeline, renderTimeline, onTimelineClick, updateTimelineCursor } from './timeline/index.js';
import { initMinimapEvents, teardownMinimapEvents, updateCachedContainerWidth } from './timeline/minimap.js';
import { renderProperties } from './properties/index.js';
import { renderPreviewAtFrame, resizePreviewCanvas, updateStageGeometry } from './preview/index.js';
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
  // Project loaded - resize preview, update geometry + quick export button
  eventBus.on(Events.PROJECT_LOADED, () => {
    resizePreviewCanvas();
    updateStageGeometry();
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
  const mainEl = document.querySelector('.main');
  for (const seg of segs) {
    seg.addEventListener('click', () => {
      for (const s of segs) {
        s.classList.toggle('is-active', s === seg);
      }

      const mode = seg.dataset.mode || 'design';
      if (mainEl) {
        mainEl.classList.remove('mode-design', 'mode-preview', 'mode-inspect');
        mainEl.classList.add(`mode-${mode}`);
      }

      // Resize the preview canvas + minimap to fit the new layout
      // (deferred so the new grid template applies first).
      requestAnimationFrame(() => {
        resizePreviewCanvas();
        updateCachedContainerWidth();
      });
    });
  }

  // ----- Settings stub (Plan F provides the panel) -----
  els.btnSettings.addEventListener('click', () => {
    logger.info('Settings panel TBD (Plan F)');
  });

  // ----- Recent button toggles the recent-projects dropdown -----
  els.btnRecent.addEventListener('click', (e) => {
    const dd = document.getElementById('recent-projects-dropdown');
    if (!dd) return;
    dd.classList.toggle('is-open');
    e.stopPropagation();
  });
  // Close the dropdown on any click outside both the trigger and the list.
  // Uses composedPath so a click on a descendant of either still counts as
  // "inside" — `e.target` alone may be an inner span / icon, which fooled
  // the previous `e.target !== btnRecent` check.
  document.addEventListener('click', (e) => {
    const dd = document.getElementById('recent-projects-dropdown');
    if (!dd || !dd.classList.contains('is-open')) return;
    const path = e.composedPath();
    if (!path.includes(dd) && !path.includes(els.btnRecent)) {
      dd.classList.remove('is-open');
    }
  });
}

function init() {
  // Initialize DOM elements cache
  const elements = initElements();

  // Log startup
  logger.info('Timeline Scene Builder initializing...');

  // Set up event bus listeners for rendering
  setupEventBusListeners();

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
  elements.duplicateEvent.addEventListener('click', () => {
    duplicateSelectedEvent();
    renderProperties();
  });
  elements.clearScene.addEventListener('click', () => {
    clearScene().catch((err) => logger.error('clearScene failed:', err));
  });

  // Timeline controls
  elements.btnPlay.addEventListener('click', togglePlayback);
  elements.btnStop.addEventListener('click', stopPlayback);

  // Skip transport buttons (60 frames = 1 second)
  const btnSkipBack = document.getElementById('btn-skip-back');
  const btnSkipFwd = document.getElementById('btn-skip-fwd');
  if (btnSkipBack) {
    btnSkipBack.addEventListener('click', () => {
      state.currentFrame = Math.max(0, state.currentFrame - 60);
      eventBus.emit(Events.RENDER_PREVIEW, state.currentFrame);
      updateTimelineCursor();
    });
  }
  if (btnSkipFwd) {
    btnSkipFwd.addEventListener('click', () => {
      state.currentFrame = Math.min(state.timelineLength, state.currentFrame + 60);
      eventBus.emit(Events.RENDER_PREVIEW, state.currentFrame);
      updateTimelineCursor();
    });
  }

  // Play button — visual is-playing class mirrors state.isPlaying. Refreshed
  // on every RENDER_PREVIEW emit (which fires on play/pause/stop transitions
  // and on every frame tick during playback).
  function refreshPlayButtonState() {
    if (elements.btnPlay) {
      elements.btnPlay.classList.toggle('is-playing', state.isPlaying);
    }
  }
  eventBus.on(Events.RENDER_PREVIEW, refreshPlayButtonState);
  refreshPlayButtonState();

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

  // Grid + Snap toggle buttons — visual .is-on state mirrors state.gridVisible
  // and state.snapToGrid (driven by toggleGrid / toggleSnapToGrid which flip
  // the underlying state booleans).
  const btnGrid = document.getElementById('btn-toggle-grid');
  const btnSnap = document.getElementById('btn-toggle-snap');
  function refreshStageToggles() {
    if (btnGrid) btnGrid.classList.toggle('is-on', state.gridVisible);
    if (btnSnap) btnSnap.classList.toggle('is-on', state.snapToGrid);
  }
  if (btnGrid) {
    btnGrid.addEventListener('click', () => {
      toggleGrid();
      refreshStageToggles();
    });
  }
  if (btnSnap) {
    btnSnap.addEventListener('click', () => {
      toggleSnapToGrid();
      refreshStageToggles();
    });
  }
  refreshStageToggles(); // initial sync

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

  // Initial preview canvas resize + geometry sync
  requestAnimationFrame(() => {
    resizePreviewCanvas();
    updateStageGeometry();
  });

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
