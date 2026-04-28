// ============================================
// Timeline Minimap (DOM-based)
// ============================================
// Pill-style mini overview of the timeline. Each event renders as a
// 5px-tall .minimap-event div positioned by (start/length)% width and
// (laneIndex * 7 + 4)px from the top. Click anywhere on the track to
// jump the playhead.
//
// Plan D switched this from canvas-based rendering to DOM pills — the
// canvas approach didn't share the design's lane-color CSS tokens.

import { state } from '../state.js';
import { eventBus, Events } from '../event-bus.js';
import { getEventLane, getEventDuration } from '../events.js';

let _resizeHandler = null;
let _cachedContainerWidth = 0;
let _minimapInitialized = false;

const LANE_DATA = ['picture', 'effect', 'text', 'aux'];

function getTrack() {
  return document.getElementById('minimap-track');
}

function updateCachedContainerWidth() {
  const track = getTrack();
  if (track) _cachedContainerWidth = track.getBoundingClientRect().width;
}

function renderMinimap() {
  const track = getTrack();
  if (!track) return;

  const length = Math.max(1, state.timelineLength);

  while (track.firstChild) track.removeChild(track.firstChild);

  for (const ev of state.events) {
    const start = ev.startFrame || 0;
    const dur = Math.max(1, getEventDuration(ev.type, ev));
    const laneIdx = getEventLane(ev.type);

    const pill = document.createElement('div');
    pill.className = 'minimap-event';
    pill.dataset.lane = LANE_DATA[laneIdx] || 'pic';
    pill.style.left = `${(start / length) * 100}%`;
    pill.style.width = `${Math.max(0.5, (dur / length) * 100)}%`;
    pill.style.top = `${laneIdx * 7 + 4}px`;
    track.appendChild(pill);
  }
}

function updateMinimapCursor() {
  const cursor = document.getElementById('minimap-cursor');
  if (!cursor) return;
  const length = Math.max(1, state.timelineLength);
  cursor.style.left = `${(state.currentFrame / length) * 100}%`;
}

function updateMinimapViewport() {
  // Placeholder: in the legacy canvas-based renderer, this drew a viewport
  // rectangle showing the visible portion of the main timeline track. The
  // new design uses a click-to-jump model and doesn't show a viewport
  // overlay. Kept as a no-op so external callers (renderTimeline) don't
  // need updating; Plan F can decide whether to bring it back.
  const viewport = document.getElementById('minimap-viewport');
  if (!viewport) return;
  viewport.style.display = 'none';
}

/**
 * @param {MouseEvent} e
 */
function handleMinimapClick(e) {
  const track = getTrack();
  if (!track) return;
  const rect = track.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const length = Math.max(1, state.timelineLength);
  const frame = Math.max(0, Math.min(length, Math.round((x / rect.width) * length)));
  state.currentFrame = frame;
  updateMinimapCursor();
  eventBus.emit(Events.RENDER_PREVIEW, frame);
  eventBus.emit(Events.RENDER_TIMELINE);
}

function initMinimapEvents() {
  if (_minimapInitialized) return;
  _minimapInitialized = true;
  const track = getTrack();
  if (!track) return;
  track.addEventListener('click', handleMinimapClick);
  _resizeHandler = updateCachedContainerWidth;
  window.addEventListener('resize', _resizeHandler);
  updateCachedContainerWidth();
}

function teardownMinimapEvents() {
  if (!_minimapInitialized) return;
  _minimapInitialized = false;
  const track = getTrack();
  if (track) track.removeEventListener('click', handleMinimapClick);
  if (_resizeHandler) {
    window.removeEventListener('resize', _resizeHandler);
    _resizeHandler = null;
  }
}

export {
  renderMinimap,
  updateMinimapCursor,
  updateMinimapViewport,
  handleMinimapClick,
  initMinimapEvents,
  teardownMinimapEvents,
  updateCachedContainerWidth
};
