// src/modules/preview/image-browser.js
//
// Library renderer: flat list of images filtered by folder chips and a
// search box. The legacy recursive folder-tree was replaced with this
// flat + chip pattern in Plan B of the Director's Console redesign.
//
// DOM is constructed programmatically (createElement + textContent);
// no innerHTML to keep XSS surface zero and stay onside of the
// pre-commit security hook.

import { state } from '../state.js';
import { getElements } from '../elements.js';
import { saveState, markDirty } from '../undo-redo.js';
import { sortEvents } from '../utils.js';
import { createDefaultEvent, clearImageSelection, getEventDuration } from '../events.js';
import { logger } from '../logger.js';
import { eventBus, Events } from '../event-bus.js';

const api = window.api;

// ---------- Module-local state ----------

/** @type {IntersectionObserver | null} */
let thumbnailObserver = null;

/** @type {Array<any> | null} */
let _treeRoot = null;

/**
 * Flat snapshot of every image in the project, derived from the folder
 * tree on project load.
 * @type {Array<{ name: string; path: string; folder: string }>}
 */
let imageFlat = [];

/**
 * Top-level folder names (sorted), derived from the folder tree.
 * @type {string[]}
 */
let topFolders = [];

/**
 * Per-image usage counts (path -> N), derived from state.events.
 * @type {Map<string, number>}
 */
let usageCounts = new Map();

// ---------- Helpers ----------

function getThumbnailObserver() {
  if (thumbnailObserver) return thumbnailObserver;
  thumbnailObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          loadThumbnail(/** @type {HTMLElement} */ (entry.target));
          thumbnailObserver?.unobserve(entry.target);
        }
      }
    },
    { root: getElements().imageBrowser, rootMargin: '120px' }
  );
  return thumbnailObserver;
}

/**
 * Lazy-load a thumbnail into a `.lib-thumb-img` background-image.
 * The IPC channel `get-thumbnail` returns a base64 data URL.
 *
 * @param {HTMLElement} libItem
 */
async function loadThumbnail(libItem) {
  const path = libItem.dataset.path;
  if (!path) return;
  const thumbImg = /** @type {HTMLElement | null} */ (libItem.querySelector('.lib-thumb-img'));
  if (!thumbImg || libItem.dataset.thumbLoaded === '1') return;

  try {
    const url = await api.invoke('get-thumbnail', path);
    if (typeof url === 'string' && url.startsWith('data:image/png;base64,')) {
      thumbImg.style.backgroundImage = `url("${url}")`;
      libItem.dataset.thumbLoaded = '1';
    }
  } catch (err) {
    logger.warn('Thumbnail load failed for', path, err);
  }
}

/**
 * Walk the folder tree, returning a flat list of every leaf file.
 *
 * @param {Array<any>} items
 * @param {string} parent — running path prefix
 * @param {string} topFolder — top-level folder name (empty if root)
 * @returns {Array<{ name: string; path: string; folder: string }>}
 */
function flattenImageTree(items, parent = '', topFolder = '') {
  /** @type {Array<{ name: string; path: string; folder: string }>} */
  const out = [];
  for (const item of items) {
    if (item.type === 'folder') {
      const folderName = topFolder || item.name;
      const childPath = parent ? `${parent}/${item.name}` : item.name;
      if (item.children) {
        out.push(...flattenImageTree(item.children, childPath, folderName));
      } else {
        // Lazy folder: trigger load. When IMAGES_LOADED fires again the tree
        // will be flattened with this branch populated.
        api
          .invoke('get-folder-contents', item.path)
          .then((contents) => {
            if (contents && !contents.error) {
              item.children = contents;
              eventBus.emit(Events.IMAGES_LOADED);
            }
          })
          .catch((err) => logger.warn('Lazy folder load failed', item.path, err));
      }
    } else if (item.type === 'file') {
      out.push({ name: item.name, path: item.path, folder: topFolder });
    }
  }
  return out;
}

/**
 * Recompute per-image usage counts from state.events.
 */
function computeImageUsage() {
  /** @type {Map<string, number>} */
  const m = new Map();
  for (const ev of state.events) {
    if (ev.type === 'showPicture' && ev.imageName) {
      m.set(ev.imageName, (m.get(ev.imageName) || 0) + 1);
    }
  }
  usageCounts = m;
}

// ---------- Renderers ----------

function renderFolderChips() {
  const els = getElements();
  const container = els.libraryFolders;
  const active = state.libraryActiveFolder;

  /** @type {Map<string, number>} */
  const counts = new Map();
  counts.set('__all__', imageFlat.length);
  for (const f of topFolders) {
    counts.set(f, imageFlat.filter((it) => it.folder === f).length);
  }

  while (container.firstChild) container.removeChild(container.firstChild);

  container.appendChild(makeChip('All', null, counts.get('__all__') || 0, active === null));
  for (const folder of topFolders) {
    container.appendChild(makeChip(folder, folder, counts.get(folder) || 0, active === folder));
  }
}

/**
 * @param {string} label
 * @param {string | null} folderValue
 * @param {number} count
 * @param {boolean} isActive
 * @returns {HTMLButtonElement}
 */
function makeChip(label, folderValue, count, isActive) {
  const chip = document.createElement('button');
  chip.type = 'button';
  chip.className = `folder-chip${isActive ? ' is-active' : ''}`;
  chip.setAttribute('role', 'tab');
  chip.setAttribute('aria-selected', String(isActive));

  chip.appendChild(document.createTextNode(label));

  const countSpan = document.createElement('span');
  countSpan.className = 'count';
  countSpan.textContent = String(count);
  chip.appendChild(countSpan);

  chip.addEventListener('click', () => {
    state.libraryActiveFolder = folderValue;
    renderFolderChips();
    renderLibraryList();
  });

  return chip;
}

function renderLibraryList() {
  const els = getElements();
  const list = els.imageBrowser;
  const searchInput = /** @type {HTMLInputElement} */ (els.imageSearch);

  const query = (searchInput.value || '').toLowerCase();
  const folder = state.libraryActiveFolder;

  computeImageUsage();

  if (thumbnailObserver) {
    thumbnailObserver.disconnect();
    thumbnailObserver = null;
  }

  while (list.firstChild) list.removeChild(list.firstChild);
  let visibleCount = 0;

  for (const item of imageFlat) {
    if (folder !== null && item.folder !== folder) continue;
    if (query && !item.name.toLowerCase().includes(query) && !item.path.toLowerCase().includes(query)) continue;

    const usage = usageCounts.get(item.path) || 0;
    list.appendChild(buildLibItem(item, usage));
    visibleCount++;
  }

  els.libraryCount.textContent = String(visibleCount);

  if (visibleCount === 0) {
    const empty = document.createElement('div');
    empty.className = 'placeholder';
    empty.textContent = imageFlat.length === 0 ? 'No images in project' : 'No matches';
    list.appendChild(empty);
  }
}

/**
 * @param {{ name: string; path: string; folder: string }} item
 * @param {number} usage
 * @returns {HTMLDivElement}
 */
function buildLibItem(item, usage) {
  const el = document.createElement('div');
  el.className = 'lib-item';
  el.dataset.path = item.path;
  el.draggable = true;

  const thumb = document.createElement('div');
  thumb.className = 'lib-thumb';
  const thumbImg = document.createElement('div');
  thumbImg.className = 'lib-thumb-img';
  thumb.appendChild(thumbImg);

  const meta = document.createElement('div');
  meta.className = 'lib-meta';

  const name = document.createElement('div');
  name.className = 'lib-name';
  name.textContent = item.name;
  meta.appendChild(name);

  const info = document.createElement('div');
  info.className = 'lib-info';
  if (usage > 0) {
    const used = document.createElement('span');
    used.className = 'used';
    used.textContent = `used \xd7${usage}`;
    info.appendChild(used);
  } else {
    const folderSpan = document.createElement('span');
    folderSpan.textContent = item.folder || '/';
    info.appendChild(folderSpan);
  }
  meta.appendChild(info);

  el.appendChild(thumb);
  el.appendChild(meta);

  getThumbnailObserver().observe(el);

  el.addEventListener('click', (e) => handleImageClick(el, item.path, e));
  el.addEventListener('dblclick', () => addSelectedImagesAsEvents());
  el.addEventListener('dragstart', (e) => {
    e.dataTransfer?.setData('text/plain', item.path);
    e.dataTransfer?.setData('application/x-mzscene-image', item.path);
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'copy';
  });

  return el;
}

// ---------- Selection ----------

/**
 * @param {HTMLElement} el
 * @param {string} path
 * @param {MouseEvent} e
 */
function handleImageClick(el, path, e) {
  const isMulti = e.ctrlKey || e.metaKey || e.shiftKey;
  if (!isMulti) state.selectedImages.clear();
  if (state.selectedImages.has(path)) {
    state.selectedImages.delete(path);
    el.classList.remove('is-active');
  } else {
    state.selectedImages.add(path);
    el.classList.add('is-active');
  }
  state.lastClickedImage = path;
  if (!isMulti) {
    const list = getElements().imageBrowser;
    for (const other of list.querySelectorAll('.lib-item.is-active')) {
      if (other !== el) other.classList.remove('is-active');
    }
  }
}

function addSelectedImagesAsEvents() {
  if (state.selectedImages.size === 0) return;

  const elements = getElements();
  const allItems = Array.from(elements.imageBrowser.querySelectorAll('.lib-item'));
  const orderedPaths = allItems
    .filter((item) => state.selectedImages.has(item.dataset.path))
    .map((item) => item.dataset.path);

  if (orderedPaths.length === 0) return;

  saveState('add pictures');

  const FRAME_SPACING = 30;

  // Find the end of existing showPicture events and reuse their picture number
  const existingPictures = state.events.filter((e) => e.type === 'showPicture');
  let startFrame;
  let pictureNumber;

  if (existingPictures.length > 0) {
    // Find the latest end frame among existing pictures
    const lastEndFrame = Math.max(...existingPictures.map((e) => (e.startFrame || 0) + getEventDuration(e.type, e)));
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

// ---------- Public API ----------

/**
 * @param {HTMLElement} _container — kept for API compat; ignored
 * @param {Array<any>} items — folder/file tree
 */
function renderFolderTree(_container, items) {
  _treeRoot = items;
  imageFlat = flattenImageTree(items);
  topFolders = Array.from(new Set(imageFlat.map((it) => it.folder).filter(Boolean))).sort();
  state.libraryActiveFolder = null;
  renderFolderChips();
  renderLibraryList();
  eventBus.emit(Events.IMAGES_LOADED);
}

function filterImages() {
  renderLibraryList();
}

/**
 * @param {string} path
 */
function expandToPath(path) {
  const item = imageFlat.find((it) => it.path === path);
  if (!item) return;

  if (item.folder && state.libraryActiveFolder !== item.folder) {
    state.libraryActiveFolder = item.folder;
    renderFolderChips();
    renderLibraryList();
  }

  const els = getElements();
  const target = /** @type {HTMLElement | null} */ (
    els.imageBrowser.querySelector(`.lib-item[data-path="${CSS.escape(path)}"]`)
  );
  if (target) {
    target.scrollIntoView({ block: 'center', behavior: 'smooth' });
    target.classList.add('is-flash');
    setTimeout(() => target.classList.remove('is-flash'), 800);
  }
}

// ---------- Wiring ----------

eventBus.on(Events.RENDER_TIMELINE, () => {
  if (imageFlat.length > 0) renderLibraryList();
});

eventBus.on(Events.IMAGES_LOADED, () => {
  if (!_treeRoot) return;
  imageFlat = flattenImageTree(_treeRoot);
  topFolders = Array.from(new Set(imageFlat.map((it) => it.folder).filter(Boolean))).sort();
  renderFolderChips();
  renderLibraryList();
});

export {
  renderFolderTree,
  filterImages,
  expandToPath,
  addSelectedImagesAsEvents,
  handleImageClick,
  loadThumbnail,
  getThumbnailObserver
};
