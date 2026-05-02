// src/modules/properties/shared.js
//
// Inspector primitives — programmatic DOM builders for the
// Director's Console inspector. Every property section composes
// these helpers; no innerHTML, no template strings.

import { state, LANE_DATA, MAX_PICTURE_NUMBER } from '../state.js';
import { markDirty } from '../undo-redo.js';
import { eventBus, Events } from '../event-bus.js';
import { clamp } from '../utils.js';

// Fields whose mutation changes the timeline's lane positions, widths, or
// labels. commit() emits RENDER_TIMELINE only when one of these changes;
// non-timeline fields (opacity, RGB, easing, etc.) skip the full timeline
// rebuild so slider drags don't trigger 60 Hz lane re-rendering.
const TIMELINE_AFFECTING_FIELDS = new Set(['startFrame', 'duration', 'frames', 'pictureNumber', 'text']);

const TYPE_LABELS = {
  showPicture: 'Show',
  movePicture: 'Move',
  rotatePicture: 'Rotate',
  tintPicture: 'Tint',
  erasePicture: 'Erase',
  showText: 'Text',
  wait: 'Wait',
  screenFlash: 'Flash'
};

const ORIGIN_LABELS = [
  'Top Left',
  'Top Center',
  'Top Right',
  'Middle Left',
  'Center',
  'Middle Right',
  'Bottom Left',
  'Bottom Center',
  'Bottom Right'
];

const TINT_PRESETS = [
  { name: 'Normal', r: 0, g: 0, b: 0, gray: 0, color: 'oklch(0.6 0 0)' },
  { name: 'Dark', r: -68, g: -68, b: -68, gray: 0, color: 'oklch(0.25 0 0)' },
  { name: 'Sepia', r: 34, g: -34, b: -68, gray: 170, color: 'oklch(0.6 0.08 70)' },
  { name: 'Sunset', r: 68, g: -34, b: -34, gray: 0, color: 'oklch(0.65 0.18 30)' },
  { name: 'Night', r: -68, g: -68, b: 0, gray: 68, color: 'oklch(0.25 0.05 250)' },
  { name: 'Daylight', r: 34, g: 34, b: 34, gray: 0, color: 'oklch(0.85 0 0)' }
];

// ---------- Section primitives ----------

/**
 * @param {any} ev
 * @returns {HTMLDivElement}
 */
export function buildEventTag(ev) {
  const wrap = document.createElement('div');
  wrap.className = 'event-tag';
  wrap.dataset.lane = LANE_DATA[laneOf(ev.type)];

  const icon = document.createElement('div');
  icon.className = 'ev-icon';
  icon.textContent = '▣';
  wrap.appendChild(icon);

  const info = document.createElement('div');
  info.className = 'ev-info';
  const typeEl = document.createElement('div');
  typeEl.className = 'ev-type';
  typeEl.textContent = (TYPE_LABELS[ev.type] || ev.type).toUpperCase();
  info.appendChild(typeEl);
  const nameEl = document.createElement('div');
  nameEl.className = 'ev-name';
  nameEl.textContent = ev.name || labelForEvent(ev);
  info.appendChild(nameEl);
  wrap.appendChild(info);

  const idChip = document.createElement('div');
  idChip.className = 'ev-id';
  idChip.textContent = `@${ev.startFrame || 0}f`;
  wrap.appendChild(idChip);

  return wrap;
}

/**
 * @param {string} title
 * @param {(body: HTMLDivElement) => void} fillBody
 * @returns {HTMLDivElement}
 */
export function buildSection(title, fillBody) {
  const section = document.createElement('div');
  section.className = 'prop-section';

  const titleEl = document.createElement('div');
  titleEl.className = 'prop-section-title';
  titleEl.textContent = title.toUpperCase();
  section.appendChild(titleEl);

  const body = document.createElement('div');
  body.className = 'prop-section-body';
  fillBody(body);
  section.appendChild(body);

  return section;
}

/**
 * @param {string} labelText
 * @param {HTMLElement} control
 * @param {boolean} [full]
 */
export function buildRow(labelText, control, full = false) {
  const row = document.createElement('div');
  row.className = `prop-row${full ? ' full' : ''}`;
  if (!full) {
    const label = document.createElement('div');
    label.className = 'prop-label';
    label.textContent = labelText;
    row.appendChild(label);
  }
  row.appendChild(control);
  return row;
}

/**
 * @param {HTMLElement} a
 * @param {HTMLElement} b
 */
export function buildPair(a, b) {
  const wrap = document.createElement('div');
  wrap.className = 'prop-pair';
  wrap.appendChild(a);
  wrap.appendChild(b);
  return wrap;
}

/**
 * @param {{ label: string; value: number | string; unit?: string;
 *          onChange: (value: number | string) => void;
 *          type?: 'number' | 'text'; step?: number; }} opts
 */
export function buildCell({ label, value, unit, onChange, type = 'number', step = 1 }) {
  const cell = document.createElement('div');
  cell.className = 'prop-cell';

  const labelEl = document.createElement('div');
  labelEl.className = 'cell-label';
  labelEl.textContent = label;
  cell.appendChild(labelEl);

  const input = document.createElement('input');
  input.className = 'cell-input';
  input.type = type;
  if (type === 'number') input.step = String(step);
  input.value = String(value);
  input.addEventListener('change', () => {
    const v = type === 'number' ? Number(input.value) : input.value;
    onChange(/** @type {any} */ (v));
  });
  cell.appendChild(input);

  if (unit) {
    const unitEl = document.createElement('div');
    unitEl.className = 'cell-unit';
    unitEl.textContent = unit;
    cell.appendChild(unitEl);
  }

  return cell;
}

/**
 * @param {{ value: any; options: Array<{ value: any; label: string }>;
 *          onChange: (value: any) => void; }} opts
 */
export function buildSelect({ value, options, onChange }) {
  const wrap = document.createElement('div');
  wrap.className = 'prop-select';

  const sel = document.createElement('select');
  for (const opt of options) {
    const o = document.createElement('option');
    o.value = String(opt.value);
    o.textContent = opt.label;
    if (String(opt.value) === String(value)) o.selected = true;
    sel.appendChild(o);
  }
  sel.addEventListener('change', () => onChange(parseAutoValue(sel.value, options)));
  wrap.appendChild(sel);

  return wrap;
}

/**
 * @param {{ value: number; min: number; max: number; step?: number;
 *          unit?: string; onChange: (value: number) => void; }} opts
 */
export function buildSlider({ value, min, max, step = 1, unit = '', onChange }) {
  const row = document.createElement('div');
  row.className = 'slider-row';

  const slider = document.createElement('div');
  slider.className = 'slider';

  const fill = document.createElement('div');
  fill.className = 'slider-fill';
  slider.appendChild(fill);

  const thumb = document.createElement('div');
  thumb.className = 'slider-thumb';
  slider.appendChild(thumb);

  const valEl = document.createElement('div');
  valEl.className = 'slider-value';

  let current = clamp(value, min, max);

  function paint() {
    const pct = ((current - min) / (max - min)) * 100;
    fill.style.width = `${pct}%`;
    thumb.style.left = `${pct}%`;
    valEl.textContent = `${formatNumber(current)}${unit}`;
  }
  paint();

  function setFromEvent(e) {
    const rect = slider.getBoundingClientRect();
    const ratio = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    let v = min + ratio * (max - min);
    if (step !== 0) v = Math.round(v / step) * step;
    current = clamp(v, min, max);
    paint();
    onChange(current);
  }

  slider.addEventListener('mousedown', (e) => {
    setFromEvent(e);
    const onMove = (ev) => setFromEvent(ev);
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    e.preventDefault();
  });

  row.appendChild(slider);
  row.appendChild(valEl);
  return row;
}

/**
 * @param {{ origin: number; onChange: (origin: number) => void; }} opts
 */
export function buildOriginPad({ origin, onChange }) {
  const pad = document.createElement('div');
  pad.className = 'origin-pad';

  // Map data origin (0=top-left, 1=center) to active grid index.
  const activeIdx = origin === 1 ? 4 : 0;

  // Only cells the renderer currently supports are clickable. The others
  // render visibly so the 3x3 layout reads correctly, but are disabled
  // until the renderer learns to interpret origin codes 2-8.
  const SUPPORTED = new Set([0, 4]);
  const ORIGIN_FOR_INDEX = { 0: 0, 4: 1 };

  for (let i = 0; i < 9; i++) {
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = `origin-cell${i === activeIdx ? ' is-active' : ''}`;
    cell.title = ORIGIN_LABELS[i];
    if (SUPPORTED.has(i)) {
      cell.addEventListener('click', () => onChange(ORIGIN_FOR_INDEX[i]));
    } else {
      cell.disabled = true;
      cell.setAttribute('aria-disabled', 'true');
      cell.style.opacity = '0.35';
      cell.style.cursor = 'not-allowed';
    }
    pad.appendChild(cell);
  }
  return pad;
}

/**
 * @param {{ toX: number; toY: number; }} opts
 */
export function buildPathMini({ toX, toY }) {
  const wrap = document.createElement('div');
  wrap.className = 'path-mini';

  const grid = document.createElement('div');
  grid.className = 'path-mini-grid';
  wrap.appendChild(grid);

  const fromX = 20;
  const fromY = 70;
  const toXPct = clamp((toX / state.screenWidth) * 100, 0, 100);
  const toYPct = clamp((toY / state.screenHeight) * 100, 0, 100);

  const fromDot = document.createElement('div');
  fromDot.className = 'path-from';
  fromDot.style.left = `${fromX}%`;
  fromDot.style.top = `${fromY}%`;
  wrap.appendChild(fromDot);

  const toDot = document.createElement('div');
  toDot.className = 'path-to';
  toDot.style.left = `${toXPct}%`;
  toDot.style.top = `${toYPct}%`;
  wrap.appendChild(toDot);

  const line = document.createElement('div');
  line.className = 'path-line';
  const dx = toXPct - fromX;
  const dy = toYPct - fromY;
  const length = Math.hypot(dx, dy);
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  line.style.left = `${fromX}%`;
  line.style.top = `${fromY}%`;
  line.style.width = `${length}%`;
  line.style.transform = `rotate(${angle}deg)`;
  wrap.appendChild(line);

  return wrap;
}

/**
 * @param {{ color: string; glow?: boolean }} opts
 */
export function buildColorBubble({ color, glow = false }) {
  const bubble = document.createElement('div');
  bubble.className = 'color-bubble';
  bubble.style.background = color;
  if (glow) bubble.style.boxShadow = `0 0 20px ${color}`;
  return bubble;
}

/**
 * Build the .tint-presets pill grid. Each preset is a small button whose
 * background is its `color` swatch and whose label is the first 4 chars
 * of `name` upper-cased. The preset whose `name` matches `active` gets
 * the `is-active` class.
 *
 * @template T
 * @param {{ presets: ReadonlyArray<T & { name: string; color: string }>;
 *           active: string | null;
 *           onChange: (preset: T & { name: string; color: string }) => void }} opts
 */
export function buildPresetGrid({ presets, active, onChange }) {
  const grid = document.createElement('div');
  grid.className = 'tint-presets';

  for (const preset of presets) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `tint-preset${preset.name === active ? ' is-active' : ''}`;
    btn.title = preset.name;
    btn.style.background = preset.color;
    btn.textContent = preset.name.slice(0, 4).toUpperCase();
    btn.addEventListener('click', () => onChange(preset));
    grid.appendChild(btn);
  }
  return grid;
}

/**
 * @param {{ active: string | null;
 *          onChange: (preset: { name: string; r: number; g: number;
 *                                b: number; gray: number }) => void }} opts
 */
export function buildTintPresets({ active, onChange }) {
  return buildPresetGrid({ presets: TINT_PRESETS, active, onChange });
}

/**
 * @param {any} ev
 * @param {{ showDuration?: boolean }} [opts]
 */
export function buildTimingSection(ev, opts = {}) {
  return buildSection('Timing', (body) => {
    const startCell = buildCell({
      label: 'START',
      value: ev.startFrame || 0,
      unit: 'f',
      onChange: (v) => commit(ev, 'startFrame', /** @type {number} */ (v))
    });

    if (opts.showDuration) {
      const durField = ev.type === 'wait' ? 'frames' : 'duration';
      const durCell = buildCell({
        label: 'LEN',
        value: ev[durField] || 0,
        unit: 'f',
        onChange: (v) => commit(ev, durField, /** @type {number} */ (v))
      });
      body.appendChild(buildPair(startCell, durCell));
    } else {
      body.appendChild(startCell);
    }
  });
}

/**
 * Standard "Target → PIC #" section used by every picture-affecting
 * inspector (Show / Move / Tint / Rotate / Erase). The cell clamps to
 * 1..MAX_PICTURE_NUMBER on commit.
 *
 * @param {any} ev
 */
export function buildTargetPictureSection(ev) {
  return buildSection('Target', (body) => {
    body.appendChild(
      buildCell({
        label: 'PIC #',
        value: ev.pictureNumber ?? 1,
        onChange: (v) => commit(ev, 'pictureNumber', clamp(/** @type {number} */ (v), 1, MAX_PICTURE_NUMBER))
      })
    );
  });
}

/**
 * @param {{ imageName: string; onPick: () => void }} opts
 */
export function buildImagePickerControl({ imageName, onPick }) {
  const wrap = document.createElement('div');
  wrap.className = 'prop-cell prop-cell-picker';

  const labelEl = document.createElement('div');
  labelEl.className = 'cell-label';
  labelEl.textContent = 'IMG';
  wrap.appendChild(labelEl);

  const nameEl = document.createElement('div');
  nameEl.className = 'cell-input cell-readonly';
  nameEl.textContent = imageName ? truncateMiddle(imageName, 28) : '— none —';
  nameEl.title = imageName || '';
  wrap.appendChild(nameEl);

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'cell-pick-btn';
  btn.textContent = '…';
  btn.title = 'Pick image';
  btn.addEventListener('click', onPick);
  wrap.appendChild(btn);

  return wrap;
}

/**
 * Mutate ev[prop] and propagate. Emits RENDER_PREVIEW for every change;
 * RENDER_TIMELINE only fires when the field affects the timeline's
 * positions, widths, or labels (see TIMELINE_AFFECTING_FIELDS) — so
 * slider drags on opacity/scale/RGB don't trigger 60 Hz lane rebuilds.
 *
 * @param {any} ev
 * @param {string} prop
 * @param {any} value
 */
export function commit(ev, prop, value) {
  ev[prop] = value;
  markDirty();
  if (TIMELINE_AFFECTING_FIELDS.has(prop)) {
    eventBus.emit(Events.RENDER_TIMELINE);
  }
  eventBus.emit(Events.RENDER_PREVIEW, state.currentFrame);
}

/**
 * Re-render the inspector (e.g. after a preset click that touches multiple
 * fields and needs the section to redraw). Lazy-imported to avoid a
 * circular dep with index.js, which imports every section module.
 */
export function triggerRerender() {
  import('./index.js').then((m) => m.renderProperties());
}

// ---------- Internals ----------

function laneOf(type) {
  switch (type) {
    case 'showPicture':
    case 'movePicture':
    case 'rotatePicture':
    case 'erasePicture':
      return 0;
    case 'tintPicture':
    case 'screenFlash':
      return 1;
    case 'showText':
      return 2;
    case 'wait':
      return 3;
    default:
      return 0;
  }
}

function labelForEvent(ev) {
  switch (ev.type) {
    case 'showPicture':
      return ev.imageName ? ev.imageName.split(/[\\/]/).pop() : '(no image)';
    case 'showText':
      return (ev.text || '').slice(0, 24) || '(no text)';
    default:
      return TYPE_LABELS[ev.type] || ev.type;
  }
}

function formatNumber(v) {
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
}

function parseAutoValue(raw, options) {
  const sample = options[0]?.value;
  if (typeof sample === 'number') return Number(raw);
  if (typeof sample === 'boolean') return raw === 'true';
  return raw;
}

function truncateMiddle(s, max) {
  if (s.length <= max) return s;
  const half = Math.floor((max - 1) / 2);
  return `${s.slice(0, half)}…${s.slice(-half)}`;
}
