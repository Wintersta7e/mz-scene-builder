// ============================================
// Show Picture Properties
// ============================================

import { getElements } from '../elements.js';
import { openImagePicker } from '../preview/image-picker.js';
import { targetGroupHtml, positionGroupHtml, scaleGroupHtml, effectsGroupHtml, bindCoreInputs } from './shared.js';

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderPictureProperties(evt) {
  const elements = getElements();
  const imageName = evt.imageName ? escapeHtml(evt.imageName.split('/').pop()) : '(none)';

  elements.propertiesPanel.innerHTML = `
    <div class="property-group">
      <h4>Image</h4>
      <div class="property-row">
        <span class="property-label">Image:</span>
        <span class="property-input">${imageName}</span>
      </div>
      <button class="btn btn-sm btn-pick-image">Select Image...</button>
    </div>
    ${targetGroupHtml(evt)}
    ${positionGroupHtml(evt)}
    ${scaleGroupHtml(evt)}
    ${effectsGroupHtml(evt)}
  `;

  const pickBtn = elements.propertiesPanel.querySelector('.btn-pick-image');
  if (pickBtn) pickBtn.addEventListener('click', openImagePicker);

  bindCoreInputs();
}

export { renderPictureProperties };
