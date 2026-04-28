// ============================================
// Animation Playback Control
// ============================================

import { state } from './state.js';
import { getElements } from './elements.js';
import { getEventDuration } from './events.js';
import { eventBus, Events } from './event-bus.js';
import { logger } from './logger.js';
import { updateTimelineCursor } from './timeline/index.js';

function emitRender() {
  // During playback, use lightweight cursor update instead of full timeline rebuild
  if (state.isPlaying) {
    updateTimelineCursor();
  } else {
    eventBus.emit(Events.RENDER_TIMELINE);
  }
  eventBus.emit(Events.RENDER_PREVIEW, state.currentFrame);
}

function togglePlayback() {
  if (state.isPlaying) {
    pausePlayback();
  } else {
    startPlayback();
  }
}

function computeMaxFrame() {
  let max = 0;
  for (const evt of state.events) {
    const endFrame = (evt.startFrame || 0) + getEventDuration(evt.type, evt);
    if (endFrame > max) max = endFrame;
  }
  return max;
}

function buildTextFrameMap() {
  const map = new Map();
  for (let i = 0; i < state.events.length; i++) {
    if (state.events[i].type === 'showText') {
      const frame = state.events[i].startFrame || 0;
      if (!map.has(frame)) map.set(frame, []);
      map.get(frame).push(i);
    }
  }
  return map;
}

function findUnprocessedTextAt(textFrameMap, frame) {
  const indices = textFrameMap.get(frame);
  if (!indices) return -1;
  for (const idx of indices) {
    if (!state.processedTextEvents.has(idx)) return idx;
  }
  return -1;
}

function startPlayback() {
  if (state.events.length === 0) return;

  if (state.playbackInterval) {
    clearInterval(state.playbackInterval);
    state.playbackInterval = null;
  }

  logger.debug('Playback started at frame', state.currentFrame);
  const elements = getElements();
  state.isPlaying = true;
  eventBus.emit(Events.RENDER_PREVIEW, state.currentFrame);
  state.waitingForTextClick = false;
  state.processedTextEvents.clear();
  elements.btnPlay.textContent = '⏸';

  // Pre-compute expensive lookups once at playback start
  const maxFrame = computeMaxFrame();
  const textFrameMap = buildTextFrameMap();

  // Check for text event at current frame before starting
  const initialTextIndex = findUnprocessedTextAt(textFrameMap, state.currentFrame);
  if (initialTextIndex !== -1) {
    state.waitingForTextClick = true;
    state.processedTextEvents.add(initialTextIndex);
    emitRender();
  }

  state.playbackInterval = setInterval(() => {
    if (state.waitingForTextClick) return;

    state.currentFrame++;

    // Check for text event at this frame
    const textEventIndex = findUnprocessedTextAt(textFrameMap, state.currentFrame);

    if (textEventIndex !== -1) {
      logger.debug('Text pause at frame', state.currentFrame, '(event', textEventIndex, ')');
      state.waitingForTextClick = true;
      state.processedTextEvents.add(textEventIndex);
      emitRender();
      return;
    }

    if (state.currentFrame > maxFrame) {
      state.currentFrame = 0;
      state.processedTextEvents.clear();

      // Check for text at frame 0 after looping
      const textAtZero = findUnprocessedTextAt(textFrameMap, 0);
      if (textAtZero !== -1) {
        state.waitingForTextClick = true;
        state.processedTextEvents.add(textAtZero);
        emitRender();
        return;
      }
    }

    emitRender();
  }, 1000 / 60);
}

function pausePlayback() {
  const elements = getElements();
  state.isPlaying = false;
  eventBus.emit(Events.RENDER_PREVIEW, state.currentFrame);
  state.waitingForTextClick = false;
  elements.btnPlay.textContent = '▶';
  if (state.playbackInterval) {
    clearInterval(state.playbackInterval);
    state.playbackInterval = null;
  }
}

function stopPlayback() {
  logger.debug('Playback stopped');
  pausePlayback();
  state.currentFrame = 0;
  state.processedTextEvents.clear();
  emitRender();
}

function continueFromText() {
  if (state.waitingForTextClick && state.isPlaying) {
    state.waitingForTextClick = false;
  }
}

export { togglePlayback, startPlayback, pausePlayback, stopPlayback, continueFromText };
