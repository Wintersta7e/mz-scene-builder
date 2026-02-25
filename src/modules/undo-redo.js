// ============================================
// Undo/Redo System
// ============================================

const { state, MAX_UNDO_STACK } = require('./state');
const { logger } = require('./logger');
const { eventBus, Events } = require('./event-bus');

function saveState(actionName) {
  const stateSnapshot = {
    action: actionName,
    events: JSON.parse(JSON.stringify(state.events)),
    selectedEventIndex: state.selectedEventIndex,
    currentFrame: state.currentFrame
  };

  state.undoStack.push(stateSnapshot);

  if (state.undoStack.length > MAX_UNDO_STACK) {
    state.undoStack.shift();
  }

  state.redoStack = [];
  markDirty();
}

function undo() {
  if (state.undoStack.length === 0) return;

  const currentState = {
    action: 'redo',
    events: JSON.parse(JSON.stringify(state.events)),
    selectedEventIndex: state.selectedEventIndex,
    currentFrame: state.currentFrame
  };
  state.redoStack.push(currentState);

  const prevState = state.undoStack.pop();
  state.events = prevState.events;
  state.selectedEventIndex = prevState.selectedEventIndex;
  state.currentFrame = prevState.currentFrame;

  eventBus.emit(Events.RENDER);
  logger.debug('Undo:', prevState.action);
}

function redo() {
  if (state.redoStack.length === 0) return;

  const currentState = {
    action: 'undo',
    events: JSON.parse(JSON.stringify(state.events)),
    selectedEventIndex: state.selectedEventIndex,
    currentFrame: state.currentFrame
  };
  state.undoStack.push(currentState);

  const nextState = state.redoStack.pop();
  state.events = nextState.events;
  state.selectedEventIndex = nextState.selectedEventIndex;
  state.currentFrame = nextState.currentFrame;

  eventBus.emit(Events.RENDER);
  logger.debug('Redo');
}

function markDirty() {
  if (!state.isDirty) {
    state.isDirty = true;
    updateWindowTitle();
  }
}

function markClean() {
  state.isDirty = false;
  updateWindowTitle();
}

function updateWindowTitle() {
  const title = 'Timeline Scene Builder' + (state.isDirty ? ' *' : '');
  document.title = title;
}

async function checkUnsavedChanges() {
  // If no unsaved changes, proceed
  if (!state.isDirty) return true;

  // Show confirmation dialog
  const result = await showConfirmDialog(
    'Unsaved Changes',
    'You have unsaved changes. Do you want to continue and lose them?',
    ['Continue', 'Cancel']
  );

  return result === 'Continue';
}

function showConfirmDialog(title, message, buttons) {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content" style="width: 400px;">
        <div class="modal-header">
          <h3>${title}</h3>
        </div>
        <div class="modal-body" style="padding: 20px;">
          <p>${message}</p>
          <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px;">
            ${buttons.map((btn, i) => `
              <button class="btn ${i === 0 ? 'btn-primary' : ''}" data-result="${btn}">${btn}</button>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    modal.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        document.body.removeChild(modal);
        resolve(btn.dataset.result);
      });
    });

    document.body.appendChild(modal);
  });
}

module.exports = {
  saveState,
  undo,
  redo,
  markDirty,
  markClean,
  updateWindowTitle,
  checkUnsavedChanges,
  showConfirmDialog
};
