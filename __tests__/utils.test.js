const { rgbToHex, hexToRgb, sortEvents, TYPE_PRIORITY, getNextInsertOrder, resetInsertOrderCounter } = require('../src/modules/utils');

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
  beforeEach(() => {
    resetInsertOrderCounter(0);
  });

  describe('frame-based sorting', () => {
    it('sorts events by frame ascending', () => {
      const events = [
        { startFrame: 100, type: 'showPicture' },
        { startFrame: 50, type: 'showPicture' },
        { startFrame: 200, type: 'showPicture' }
      ];

      sortEvents(events);

      expect(events.map(e => e.startFrame)).toEqual([50, 100, 200]);
    });

    it('handles missing startFrame as 0', () => {
      const events = [
        { startFrame: 10, type: 'showPicture' },
        { type: 'showPicture' }, // no startFrame
        { startFrame: 5, type: 'showPicture' }
      ];

      sortEvents(events);

      expect(events.map(e => e.startFrame || 0)).toEqual([0, 5, 10]);
    });
  });

  describe('type priority sorting (same frame)', () => {
    it('sorts by type priority when frames are equal', () => {
      const events = [
        { startFrame: 0, type: 'showText' },      // priority 7
        { startFrame: 0, type: 'showPicture' },   // priority 0
        { startFrame: 0, type: 'wait' },          // priority 6
        { startFrame: 0, type: 'movePicture' }    // priority 1
      ];

      sortEvents(events);

      expect(events.map(e => e.type)).toEqual([
        'showPicture',  // 0
        'movePicture',  // 1
        'wait',         // 6
        'showText'      // 7
      ]);
    });

    it('handles unknown types with priority 0', () => {
      const events = [
        { startFrame: 0, type: 'showText' },
        { startFrame: 0, type: 'unknownType' }  // defaults to priority 0
      ];

      sortEvents(events);

      expect(events.map(e => e.type)).toEqual(['unknownType', 'showText']);
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

      expect(events.map(e => e.imageName)).toEqual(['third', 'second', 'first']);
    });

    it('handles missing _insertOrder as 0', () => {
      const events = [
        { startFrame: 0, type: 'showPicture', _insertOrder: 5, imageName: 'with' },
        { startFrame: 0, type: 'showPicture', imageName: 'without' } // no _insertOrder
      ];

      sortEvents(events);

      expect(events.map(e => e.imageName)).toEqual(['with', 'without']);
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
  beforeEach(() => {
    resetInsertOrderCounter(0);
  });

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
