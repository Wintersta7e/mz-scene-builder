// ============================================
// Event Bus - Centralized Event Emitter
// ============================================

import { logger } from './logger.js';

const listeners = new Map();

const eventBus = {
  /**
   * Subscribe to an event
   * @param {string} event - Event name
   * @param {Function} callback - Handler function
   * @returns {Function} Unsubscribe function
   */
  on(event, callback) {
    if (!listeners.has(event)) {
      listeners.set(event, new Set());
    }
    listeners.get(event).add(callback);

    // Return unsubscribe function
    return () => listeners.get(event)?.delete(callback);
  },

  /**
   * Subscribe to an event once
   * @param {string} event - Event name
   * @param {Function} callback - Handler function
   */
  once(event, callback) {
    const wrapper = (...args) => {
      this.off(event, wrapper);
      callback(...args);
    };
    this.on(event, wrapper);
  },

  /**
   * Unsubscribe from an event
   * @param {string} event - Event name
   * @param {Function} callback - Handler to remove
   */
  off(event, callback) {
    listeners.get(event)?.delete(callback);
  },

  /**
   * Emit an event
   * @param {string} event - Event name
   * @param {...*} args - Arguments to pass to handlers
   */
  emit(event, ...args) {
    const eventListeners = listeners.get(event);
    if (eventListeners) {
      logger.debug('emit', event, `(${eventListeners.size} listeners)`);
      for (const callback of eventListeners) {
        try {
          callback(...args);
        } catch (err) {
          logger.error(`Error in event handler for "${event}":`, err);
        }
      }
    }
  },

  /**
   * Remove all listeners for an event (or all events if no event specified)
   * @param {string} [event] - Event name (optional)
   */
  clear(event) {
    if (event) {
      listeners.delete(event);
    } else {
      listeners.clear();
    }
  },

  /**
   * Get the number of listeners for an event
   * @param {string} event - Event name
   * @returns {number} Number of listeners
   */
  listenerCount(event) {
    return listeners.get(event)?.size || 0;
  },

  /**
   * Get all event names that have listeners registered
   * @returns {string[]} Array of event names
   */
  getRegisteredEvents() {
    return Array.from(listeners.keys()).filter((key) => listeners.get(key).size > 0);
  }
};

// Event name constants
const Events = {
  // Render events
  RENDER: 'render', // Full render (timeline + preview + properties)
  RENDER_TIMELINE: 'render:timeline', // Timeline only
  RENDER_PREVIEW: 'render:preview', // Preview at current frame
  RENDER_PROPERTIES: 'render:properties', // Properties panel

  // State events
  STATE_CHANGED: 'state:changed', // Any state change
  EVENT_SELECTED: 'event:selected', // Event selection changed
  FRAME_CHANGED: 'frame:changed', // Current frame changed

  // Project events
  PROJECT_LOADED: 'project:loaded', // Project was loaded
  SCENE_LOADED: 'scene:loaded', // Scene was loaded
  SCENE_SAVED: 'scene:saved', // Scene was saved

  // Recent project events
  OPEN_RECENT_PROJECT: 'project:open-recent'
};

export { eventBus, Events };
