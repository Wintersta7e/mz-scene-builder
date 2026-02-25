// ============================================
// Move Picture Properties
// ============================================

const { getElements } = require('../elements');
const { bindInput } = require('./bind-input');

function renderMoveProperties(evt) {
  const elements = getElements();

  elements.propertiesPanel.innerHTML = `
    <div class="property-group">
      <h4>Target</h4>
      <div class="property-row">
        <span class="property-label">Picture #:</span>
        <div class="property-input">
          <input type="number" id="prop-picture-number" value="${evt.pictureNumber}" min="1" max="100">
        </div>
      </div>
      <div class="property-row">
        <span class="property-label">Origin:</span>
        <div class="property-input">
          <select id="prop-origin">
            <option value="0" ${evt.origin === 0 ? 'selected' : ''}>Upper Left</option>
            <option value="1" ${evt.origin === 1 ? 'selected' : ''}>Center</option>
          </select>
        </div>
      </div>
    </div>
    <div class="property-group">
      <h4>Position</h4>
      <div class="property-row">
        <span class="property-label">X:</span>
        <div class="property-input">
          <input type="number" id="prop-x" value="${evt.x}">
        </div>
      </div>
      <div class="property-row">
        <span class="property-label">Y:</span>
        <div class="property-input">
          <input type="number" id="prop-y" value="${evt.y}">
        </div>
      </div>
    </div>
    <div class="property-group">
      <h4>Scale</h4>
      <div class="property-row">
        <span class="property-label">Scale X:</span>
        <div class="property-input">
          <input type="number" id="prop-scale-x" value="${evt.scaleX}" min="0" max="2000">%
        </div>
      </div>
      <div class="property-row">
        <span class="property-label">Scale Y:</span>
        <div class="property-input">
          <input type="number" id="prop-scale-y" value="${evt.scaleY}" min="0" max="2000">%
        </div>
      </div>
    </div>
    <div class="property-group">
      <h4>Effects</h4>
      <div class="property-row">
        <span class="property-label">Opacity:</span>
        <div class="property-input">
          <input type="number" id="prop-opacity" value="${evt.opacity}" min="0" max="255">
        </div>
      </div>
      <div class="property-row">
        <span class="property-label">Blend:</span>
        <div class="property-input">
          <select id="prop-blend">
            <option value="0" ${evt.blend === 0 ? 'selected' : ''}>Normal</option>
            <option value="1" ${evt.blend === 1 ? 'selected' : ''}>Additive</option>
            <option value="2" ${evt.blend === 2 ? 'selected' : ''}>Multiply</option>
            <option value="3" ${evt.blend === 3 ? 'selected' : ''}>Screen</option>
          </select>
        </div>
      </div>
    </div>
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

  bindInput('prop-picture-number', 'pictureNumber', 'number');
  bindInput('prop-origin', 'origin', 'number');
  bindInput('prop-x', 'x', 'number');
  bindInput('prop-y', 'y', 'number');
  bindInput('prop-scale-x', 'scaleX', 'number');
  bindInput('prop-scale-y', 'scaleY', 'number');
  bindInput('prop-opacity', 'opacity', 'number');
  bindInput('prop-blend', 'blend', 'number');
  bindInput('prop-duration', 'duration', 'number');
  bindInput('prop-easing', 'easingType', 'number');
  bindInput('prop-wait', 'wait', 'boolean');
}

module.exports = { renderMoveProperties };
