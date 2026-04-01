// ============================================
// Move Picture Properties
// ============================================

import { getElements } from '../elements.js';
import { bindInput } from './bind-input.js';
import { targetGroupHtml, positionGroupHtml, scaleGroupHtml, effectsGroupHtml, bindCoreInputs } from './shared.js';

function renderMoveProperties(evt) {
  const elements = getElements();

  elements.propertiesPanel.innerHTML = `
    ${targetGroupHtml(evt)}
    ${positionGroupHtml(evt)}
    ${scaleGroupHtml(evt)}
    ${effectsGroupHtml(evt)}
    <div class="property-group">
      <h4>Animation</h4>
      <div class="property-row">
        <span class="property-label">Duration:</span>
        <div class="property-input">
          <input type="number" id="prop-duration" value="${evt.duration}" min="1"> frames
        </div>
      </div>
      <div class="property-row">
        <span class="property-label">Easing:</span>
        <div class="property-input">
          <select id="prop-easing">
            <option value="0" ${evt.easingType === 0 ? 'selected' : ''}>Constant</option>
            <option value="1" ${evt.easingType === 1 ? 'selected' : ''}>Ease In</option>
            <option value="2" ${evt.easingType === 2 ? 'selected' : ''}>Ease Out</option>
            <option value="3" ${evt.easingType === 3 ? 'selected' : ''}>Ease In/Out</option>
          </select>
        </div>
      </div>
      <div class="property-row">
        <span class="property-label">Wait:</span>
        <div class="property-input">
          <input type="checkbox" id="prop-wait" ${evt.wait ? 'checked' : ''}>
        </div>
      </div>
    </div>
  `;

  bindCoreInputs();
  bindInput('prop-duration', 'duration', 'number');
  bindInput('prop-easing', 'easingType', 'number');
  bindInput('prop-wait', 'wait', 'boolean');
}

export { renderMoveProperties };
