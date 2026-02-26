// ============================================
// Central State Store
// ============================================

// Timeline constants
const TIMELINE_LANES = ['Pictures', 'Effects', 'Text'];
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
  projectPath: null,
  folderStructure: null,

  // Events
  events: [],
  selectedEventIndex: -1,

  // Timeline
  currentFrame: 0,
  timelineScale: 5, // pixels per frame
  timelineLength: 300, // frames (5 seconds at 60fps)

  // Playback
  isPlaying: false,
  playbackInterval: null,
  waitingForTextClick: false,
  processedTextEvents: new Set(),

  // Undo/Redo
  undoStack: [],
  redoStack: [],

  // Dirty state
  isDirty: false,
  currentScenePath: null,

  // Autosave
  autosaveInterval: null,

  // Grid
  gridVisible: false,
  snapToGrid: false,

  // Screen resolution
  screenWidth: 816,
  screenHeight: 624,

  // Clipboard
  clipboardEvent: null,

  // Image picker
  imagePickerCallback: null,

  // Image selection
  selectedImages: new Set(),
  lastClickedImage: null,

  // Drag state
  isDragging: false,
  dragStartX: 0,
  dragStartY: 0,
  dragStartEvtX: 0,
  dragStartEvtY: 0,
  dragImg: null,
  dragEvt: null,
  dragEventIndex: -1,

  // Timeline drag
  timelineDragEvt: null,
  timelineDragIndex: -1,
  timelineDragStartX: 0,
  timelineDragStartFrame: 0,

  // Minimap
  minimapDragging: false,

  // Export cache (prefetched data)
  cachedMaps: null,
  cachedMapEvents: {} // { mapId: eventsArray }
};

function get(key) {
  return state[key];
}

function set(key, value) {
  state[key] = value;
}

function update(updates) {
  Object.assign(state, updates);
}

function getState() {
  return state;
}

export {
  state,
  get,
  set,
  update,
  getState,
  // Constants
  TIMELINE_LANES,
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
