// ============================================
// Image Picker Modal
// ============================================

// Use secure API exposed via preload script
const api = window.api;
import { state } from '../state.js';
import { getElements } from '../elements.js';
import { saveState, markDirty } from '../undo-redo.js';
import { eventBus, Events } from '../event-bus.js';
import { logger } from '../logger.js';

// Track IntersectionObservers for cleanup
const activeObservers = new Set();

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function openImagePicker() {
  if (!state.folderStructure) return;

  const elements = getElements();
  elements.imagePickerModal.style.display = 'flex';
  elements.pickerFolders.innerHTML = '';
  elements.pickerImages.innerHTML = '<p class="placeholder">Select a folder</p>';

  renderPickerFolders(state.folderStructure);
}

function closeImagePicker() {
  const elements = getElements();
  elements.imagePickerModal.style.display = 'none';
  // Disconnect all pending IntersectionObservers
  for (const obs of activeObservers) {
    obs.disconnect();
  }
  activeObservers.clear();
}

function renderPickerFolders(items, container = null) {
  const elements = getElements();
  const target = container ?? elements.pickerFolders;

  for (const item of items) {
    if (item.type === 'folder') {
      const folderEl = document.createElement('div');
      folderEl.className = 'folder-item';
      folderEl.innerHTML = `
        <div class="folder-header">
          <span class="folder-icon">📁</span>
          <span class="folder-name">${escapeHtml(item.name)}</span>
        </div>
        <div class="folder-children"></div>
      `;

      const header = folderEl.querySelector('.folder-header');
      const children = folderEl.querySelector('.folder-children');

      header.addEventListener('click', async () => {
        if (folderEl.dataset.loading === 'true') return;

        const wasExpanded = folderEl.classList.contains('expanded');
        folderEl.classList.toggle('expanded');
        header.querySelector('.folder-icon').textContent = wasExpanded ? '📁' : '📂';

        if (!wasExpanded && item.children === null) {
          folderEl.dataset.loading = 'true';
          children.innerHTML = '<p class="placeholder">Loading...</p>';
          try {
            const contents = await api.invoke('get-folder-contents', item.path);
            children.innerHTML = '';
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
            children.innerHTML = '';
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
}

async function loadPickerImages(folderPath) {
  const elements = getElements();
  elements.pickerImages.innerHTML = '<p class="placeholder">Loading...</p>';

  try {
    const contents = await api.invoke('get-folder-contents', folderPath);
    if (!contents || contents.error) {
      logger.warn('Failed to load picker folder:', folderPath, contents?.error);
      elements.pickerImages.innerHTML = '<p class="placeholder">No images found</p>';
      return;
    }

    const images = contents.filter((item) => item.type === 'file');
    if (images.length === 0) {
      elements.pickerImages.innerHTML = '<p class="placeholder">No images in this folder</p>';
      return;
    }

    elements.pickerImages.innerHTML = '';

    for (const img of images) {
      const el = document.createElement('div');
      el.className = 'grid-image-item';
      el.innerHTML = `
        <div class="grid-image-thumb" data-path="${escapeHtml(img.path)}"></div>
        <div class="grid-image-name">${escapeHtml(img.name)}</div>
      `;

      const loadThumb = async () => {
        try {
          const thumb = await api.invoke('get-thumbnail', img.path);
          if (thumb && thumb.startsWith('data:image/png;base64,')) {
            el.querySelector('.grid-image-thumb').style.backgroundImage = `url(${thumb})`;
            el.querySelector('.grid-image-thumb').style.backgroundSize = 'contain';
            el.querySelector('.grid-image-thumb').style.backgroundRepeat = 'no-repeat';
            el.querySelector('.grid-image-thumb').style.backgroundPosition = 'center';
          }
        } catch (err) {
          logger.error('Failed to load picker thumbnail:', img.path, err);
        }
      };

      const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
          loadThumb();
          observer.disconnect();
          activeObservers.delete(observer);
        }
      });
      activeObservers.add(observer);
      observer.observe(el);

      el.addEventListener('click', () => {
        selectPickerImage(img.path);
      });

      elements.pickerImages.appendChild(el);
    }
  } catch (err) {
    logger.error('Failed to load picker images:', err);
    elements.pickerImages.innerHTML = '<p class="placeholder">Failed to load images</p>';
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
