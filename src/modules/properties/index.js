// ============================================
// Properties Panel Dispatcher
// ============================================

import { state } from '../state.js';
import { getElements } from '../elements.js';
import { renderPictureProperties } from './picture.js';
import { renderMoveProperties } from './move.js';
import { renderTintProperties } from './tint.js';
import { renderTextProperties } from './text.js';
import { renderRotateProperties, renderEraseProperties, renderWaitProperties, renderFlashProperties } from './other.js';

function showPlaceholder(panel) {
  const p = document.createElement('p');
  p.className = 'placeholder';
  p.textContent = 'Select an event to edit properties';
  panel.replaceChildren(p);
}

function renderProperties() {
  const elements = getElements();

  if (state.selectedEventIndex < 0) {
    showPlaceholder(elements.propertiesPanel);
    return;
  }

  const evt = state.events[state.selectedEventIndex];
  if (!evt) {
    state.selectedEventIndex = -1;
    showPlaceholder(elements.propertiesPanel);
    return;
  }

  switch (evt.type) {
    case 'showPicture':
      renderPictureProperties(evt);
      break;
    case 'movePicture':
      renderMoveProperties(evt);
      break;
    case 'rotatePicture':
      renderRotateProperties(evt);
      break;
    case 'tintPicture':
      renderTintProperties(evt);
      break;
    case 'erasePicture':
      renderEraseProperties(evt);
      break;
    case 'showText':
      renderTextProperties(evt);
      break;
    case 'wait':
      renderWaitProperties(evt);
      break;
    case 'screenFlash':
      renderFlashProperties(evt);
      break;
  }
}

export { renderProperties };
