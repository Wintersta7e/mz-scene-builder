import { jest } from '@jest/globals';

let rgbToHex,
  hexToRgb,
  sortEvents,
  TYPE_PRIORITY,
  getNextInsertOrder,
  resetInsertOrderCounter,
  makeTrailingThrottle,
  assignSubLanes,
  formatFrameTime;

beforeAll(async () => {
  const mod = await import('../src/modules/utils.js');
  ({
    rgbToHex,
    hexToRgb,
    sortEvents,
    TYPE_PRIORITY,
    getNextInsertOrder,
    resetInsertOrderCounter,
    makeTrailingThrottle,
    assignSubLanes,
    formatFrameTime
  } = mod);
});

// Reset counter before every test to prevent cross-suite contamination
beforeEach(() => {
  if (resetInsertOrderCounter) resetInsertOrderCounter(0);
});

describe('rgbToHex', () => {
  it('converts standard RGB values', () => {
    expect(rgbToHex(255, 0, 0)).toBe('#ff0000');
    expect(rgbToHex(0, 255, 0)).toBe('#00ff00');
    expect(rgbToHex(0, 0, 255)).toBe('#0000ff');
    expect(rgbToHex(255, 255, 255)).toBe('#ffffff');
    expect(rgbToHex(0, 0, 0)).toBe('#000000');
  });

  it('converts mixed RGB values', () => {
    expect(rgbToHex(128, 64, 32)).toBe('#804020');
    expect(rgbToHex(100, 150, 200)).toBe('#6496c8');
  });

  it('pads single-digit hex values', () => {
    expect(rgbToHex(0, 5, 15)).toBe('#00050f');
    expect(rgbToHex(1, 1, 1)).toBe('#010101');
  });

  it('clamps values below 0', () => {
    expect(rgbToHex(-10, -50, -255)).toBe('#000000');
  });

  it('clamps values above 255', () => {
    expect(rgbToHex(300, 500, 1000)).toBe('#ffffff');
  });

  it('rounds floating point values', () => {
    expect(rgbToHex(127.4, 127.6, 200.9)).toBe('#7f80c9');
  });
});

describe('hexToRgb', () => {
  it('converts standard hex colors', () => {
    expect(hexToRgb('#ff0000')).toEqual({ r: 255, g: 0, b: 0 });
    expect(hexToRgb('#00ff00')).toEqual({ r: 0, g: 255, b: 0 });
    expect(hexToRgb('#0000ff')).toEqual({ r: 0, g: 0, b: 255 });
    expect(hexToRgb('#ffffff')).toEqual({ r: 255, g: 255, b: 255 });
    expect(hexToRgb('#000000')).toEqual({ r: 0, g: 0, b: 0 });
  });

  it('converts mixed hex colors', () => {
    expect(hexToRgb('#804020')).toEqual({ r: 128, g: 64, b: 32 });
    expect(hexToRgb('#6496c8')).toEqual({ r: 100, g: 150, b: 200 });
  });

  it('handles hex without # prefix', () => {
    expect(hexToRgb('ff0000')).toEqual({ r: 255, g: 0, b: 0 });
    expect(hexToRgb('00ff00')).toEqual({ r: 0, g: 255, b: 0 });
  });

  it('handles uppercase hex', () => {
    expect(hexToRgb('#FF00FF')).toEqual({ r: 255, g: 0, b: 255 });
    expect(hexToRgb('AABBCC')).toEqual({ r: 170, g: 187, b: 204 });
  });

  it('returns black for invalid hex', () => {
    expect(hexToRgb('')).toEqual({ r: 0, g: 0, b: 0 });
    expect(hexToRgb('invalid')).toEqual({ r: 0, g: 0, b: 0 });
    expect(hexToRgb('#fff')).toEqual({ r: 0, g: 0, b: 0 }); // 3-digit hex not supported
    expect(hexToRgb(null)).toEqual({ r: 0, g: 0, b: 0 });
  });
});

describe('formatFrameTime', () => {
  describe('default ss:ff mode', () => {
    it('formats sub-second frames as 00:ff', () => {
      expect(formatFrameTime(0)).toBe('00:00');
      expect(formatFrameTime(7)).toBe('00:07');
      expect(formatFrameTime(59)).toBe('00:59');
    });

    it('rolls over to seconds at 60 frames', () => {
      expect(formatFrameTime(60)).toBe('01:00');
      expect(formatFrameTime(125)).toBe('02:05');
    });
  });

  describe('mm:ss mode', () => {
    it('returns 00:00 for zero frames', () => {
      expect(formatFrameTime(0, 'mm:ss')).toBe('00:00');
    });

    it('rolls seconds at every 60 frames', () => {
      expect(formatFrameTime(60, 'mm:ss')).toBe('00:01');
      expect(formatFrameTime(60 * 30, 'mm:ss')).toBe('00:30');
    });

    it('rolls minutes at every 3600 frames', () => {
      expect(formatFrameTime(60 * 60, 'mm:ss')).toBe('01:00');
      expect(formatFrameTime(60 * 125, 'mm:ss')).toBe('02:05');
    });

    it('floors negative frames to 00:00', () => {
      expect(formatFrameTime(-30, 'mm:ss')).toBe('00:00');
    });
  });
});

describe('TYPE_PRIORITY', () => {
  it('has correct priority order', () => {
    expect(TYPE_PRIORITY['showPicture']).toBe(0);
    expect(TYPE_PRIORITY['movePicture']).toBe(1);
    expect(TYPE_PRIORITY['rotatePicture']).toBe(2);
    expect(TYPE_PRIORITY['tintPicture']).toBe(3);
    expect(TYPE_PRIORITY['erasePicture']).toBe(4);
    expect(TYPE_PRIORITY['screenFlash']).toBe(5);
    expect(TYPE_PRIORITY['wait']).toBe(6);
    expect(TYPE_PRIORITY['showText']).toBe(7);
  });

  it('showPicture comes before showText', () => {
    expect(TYPE_PRIORITY['showPicture']).toBeLessThan(TYPE_PRIORITY['showText']);
  });
});

describe('sortEvents', () => {
  describe('frame-based sorting', () => {
    it('sorts events by frame ascending', () => {
      const events = [
        { startFrame: 100, type: 'showPicture' },
        { startFrame: 50, type: 'showPicture' },
        { startFrame: 200, type: 'showPicture' }
      ];

      sortEvents(events);

      expect(events.map((e) => e.startFrame)).toEqual([50, 100, 200]);
    });

    it('handles missing startFrame as 0', () => {
      const events = [
        { startFrame: 10, type: 'showPicture' },
        { type: 'showPicture' }, // no startFrame
        { startFrame: 5, type: 'showPicture' }
      ];

      sortEvents(events);

      expect(events.map((e) => e.startFrame || 0)).toEqual([0, 5, 10]);
    });
  });

  describe('type priority sorting (same frame)', () => {
    it('sorts by type priority when frames are equal', () => {
      const events = [
        { startFrame: 0, type: 'showText' }, // priority 7
        { startFrame: 0, type: 'showPicture' }, // priority 0
        { startFrame: 0, type: 'wait' }, // priority 6
        { startFrame: 0, type: 'movePicture' } // priority 1
      ];

      sortEvents(events);

      expect(events.map((e) => e.type)).toEqual([
        'showPicture', // 0
        'movePicture', // 1
        'wait', // 6
        'showText' // 7
      ]);
    });

    it('handles unknown types with priority 0', () => {
      const events = [
        { startFrame: 0, type: 'showText' },
        { startFrame: 0, type: 'unknownType' } // defaults to priority 0
      ];

      sortEvents(events);

      expect(events.map((e) => e.type)).toEqual(['unknownType', 'showText']);
    });
  });

  describe('insertion order sorting (same frame + type)', () => {
    it('sorts by _insertOrder descending (newer first) for same frame and type', () => {
      const events = [
        { startFrame: 0, type: 'showPicture', _insertOrder: 1, imageName: 'first' },
        { startFrame: 0, type: 'showPicture', _insertOrder: 3, imageName: 'third' },
        { startFrame: 0, type: 'showPicture', _insertOrder: 2, imageName: 'second' }
      ];

      sortEvents(events);

      expect(events.map((e) => e.imageName)).toEqual(['third', 'second', 'first']);
    });

    it('handles missing _insertOrder as 0', () => {
      const events = [
        { startFrame: 0, type: 'showPicture', _insertOrder: 5, imageName: 'with' },
        { startFrame: 0, type: 'showPicture', imageName: 'without' } // no _insertOrder
      ];

      sortEvents(events);

      expect(events.map((e) => e.imageName)).toEqual(['with', 'without']);
    });
  });

  describe('combined sorting', () => {
    it('applies all three sort levels correctly', () => {
      const events = [
        { startFrame: 60, type: 'showText', _insertOrder: 1 },
        { startFrame: 0, type: 'showPicture', _insertOrder: 2 },
        { startFrame: 60, type: 'showPicture', _insertOrder: 3 },
        { startFrame: 0, type: 'showText', _insertOrder: 4 },
        { startFrame: 0, type: 'showPicture', _insertOrder: 5 }
      ];

      sortEvents(events);

      // Frame 0: showPicture (5), showPicture (2), showText (4)
      // Frame 60: showPicture (3), showText (1)
      expect(events).toEqual([
        { startFrame: 0, type: 'showPicture', _insertOrder: 5 },
        { startFrame: 0, type: 'showPicture', _insertOrder: 2 },
        { startFrame: 0, type: 'showText', _insertOrder: 4 },
        { startFrame: 60, type: 'showPicture', _insertOrder: 3 },
        { startFrame: 60, type: 'showText', _insertOrder: 1 }
      ]);
    });
  });

  describe('edge cases', () => {
    it('handles empty array', () => {
      const events = [];
      sortEvents(events);
      expect(events).toEqual([]);
    });

    it('handles single element', () => {
      const events = [{ startFrame: 0, type: 'showPicture' }];
      sortEvents(events);
      expect(events).toHaveLength(1);
    });

    it('handles events with all fields missing', () => {
      const events = [{}, {}, {}];
      // Should not throw
      expect(() => sortEvents(events)).not.toThrow();
    });
  });
});

describe('getNextInsertOrder', () => {
  it('returns incrementing values', () => {
    expect(getNextInsertOrder()).toBe(1);
    expect(getNextInsertOrder()).toBe(2);
    expect(getNextInsertOrder()).toBe(3);
  });
});

describe('resetInsertOrderCounter', () => {
  it('resets counter to specified value', () => {
    resetInsertOrderCounter(100);
    expect(getNextInsertOrder()).toBe(101);
  });

  it('resets to 0 by default', () => {
    getNextInsertOrder(); // increment
    getNextInsertOrder(); // increment
    resetInsertOrderCounter(0);
    expect(getNextInsertOrder()).toBe(1);
  });
});

describe('makeTrailingThrottle', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('does not fire synchronously on the first call', () => {
    const fn = jest.fn();
    const throttled = makeTrailingThrottle(120, fn);
    throttled();
    expect(fn).not.toHaveBeenCalled();
  });

  it('fires once after the delay', () => {
    const fn = jest.fn();
    const throttled = makeTrailingThrottle(120, fn);
    throttled();
    jest.advanceTimersByTime(120);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('drops repeat calls inside the same window', () => {
    const fn = jest.fn();
    const throttled = makeTrailingThrottle(120, fn);
    throttled();
    throttled();
    throttled();
    jest.advanceTimersByTime(120);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('schedules again after a fire completes', () => {
    const fn = jest.fn();
    const throttled = makeTrailingThrottle(120, fn);
    throttled();
    jest.advanceTimersByTime(120);
    throttled();
    jest.advanceTimersByTime(120);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('cancel() drops a pending fire', () => {
    const fn = jest.fn();
    const throttled = makeTrailingThrottle(120, fn);
    throttled();
    throttled.cancel();
    jest.advanceTimersByTime(120);
    expect(fn).not.toHaveBeenCalled();
  });

  it('cancel() during idle is a no-op', () => {
    const fn = jest.fn();
    const throttled = makeTrailingThrottle(120, fn);
    expect(() => throttled.cancel()).not.toThrow();
    jest.advanceTimersByTime(120);
    expect(fn).not.toHaveBeenCalled();
  });

  it('passes arguments from the scheduling call to the wrapped function', () => {
    const fn = jest.fn();
    const throttled = makeTrailingThrottle(50, fn);
    throttled('hello', 42);
    jest.advanceTimersByTime(50);
    expect(fn).toHaveBeenCalledWith('hello', 42);
  });
});

describe('assignSubLanes', () => {
  const range = (start, dur) => [start, start + dur];

  it('returns empty result for empty input', () => {
    const out = assignSubLanes([], () => [0, 0]);
    expect(out).toEqual({ subLanes: [], maxSubLanes: 0 });
  });

  it('places non-overlapping events on a single sub-lane', () => {
    const events = [
      { id: 'a', start: 0, dur: 30 },
      { id: 'b', start: 30, dur: 30 },
      { id: 'c', start: 60, dur: 30 }
    ];
    const out = assignSubLanes(events, (e) => range(e.start, e.dur));
    expect(out.maxSubLanes).toBe(1);
    expect(out.subLanes).toEqual([0, 0, 0]);
  });

  it('promotes overlapping events to a new sub-lane', () => {
    const events = [
      { id: 'a', start: 0, dur: 60 },
      { id: 'b', start: 30, dur: 60 }
    ];
    const out = assignSubLanes(events, (e) => range(e.start, e.dur));
    expect(out.maxSubLanes).toBe(2);
    expect(out.subLanes).toEqual([0, 1]);
  });

  it('reuses sub-lane 0 once an earlier event has ended', () => {
    const events = [
      { id: 'a', start: 0, dur: 30 },
      { id: 'b', start: 10, dur: 30 },
      { id: 'c', start: 50, dur: 30 }
    ];
    const out = assignSubLanes(events, (e) => range(e.start, e.dur));
    expect(out.maxSubLanes).toBe(2);
    // a ends at 30; b ends at 40; c starts at 50 -> picks first free sub-lane (0).
    expect(out.subLanes).toEqual([0, 1, 0]);
  });

  it('assigns indices in original event order even when input is unsorted', () => {
    const events = [
      { id: 'late', start: 60, dur: 30 },
      { id: 'early', start: 0, dur: 30 },
      { id: 'mid', start: 30, dur: 30 }
    ];
    const out = assignSubLanes(events, (e) => range(e.start, e.dur));
    expect(out.maxSubLanes).toBe(1);
    // result is parallel to input array, so [late, early, mid] all share lane 0.
    expect(out.subLanes).toEqual([0, 0, 0]);
  });

  it('handles three concurrent events by opening three sub-lanes', () => {
    const events = [
      { id: 'a', start: 0, dur: 100 },
      { id: 'b', start: 10, dur: 100 },
      { id: 'c', start: 20, dur: 100 }
    ];
    const out = assignSubLanes(events, (e) => range(e.start, e.dur));
    expect(out.maxSubLanes).toBe(3);
    expect(out.subLanes).toEqual([0, 1, 2]);
  });

  it('treats touching ranges (end == next start) as non-overlapping', () => {
    const events = [
      { id: 'a', start: 0, dur: 30 },
      { id: 'b', start: 30, dur: 30 }
    ];
    const out = assignSubLanes(events, (e) => range(e.start, e.dur));
    expect(out.maxSubLanes).toBe(1);
    expect(out.subLanes).toEqual([0, 0]);
  });

  it('does not mutate the input array', () => {
    const events = [
      { id: 'a', start: 60, dur: 30 },
      { id: 'b', start: 0, dur: 30 }
    ];
    const snapshot = [...events];
    assignSubLanes(events, (e) => range(e.start, e.dur));
    expect(events).toEqual(snapshot);
  });

  it('preserves original order as a sort tie-break when start frames match', () => {
    // Two events at the EXACT same start frame exercise the secondary
    // tie-break in the internal sort (return a - b). Both overlap so
    // they must occupy distinct sub-lanes; the earlier-indexed event
    // should keep sub-lane 0 to mirror insertion order on the timeline.
    const events = [
      { id: 'first', start: 30, dur: 60 },
      { id: 'second', start: 30, dur: 60 }
    ];
    const out = assignSubLanes(events, (e) => range(e.start, e.dur));
    expect(out.maxSubLanes).toBe(2);
    expect(out.subLanes).toEqual([0, 1]);
  });
});
