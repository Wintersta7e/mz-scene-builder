// ============================================
// Help & About Modals
// ============================================

function showAboutModal() {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.id = 'about-modal';
  modal.innerHTML = `
    <div class="modal-content modal-about">
      <div class="modal-header">
        <h3>About</h3>
        <button class="btn-close" onclick="this.closest('.modal').remove()">&times;</button>
      </div>
      <div class="about-content">
        <div class="about-icon">
          <img src="../assets/icon.png" alt="Timeline Scene Builder" width="64" height="64">
        </div>
        <div class="about-title">Timeline Scene Builder</div>
        <div class="about-version">Version 1.2.0</div>
        <div class="about-author">By W1nterstale</div>
        <div class="about-links">
          <a href="#" onclick="window.api.openExternal('https://itch.io'); return false;">itch.io</a>
        </div>
      </div>
    </div>
  `;

  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });

  document.body.appendChild(modal);
}

function showShortcutsModal() {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.id = 'shortcuts-modal';
  modal.innerHTML = `
    <div class="modal-content modal-shortcuts">
      <div class="modal-header">
        <h3>Keyboard Shortcuts</h3>
        <button class="btn-close" onclick="this.closest('.modal').remove()">&times;</button>
      </div>
      <div class="shortcuts-content">
        <div class="shortcut-group">
          <h4>General</h4>
          <div class="shortcut-row">
            <span class="shortcut-desc">Undo</span>
            <span class="shortcut-key">Ctrl+Z</span>
          </div>
          <div class="shortcut-row">
            <span class="shortcut-desc">Redo</span>
            <span class="shortcut-key">Ctrl+Shift+Z / Ctrl+Y</span>
          </div>
          <div class="shortcut-row">
            <span class="shortcut-desc">Save Scene</span>
            <span class="shortcut-key">Ctrl+S</span>
          </div>
          <div class="shortcut-row">
            <span class="shortcut-desc">Show Help</span>
            <span class="shortcut-key">F1</span>
          </div>
        </div>
        <div class="shortcut-group">
          <h4>Events</h4>
          <div class="shortcut-row">
            <span class="shortcut-desc">Insert Picture</span>
            <span class="shortcut-key">Ctrl+P</span>
          </div>
          <div class="shortcut-row">
            <span class="shortcut-desc">Insert Text</span>
            <span class="shortcut-key">Ctrl+T</span>
          </div>
          <div class="shortcut-row">
            <span class="shortcut-desc">Delete Selected</span>
            <span class="shortcut-key">Delete</span>
          </div>
          <div class="shortcut-row">
            <span class="shortcut-desc">Copy Event</span>
            <span class="shortcut-key">Ctrl+C</span>
          </div>
          <div class="shortcut-row">
            <span class="shortcut-desc">Paste Event</span>
            <span class="shortcut-key">Ctrl+V</span>
          </div>
          <div class="shortcut-row">
            <span class="shortcut-desc">Duplicate Event</span>
            <span class="shortcut-key">Ctrl+D</span>
          </div>
        </div>
        <div class="shortcut-group">
          <h4>Image Movement</h4>
          <div class="shortcut-row">
            <span class="shortcut-desc">Move 1 pixel</span>
            <span class="shortcut-key">Arrow Keys</span>
          </div>
          <div class="shortcut-row">
            <span class="shortcut-desc">Move 10 pixels</span>
            <span class="shortcut-key">Shift+Arrow Keys</span>
          </div>
        </div>
        <div class="shortcut-group">
          <h4>Timeline</h4>
          <div class="shortcut-row">
            <span class="shortcut-desc">Move playhead 10 frames</span>
            <span class="shortcut-key">Ctrl+Arrow Left/Right</span>
          </div>
          <div class="shortcut-row">
            <span class="shortcut-desc">Move playhead 1 frame</span>
            <span class="shortcut-key">Ctrl+Shift+Arrow Left/Right</span>
          </div>
          <div class="shortcut-row">
            <span class="shortcut-desc">Jump to frame (snap)</span>
            <span class="shortcut-key">Click</span>
          </div>
          <div class="shortcut-row">
            <span class="shortcut-desc">Jump to exact frame</span>
            <span class="shortcut-key">Shift+Click</span>
          </div>
        </div>
      </div>
    </div>
  `;

  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });

  document.body.appendChild(modal);
}

module.exports = { showAboutModal, showShortcutsModal };
