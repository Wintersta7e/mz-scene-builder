// ============================================
// Tint Picture Properties
// ============================================

const { getElements } = require('../elements');
const { state } = require('../state');
const { rgbToHex, hexToRgb } = require('../utils');
const { bindInput } = require('./bind-input');
const { eventBus, Events } = require('../event-bus');

function emitRender() {
  eventBus.emit(Events.RENDER_TIMELINE);
  eventBus.emit(Events.RENDER_PREVIEW, state.currentFrame);
}

function renderTintProperties(evt) {
  const elements = getElements();

  const r = Math.max(0, Math.min(255, evt.red + 128));
  const g = Math.max(0, Math.min(255, evt.green + 128));
  const b = Math.max(0, Math.min(255, evt.blue + 128));
  const hexColor = rgbToHex(r, g, b);

  elements.propertiesPanel.innerHTML = `
    <div class="property-group">
      <h4>Target</h4>
      <div class="property-row">
        <span class="property-label">Picture #:</span>
        <div class="property-input">
          <input type="number" id="prop-picture-number" value="${evt.pictureNumber}" min="1" max="100">
        </div>
      </div>
    </div>
    <div class="property-group">
      <h4>Tint Color</h4>
      <div class="property-row">
        <span class="property-label">Color:</span>
        <div class="property-input" style="display: flex; gap: 6px; align-items: center;">
          <input type="color" id="prop-tint-color" value="${hexColor}" style="width: 50px; height: 24px; padding: 0; border: none;">
          <span id="prop-tint-preview" style="font-size: 9px;">(${evt.red}, ${evt.green}, ${evt.blue})</span>
        </div>
      </div>
      <div class="property-row">
        <span class="property-label">Gray:</span>
        <div class="property-input">
          <input type="range" id="prop-gray" value="${evt.gray}" min="0" max="255" style="width: 80px;">
          <span id="prop-gray-val">${evt.gray}</span>
        </div>
      </div>
      <div class="color-presets" style="display: flex; gap: 3px; margin-top: 6px; flex-wrap: wrap;">
        <button class="btn btn-sm color-preset" data-r="0" data-g="0" data-b="0" style="background: #808080; width: 20px; height: 20px; padding: 0;" title="Normal"></button>
        <button class="btn btn-sm color-preset" data-r="68" data-g="68" data-b="68" style="background: #c4c4c4; width: 20px; height: 20px; padding: 0;" title="Bright"></button>
        <button class="btn btn-sm color-preset" data-r="-68" data-g="-68" data-b="-68" style="background: #3c3c3c; width: 20px; height: 20px; padding: 0;" title="Dark"></button>
        <button class="btn btn-sm color-preset" data-r="68" data-g="-68" data-b="-68" style="background: #c43c3c; width: 20px; height: 20px; padding: 0;" title="Red"></button>
        <button class="btn btn-sm color-preset" data-r="-68" data-g="68" data-b="-68" style="background: #3cc43c; width: 20px; height: 20px; padding: 0;" title="Green"></button>
        <button class="btn btn-sm color-preset" data-r="-68" data-g="-68" data-b="68" style="background: #3c3cc4; width: 20px; height: 20px; padding: 0;" title="Blue"></button>
        <button class="btn btn-sm color-preset" data-r="68" data-g="68" data-b="-68" style="background: #c4c43c; width: 20px; height: 20px; padding: 0;" title="Yellow"></button>
        <button class="btn btn-sm color-preset" data-r="-68" data-g="34" data-b="68" style="background: #3c62c4; width: 20px; height: 20px; padding: 0;" title="Night"></button>
        <button class="btn btn-sm color-preset" data-r="34" data-g="17" data-b="-34" style="background: #a291ac; width: 20px; height: 20px; padding: 0;" title="Sepia"></button>
      </div>
    </div>
    <div class="property-group">
      <h4>Timing</h4>
      <div class="property-row">
        <span class="property-label">Duration:</span>
        <div class="property-input">
          <input type="number" id="prop-duration" value="${evt.duration}" min="1"> frames
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
  bindInput('prop-duration', 'duration', 'number');
  bindInput('prop-wait', 'wait', 'boolean');

  // Color picker handler
  const colorPicker = document.getElementById('prop-tint-color');
  const preview = document.getElementById('prop-tint-preview');
  colorPicker.addEventListener('input', () => {
    const rgb = hexToRgb(colorPicker.value);
    evt.red = rgb.r - 128;
    evt.green = rgb.g - 128;
    evt.blue = rgb.b - 128;
    preview.textContent = `(${evt.red}, ${evt.green}, ${evt.blue})`;
    emitRender();
  });

  // Gray slider handler
  const graySlider = document.getElementById('prop-gray');
  const grayVal = document.getElementById('prop-gray-val');
  graySlider.addEventListener('input', () => {
    evt.gray = parseInt(graySlider.value);
    grayVal.textContent = evt.gray;
    emitRender();
  });

  // Color presets
  document.querySelectorAll('.color-preset').forEach((btn) => {
    btn.addEventListener('click', () => {
      evt.red = parseInt(btn.dataset.r);
      evt.green = parseInt(btn.dataset.g);
      evt.blue = parseInt(btn.dataset.b);
      renderTintProperties(evt);
      emitRender();
    });
  });
}

module.exports = { renderTintProperties };
