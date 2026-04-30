// Headless JS profiling harness for the renderer.
//
// Loads index.html into jsdom, mocks the Electron `window.api` IPC bridge,
// generates a synthetic large project, and times each render path. Captures
// JavaScript execution cost only — layout/paint/composite are not measured
// because they are browser-specific and only show up in DevTools against a
// real Chromium window.
//
// Run with: node scripts/profile.mjs
//
// The output is a table of operation × ms, plus a short summary of the
// outliers. Use it to identify which functions dominate the main-thread
// budget on a large project.

import { readFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT:', err && err.stack ? err.stack : err);
  process.exit(1);
});
process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION:', err && err.stack ? err.stack : err);
  process.exit(1);
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const indexHtml = await readFile(path.join(repoRoot, 'src/index.html'), 'utf-8');

const dom = new JSDOM(indexHtml, {
  // http origin (not file://) so localStorage works — jsdom treats
  // file:// as opaque and refuses storage access otherwise.
  url: 'http://localhost/profile/index.html',
  pretendToBeVisual: true,
  resources: 'usable',
  runScripts: 'outside-only'
});
const { window } = dom;

// Glue jsdom's globals onto Node's global so the renderer modules can
// reach `document`, `window`, `requestAnimationFrame`, etc. without
// modification.
globalThis.window = window;
globalThis.document = window.document;
globalThis.HTMLElement = window.HTMLElement;
globalThis.Element = window.Element;
globalThis.Node = window.Node;
globalThis.Map = window.Map;
globalThis.Set = window.Set;
globalThis.requestAnimationFrame = window.requestAnimationFrame.bind(window);
globalThis.cancelAnimationFrame = window.cancelAnimationFrame.bind(window);
globalThis.localStorage = window.localStorage;
globalThis.IntersectionObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
};

// Mock the contextBridge IPC. None of these resolve during profiling — we
// only need them to be present so the modules import cleanly.
globalThis.window.api = {
  invoke: async () => null,
  openExternal: () => {}
};

// ---- Synthetic project generation -------------------------------------------

const NUM_IMAGES = 1500;
const NUM_FOLDERS = 12;
const NUM_EVENTS = 400;
const TIMELINE_LENGTH = 1800;

function randInt(lo, hi) {
  return Math.floor(Math.random() * (hi - lo + 1)) + lo;
}

function makeFolderStructure() {
  // Matches the shape consumed by flattenImageTree in image-browser.js:
  // [{ type: 'folder', name, path, children: [{ type: 'image', name, path }, ...] }, ...]
  const tree = [];
  const perFolder = Math.floor(NUM_IMAGES / NUM_FOLDERS);
  for (let f = 0; f < NUM_FOLDERS; f++) {
    const folderName = `folder_${f}`;
    const folderPath = folderName;
    const children = [];
    for (let i = 0; i < perFolder; i++) {
      const name = `img_${f}_${i}.png`;
      children.push({ type: 'file', name, path: `${folderPath}/${name}` });
    }
    tree.push({ type: 'folder', name: folderName, path: folderPath, children });
  }
  return tree;
}

function makeEvents(n) {
  const types = [
    'showPicture',
    'movePicture',
    'rotatePicture',
    'tintPicture',
    'erasePicture',
    'showText',
    'wait',
    'screenFlash'
  ];
  const events = [];
  for (let i = 0; i < n; i++) {
    const type = types[i % types.length];
    const startFrame = randInt(0, TIMELINE_LENGTH - 60);
    const ev = {
      type,
      startFrame,
      pictureNumber: (i % 30) + 1,
      _insertOrder: i
    };
    if (type === 'showPicture') {
      ev.imageName = `img_${randInt(0, NUM_FOLDERS - 1)}_${randInt(0, 50)}.png`;
      ev.x = randInt(0, 800);
      ev.y = randInt(0, 600);
      ev.scaleX = 100;
      ev.scaleY = 100;
      ev.opacity = 255;
      ev.blend = 0;
      ev.origin = 0;
    } else if (type === 'movePicture') {
      ev.x = randInt(0, 800);
      ev.y = randInt(0, 600);
      ev.scaleX = 100;
      ev.scaleY = 100;
      ev.opacity = 255;
      ev.duration = randInt(30, 120);
      ev.easingType = 0;
    } else if (type === 'rotatePicture') {
      ev.speed = 5;
    } else if (type === 'tintPicture') {
      ev.color = [0, 0, 0, 0];
      ev.duration = randInt(30, 120);
    } else if (type === 'showText') {
      ev.text = `line ${i}`;
      ev.background = 0;
      ev.positionType = 2;
    } else if (type === 'wait') {
      ev.frames = randInt(30, 120);
    } else if (type === 'screenFlash') {
      ev.red = 255;
      ev.green = 255;
      ev.blue = 255;
      ev.intensity = 200;
      ev.duration = randInt(30, 60);
    }
    events.push(ev);
  }
  return events;
}

// ---- Wire up the renderer ---------------------------------------------------

const stateMod = await import('../src/modules/state.js');
const utilsMod = await import('../src/modules/utils.js');
const elementsMod = await import('../src/modules/elements.js');
const eventsMod = await import('../src/modules/events.js');
const timelineMod = await import('../src/modules/timeline/index.js');
const imageBrowserMod = await import('../src/modules/preview/image-browser.js');
const previewMod = await import('../src/modules/preview/index.js');

elementsMod.initElements();
// imageFlat lives inside the module; we observe it through the rendered DOM.

// Seed state with a synthetic project.
stateMod.state.events = makeEvents(NUM_EVENTS);
utilsMod.sortEvents(stateMod.state.events);
stateMod.state.folderStructure = makeFolderStructure();
stateMod.state.timelineLength = TIMELINE_LENGTH;
stateMod.state.timelineScale = 5;
stateMod.state.screenWidth = 816;
stateMod.state.screenHeight = 624;
stateMod.state.projectPath = '/synthetic/project';
stateMod.state.libraryActiveFolder = null; // "All" filter — show every image

// Bootstrap the library state by emitting IMAGES_LOADED isn't possible
// here since the eventBus subscribers run during module import — instead
// call renderFolderTree directly.
const els = elementsMod.getElements();
imageBrowserMod.renderFolderTree(els.imageBrowser, stateMod.state.folderStructure);

const libDomCount = els.imageBrowser.querySelectorAll('.lib-item').length;
console.log(`[setup] library populated with ${libDomCount} .lib-item nodes`);

// ---- Timing helpers ---------------------------------------------------------

function bench(label, fn, iterations = 5) {
  // Warm-up run to settle JIT / caches.
  fn();
  const samples = [];
  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now();
    fn();
    samples.push(performance.now() - t0);
  }
  samples.sort((a, b) => a - b);
  const median = samples[Math.floor(samples.length / 2)];
  const min = samples[0];
  const max = samples[samples.length - 1];
  return { label, median, min, max, samples };
}

// ---- Run the suite ----------------------------------------------------------

const results = [];

// Pure helpers — no DOM cost.
results.push(bench('sortEvents (400 events)', () => utilsMod.sortEvents([...stateMod.state.events]), 20));

results.push(
  bench(
    'assignSubLanes (400 events)',
    () =>
      utilsMod.assignSubLanes(stateMod.state.events, (ev) => {
        const start = ev.startFrame || 0;
        const dur = Math.max(1, eventsMod.getEventDuration(ev.type, ev));
        return [start, start + dur];
      }),
    20
  )
);

// Timeline render — full DOM rebuild.
results.push(bench('renderTimeline (full rebuild, 400 events)', () => timelineMod.renderTimeline(), 10));

// Library render — full rebuild then incremental update path.
const visibleAfterFirst = els.imageBrowser.querySelectorAll('.lib-item').length;
results.push(
  bench(
    `renderLibraryList (full rebuild, ${visibleAfterFirst} visible items)`,
    () => imageBrowserMod.renderFolderTree(els.imageBrowser, stateMod.state.folderStructure),
    5
  )
);

// Synthesize a RENDER_TIMELINE emit so the throttled badge refresh
// fires once and we can time it.
const eventBusMod = await import('../src/modules/event-bus.js');
results.push(
  bench(
    'updateLibraryUsageBadges (incremental, RENDER_TIMELINE path)',
    () => eventBusMod.eventBus.emit(eventBusMod.Events.RENDER_TIMELINE),
    20
  )
);

// Preview frame render — DOM reuse path.
results.push(bench('renderPreviewAtFrame (frame 100)', () => previewMod.renderPreviewAtFrame(100), 10));

// ---- Output -----------------------------------------------------------------

console.log('\n=== Renderer profile (jsdom, JS-only) ===\n');
console.log(`Project: ${NUM_IMAGES} images / ${NUM_EVENTS} events / ${TIMELINE_LENGTH}f timeline\n`);
const colW = 50;
console.log(`${'label'.padEnd(colW)} median(ms)  min(ms)   max(ms)`);
console.log('-'.repeat(colW + 32));
for (const r of results) {
  console.log(
    `${r.label.padEnd(colW)}${r.median.toFixed(2).padStart(10)}${r.min
      .toFixed(2)
      .padStart(10)}${r.max.toFixed(2).padStart(10)}`
  );
}
console.log('\nNote: jsdom DOM operations are ~3-10x slower than real Chromium,');
console.log('so absolute numbers are upper bounds. Relative ranking is reliable.\n');
