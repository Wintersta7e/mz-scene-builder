// ============================================
// Settings & Recent Projects
// ============================================

import { SETTINGS_KEY, MAX_RECENT_PROJECTS } from './state.js';

// Simple path.basename replacement for browser context
function basename(p) {
  return p.split(/[/\\]/).pop() || p;
}
import { logger } from './logger.js';
import { showError, showWarning } from './notifications.js';
import { eventBus, Events } from './event-bus.js';

function getSettings() {
  try {
    const data = localStorage.getItem(SETTINGS_KEY);
    return data ? JSON.parse(data) : {};
  } catch {
    logger.warn('Failed to parse settings from localStorage');
    return {};
  }
}

function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function getRecentProjects() {
  const settings = getSettings();
  return settings.recentProjects || [];
}

function addRecentProject(projPath) {
  const settings = getSettings();
  let recent = settings.recentProjects || [];

  recent = recent.filter((p) => p !== projPath);
  recent.unshift(projPath);
  recent = recent.slice(0, MAX_RECENT_PROJECTS);

  settings.recentProjects = recent;
  saveSettings(settings);
  updateRecentProjectsDropdown();
}

function updateRecentProjectsDropdown() {
  const recent = getRecentProjects();
  const dropdown = document.getElementById('recent-projects-dropdown');
  if (!dropdown) return;

  dropdown.textContent = '';

  if (recent.length === 0) {
    const placeholder = document.createElement('div');
    placeholder.className = 'dropdown-item disabled';
    placeholder.textContent = 'No recent projects';
    dropdown.appendChild(placeholder);
    return;
  }

  recent.forEach((p) => {
    const item = document.createElement('div');
    item.className = 'dropdown-item';
    item.textContent = basename(p);
    item.title = p;
    item.addEventListener('click', async (e) => {
      e.stopPropagation();
      e.preventDefault();

      try {
        // Validate project through IPC (checks if path exists and is valid MZ project)
        const result = await window.api.invoke('set-project-path', p);
        if (result && result.error) {
          showWarning('Project folder not found or invalid: ' + p);
          return;
        }
        eventBus.emit(Events.OPEN_RECENT_PROJECT, p);
      } catch (err) {
        logger.error('Error opening project:', err);
        showError('Error opening project: ' + err.message);
      }
    });
    dropdown.appendChild(item);
  });
}

function initRecentProjectsDropdown() {
  const container = document.getElementById('open-project-container');
  const dropdown = document.getElementById('recent-projects-dropdown');
  const openBtn = document.getElementById('btn-open-project');

  if (!container || !dropdown || !openBtn) {
    logger.warn('Recent projects elements not found', {
      container: !!container,
      dropdown: !!dropdown,
      openBtn: !!openBtn
    });
    return;
  }

  logger.info('Recent projects dropdown initialized');

  dropdown.addEventListener('click', (e) => {
    e.stopPropagation();
    logger.debug('Dropdown click - stopping propagation');
  });
}

export {
  getSettings,
  saveSettings,
  getRecentProjects,
  addRecentProject,
  updateRecentProjectsDropdown,
  initRecentProjectsDropdown
};
