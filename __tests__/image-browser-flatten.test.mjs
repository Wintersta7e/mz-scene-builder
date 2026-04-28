// __tests__/image-browser-flatten.test.mjs

import { jest } from '@jest/globals';

// Mock window.api so the lazy-folder branch's api.invoke() call does not crash.
globalThis.window = /** @type {any} */ ({
  api: {
    invoke: jest.fn(() => Promise.resolve(null))
  }
});

// Mock all image-browser.js dependencies.
jest.unstable_mockModule('../src/modules/state.js', () => ({
  state: {
    events: [],
    selectedEventIndex: -1,
    projectPath: null,
    currentFrame: 0
  }
}));

jest.unstable_mockModule('../src/modules/elements.js', () => ({
  getElements: jest.fn(() => ({
    libraryFolders: { innerHTML: '', querySelectorAll: jest.fn(() => []) },
    libraryCount: { textContent: '' },
    imageBrowser: { innerHTML: '', querySelectorAll: jest.fn(() => []) },
    imageSearch: { value: '' }
  })),
  initElements: jest.fn()
}));

jest.unstable_mockModule('../src/modules/undo-redo.js', () => ({
  saveState: jest.fn(),
  markDirty: jest.fn()
}));

jest.unstable_mockModule('../src/modules/utils.js', () => ({
  sortEvents: jest.fn(),
  getNextInsertOrder: jest.fn(() => 0),
  resetInsertOrderCounter: jest.fn(),
  makeTrailingThrottle: jest.fn((_ms, fn) => {
    const t = (...args) => fn(...args);
    t.cancel = jest.fn();
    return t;
  })
}));

jest.unstable_mockModule('../src/modules/events.js', () => ({
  createDefaultEvent: jest.fn(),
  clearImageSelection: jest.fn(),
  getEventDuration: jest.fn(() => 60)
}));

jest.unstable_mockModule('../src/modules/logger.js', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

jest.unstable_mockModule('../src/modules/event-bus.js', () => ({
  eventBus: { on: jest.fn(), emit: jest.fn(), off: jest.fn() },
  Events: {
    PROJECT_LOADED: 'project:loaded',
    IMAGES_LOADED: 'images:loaded',
    RENDER: 'render'
  }
}));

const { flattenImageTree } = await import('../src/modules/preview/image-browser.js');

describe('flattenImageTree', () => {
  it('flattens a fully-loaded shallow tree', () => {
    const tree = [
      {
        type: 'folder',
        name: 'characters',
        path: '/p/img/characters',
        children: [
          { type: 'file', name: 'hero.png', path: '/p/img/characters/hero.png' },
          { type: 'file', name: 'enemy.png', path: '/p/img/characters/enemy.png' }
        ]
      },
      {
        type: 'folder',
        name: 'system',
        path: '/p/img/system',
        children: [{ type: 'file', name: 'gui.png', path: '/p/img/system/gui.png' }]
      }
    ];
    const flat = flattenImageTree(tree);
    expect(flat).toHaveLength(3);
    expect(flat.map((it) => it.name)).toEqual(['hero.png', 'enemy.png', 'gui.png']);
    expect(flat.every((it) => it.folder === 'characters' || it.folder === 'system')).toBe(true);
  });

  it('flattens nested folders preserving the top-level folder name', () => {
    const tree = [
      {
        type: 'folder',
        name: 'characters',
        path: '/p/img/characters',
        children: [
          {
            type: 'folder',
            name: 'heroes',
            path: '/p/img/characters/heroes',
            children: [{ type: 'file', name: 'knight.png', path: '/p/img/characters/heroes/knight.png' }]
          }
        ]
      }
    ];
    const flat = flattenImageTree(tree);
    expect(flat).toHaveLength(1);
    expect(flat[0].folder).toBe('characters'); // top-level, not 'heroes'
  });

  it('skips lazy folders (children=null) in the flat list', () => {
    const tree = [
      {
        type: 'folder',
        name: 'characters',
        path: '/p/img/characters',
        children: null // lazy
      }
    ];
    const flat = flattenImageTree(tree);
    expect(flat).toHaveLength(0); // nothing in the flat list yet
  });

  it('handles files at the root with empty topFolder', () => {
    const tree = [{ type: 'file', name: 'splash.png', path: '/p/img/splash.png' }];
    const flat = flattenImageTree(tree);
    expect(flat).toHaveLength(1);
    expect(flat[0].folder).toBe(''); // root → no top folder
  });
});
