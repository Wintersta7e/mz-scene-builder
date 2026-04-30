// ============================================
// Renderer Logger
//
// Writes to the DevTools console AND forwards each entry to the main
// process via window.api.log so a single log file at
// `app.getPath('logs')/main.log` captures both processes.
// ============================================

const LOG_LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3, NONE: 4 };
const isDev = (typeof window !== 'undefined' && window.api && window.api.isDev) || false;
// Production default is INFO so lifecycle events make it into the file
// even when DevTools is closed. Dev keeps the full DEBUG firehose.
let logLevel = isDev ? LOG_LEVELS.DEBUG : LOG_LEVELS.INFO;

// One-frame budget at 60 Hz. Anything wrapped in logger.timed that takes
// longer than this drops at least one frame, which is what users feel as
// "sluggish" even though nothing is technically broken.
const SLOW_OP_THRESHOLD_MS = 16;
// PerformanceObserver `longtask` reports anything blocking the main thread
// for >= 50 ms (per spec). Used as a catch-all backstop — surfaces lag
// from layout, paint, GC, third-party iframes, anything our wraps don't
// see.
const LONG_TASK_THRESHOLD_MS = 50;
// Suppress longtask warnings during initial app paint; the first ~2 s
// always contains a few legitimate long tasks (JS evaluation, full
// initial layout).
const STARTUP_GRACE_MS = 2000;

function safeStringify(value) {
  if (value === null || value === undefined) return String(value);
  const t = typeof value;
  if (t === 'string' || t === 'number' || t === 'boolean') return String(value);
  if (value instanceof Error) return `${value.name}: ${value.message}\n${value.stack || ''}`.trim();
  if (value instanceof Element) {
    const id = value.id ? `#${value.id}` : '';
    const cls = value.className ? `.${String(value.className).split(/\s+/).join('.')}` : '';
    return `<${value.tagName.toLowerCase()}${id}${cls}>`;
  }
  try {
    return JSON.stringify(value);
  } catch (_e) {
    return '[unserializable]';
  }
}

function forwardToMain(level, args) {
  if (typeof window === 'undefined' || !window.api || !window.api.log) return;
  try {
    window.api.log(level, args.map(safeStringify));
  } catch (_e) {
    // ignore
  }
}

const logger = {
  setLevel(level) {
    logLevel = LOG_LEVELS[level] ?? LOG_LEVELS.WARN;
  },

  debug(...args) {
    if (logLevel <= LOG_LEVELS.DEBUG) {
      console.log('%c[DEBUG]', 'color: #888', ...args);
      forwardToMain('debug', args);
    }
  },

  info(...args) {
    if (logLevel <= LOG_LEVELS.INFO) {
      console.log('%c[INFO]', 'color: #4a9', ...args);
      forwardToMain('info', args);
    }
  },

  warn(...args) {
    if (logLevel <= LOG_LEVELS.WARN) {
      console.warn('%c[WARN]', 'color: #f90', ...args);
      forwardToMain('warn', args);
    }
  },

  error(...args) {
    if (logLevel <= LOG_LEVELS.ERROR) {
      console.error('%c[ERROR]', 'color: #f44', ...args);
      forwardToMain('error', args);
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
  },

  /**
   * Wrap a function call. If it exceeds SLOW_OP_THRESHOLD_MS the duration
   * is logged at warn level (so it lands in the file at the default INFO
   * log level). At DEBUG level every call's duration is logged. Handles
   * both sync return values and Promises — async functions are timed
   * end-to-end.
   *
   * @template T
   * @param {string} label
   * @param {() => T} fn
   * @returns {T}
   */
  timed(label, fn) {
    const t0 = performance.now();
    const report = () => {
      const dt = performance.now() - t0;
      if (dt >= SLOW_OP_THRESHOLD_MS) {
        this.warn(`slow: ${label} took ${dt.toFixed(1)}ms`);
      } else if (logLevel <= LOG_LEVELS.DEBUG) {
        this.debug(`${label} took ${dt.toFixed(1)}ms`);
      }
    };
    let result;
    try {
      result = fn();
    } catch (err) {
      report();
      throw err;
    }
    if (result && typeof result.then === 'function') {
      return /** @type {T} */ (
        result.then(
          (v) => {
            report();
            return v;
          },
          (e) => {
            report();
            throw e;
          }
        )
      );
    }
    report();
    return result;
  }
};

// Surface unhandled errors and promise rejections in both console and
// the file. These hooks fire in the renderer process; main has its own
// equivalents so errors from either side land in the same log.
if (typeof window !== 'undefined') {
  window.addEventListener('error', (e) => {
    logger.error('window.error:', e.message, e.filename ? `at ${e.filename}:${e.lineno}:${e.colno}` : '');
  });
  window.addEventListener('unhandledrejection', (e) => {
    logger.error('unhandledrejection:', e.reason);
  });
}

// Long Task observer — catches any main-thread block >= 50 ms regardless
// of cause (JS, layout, paint, GC). Skips the initial paint window so
// app-startup tasks don't flood the log.
if (typeof PerformanceObserver !== 'undefined') {
  try {
    const obs = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.startTime < STARTUP_GRACE_MS) continue;
        if (entry.duration < LONG_TASK_THRESHOLD_MS) continue;
        logger.warn(
          `longtask: ${entry.duration.toFixed(1)}ms (start=${entry.startTime.toFixed(0)}ms, name=${entry.name})`
        );
      }
    });
    obs.observe({ entryTypes: ['longtask'] });
  } catch (_e) {
    // longtask entry type not supported — skip silently.
  }
}

export { logger, LOG_LEVELS, isDev, safeStringify };
