// ============================================
// Image Browser (Left Panel)
// ============================================

// Use secure API exposed via preload script
const api = window.api;
import { state } from '../state.js';
import { getElements } from '../elements.js';
import { saveState, markDirty } from '../undo-redo.js';
import { sortEvents } from '../utils.js';
import { createDefaultEvent, clearImageSelection } from '../events.js';
import { eventBus, Events } from '../event-bus.js';
import { logger } from '../logger.js';

// IntersectionObserver for lazy-loading thumbnails when visible
let thumbnailObserver = null;
function getThumbnailObserver() {
  if (!thumbnailObserver) {
    thumbnailObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const el = entry.target;
            if (!el.dataset.thumbLoaded) {
              el.dataset.thumbLoaded = 'true';
              loadThumbnail(el, el.dataset.path);
            }
            thumbnailObserver.unobserve(el);
          }
        });
      },
      { rootMargin: '100px' }
    ); // Load slightly before visible
  }
  return thumbnailObserver;
}

async function loadThumbnail(el, path) {
  try {
    const thumb = await api.invoke('get-thumbnail', path);
    if (thumb) {
      const thumbEl = el.querySelector('.image-thumb');
      thumbEl.style.backgroundImage = `url(${thumb})`;
      thumbEl.style.backgroundSize = 'contain';
      thumbEl.style.backgroundRepeat = 'no-repeat';
      thumbEl.style.backgroundPosition = 'center';
    }
  } catch (err) {
    logger.error('Failed to load thumbnail:', path, err);
  }
}

function renderFolderTree(container, items, isRoot = true) {
  if (isRoot) {
    container.innerHTML = '';
  }

  for (const item of items) {
    if (item.type === 'folder') {
      const folderEl = document.createElement('div');
      folderEl.className = 'folder-item';
      folderEl.innerHTML = `
        <div class="folder-header">
          <span class="folder-icon">📁</span>
          <span class="folder-name">${item.name}</span>
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
          const contents = await api.invoke('get-folder-contents', item.path);
          children.innerHTML = '';
          if (contents && !contents.error) {
            item.children = contents;
            renderFolderTree(children, contents, false);
          } else {
            logger.warn('Failed to load folder:', item.path, contents?.error);
          }
          folderEl.dataset.loading = '';
        }
      });

      if (item.children) {
        renderFolderTree(children, item.children, false);
      }

      container.appendChild(folderEl);
    } else if (item.type === 'file') {
      container.appendChild(createImageItem(item));
    }
  }
}

function createImageItem(item) {
  const el = document.createElement('div');
  el.className = 'image-item';
  el.dataset.path = item.path;
  el.innerHTML = `
    <div class="image-thumb" style="background: var(--bg-input);"></div>
    <span class="image-name">${item.name}</span>
  `;

  // Observe for visibility-based thumbnail loading
  getThumbnailObserver().observe(el);

  el.addEventListener('click', (e) => {
    handleImageClick(el, item.path, e);
  });

  el.addEventListener('dblclick', () => {
    addSelectedImagesAsEvents();
  });

  return el;
}

function handleImageClick(el, path, e) {
  const elements = getElements();

  if (e.ctrlKey || e.metaKey) {
    if (state.selectedImages.has(path)) {
      state.selectedImages.delete(path);
      el.classList.remove('selected');
    } else {
      state.selectedImages.add(path);
      el.classList.add('selected');
    }
  } else if (e.shiftKey && state.lastClickedImage) {
    const allItems = Array.from(elements.imageBrowser.querySelectorAll('.image-item'));
    const startIndex = allItems.findIndex((item) => item.dataset.path === state.lastClickedImage);
    const endIndex = allItems.findIndex((item) => item.dataset.path === path);

    if (startIndex !== -1 && endIndex !== -1) {
      const min = Math.min(startIndex, endIndex);
      const max = Math.max(startIndex, endIndex);

      for (let i = min; i <= max; i++) {
        const itemPath = allItems[i].dataset.path;
        state.selectedImages.add(itemPath);
        allItems[i].classList.add('selected');
      }
    }
  } else {
    clearImageSelection();
    state.selectedImages.add(path);
    el.classList.add('selected');
  }

  state.lastClickedImage = path;
}

function addSelectedImagesAsEvents() {
  if (state.selectedImages.size === 0) return;

  const elements = getElements();
  const allItems = Array.from(elements.imageBrowser.querySelectorAll('.image-item'));
  const orderedPaths = allItems
    .filter((item) => state.selectedImages.has(item.dataset.path))
    .map((item) => item.dataset.path);

  if (orderedPaths.length === 0) return;

  saveState('add pictures');

  const FRAME_SPACING = 30;
  const DEFAULT_DURATION = 30;

  // Find the end of existing showPicture events and reuse their picture number
  const existingPictures = state.events.filter((e) => e.type === 'showPicture');
  let startFrame;
  let pictureNumber;

  if (existingPictures.length > 0) {
    // Find the latest end frame among existing pictures
    const lastEndFrame = Math.max(
      ...existingPictures.map((e) => (e.startFrame || 0) + (e.duration || DEFAULT_DURATION))
    );
    startFrame = lastEndFrame;
    // Reuse the picture number from the last picture (sequential images can share a slot)
    pictureNumber = existingPictures[existingPictures.length - 1].pictureNumber || 1;
  } else {
    startFrame = state.currentFrame;
    pictureNumber = 1;
  }

  logger.debug('Inserting', orderedPaths.length, 'images at frame', startFrame);

  const addedEvents = [];
  orderedPaths.forEach((imagePath, index) => {
    const evt = createDefaultEvent('showPicture');
    evt.pictureNumber = pictureNumber;
    evt.imageName = imagePath;
    evt.startFrame = startFrame + index * FRAME_SPACING;
    state.events.push(evt);
    addedEvents.push(evt);
  });

  sortEvents(state.events);

  if (addedEvents.length > 0) {
    state.selectedEventIndex = state.events.indexOf(addedEvents[0]);
    // Jump playhead to the first added image so it shows in preview
    state.currentFrame = addedEvents[0].startFrame;
  }

  clearImageSelection();
  markDirty();
  eventBus.emit(Events.RENDER);
}

function filterImages() {
  const elements = getElements();
  const query = elements.imageSearch.value.toLowerCase();
  const items = elements.imageBrowser.querySelectorAll('.image-item');
  const folders = elements.imageBrowser.querySelectorAll('.folder-item');

  if (!query) {
    items.forEach((item) => (item.style.display = ''));
    folders.forEach((folder) => (folder.style.display = ''));

    folders.forEach((folder) => {
      folder.classList.remove('expanded');
      const icon = folder.querySelector('.folder-icon');
      if (icon) icon.textContent = '📁';
    });

    const selectedEvent = state.events[state.selectedEventIndex];
    if (selectedEvent && selectedEvent.type === 'showPicture' && selectedEvent.imageName) {
      expandToPath(selectedEvent.imageName);
    }
    return;
  }

  items.forEach((item) => {
    const name = item.querySelector('.image-name').textContent.toLowerCase();
    item.style.display = name.includes(query) ? '' : 'none';
  });

  folders.forEach((folder) => {
    const hasVisible = Array.from(folder.querySelectorAll('.image-item')).some((item) => item.style.display !== 'none');
    folder.style.display = hasVisible ? '' : 'none';
    if (hasVisible) {
      folder.classList.add('expanded');
      const icon = folder.querySelector('.folder-icon');
      if (icon) icon.textContent = '📂';
    }
  });
}

function expandToPath(imagePath) {
  if (!imagePath) return;

  const elements = getElements();
  const pathParts = imagePath.split('/');
  pathParts.pop();

  let currentPath = '';
  for (const part of pathParts) {
    currentPath = currentPath ? `${currentPath}/${part}` : part;

    const folders = elements.imageBrowser.querySelectorAll('.folder-item');
    for (const folder of folders) {
      const folderName = folder.querySelector('.folder-name');
      if (folderName && folderName.textContent === part) {
        folder.classList.add('expanded');
        const icon = folder.querySelector('.folder-icon');
        if (icon) icon.textContent = '📂';
      }
    }
  }
}

export {
  renderFolderTree,
  createImageItem,
  handleImageClick,
  addSelectedImagesAsEvents,
  filterImages,
  expandToPath
};
