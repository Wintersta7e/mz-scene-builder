// ============================================
// Help & About Modals
// ============================================

/**
 * Trap focus within a modal element.
 * Returns a cleanup function to remove the event listener.
 */
function trapFocus(modal) {
  const handler = (e) => {
    if (e.key !== 'Tab') return;
    const focusable = modal.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) {
        last.focus();
        e.preventDefault();
      }
    } else {
      if (document.activeElement === last) {
        first.focus();
        e.preventDefault();
      }
    }
  };
  modal.addEventListener('keydown', handler);
  return () => modal.removeEventListener('keydown', handler);
}

/**
 * Set up common modal behavior: ARIA, focus trap, Escape to close, backdrop click.
 * Returns a remove function that cleans up and restores focus.
 */
function setupModal(modal, label) {
  const previousFocus = document.activeElement;

  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', label);

  const removeTrap = trapFocus(modal);

  const closeModal = () => {
    removeTrap();
    modal.remove();
    if (previousFocus && previousFocus.focus) previousFocus.focus();
  };

  modal.querySelectorAll('.btn-close').forEach((btn) => {
    btn.setAttribute('aria-label', 'Close');
    btn.addEventListener('click', closeModal);
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  modal.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });

  return closeModal;
}

function showAboutModal() {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.id = 'about-modal';
  // Static template HTML — no user input, safe to use innerHTML
  modal.innerHTML = `
    <div class="modal-content modal-about">
      <div class="modal-header">
        <h3>About</h3>
        <button class="btn-close">&times;</button>
      </div>
      <div class="about-content">
        <div class="about-icon">
          <img src="../assets/icon.png" alt="Timeline Scene Builder" width="64" height="64">
        </div>
        <div class="about-title">Timeline Scene Builder</div>
        <div class="about-version">Version 1.3.0</div>
        <div class="about-author">By W1nterstale</div>
        <div class="about-links">
          <a href="#" class="about-github-link">GitHub</a>
        </div>
      </div>
    </div>
  `;

  setupModal(modal, 'About Timeline Scene Builder');

  const githubLink = modal.querySelector('.about-github-link');
  if (githubLink) {
    githubLink.addEventListener('click', (e) => {
      e.preventDefault();
      window.api.openExternal('https://github.com/Wintersta7e/mz-scene-builder');
    });
  }

  document.body.appendChild(modal);
  modal.querySelector('.btn-close').focus();
}

function showShortcutsModal() {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.id = 'shortcuts-modal';
  // Static template HTML — no user input, safe to use innerHTML
  modal.innerHTML = `
    <div class="modal-content modal-shortcuts">
      <div class="modal-header">
        <h3>Keyboard Shortcuts</h3>
        <button class="btn-close">&times;</button>
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

  setupModal(modal, 'Keyboard Shortcuts');

  document.body.appendChild(modal);
  modal.querySelector('.btn-close').focus();
}

export { showAboutModal, showShortcutsModal };
