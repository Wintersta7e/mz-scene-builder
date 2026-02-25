// ============================================
// Animation Playback Control
// ============================================

const { state } = require('./state');
const { getElements } = require('./elements');
const { getEventDuration } = require('./events');
const { eventBus, Events } = require('./event-bus');

function emitRender() {
  eventBus.emit(Events.RENDER_TIMELINE);
  eventBus.emit(Events.RENDER_PREVIEW, state.currentFrame);
}

function togglePlayback() {
  if (state.isPlaying) {
    pausePlayback();
  } else {
    startPlayback();
  }
}

function startPlayback() {
  const elements = getElements();
  state.isPlaying = true;
  state.waitingForTextClick = false;
  state.processedTextEvents.clear();
  elements.btnPlay.textContent = '⏸';

  // Check for text event at current frame before starting
  const initialTextIndex = state.events.findIndex(
    (evt, idx) =>
      evt.type === 'showText' && (evt.startFrame || 0) === state.currentFrame && !state.processedTextEvents.has(idx)
  );
  if (initialTextIndex !== -1) {
    state.waitingForTextClick = true;
    state.processedTextEvents.add(initialTextIndex);
    emitRender();
  }

  state.playbackInterval = setInterval(() => {
    if (state.waitingForTextClick) return;

    state.currentFrame++;

    // Check for text event at this frame
    const textEventIndex = state.events.findIndex(
      (evt, idx) =>
        evt.type === 'showText' && (evt.startFrame || 0) === state.currentFrame && !state.processedTextEvents.has(idx)
    );

    if (textEventIndex !== -1) {
      state.waitingForTextClick = true;
      state.processedTextEvents.add(textEventIndex);
      emitRender();
      return;
    }

    // Find max frame
    let maxFrame = 0;
    state.events.forEach((evt) => {
      const endFrame = (evt.startFrame || 0) + getEventDuration(evt.type, evt);
      if (endFrame > maxFrame) maxFrame = endFrame;
    });

    if (state.currentFrame > maxFrame) {
      state.currentFrame = 0;
      state.processedTextEvents.clear();

      // Check for text at frame 0 after looping
      const textAtZero = state.events.findIndex(
        (evt, idx) => evt.type === 'showText' && (evt.startFrame || 0) === 0 && !state.processedTextEvents.has(idx)
      );
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
  state.waitingForTextClick = false;
  elements.btnPlay.textContent = '▶';
  if (state.playbackInterval) {
    clearInterval(state.playbackInterval);
    state.playbackInterval = null;
  }
}

function stopPlayback() {
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

module.exports = {
  togglePlayback,
  startPlayback,
  pausePlayback,
  stopPlayback,
  continueFromText
};
