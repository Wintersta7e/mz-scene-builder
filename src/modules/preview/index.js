// ============================================
// Preview Rendering
// ============================================

// Use secure API exposed via preload script
const api = window.api;
import { state } from '../state.js';
import { getElements } from '../elements.js';
import { logger } from '../logger.js';
import { eventBus, Events } from '../event-bus.js';
import { getEventDuration, selectEvent } from '../events.js';
import { startDrag, highlightSelectedImage, findImagesAtPoint } from './drag.js';
import { renderTimeline } from '../timeline/index.js';
import { continueFromText } from '../playback.js';

// Image path cache — cleared on project change
const imagePathCache = new Map();

function clearImagePathCache() {
  imagePathCache.clear();
}

eventBus.on(Events.PROJECT_LOADED, clearImagePathCache);

function getPreviewScale() {
  const elements = getElements();
  return elements.previewCanvas.offsetWidth / state.screenWidth;
}

function resizePreviewCanvas() {
  const elements = getElements();
  const container = document.querySelector('.preview-container');
  const canvas = elements.previewCanvas;
  if (!container || !canvas) return;

  logger.debug('Canvas resize:', container.clientWidth, 'x', container.clientHeight);

  const availWidth = container.clientWidth - 40;
  const availHeight = container.clientHeight - 40;

  if (availWidth <= 0 || availHeight <= 0) return;

  const gameAspect = state.screenWidth / state.screenHeight;

  let canvasWidth, canvasHeight;
  if (availWidth / availHeight > gameAspect) {
    canvasHeight = availHeight;
    canvasWidth = canvasHeight * gameAspect;
  } else {
    canvasWidth = availWidth;
    canvasHeight = canvasWidth / gameAspect;
  }

  canvas.style.width = `${canvasWidth}px`;
  canvas.style.height = `${canvasHeight}px`;
  canvas.style.position = 'relative';

  renderPreviewAtFrame(state.currentFrame);
}

function applyPictureState(img, pictureState) {
  const scale = getPreviewScale();
  const x = pictureState.x * scale;
  const y = pictureState.y * scale;
  const scaleX = (pictureState.scaleX / 100) * scale;
  const scaleY = (pictureState.scaleY / 100) * scale;

  img.style.position = 'absolute';
  img.style.left = x + 'px';
  img.style.top = y + 'px';

  const rotation = pictureState.rotation !== 0 ? ` rotate(${pictureState.rotation}deg)` : '';
  img.style.transform = `scale(${scaleX}, ${scaleY})${rotation}`;
  img.style.transformOrigin = pictureState.origin === 1 ? 'center' : 'top left';

  img.style.opacity = pictureState.opacity / 255;
  img.style.mixBlendMode = ['normal', 'lighten', 'multiply', 'screen'][pictureState.blend] || 'normal';
  img.style.pointerEvents = 'auto';
  img.style.cursor = 'pointer';
  img.style.zIndex = '1';

  // Apply tint
  const tint = pictureState.tint;
  const filters = [];

  if (tint.r !== 0 || tint.g !== 0 || tint.b !== 0 || tint.gray !== 0) {
    const avgRgb = (tint.r + tint.g + tint.b) / 3;
    const brightness = 1 + avgRgb / 255;
    filters.push(`brightness(${brightness.toFixed(2)})`);

    if (tint.gray > 0) {
      const grayscale = tint.gray / 255;
      filters.push(`grayscale(${grayscale.toFixed(2)})`);
    }

    const maxColor = Math.max(tint.r, tint.g, tint.b);
    const minColor = Math.min(tint.r, tint.g, tint.b);

    if (maxColor > 20 || minColor < -20) {
      let hueShift = 0;
      if (tint.r > tint.g && tint.r > tint.b) {
        hueShift = -15;
      } else if (tint.b > tint.r && tint.b > tint.g) {
        hueShift = 180;
      } else if (tint.g > tint.r && tint.g > tint.b) {
        hueShift = 90;
      }

      const sepiaAmount = (Math.abs(maxColor - minColor) / 255) * 0.5;
      if (sepiaAmount > 0.05) {
        filters.push(`sepia(${sepiaAmount.toFixed(2)})`);
        filters.push(`hue-rotate(${hueShift}deg)`);
      }

      const saturation = 1 + (Math.abs(maxColor - minColor) / 255) * 0.5;
      filters.push(`saturate(${saturation.toFixed(2)})`);
    }

    if (minColor < -50) {
      const contrast = 1 + (minColor / 255) * 0.5;
      filters.push(`contrast(${Math.max(0.3, contrast).toFixed(2)})`);
    }

    img.style.filter = filters.join(' ');
    logger.debug('Applied tint filter:', filters.join(' '), 'for tint:', tint);
  } else {
    img.style.filter = '';
  }

  if (pictureState.rotationSpeed !== 0) {
    img.classList.add('rotating');
    img.style.setProperty('--rotation-speed', `${Math.abs(pictureState.rotationSpeed) * 0.1}s`);
    img.style.setProperty('--rotation-direction', pictureState.rotationSpeed > 0 ? 'normal' : 'reverse');
  }
}

async function renderPreviewAtFrame(frame) {
  try {
    logger.time('renderPreviewAtFrame');
    logger.debug('renderPreviewAtFrame', { frame, eventsCount: state.events.length });

    const elements = getElements();
    const canvas = elements.previewCanvas;
    canvas.style.position = 'relative';

    // Ensure grid element exists and is stable (don't recreate every frame)
    let gridEl = canvas.querySelector('#preview-grid');
    if (!gridEl) {
      gridEl = document.createElement('div');
      gridEl.id = 'preview-grid';
      canvas.insertBefore(gridEl, canvas.firstChild);
    }
    gridEl.className = 'preview-grid' + (state.gridVisible ? ' visible' : '');

    // Build picture states
    const pictureStates = {};

    for (const evt of state.events) {
      const evtStart = evt.startFrame || 0;
      if (evtStart > frame) continue;

      switch (evt.type) {
        case 'showPicture':
          pictureStates[evt.pictureNumber] = {
            eventIndex: state.events.indexOf(evt),
            imageName: evt.imageName,
            origin: evt.origin,
            x: evt.x,
            y: evt.y,
            scaleX: evt.scaleX,
            scaleY: evt.scaleY,
            opacity: evt.opacity,
            blend: evt.blend,
            tint: { r: 0, g: 0, b: 0, gray: 0 },
            rotation: 0,
            rotationSpeed: 0,
            erased: false
          };
          break;

        case 'movePicture':
          if (pictureStates[evt.pictureNumber]) {
            const s = pictureStates[evt.pictureNumber];
            s.origin = evt.origin;
            s.x = evt.x;
            s.y = evt.y;
            s.scaleX = evt.scaleX;
            s.scaleY = evt.scaleY;
            s.opacity = evt.opacity;
            s.blend = evt.blend;
          }
          break;

        case 'tintPicture':
          if (pictureStates[evt.pictureNumber]) {
            pictureStates[evt.pictureNumber].tint = {
              r: evt.red,
              g: evt.green,
              b: evt.blue,
              gray: evt.gray
            };
          }
          break;

        case 'rotatePicture':
          if (pictureStates[evt.pictureNumber]) {
            pictureStates[evt.pictureNumber].rotationSpeed = evt.speed;
            pictureStates[evt.pictureNumber].rotation = evt.speed !== 0 ? (evt.speed > 0 ? 15 : -15) : 0;
          }
          break;

        case 'erasePicture':
          if (pictureStates[evt.pictureNumber]) {
            pictureStates[evt.pictureNumber].erased = true;
          }
          break;
      }
    }

    // Filter and sort active pictures
    const sortedPictures = Object.entries(pictureStates)
      .filter(([_, s]) => !s.erased && s.imageName)
      .sort((a, b) => parseInt(a[0]) - parseInt(b[0]));

    // Fetch image paths in parallel using cache
    const pathResults = await Promise.all(
      sortedPictures.map(async ([_num, ps]) => {
        if (imagePathCache.has(ps.imageName)) {
          return imagePathCache.get(ps.imageName);
        }
        const resolved = await api.invoke('get-image-path', ps.imageName);
        if (resolved) imagePathCache.set(ps.imageName, resolved);
        return resolved;
      })
    );

    // Collect existing picture elements for DOM reuse
    const existingImages = new Map();
    canvas.querySelectorAll('.preview-image').forEach((el) => {
      existingImages.set(el.dataset.pictureNumber, el);
    });

    // Track which picture numbers are active this frame
    const activePictureNumbers = new Set();

    // Render pictures (reuse DOM elements where possible)
    for (let i = 0; i < sortedPictures.length; i++) {
      const [pictureNumber, pictureState] = sortedPictures[i];
      const imgPath = pathResults[i];

      if (!imgPath) {
        logger.warn('Image not found for picture #' + pictureNumber + ':', pictureState.imageName);
        continue;
      }

      activePictureNumbers.add(pictureNumber);
      let img = existingImages.get(pictureNumber);

      if (img) {
        // Reuse existing element — update src only if changed
        if (img.src !== imgPath) {
          img.src = imgPath;
        }
        img.dataset.eventIndex = pictureState.eventIndex;
        existingImages.delete(pictureNumber);
      } else {
        // Create new element
        img = document.createElement('img');
        img.className = 'preview-image';
        img.dataset.eventIndex = pictureState.eventIndex;
        img.dataset.pictureNumber = pictureNumber;
        img.src = imgPath;
        img.style.position = 'absolute';
        canvas.appendChild(img);
      }

      applyPictureState(img, pictureState);

      // Re-bind event listeners (cheap operation, ensures correct closure values)
      const clonedImg = img;
      const evtIdx = pictureState.eventIndex;
      clonedImg.onmousedown = (e) => startDrag(e, clonedImg, state.events[evtIdx], evtIdx);
      clonedImg.onclick = (e) => {
        e.stopPropagation();
        if (evtIdx === state.selectedEventIndex) {
          const clickedImages = findImagesAtPoint(e.clientX, e.clientY);
          if (clickedImages.length > 1) {
            const currentIdx = clickedImages.indexOf(evtIdx);
            const nextIdx = (currentIdx + 1) % clickedImages.length;
            selectEvent(clickedImages[nextIdx]);
            highlightSelectedImage();
            renderTimeline();
            return;
          }
        }
        selectEvent(evtIdx);
        highlightSelectedImage();
        renderTimeline();
      };
    }

    // Remove stale picture elements no longer in this frame
    existingImages.forEach((el) => el.remove());

    // Collect existing text elements for DOM reuse
    const existingTexts = new Map();
    canvas.querySelectorAll('.preview-text').forEach((el) => {
      existingTexts.set(el.dataset.eventIndex, el);
    });

    // Escape HTML to prevent XSS
    const escapeHtml = (text) =>
      text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

    // Render text events (reuse DOM elements where possible)
    for (const evt of state.events) {
      if (evt.type !== 'showText' || !evt.text) continue;
      const evtStart = evt.startFrame || 0;
      const evtEnd = evtStart + getEventDuration(evt.type, evt);
      if (frame < evtStart || frame > evtEnd) continue;

      const eventIndex = String(state.events.indexOf(evt));

      const safeText = escapeHtml(evt.text || '').replace(/\n/g, '<br>');
      const waitHint = state.waitingForTextClick ? '<div class="text-continue-hint">▼ Click to continue</div>' : '';
      const contentHtml = `<div class="preview-text-content">${safeText}${waitHint}</div>`;

      const positions = ['top', 'middle', 'bottom'];
      const bgStyles = ['window', 'dim', 'transparent'];

      let textBox = existingTexts.get(eventIndex);
      if (textBox) {
        // Reuse — update content and attributes
        textBox.innerHTML = contentHtml;
        textBox.dataset.position = positions[evt.position] || 'bottom';
        textBox.dataset.background = bgStyles[evt.background] || 'window';
        existingTexts.delete(eventIndex);
      } else {
        // Create new
        textBox = document.createElement('div');
        textBox.className = 'preview-text';
        textBox.dataset.eventIndex = eventIndex;
        textBox.dataset.position = positions[evt.position] || 'bottom';
        textBox.dataset.background = bgStyles[evt.background] || 'window';
        textBox.innerHTML = contentHtml;
        canvas.appendChild(textBox);
      }

      const evtIdx = parseInt(eventIndex);
      textBox.onclick = (e) => {
        e.stopPropagation();
        if (state.waitingForTextClick && state.isPlaying) {
          continueFromText();
          return;
        }
        selectEvent(evtIdx);
        highlightSelectedImage();
        renderTimeline();
      };

      if (state.waitingForTextClick) {
        textBox.classList.add('waiting');
      } else {
        textBox.classList.remove('waiting');
      }
    }

    // Remove stale text elements
    existingTexts.forEach((el) => el.remove());

    highlightSelectedImage();
    logger.timeEnd('renderPreviewAtFrame');
  } catch (err) {
    logger.error('Failed to render preview:', err);
  }
}

export {
  getPreviewScale,
  resizePreviewCanvas,
  applyPictureState,
  renderPreviewAtFrame,
  clearImagePathCache
};
