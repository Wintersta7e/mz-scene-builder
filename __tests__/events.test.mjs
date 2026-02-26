import { jest } from '@jest/globals';

// Mock logger
jest.unstable_mockModule('../src/modules/logger.js', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    time: jest.fn(),
    timeEnd: jest.fn()
  }
}));

// Mock event-bus
jest.unstable_mockModule('../src/modules/event-bus.js', () => ({
  eventBus: {
    on: jest.fn(),
    emit: jest.fn(),
    off: jest.fn(),
    clear: jest.fn()
  },
  Events: {
    RENDER: 'render',
    RENDER_TIMELINE: 'render:timeline',
    RENDER_PREVIEW: 'render:preview',
    RENDER_PROPERTIES: 'render:properties',
    PROJECT_LOADED: 'project:loaded'
  }
}));

// Mock undo-redo
jest.unstable_mockModule('../src/modules/undo-redo.js', () => ({
  saveState: jest.fn(),
  markDirty: jest.fn(),
  markClean: jest.fn()
}));

// Mock elements
jest.unstable_mockModule('../src/modules/elements.js', () => ({
  getElements: jest.fn(() => ({
    deleteEvent: { disabled: false },
    imageBrowser: { querySelectorAll: jest.fn(() => []) }
  })),
  initElements: jest.fn()
}));

// Mock utils — need to provide real implementations for sort/insertOrder
let _insertOrderCounter = 0;
jest.unstable_mockModule('../src/modules/utils.js', () => ({
  sortEvents: jest.fn((events) => events.sort((a, b) => (a.startFrame || 0) - (b.startFrame || 0))),
  getNextInsertOrder: jest.fn(() => ++_insertOrderCounter),
  resetInsertOrderCounter: jest.fn((val) => {
    _insertOrderCounter = val;
  })
}));

const { state, MAX_PICTURE_NUMBER } = await import('../src/modules/state.js');
const {
  getEventLane,
  getEventDuration,
  createDefaultEvent,
  getNextPictureNumber
} = await import('../src/modules/events.js');

describe('events', () => {
  beforeEach(() => {
    state.events = [];
    state.selectedEventIndex = -1;
    state.currentFrame = 0;
    _insertOrderCounter = 0;
    jest.clearAllMocks();
  });

  describe('getEventLane', () => {
    it('returns lane 0 for picture events', () => {
      expect(getEventLane('showPicture')).toBe(0);
      expect(getEventLane('movePicture')).toBe(0);
      expect(getEventLane('rotatePicture')).toBe(0);
      expect(getEventLane('erasePicture')).toBe(0);
    });

    it('returns lane 1 for effect events', () => {
      expect(getEventLane('tintPicture')).toBe(1);
      expect(getEventLane('screenFlash')).toBe(1);
      expect(getEventLane('wait')).toBe(1);
    });

    it('returns lane 2 for text events', () => {
      expect(getEventLane('showText')).toBe(2);
    });

    it('returns lane 0 for unknown types', () => {
      expect(getEventLane('unknown')).toBe(0);
    });
  });

  describe('getEventDuration', () => {
    it('returns 1 for showText', () => {
      expect(getEventDuration('showText', {})).toBe(1);
    });

    it('returns 1 for erasePicture', () => {
      expect(getEventDuration('erasePicture', {})).toBe(1);
    });

    it('returns frames for wait events', () => {
      expect(getEventDuration('wait', { frames: 120 })).toBe(120);
      expect(getEventDuration('wait', {})).toBe(60); // default
    });

    it('returns duration for screenFlash', () => {
      expect(getEventDuration('screenFlash', { duration: 16 })).toBe(16);
      expect(getEventDuration('screenFlash', {})).toBe(8); // default
    });

    it('returns 30 for showPicture default', () => {
      expect(getEventDuration('showPicture', {})).toBe(30);
    });

    it('returns duration for movePicture', () => {
      expect(getEventDuration('movePicture', { duration: 90 })).toBe(90);
      expect(getEventDuration('movePicture', {})).toBe(60); // default
    });

    it('returns duration for tintPicture', () => {
      expect(getEventDuration('tintPicture', { duration: 30 })).toBe(30);
      expect(getEventDuration('tintPicture', {})).toBe(60); // default
    });

    it('returns 30 for rotatePicture', () => {
      expect(getEventDuration('rotatePicture', {})).toBe(30);
    });

    it('uses evt.duration if present for showPicture', () => {
      expect(getEventDuration('showPicture', { duration: 45 })).toBe(45);
    });
  });

  describe('createDefaultEvent', () => {
    it('creates showPicture with correct defaults', () => {
      state.currentFrame = 10;
      const evt = createDefaultEvent('showPicture');
      expect(evt.type).toBe('showPicture');
      expect(evt.startFrame).toBe(10);
      expect(evt.pictureNumber).toBe(1);
      expect(evt.imageName).toBe('');
      expect(evt.origin).toBe(0);
      expect(evt.x).toBe(0);
      expect(evt.y).toBe(0);
      expect(evt.scaleX).toBe(100);
      expect(evt.scaleY).toBe(100);
      expect(evt.opacity).toBe(255);
      expect(evt.blend).toBe(0);
      expect(evt._insertOrder).toBeDefined();
    });

    it('creates movePicture with correct defaults', () => {
      const evt = createDefaultEvent('movePicture');
      expect(evt.type).toBe('movePicture');
      expect(evt.duration).toBe(60);
      expect(evt.wait).toBe(true);
      expect(evt.easingType).toBe(0);
    });

    it('creates rotatePicture with correct defaults', () => {
      const evt = createDefaultEvent('rotatePicture');
      expect(evt.type).toBe('rotatePicture');
      expect(evt.speed).toBe(0);
    });

    it('creates tintPicture with correct defaults', () => {
      const evt = createDefaultEvent('tintPicture');
      expect(evt.type).toBe('tintPicture');
      expect(evt.red).toBe(0);
      expect(evt.green).toBe(0);
      expect(evt.blue).toBe(0);
      expect(evt.gray).toBe(0);
      expect(evt.duration).toBe(60);
      expect(evt.wait).toBe(true);
    });

    it('creates erasePicture with correct defaults', () => {
      const evt = createDefaultEvent('erasePicture');
      expect(evt.type).toBe('erasePicture');
      expect(evt.pictureNumber).toBeDefined();
    });

    it('creates showText with correct defaults', () => {
      const evt = createDefaultEvent('showText');
      expect(evt.type).toBe('showText');
      expect(evt.text).toBe('');
      expect(evt.background).toBe(0);
      expect(evt.position).toBe(2);
    });

    it('creates wait with correct defaults', () => {
      const evt = createDefaultEvent('wait');
      expect(evt.type).toBe('wait');
      expect(evt.frames).toBe(60);
    });

    it('creates screenFlash with correct defaults', () => {
      const evt = createDefaultEvent('screenFlash');
      expect(evt.type).toBe('screenFlash');
      expect(evt.red).toBe(255);
      expect(evt.green).toBe(255);
      expect(evt.blue).toBe(255);
      expect(evt.intensity).toBe(170);
      expect(evt.duration).toBe(8);
      expect(evt.wait).toBe(true);
    });

    it('returns minimal object for unknown type', () => {
      const evt = createDefaultEvent('unknown');
      expect(evt.type).toBe('unknown');
    });
  });

  describe('getNextPictureNumber', () => {
    it('returns 1 when no pictures exist', () => {
      expect(getNextPictureNumber()).toBe(1);
    });

    it('returns next available number', () => {
      state.events = [
        { type: 'showPicture', pictureNumber: 1 },
        { type: 'showPicture', pictureNumber: 2 }
      ];
      expect(getNextPictureNumber()).toBe(3);
    });

    it('fills gaps in picture numbers', () => {
      state.events = [
        { type: 'showPicture', pictureNumber: 1 },
        { type: 'showPicture', pictureNumber: 3 }
      ];
      expect(getNextPictureNumber()).toBe(2);
    });

    it('returns 1 when all numbers are used', () => {
      state.events = [];
      for (let i = 1; i <= MAX_PICTURE_NUMBER; i++) {
        state.events.push({ type: 'showPicture', pictureNumber: i });
      }
      expect(getNextPictureNumber()).toBe(1);
    });

    it('ignores non-showPicture events', () => {
      state.events = [
        { type: 'movePicture', pictureNumber: 1 },
        { type: 'wait', frames: 60 }
      ];
      expect(getNextPictureNumber()).toBe(1);
    });
  });
});
