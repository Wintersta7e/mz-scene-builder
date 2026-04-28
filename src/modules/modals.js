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
      <div class="modal-body">
        <div class="brand-mark" aria-hidden="true"></div>
        <h3>Timeline Scene Builder</h3>
        <p class="version">v1.3.0</p>
        <p>By W1nterstale</p>
        <p><a href="#" class="about-github-link">GitHub</a></p>
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
      <div class="modal-body">
        <h4>General</h4>
        <dl>
          <dt><kbd>Ctrl+Z</kbd></dt><dd>Undo</dd>
          <dt><kbd>Ctrl+Shift+Z</kbd> / <kbd>Ctrl+Y</kbd></dt><dd>Redo</dd>
          <dt><kbd>Ctrl+S</kbd></dt><dd>Save Scene</dd>
          <dt><kbd>F1</kbd></dt><dd>Show Help</dd>
        </dl>
        <h4>Events</h4>
        <dl>
          <dt><kbd>Ctrl+P</kbd></dt><dd>Insert Picture</dd>
          <dt><kbd>Ctrl+T</kbd></dt><dd>Insert Text</dd>
          <dt><kbd>Delete</kbd></dt><dd>Delete Selected</dd>
          <dt><kbd>Ctrl+C</kbd></dt><dd>Copy Event</dd>
          <dt><kbd>Ctrl+V</kbd></dt><dd>Paste Event</dd>
          <dt><kbd>Ctrl+D</kbd></dt><dd>Duplicate Event</dd>
        </dl>
        <h4>Image Movement</h4>
        <dl>
          <dt><kbd>Arrow Keys</kbd></dt><dd>Move 1 pixel</dd>
          <dt><kbd>Shift+Arrow</kbd></dt><dd>Move 10 pixels</dd>
        </dl>
        <h4>Timeline</h4>
        <dl>
          <dt><kbd>Ctrl+←/→</kbd></dt><dd>Move playhead 10 frames</dd>
          <dt><kbd>Ctrl+Shift+←/→</kbd></dt><dd>Move playhead 1 frame</dd>
          <dt><kbd>Click</kbd></dt><dd>Jump to frame (snap)</dd>
          <dt><kbd>Shift+Click</kbd></dt><dd>Jump to exact frame</dd>
        </dl>
      </div>
    </div>
  `;

  setupModal(modal, 'Keyboard Shortcuts');

  document.body.appendChild(modal);
  modal.querySelector('.btn-close').focus();
}

export { showAboutModal, showShortcutsModal, setupModal };
