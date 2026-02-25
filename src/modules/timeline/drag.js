// ============================================
// Timeline Event Dragging
// ============================================

const { state } = require('../state');
const { saveState, markDirty } = require('../undo-redo');
const { sortEvents } = require('../utils');
const { selectEvent } = require('../events');
const { eventBus, Events } = require('../event-bus');

function startTimelineDrag(e, evt, index) {
  if (e.button !== 0) return;

  saveState('move event on timeline');
  selectEvent(index);

  state.timelineDragEvt = evt;
  state.timelineDragIndex = index;
  state.timelineDragStartX = e.clientX;
  state.timelineDragStartFrame = evt.startFrame || 0;

  const onDrag = (e) => onTimelineDrag(e);
  const onStop = () => stopTimelineDrag(onDrag, onStop);

  document.addEventListener('mousemove', onDrag);
  document.addEventListener('mouseup', onStop);
  e.preventDefault();
  e.stopPropagation();
}

function onTimelineDrag(e) {
  if (!state.timelineDragEvt) return;

  const deltaX = e.clientX - state.timelineDragStartX;
  const deltaFrames = Math.round(deltaX / state.timelineScale);
  let newFrame = Math.max(0, state.timelineDragStartFrame + deltaFrames);

  if (!e.shiftKey) {
    newFrame = Math.round(newFrame / 10) * 10;
  }

  state.timelineDragEvt.startFrame = newFrame;
  eventBus.emit(Events.RENDER_TIMELINE);
}

function stopTimelineDrag(onDrag, onStop) {
  const draggedEvt = state.timelineDragEvt;
  const draggedIdx = state.timelineDragIndex;
  const originalFrame = state.timelineDragStartFrame;
  const selectedEvt = state.selectedEventIndex >= 0 ? state.events[state.selectedEventIndex] : null;

  state.timelineDragEvt = null;
  state.timelineDragIndex = -1;
  document.removeEventListener('mousemove', onDrag);
  document.removeEventListener('mouseup', onStop);

  // For text events: prevent stacking
  if (draggedEvt && draggedEvt.type === 'showText') {
    const draggedStart = draggedEvt.startFrame || 0;
    const overlappingText = state.events.find((evt, idx) =>
      idx !== draggedIdx &&
      evt.type === 'showText' &&
      Math.abs((evt.startFrame || 0) - draggedStart) < 10
    );
    if (overlappingText) {
      overlappingText.startFrame = originalFrame;
    }
  }

  sortEvents(state.events);

  if (selectedEvt) {
    state.selectedEventIndex = state.events.indexOf(selectedEvt);
  }

  markDirty();

  eventBus.emit(Events.RENDER_TIMELINE);

  // Update properties
  const { renderProperties } = require('../properties/index');
  renderProperties();
}

module.exports = { startTimelineDrag };
