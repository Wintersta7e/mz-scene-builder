// ============================================
// Event Management
// ============================================

const { state, MAX_PICTURE_NUMBER } = require('./state');
const { getElements } = require('./elements');
const { saveState } = require('./undo-redo');
const { sortEvents, getNextInsertOrder } = require('./utils');
const { eventBus, Events } = require('./event-bus');
const { logger } = require('./logger');

function getEventLane(type) {
  switch (type) {
    case 'showPicture':
    case 'movePicture':
    case 'rotatePicture':
    case 'erasePicture':
      return 0;
    case 'tintPicture':
    case 'screenFlash':
    case 'wait':
      return 1;
    case 'showText':
      return 2;
    default:
      return 0;
  }
}

function getEventDuration(type, evt) {
  if (type === 'showText') return 1;
  if (type === 'erasePicture') return 1;
  if (type === 'wait') return evt?.frames || 60;
  if (type === 'screenFlash') return evt?.duration || 8;
  if (evt && evt.duration) return evt.duration;
  if (type === 'showPicture') return 30;
  if (type === 'movePicture') return evt?.duration || 60;
  if (type === 'tintPicture') return evt?.duration || 60;
  if (type === 'rotatePicture') return 30;
  return 20;
}

function getNextPictureNumber() {
  const usedNumbers = state.events.filter((e) => e.type === 'showPicture').map((e) => e.pictureNumber);
  for (let i = 1; i <= MAX_PICTURE_NUMBER; i++) {
    if (!usedNumbers.includes(i)) return i;
  }
  logger.warn('All picture numbers (1-' + MAX_PICTURE_NUMBER + ') in use, reusing #1');
  return 1;
}

function getLastUsedPictureNumber() {
  for (let i = state.events.length - 1; i >= 0; i--) {
    if (state.events[i].type === 'showPicture') {
      return state.events[i].pictureNumber;
    }
  }
  return 1;
}

function createDefaultEvent(type) {
  const baseProps = { startFrame: state.currentFrame, _insertOrder: getNextInsertOrder() };

  switch (type) {
    case 'showPicture':
      return {
        ...baseProps,
        type: 'showPicture',
        pictureNumber: getNextPictureNumber(),
        imageName: '',
        origin: 0,
        positionType: 0,
        x: 0,
        y: 0,
        scaleX: 100,
        scaleY: 100,
        opacity: 255,
        blend: 0
      };
    case 'movePicture':
      return {
        ...baseProps,
        type: 'movePicture',
        pictureNumber: getLastUsedPictureNumber(),
        origin: 0,
        positionType: 0,
        x: 0,
        y: 0,
        scaleX: 100,
        scaleY: 100,
        opacity: 255,
        blend: 0,
        duration: 60,
        wait: true,
        easingType: 0
      };
    case 'rotatePicture':
      return {
        ...baseProps,
        type: 'rotatePicture',
        pictureNumber: getLastUsedPictureNumber(),
        speed: 0
      };
    case 'tintPicture':
      return {
        ...baseProps,
        type: 'tintPicture',
        pictureNumber: getLastUsedPictureNumber(),
        red: 0,
        green: 0,
        blue: 0,
        gray: 0,
        duration: 60,
        wait: true
      };
    case 'erasePicture':
      return {
        ...baseProps,
        type: 'erasePicture',
        pictureNumber: getLastUsedPictureNumber()
      };
    case 'showText':
      return {
        ...baseProps,
        type: 'showText',
        text: '',
        faceName: '',
        faceIndex: 0,
        background: 0,
        position: 2
      };
    case 'wait':
      return {
        ...baseProps,
        type: 'wait',
        frames: 60
      };
    case 'screenFlash':
      return {
        ...baseProps,
        type: 'screenFlash',
        red: 255,
        green: 255,
        blue: 255,
        intensity: 170,
        duration: 8,
        wait: true
      };
    default:
      return { type };
  }
}

function addEvent(type) {
  saveState('add ' + type);
  const evt = createDefaultEvent(type);
  logger.debug('Add event:', type, 'at frame', state.currentFrame);
  const insertFrame = state.currentFrame;
  const insertLane = getEventLane(type);

  // Shift existing events in the same lane at or after this frame to the right
  const shiftAmount = 10; // frames to shift
  for (const e of state.events) {
    if (getEventLane(e.type) === insertLane && (e.startFrame || 0) >= insertFrame) {
      e.startFrame = (e.startFrame || 0) + shiftAmount;
    }
  }

  state.events.push(evt);
  sortEvents(state.events);
  selectEvent(state.events.indexOf(evt));
  eventBus.emit(Events.RENDER);
}

function addPictureEvent(imagePath) {
  saveState('add picture');
  const evt = createDefaultEvent('showPicture');
  evt.imageName = imagePath;
  state.events.push(evt);
  sortEvents(state.events);
  selectEvent(state.events.indexOf(evt));
  eventBus.emit(Events.RENDER);
}

function deleteSelectedEvent() {
  if (state.selectedEventIndex >= 0) {
    const evt = state.events[state.selectedEventIndex];
    logger.debug('Delete event:', evt.type, 'at index', state.selectedEventIndex);
    saveState('delete event');
    state.events.splice(state.selectedEventIndex, 1);
    state.selectedEventIndex = Math.min(state.selectedEventIndex, state.events.length - 1);
    eventBus.emit(Events.RENDER);
  }
}

function selectEvent(index) {
  const elements = getElements();
  state.selectedEventIndex = index;
  elements.deleteEvent.disabled = index < 0;
}

function duplicateSelectedEvent() {
  if (state.selectedEventIndex < 0) return;

  saveState('duplicate');
  const original = state.events[state.selectedEventIndex];
  const duplicate = JSON.parse(JSON.stringify(original));

  if (duplicate.type === 'showText') {
    const textEvents = state.events.filter((e) => e.type === 'showText');
    const lastTextFrame =
      textEvents.length > 0 ? Math.max(...textEvents.map((e) => e.startFrame || 0)) : state.currentFrame;
    duplicate.startFrame = lastTextFrame + 10;
  } else {
    duplicate.startFrame = (original.startFrame || 0) + 1;
  }

  state.events.push(duplicate);
  sortEvents(state.events);
  state.selectedEventIndex = state.events.indexOf(duplicate);

  eventBus.emit(Events.RENDER);
}

function clearImageSelection() {
  const elements = getElements();
  state.selectedImages.clear();
  elements.imageBrowser.querySelectorAll('.image-item.selected').forEach((item) => {
    item.classList.remove('selected');
  });
}

function clearScene() {
  if (state.events.length === 0) return;

  if (!confirm('Clear all events from the timeline? This can be undone with Ctrl+Z.')) {
    return;
  }

  saveState('clear scene');
  state.events = [];
  state.selectedEventIndex = -1;
  state.currentFrame = 0;
  eventBus.emit(Events.RENDER);
}

module.exports = {
  getEventLane,
  getEventDuration,
  getNextPictureNumber,
  getLastUsedPictureNumber,
  createDefaultEvent,
  addEvent,
  addPictureEvent,
  deleteSelectedEvent,
  selectEvent,
  duplicateSelectedEvent,
  clearImageSelection,
  clearScene
};
