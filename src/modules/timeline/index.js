// ============================================
// Timeline Dispatcher
// ============================================

import { state, LANE_DATA } from '../state.js';
import { getElements } from '../elements.js';
import { getEventLane, getEventDuration, selectEvent } from '../events.js';
import { eventBus, Events } from '../event-bus.js';
import { renderMinimap, updateMinimapCursor } from './minimap.js';
import { startTimelineDrag, startTimelineResize } from './drag.js';
import { renderProperties } from '../properties/index.js';
import { assignSubLanes, clamp, clearChildren, formatFrameNumber, formatFrameTime } from '../utils.js';
import { logger } from '../logger.js';

const PX_PER_FRAME_DEFAULT = 5;

// Each row inside a lane is BLOCK_HEIGHT tall, with LANE_PADDING above the
// first row and below the last. The lane's CSS `--sublane-count` drives
// both the visible flex-grow and the min-height.
const BLOCK_HEIGHT = 20;
const SUBLANE_GAP = 4;
const LANE_PADDING = 4;

const LANE_LABELS = [
  { name: 'Pictures', code: 'PIC' },
  { name: 'Effects', code: 'FX' },
  { name: 'Text', code: 'TXT' },
  { name: 'Timing', code: 'AUX' }
];

const POINT_EVENT_TYPES = new Set(['rotatePicture', 'erasePicture']);

/**
 * Compute per-lane sub-lane assignments using greedy interval-scheduling
 * over each lane's events. Returns a map keyed by event reference and a
 * parallel `counts` array (one entry per lane) of max sub-lanes used.
 */
function computeSubLaneAssignments(events) {
  const grouped = LANE_LABELS.map(() => /** @type {Array<*>} */ ([]));
  for (const ev of events) {
    const laneIdx = getEventLane(ev.type);
    if (laneIdx >= 0 && laneIdx < grouped.length) grouped[laneIdx].push(ev);
  }

  const assignments = new Map();
  const counts = [];
  for (let laneIdx = 0; laneIdx < grouped.length; laneIdx++) {
    const laneEvents = grouped[laneIdx];
    const { subLanes, maxSubLanes } = assignSubLanes(laneEvents, (ev) => {
      const start = ev.startFrame || 0;
      const dur = Math.max(1, getEventDuration(ev.type, ev));
      return [start, start + dur];
    });
    for (let j = 0; j < laneEvents.length; j++) {
      assignments.set(laneEvents[j], subLanes[j]);
    }
    counts.push(Math.max(1, maxSubLanes));
  }
  return { assignments, counts };
}

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
function renderLanesCol(subLaneCounts) {
  const els = getElements();
  const col = els.timelineLanes;

  const counts = [0, 0, 0, 0];
  for (const ev of state.events) {
    const idx = getEventLane(ev.type);
    if (idx >= 0 && idx < counts.length) counts[idx]++;
  }

  clearChildren(col);

  for (let i = 0; i < LANE_LABELS.length; i++) {
    const meta = LANE_LABELS[i];
    const head = document.createElement('div');
    head.className = 'lane-head';
    head.dataset.lane = LANE_DATA[i];
    head.style.setProperty('--sublane-count', String(subLaneCounts[i]));

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

  clearChildren(ruler);
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
function renderEventBlocks(assignments, counts) {
  const els = getElements();
  const track = els.timelineEvents;
  const length = state.timelineLength;
  const px = state.timelineScale || PX_PER_FRAME_DEFAULT;

  clearChildren(track);
  track.style.width = `${length * px}px`;
  track.style.position = 'relative';

  const laneRows = [];
  for (let i = 0; i < LANE_LABELS.length; i++) {
    const row = document.createElement('div');
    row.className = 'lane-row';
    row.dataset.lane = LANE_DATA[i];
    row.dataset.laneIndex = String(i);
    row.style.position = 'relative';
    row.style.setProperty('--sublane-count', String(counts[i]));
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
    block.dataset.lane = LANE_DATA[laneIdx];
    if (i === state.selectedEventIndex) block.classList.add('is-selected');

    const start = ev.startFrame || 0;
    const dur = getEventDuration(ev.type, ev);
    const subLane = assignments.get(ev) || 0;
    block.dataset.sublane = String(subLane);
    block.style.top = `${LANE_PADDING + subLane * (BLOCK_HEIGHT + SUBLANE_GAP)}px`;
    block.style.height = `${BLOCK_HEIGHT}px`;

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

/** Update only the cells that change with currentFrame (playback hot path). */
function updateTransportFrameTime() {
  const els = getElements();
  els.readoutFrame.textContent = formatFrameNumber(state.currentFrame);
  els.readoutTime.textContent = formatFrameTime(state.currentFrame);
}

/**
 * Full transport-readout refresh. Use for structural changes (event count
 * delta, timeline-length change). Per-frame playback updates use
 * updateTransportFrameTime instead.
 */
function renderTransportReadout() {
  const els = getElements();
  updateTransportFrameTime();

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

  // Keep the lane-heads on the left scrolling in lockstep with the
  // right-hand timeline so labels stay aligned with their rows when
  // sub-lanes overflow the visible area.
  const trackScroll = els.timelineTrack;
  const lanesCol = els.timelineLanes;
  if (trackScroll && lanesCol) {
    trackScroll.addEventListener(
      'scroll',
      () => {
        if (lanesCol.scrollTop !== trackScroll.scrollTop) {
          lanesCol.scrollTop = trackScroll.scrollTop;
        }
      },
      { passive: true }
    );
  }

  // Without this, the click that follows a grip mousedown bubbles to the
  // timeline-track click handler and snaps the cursor to a 10-frame grid.
  cursor.addEventListener('click', (e) => e.stopPropagation());

  cursor.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    function move(mouseEvt) {
      // Read geometry and scale fresh each tick: panel resize or a future
      // timeline-zoom feature would otherwise leave cached values stale.
      const rect = track.getBoundingClientRect();
      const px = state.timelineScale || PX_PER_FRAME_DEFAULT;
      const x = mouseEvt.clientX - rect.left + track.scrollLeft;
      const frame = clamp(Math.round(x / px), 0, state.timelineLength);
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
  logger.timed('renderTimeline', () => {
    const { assignments, counts } = computeSubLaneAssignments(state.events);
    renderLanesCol(counts);
    renderRuler();
    renderEventBlocks(assignments, counts);
    renderTransportReadout();
    updateTimelineCursor();
    renderMinimap();
  });
}

/**
 * Lightweight playhead update for playback (60fps). Only touches the
 * cursor element + minimap cursor — the transport readout's frame/time
 * cells are updated by callers that change those values, not here.
 */
function updateTimelineCursor() {
  const els = getElements();
  const cursor = els.timelineCursor;
  const px = state.timelineScale || PX_PER_FRAME_DEFAULT;

  cursor.style.left = `${state.currentFrame * px}px`;

  let grip = /** @type {HTMLElement | null} */ (cursor.querySelector('.playhead-grip'));
  if (!grip) {
    grip = document.createElement('div');
    grip.className = 'playhead-grip';
    cursor.appendChild(grip);
  }
  grip.textContent = `${formatFrameNumber(state.currentFrame)}f`;

  updateTransportFrameTime();

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
