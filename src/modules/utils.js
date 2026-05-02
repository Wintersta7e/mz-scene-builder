// ============================================
// Utility Functions
// ============================================

/**
 * @param {number} v
 * @param {number} min
 * @param {number} max
 */
function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

/**
 * Remove every child of `el` in place.
 * @param {Element} el
 */
function clearChildren(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

/**
 * Zero-pad a frame counter for display.
 * @param {number} frame
 * @param {number} [width]
 */
function formatFrameNumber(frame, width = 4) {
  return String(frame).padStart(width, '0');
}

/**
 * Format a frame count as a time string.
 * - `'ss:ff'` (default): seconds:frames within the second.
 * - `'mm:ss'`: minutes:seconds.
 *
 * @param {number} frame
 * @param {'ss:ff' | 'mm:ss'} [mode]
 */
function formatFrameTime(frame, mode = 'ss:ff') {
  if (mode === 'mm:ss') {
    const totalSec = Math.max(0, Math.floor(frame / 60));
    const mm = String(Math.floor(totalSec / 60)).padStart(2, '0');
    const ss = String(totalSec % 60).padStart(2, '0');
    return `${mm}:${ss}`;
  }
  const ss = String(Math.floor(frame / 60)).padStart(2, '0');
  const ff = String(frame % 60).padStart(2, '0');
  return `${ss}:${ff}`;
}

function rgbToHex(r, g, b) {
  const toHex = (c) => {
    const hex = clamp(Math.round(c), 0, 255).toString(16);
    return hex.length === 1 ? `0${hex}` : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      }
    : { r: 0, g: 0, b: 0 };
}

// Event type priority for sorting
const TYPE_PRIORITY = {
  showPicture: 0,
  movePicture: 1,
  rotatePicture: 2,
  tintPicture: 3,
  erasePicture: 4,
  screenFlash: 5,
  wait: 6,
  showText: 7
};

function sortEvents(events) {
  events.sort((a, b) => {
    // First, sort by frame
    const frameDiff = (a.startFrame || 0) - (b.startFrame || 0);
    if (frameDiff !== 0) return frameDiff;
    // At same frame, sort by type priority (pictures before text, etc.)
    const typeDiff = (TYPE_PRIORITY[a.type] || 0) - (TYPE_PRIORITY[b.type] || 0);
    if (typeDiff !== 0) return typeDiff;
    // Same type at same frame: newer events (higher _insertOrder) come first
    return (b._insertOrder || 0) - (a._insertOrder || 0);
  });
}

// Counter for insertion ordering (newer = higher)
let insertOrderCounter = 0;
function getNextInsertOrder() {
  return ++insertOrderCounter;
}

function resetInsertOrderCounter(maxOrder = 0) {
  insertOrderCounter = maxOrder;
}

/**
 * Trailing-throttle wrapper. The first call schedules `fn` to fire after
 * `ms`; subsequent calls during the wait are dropped. After firing, the
 * next call is free to schedule again. Exposes a `cancel()` method that
 * clears any pending fire without invoking `fn`.
 *
 * @template {(...args: any[]) => any} F
 * @param {number} ms
 * @param {F} fn
 * @returns {((...args: Parameters<F>) => void) & { cancel: () => void }}
 */
function makeTrailingThrottle(ms, fn) {
  /** @type {ReturnType<typeof setTimeout> | null} */
  let timer = null;
  /** @type {any} */
  const throttled = (...args) => {
    if (timer !== null) return;
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, ms);
  };
  throttled.cancel = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };
  return throttled;
}

/**
 * Greedy interval-scheduling sub-lane assignment. Given a list of events
 * and a function that yields each event's `[startFrame, endFrame)` range,
 * returns an array of sub-lane indices parallel to the input plus the
 * total number of sub-lanes used. Sub-lane 0 is the topmost row; events
 * are placed on the lowest-numbered sub-lane whose previous event has
 * already ended.
 *
 * The events array is not mutated. Internally it is processed in
 * order-of-appearance (after a stable sort by start frame), so callers
 * should pre-sort or provide events already in chronological order.
 *
 * @param {Array<*>} events
 * @param {(ev: *) => [number, number]} getRange
 * @returns {{ subLanes: number[], maxSubLanes: number }}
 */
function assignSubLanes(events, getRange) {
  const n = events.length;
  if (n === 0) return { subLanes: [], maxSubLanes: 0 };

  // Sort indices by start frame (stable). We need to map back to original order.
  const indices = events.map((_, i) => i);
  indices.sort((a, b) => {
    const [as] = getRange(events[a]);
    const [bs] = getRange(events[b]);
    if (as !== bs) return as - bs;
    return a - b;
  });

  /** @type {number[]} */
  const result = new Array(n);
  /** @type {number[]} last endFrame per existing sub-lane */
  const subLaneEnds = [];

  for (const i of indices) {
    const [start, end] = getRange(events[i]);
    let placed = -1;
    for (let s = 0; s < subLaneEnds.length; s++) {
      if (subLaneEnds[s] <= start) {
        placed = s;
        break;
      }
    }
    if (placed === -1) {
      placed = subLaneEnds.length;
      subLaneEnds.push(end);
    } else {
      subLaneEnds[placed] = end;
    }
    result[i] = placed;
  }

  return { subLanes: result, maxSubLanes: subLaneEnds.length };
}

export {
  clamp,
  clearChildren,
  formatFrameNumber,
  formatFrameTime,
  rgbToHex,
  hexToRgb,
  sortEvents,
  TYPE_PRIORITY,
  getNextInsertOrder,
  resetInsertOrderCounter,
  makeTrailingThrottle,
  assignSubLanes
};
