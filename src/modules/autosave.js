// ============================================
// Autosave System
// ============================================

import { state, AUTOSAVE_INTERVAL } from './state.js';
import { getElements } from './elements.js';
import { showConfirmDialog, markDirty } from './undo-redo.js';
import { logger } from './logger.js';
import { eventBus, Events } from './event-bus.js';
import { sanitizeEvents, syncInsertOrderCounter } from './file-ops.js';

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
      state._autosaveFailCount = 0;
    } else {
      state._autosaveFailCount = (state._autosaveFailCount || 0) + 1;
      logger.warn('Autosave returned error:', result.error);
      if (state._autosaveFailCount === 3) {
        const { showWarning } = await import('./notifications.js');
        showWarning('Autosave is failing repeatedly. Your work may not be auto-saved.');
      }
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

      if (data.projectPath) {
        // Check if project path is still valid via IPC
        const projResult = await window.api.invoke('set-project-path', data.projectPath);
        if (projResult && projResult.success) {
          await openProjectPath(data.projectPath);
        } else {
          logger.warn('Autosave project path no longer valid:', data.projectPath);
        }
      }

      // Set recovered events AFTER openProjectPath (which clears state.events)
      state.events = data.events || [];
      sanitizeEvents(state.events);
      syncInsertOrderCounter(state.events);
      state.timelineLength = data.timelineLength || 300;
      elements.timelineLengthInput.value = state.timelineLength;

      eventBus.emit(Events.RENDER);
      markDirty();
    }

    await window.api.invoke('autosave-delete');
  } catch (e) {
    logger.error('Autosave recovery failed:', e);
  }
}

export { startAutosave, stopAutosave, performAutosave, checkAutosaveRecovery };
