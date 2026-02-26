// ============================================
// Initialization & Event Binding
// ============================================

import { state } from './state.js';
import { initElements } from './elements.js';
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
import { initMinimapEvents } from './timeline/minimap.js';
import { renderProperties } from './properties/index.js';
import { setupPropertyDelegation } from './properties/bind-input.js';
import { renderPreviewAtFrame, resizePreviewCanvas } from './preview/index.js';
import { closeImagePicker } from './preview/image-picker.js';
import { filterImages } from './preview/image-browser.js';
import { togglePlayback, stopPlayback } from './playback.js';
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
  eventBus.on(Events.RENDER_PREVIEW, (frame) => {
    renderPreviewAtFrame(frame !== undefined ? frame : state.currentFrame);
  });
  eventBus.on(Events.RENDER_PROPERTIES, renderProperties);

  // Project loaded - resize preview and update quick export button
  eventBus.on(Events.PROJECT_LOADED, () => {
    resizePreviewCanvas();
    updateQuickExportButton();
  });

  // Scene loaded - full render
  eventBus.on(Events.SCENE_LOADED, render);

  // Recent project opened (mediator for settings -> project circular dependency)
  eventBus.on(Events.OPEN_RECENT_PROJECT, (path) => {
    openProjectPath(path);
  });
}

function initResizeHandles() {
  const leftPanel = document.getElementById('panel-left');
  const rightPanel = document.getElementById('panel-right');
  const timelinePanel = document.getElementById('panel-timeline');
  const resizeLeft = document.getElementById('resize-left');
  const resizeRight = document.getElementById('resize-right');
  const resizeTimeline = document.getElementById('resize-timeline');

  let isResizing = false;
  let currentHandle = null;
  let startX, startY, startWidth, startHeight;

  resizeLeft.addEventListener('mousedown', (e) => {
    isResizing = true;
    currentHandle = 'left';
    startX = e.clientX;
    startWidth = leftPanel.offsetWidth;
    resizeLeft.classList.add('dragging');
    e.preventDefault();
  });

  resizeRight.addEventListener('mousedown', (e) => {
    isResizing = true;
    currentHandle = 'right';
    startX = e.clientX;
    startWidth = rightPanel.offsetWidth;
    resizeRight.classList.add('dragging');
    e.preventDefault();
  });

  resizeTimeline.addEventListener('mousedown', (e) => {
    isResizing = true;
    currentHandle = 'timeline';
    startY = e.clientY;
    startHeight = timelinePanel.offsetHeight;
    resizeTimeline.classList.add('dragging');
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;

    if (currentHandle === 'left') {
      const newWidth = startWidth + (e.clientX - startX);
      leftPanel.style.width = `${Math.max(150, Math.min(400, newWidth))}px`;
    } else if (currentHandle === 'right') {
      const newWidth = startWidth - (e.clientX - startX);
      rightPanel.style.width = `${Math.max(180, Math.min(400, newWidth))}px`;
    } else if (currentHandle === 'timeline') {
      const newHeight = startHeight - (e.clientY - startY);
      timelinePanel.style.height = `${Math.max(150, Math.min(500, newHeight))}px`;
    }
  });

  document.addEventListener('mouseup', () => {
    if (isResizing) {
      isResizing = false;
      resizeLeft.classList.remove('dragging');
      resizeRight.classList.remove('dragging');
      resizeTimeline.classList.remove('dragging');
      currentHandle = null;
      resizePreviewCanvas();
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
  elements.clearScene.addEventListener('click', clearScene);

  // Timeline controls
  elements.btnPlay.addEventListener('click', togglePlayback);
  elements.btnStop.addEventListener('click', stopPlayback);
  elements.timelineTrack.addEventListener('click', (e) => {
    onTimelineClick(e);
    renderPreviewAtFrame(state.currentFrame);
  });
  elements.timelineLengthInput.addEventListener('change', () => {
    state.timelineLength = Math.max(60, parseInt(elements.timelineLengthInput.value) || 300);
    elements.timelineLengthInput.value = state.timelineLength;
    renderTimeline();
  });

  // Initialize timeline
  initTimeline();

  // Search
  elements.imageSearch.addEventListener('input', filterImages);

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

  // Initial preview canvas resize
  requestAnimationFrame(() => resizePreviewCanvas());

  // Autosave
  startAutosave();

  // Check for autosave recovery on startup
  setTimeout(() => checkAutosaveRecovery(openProjectPath), 500);

  // Clean up on close
  window.addEventListener('beforeunload', () => {
    stopAutosave();
  });

  logger.info('Timeline Scene Builder initialized');
}

export { init, render };
