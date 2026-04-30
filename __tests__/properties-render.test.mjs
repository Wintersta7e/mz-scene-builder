/**
 * @jest-environment jsdom
 */

// Smoke tests for src/modules/properties/index.js renderProperties.
//
// Verifies the inspector dispatcher renders the empty state when no
// event is selected and the right per-type section when one is. Per-
// section field rendering is the responsibility of properties/{type}.js
// and is not exercised here — this suite focuses on the dispatcher.

import { setupDOM, resetDocument } from './_dom-harness.mjs';

let state;
let utils;
let elements;
let propertiesMod;

beforeAll(async () => {
  await setupDOM();
  state = await import('../src/modules/state.js');
  utils = await import('../src/modules/utils.js');
  elements = await import('../src/modules/elements.js');
  propertiesMod = await import('../src/modules/properties/index.js');
  elements.initElements();
});

beforeEach(() => {
  resetDocument();
  elements.initElements();
  state.state.events = [];
  state.state.selectedEventIndex = -1;
});

describe('renderProperties', () => {
  it('shows the empty-state placeholder when nothing is selected', () => {
    propertiesMod.renderProperties();
    const panel = document.getElementById('properties-panel');
    const empty = panel.querySelector('.empty-state');
    expect(empty).not.toBeNull();
    expect(empty.querySelector('.empty-icon').textContent).toBe('⚙');
  });

  it('renders the picture event tag and timing section for a showPicture', () => {
    state.state.events = [
      {
        type: 'showPicture',
        startFrame: 30,
        pictureNumber: 5,
        imageName: 'pic-5',
        x: 0,
        y: 0,
        scaleX: 100,
        scaleY: 100,
        opacity: 255,
        blend: 0,
        origin: 0,
        _insertOrder: 1
      }
    ];
    utils.sortEvents(state.state.events);
    state.state.selectedEventIndex = 0;

    propertiesMod.renderProperties();

    const panel = document.getElementById('properties-panel');
    // The dispatcher prepends the event tag and the timing section,
    // then delegates to the per-type renderer. We only assert the two
    // shared bits here.
    expect(panel.querySelector('.event-tag')).not.toBeNull();
    // shared.buildTimingSection wraps fields in a .prop-section block.
    expect(panel.querySelector('.prop-section')).not.toBeNull();
    expect(panel.querySelector('.empty-state')).toBeNull();
  });

  it('clears prior content on every render', () => {
    state.state.events = [
      {
        type: 'wait',
        startFrame: 0,
        frames: 60,
        _insertOrder: 1
      }
    ];
    state.state.selectedEventIndex = 0;
    propertiesMod.renderProperties();

    const panel = document.getElementById('properties-panel');
    const firstSnapshot = panel.children.length;
    expect(firstSnapshot).toBeGreaterThan(0);

    // Switch back to the empty state — the previous render's children
    // must not linger.
    state.state.selectedEventIndex = -1;
    propertiesMod.renderProperties();

    expect(panel.querySelector('.empty-state')).not.toBeNull();
    // Only the empty-state wrapper survives.
    expect(panel.children.length).toBe(1);
  });
});
