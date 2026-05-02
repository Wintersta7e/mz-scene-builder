// ============================================
// Timeline Minimap (DOM-based)
// ============================================
// Pill-style mini overview of the timeline. Each event renders as a
// 5px-tall .minimap-event div positioned by (start/length)% width and
// (laneIndex * 7 + 4)px from the top. Click anywhere on the track to
// jump the playhead.

import { state, LANE_DATA } from '../state.js';
import { eventBus, Events } from '../event-bus.js';
import { getEventLane, getEventDuration } from '../events.js';
import { clamp, clearChildren } from '../utils.js';

let _minimapInitialized = false;

function getTrack() {
  return document.getElementById('minimap-track');
}

function renderMinimap() {
  const track = getTrack();
  if (!track) return;

  const length = Math.max(1, state.timelineLength);

  clearChildren(track);

  for (const ev of state.events) {
    const start = ev.startFrame || 0;
    const dur = Math.max(1, getEventDuration(ev.type, ev));
    const laneIdx = getEventLane(ev.type);

    const pill = document.createElement('div');
    pill.className = 'minimap-event';
    pill.dataset.lane = LANE_DATA[laneIdx];
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

/**
 * @param {MouseEvent} e
 */
function handleMinimapClick(e) {
  const track = getTrack();
  if (!track) return;
  const rect = track.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const length = Math.max(1, state.timelineLength);
  const frame = clamp(Math.round((x / rect.width) * length), 0, length);
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
}

function teardownMinimapEvents() {
  if (!_minimapInitialized) return;
  _minimapInitialized = false;
  const track = getTrack();
  if (track) track.removeEventListener('click', handleMinimapClick);
}

export { renderMinimap, updateMinimapCursor, handleMinimapClick, initMinimapEvents, teardownMinimapEvents };
