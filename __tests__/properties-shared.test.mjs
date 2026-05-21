// __tests__/properties-shared.test.mjs
//
// Unit tests for the inspector `commit()` mutation entry point in
// properties/shared.js. The function's value is in the event routing:
// timeline-affecting fields (startFrame, duration, frames,
// pictureNumber, text) emit RENDER_TIMELINE; everything else only emits
// RENDER_PREVIEW. A bug that promotes opacity or scaleX into the
// timeline-affecting set causes 60 Hz lane rebuilds during slider drags.

/**
 * @jest-environment jsdom
 */

import { jest } from '@jest/globals';

const emitMock = jest.fn();
const markDirtyMock = jest.fn();

jest.unstable_mockModule('../src/modules/state.js', () => ({
  state: {
    currentFrame: 0
  },
  LANE_DATA: ['picture', 'effect', 'text', 'aux'],
  MAX_PICTURE_NUMBER: 100
}));

jest.unstable_mockModule('../src/modules/undo-redo.js', () => ({
  markDirty: markDirtyMock,
  saveState: jest.fn()
}));

jest.unstable_mockModule('../src/modules/event-bus.js', () => ({
  eventBus: { on: jest.fn(), emit: emitMock, off: jest.fn() },
  Events: {
    RENDER: 'render',
    RENDER_TIMELINE: 'render:timeline',
    RENDER_PREVIEW: 'render:preview'
  }
}));

jest.unstable_mockModule('../src/modules/events.js', () => ({
  getEventLane: jest.fn(() => 0)
}));

const { commit } = await import('../src/modules/properties/shared.js');

beforeEach(() => {
  emitMock.mockClear();
  markDirtyMock.mockClear();
});

describe('commit', () => {
  it('mutates the event in place', () => {
    const ev = { startFrame: 0 };
    commit(ev, 'startFrame', 30);
    expect(ev.startFrame).toBe(30);
  });

  it('marks dirty on every commit', () => {
    commit({}, 'startFrame', 30);
    expect(markDirtyMock).toHaveBeenCalledTimes(1);
  });

  it.each(['startFrame', 'duration', 'frames', 'pictureNumber', 'text'])(
    'emits RENDER_TIMELINE for timeline-affecting field "%s"',
    (field) => {
      commit({}, field, 1);
      const events = emitMock.mock.calls.map((call) => call[0]);
      expect(events).toContain('render:timeline');
      expect(events).toContain('render:preview');
    }
  );

  it.each(['opacity', 'scaleX', 'scaleY', 'x', 'y', 'red', 'green', 'blue', 'gray'])(
    'does NOT emit RENDER_TIMELINE for non-timeline field "%s"',
    (field) => {
      commit({}, field, 1);
      const events = emitMock.mock.calls.map((call) => call[0]);
      expect(events).not.toContain('render:timeline');
      expect(events).toContain('render:preview');
    }
  );

  it('emits RENDER_PREVIEW with the current frame', () => {
    commit({}, 'opacity', 128);
    expect(emitMock).toHaveBeenCalledWith('render:preview', 0);
  });
});
