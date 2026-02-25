// ============================================
// Preview Rendering
// ============================================

// Use secure API exposed via preload script
const api = window.api;
const { state } = require('../state');
const { getElements } = require('../elements');
const { logger } = require('../logger');
const { getEventDuration, selectEvent } = require('../events');
const { startDrag, highlightSelectedImage, findImagesAtPoint } = require('./drag');

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
  logger.time('renderPreviewAtFrame');
  logger.debug('renderPreviewAtFrame', { frame, eventsCount: state.events.length });

  const elements = getElements();
  const canvas = elements.previewCanvas;
  canvas.style.position = 'relative';
  canvas.innerHTML = '';

  // Re-create grid
  const newGrid = document.createElement('div');
  newGrid.id = 'preview-grid';
  newGrid.className = 'preview-grid' + (state.gridVisible ? ' visible' : '');
  canvas.appendChild(newGrid);

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

  // Render pictures
  const sortedPictures = Object.entries(pictureStates)
    .filter(([_, s]) => !s.erased && s.imageName)
    .sort((a, b) => parseInt(a[0]) - parseInt(b[0]));

  for (const [pictureNumber, pictureState] of sortedPictures) {
    const imgPath = await api.invoke('get-image-path', pictureState.imageName);
    if (!imgPath) {
      logger.warn('Image not found for picture #' + pictureNumber + ':', pictureState.imageName);
    } else {
      const img = document.createElement('img');
      img.className = 'preview-image';
      img.dataset.eventIndex = pictureState.eventIndex;
      img.dataset.pictureNumber = pictureNumber;
      img.src = imgPath;
      img.style.position = 'absolute';

      applyPictureState(img, pictureState);

      const showPictureEvt = state.events[pictureState.eventIndex];
      img.addEventListener('mousedown', (e) => startDrag(e, img, showPictureEvt, pictureState.eventIndex));
      img.addEventListener('click', (e) => {
        e.stopPropagation();
        if (pictureState.eventIndex === state.selectedEventIndex) {
          const clickedImages = findImagesAtPoint(e.clientX, e.clientY);
          if (clickedImages.length > 1) {
            const currentIdx = clickedImages.indexOf(pictureState.eventIndex);
            const nextIdx = (currentIdx + 1) % clickedImages.length;
            selectEvent(clickedImages[nextIdx]);
            highlightSelectedImage();
            const { renderTimeline } = require('../timeline/index');
            renderTimeline();
            return;
          }
        }
        selectEvent(pictureState.eventIndex);
        highlightSelectedImage();
        const { renderTimeline } = require('../timeline/index');
        renderTimeline();
      });

      canvas.appendChild(img);
    }
  }

  // Render text events
  for (const evt of state.events) {
    if (evt.type !== 'showText' || !evt.text) continue;
    const evtStart = evt.startFrame || 0;
    const evtEnd = evtStart + getEventDuration(evt.type, evt);
    if (frame < evtStart || frame > evtEnd) continue;

    const eventIndex = state.events.indexOf(evt);
    const textBox = document.createElement('div');
    textBox.className = 'preview-text';
    textBox.dataset.eventIndex = eventIndex;

    const positions = ['top', 'middle', 'bottom'];
    textBox.dataset.position = positions[evt.position] || 'bottom';

    const bgStyles = ['window', 'dim', 'transparent'];
    textBox.dataset.background = bgStyles[evt.background] || 'window';

    // Escape HTML to prevent XSS, then convert newlines to <br>
    const escapeHtml = (text) =>
      text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    const safeText = escapeHtml(evt.text || '').replace(/\n/g, '<br>');
    const waitHint = state.waitingForTextClick ? '<div class="text-continue-hint">▼ Click to continue</div>' : '';
    textBox.innerHTML = `<div class="preview-text-content">${safeText}${waitHint}</div>`;

    textBox.addEventListener('click', (e) => {
      e.stopPropagation();
      if (state.waitingForTextClick && state.isPlaying) {
        const { continueFromText } = require('../playback');
        continueFromText();
        return;
      }
      selectEvent(eventIndex);
      highlightSelectedImage();
      const { renderTimeline } = require('../timeline/index');
      renderTimeline();
    });

    if (state.waitingForTextClick) {
      textBox.classList.add('waiting');
    }

    canvas.appendChild(textBox);
  }

  highlightSelectedImage();
  logger.timeEnd('renderPreviewAtFrame');
}

module.exports = {
  getPreviewScale,
  resizePreviewCanvas,
  applyPictureState,
  renderPreviewAtFrame
};
