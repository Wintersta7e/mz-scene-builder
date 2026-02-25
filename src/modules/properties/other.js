// ============================================
// Other Property Panels (Rotate, Erase, Wait, Flash)
// ============================================

const { getElements } = require('../elements');
const { rgbToHex, hexToRgb } = require('../utils');
const { bindInput } = require('./bind-input');
const { eventBus, Events } = require('../event-bus');

function renderRotateProperties(evt) {
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
    </div>
    <div class="property-group">
      <h4>Rotation</h4>
      <div class="property-row">
        <span class="property-label">Speed:</span>
        <div class="property-input">
          <input type="number" id="prop-speed" value="${evt.speed}" min="-90" max="90">
        </div>
      </div>
      <p style="color: var(--text-dim); font-size: 9px; margin-top: 4px;">
        0 = stop, + = clockwise, - = counter-clockwise
      </p>
    </div>
  `;

  bindInput('prop-picture-number', 'pictureNumber', 'number');
  bindInput('prop-speed', 'speed', 'number');
}

function renderEraseProperties(evt) {
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
      <p style="color: var(--text-dim); font-size: 9px; margin-top: 4px;">
        Removes the picture from the screen.
      </p>
    </div>
  `;

  bindInput('prop-picture-number', 'pictureNumber', 'number');
}

function renderWaitProperties(evt) {
  const elements = getElements();

  elements.propertiesPanel.innerHTML = `
    <div class="property-group">
      <h4>Wait</h4>
      <div class="property-row">
        <span class="property-label">Frames:</span>
        <div class="property-input">
          <input type="number" id="prop-frames" value="${evt.frames}" min="1">
        </div>
      </div>
      <div class="property-row">
        <span class="property-label">Seconds:</span>
        <div class="property-input">
          <span>${(evt.frames / 60).toFixed(2)}s @ 60fps</span>
        </div>
      </div>
    </div>
  `;

  bindInput('prop-frames', 'frames', 'number');
}

function renderFlashProperties(evt) {
  const elements = getElements();
  const hexColor = rgbToHex(evt.red, evt.green, evt.blue);

  elements.propertiesPanel.innerHTML = `
    <div class="property-group">
      <h4>Flash Color</h4>
      <div class="property-row">
        <span class="property-label">Color:</span>
        <div class="property-input" style="display: flex; gap: 6px; align-items: center;">
          <input type="color" id="prop-flash-color" value="${hexColor}" style="width: 50px; height: 24px; padding: 0; border: none;">
          <span id="prop-flash-preview" style="font-size: 9px;">(${evt.red}, ${evt.green}, ${evt.blue})</span>
        </div>
      </div>
      <div class="property-row">
        <span class="property-label">Intensity:</span>
        <div class="property-input">
          <input type="range" id="prop-intensity" value="${evt.intensity}" min="0" max="255" style="width: 80px;">
          <span id="prop-intensity-val">${evt.intensity}</span>
        </div>
      </div>
      <div class="color-presets" style="display: flex; gap: 3px; margin-top: 6px;">
        <button class="btn btn-sm flash-preset" data-r="255" data-g="255" data-b="255" style="background: #fff; width: 20px; height: 20px; padding: 0;" title="White"></button>
        <button class="btn btn-sm flash-preset" data-r="255" data-g="0" data-b="0" style="background: #f00; width: 20px; height: 20px; padding: 0;" title="Red"></button>
        <button class="btn btn-sm flash-preset" data-r="0" data-g="255" data-b="0" style="background: #0f0; width: 20px; height: 20px; padding: 0;" title="Green"></button>
        <button class="btn btn-sm flash-preset" data-r="0" data-g="0" data-b="255" style="background: #00f; width: 20px; height: 20px; padding: 0;" title="Blue"></button>
        <button class="btn btn-sm flash-preset" data-r="255" data-g="255" data-b="0" style="background: #ff0; width: 20px; height: 20px; padding: 0;" title="Yellow"></button>
        <button class="btn btn-sm flash-preset" data-r="255" data-g="0" data-b="255" style="background: #f0f; width: 20px; height: 20px; padding: 0;" title="Magenta"></button>
        <button class="btn btn-sm flash-preset" data-r="0" data-g="255" data-b="255" style="background: #0ff; width: 20px; height: 20px; padding: 0;" title="Cyan"></button>
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

  bindInput('prop-duration', 'duration', 'number');
  bindInput('prop-wait', 'wait', 'boolean');

  // Color picker handler
  const colorPicker = document.getElementById('prop-flash-color');
  const preview = document.getElementById('prop-flash-preview');
  colorPicker.addEventListener('input', () => {
    const rgb = hexToRgb(colorPicker.value);
    evt.red = rgb.r;
    evt.green = rgb.g;
    evt.blue = rgb.b;
    preview.textContent = `(${evt.red}, ${evt.green}, ${evt.blue})`;
    eventBus.emit(Events.RENDER_TIMELINE);
  });

  // Intensity slider handler
  const intensitySlider = document.getElementById('prop-intensity');
  const intensityVal = document.getElementById('prop-intensity-val');
  intensitySlider.addEventListener('input', () => {
    evt.intensity = parseInt(intensitySlider.value);
    intensityVal.textContent = evt.intensity;
    eventBus.emit(Events.RENDER_TIMELINE);
  });

  // Color presets
  document.querySelectorAll('.flash-preset').forEach((btn) => {
    btn.addEventListener('click', () => {
      evt.red = parseInt(btn.dataset.r);
      evt.green = parseInt(btn.dataset.g);
      evt.blue = parseInt(btn.dataset.b);
      renderFlashProperties(evt);
      eventBus.emit(Events.RENDER_TIMELINE);
    });
  });
}

module.exports = {
  renderRotateProperties,
  renderEraseProperties,
  renderWaitProperties,
  renderFlashProperties
};
