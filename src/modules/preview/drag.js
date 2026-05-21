// ============================================
// Preview Image Dragging
// ============================================

import { state } from '../state.js';
import { getElements } from '../elements.js';
import { saveState, markDirty } from '../undo-redo.js';
import { eventBus, Events } from '../event-bus.js';
import { clamp } from '../utils.js';

/**
 * @param {number} clientX
 * @param {number} clientY
 */
function findImagesAtPoint(clientX, clientY) {
  const elements = getElements();
  const images = /** @type {NodeListOf<HTMLElement>} */ (elements.previewCanvas.querySelectorAll('.stage-pic'));
  /** @type {number[]} */
  const result = [];

  for (const img of images) {
    const rect = img.getBoundingClientRect();
    if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) {
      result.push(parseInt(img.dataset.eventIndex || '-1', 10));
    }
  }

  return result;
}

/**
 * @param {HTMLElement} img
 * @param {TimelineEvent} evt
 */
function updateImagePosition(img, evt) {
  img.style.left = `${((evt.x || 0) / state.screenWidth) * 100}%`;
  img.style.top = `${((evt.y || 0) / state.screenHeight) * 100}%`;
  img.style.transform = `scale(${(evt.scaleX || 100) / 100}, ${(evt.scaleY || 100) / 100})`;
  img.style.transformOrigin = evt.origin === 1 ? 'center' : 'top left';
  img.style.opacity = String((evt.opacity || 0) / 255);
  img.style.mixBlendMode = ['normal', 'lighten', 'multiply', 'screen'][evt.blend || 0] || 'normal';
}

function highlightSelectedImage() {
  document.querySelectorAll('.stage-pic, .stage-text').forEach((el) => {
    el.classList.toggle(
      'is-selected',
      parseInt(/** @type {HTMLElement} */ (el).dataset.eventIndex || '-1', 10) === state.selectedEventIndex
    );
  });
}

/**
 * @param {MouseEvent} e
 * @param {HTMLElement} img
 * @param {TimelineEvent} evt
 * @param {number} eventIndex
 */
function startDrag(e, img, evt, eventIndex) {
  if (e.button !== 0) return;

  saveState('move image');

  // Snapshot the live frame dimensions so onDrag can convert mouse pixels
  // to MZ-native event pixels. Recomputed at startDrag, not per onDrag.
  const elements = getElements();
  const rect = elements.previewCanvas.getBoundingClientRect();

  state.isDragging = true;
  state.dragImg = img;
  state.dragEvt = evt;
  state.dragEventIndex = eventIndex;
  state.dragStartX = e.clientX;
  state.dragStartY = e.clientY;
  state.dragStartEvtX = evt.x || 0;
  state.dragStartEvtY = evt.y || 0;
  // Stash live conversion factors on the state object so onDrag uses
  // the same values for the whole gesture.
  state._dragPxPerMzX = rect.width / state.screenWidth;
  state._dragPxPerMzY = rect.height / state.screenHeight;

  document.body.style.cursor = 'move';

  document.addEventListener('mousemove', onDrag);
  document.addEventListener('mouseup', stopDrag);
  e.preventDefault();
}

/** @param {MouseEvent} e */
function onDrag(e) {
  if (!state.isDragging || !state.dragEvt || !state.dragImg) return;

  const pxPerMzX = state._dragPxPerMzX || 1;
  const pxPerMzY = state._dragPxPerMzY || 1;

  // Mouse delta in screen pixels -> MZ-native event pixels
  const dxMz = (e.clientX - state.dragStartX) / pxPerMzX;
  const dyMz = (e.clientY - state.dragStartY) / pxPerMzY;

  let newX = state.dragStartEvtX + dxMz;
  let newY = state.dragStartEvtY + dyMz;

  // Snap to the design's 30x17 cell grid when state.snapToGrid is on.
  if (state.snapToGrid) {
    const cellX = state.screenWidth / 30;
    const cellY = state.screenHeight / 17;
    newX = Math.round(newX / cellX) * cellX;
    newY = Math.round(newY / cellY) * cellY;
  }

  newX = Math.round(newX);
  newY = Math.round(newY);

  // Clamp to a generous box around the visible frame so dragged sprites
  // don't disappear off the page.
  const margin = Math.max(state.screenWidth, state.screenHeight) / 2;
  newX = clamp(newX, -margin, state.screenWidth + margin);
  newY = clamp(newY, -margin, state.screenHeight + margin);

  state.dragEvt.x = newX;
  state.dragEvt.y = newY;

  updateImagePosition(state.dragImg, state.dragEvt);

  if (state.dragEventIndex === state.selectedEventIndex) {
    const xInput = /** @type {HTMLInputElement | null} */ (document.getElementById('prop-x'));
    const yInput = /** @type {HTMLInputElement | null} */ (document.getElementById('prop-y'));
    if (xInput) xInput.value = String(state.dragEvt.x);
    if (yInput) yInput.value = String(state.dragEvt.y);
  }
}

function stopDrag() {
  if (!state.isDragging) return;

  state.isDragging = false;
  document.body.style.cursor = '';

  document.removeEventListener('mousemove', onDrag);
  document.removeEventListener('mouseup', stopDrag);

  markDirty();
  eventBus.emit(Events.RENDER_TIMELINE);
}

export { findImagesAtPoint, updateImagePosition, highlightSelectedImage, startDrag };
