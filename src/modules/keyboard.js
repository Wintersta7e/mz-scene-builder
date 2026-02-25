// ============================================
// Keyboard Shortcuts
// ============================================

const { state } = require('./state');
const { getElements } = require('./elements');
const { sortEvents } = require('./utils');
const { undo, redo, saveState } = require('./undo-redo');
const { selectEvent, duplicateSelectedEvent, deleteSelectedEvent, addEvent } = require('./events');
const { showShortcutsModal } = require('./modals');
const { logger } = require('./logger');
const { eventBus, Events } = require('./event-bus');

let saveSceneCallback = null;

function setSaveCallback(callback) {
  saveSceneCallback = callback;
}

function handleKeyboardMove(e) {
  const elements = getElements();

  // Don't handle if typing in an input/textarea
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
    return;
  }

  // F1 - Show shortcuts help
  if (e.key === 'F1') {
    e.preventDefault();
    showShortcutsModal();
    return;
  }

  // Ctrl+Z - Undo
  if (e.key === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
    e.preventDefault();
    undo();
    return;
  }

  // Ctrl+Shift+Z or Ctrl+Y - Redo
  if ((e.key === 'z' && (e.ctrlKey || e.metaKey) && e.shiftKey) ||
      (e.key === 'y' && (e.ctrlKey || e.metaKey))) {
    e.preventDefault();
    redo();
    return;
  }

  // Ctrl+D - Duplicate selected event
  if (e.key === 'd' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    duplicateSelectedEvent();
    return;
  }

  // Ctrl+S - Save scene
  if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    if (saveSceneCallback) saveSceneCallback();
    return;
  }

  // Ctrl+T - Insert text box
  if (e.key === 't' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    addEvent('showText');
    return;
  }

  // Ctrl+P - Insert picture
  if (e.key === 'p' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    addEvent('showPicture');
    return;
  }

  // Delete key - delete selected event
  if (e.key === 'Delete') {
    if (state.selectedEventIndex >= 0) {
      e.preventDefault();
      deleteSelectedEvent();
      eventBus.emit(Events.RENDER);
    }
    return;
  }

  // Ctrl+C - copy selected event
  if (e.key === 'c' && (e.ctrlKey || e.metaKey)) {
    if (state.selectedEventIndex >= 0) {
      e.preventDefault();
      state.clipboardEvent = JSON.parse(JSON.stringify(state.events[state.selectedEventIndex]));
      logger.debug('Copied event:', state.clipboardEvent.type);
    }
    return;
  }

  // Ctrl+V - paste event at current frame
  if (e.key === 'v' && (e.ctrlKey || e.metaKey)) {
    if (state.clipboardEvent) {
      e.preventDefault();
      saveState('paste event');
      const newEvent = JSON.parse(JSON.stringify(state.clipboardEvent));
      newEvent.startFrame = state.currentFrame;

      if (newEvent.type === 'showText') {
        const textEvents = state.events.filter(evt => evt.type === 'showText');
        if (textEvents.length > 0) {
          const lastText = textEvents.reduce((a, b) =>
            (a.startFrame || 0) > (b.startFrame || 0) ? a : b
          );
          if (newEvent.startFrame <= (lastText.startFrame || 0)) {
            newEvent.startFrame = (lastText.startFrame || 0) + 10;
          }
        }
      }

      state.events.push(newEvent);
      sortEvents(state.events);
      selectEvent(state.events.indexOf(newEvent));
      eventBus.emit(Events.RENDER);
      logger.debug('Pasted event:', newEvent.type);
    }
    return;
  }

  // Ctrl+Arrow Left/Right - Move playhead
  if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    const step = e.shiftKey ? 1 : 10;
    if (e.key === 'ArrowLeft') {
      state.currentFrame = Math.max(0, state.currentFrame - step);
    } else {
      state.currentFrame = Math.min(state.timelineLength, state.currentFrame + step);
    }
    eventBus.emit(Events.RENDER);
    return;
  }

  // Only handle arrow keys for movement
  if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
    return;
  }

  if (state.selectedEventIndex < 0) return;
  const evt = state.events[state.selectedEventIndex];
  if (!evt || (evt.type !== 'showPicture' && evt.type !== 'movePicture')) return;

  e.preventDefault();

  const step = e.shiftKey ? 10 : 1;

  switch (e.key) {
    case 'ArrowUp':
      evt.y -= step;
      break;
    case 'ArrowDown':
      evt.y += step;
      break;
    case 'ArrowLeft':
      evt.x -= step;
      break;
    case 'ArrowRight':
      evt.x += step;
      break;
  }

  // Update image position directly
  const { getPreviewScale } = require('./preview/index');
  const scale = getPreviewScale();
  const imgEl = elements.previewCanvas.querySelector(`img[data-event-index="${state.selectedEventIndex}"]`);
  if (imgEl) {
    imgEl.style.left = `${evt.x * scale}px`;
    imgEl.style.top = `${evt.y * scale}px`;
  }

  // Update properties panel
  const xInput = document.getElementById('prop-x');
  const yInput = document.getElementById('prop-y');
  if (xInput) xInput.value = evt.x;
  if (yInput) yInput.value = evt.y;
}

module.exports = { handleKeyboardMove, setSaveCallback };
