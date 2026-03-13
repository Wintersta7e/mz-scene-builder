# Changelog

All notable changes to Timeline Scene Builder will be documented in this file.

## [1.3.1] - Unreleased

### Fixed

- Timeline drag reverting the wrong event on text overlap
- Autosave recovery losing events (were overwritten by project load)
- `||` coercing valid falsy values across all event types in export — opacity 0, scale 0, duration 0 now export correctly
- Property inputs zeroing mid-keystroke during editing
- Double render on Delete key
- `processedTextEvents` not cleared on scene change
- Export dropdown ordering in cache-hit path
- `DEFAULT_DURATION` inconsistency between image-browser and state.js

### Security

- Added Content-Security-Policy meta tag
- Fixed innerHTML injection vectors in confirm dialog, image browser, image picker, and properties panel
- Fixed `openExternal` hostname check allowing domain suffix collisions
- Added explicit `webSecurity: true` to Electron window preferences

### Performance

- Timeline playback no longer rebuilds the entire DOM at 60fps — uses lightweight cursor-only updates
- Minimap uses cursor-only updates during playback
- Eliminated O(n^2) indexOf in preview rendering
- Debounced window resize and image search handlers
- Removed `will-change: transform` from virtual dropdown items

### Improved

- Added try/catch to save-scene, load-scene, and directory scanning IPC handlers
- User notification on drag-drop load failure, folder structure errors, and repeated autosave failures
- Protected localStorage operations against QuotaExceededError
- Added focus trap, Escape-to-close, and focus restore to confirm dialogs
- Added aria-labels to toolbar buttons and minimap canvas
- Replaced unconditional `outline: none` with `focus-visible` pattern
- Changed semantic `<footer>` to `<section>` for timeline
- Added debounced undo state for arrow key image movement
- Added critical DOM element null-checks at init

### Removed

- 5 unused event bus constants (STATE_CHANGED, EVENT_SELECTED, FRAME_CHANGED, SCENE_SAVED, SCENE_LOADED)
- Orphan SCENE_LOADED event listener
- Duplicate `getPreviewScale()` function (consolidated to preview/index.js)
- Dead CSS rules (`.btn[title]`, duplicate selectors)
- Notification keyframes from JS (moved to styles.css)

## [1.3.0] - 2026-02-26

### Added

- Converted all 33 renderer modules from CommonJS to ES Modules
- Jest ESM support with `--experimental-vm-modules`
- New test suites: event-bus (20), undo-redo (15), events (27) — total 121 tests
- Global `unhandledrejection` and `error` handlers in renderer
- Image path cache for preview rendering
- DOM reuse in preview (keyed by pictureNumber/eventIndex)
- Stable grid element (not recreated every frame)

### Changed

- Enabled `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`
- Rewrote `preload.js` to use `contextBridge.exposeInMainWorld()`
- Resolved settings/project circular dependency via event bus mediator
- Replaced inline `onclick` handlers with programmatic listeners
- Parallel image fetching with `Promise.all()`

### Fixed

- Playback double-start guard prevents stacking intervals
- Folder expansion race condition guards (`dataset.loading`) in image browser/picker
- Try/catch wrapping on 15 async functions across 6 files with user-facing error notifications

## [1.2.1] - 2026-02-03

### Added

- **Quick Export** button - exports directly to last used map/event/page without modal
- **Clear** button - clears all events from timeline (with confirmation, supports undo)
- Playhead automatically jumps to newly inserted images

### Fixed

- Packaged build (portable exe) failed to start due to missing preload.js in build files
- New images inserted at beginning of timeline instead of after existing images
- Picture number unnecessarily incremented for sequential images (now reuses same slot)
- Text events exported before pictures at same frame (type priority now takes precedence)

## [1.2.0] - 2026-02-02

### Added

- **Ctrl+P** shortcut to insert picture at playhead
- **Ctrl+T** shortcut to insert text at playhead
- **Ctrl+Arrow Left/Right** to move playhead by 10 frames
- **Ctrl+Shift+Arrow Left/Right** to move playhead by 1 frame
- Resizable timeline panel (drag top edge)
- Smart insert: new events shift existing events in the same lane to the right

### Changed

- Image thumbnails now load when visible (IntersectionObserver) instead of on hover
- Hidden default Electron menu bar for cleaner UI
- Removed special text placement logic - text now inserts at playhead like other events

### Fixed

- Thumbnails appearing dark until hovered

## [1.1.0] - 2026-02-02

### Added

- Event bus architecture for decoupled module communication
- Centralized logging system with configurable log levels
- Toast notification system (replaces alert dialogs)
- IPC channel whitelisting for security
- Path traversal validation for file operations
- Virtual scrolling with DOM pooling for large dropdowns
- Ctrl+Y as alternative redo shortcut

### Changed

- About dialog now displays app icon
- Converted sync file I/O to async operations
- Improved memory management with event delegation pattern
- Minimap listeners properly cleaned up

### Fixed

- Memory leaks in property panel input bindings
- Memory leaks in minimap event handlers
- Dropdown items not selectable in export modal
- Timeline text advancement during playback

### Architecture

- Replaced 15+ callback chains with centralized event emitter
- Modules now emit events (RENDER, RENDER_TIMELINE, RENDER_PREVIEW, etc.)
- Event listeners set up once in init.js

## [1.0.0] - 2026-02-01

### Added

- Initial release
- Visual timeline editor with three lanes (Pictures, Effects, Text)
- Timeline minimap with click-to-navigate
- Lazy-loading image browser
- Live preview with drag-and-drop positioning
- Grid overlay and snap-to-grid
- Playback system with text pausing
- Event types: Show/Move/Rotate/Tint/Erase Picture, Show Text, Wait, Screen Flash
- Undo/Redo system (Ctrl+Z / Ctrl+Shift+Z)
- Recent projects dropdown
- Auto-save every 3 minutes
- Export to RPG Maker MZ map files
- Save/Load .mzscene files
- Drag & drop file loading
- Dark theme UI
- Keyboard shortcuts (F1 for help)
