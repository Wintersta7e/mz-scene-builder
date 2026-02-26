// ============================================
// Timeline Minimap
// ============================================

import { state } from '../state.js';
import { getElements } from '../elements.js';
import { getEventLane, getEventDuration } from '../events.js';
import { eventBus, Events } from '../event-bus.js';

const MINIMAP_COLORS = {
  showPicture: '#22c55e',
  movePicture: '#3b82f6',
  rotatePicture: '#a855f7',
  tintPicture: '#eab308',
  erasePicture: '#ef4444',
  showText: '#06b6d4',
  wait: '#6b7280',
  screenFlash: '#f97316'
};

let _minimapInitialized = false;

function renderMinimap() {
  const elements = getElements();
  const canvas = elements.minimapCanvas;
  const container = elements.timelineMinimap;
  if (!canvas || !container) return;

  const containerRect = container.getBoundingClientRect();
  const width = containerRect.width;
  const height = containerRect.height;

  const dpr = window.devicePixelRatio || 1;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);

  let maxFrame = state.timelineLength;
  state.events.forEach((evt) => {
    const endFrame = (evt.startFrame || 0) + getEventDuration(evt.type, evt);
    if (endFrame > maxFrame) maxFrame = endFrame + 30;
  });

  if (maxFrame <= 0) return;

  const scale = width / maxFrame;

  // Frame markers
  ctx.fillStyle = 'rgba(100, 100, 120, 0.3)';
  for (let f = 60; f <= maxFrame; f += 60) {
    const x = f * scale;
    ctx.fillRect(x, 0, 1, height);
  }

  // Events
  const laneHeight = height / 3;
  state.events.forEach((evt) => {
    const startFrame = evt.startFrame || 0;
    const duration = Math.max(getEventDuration(evt.type, evt), 5);
    const lane = getEventLane(evt.type);

    const x = startFrame * scale;
    const w = Math.max(duration * scale, 2);
    const y = lane * laneHeight + 2;
    const h = laneHeight - 4;

    ctx.fillStyle = MINIMAP_COLORS[evt.type] || '#888';
    ctx.globalAlpha = 0.8;
    ctx.fillRect(x, y, w, h);
  });

  ctx.globalAlpha = 1;

  updateMinimapViewport();

  const cursorX = state.currentFrame * scale;
  elements.minimapCursor.style.left = `${cursorX}px`;
}

function updateMinimapViewport() {
  const elements = getElements();
  const track = elements.timelineTrack;
  const container = elements.timelineMinimap;
  const viewport = elements.minimapViewport;
  if (!track || !container || !viewport) return;

  let maxFrame = state.timelineLength;
  state.events.forEach((evt) => {
    const endFrame = (evt.startFrame || 0) + getEventDuration(evt.type, evt);
    if (endFrame > maxFrame) maxFrame = endFrame + 30;
  });

  if (maxFrame <= 0) return;

  const containerWidth = container.getBoundingClientRect().width;
  const scale = containerWidth / maxFrame;

  const scrollLeft = track.scrollLeft;
  const visibleWidth = track.clientWidth;
  const visibleStartFrame = scrollLeft / state.timelineScale;
  const visibleEndFrame = (scrollLeft + visibleWidth) / state.timelineScale;

  const viewportLeft = visibleStartFrame * scale;
  const viewportWidth = Math.min((visibleEndFrame - visibleStartFrame) * scale, containerWidth);

  viewport.style.left = `${Math.max(0, viewportLeft)}px`;
  viewport.style.width = `${Math.max(20, viewportWidth)}px`;
}

function initMinimapEvents() {
  if (_minimapInitialized) return;
  _minimapInitialized = true;

  const elements = getElements();
  const minimap = elements.timelineMinimap;
  const track = elements.timelineTrack;
  if (!minimap || !track) return;

  minimap.addEventListener('mousedown', (e) => {
    state.minimapDragging = true;
    handleMinimapClick(e);
  });

  document.addEventListener('mousemove', (e) => {
    if (state.minimapDragging) {
      handleMinimapClick(e);
    }
  });

  document.addEventListener('mouseup', () => {
    state.minimapDragging = false;
  });

  track.addEventListener('scroll', () => {
    updateMinimapViewport();
  });

  window.addEventListener('resize', () => {
    renderMinimap();
  });
}

function handleMinimapClick(e) {
  const elements = getElements();
  const minimap = elements.timelineMinimap;
  const track = elements.timelineTrack;
  if (!minimap || !track) return;

  const rect = minimap.getBoundingClientRect();
  const x = Math.max(0, e.clientX - rect.left);
  const containerWidth = rect.width;

  let maxFrame = state.timelineLength;
  state.events.forEach((evt) => {
    const endFrame = (evt.startFrame || 0) + getEventDuration(evt.type, evt);
    if (endFrame > maxFrame) maxFrame = endFrame + 30;
  });

  const clickFrame = (x / containerWidth) * maxFrame;
  const visibleWidth = track.clientWidth;
  const targetScrollPixels = clickFrame * state.timelineScale - visibleWidth / 2;
  track.scrollLeft = Math.max(0, targetScrollPixels);

  state.currentFrame = Math.round(clickFrame / 10) * 10;

  eventBus.emit(Events.RENDER_TIMELINE);
  eventBus.emit(Events.RENDER_PREVIEW, state.currentFrame);
}

export {
  renderMinimap,
  updateMinimapViewport,
  initMinimapEvents,
  MINIMAP_COLORS
};
