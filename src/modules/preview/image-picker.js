// ============================================
// Image Picker Modal
// ============================================

// Use secure API exposed via preload script
const api = window.api;
const { state } = require('../state');
const { getElements } = require('../elements');
const { eventBus, Events } = require('../event-bus');

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
}

function renderPickerFolders(items, container = null) {
  const elements = getElements();
  if (!container) container = elements.pickerFolders;

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
        const wasExpanded = folderEl.classList.contains('expanded');
        folderEl.classList.toggle('expanded');
        header.querySelector('.folder-icon').textContent = wasExpanded ? '📁' : '📂';

        if (!wasExpanded && item.children === null) {
          children.innerHTML = '<p class="placeholder">Loading...</p>';
          const contents = await api.invoke('get-folder-contents', item.path);
          children.innerHTML = '';
          if (contents && !contents.error) {
            item.children = contents;
            renderPickerFolders(contents.filter(c => c.type === 'folder'), children);
          }
        }

        await loadPickerImages(item.path);
      });

      if (item.children) {
        renderPickerFolders(item.children.filter(c => c.type === 'folder'), children);
      }

      container.appendChild(folderEl);
    }
  }
}

async function loadPickerImages(folderPath) {
  const elements = getElements();
  elements.pickerImages.innerHTML = '<p class="placeholder">Loading...</p>';

  const contents = await api.invoke('get-folder-contents', folderPath);
  if (!contents || contents.error) {
    elements.pickerImages.innerHTML = '<p class="placeholder">No images found</p>';
    return;
  }

  const images = contents.filter(item => item.type === 'file');
  if (images.length === 0) {
    elements.pickerImages.innerHTML = '<p class="placeholder">No images in this folder</p>';
    return;
  }

  elements.pickerImages.innerHTML = '';

  for (const img of images) {
    const el = document.createElement('div');
    el.className = 'grid-image-item';
    el.innerHTML = `
      <div class="grid-image-thumb" data-path="${img.path}"></div>
      <div class="grid-image-name">${img.name}</div>
    `;

    const loadThumb = async () => {
      const thumb = await api.invoke('get-thumbnail', img.path);
      if (thumb) {
        el.querySelector('.grid-image-thumb').style.backgroundImage = `url(${thumb})`;
        el.querySelector('.grid-image-thumb').style.backgroundSize = 'contain';
        el.querySelector('.grid-image-thumb').style.backgroundRepeat = 'no-repeat';
        el.querySelector('.grid-image-thumb').style.backgroundPosition = 'center';
      }
    };

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        loadThumb();
        observer.disconnect();
      }
    });
    observer.observe(el);

    el.addEventListener('click', () => {
      selectPickerImage(img.path);
    });

    elements.pickerImages.appendChild(el);
  }
}

function selectPickerImage(imagePath) {
  if (state.selectedEventIndex >= 0 && state.events[state.selectedEventIndex].type === 'showPicture') {
    state.events[state.selectedEventIndex].imageName = imagePath;
    eventBus.emit(Events.RENDER);
  }
  closeImagePicker();
}

// Export openImagePicker to window for dynamic template in properties/picture.js
window.openImagePicker = openImagePicker;

module.exports = {
  openImagePicker,
  closeImagePicker,
  renderPickerFolders,
  loadPickerImages,
  selectPickerImage
};
