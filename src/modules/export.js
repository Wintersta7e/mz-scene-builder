// ============================================
// Export to Map Modal (Virtual Dropdowns)
// ============================================

// Use secure API exposed via preload script
const api = window.api;
import { state, SETTINGS_KEY } from './state.js';
import { getElements } from './elements.js';
import { VirtualDropdown } from './components/virtual-dropdown.js';
import { logger } from './logger.js';
import { showError, showWarning, showSuccess } from './notifications.js';

// Last export settings storage key
const LAST_EXPORT_KEY = SETTINGS_KEY + '_lastExport';

// Selected values
let selectedMapId = null;
let selectedEventId = null;
let selectedPageIndex = 0;
let selectedEventPages = 1;

// Virtual dropdown instances
let mapDropdown = null;
let eventDropdown = null;
let pageDropdown = null;

function initExportDropdowns() {
  const elements = getElements();

  // Map dropdown
  mapDropdown = new VirtualDropdown({
    container: elements.exportMapSelect,
    placeholder: '-- Select Map --',
    searchable: true,
    onSelect: (value, _item) => {
      selectedMapId = value;
      onMapSelected();
    }
  });

  // Event dropdown (no search - usually small list)
  eventDropdown = new VirtualDropdown({
    container: elements.exportEventSelect,
    placeholder: '-- Select Event --',
    searchable: false,
    onSelect: (value, item) => {
      selectedEventId = value;
      selectedEventPages = item.pages || 1;
      onEventSelected();
    }
  });
  eventDropdown.setDisabled(true);

  // Page dropdown (no search - very small list)
  pageDropdown = new VirtualDropdown({
    container: elements.exportPageSelect,
    placeholder: '-- Select Page --',
    searchable: false,
    onSelect: (value) => {
      selectedPageIndex = value;
      elements.doExport.disabled = false;
    }
  });
  pageDropdown.setDisabled(true);
}

// Pre-render maps dropdown (called when project loads)
function prerenderMapsDropdown() {
  if (!state.cachedMaps || !mapDropdown) return;

  const items = state.cachedMaps.map((m) => ({
    value: m.id,
    label: `${m.id}: ${m.name}`
  }));

  mapDropdown.setItems(items);
  logger.debug(`Pre-rendered ${items.length} map options`);
}

// Pre-render events dropdown for a map
function prerenderEventsDropdown(mapId) {
  const mapEvents = state.cachedMapEvents[mapId];
  if (!mapEvents || !eventDropdown) return;

  const items = mapEvents.map((e) => ({
    value: e.id,
    label: `${e.id}: ${e.name || '(unnamed)'}`,
    pages: e.pages
  }));

  eventDropdown.setItems(items);
}

// Render page options
function renderPageOptions(pageCount) {
  const items = [];
  for (let i = 0; i < pageCount; i++) {
    items.push({
      value: i,
      label: `Page ${i + 1}`
    });
  }
  pageDropdown.setItems(items);
}

async function openExportModal() {
  if (state.events.length === 0) {
    showWarning('No events to export');
    return;
  }

  try {
    const elements = getElements();

    // Reset selections
    selectedMapId = null;
    selectedEventId = null;
    selectedPageIndex = 0;

    // Reset UI
    mapDropdown.clear();
    mapDropdown.setPlaceholder('-- Select Map --');
    eventDropdown.clear();
    eventDropdown.setPlaceholder('-- Select Event --');
    eventDropdown.setDisabled(true);
    pageDropdown.clear();
    pageDropdown.setPlaceholder('-- Select Page --');
    pageDropdown.setDisabled(true);
    pageDropdown.setItems([]);
    elements.doExport.disabled = true;

    // Check if maps are ready (pre-rendered on project load)
    if (state.cachedMaps) {
      mapDropdown.setDisabled(false);
    } else {
      // Fetch maps (fallback - shouldn't happen normally)
      mapDropdown.setPlaceholder('Loading maps...');
      mapDropdown.setDisabled(true);

      const maps = await api.invoke('get-maps');
      if (maps.error) {
        showError('Error loading maps: ' + maps.error);
        mapDropdown.setPlaceholder('Error loading maps');
        elements.exportModal.style.display = 'flex';
        return;
      }
      state.cachedMaps = maps;
      prerenderMapsDropdown();
      mapDropdown.setPlaceholder('-- Select Map --');
      mapDropdown.setDisabled(false);
    }

    // Show modal
    elements.exportModal.style.display = 'flex';
  } catch (err) {
    logger.error('Failed to open export modal:', err);
    showError('Failed to open export: ' + err.message);
  }
}

async function onMapSelected() {
  const elements = getElements();

  if (!selectedMapId) {
    eventDropdown.setDisabled(true);
    pageDropdown.setDisabled(true);
    elements.doExport.disabled = true;
    return;
  }

  try {
    // Check if events are cached
    if (state.cachedMapEvents[selectedMapId]) {
      logger.debug('Map events cache hit:', selectedMapId);
      prerenderEventsDropdown(selectedMapId);
      eventDropdown.clear();
      eventDropdown.setPlaceholder('-- Select Event --');
      eventDropdown.setDisabled(false);
    } else {
      // Fetch events
      eventDropdown.setPlaceholder('Loading events...');
      eventDropdown.setDisabled(true);

      const mapEvents = await api.invoke('get-map-events', selectedMapId);
      if (mapEvents.error) {
        showError('Error loading events: ' + mapEvents.error);
        eventDropdown.setPlaceholder('Error loading events');
        return;
      }
      state.cachedMapEvents[selectedMapId] = mapEvents;
      prerenderEventsDropdown(selectedMapId);
      eventDropdown.setPlaceholder('-- Select Event --');
      eventDropdown.setDisabled(false);
    }

    // Reset event and page selection
    selectedEventId = null;
    eventDropdown.clear();
    pageDropdown.setDisabled(true);
    pageDropdown.clear();
    pageDropdown.setItems([]);
    elements.doExport.disabled = true;
  } catch (err) {
    logger.error('Failed to load map events:', err);
    showError('Failed to load events: ' + err.message);
  }
}

function onEventSelected() {
  const elements = getElements();

  if (!selectedEventId) {
    pageDropdown.setDisabled(true);
    elements.doExport.disabled = true;
    return;
  }

  // Render page options
  renderPageOptions(selectedEventPages);
  selectedPageIndex = 0;
  pageDropdown.setSelected(0, 'Page 1');
  pageDropdown.setDisabled(false);
  elements.doExport.disabled = false;
}

function closeExportModal() {
  const elements = getElements();
  elements.exportModal.style.display = 'none';

  // Close any open dropdowns
  if (mapDropdown) mapDropdown.close();
  if (eventDropdown) eventDropdown.close();
  if (pageDropdown) pageDropdown.close();
}

async function doExportToMap() {
  if (!selectedMapId || !selectedEventId) {
    showWarning('Please select a map and event');
    return;
  }

  try {
    logger.info('Export to map:', { mapId: selectedMapId, eventId: selectedEventId, page: selectedPageIndex + 1 });

    const result = await api.invoke('export-to-map', {
      events: state.events,
      mapId: selectedMapId,
      eventId: selectedEventId,
      pageIndex: selectedPageIndex
    });

    if (result.error) {
      showError('Export failed: ' + result.error);
    } else {
      // Save last export settings for quick export
      saveLastExport(selectedMapId, selectedEventId, selectedPageIndex);
      showSuccess(
        `Exported ${result.commandCount} commands to Map ${selectedMapId}, Event ${selectedEventId}, Page ${selectedPageIndex + 1}. Reload the map in RPG Maker to see the changes.`
      );
      closeExportModal();
    }
  } catch (err) {
    logger.error('Failed to export to map:', err);
    showError('Export failed: ' + err.message);
  }
}

// Save last export settings to localStorage
function saveLastExport(mapId, eventId, pageIndex) {
  try {
    localStorage.setItem(LAST_EXPORT_KEY, JSON.stringify({ mapId, eventId, pageIndex }));
    // Enable quick export button
    const elements = getElements();
    if (elements.quickExport) {
      elements.quickExport.disabled = false;
      elements.quickExport.title = `Quick Export to Map ${mapId}, Event ${eventId}, Page ${pageIndex + 1}`;
    }
  } catch (e) {
    logger.warn('Failed to save last export settings:', e);
  }
}

// Get last export settings from localStorage
function getLastExport() {
  try {
    const data = localStorage.getItem(LAST_EXPORT_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    logger.warn('Failed to parse last export settings');
    return null;
  }
}

// Check if we have last export settings and update button state
function updateQuickExportButton() {
  const elements = getElements();
  if (!elements.quickExport) return;

  const lastExport = getLastExport();
  if (lastExport && state.projectPath) {
    elements.quickExport.disabled = state.events.length === 0;
    elements.quickExport.title = `Quick Export to Map ${lastExport.mapId}, Event ${lastExport.eventId}, Page ${lastExport.pageIndex + 1}`;
  } else {
    elements.quickExport.disabled = true;
    elements.quickExport.title = 'Export to last used location (export once first)';
  }
}

// Quick export to last used location
async function quickExport() {
  const lastExport = getLastExport();
  if (!lastExport) {
    showWarning('No previous export location. Use "Export to Map" first.');
    return;
  }

  if (state.events.length === 0) {
    showWarning('No events to export');
    return;
  }

  try {
    const { mapId, eventId, pageIndex } = lastExport;
    logger.info('Quick export to:', { mapId, eventId, page: pageIndex + 1 });

    const result = await api.invoke('export-to-map', {
      events: state.events,
      mapId,
      eventId,
      pageIndex
    });

    if (result.error) {
      showError('Quick export failed: ' + result.error);
    } else {
      showSuccess(
        `Quick exported ${result.commandCount} commands to Map ${mapId}, Event ${eventId}, Page ${pageIndex + 1}`
      );
    }
  } catch (err) {
    logger.error('Failed to quick export:', err);
    showError('Quick export failed: ' + err.message);
  }
}

export {
  openExportModal,
  closeExportModal,
  doExportToMap,
  initExportDropdowns,
  prerenderMapsDropdown,
  quickExport,
  updateQuickExportButton
};
