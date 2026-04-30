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
import { renderProperties } from '../properties/index.js';
import { continueFromText } from '../playback.js';

// Image path cache — cleared on project change, capped to prevent unbounded growth
const IMAGE_PATH_CACHE_MAX = 500;
const imagePathCache = new Map();
let _renderInFlight = false;
let _pendingFrame = null;

function clearImagePathCache() {
  imagePathCache.clear();
}

eventBus.on(Events.PROJECT_LOADED, clearImagePathCache);

/**
 * Format a 60fps frame index as MM:SS.
 * @param {number} frame
 * @returns {string}
 */
function formatT(frame) {
  const totalSec = Math.max(0, Math.floor(frame / 60));
  const mm = String(Math.floor(totalSec / 60)).padStart(2, '0');
  const ss = String(totalSec % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

/**
 * Push the current frame, scene name, and playback state into the slate
 * cells + REC indicator. Cheap; safe to call every render.
 * @param {number} frame
 */
function updateSlateAndRec(frame) {
  const els = getElements();

  const scene = state.currentScenePath
    ? state.currentScenePath
        .split(/[\\/]/)
        .pop()
        ?.replace(/\.mzscene$/i, '') || 'Untitled'
    : 'Untitled';
  if (els.slateScene.textContent !== scene) els.slateScene.textContent = scene;

  const t = formatT(frame);
  if (els.slateTime.textContent !== t) els.slateTime.textContent = t;

  const f = String(frame).padStart(4, '0');
  if (els.slateFrame.textContent !== f) els.slateFrame.textContent = f;

  els.stageRec.classList.toggle('is-playing', state.isPlaying);
  const newRecLabel = state.isPlaying ? 'Live' : 'Idle';
  if (els.stageRecLabel.textContent !== newRecLabel) {
    els.stageRecLabel.textContent = newRecLabel;
  }
}

/**
 * Compute and apply the flash overlay opacity for the given frame.
 * Looks for a screenFlash event whose [start, start+duration] window
 * contains the frame; uses opacity = (1 - progress) * intensity/100.
 * @param {number} frame
 */
function updateFlashOverlay(frame) {
  const els = getElements();
  const flashEl = els.stageFlash;

  /** @type {any} */
  let active = null;
  for (const ev of state.events) {
    if (ev.type !== 'screenFlash') continue;
    const start = ev.startFrame ?? 0;
    const dur = ev.duration ?? 30;
    if (frame >= start && frame < start + dur) {
      active = ev;
      break;
    }
  }

  if (!active) {
    flashEl.style.opacity = '0';
    return;
  }

  const start = active.startFrame ?? 0;
  const dur = Math.max(1, active.duration ?? 30);
  const progress = Math.min(1, Math.max(0, (frame - start) / dur));
  const intensity = (active.intensity ?? 170) / 255;
  flashEl.style.opacity = String((1 - progress) * intensity);

  // Compose flash color from MZ-native RGB. Falls back to white if no fields set.
  const r = active.red ?? 255;
  const g = active.green ?? 255;
  const b = active.blue ?? 255;
  flashEl.style.background = `rgb(${r}, ${g}, ${b})`;
}

/**
 * Toggle the grid overlay visibility on the stage frame.
 */
function updateGridVisibility() {
  const gridEl = document.getElementById('preview-grid');
  if (gridEl) gridEl.classList.toggle('visible', state.gridVisible);
}

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

/**
 * Apply a picture's computed state (x/y/scale/opacity/etc.) to a
 * `.stage-pic` IMG element. Position is percent-of-frame so the new
 * CSS Grid layout drives the visible size — no manual scale factor
 * needed.
 *
 * @param {HTMLImageElement} img
 * @param {any} pictureState — accumulated state from showPicture +
 *   subsequent move/tint/rotate/erase events. Carries x, y (MZ-native
 *   pixels relative to state.screenWidth/Height), scaleX/scaleY (pct),
 *   opacity (0–255), blend (0–3), origin (0=top-left, 1=center),
 *   rotation, rotationSpeed, tint { r, g, b, gray }.
 */
function applyPictureState(img, pictureState) {
  const xPct = (pictureState.x / state.screenWidth) * 100;
  const yPct = (pictureState.y / state.screenHeight) * 100;

  img.style.position = 'absolute';
  img.style.left = `${xPct}%`;
  img.style.top = `${yPct}%`;

  const scaleX = pictureState.scaleX / 100;
  const scaleY = pictureState.scaleY / 100;
  const rotation = pictureState.rotation !== 0 ? ` rotate(${pictureState.rotation}deg)` : '';
  img.style.transform = `scale(${scaleX}, ${scaleY})${rotation}`;
  img.style.transformOrigin = pictureState.origin === 1 ? 'center' : 'top left';

  img.style.opacity = String(pictureState.opacity / 255);
  img.style.mixBlendMode = ['normal', 'lighten', 'multiply', 'screen'][pictureState.blend] || 'normal';
  img.style.pointerEvents = 'auto';
  img.style.cursor = 'pointer';
  img.style.zIndex = '1';

  applyTintFilter(img, pictureState.tint);

  if (pictureState.rotationSpeed !== 0) {
    img.classList.add('rotating');
    img.style.setProperty('--rotation-speed', `${Math.abs(pictureState.rotationSpeed) * 0.1}s`);
    img.style.setProperty('--rotation-direction', pictureState.rotationSpeed > 0 ? 'normal' : 'reverse');
  } else {
    img.classList.remove('rotating');
    img.style.removeProperty('--rotation-speed');
    img.style.removeProperty('--rotation-direction');
  }
}

/**
 * Apply a per-picture tint as a chain of CSS filters. Per-picture (NOT
 * full-frame) — preserves MZ semantics where tintPicture targets a
 * specific picture number, not the whole screen.
 *
 * Ported verbatim from the legacy applyPictureState's tint section so
 * the visual output is unchanged from the previous renderer.
 *
 * @param {HTMLImageElement} img
 * @param {{ r: number; g: number; b: number; gray: number }} tint
 */
function applyTintFilter(img, tint) {
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
}

async function renderPreviewAtFrame(frame) {
  if (_renderInFlight) {
    _pendingFrame = frame;
    return;
  }
  _renderInFlight = true;
  _pendingFrame = null;
  try {
    updateSlateAndRec(frame);
    updateFlashOverlay(frame);
    updateGridVisibility();
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
    gridEl.className = `preview-grid${state.gridVisible ? ' visible' : ''}`;

    // Build picture states
    const pictureStates = {};

    for (let evtIdx = 0; evtIdx < state.events.length; evtIdx++) {
      const evt = state.events[evtIdx];
      const evtStart = evt.startFrame || 0;
      if (evtStart > frame) continue;

      switch (evt.type) {
        case 'showPicture':
          pictureStates[evt.pictureNumber] = {
            eventIndex: evtIdx,
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
      .sort((a, b) => parseInt(a[0], 10) - parseInt(b[0], 10));

    // Fetch image paths in parallel using cache
    const pathResults = await Promise.all(
      sortedPictures.map(async ([_num, ps]) => {
        if (imagePathCache.has(ps.imageName)) {
          return imagePathCache.get(ps.imageName);
        }
        const resolved = await api.invoke('get-image-path', ps.imageName);
        if (resolved) {
          if (imagePathCache.size >= IMAGE_PATH_CACHE_MAX) {
            // Evict oldest entry
            const firstKey = imagePathCache.keys().next().value;
            imagePathCache.delete(firstKey);
          }
          imagePathCache.set(ps.imageName, resolved);
        }
        return resolved;
      })
    );

    // Collect existing picture elements for DOM reuse
    const existingImages = new Map();
    canvas.querySelectorAll('.stage-pic').forEach((el) => {
      existingImages.set(/** @type {HTMLElement} */ (el).dataset.pictureNumber, /** @type {HTMLImageElement} */ (el));
    });

    // Render pictures (reuse DOM elements where possible)
    for (let i = 0; i < sortedPictures.length; i++) {
      const [pictureNumber, pictureState] = sortedPictures[i];
      const imgPath = pathResults[i];

      if (!imgPath) {
        logger.warn(`Image not found for picture #${pictureNumber}:`, pictureState.imageName);
        continue;
      }

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
        img.className = 'stage-pic';
        img.dataset.eventIndex = String(pictureState.eventIndex);
        img.dataset.pictureNumber = String(pictureNumber);
        img.setAttribute('src', imgPath);
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
            renderProperties();
            return;
          }
        }
        selectEvent(evtIdx);
        highlightSelectedImage();
        renderTimeline();
        renderProperties();
      };
    }

    // Remove stale picture elements no longer in this frame
    existingImages.forEach((el) => el.remove());

    // Collect existing text elements for DOM reuse
    const existingTexts = new Map();
    canvas.querySelectorAll('.stage-text').forEach((el) => {
      existingTexts.set(/** @type {HTMLElement} */ (el).dataset.eventIndex, /** @type {HTMLElement} */ (el));
    });

    for (let textIdx = 0; textIdx < state.events.length; textIdx++) {
      const evt = state.events[textIdx];
      if (evt.type !== 'showText' || !evt.text) continue;
      const evtStart = evt.startFrame || 0;
      const evtEnd = evtStart + getEventDuration(evt.type, evt);
      if (frame < evtStart || frame > evtEnd) continue;

      const eventIndex = String(textIdx);
      let textBox = existingTexts.get(eventIndex);
      if (!textBox) {
        textBox = document.createElement('div');
        textBox.className = 'stage-text';
        textBox.dataset.eventIndex = eventIndex;
        canvas.appendChild(textBox);
      } else {
        existingTexts.delete(eventIndex);
      }

      // Programmatic content build — preserves newlines without innerHTML.
      while (textBox.firstChild) textBox.removeChild(textBox.firstChild);
      const lines = String(evt.text || '').split(/\n/);
      lines.forEach((line, i) => {
        if (i > 0) textBox.appendChild(document.createElement('br'));
        textBox.appendChild(document.createTextNode(line));
      });

      if (state.waitingForTextClick) {
        textBox.classList.add('waiting');
        const hint = document.createElement('div');
        hint.className = 'text-continue-hint';
        hint.textContent = '▼ Click to continue';
        textBox.appendChild(hint);
      } else {
        textBox.classList.remove('waiting');
      }

      const evtIdx = parseInt(eventIndex, 10);
      textBox.onclick = (e) => {
        e.stopPropagation();
        if (state.waitingForTextClick && state.isPlaying) {
          continueFromText();
          return;
        }
        selectEvent(evtIdx);
        highlightSelectedImage();
        renderTimeline();
        renderProperties();
      };
    }

    // Remove stale text elements
    existingTexts.forEach((el) => el.remove());

    highlightSelectedImage();
    logger.timeEnd('renderPreviewAtFrame');
  } catch (err) {
    logger.error('Failed to render preview:', err);
  } finally {
    _renderInFlight = false;
    if (_pendingFrame !== null) {
      const next = _pendingFrame;
      _pendingFrame = null;
      requestAnimationFrame(() => renderPreviewAtFrame(next));
    }
  }
}

/**
 * Sync the stage frame's aspect-ratio (via CSS vars) and the resolution
 * readout chip with the current project's screen dimensions.
 */
function updateStageGeometry() {
  const root = document.documentElement;
  root.style.setProperty('--stage-w', String(state.screenWidth));
  root.style.setProperty('--stage-h', String(state.screenHeight));

  // Readout chip: "816 × 624"-style label
  const readout = document.querySelector('.stage-readout .res');
  if (readout) {
    readout.textContent = `${state.screenWidth} \xd7 ${state.screenHeight}`;
  }
}

export { getPreviewScale, resizePreviewCanvas, renderPreviewAtFrame, updateStageGeometry };
