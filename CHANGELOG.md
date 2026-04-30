# Changelog

All notable changes to Timeline Scene Builder will be documented in this file.

## [2.0.0] - Unreleased

Major UI redesign — the "Director's Console" — plus a new diagnostics
surface and substantial performance work.

### UI redesign

- New application shell: top rail with project name, save indicator, and
  workspace mode switcher (Design / Preview / Inspect)
- Image library reworked: folder chips, richer thumbnails, search,
  multi-select, drag-and-drop dragstart payloads
- Stage preview rebuilt: percent-based positioning, snap-to-grid,
  vignette, REC indicator, slate / clapper readout, full-frame flash
  overlay
- Timeline now has 4 lanes (Pictures, Effects, Text, **Timing** — new);
  overlapping events stack into separate sub-rows automatically;
  minimap uses DOM pills instead of canvas; transport readout chips +
  inline event-add bar
- Inspector rebuilt around a 13-builder primitives library; per-type
  sections rewritten programmatically; empty state with cog icon
- Spacebar plays / pauses; modal restyle; bundled Inter, JetBrains
  Mono, and Instrument Serif fonts (self-hosted, font-src in CSP)

### Added

- **Persistent file logging.** Both processes write to a single rotating
  log file at platform-standard paths (`%APPDATA%/Timeline Scene
Builder/logs/main.log` on Windows). Renderer entries are forwarded
  via a `log-message` IPC channel so they interleave with main entries
  chronologically. `main.log.1` keeps the previous session.
- **DevTools accelerators in production.** F12 and Ctrl+Shift+I toggle
  DevTools (the suppressed Electron menu used to make these
  inaccessible). Hint added to the About modal.
- **Slow-op timing.** `logger.timed(label, fn)` wraps `renderTimeline`,
  `renderLibraryList`, `renderPreviewAtFrame`, `renderProperties`,
  mode switches, folder-chip clicks, and `openExportModal`. Anything
  exceeding the 16 ms one-frame budget logs a `[WARN] slow:` line.
- **Long Task observer.** A `PerformanceObserver('longtask')` logs any
  main-thread block ≥ 50 ms — catches lag from layout, paint, and GC
  that the JS wraps don't see. First 2 s skipped to ignore startup.
- Crash hooks in both processes route uncaught exceptions and
  unhandled rejections to the log file.
- Headless renderer profile harness at `scripts/profile.mjs`.
- jsdom-backed test harness (`__tests__/_dom-harness.mjs`) plus smoke
  tests for `renderTimeline` (5) and `renderProperties` (3).
- Greedy interval-scheduling sub-lane assignment (`assignSubLanes`)
  for overlap-aware timeline rendering.

### Changed

- Default production log level bumped from `WARN` to `INFO`.
- IPC handlers split out of `main.js` into `src/main/ipc/*.js`
  (project, picture, export, scene, autosave). `main.js` is now a
  150-line orchestrator. Behaviour preserved exactly.
- README hero screenshot replaced and centred; legacy per-feature
  screenshots removed; Features section reflects the new lane model
  and diagnostics surface.

### Fixed (post-redesign user-test fixes)

- Recent-projects dropdown re-anchored to its own trigger; previously
  surfaced under the wrong button and was clipped by `.rail`'s
  `overflow: hidden`
- Inspector now refreshes when a sprite or text element is selected
  from the stage (the cycle-through-stacked-pictures path included)
- Disabled-state styling added for `.transport-btn`, `.event-chip`,
  `.icon-btn` so disabled buttons no longer look identical to enabled
- About modal version reads from a single `APP_VERSION` constant
- Recent dropdown closes immediately on item-click and uses
  `composedPath()` for outside-click detection
- Recent dropdown no longer hover-activates — pure click-toggle
- `assignSubLanes` tie-break test restored 100% statement / line
  coverage on `utils.js`

### Performance

- Library list: full DOM rebuild on every `RENDER_TIMELINE` replaced
  with an incremental badge update (~70-140 ms → sub-ms in jsdom)
- `content-visibility: auto` on `.lib-item` so offscreen entries skip
  layout / paint
- Modal `backdrop-filter: blur(4px)` removed — was the export-modal
  open lag culprit on large projects
- Map-events cache persists across modal opens; cleared only on
  project change. Maps prefetch fires concurrently with folder /
  screen IO at project load
- Export modal shows immediately, then loads maps with placeholder

### Tests

- 121 → **200** total tests, 12 suites
- New: 8 `assignSubLanes` cases, 12 throttle / selection-recovery
  cases, 8 logger-stringify cases, 8 DOM-render smoke tests, plus
  the previously-listed coverage uplifts
- Coverage uplift: `properties/index.js` 0% → 96.66%,
  `timeline/index.js` 0% → 73.79%, `properties/shared.js` 0% →
  64.14%, `properties/picture.js` 0% → 60.86%

### Pre-redesign work consolidated under 2.0.0

The following changes were originally tracked as `1.3.1 Unreleased`
and never tagged separately — they ship as part of 2.0.0.

- Tightened ESLint (11 new rules, `no-unused-vars` escalated to error)
- Enabled `strict: true` in jsconfig.json
- Per-file Jest coverage thresholds on fully-tested modules
- CI runs Prettier format check and `npm audit --omit=dev`
- husky + lint-staged pre-commit hooks
- Added Content-Security-Policy meta tag (extended in 2.0.0 with
  `font-src 'self'`)
- Fixed innerHTML injection vectors in confirm dialog, image browser,
  image picker, and properties panel
- Fixed `openExternal` hostname check allowing domain suffix collisions
- Added explicit `webSecurity: true` to Electron window preferences
- Timeline playback uses cursor-only updates (no DOM rebuild at 60fps)
- Eliminated O(n²) indexOf in preview rendering
- Debounced window resize and image search handlers
- Try/catch on save-scene, load-scene, and directory scanning IPC
- localStorage protected against QuotaExceededError
- Confirm dialogs gain focus trap, Escape-to-close, focus restore
- ARIA labels on toolbar buttons and minimap
- 5 unused event-bus constants removed
- Duplicate `getPreviewScale()` consolidated

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
