// ============================================
// Timeline Dispatcher
// ============================================

import { state } from '../state.js';
import { getElements } from '../elements.js';
import { getEventLane, getEventDuration, selectEvent } from '../events.js';
import { eventBus, Events } from '../event-bus.js';
import { renderMinimap, updateMinimapCursor } from './minimap.js';
import { startTimelineDrag, startTimelineResize } from './drag.js';
import { renderProperties } from '../properties/index.js';

const PX_PER_FRAME_DEFAULT = 5; // Matches state.timelineScale's existing default

/**
 * Lane metadata. Indices match TIMELINE_LANES from state.js.
 */
const LANE_META = [
  { name: 'Pictures', code: 'PIC', data: 'picture' },
  { name: 'Effects', code: 'FX', data: 'effect' },
  { name: 'Text', code: 'TXT', data: 'text' },
  { name: 'Timing', code: 'AUX', data: 'aux' }
];

const POINT_EVENT_TYPES = new Set(['rotatePicture', 'erasePicture']);

// ============================================
// Pure label helper
// ============================================

function getTimelineEventLabel(evt) {
  switch (evt.type) {
    case 'showPicture':
      return `#${evt.pictureNumber}`;
    case 'movePicture':
      return `→#${evt.pictureNumber}`;
    case 'rotatePicture':
      return `↻#${evt.pictureNumber}`;
    case 'tintPicture':
      return `🎨#${evt.pictureNumber}`;
    case 'erasePicture':
      return `✕#${evt.pictureNumber}`;
    case 'showText':
      return evt.text ? evt.text.substring(0, 8) : 'Text';
    case 'wait':
      return `⏸${evt.frames}f`;
    case 'screenFlash':
      return '⚡Flash';
    default:
      return evt.type;
  }
}

// ============================================
// Render helpers
// ============================================

/**
 * Render the 4 lane heads in the lanes column. Each shows: lane-colored
 * swatch, name, and mono `CODE · N clip(s)` line.
 */
function renderLanesCol() {
  const els = getElements();
  const col = els.timelineLanes;

  const counts = [0, 0, 0, 0];
  for (const ev of state.events) {
    const idx = getEventLane(ev.type);
    if (idx >= 0 && idx < counts.length) counts[idx]++;
  }

  while (col.firstChild) col.removeChild(col.firstChild);

  for (let i = 0; i < LANE_META.length; i++) {
    const meta = LANE_META[i];
    const head = document.createElement('div');
    head.className = 'lane-head';
    head.dataset.lane = meta.data;

    const swatch = document.createElement('div');
    swatch.className = 'swatch';
    head.appendChild(swatch);

    const info = document.createElement('div');
    info.className = 'lane-info';
    const nameEl = document.createElement('div');
    nameEl.className = 'lane-name';
    nameEl.textContent = meta.name;
    info.appendChild(nameEl);
    const codeEl = document.createElement('div');
    codeEl.className = 'lane-count';
    codeEl.textContent = `${meta.code} · ${counts[i]} ${counts[i] === 1 ? 'clip' : 'clips'}`;
    info.appendChild(codeEl);
    head.appendChild(info);

    col.appendChild(head);
  }
}

/**
 * Render the sticky ruler ticks. One tick every 30 frames; the every-60
 * (1-second) ticks get the `.major.second` class for amber emphasis.
 */
function renderRuler() {
  const els = getElements();
  const ruler = els.timelineRuler;
  const length = state.timelineLength;
  const px = state.timelineScale || PX_PER_FRAME_DEFAULT;

  while (ruler.firstChild) ruler.removeChild(ruler.firstChild);
  ruler.style.width = `${length * px}px`;

  for (let f = 0; f <= length; f += 30) {
    const tick = document.createElement('span');
    tick.className = 'ruler-tick major';
    if (f % 60 === 0) tick.classList.add('second');
    tick.style.left = `${f * px}px`;
    tick.textContent = String(f);
    ruler.appendChild(tick);
  }
}

/**
 * Render the event blocks into 4 lane rows inside the track. Point events
 * (Rotate, Erase) are narrow (22px) chips with a downward triangle (drawn
 * by CSS via .is-point::after). Duration events get edge handles for
 * resize. Selected event gets the `.is-selected` class.
 */
function renderEventBlocks() {
  const els = getElements();
  const track = els.timelineEvents;
  const length = state.timelineLength;
  const px = state.timelineScale || PX_PER_FRAME_DEFAULT;

  while (track.firstChild) track.removeChild(track.firstChild);
  track.style.width = `${length * px}px`;
  track.style.position = 'relative';

  // 4 lane rows (CSS makes them flex 1 each within the track height)
  const laneRows = [];
  for (let i = 0; i < LANE_META.length; i++) {
    const row = document.createElement('div');
    row.className = 'lane-row';
    row.dataset.lane = LANE_META[i].data;
    row.dataset.laneIndex = String(i);
    row.style.position = 'relative';
    track.appendChild(row);
    laneRows.push(row);
  }

  for (let i = 0; i < state.events.length; i++) {
    const ev = state.events[i];
    const laneIdx = getEventLane(ev.type);
    const row = laneRows[laneIdx];
    if (!row) continue;

    const block = document.createElement('div');
    block.className = 'event-block';
    block.dataset.eventIndex = String(i);
    block.dataset.lane = LANE_META[laneIdx].data;
    if (i === state.selectedEventIndex) block.classList.add('is-selected');

    const start = ev.startFrame || 0;
    const dur = getEventDuration(ev.type, ev);

    if (POINT_EVENT_TYPES.has(ev.type)) {
      block.classList.add('is-point');
      block.style.left = `${start * px}px`;
      block.style.width = '22px';
    } else {
      block.style.left = `${start * px}px`;
      block.style.width = `${Math.max(8, dur) * px}px`;
    }

    const label = document.createElement('span');
    label.className = 'event-label';
    label.textContent = getTimelineEventLabel(ev);
    block.appendChild(label);

    if (!POINT_EVENT_TYPES.has(ev.type)) {
      const lh = document.createElement('div');
      lh.className = 'event-handle-l';
      lh.addEventListener('mousedown', (e) => startTimelineResize(e, ev, i, 'left'));
      block.appendChild(lh);
      const rh = document.createElement('div');
      rh.className = 'event-handle-r';
      rh.addEventListener('mousedown', (e) => startTimelineResize(e, ev, i, 'right'));
      block.appendChild(rh);
    }

    block.addEventListener('click', (e) => {
      e.stopPropagation();
      selectEvent(i);
      renderTimeline();
      renderProperties();
    });

    block.addEventListener('mousedown', (e) => startTimelineDrag(e, ev, i));

    row.appendChild(block);
  }
}

/**
 * Update the transport readout chip cells. Frame is 4-digit zero-padded;
 * Time is SS:FF where SS = floor(frame/60) and FF = frame % 60; Length
 * is the editable input (skip update if user is currently typing in it);
 * Events is the total count.
 */
function renderTransportReadout() {
  const els = getElements();
  const frame = state.currentFrame;

  els.readoutFrame.textContent = String(frame).padStart(4, '0');

  const secs = String(Math.floor(frame / 60)).padStart(2, '0');
  const ff = String(frame % 60).padStart(2, '0');
  els.readoutTime.textContent = `${secs}:${ff}`;

  const lengthInput = /** @type {HTMLInputElement} */ (els.timelineLengthInput);
  if (document.activeElement !== lengthInput) {
    lengthInput.value = String(state.timelineLength);
  }

  els.readoutEvents.textContent = String(state.events.length);
}

// ============================================
// Exports
// ============================================

function initTimeline() {
  renderTimeline();

  const els = getElements();
  const cursor = els.timelineCursor;
  const track = els.timelineEvents;

  cursor.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    const trackRect = track.getBoundingClientRect();
    const px = state.timelineScale || PX_PER_FRAME_DEFAULT;

    function move(ev) {
      const x = ev.clientX - trackRect.left + track.scrollLeft;
      const frame = Math.max(0, Math.min(state.timelineLength, Math.round(x / px)));
      state.currentFrame = frame;
      updateTimelineCursor();
      eventBus.emit(Events.RENDER_PREVIEW, frame);
    }

    function up() {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
    }

    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  });
}

function renderTimeline() {
  renderLanesCol();
  renderRuler();
  renderEventBlocks();
  renderTransportReadout();
  updateTimelineCursor();
  // Keep the existing minimap re-render hook — Task 7 swaps its internals
  // from canvas to DOM but the function name stays the same.
  if (typeof renderMinimap === 'function') renderMinimap();
}

// Lightweight cursor-only update for playback (avoids full DOM rebuild at 60fps)
function updateTimelineCursor() {
  const els = getElements();
  const cursor = els.timelineCursor;
  const px = state.timelineScale || PX_PER_FRAME_DEFAULT;

  cursor.style.left = `${state.currentFrame * px}px`;

  // Build (or reuse) the grip badge that displays the current frame.
  // Lives on the playhead's top edge per the design.
  let grip = /** @type {HTMLElement | null} */ (cursor.querySelector('.playhead-grip'));
  if (!grip) {
    grip = document.createElement('div');
    grip.className = 'playhead-grip';
    cursor.appendChild(grip);
  }
  grip.textContent = `${String(state.currentFrame).padStart(4, '0')}f`;

  // Keep the transport readout cells in lockstep with the playhead.
  if (els.readoutFrame) renderTransportReadout();

  // Update selected highlight without full rebuild
  const prevSelected = els.timelineEvents.querySelector('.event-block.is-selected');
  if (prevSelected) {
    const prevIdx = parseInt(prevSelected.dataset.eventIndex, 10);
    if (prevIdx !== state.selectedEventIndex) {
      prevSelected.classList.remove('is-selected');
      const newSelected = els.timelineEvents.querySelector(
        `.event-block[data-event-index="${state.selectedEventIndex}"]`
      );
      if (newSelected) newSelected.classList.add('is-selected');
    }
  }

  updateMinimapCursor();
}

function onTimelineClick(e) {
  const elements = getElements();
  const rect = elements.timelineTrack.getBoundingClientRect();
  const x = e.clientX - rect.left + elements.timelineTrack.scrollLeft;
  const px = state.timelineScale || PX_PER_FRAME_DEFAULT;
  let newFrame = Math.max(0, Math.round(x / px));

  if (!e.shiftKey) {
    newFrame = Math.round(newFrame / 10) * 10;
  }

  state.currentFrame = newFrame;
  renderTimeline();
}

export { initTimeline, renderTimeline, updateTimelineCursor, onTimelineClick, getTimelineEventLabel };
