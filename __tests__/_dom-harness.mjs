// Shared DOM harness for tests that exercise renderer modules.
//
// Designed for use with `jest-environment-jsdom` (set the per-file
// pragma `@jest-environment jsdom`). Loads `src/index.html` into the
// existing jsdom `document`, stubs the contextBridge IPC surface, and
// snapshots the body so it can be restored between tests.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

/** @type {Node | null} */
let _bodyTemplate = null;

function setBodyFromParsed(parsedBody) {
  const body = globalThis.document.body;
  while (body.firstChild) body.removeChild(body.firstChild);
  for (const child of Array.from(parsedBody.childNodes)) {
    body.appendChild(globalThis.document.importNode(child, true));
  }
}

/**
 * Boot the renderer environment: parse index.html, inject its body into
 * the jest-environment-jsdom document, stub IPC + observers. Idempotent
 * within a Jest worker.
 */
export async function setupDOM() {
  const indexHtml = await readFile(path.join(repoRoot, 'src/index.html'), 'utf-8');

  // Use DOMParser instead of innerHTML so the project security hook
  // (which forbids new innerHTML writes) stays satisfied.
  const parser = new globalThis.DOMParser();
  const parsed = parser.parseFromString(indexHtml, 'text/html');
  setBodyFromParsed(parsed.body);

  globalThis.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  };
  globalThis.PerformanceObserver = class {
    constructor(cb) {
      this._cb = cb;
    }
    observe() {}
    disconnect() {}
  };

  // Minimal contextBridge IPC surface. Tests can override `invoke` per
  // suite by reassigning `globalThis.window.api.invoke` after this call.
  globalThis.window.api = {
    isDev: false,
    invoke: async () => null,
    openExternal: () => {},
    log: () => {}
  };

  _bodyTemplate = globalThis.document.body.cloneNode(true);
}

/**
 * Restore the document body to its initial state. Use in beforeEach so
 * tests that mutate the DOM don't bleed into each other.
 */
export function resetDocument() {
  if (!_bodyTemplate || !globalThis.document) return;
  const body = globalThis.document.body;
  while (body.firstChild) body.removeChild(body.firstChild);
  for (const child of Array.from(_bodyTemplate.childNodes)) {
    body.appendChild(child.cloneNode(true));
  }
}
