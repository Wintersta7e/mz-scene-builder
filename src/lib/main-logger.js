// ============================================
// Main Process Logger (Node-compatible)
//
// Console output + optional persistent file output. The renderer process
// forwards its own log messages through an IPC channel into this same
// logger so a single chronological file captures both processes.
// ============================================

const fs = require('node:fs');
const path = require('node:path');

const LOG_LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3, NONE: 4 };
const isDev = process.argv.includes('--dev');
// In production we default to INFO so lifecycle, IPC, and warning events
// are captured without DEBUG-level spam. Dev mode keeps full DEBUG output.
let logLevel = isDev ? LOG_LEVELS.DEBUG : LOG_LEVELS.INFO;

/** @type {string | null} */
let logFilePath = null;

function timestamp() {
  const now = new Date();
  const date = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  const ms = String(now.getMilliseconds()).padStart(3, '0');
  return `[${date} ${h}:${m}:${s}.${ms}]`;
}

/** @param {unknown} value */
function safeStringify(value) {
  if (value === null || value === undefined) {
    return String(value);
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (value instanceof Error) {
    return `${value.name}: ${value.message}\n${value.stack || ''}`.trim();
  }
  try {
    return JSON.stringify(value);
  } catch {
    return '[unserializable]';
  }
}

/**
 * @param {string} level
 * @param {unknown[]} args
 */
function format(level, args) {
  const parts = args.map(safeStringify);
  return `${timestamp()} [${level}] ${parts.join(' ')}`;
}

/** @param {string} line */
function appendToFile(line) {
  if (!logFilePath) {
    return;
  }
  try {
    fs.appendFileSync(logFilePath, `${line}\n`, 'utf-8');
  } catch {
    // File-system errors must never crash the app. Drop to console-only.
    logFilePath = null;
  }
}

/**
 * Wire a log file path. Called once from main.js after app.whenReady() so
 * we can resolve `app.getPath('logs')`. Rotates the existing log: any
 * `main.log` from the previous session is renamed to `main.log.1`. Only
 * one historical backup is kept.
 *
 * @param {string} filePath
 */
function attachFile(filePath) {
  try {
    const dir = path.dirname(filePath);
    fs.mkdirSync(dir, { recursive: true });

    const backupPath = `${filePath}.1`;
    if (fs.existsSync(filePath)) {
      try {
        if (fs.existsSync(backupPath)) {
          fs.unlinkSync(backupPath);
        }
        fs.renameSync(filePath, backupPath);
      } catch {
        // Rotation failure is non-fatal — we'll just append to the existing file.
      }
    }

    logFilePath = filePath;
    const banner = format('INFO', ['--- log started ---', `pid=${process.pid}`, `dev=${isDev}`]);
    appendToFile(banner);
  } catch (err) {
    // Couldn't set up the file at all. Stay console-only.
    logFilePath = null;
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`${timestamp()} [WARN] Failed to attach log file:`, msg);
  }
}

function getLogFilePath() {
  return logFilePath;
}

const logger = {
  /** @param {keyof typeof LOG_LEVELS} level */
  setLevel(level) {
    logLevel = LOG_LEVELS[level] ?? LOG_LEVELS.WARN;
  },

  /** @param {unknown[]} args */
  debug(/** @type {unknown[]} */ ...args) {
    if (logLevel <= LOG_LEVELS.DEBUG) {
      const line = format('DEBUG', args);
      console.log(line);
      appendToFile(line);
    }
  },

  /** @param {unknown[]} args */
  info(/** @type {unknown[]} */ ...args) {
    if (logLevel <= LOG_LEVELS.INFO) {
      const line = format('INFO', args);
      console.log(line);
      appendToFile(line);
    }
  },

  /** @param {unknown[]} args */
  warn(/** @type {unknown[]} */ ...args) {
    if (logLevel <= LOG_LEVELS.WARN) {
      const line = format('WARN', args);
      console.warn(line);
      appendToFile(line);
    }
  },

  /** @param {unknown[]} args */
  error(/** @type {unknown[]} */ ...args) {
    if (logLevel <= LOG_LEVELS.ERROR) {
      const line = format('ERROR', args);
      console.error(line);
      appendToFile(line);
    }
  },

  /** @param {string} label */
  time(label) {
    if (logLevel <= LOG_LEVELS.DEBUG) {
      console.time(label);
    }
  },

  /** @param {string} label */
  timeEnd(label) {
    if (logLevel <= LOG_LEVELS.DEBUG) {
      console.timeEnd(label);
    }
  }
};

module.exports = { logger, LOG_LEVELS, isDev, attachFile, getLogFilePath, safeStringify };
