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
const { saveState, undo, redo, markDirty, markClean } = await import('../src/modules/undo-redo.js');
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

    it('respects MAX_UNDO_STACK limit', () => {
      for (let i = 0; i < MAX_UNDO_STACK + 10; i++) {
        saveState(`action ${i}`);
      }
      expect(state.undoStack.length).toBe(MAX_UNDO_STACK);
    });
  });

  describe('undo', () => {
    it('restores previous state', () => {
      state.events = [{ type: 'showPicture', startFrame: 0 }];
      saveState('add picture');

      state.events.push({ type: 'wait', startFrame: 60 });
      state.selectedEventIndex = 1;

      undo();

      expect(state.events).toEqual([{ type: 'showPicture', startFrame: 0 }]);
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
    it('restores next state after undo', () => {
      state.events = [];
      saveState('add');
      state.events = [{ type: 'wait', startFrame: 0 }];

      undo();
      expect(state.events).toEqual([]);

      redo();
      expect(state.events).toEqual([{ type: 'wait', startFrame: 0 }]);
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
