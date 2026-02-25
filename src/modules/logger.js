// ============================================
// Logging System
// ============================================

const LOG_LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3, NONE: 4 };
// isDev is exposed through preload script, fallback to false if not available
const isDev = (typeof window !== 'undefined' && window.api && window.api.isDev) || false;
let logLevel = isDev ? LOG_LEVELS.DEBUG : LOG_LEVELS.WARN;

const logger = {
  setLevel(level) {
    logLevel = LOG_LEVELS[level] ?? LOG_LEVELS.WARN;
  },

  debug(...args) {
    if (logLevel <= LOG_LEVELS.DEBUG) {
      console.log('%c[DEBUG]', 'color: #888', ...args);
    }
  },

  info(...args) {
    if (logLevel <= LOG_LEVELS.INFO) {
      console.log('%c[INFO]', 'color: #4a9', ...args);
    }
  },

  warn(...args) {
    if (logLevel <= LOG_LEVELS.WARN) {
      console.warn('%c[WARN]', 'color: #f90', ...args);
    }
  },

  error(...args) {
    if (logLevel <= LOG_LEVELS.ERROR) {
      console.error('%c[ERROR]', 'color: #f44', ...args);
    }
  },

  time(label) {
    if (logLevel <= LOG_LEVELS.DEBUG) {
      console.time(label);
    }
  },

  timeEnd(label) {
    if (logLevel <= LOG_LEVELS.DEBUG) {
      console.timeEnd(label);
    }
  }
};

module.exports = { logger, LOG_LEVELS, isDev };
