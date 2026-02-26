import { jest } from '@jest/globals';

// Mock logger before importing event-bus
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

const { eventBus, Events } = await import('../src/modules/event-bus.js');
const { logger } = await import('../src/modules/logger.js');

describe('eventBus', () => {
  afterEach(() => {
    eventBus.clear();
    jest.clearAllMocks();
  });

  describe('on/emit', () => {
    it('calls listener when event is emitted', () => {
      const handler = jest.fn();
      eventBus.on('test', handler);
      eventBus.emit('test');
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('passes arguments to listener', () => {
      const handler = jest.fn();
      eventBus.on('test', handler);
      eventBus.emit('test', 'arg1', 42);
      expect(handler).toHaveBeenCalledWith('arg1', 42);
    });

    it('calls multiple listeners for the same event', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      eventBus.on('test', handler1);
      eventBus.on('test', handler2);
      eventBus.emit('test');
      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it('does not call listeners for other events', () => {
      const handler = jest.fn();
      eventBus.on('test', handler);
      eventBus.emit('other');
      expect(handler).not.toHaveBeenCalled();
    });

    it('returns an unsubscribe function', () => {
      const handler = jest.fn();
      const unsub = eventBus.on('test', handler);
      unsub();
      eventBus.emit('test');
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('once', () => {
    it('calls listener only once', () => {
      const handler = jest.fn();
      eventBus.once('test', handler);
      eventBus.emit('test');
      eventBus.emit('test');
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('passes arguments to once listener', () => {
      const handler = jest.fn();
      eventBus.once('test', handler);
      eventBus.emit('test', 'data');
      expect(handler).toHaveBeenCalledWith('data');
    });
  });

  describe('off', () => {
    it('removes a specific listener', () => {
      const handler = jest.fn();
      eventBus.on('test', handler);
      eventBus.off('test', handler);
      eventBus.emit('test');
      expect(handler).not.toHaveBeenCalled();
    });

    it('does not throw for non-existent event', () => {
      const handler = jest.fn();
      expect(() => eventBus.off('nonexistent', handler)).not.toThrow();
    });
  });

  describe('clear', () => {
    it('removes all listeners for a specific event', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      eventBus.on('test', handler1);
      eventBus.on('other', handler2);
      eventBus.clear('test');
      eventBus.emit('test');
      eventBus.emit('other');
      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it('removes all listeners when called without argument', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      eventBus.on('test', handler1);
      eventBus.on('other', handler2);
      eventBus.clear();
      eventBus.emit('test');
      eventBus.emit('other');
      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).not.toHaveBeenCalled();
    });
  });

  describe('error handling in handlers', () => {
    it('catches errors in handlers and continues', () => {
      const badHandler = jest.fn(() => {
        throw new Error('handler error');
      });
      const goodHandler = jest.fn();
      eventBus.on('test', badHandler);
      eventBus.on('test', goodHandler);
      eventBus.emit('test');
      expect(badHandler).toHaveBeenCalled();
      expect(goodHandler).toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error in event handler'),
        expect.any(Error)
      );
    });
  });

  describe('listenerCount', () => {
    it('returns 0 for events with no listeners', () => {
      expect(eventBus.listenerCount('nonexistent')).toBe(0);
    });

    it('returns correct count', () => {
      eventBus.on('test', () => {});
      eventBus.on('test', () => {});
      expect(eventBus.listenerCount('test')).toBe(2);
    });

    it('decrements when listener is removed', () => {
      const handler = jest.fn();
      eventBus.on('test', handler);
      expect(eventBus.listenerCount('test')).toBe(1);
      eventBus.off('test', handler);
      expect(eventBus.listenerCount('test')).toBe(0);
    });
  });

  describe('getRegisteredEvents', () => {
    it('returns empty array when no events registered', () => {
      expect(eventBus.getRegisteredEvents()).toEqual([]);
    });

    it('returns event names with active listeners', () => {
      eventBus.on('alpha', () => {});
      eventBus.on('beta', () => {});
      const events = eventBus.getRegisteredEvents();
      expect(events).toContain('alpha');
      expect(events).toContain('beta');
      expect(events).toHaveLength(2);
    });

    it('excludes events whose listeners were all removed', () => {
      const handler = jest.fn();
      eventBus.on('test', handler);
      eventBus.off('test', handler);
      expect(eventBus.getRegisteredEvents()).not.toContain('test');
    });
  });
});

describe('Events constants', () => {
  it('has render events', () => {
    expect(Events.RENDER).toBe('render');
    expect(Events.RENDER_TIMELINE).toBe('render:timeline');
    expect(Events.RENDER_PREVIEW).toBe('render:preview');
    expect(Events.RENDER_PROPERTIES).toBe('render:properties');
  });

  it('has project events', () => {
    expect(Events.PROJECT_LOADED).toBe('project:loaded');
    expect(Events.SCENE_LOADED).toBe('scene:loaded');
    expect(Events.OPEN_RECENT_PROJECT).toBe('project:open-recent');
  });
});
