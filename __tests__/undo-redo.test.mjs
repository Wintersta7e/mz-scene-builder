import { jest } from '@jest/globals';

// Provide global document before any imports (undo-redo.js uses document.title)
globalThis.document = { title: 'Timeline Scene Builder' };

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

// Mock elements
jest.unstable_mockModule('../src/modules/elements.js', () => ({
  getElements: jest.fn(() => ({
    btnPlay: { textContent: '▶' }
  })),
  initElements: jest.fn()
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
    RENDER_PROPERTIES: 'render:properties'
  }
}));

const { state, MAX_UNDO_STACK } = await import('../src/modules/state.js');
const { saveState, undo, redo, markDirty, markClean, checkUnsavedChanges } =
  await import('../src/modules/undo-redo.js');
const { eventBus, Events } = await import('../src/modules/event-bus.js');

describe('undo-redo', () => {
  beforeEach(() => {
    // Reset state for each test
    state.events = [];
    state.selectedEventIndex = -1;
    state.currentFrame = 0;
    state.undoStack = [];
    state.redoStack = [];
    state.isDirty = false;
    document.title = 'Timeline Scene Builder';
    jest.clearAllMocks();
  });

  describe('saveState', () => {
    it('pushes current state to undo stack', () => {
      state.events = [{ type: 'showPicture', startFrame: 0 }];
      state.selectedEventIndex = 0;
      state.currentFrame = 10;

      saveState('test action');

      expect(state.undoStack).toHaveLength(1);
      expect(state.undoStack[0].action).toBe('test action');
      expect(state.undoStack[0].events).toEqual([{ type: 'showPicture', startFrame: 0 }]);
      expect(state.undoStack[0].selectedEventIndex).toBe(0);
      expect(state.undoStack[0].currentFrame).toBe(10);
    });

    it('deep copies events to prevent mutation', () => {
      state.events = [{ type: 'showPicture', startFrame: 0 }];
      saveState('test');

      // Mutate original
      state.events[0].startFrame = 999;

      // Saved state should be unchanged
      expect(state.undoStack[0].events[0].startFrame).toBe(0);
    });

    it('clears redo stack after saving', () => {
      state.redoStack = [{ action: 'old', events: [], selectedEventIndex: -1, currentFrame: 0 }];
      saveState('new action');
      expect(state.redoStack).toHaveLength(0);
    });

    it('marks state as dirty', () => {
      saveState('test');
      expect(state.isDirty).toBe(true);
    });

    it('respects MAX_UNDO_STACK limit and evicts oldest entries', () => {
      for (let i = 0; i < MAX_UNDO_STACK + 10; i++) {
        saveState(`action ${i}`);
      }
      expect(state.undoStack.length).toBe(MAX_UNDO_STACK);
      // Oldest entries (0-9) should have been evicted; entry 10 should be first
      expect(state.undoStack[0].action).toBe('action 10');
      // Newest entry should be last
      expect(state.undoStack[MAX_UNDO_STACK - 1].action).toBe(`action ${MAX_UNDO_STACK + 9}`);
    });
  });

  describe('undo', () => {
    it('restores previous state including selectedEventIndex and currentFrame', () => {
      state.events = [{ type: 'showPicture', startFrame: 0 }];
      state.selectedEventIndex = 0;
      state.currentFrame = 10;
      saveState('add picture');

      state.events.push({ type: 'wait', startFrame: 60 });
      state.selectedEventIndex = 1;
      state.currentFrame = 60;

      undo();

      expect(state.events).toEqual([{ type: 'showPicture', startFrame: 0 }]);
      expect(state.selectedEventIndex).toBe(0);
      expect(state.currentFrame).toBe(10);
      expect(state.undoStack).toHaveLength(0);
    });

    it('pushes current state to redo stack', () => {
      state.events = [];
      saveState('initial');
      state.events = [{ type: 'wait', startFrame: 0 }];

      undo();

      expect(state.redoStack).toHaveLength(1);
      expect(state.redoStack[0].events).toEqual([{ type: 'wait', startFrame: 0 }]);
    });

    it('does nothing when undo stack is empty', () => {
      state.events = [{ type: 'showPicture' }];
      undo();
      expect(state.events).toEqual([{ type: 'showPicture' }]);
    });

    it('emits RENDER event', () => {
      saveState('test');
      undo();
      expect(eventBus.emit).toHaveBeenCalledWith(Events.RENDER);
    });
  });

  describe('redo', () => {
    it('restores next state including selectedEventIndex and currentFrame after undo', () => {
      state.events = [];
      state.selectedEventIndex = -1;
      state.currentFrame = 0;
      saveState('add');
      state.events = [{ type: 'wait', startFrame: 0 }];
      state.selectedEventIndex = 0;
      state.currentFrame = 30;

      undo();
      expect(state.events).toEqual([]);
      expect(state.selectedEventIndex).toBe(-1);
      expect(state.currentFrame).toBe(0);

      redo();
      expect(state.events).toEqual([{ type: 'wait', startFrame: 0 }]);
      expect(state.selectedEventIndex).toBe(0);
      expect(state.currentFrame).toBe(30);
    });

    it('does nothing when redo stack is empty', () => {
      state.events = [{ type: 'showPicture' }];
      redo();
      expect(state.events).toEqual([{ type: 'showPicture' }]);
    });

    it('emits RENDER event', () => {
      saveState('test');
      undo();
      jest.clearAllMocks();
      redo();
      expect(eventBus.emit).toHaveBeenCalledWith(Events.RENDER);
    });
  });

  describe('checkUnsavedChanges', () => {
    it('returns true immediately when not dirty', async () => {
      state.isDirty = false;
      const result = await checkUnsavedChanges();
      expect(result).toBe(true);
    });
  });

  describe('stopPlaybackIfActive (via undo/redo)', () => {
    it('stops playback and clears interval before undo', () => {
      const clearIntervalSpy = jest.spyOn(globalThis, 'clearInterval');
      state.isPlaying = true;
      state.playbackInterval = 123;
      state.waitingForTextClick = true;
      state.events = [{ type: 'wait', startFrame: 0 }];
      saveState('test');
      undo();
      expect(clearIntervalSpy).toHaveBeenCalledWith(123);
      expect(state.isPlaying).toBe(false);
      expect(state.playbackInterval).toBeNull();
      expect(state.waitingForTextClick).toBe(false);
      clearIntervalSpy.mockRestore();
    });

    it('stops playback before redo', () => {
      const clearIntervalSpy = jest.spyOn(globalThis, 'clearInterval');
      state.events = [{ type: 'wait', startFrame: 0 }];
      saveState('test');
      state.events = [{ type: 'wait', startFrame: 10 }];
      undo();
      // Now set up playing state before redo
      state.isPlaying = true;
      state.playbackInterval = 456;
      redo();
      expect(clearIntervalSpy).toHaveBeenCalledWith(456);
      expect(state.isPlaying).toBe(false);
      expect(state.playbackInterval).toBeNull();
      clearIntervalSpy.mockRestore();
    });

    it('does not touch state when not playing', () => {
      state.isPlaying = false;
      state.playbackInterval = null;
      state.events = [{ type: 'wait', startFrame: 0 }];
      saveState('test');
      undo();
      // Should proceed normally without modifying playback fields
      expect(state.isPlaying).toBe(false);
    });
  });

  describe('markDirty/markClean', () => {
    it('markDirty sets isDirty to true and updates title', () => {
      markDirty();
      expect(state.isDirty).toBe(true);
      expect(document.title).toBe('Timeline Scene Builder *');
    });

    it('markClean sets isDirty to false and updates title', () => {
      state.isDirty = true;
      markClean();
      expect(state.isDirty).toBe(false);
      expect(document.title).toBe('Timeline Scene Builder');
    });

    it('markDirty only updates title once when called multiple times', () => {
      markDirty();
      const firstTitle = document.title;
      markDirty();
      expect(document.title).toBe(firstTitle);
    });
  });
});
