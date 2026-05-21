# Contributing to Timeline Scene Builder

Thanks for your interest in contributing! This guide will help you get started.

## Development Setup

```bash
# Clone the repository
git clone https://github.com/Wintersta7e/mz-scene-builder.git
cd mz-scene-builder

# Install dependencies (use --no-bin-links on WSL)
npm install --no-bin-links

# Run the application
npm start

# Run with DevTools open
npm run dev
```

> **Node version:** `lint-staged@17` requires Node ≥ 22.22.1. CI runs Node 22 (latest patch); locally, a `EBADENGINE` warning is non-fatal and pre-commit still works.

## Project Structure

```
src/
├── lib/                       # Shared CJS — used by both processes
│   ├── mz-converter.js        # MZ format conversion + path security
│   └── main-logger.js         # Main-process logger (file + console)
├── main/                      # Main-process modules
│   ├── state.js               # Shared mutable state (projectPath, mainWindow)
│   ├── util.js                # Small main-side helpers (pathExists)
│   └── ipc/
│       ├── project.js         # open-project, set-project-path, get-screen-resolution
│       ├── picture.js         # get-pictures-folders, get-folder-contents, get-thumbnail, get-image-path
│       ├── export.js          # get-maps, get-map-events, export-to-map
│       ├── scene.js           # save-scene, load-scene
│       └── autosave.js        # autosave-write/read/delete/exists
├── modules/                   # Renderer (ES Modules)
│   ├── state.js               # Central state store + APP_VERSION (typed slots)
│   ├── event-bus.js           # Pub/sub module communication
│   ├── init.js                # Bootstrap and event binding
│   ├── events.js              # Event creation / lane assignment / duration
│   ├── export.js              # RPG Maker JSON export coordinator
│   ├── file-ops.js            # Save / load .mzscene files
│   ├── playback.js            # Timeline playback
│   ├── undo-redo.js           # History stack + confirm-dialog modal
│   ├── keyboard.js            # Keyboard shortcuts
│   ├── elements.js            # Cached DOM lookup ($) — per-slot typed via JSDoc
│   ├── grid.js                # Grid + snap toggles
│   ├── modals.js              # About / Shortcuts modals
│   ├── notifications.js       # Toast notifications
│   ├── settings.js            # localStorage settings + recent projects
│   ├── autosave.js            # Renderer-side autosave loop
│   ├── logger.js              # Renderer logger (forwards to main file)
│   ├── components/
│   │   └── virtual-dropdown.js
│   ├── timeline/              # Timeline rendering, minimap, drag, resize
│   ├── preview/               # Stage rendering, image browser, image picker, drag
│   └── properties/            # Inspector dispatcher + per-type panels + shared primitives
├── types/                     # Ambient type declarations
│   └── global.d.ts            # `window.api` + `TimelineEvent` interfaces
├── index.html
├── styles.css
└── renderer.js                # ESM entry point
```

**Module system:** Renderer uses ES Modules (`src/modules/`); main process uses CommonJS (`main.js`, `preload.js`, `src/main/`, `src/lib/`).

**Types:** Code is vanilla JS with strict `tsc -p jsconfig.json --noEmit` enforced in CI. Ambient `window.api` and `TimelineEvent` types live in `src/types/global.d.ts` — no `import` needed in source files. Per-function JSDoc `@param` / `@type` annotations are expected on every public entry point.

## Quality Checks

All checks must pass before submitting a PR:

```bash
npm run lint          # ESLint (strict rules)
npm run format:check  # Prettier formatting
npm run typecheck     # tsc --noEmit, strict + checkJs
npm test              # Jest unit + DOM smoke tests (265 tests, 16 suites)
```

CI runs these automatically on every pull request, along with `npm audit` for dependency vulnerabilities.

Pre-commit hooks (husky + lint-staged) run ESLint and Prettier on staged files automatically, so most issues are caught before you commit. Type errors are caught by `npm run typecheck` locally and by the `Typecheck` step in CI.

## Submitting Changes

1. Fork the repository
2. Create a feature branch from `main` (`git checkout -b feature/my-feature`)
3. Make your changes
4. Ensure all quality checks pass
5. Submit a pull request against `main`

### Commit Messages

Use concise, descriptive commit messages:

- `feat: add easing curve preview to move events`
- `fix: timeline not scrolling to playhead position`
- `perf: cache image thumbnails in browser panel`
- `refactor: extract sort logic into utils`
- `test: add export pipeline edge cases`
- `docs: update event types table`

### Code Style

- Vanilla JavaScript (no frameworks) with ES Modules in renderer
- **JSDoc types on every public function** — `@param`, `@returns`, and `@type` for non-trivial locals. `tsc --noEmit` runs in strict mode (`strict + checkJs + useUnknownInCatchVariables: false`) and gates CI.
- **Use ambient types** — `TimelineEvent`, `Window['api']` are global; no `import` needed
- **`catch (e)`** — when accessing `e.message`, narrow with `e instanceof Error ? e.message : String(e)`
- Event bus for module communication (no direct cross-module calls)
- All state in `state.js` (no module-local state) — declare new slots with a JSDoc type annotation
- `contextIsolation: true` — renderer uses `window.api.invoke()` for IPC, no Node access
- `.js` extension required on all relative ESM imports
- **No `innerHTML`** — the pre-commit security hook blocks new `innerHTML =` writes. Use `createElement` + `textContent`, or the `clearChildren(el)` helper from `utils.js`.

## Adding a New Event Type

1. Add type constant and default properties in `src/modules/events.js`
2. Add lane assignment in `getEventLane()`
3. Add duration logic in `getEventDuration()`
4. Add property panel in `src/modules/properties/` with a `/** @param {TimelineEvent} ev */` JSDoc on the renderer
5. Add timeline color in `src/modules/timeline/index.js`
6. Add preview rendering in `src/modules/preview/index.js`
7. Add MZ format conversion in `src/lib/mz-converter.js`
8. If the event type uses new fields, add them as optional properties on `TimelineEvent` in `src/types/global.d.ts`
9. Add tests for the new event type
10. Run `npm run typecheck` and `npm test` before opening a PR

## Reporting Issues

Use the [issue templates](https://github.com/Wintersta7e/mz-scene-builder/issues/new/choose) for bug reports and feature requests.
