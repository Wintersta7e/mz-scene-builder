// ============================================
// Undo/Redo System
// ============================================

import { state, MAX_UNDO_STACK } from './state.js';
import { logger } from './logger.js';
import { eventBus, Events } from './event-bus.js';

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
    const previousFocus = document.activeElement;
    const modal = document.createElement('div');
    modal.className = 'modal';

    // Build DOM safely (no innerHTML with parameters)
    const content = document.createElement('div');
    content.className = 'modal-content';
    content.style.width = '400px';

    const header = document.createElement('div');
    header.className = 'modal-header';
    const h3 = document.createElement('h3');
    h3.textContent = title;
    header.appendChild(h3);

    const body = document.createElement('div');
    body.className = 'modal-body';
    body.style.padding = '20px';
    const p = document.createElement('p');
    p.textContent = message;
    body.appendChild(p);

    const btnContainer = document.createElement('div');
    btnContainer.style.cssText = 'display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px;';

    const closeModal = (result) => {
      modal.remove();
      if (previousFocus) previousFocus.focus();
      resolve(result);
    };

    buttons.forEach((btnText, i) => {
      const btn = document.createElement('button');
      btn.className = 'btn' + (i === 0 ? ' btn-primary' : '');
      btn.textContent = btnText;
      btn.addEventListener('click', () => closeModal(btnText));
      btnContainer.appendChild(btn);
    });

    body.appendChild(btnContainer);
    content.appendChild(header);
    content.appendChild(body);
    modal.appendChild(content);

    // Escape to close (resolve last button = cancel)
    modal.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeModal(buttons[buttons.length - 1]);
      }
      // Trap focus within modal
      if (e.key === 'Tab') {
        const focusable = modal.querySelectorAll('button');
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    });

    document.body.appendChild(modal);
    // Focus first button
    const firstBtn = modal.querySelector('button');
    if (firstBtn) firstBtn.focus();
  });
}

export {
  saveState,
  undo,
  redo,
  markDirty,
  markClean,
  updateWindowTitle,
  checkUnsavedChanges,
  showConfirmDialog
};
