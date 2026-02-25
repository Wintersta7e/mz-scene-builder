# Changelog

All notable changes to Timeline Scene Builder will be documented in this file.

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
