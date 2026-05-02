// src/modules/properties/index.js
//
// Inspector dispatcher. Builds the Director's Console inspector
// content based on the currently-selected event.

import { state } from '../state.js';
import { getElements } from '../elements.js';
import { buildEventTag, buildTimingSection } from './shared.js';
import { renderPictureProperties } from './picture.js';
import { renderMoveProperties } from './move.js';
import { renderTintProperties } from './tint.js';
import { renderTextProperties } from './text.js';
import { renderRotateProperties, renderEraseProperties, renderWaitProperties, renderFlashProperties } from './other.js';
import { clearChildren } from '../utils.js';
import { logger } from '../logger.js';

const SECTION_RENDERERS = {
  showPicture: renderPictureProperties,
  movePicture: renderMoveProperties,
  tintPicture: renderTintProperties,
  showText: renderTextProperties,
  rotatePicture: renderRotateProperties,
  erasePicture: renderEraseProperties,
  wait: renderWaitProperties,
  screenFlash: renderFlashProperties
};

const TYPES_WITH_DURATION = new Set(['showPicture', 'movePicture', 'tintPicture', 'screenFlash', 'wait']);

export function showPlaceholder() {
  const panel = getElements().propertiesPanel;
  clearChildren(panel);

  const wrap = document.createElement('div');
  wrap.className = 'empty-state';

  const cog = document.createElement('div');
  cog.className = 'empty-icon';
  cog.textContent = '⚙';
  wrap.appendChild(cog);

  const msg = document.createElement('div');
  msg.className = 'empty-msg';
  msg.textContent = 'Select an event on the timeline or stage to edit its properties.';
  wrap.appendChild(msg);

  panel.appendChild(wrap);
}

export function renderProperties() {
  logger.timed('renderProperties', () => {
    const panel = getElements().propertiesPanel;
    clearChildren(panel);

    const idx = state.selectedEventIndex;
    const ev = idx >= 0 ? state.events[idx] : null;
    if (!ev) {
      showPlaceholder();
      return;
    }

    panel.appendChild(buildEventTag(ev));
    panel.appendChild(buildTimingSection(ev, { showDuration: TYPES_WITH_DURATION.has(ev.type) }));

    const renderer = SECTION_RENDERERS[ev.type];
    if (renderer) panel.appendChild(renderer(ev));
  });
}
