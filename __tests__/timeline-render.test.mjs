/**
 * @jest-environment jsdom
 */

// Smoke tests for src/modules/timeline/index.js renderTimeline.
//
// Runs under jest-environment-jsdom; the shared harness loads
// index.html into the document and stubs the contextBridge IPC, then
// the suite seeds state with a small, deterministic event set and
// asserts the produced DOM matches the expected lane / event-block
// structure.

import { setupDOM, resetDocument } from './_dom-harness.mjs';

let state;
let utils;
let elements;
let timeline;

beforeAll(async () => {
  await setupDOM();
  state = await import('../src/modules/state.js');
  utils = await import('../src/modules/utils.js');
  elements = await import('../src/modules/elements.js');
  const tl = await import('../src/modules/timeline/index.js');
  timeline = tl;
  elements.initElements();
});

beforeEach(() => {
  resetDocument();
  elements.initElements();
  state.state.events = [];
  state.state.selectedEventIndex = -1;
  state.state.currentFrame = 0;
  state.state.timelineLength = 300;
  state.state.timelineScale = 5;
});

function makePicture(startFrame, pictureNumber, _insertOrder) {
  return {
    type: 'showPicture',
    startFrame,
    pictureNumber,
    imageName: `pic-${pictureNumber}`,
    x: 0,
    y: 0,
    scaleX: 100,
    scaleY: 100,
    opacity: 255,
    blend: 0,
    origin: 0,
    _insertOrder
  };
}

function makeWait(startFrame, frames, _insertOrder) {
  return { type: 'wait', startFrame, frames, _insertOrder };
}

describe('renderTimeline', () => {
  it('produces 4 lane rows when there are no events', () => {
    timeline.renderTimeline();
    const rows = document.querySelectorAll('#timeline-events .lane-row');
    expect(rows.length).toBe(4);
    // Lane data attributes follow the LANE_META order in timeline/index.js.
    const lanes = Array.from(rows).map((r) => r.dataset.lane);
    expect(lanes).toEqual(['picture', 'effect', 'text', 'aux']);
  });

  it('renders one event-block per event with the correct lane and dataset', () => {
    state.state.events = [
      makePicture(0, 1, 1), // -> Pictures lane
      makeWait(60, 30, 2) //   -> Timing (aux) lane
    ];
    utils.sortEvents(state.state.events);

    timeline.renderTimeline();

    const blocks = document.querySelectorAll('#timeline-events .event-block');
    expect(blocks.length).toBe(2);
    const lanes = Array.from(blocks).map((b) => b.dataset.lane);
    expect(lanes).toContain('picture');
    expect(lanes).toContain('aux');

    // Each block carries its event index for selection lookup.
    const indices = Array.from(blocks)
      .map((b) => parseInt(b.dataset.eventIndex, 10))
      .sort((a, b) => a - b);
    expect(indices).toEqual([0, 1]);
  });

  it('stacks overlapping picture events into separate sub-lanes', () => {
    // Two showPicture events that overlap in time must occupy distinct
    // sub-rows on the Pictures lane. Sub-lane index is exposed via the
    // data-sublane attribute and reflected in inline `top`.
    state.state.events = [makePicture(0, 1, 1), makePicture(0, 2, 2)];
    utils.sortEvents(state.state.events);

    timeline.renderTimeline();

    const blocks = Array.from(document.querySelectorAll('#timeline-events .event-block[data-lane="picture"]'));
    expect(blocks.length).toBe(2);

    const subLanes = blocks.map((b) => parseInt(b.dataset.sublane, 10)).sort((a, b) => a - b);
    expect(subLanes).toEqual([0, 1]);

    const tops = blocks.map((b) => b.style.top);
    expect(new Set(tops).size).toBe(2); // distinct top values
  });

  it('marks the currently-selected event with .is-selected', () => {
    state.state.events = [makePicture(0, 1, 1), makePicture(60, 2, 2)];
    utils.sortEvents(state.state.events);
    state.state.selectedEventIndex = 1;

    timeline.renderTimeline();

    const selected = document.querySelectorAll('#timeline-events .event-block.is-selected');
    expect(selected.length).toBe(1);
    expect(selected[0].dataset.eventIndex).toBe('1');
  });

  it('records a clip count per lane in the lanes column', () => {
    state.state.events = [makePicture(0, 1, 1), makePicture(60, 2, 2), makeWait(120, 30, 3)];
    utils.sortEvents(state.state.events);

    timeline.renderTimeline();

    const heads = document.querySelectorAll('#timeline-lanes .lane-head');
    expect(heads.length).toBe(4);
    // Pictures lane gets two clips, Timing gets one, the rest zero.
    const counts = Array.from(heads).map((h) => h.querySelector('.lane-count').textContent);
    expect(counts[0]).toContain('2 clips');
    expect(counts[3]).toContain('1 clip');
  });
});
