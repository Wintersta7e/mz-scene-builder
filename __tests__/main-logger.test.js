// Coverage for the pure helpers in src/lib/main-logger.js. The file
// also wires up a file-system writer, but that side effect is exercised
// indirectly via integration runs — these tests stay focused on the
// behaviour we can isolate without touching disk.

const { safeStringify, LOG_LEVELS } = require('../src/lib/main-logger');

describe('main-logger safeStringify', () => {
  it('returns "null" / "undefined" verbatim', () => {
    expect(safeStringify(null)).toBe('null');
    expect(safeStringify(undefined)).toBe('undefined');
  });

  it('passes strings through unchanged', () => {
    expect(safeStringify('')).toBe('');
    expect(safeStringify('hello')).toBe('hello');
    // Avoids JSON.stringify wrapping the string in quotes.
    expect(safeStringify('with "quotes"')).toBe('with "quotes"');
  });

  it('stringifies primitives', () => {
    expect(safeStringify(0)).toBe('0');
    expect(safeStringify(42)).toBe('42');
    expect(safeStringify(true)).toBe('true');
    expect(safeStringify(false)).toBe('false');
  });

  it('renders Errors with name, message, and stack', () => {
    const err = new TypeError('boom');
    err.stack = 'TypeError: boom\n  at synthetic:1:1';
    const out = safeStringify(err);
    expect(out).toContain('TypeError: boom');
    expect(out).toContain('at synthetic:1:1');
  });

  it('serialises plain objects via JSON.stringify', () => {
    expect(safeStringify({ a: 1, b: 'two' })).toBe('{"a":1,"b":"two"}');
    expect(safeStringify([1, 2, 3])).toBe('[1,2,3]');
  });

  it('returns a placeholder for unserialisable values (circular refs)', () => {
    const obj = { name: 'cycle' };
    obj.self = obj;
    expect(safeStringify(obj)).toBe('[unserializable]');
  });

  it('returns a placeholder for unserialisable values (BigInt)', () => {
    // BigInt throws TypeError inside JSON.stringify — exercises the
    // catch path without needing a circular reference.
    expect(safeStringify(BigInt(10))).toBe('[unserializable]');
  });
});

describe('main-logger LOG_LEVELS', () => {
  it('exposes a strictly increasing scale', () => {
    expect(LOG_LEVELS.DEBUG).toBeLessThan(LOG_LEVELS.INFO);
    expect(LOG_LEVELS.INFO).toBeLessThan(LOG_LEVELS.WARN);
    expect(LOG_LEVELS.WARN).toBeLessThan(LOG_LEVELS.ERROR);
    expect(LOG_LEVELS.ERROR).toBeLessThan(LOG_LEVELS.NONE);
  });
});
