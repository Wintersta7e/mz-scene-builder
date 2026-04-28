// ============================================
// Utility Functions
// ============================================

function rgbToHex(r, g, b) {
  const toHex = (c) => {
    const hex = Math.max(0, Math.min(255, Math.round(c))).toString(16);
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

export {
  rgbToHex,
  hexToRgb,
  sortEvents,
  TYPE_PRIORITY,
  getNextInsertOrder,
  resetInsertOrderCounter,
  makeTrailingThrottle
};
