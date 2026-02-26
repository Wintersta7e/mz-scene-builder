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
  const btn = document.getElementById('btn-toggle-grid');
  if (btn) {
    btn.classList.toggle('active', state.gridVisible);
  }
}

function updateSnapButton() {
  const btn = document.getElementById('btn-toggle-snap');
  if (btn) {
    btn.classList.toggle('active', state.snapToGrid);
  }
}

function snapPosition(value) {
  if (!state.snapToGrid) return value;
  return Math.round(value / GRID_SIZE) * GRID_SIZE;
}

export {
  toggleGrid,
  toggleSnapToGrid,
  updateGridButton,
  updateSnapButton,
  snapPosition
};
