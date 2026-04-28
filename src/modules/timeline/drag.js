// ============================================
// Timeline Event Dragging
// ============================================

import { state } from '../state.js';
import { getElements } from '../elements.js';
import { saveState, markDirty } from '../undo-redo.js';
import { sortEvents } from '../utils.js';
import { selectEvent, getEventDuration } from '../events.js';
import { eventBus, Events } from '../event-bus.js';
import { logger } from '../logger.js';
import { renderProperties } from '../properties/index.js';

function startTimelineDrag(e, evt, index) {
  if (e.button !== 0) return;

  saveState('move event on timeline');
  selectEvent(index);

  state.timelineDragEvt = evt;
  state.timelineDragIndex = index;
  state.timelineDragStartX = e.clientX;
  state.timelineDragStartFrame = evt.startFrame || 0;

  const onDrag = (ev) => onTimelineDrag(ev);
  const onStop = () => stopTimelineDrag(onDrag, onStop);

  document.addEventListener('mousemove', onDrag);
  document.addEventListener('mouseup', onStop);
  e.preventDefault();
  e.stopPropagation();
}

function onTimelineDrag(e) {
  if (!state.timelineDragEvt) return;

  const deltaX = e.clientX - state.timelineDragStartX;
  const deltaFrames = Math.round(deltaX / state.timelineScale);
  let newFrame = Math.max(0, state.timelineDragStartFrame + deltaFrames);

  if (!e.shiftKey) {
    newFrame = Math.round(newFrame / 10) * 10;
  }

  state.timelineDragEvt.startFrame = newFrame;

  // Lightweight update: only move the dragged element instead of full DOM rebuild
  const elements = getElements();
  const el = elements.timelineEvents.querySelector(`.event-block[data-event-index="${state.timelineDragIndex}"]`);
  if (el) {
    el.style.left = `${newFrame * state.timelineScale}px`;
  }
}

function stopTimelineDrag(onDrag, onStop) {
  const draggedEvt = state.timelineDragEvt;
  const draggedIdx = state.timelineDragIndex;
  const originalFrame = state.timelineDragStartFrame;
  const selectedEvt = state.selectedEventIndex >= 0 ? state.events[state.selectedEventIndex] : null;

  state.timelineDragEvt = null;
  state.timelineDragIndex = -1;
  document.removeEventListener('mousemove', onDrag);
  document.removeEventListener('mouseup', onStop);

  // For text events: prevent stacking
  if (draggedEvt && draggedEvt.type === 'showText') {
    const draggedStart = draggedEvt.startFrame || 0;
    const overlappingText = state.events.find(
      (evt, idx) => idx !== draggedIdx && evt.type === 'showText' && Math.abs((evt.startFrame || 0) - draggedStart) < 10
    );
    if (overlappingText) {
      logger.debug('Text event overlap detected, reverting to frame', originalFrame);
      draggedEvt.startFrame = originalFrame;
    }
  }

  sortEvents(state.events);
  state.selectedEventIndex = recoverSelectedIndex(state.events, selectedEvt);

  markDirty();

  eventBus.emit(Events.RENDER_TIMELINE);

  // Update properties
  renderProperties();
}

// ============================================
// Edge-handle resize
// ============================================

/**
 * @param {{ type: string }} evt
 * @returns {string | null} the field name on `evt` that holds its visual
 *   duration in frames, or null if the event type doesn't support resize.
 */
function durationField(evt) {
  if (evt.type === 'wait') return 'frames';
  if (
    evt.type === 'showPicture' ||
    evt.type === 'movePicture' ||
    evt.type === 'tintPicture' ||
    evt.type === 'screenFlash'
  ) {
    return 'duration';
  }
  return null; // showText, rotatePicture, erasePicture: no resize
}

const MIN_LENGTH = 8; // frames

/**
 * Pure resize math for an event block — no DOM, no state mutation.
 * Used by startTimelineResize at every mousemove tick. Extracted so
 * unit tests can verify the contract (preserve right edge, preserve
 * start, never go negative, min length 8).
 *
 * @param {{
 *   edge: 'left' | 'right';
 *   startFrame: number;
 *   startDur: number;
 *   deltaFrames: number;
 *   minLength?: number;
 * }} args
 * @returns {{ startFrame: number; duration: number }}
 */
/**
 * After a sort that may have reordered the events array, recover the new
 * index of the previously-selected event by reference equality. Returns
 * -1 if there was no selection or the event no longer exists in the array.
 *
 * @param {Array<any>} events
 * @param {any | null} selectedEvt — event reference captured BEFORE the sort
 * @returns {number}
 */
function recoverSelectedIndex(events, selectedEvt) {
  return selectedEvt ? events.indexOf(selectedEvt) : -1;
}

function computeResize({ edge, startFrame, startDur, deltaFrames, minLength = MIN_LENGTH }) {
  const startRight = startFrame + startDur;
  if (edge === 'right') {
    return { startFrame, duration: Math.max(minLength, startDur + deltaFrames) };
  }
  // left edge: keep right edge anchored
  let newStart = startFrame + deltaFrames;
  if (newStart > startRight - minLength) newStart = startRight - minLength;
  if (newStart < 0) newStart = 0;
  return { startFrame: newStart, duration: startRight - newStart };
}

/**
 * @param {MouseEvent} e
 * @param {any} evt
 * @param {number} index
 * @param {'left' | 'right'} edge
 */
function startTimelineResize(e, evt, index, edge) {
  if (e.button !== 0) return;
  const field = durationField(evt);
  if (!field) return; // no-op for non-resizable types

  saveState(`resize event ${edge} edge`);
  selectEvent(index);

  const startX = e.clientX;
  const startFrame = evt.startFrame || 0;
  const startDur = getEventDuration(evt.type, evt);

  state.timelineDragEvt = evt;
  state.timelineDragIndex = index;

  const onMove = (ev) => {
    const deltaPx = ev.clientX - startX;
    const deltaFrames = Math.round(deltaPx / state.timelineScale);

    const result = computeResize({ edge, startFrame, startDur, deltaFrames });
    evt.startFrame = result.startFrame;
    evt[field] = result.duration;

    // Optimistic visual update
    const elements = getElements();
    const el = /** @type {HTMLElement | null} */ (
      elements.timelineEvents.querySelector(`.event-block[data-event-index="${index}"]`)
    );
    if (el) {
      const px = state.timelineScale;
      el.style.left = `${(evt.startFrame || 0) * px}px`;
      el.style.width = `${(evt[field] || MIN_LENGTH) * px}px`;
    }
  };

  const onStop = () => {
    // Capture the selected event reference before sortEvents potentially
    // reorders the array, then re-resolve its new index afterwards.
    const selectedEvt = state.selectedEventIndex >= 0 ? state.events[state.selectedEventIndex] : null;

    state.timelineDragEvt = null;
    state.timelineDragIndex = -1;
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onStop);
    sortEvents(state.events);
    state.selectedEventIndex = recoverSelectedIndex(state.events, selectedEvt);

    markDirty();
    eventBus.emit(Events.RENDER_TIMELINE);
    renderProperties();
  };

  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onStop);
  e.preventDefault();
  e.stopPropagation();
}

export { startTimelineDrag, startTimelineResize, computeResize, recoverSelectedIndex };
