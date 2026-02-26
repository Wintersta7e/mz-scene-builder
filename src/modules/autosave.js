// ============================================
// Autosave System
// ============================================

import { state, AUTOSAVE_INTERVAL } from './state.js';
import { getElements } from './elements.js';
import { showConfirmDialog, markDirty } from './undo-redo.js';
import { logger } from './logger.js';
import { eventBus, Events } from './event-bus.js';
import { resetInsertOrderCounter } from './utils.js';

function startAutosave() {
  stopAutosave();
  state.autosaveInterval = setInterval(() => {
    if (state.isDirty && state.events.length > 0) {
      performAutosave();
    }
  }, AUTOSAVE_INTERVAL);
}

function stopAutosave() {
  if (state.autosaveInterval) {
    clearInterval(state.autosaveInterval);
    state.autosaveInterval = null;
  }
}

async function performAutosave() {
  try {
    const sceneData = {
      version: 1,
      timelineLength: state.timelineLength,
      events: state.events,
      projectPath: state.projectPath,
      timestamp: Date.now()
    };
    const result = await window.api.invoke('autosave-write', sceneData);
    if (result.success) {
      logger.debug('Autosaved');
    }
  } catch (e) {
    logger.error('Autosave failed:', e);
  }
}

async function checkAutosaveRecovery(openProjectPath) {
  try {
    const exists = await window.api.invoke('autosave-exists');
    if (!exists) return;

    const data = await window.api.invoke('autosave-read');
    if (!data) return;

    const timestamp = new Date(data.timestamp);
    const age = Date.now() - data.timestamp;

    if (age > 24 * 60 * 60 * 1000) {
      await window.api.invoke('autosave-delete');
      return;
    }

    const result = await showConfirmDialog(
      'Recover Autosave?',
      `Found an autosave from ${timestamp.toLocaleString()}. Would you like to recover it?`,
      ['Recover', 'Discard']
    );

    if (result === 'Recover') {
      const elements = getElements();
      state.events = data.events || [];
      // Sync insert order counter so new events get higher numbers
      const maxOrder = state.events.reduce((max, e) => Math.max(max, e._insertOrder || 0), 0);
      resetInsertOrderCounter(maxOrder);
      state.timelineLength = data.timelineLength || 300;
      elements.timelineLengthInput.value = state.timelineLength;

      if (data.projectPath) {
        // Check if project path is still valid via IPC
        const projResult = await window.api.invoke('set-project-path', data.projectPath);
        if (projResult && projResult.success) {
          await openProjectPath(data.projectPath);
        }
      }

      eventBus.emit(Events.RENDER);
      markDirty();
    }

    await window.api.invoke('autosave-delete');
  } catch (e) {
    logger.error('Autosave recovery failed:', e);
  }
}

export {
  startAutosave,
  stopAutosave,
  performAutosave,
  checkAutosaveRecovery
};
