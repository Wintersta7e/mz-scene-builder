// ============================================
// Properties Panel Dispatcher
// ============================================

const { state } = require('../state');
const { getElements } = require('../elements');

function renderProperties() {
  const elements = getElements();

  if (state.selectedEventIndex < 0) {
    elements.propertiesPanel.innerHTML = '<p class="placeholder">Select an event to edit properties</p>';
    return;
  }

  const evt = state.events[state.selectedEventIndex];

  // Lazy load to avoid circular dependencies
  const { renderPictureProperties } = require('./picture');
  const { renderMoveProperties } = require('./move');
  const { renderTintProperties } = require('./tint');
  const { renderTextProperties } = require('./text');
  const {
    renderRotateProperties,
    renderEraseProperties,
    renderWaitProperties,
    renderFlashProperties
  } = require('./other');

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

module.exports = { renderProperties };
