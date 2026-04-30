import { jest } from '@jest/globals';

// The renderer logger calls window.api.log when forwarding entries to
// main. We stub a minimal Element class on globalThis so the
// Element-aware branch of safeStringify is exercised without pulling
// in jsdom for this small unit test.

let safeStringify;
let LOG_LEVELS;

class FakeElement {
  constructor({ id = '', className = '', tagName = 'DIV' } = {}) {
    this.id = id;
    this.className = className;
    this.tagName = tagName;
  }
}

beforeAll(async () => {
  // Stub Element + window so the module evaluates cleanly under Node.
  globalThis.Element = FakeElement;
  globalThis.window = { api: undefined, addEventListener: () => {} };

  const mod = await import('../src/modules/logger.js');
  safeStringify = mod.safeStringify;
  LOG_LEVELS = mod.LOG_LEVELS;
});

afterAll(() => {
  delete globalThis.Element;
  delete globalThis.window;
});

describe('renderer logger safeStringify', () => {
  it('returns "null" / "undefined" verbatim', () => {
    expect(safeStringify(null)).toBe('null');
    expect(safeStringify(undefined)).toBe('undefined');
  });

  it('passes strings and primitives through', () => {
    expect(safeStringify('')).toBe('');
    expect(safeStringify('hello')).toBe('hello');
    expect(safeStringify(7)).toBe('7');
    expect(safeStringify(true)).toBe('true');
  });

  it('renders Errors with name + message + stack', () => {
    const err = new RangeError('out of bounds');
    err.stack = 'RangeError: out of bounds\n  at synthetic:2:3';
    const out = safeStringify(err);
    expect(out).toContain('RangeError: out of bounds');
    expect(out).toContain('at synthetic:2:3');
  });

  it('renders DOM Elements as <tag#id.cls> shorthand', () => {
    const el = new FakeElement({ tagName: 'BUTTON', id: 'submit', className: 'btn primary' });
    expect(safeStringify(el)).toBe('<button#submit.btn.primary>');
  });

  it('renders DOM Elements with no id or class', () => {
    const el = new FakeElement({ tagName: 'SPAN' });
    expect(safeStringify(el)).toBe('<span>');
  });

  it('serialises plain objects via JSON.stringify', () => {
    expect(safeStringify({ x: 1 })).toBe('{"x":1}');
  });

  it('returns a placeholder for circular references', () => {
    const obj = { kind: 'cycle' };
    obj.me = obj;
    expect(safeStringify(obj)).toBe('[unserializable]');
  });
});

describe('renderer logger LOG_LEVELS', () => {
  it('exposes a strictly increasing scale', () => {
    expect(LOG_LEVELS.DEBUG).toBeLessThan(LOG_LEVELS.INFO);
    expect(LOG_LEVELS.INFO).toBeLessThan(LOG_LEVELS.WARN);
    expect(LOG_LEVELS.WARN).toBeLessThan(LOG_LEVELS.ERROR);
    expect(LOG_LEVELS.ERROR).toBeLessThan(LOG_LEVELS.NONE);
  });
});

// Ensure jest itself is referenced so `import { jest }` is not flagged
// unused by lint rules.
test('jest is wired', () => {
  expect(typeof jest.fn).toBe('function');
});
