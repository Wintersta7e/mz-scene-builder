// ============================================
// Image Picker Modal
// ============================================

const api = window.api;
import { state } from '../state.js';
import { getElements } from '../elements.js';
import { saveState, markDirty } from '../undo-redo.js';
import { eventBus, Events } from '../event-bus.js';
import { logger } from '../logger.js';
import { clearChildren } from '../utils.js';

// One IntersectionObserver per open modal session, recreated on each
// open/close cycle. Each observed `.grid-image-item` carries its image
// path on `dataset.imagePath`; the observer reads from there and asks
// the main process for a thumbnail when the tile becomes visible.
/** @type {IntersectionObserver | null} */
let _thumbObserver = null;

/** @type {Element | null} */
let _pickerPreviousFocus = null;
/** @type {((e: KeyboardEvent) => void) | null} */
let _pickerEscapeHandler = null;

async function openImagePicker() {
  if (!state.folderStructure) return;

  const elements = getElements();
  const modal = elements.imagePickerModal;

  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', 'Select Image');

  modal.style.display = 'grid';

  _pickerPreviousFocus = document.activeElement;

  if (_pickerEscapeHandler) modal.removeEventListener('keydown', _pickerEscapeHandler);
  _pickerEscapeHandler = (e) => {
    if (e.key === 'Escape') closeImagePicker();
  };
  modal.addEventListener('keydown', _pickerEscapeHandler);

  const closeBtn = modal.querySelector('.btn-close');
  if (closeBtn instanceof HTMLElement) closeBtn.focus();

  _thumbObserver = new IntersectionObserver(onThumbsIntersect);

  clearChildren(elements.pickerFolders);
  setPlaceholder(elements.pickerImages, 'Select a folder');

  renderPickerFolders(state.folderStructure);
}

function closeImagePicker() {
  const elements = getElements();
  const modal = elements.imagePickerModal;
  modal.style.display = 'none';

  if (_pickerEscapeHandler) {
    modal.removeEventListener('keydown', _pickerEscapeHandler);
    _pickerEscapeHandler = null;
  }

  if (_pickerPreviousFocus instanceof HTMLElement) {
    _pickerPreviousFocus.focus();
    _pickerPreviousFocus = null;
  }

  if (_thumbObserver) {
    _thumbObserver.disconnect();
    _thumbObserver = null;
  }
}

function setPlaceholder(target, text) {
  clearChildren(target);
  const p = document.createElement('p');
  p.className = 'placeholder';
  p.textContent = text;
  target.appendChild(p);
}

/**
 * @param {IntersectionObserverEntry[]} entries
 */
function onThumbsIntersect(entries) {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    const tile = /** @type {HTMLElement} */ (entry.target);
    if (_thumbObserver) _thumbObserver.unobserve(tile);
    loadThumb(tile);
  }
}

/**
 * @param {HTMLElement} tile
 */
async function loadThumb(tile) {
  const path = tile.dataset.imagePath;
  if (!path) return;
  try {
    const thumb = await api.invoke('get-thumbnail', path);
    if (thumb && thumb.startsWith('data:image/png;base64,')) {
      const thumbEl = /** @type {HTMLElement | null} */ (tile.querySelector('.grid-image-thumb'));
      if (!thumbEl) return;
      thumbEl.style.backgroundImage = `url(${thumb})`;
      thumbEl.style.backgroundSize = 'contain';
      thumbEl.style.backgroundRepeat = 'no-repeat';
      thumbEl.style.backgroundPosition = 'center';
    }
  } catch (err) {
    logger.error('Failed to load picker thumbnail:', path, err);
  }
}

function renderPickerFolders(items, container = null) {
  const elements = getElements();
  const target = container ?? elements.pickerFolders;

  for (const item of items) {
    if (item.type !== 'folder') continue;

    const folderEl = document.createElement('div');
    folderEl.className = 'folder-item';

    const header = document.createElement('div');
    header.className = 'folder-header';
    const icon = document.createElement('span');
    icon.className = 'folder-icon';
    icon.textContent = '📁';
    header.appendChild(icon);
    const name = document.createElement('span');
    name.className = 'folder-name';
    name.textContent = item.name;
    header.appendChild(name);
    folderEl.appendChild(header);

    const children = document.createElement('div');
    children.className = 'folder-children';
    folderEl.appendChild(children);

    header.addEventListener('click', async () => {
      if (folderEl.dataset.loading === 'true') return;

      const wasExpanded = folderEl.classList.contains('expanded');
      folderEl.classList.toggle('expanded');
      icon.textContent = wasExpanded ? '📁' : '📂';

      if (!wasExpanded && item.children === null) {
        folderEl.dataset.loading = 'true';
        setPlaceholder(children, 'Loading...');
        try {
          const contents = await api.invoke('get-folder-contents', item.path);
          clearChildren(children);
          if (contents && contents.error) {
            logger.warn('Failed to load picker subfolder:', item.path, contents.error);
          } else if (contents && !contents.error) {
            item.children = contents;
            renderPickerFolders(
              contents.filter((c) => c.type === 'folder'),
              children
            );
          }
        } catch (err) {
          logger.error('Error loading picker folder:', item.path, err);
          clearChildren(children);
        }
        folderEl.dataset.loading = '';
      }

      await loadPickerImages(item.path);
    });

    if (item.children) {
      renderPickerFolders(
        item.children.filter((c) => c.type === 'folder'),
        children
      );
    }

    target.appendChild(folderEl);
  }
}

async function loadPickerImages(folderPath) {
  if (_thumbObserver) {
    _thumbObserver.disconnect();
  }

  const elements = getElements();
  setPlaceholder(elements.pickerImages, 'Loading...');

  try {
    const contents = await api.invoke('get-folder-contents', folderPath);
    if (!contents || contents.error) {
      logger.warn('Failed to load picker folder:', folderPath, contents?.error);
      setPlaceholder(elements.pickerImages, 'No images found');
      return;
    }

    const images = contents.filter((item) => item.type === 'file');
    if (images.length === 0) {
      setPlaceholder(elements.pickerImages, 'No images in this folder');
      return;
    }

    clearChildren(elements.pickerImages);

    for (const img of images) {
      const tile = document.createElement('div');
      tile.className = 'grid-image-item';
      tile.dataset.imagePath = img.path;

      const thumb = document.createElement('div');
      thumb.className = 'grid-image-thumb';
      tile.appendChild(thumb);

      const nameEl = document.createElement('div');
      nameEl.className = 'grid-image-name';
      nameEl.textContent = img.name;
      tile.appendChild(nameEl);

      tile.addEventListener('click', () => selectPickerImage(img.path));

      elements.pickerImages.appendChild(tile);
      if (_thumbObserver) _thumbObserver.observe(tile);
    }
  } catch (err) {
    logger.error('Failed to load picker images:', err);
    setPlaceholder(elements.pickerImages, 'Failed to load images');
  }
}

function selectPickerImage(imagePath) {
  if (state.selectedEventIndex >= 0 && state.events[state.selectedEventIndex].type === 'showPicture') {
    saveState('change image');
    state.events[state.selectedEventIndex].imageName = imagePath;
    markDirty();
    eventBus.emit(Events.RENDER);
  }
  closeImagePicker();
}

export { openImagePicker, closeImagePicker, renderPickerFolders, loadPickerImages, selectPickerImage };
