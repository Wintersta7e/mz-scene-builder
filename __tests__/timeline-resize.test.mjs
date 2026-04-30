// __tests__/timeline-resize.test.mjs

import { jest } from '@jest/globals';

// Mock all drag.js dependencies so the module loads cleanly.
jest.unstable_mockModule('../src/modules/state.js', () => ({
  state: { timelineDragEvt: null, timelineDragIndex: -1, timelineScale: 1, currentFrame: 0 }
}));

jest.unstable_mockModule('../src/modules/elements.js', () => ({
  getElements: jest.fn(() => ({ timelineEvents: { querySelector: jest.fn(() => null) } })),
  initElements: jest.fn()
}));

jest.unstable_mockModule('../src/modules/undo-redo.js', () => ({
  saveState: jest.fn(),
  markDirty: jest.fn()
}));

jest.unstable_mockModule('../src/modules/utils.js', () => ({
  sortEvents: jest.fn(),
  getNextInsertOrder: jest.fn(() => 0),
  resetInsertOrderCounter: jest.fn()
}));

jest.unstable_mockModule('../src/modules/events.js', () => ({
  selectEvent: jest.fn(),
  getEventDuration: jest.fn(() => 60)
}));

jest.unstable_mockModule('../src/modules/event-bus.js', () => ({
  eventBus: { on: jest.fn(), emit: jest.fn(), off: jest.fn() },
  Events: { RENDER_TIMELINE: 'render:timeline' }
}));

jest.unstable_mockModule('../src/modules/logger.js', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));

jest.unstable_mockModule('../src/modules/properties/index.js', () => ({
  renderProperties: jest.fn()
}));

const { computeResize, recoverSelectedIndex } = await import('../src/modules/timeline/drag.js');

describe('computeResize', () => {
  describe('right edge', () => {
    it('preserves startFrame', () => {
      const r = computeResize({ edge: 'right', startFrame: 100, startDur: 60, deltaFrames: 30 });
      expect(r.startFrame).toBe(100);
    });

    it('extends duration on positive delta', () => {
      const r = computeResize({ edge: 'right', startFrame: 100, startDur: 60, deltaFrames: 30 });
      expect(r.duration).toBe(90);
    });

    it('clamps to min length on aggressive negative delta', () => {
      const r = computeResize({ edge: 'right', startFrame: 100, startDur: 60, deltaFrames: -100 });
      expect(r.duration).toBe(8); // MIN_LENGTH
    });
  });

  describe('left edge', () => {
    it('preserves the right edge on positive delta (drag right shrinks)', () => {
      const r = computeResize({ edge: 'left', startFrame: 100, startDur: 60, deltaFrames: 20 });
      expect(r.startFrame + r.duration).toBe(160); // original right edge
      expect(r.startFrame).toBe(120);
      expect(r.duration).toBe(40);
    });

    it('preserves the right edge on negative delta (drag left grows)', () => {
      const r = computeResize({ edge: 'left', startFrame: 100, startDur: 60, deltaFrames: -30 });
      expect(r.startFrame + r.duration).toBe(160);
      expect(r.startFrame).toBe(70);
      expect(r.duration).toBe(90);
    });

    it('clamps startFrame to 0 (no negative)', () => {
      const r = computeResize({ edge: 'left', startFrame: 10, startDur: 60, deltaFrames: -50 });
      expect(r.startFrame).toBe(0);
      expect(r.duration).toBe(70); // 10 + 60 = 70 (right edge preserved)
    });

    it('clamps to min length (cannot drag past right edge)', () => {
      const r = computeResize({ edge: 'left', startFrame: 100, startDur: 60, deltaFrames: 100 });
      expect(r.startFrame).toBe(152); // startRight (160) - MIN_LENGTH (8)
      expect(r.duration).toBe(8);
    });

    it('handles delta of 0 as identity', () => {
      const r = computeResize({ edge: 'left', startFrame: 100, startDur: 60, deltaFrames: 0 });
      expect(r.startFrame).toBe(100);
      expect(r.duration).toBe(60);
    });
  });
});

describe('recoverSelectedIndex', () => {
  it('returns -1 when no event was selected before the sort', () => {
    expect(recoverSelectedIndex([{ id: 'a' }, { id: 'b' }], null)).toBe(-1);
  });

  it('returns the new index of the selected event after a reorder', () => {
    const a = { id: 'a' };
    const b = { id: 'b' };
    const c = { id: 'c' };
    const reordered = [c, a, b];
    expect(recoverSelectedIndex(reordered, a)).toBe(1);
  });

  it('returns 0 when the selected event lands at the front', () => {
    const a = { id: 'a' };
    const b = { id: 'b' };
    expect(recoverSelectedIndex([a, b], a)).toBe(0);
  });

  it('returns -1 if the selected event no longer exists in the array', () => {
    const a = { id: 'a' };
    const b = { id: 'b' };
    expect(recoverSelectedIndex([b], a)).toBe(-1);
  });

  it('matches by reference, not by value', () => {
    const a = { id: 'a' };
    const aClone = { id: 'a' };
    expect(recoverSelectedIndex([aClone], a)).toBe(-1);
  });
});
