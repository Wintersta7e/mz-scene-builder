// ============================================
// Timeline Scene Builder - Entry Point
// ============================================
// This is the slim bootstrap entry point that loads all modules.
// The actual functionality is split into modules/ for maintainability.
//
// Module structure:
//   modules/
//     state.js         - Central state store
//     logger.js        - Logging system
//     utils.js         - Color helpers, sorting
//     elements.js      - DOM cache
//     settings.js      - localStorage, recent projects
//     undo-redo.js     - Undo/redo stack management
//     autosave.js      - Autosave/recovery logic
//     project.js       - Project loading, folder structure
//     events.js        - Event creation, defaults, management
//     grid.js          - Grid overlay, snap-to-grid
//     keyboard.js      - Keyboard shortcuts
//     file-ops.js      - Scene save/load, drag-drop
//     export.js        - Export to Map modal
//     modals.js        - Help/About modals
//     playback.js      - Animation playback control
//     init.js          - DOM setup, event binding
//
//     properties/
//       index.js       - Property panel dispatcher
//       picture.js     - showPicture properties
//       move.js        - movePicture properties
//       tint.js        - tintPicture properties
//       text.js        - showText properties
//       other.js       - rotate, erase, wait, flash
//
//     timeline/
//       index.js       - Timeline dispatcher
//       drag.js        - Timeline event dragging
//       minimap.js     - Minimap rendering
//
//     preview/
//       index.js       - Preview rendering
//       drag.js        - Image dragging in preview
//       image-picker.js - Image picker modal
//       image-browser.js - Folder tree, image selection
// ============================================

const { logger } = require('./modules/logger');
const { init } = require('./modules/init');

// Log startup
logger.info('Timeline Scene Builder starting...');

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', init);
