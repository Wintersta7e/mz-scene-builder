// ============================================
// Main Process Logger (Node-compatible)
// ============================================

const LOG_LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3, NONE: 4 };
const isDev = process.argv.includes('--dev');
let logLevel = isDev ? LOG_LEVELS.DEBUG : LOG_LEVELS.WARN;

function timestamp() {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  return `[${h}:${m}:${s}]`;
}

const logger = {
  setLevel(level) {
    logLevel = LOG_LEVELS[level] ?? LOG_LEVELS.WARN;
  },

  debug(...args) {
    if (logLevel <= LOG_LEVELS.DEBUG) {
      console.log(timestamp(), '[DEBUG]', ...args);
    }
  },

  info(...args) {
    if (logLevel <= LOG_LEVELS.INFO) {
      console.log(timestamp(), '[INFO]', ...args);
    }
  },

  warn(...args) {
    if (logLevel <= LOG_LEVELS.WARN) {
      console.warn(timestamp(), '[WARN]', ...args);
    }
  },

  error(...args) {
    if (logLevel <= LOG_LEVELS.ERROR) {
      console.error(timestamp(), '[ERROR]', ...args);
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
