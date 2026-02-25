// ============================================
// Show Text Properties
// ============================================

const { getElements } = require('../elements');
const { bindInput } = require('./bind-input');

function renderTextProperties(evt) {
  const elements = getElements();

  elements.propertiesPanel.innerHTML = `
    <div class="property-group">
      <h4>Text</h4>
      <div class="property-row" style="flex-direction: column; align-items: stretch;">
        <textarea id="prop-text" rows="6" style="width: 100%; resize: vertical; background: var(--bg-input); color: var(--text); border: 1px solid var(--border); border-radius: 3px; padding: 6px;">${evt.text || ''}</textarea>
      </div>
    </div>
    <div class="property-group">
      <h4>Display</h4>
      <div class="property-row">
        <span class="property-label">Background:</span>
        <div class="property-input">
          <select id="prop-background">
            <option value="0" ${evt.background === 0 ? 'selected' : ''}>Window</option>
            <option value="1" ${evt.background === 1 ? 'selected' : ''}>Dim</option>
            <option value="2" ${evt.background === 2 ? 'selected' : ''}>Transparent</option>
          </select>
        </div>
      </div>
      <div class="property-row">
        <span class="property-label">Position:</span>
        <div class="property-input">
          <select id="prop-position">
            <option value="0" ${evt.position === 0 ? 'selected' : ''}>Top</option>
            <option value="1" ${evt.position === 1 ? 'selected' : ''}>Middle</option>
            <option value="2" ${evt.position === 2 ? 'selected' : ''}>Bottom</option>
          </select>
        </div>
      </div>
    </div>
  `;

  bindInput('prop-text', 'text', 'string');
  bindInput('prop-background', 'background', 'number');
  bindInput('prop-position', 'position', 'number');
}

module.exports = { renderTextProperties };
