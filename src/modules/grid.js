// ============================================
// Grid Overlay
// ============================================

import { state, GRID_SIZE } from './state.js';

function toggleGrid() {
  state.gridVisible = !state.gridVisible;
  const grid = document.getElementById('preview-grid');
  if (grid) {
    grid.classList.toggle('visible', state.gridVisible);
  }
  updateGridButton();
}

function toggleSnapToGrid() {
  state.snapToGrid = !state.snapToGrid;
  updateSnapButton();
}

function updateGridButton() {
  // Visual state is managed by refreshStageToggles in init.js via .is-on.
}

function updateSnapButton() {
  // Visual state is managed by refreshStageToggles in init.js via .is-on.
}

function snapPosition(value) {
  if (!state.snapToGrid) return value;
  return Math.round(value / GRID_SIZE) * GRID_SIZE;
}

export { toggleGrid, toggleSnapToGrid, updateGridButton, updateSnapButton, snapPosition };
