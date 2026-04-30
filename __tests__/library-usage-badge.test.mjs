/**
 * @jest-environment jsdom
 */

// Regression suite for the "used ×N" badges in the library list.
//
// The badges are driven by usageCounts, which is recomputed and pushed
// onto existing .lib-item nodes by updateLibraryUsageBadges. The
// listener must fire on Events.RENDER (add / delete / duplicate /
// clear) AND Events.RENDER_TIMELINE (drag / resize stop). Originally
// it was only wired to RENDER_TIMELINE — deleting a Show Picture
// event left the badge stuck at the pre-delete count.

import { jest } from '@jest/globals';
import { setupDOM, resetDocument } from './_dom-harness.mjs';

let state;
let eventBus;
let utils;
let elements;
let imageBrowser;

function makeShowPicture(imageName, startFrame, _insertOrder) {
  return {
    type: 'showPicture',
    startFrame,
    pictureNumber: _insertOrder,
    imageName,
    x: 0,
    y: 0,
    scaleX: 100,
    scaleY: 100,
    opacity: 255,
    blend: 0,
    origin: 0,
    _insertOrder
  };
}

function folderTree() {
  return [
    {
      type: 'folder',
      name: 'cast',
      path: 'cast',
      children: [
        { type: 'file', name: 'hero', path: 'cast/hero' },
        { type: 'file', name: 'villain', path: 'cast/villain' }
      ]
    }
  ];
}

beforeAll(async () => {
  await setupDOM();
  state = await import('../src/modules/state.js');
  utils = await import('../src/modules/utils.js');
  elements = await import('../src/modules/elements.js');
  const eb = await import('../src/modules/event-bus.js');
  eventBus = eb;
  imageBrowser = await import('../src/modules/preview/image-browser.js');
  elements.initElements();
});

beforeEach(() => {
  jest.useFakeTimers();
  resetDocument();
  elements.initElements();
  state.state.events = [];
  state.state.selectedEventIndex = -1;
  state.state.libraryActiveFolder = null;
  // Re-seed the library tree on every test so the .lib-item nodes
  // exist before we ask updateLibraryUsageBadges to walk them.
  imageBrowser.renderFolderTree(elements.getElements().imageBrowser, folderTree());
});

afterEach(() => {
  jest.useRealTimers();
});

// Each emit schedules a trailing-throttled badge refresh (120 ms).
// Advance fake timers past the threshold so the refresh actually runs
// before we assert.
function flushBadgeRefresh() {
  jest.advanceTimersByTime(150);
}

function badgeFor(path) {
  const item = document.querySelector(`.lib-item[data-path="${path}"]`);
  if (!item) return null;
  return item.querySelector('.used');
}

describe('library usage badges', () => {
  it('shows "used ×1" after a Show Picture is added (RENDER emit)', () => {
    state.state.events = [makeShowPicture('cast/hero', 0, 1)];
    utils.sortEvents(state.state.events);

    eventBus.eventBus.emit(eventBus.Events.RENDER);
    flushBadgeRefresh();

    const badge = badgeFor('cast/hero');
    expect(badge).not.toBeNull();
    expect(badge.textContent).toBe('used \xd71');
  });

  it('clears the badge when the only Show Picture for that image is deleted', () => {
    state.state.events = [makeShowPicture('cast/hero', 0, 1)];
    utils.sortEvents(state.state.events);
    eventBus.eventBus.emit(eventBus.Events.RENDER);
    flushBadgeRefresh();
    expect(badgeFor('cast/hero')).not.toBeNull();

    state.state.events = [];
    eventBus.eventBus.emit(eventBus.Events.RENDER);
    flushBadgeRefresh();

    expect(badgeFor('cast/hero')).toBeNull();
  });

  it('decrements the count when one of several uses is deleted', () => {
    state.state.events = [
      makeShowPicture('cast/hero', 0, 1),
      makeShowPicture('cast/hero', 30, 2),
      makeShowPicture('cast/hero', 60, 3)
    ];
    utils.sortEvents(state.state.events);
    eventBus.eventBus.emit(eventBus.Events.RENDER);
    flushBadgeRefresh();

    let badge = badgeFor('cast/hero');
    expect(badge.textContent).toBe('used \xd73');

    state.state.events.splice(0, 1);
    eventBus.eventBus.emit(eventBus.Events.RENDER);
    flushBadgeRefresh();

    badge = badgeFor('cast/hero');
    expect(badge.textContent).toBe('used \xd72');
  });

  it('also refreshes on Events.RENDER_TIMELINE (drag-end path)', () => {
    state.state.events = [makeShowPicture('cast/villain', 0, 1)];
    utils.sortEvents(state.state.events);

    eventBus.eventBus.emit(eventBus.Events.RENDER_TIMELINE);
    flushBadgeRefresh();

    const badge = badgeFor('cast/villain');
    expect(badge).not.toBeNull();
    expect(badge.textContent).toBe('used \xd71');
  });
});
