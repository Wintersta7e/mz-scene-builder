// ============================================
// Timeline Dispatcher
// ============================================

const { state, TIMELINE_LANES, LANE_HEIGHT } = require('../state');
const { getElements } = require('../elements');
const { getEventLane, getEventDuration, selectEvent } = require('../events');
const { renderMinimap, updateMinimapViewport } = require('./minimap');
const { startTimelineDrag } = require('./drag');

function initTimeline() {
  const elements = getElements();
  elements.timelineLanes.innerHTML = TIMELINE_LANES.map(name =>
    `<div class="timeline-lane-label">${name}</div>`
  ).join('');
  renderTimeline();
}

function getTimelineEventLabel(evt) {
  switch (evt.type) {
    case 'showPicture': return `#${evt.pictureNumber}`;
    case 'movePicture': return `→#${evt.pictureNumber}`;
    case 'rotatePicture': return `↻#${evt.pictureNumber}`;
    case 'tintPicture': return `🎨#${evt.pictureNumber}`;
    case 'erasePicture': return `✕#${evt.pictureNumber}`;
    case 'showText': return evt.text ? evt.text.substring(0, 8) : 'Text';
    case 'wait': return `⏸${evt.frames}f`;
    case 'screenFlash': return '⚡Flash';
    default: return evt.type;
  }
}

function renderTimeline() {
  const elements = getElements();

  let maxFrame = state.timelineLength;
  state.events.forEach(evt => {
    const endFrame = (evt.startFrame || 0) + getEventDuration(evt.type, evt);
    if (endFrame > maxFrame) maxFrame = endFrame + 30;
  });

  const totalWidth = maxFrame * state.timelineScale;

  // Render ruler
  elements.timelineRuler.innerHTML = '';
  elements.timelineRuler.style.width = `${totalWidth}px`;
  for (let f = 0; f <= maxFrame; f += 10) {
    const mark = document.createElement('div');
    mark.className = 'timeline-ruler-mark' + (f % 60 === 0 ? ' major' : '');
    mark.style.left = `${f * state.timelineScale}px`;
    if (f % 60 === 0) {
      mark.textContent = `${f}`;
    }
    elements.timelineRuler.appendChild(mark);
  }

  // Calculate sub-rows for overlapping events
  const laneSubRows = [[], [], []];
  const eventSubRowMap = new Map();

  state.events.forEach((evt, index) => {
    const startFrame = evt.startFrame || 0;
    const duration = getEventDuration(evt.type, evt);
    const endFrame = startFrame + duration;
    const lane = getEventLane(evt.type);

    if (evt.type === 'showText') {
      laneSubRows[lane][0] = laneSubRows[lane][0] || [];
      laneSubRows[lane][0].push({ start: startFrame, end: endFrame });
      eventSubRowMap.set(index, 0);
      return;
    }

    let subRow = 0;
    const laneRows = laneSubRows[lane];
    while (true) {
      if (!laneRows[subRow]) laneRows[subRow] = [];
      const hasOverlap = laneRows[subRow].some(range =>
        !(endFrame <= range.start || startFrame >= range.end)
      );
      if (!hasOverlap) break;
      subRow++;
    }
    laneRows[subRow].push({ start: startFrame, end: endFrame });
    eventSubRowMap.set(index, subRow);
  });

  const maxSubRows = laneSubRows.map(rows => Math.max(1, rows.length));
  const laneOffsets = [0];
  for (let i = 1; i < TIMELINE_LANES.length; i++) {
    laneOffsets[i] = laneOffsets[i - 1] + maxSubRows[i - 1] * LANE_HEIGHT;
  }
  const totalHeight = laneOffsets[TIMELINE_LANES.length - 1] + maxSubRows[TIMELINE_LANES.length - 1] * LANE_HEIGHT;

  // Render events area
  elements.timelineEvents.innerHTML = '';
  elements.timelineEvents.style.width = `${totalWidth}px`;
  elements.timelineEvents.style.height = `${totalHeight}px`;

  // Update lane labels
  elements.timelineLanes.innerHTML = TIMELINE_LANES.map((name, i) =>
    `<div class="timeline-lane-label" style="height: ${maxSubRows[i] * LANE_HEIGHT}px">${name}</div>`
  ).join('');

  // Add lane row backgrounds
  for (let i = 0; i < TIMELINE_LANES.length; i++) {
    for (let sr = 0; sr < maxSubRows[i]; sr++) {
      const row = document.createElement('div');
      row.className = 'timeline-lane-row' + (sr % 2 === 1 ? ' alt' : '');
      row.style.top = `${laneOffsets[i] + sr * LANE_HEIGHT}px`;
      row.style.width = `${totalWidth}px`;
      row.style.height = `${LANE_HEIGHT}px`;
      row.style.position = 'absolute';
      elements.timelineEvents.appendChild(row);
    }
    if (i < TIMELINE_LANES.length - 1) {
      const separator = document.createElement('div');
      separator.className = 'timeline-lane-separator';
      separator.style.top = `${laneOffsets[i] + maxSubRows[i] * LANE_HEIGHT - 1}px`;
      separator.style.width = `${totalWidth}px`;
      elements.timelineEvents.appendChild(separator);
    }
  }

  // Add grid lines
  for (let f = 0; f <= maxFrame; f += 30) {
    const gridLine = document.createElement('div');
    gridLine.className = 'timeline-grid-line' + (f % 60 === 0 ? ' major' : '');
    gridLine.style.left = `${f * state.timelineScale}px`;
    gridLine.style.height = `${totalHeight}px`;
    elements.timelineEvents.appendChild(gridLine);
  }

  // Render events
  state.events.forEach((evt, index) => {
    const eventEl = document.createElement('div');
    eventEl.className = 'timeline-event' + (index === state.selectedEventIndex ? ' selected' : '');
    eventEl.dataset.index = index;
    eventEl.dataset.type = evt.type;

    const startFrame = evt.startFrame || 0;
    const duration = getEventDuration(evt.type, evt);
    const lane = getEventLane(evt.type);
    const subRow = eventSubRowMap.get(index) || 0;

    eventEl.style.left = `${startFrame * state.timelineScale}px`;
    eventEl.style.top = `${laneOffsets[lane] + subRow * LANE_HEIGHT + 1}px`;
    const minWidth = (evt.type === 'showText' || evt.type === 'erasePicture') ? 50 : 20;
    eventEl.style.width = `${Math.max(duration * state.timelineScale, minWidth)}px`;

    eventEl.textContent = getTimelineEventLabel(evt);
    eventEl.title = `${evt.type} @ frame ${startFrame}`;

    eventEl.addEventListener('click', (e) => {
      e.stopPropagation();
      selectEvent(index);
      renderTimeline();
      // Re-render properties through callback
      const { renderProperties } = require('../properties/index');
      renderProperties();
    });

    eventEl.addEventListener('mousedown', (e) => startTimelineDrag(e, evt, index));

    elements.timelineEvents.appendChild(eventEl);
  });

  // Update cursor
  elements.timelineCursor.style.left = `${state.currentFrame * state.timelineScale}px`;
  elements.currentFrameDisplay.textContent = state.currentFrame;

  renderMinimap();
}

function onTimelineClick(e) {
  const elements = getElements();
  const rect = elements.timelineTrack.getBoundingClientRect();
  const x = e.clientX - rect.left + elements.timelineTrack.scrollLeft;
  let newFrame = Math.max(0, Math.round(x / state.timelineScale));

  if (!e.shiftKey) {
    newFrame = Math.round(newFrame / 10) * 10;
  }

  state.currentFrame = newFrame;
  renderTimeline();
}

module.exports = {
  initTimeline,
  renderTimeline,
  onTimelineClick,
  getTimelineEventLabel
};
