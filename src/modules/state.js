// ============================================
// Central State Store
// ============================================

// App metadata
const APP_VERSION = '2.0.0';

// Timeline constants
const TIMELINE_LANES = ['Pictures', 'Effects', 'Text', 'Timing'];
// CSS data-lane tokens, parallel to TIMELINE_LANES — used by [data-lane=...]
// rules in styles.css to colour timeline lanes, event blocks, chips, the
// minimap pills, and inspector tags.
const LANE_DATA = ['picture', 'effect', 'text', 'aux'];
const LANE_HEIGHT = 24;
const MAX_UNDO_STACK = 50;
const MAX_RECENT_PROJECTS = 5;
const SETTINGS_KEY = 'timelineSceneBuilder';
const AUTOSAVE_INTERVAL = 3 * 60 * 1000; // 3 minutes
const GRID_SIZE = 64;

// RPG Maker MZ defaults
const FRAMES_PER_SECOND = 60;
const DEFAULT_TIMELINE_LENGTH = 300;
const DEFAULT_SCREEN_WIDTH = 816;
const DEFAULT_SCREEN_HEIGHT = 624;
const MAX_OPACITY = 255;
const DEFAULT_SCALE = 100;
const MAX_PICTURE_NUMBER = 100;
const DEFAULT_DURATION = 60;

// Central state object
const state = {
  // Project
  /** @type {string | null} */
  projectPath: null,
  /** @type {any} */
  folderStructure: null,

  // Events
  /** @type {TimelineEvent[]} */
  events: [],
  selectedEventIndex: -1,

  // Timeline
  currentFrame: 0,
  timelineScale: 5, // pixels per frame
  timelineLength: 300, // frames (5 seconds at 60fps)

  // Playback
  isPlaying: false,
  /** @type {ReturnType<typeof setInterval> | null} */
  playbackInterval: null,
  waitingForTextClick: false,
  /** @type {Set<number>} */
  processedTextEvents: new Set(),

  // Undo/Redo
  /** @type {Array<{ events: TimelineEvent[]; selectedEventIndex: number; currentFrame: number; timelineLength: number; description: string }>} */
  undoStack: [],
  /** @type {Array<{ events: TimelineEvent[]; selectedEventIndex: number; currentFrame: number; timelineLength: number; description: string }>} */
  redoStack: [],

  // Dirty state
  isDirty: false,
  /** @type {string | null} */
  currentScenePath: null,

  // Autosave
  /** @type {ReturnType<typeof setInterval> | null} */
  autosaveInterval: null,

  // Grid
  gridVisible: false,
  snapToGrid: false,

  // Screen resolution
  screenWidth: 816,
  screenHeight: 624,

  // Clipboard
  /** @type {TimelineEvent | null} */
  clipboardEvent: null,

  // Image selection
  /** @type {Set<string>} */
  selectedImages: new Set(),
  /** @type {string | null} */
  lastClickedImage: null,

  // Library filter (non-serialized; resets on project reload)
  /** @type {string | null} */
  libraryActiveFolder: null,

  // Drag state
  isDragging: false,
  dragStartX: 0,
  dragStartY: 0,
  dragStartEvtX: 0,
  dragStartEvtY: 0,
  /** @type {HTMLElement | null} */
  dragImg: null,
  /** @type {TimelineEvent | null} */
  dragEvt: null,
  dragEventIndex: -1,

  // Timeline drag
  /** @type {TimelineEvent | null} */
  timelineDragEvt: null,
  timelineDragIndex: -1,
  timelineDragStartX: 0,
  timelineDragStartFrame: 0,

  // Minimap
  minimapDragging: false,

  // Internal runtime flags (not serialized)
  _autosaveFailCount: 0,
  _arrowKeyUndoSaved: false,
  _arrowKeyUndoTimer: null,

  // Export cache (prefetched data)
  cachedMaps: null,
  cachedMapEvents: {} // { mapId: eventsArray }
};

/** @param {keyof typeof state} key */
function get(key) {
  return state[key];
}

/**
 * @template {keyof typeof state} K
 * @param {K} key
 * @param {(typeof state)[K]} value
 */
function set(key, value) {
  state[key] = value;
}

/** @param {Partial<typeof state>} updates */
function update(updates) {
  Object.assign(state, updates);
}

export {
  state,
  get,
  set,
  update,
  // App metadata
  APP_VERSION,
  // Constants
  TIMELINE_LANES,
  LANE_DATA,
  LANE_HEIGHT,
  MAX_UNDO_STACK,
  MAX_RECENT_PROJECTS,
  SETTINGS_KEY,
  AUTOSAVE_INTERVAL,
  GRID_SIZE,
  // RPG Maker MZ defaults
  FRAMES_PER_SECOND,
  DEFAULT_TIMELINE_LENGTH,
  DEFAULT_SCREEN_WIDTH,
  DEFAULT_SCREEN_HEIGHT,
  MAX_OPACITY,
  DEFAULT_SCALE,
  MAX_PICTURE_NUMBER,
  DEFAULT_DURATION
};
