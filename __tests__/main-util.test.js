// __tests__/main-util.test.js
//
// CJS tests for `src/main/util.js`. Mocks the shared main-state module
// so `requireProject()` can be exercised in both branches.

const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');

let currentProjectPath = null;
jest.mock('../src/main/state.js', () => ({
  getProjectPath: () => currentProjectPath,
  setProjectPath: jest.fn((p) => {
    currentProjectPath = p;
  }),
  getMainWindow: jest.fn(() => null),
  setMainWindow: jest.fn()
}));

const { pathExists, requireProject, mapFilePath } = require('../src/main/util');

describe('requireProject', () => {
  beforeEach(() => {
    currentProjectPath = null;
  });

  it('returns `{ error }` with null projectPath when no project is loaded', () => {
    const result = requireProject();
    expect(result.error).toBe('No project loaded');
    expect(result.projectPath).toBeNull();
  });

  it('returns `{ projectPath }` with null error when a project is loaded', () => {
    currentProjectPath = '/some/project';
    const result = requireProject();
    expect(result.projectPath).toBe('/some/project');
    expect(result.error).toBeNull();
  });
});

describe('mapFilePath', () => {
  it('zero-pads single-digit map IDs to three digits', () => {
    const result = mapFilePath('/proj', 1);
    expect(result.endsWith(path.join('data', 'Map001.json'))).toBe(true);
  });

  it('zero-pads double-digit map IDs', () => {
    const result = mapFilePath('/proj', 42);
    expect(result.endsWith(path.join('data', 'Map042.json'))).toBe(true);
  });

  it('leaves triple-digit map IDs unpadded', () => {
    const result = mapFilePath('/proj', 999);
    expect(result.endsWith(path.join('data', 'Map999.json'))).toBe(true);
  });

  it('does not truncate IDs wider than three digits', () => {
    const result = mapFilePath('/proj', 1000);
    expect(result.endsWith(path.join('data', 'Map1000.json'))).toBe(true);
  });

  it('joins the project path correctly', () => {
    expect(mapFilePath('/a/b', 5)).toBe(path.join('/a/b', 'data', 'Map005.json'));
  });
});

describe('pathExists', () => {
  let tmpDir;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mz-util-'));
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns true for an existing file', async () => {
    const file = path.join(tmpDir, 'present.txt');
    fs.writeFileSync(file, 'hello');
    expect(await pathExists(file)).toBe(true);
  });

  it('returns true for an existing directory', async () => {
    expect(await pathExists(tmpDir)).toBe(true);
  });

  it('returns false for a missing path', async () => {
    expect(await pathExists(path.join(tmpDir, 'does-not-exist'))).toBe(false);
  });
});
