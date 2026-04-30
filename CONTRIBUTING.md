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
│   ├── state.js               # Central state store + APP_VERSION
│   ├── event-bus.js           # Pub/sub module communication
│   ├── init.js                # Bootstrap and event binding
│   ├── events.js              # Event creation / lane assignment / duration
│   ├── export.js              # RPG Maker JSON export coordinator
│   ├── file-ops.js            # Save / load .mzscene files
│   ├── playback.js            # Timeline playback
│   ├── undo-redo.js           # History stack
│   ├── keyboard.js            # Keyboard shortcuts
│   ├── elements.js            # Cached DOM lookup ($)
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
├── index.html
├── styles.css
└── renderer.js                # ESM entry point
```

**Module system:** Renderer uses ES Modules (`src/modules/`); main process uses CommonJS (`main.js`, `preload.js`, `src/main/`, `src/lib/`).

## Quality Checks

All checks must pass before submitting a PR:

```bash
npm run lint          # ESLint (strict rules)
npm run format:check  # Prettier formatting
npm test              # Jest unit + DOM smoke tests (200 tests, 12 suites)
```

CI runs these automatically on every pull request, along with `npm audit` for dependency vulnerabilities.

Pre-commit hooks (husky + lint-staged) run ESLint and Prettier on staged files automatically, so most issues are caught before you commit.

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
- Event bus for module communication (no direct cross-module calls)
- All state in `state.js` (no module-local state)
- `contextIsolation: true` — renderer uses `window.api.invoke()` for IPC, no Node access
- `.js` extension required on all relative ESM imports

## Adding a New Event Type

1. Add type constant and default properties in `src/modules/events.js`
2. Add lane assignment in `getEventLane()`
3. Add duration logic in `getEventDuration()`
4. Add property panel in `src/modules/properties/`
5. Add timeline color in `src/modules/timeline/index.js`
6. Add preview rendering in `src/modules/preview/index.js`
7. Add MZ format conversion in `src/lib/mz-converter.js`
8. Add tests for the new event type

## Reporting Issues

Use the [issue templates](https://github.com/Wintersta7e/mz-scene-builder/issues/new/choose) for bug reports and feature requests.
