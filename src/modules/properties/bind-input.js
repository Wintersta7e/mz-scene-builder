// ============================================
// Property Input Binding Helper (Event Delegation)
// ============================================
// Uses event delegation on the properties panel to avoid memory leaks
// from repeatedly adding listeners to replaced elements.

import { state } from '../state.js';
import { eventBus, Events } from '../event-bus.js';

let _delegationSetup = false;

// Set up event delegation on the properties panel (called once during init)
function setupPropertyDelegation(propertiesPanel) {
  if (_delegationSetup) return;
  _delegationSetup = true;

  // Single handler for all property inputs using event delegation
  const handlePropertyChange = (e) => {
    const el = e.target;

    // Only handle inputs with data-property attribute
    const property = el.dataset.property;
    if (!property) return;

    const type = el.dataset.propType || 'string';
    const boundIndex = parseInt(el.dataset.boundIndex, 10);

    // Verify the binding is still valid
    if (isNaN(boundIndex) || boundIndex !== state.selectedEventIndex) return;

    const evt = state.events[boundIndex];
    if (!evt) return;

    // Update the property based on type
    if (type === 'number') {
      evt[property] = parseInt(el.value) || 0;
    } else if (type === 'boolean') {
      evt[property] = el.checked;
    } else {
      evt[property] = el.value;
    }

    // Trigger renders via event bus
    eventBus.emit(Events.RENDER_TIMELINE);
    eventBus.emit(Events.RENDER_PREVIEW, state.currentFrame);
  };

  propertiesPanel.addEventListener('change', handlePropertyChange);
  propertiesPanel.addEventListener('input', handlePropertyChange);
}

// Bind an input element by setting data attributes (no event listener added)
function bindInput(elementId, property, type) {
  const el = document.getElementById(elementId);
  if (!el) return;

  // Store binding info as data attributes
  el.dataset.property = property;
  el.dataset.propType = type;
  el.dataset.boundIndex = state.selectedEventIndex;
}

export { bindInput, setupPropertyDelegation };
