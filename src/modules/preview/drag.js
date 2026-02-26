// ============================================
// Preview Image Dragging
// ============================================

import { state } from '../state.js';
import { getElements } from '../elements.js';
import { saveState, markDirty } from '../undo-redo.js';
import { snapPosition } from '../grid.js';
import { eventBus, Events } from '../event-bus.js';

function getPreviewScale() {
  const elements = getElements();
  return elements.previewCanvas.offsetWidth / state.screenWidth;
}

function findImagesAtPoint(clientX, clientY) {
  const elements = getElements();
  const images = elements.previewCanvas.querySelectorAll('.preview-image');
  const result = [];

  for (const img of images) {
    const rect = img.getBoundingClientRect();
    if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) {
      result.push(parseInt(img.dataset.eventIndex));
    }
  }

  return result;
}

function updateImagePosition(img, evt) {
  const scale = getPreviewScale();

  img.style.left = evt.x * scale + 'px';
  img.style.top = evt.y * scale + 'px';
  img.style.transform = `scale(${(evt.scaleX / 100) * scale}, ${(evt.scaleY / 100) * scale})`;
  img.style.transformOrigin = evt.origin === 1 ? 'center' : 'top left';
  img.style.opacity = evt.opacity / 255;
  img.style.mixBlendMode = ['normal', 'lighten', 'multiply', 'screen'][evt.blend] || 'normal';
}

function highlightSelectedImage() {
  document.querySelectorAll('.preview-image, .preview-text').forEach((el) => {
    el.classList.toggle('selected', parseInt(el.dataset.eventIndex) === state.selectedEventIndex);
  });
}

function startDrag(e, img, evt, eventIndex) {
  if (e.button !== 0) return;

  saveState('move image');

  state.isDragging = true;
  state.dragImg = img;
  state.dragEvt = evt;
  state.dragEventIndex = eventIndex;
  state.dragStartX = e.clientX;
  state.dragStartY = e.clientY;
  state.dragStartEvtX = evt.x;
  state.dragStartEvtY = evt.y;

  img.classList.add('dragging');
  document.body.style.cursor = 'move';

  document.addEventListener('mousemove', onDrag);
  document.addEventListener('mouseup', stopDrag);
  e.preventDefault();
}

function onDrag(e) {
  if (!state.isDragging) return;

  const scale = getPreviewScale();
  const deltaX = (e.clientX - state.dragStartX) / scale;
  const deltaY = (e.clientY - state.dragStartY) / scale;

  let newX = Math.round(state.dragStartEvtX + deltaX);
  let newY = Math.round(state.dragStartEvtY + deltaY);

  if (state.snapToGrid) {
    newX = snapPosition(newX);
    newY = snapPosition(newY);
  }

  const margin = Math.max(state.screenWidth, state.screenHeight) / 2;
  newX = Math.max(-margin, Math.min(state.screenWidth + margin, newX));
  newY = Math.max(-margin, Math.min(state.screenHeight + margin, newY));

  state.dragEvt.x = newX;
  state.dragEvt.y = newY;

  updateImagePosition(state.dragImg, state.dragEvt);

  if (state.dragEventIndex === state.selectedEventIndex) {
    const xInput = document.getElementById('prop-x');
    const yInput = document.getElementById('prop-y');
    if (xInput) xInput.value = state.dragEvt.x;
    if (yInput) yInput.value = state.dragEvt.y;
  }
}

function stopDrag() {
  if (!state.isDragging) return;

  state.isDragging = false;
  state.dragImg.classList.remove('dragging');
  document.body.style.cursor = '';

  document.removeEventListener('mousemove', onDrag);
  document.removeEventListener('mouseup', stopDrag);

  markDirty();
  eventBus.emit(Events.RENDER_TIMELINE);
}

export {
  findImagesAtPoint,
  updateImagePosition,
  highlightSelectedImage,
  startDrag
};
