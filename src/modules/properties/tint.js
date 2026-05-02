// src/modules/properties/tint.js
//
// Tint Picture section — color preview, tone presets, RGB+gray sliders.

import {
  buildSection,
  buildRow,
  buildSlider,
  buildColorBubble,
  buildTintPresets,
  buildTargetPictureSection,
  commit,
  triggerRerender
} from './shared.js';
import { clamp } from '../utils.js';

export function renderTintProperties(ev) {
  const wrap = document.createElement('div');

  const previewColor = toneToCssColor({
    r: ev.red ?? 0,
    g: ev.green ?? 0,
    b: ev.blue ?? 0,
    gray: ev.gray ?? 0
  });

  wrap.appendChild(buildTargetPictureSection(ev));

  wrap.appendChild(
    buildSection('Tone', (body) => {
      const tintRow = document.createElement('div');
      tintRow.className = 'tint-row';
      tintRow.appendChild(buildColorBubble({ color: previewColor }));
      tintRow.appendChild(
        buildTintPresets({
          active: null,
          onChange: (preset) => {
            commit(ev, 'red', preset.r);
            commit(ev, 'green', preset.g);
            commit(ev, 'blue', preset.b);
            commit(ev, 'gray', preset.gray);
            // Sliders skip this and update only the stage preview to keep
            // drags responsive — the inspector catches up on the next full
            // render. Preset clicks redraw to refresh the bubble.
            triggerRerender();
          }
        })
      );
      body.appendChild(tintRow);
    })
  );

  wrap.appendChild(
    buildSection('Channels', (body) => {
      const fields = /** @type {const} */ ([
        { label: 'Red', prop: 'red', min: -255, max: 255 },
        { label: 'Green', prop: 'green', min: -255, max: 255 },
        { label: 'Blue', prop: 'blue', min: -255, max: 255 },
        { label: 'Gray', prop: 'gray', min: 0, max: 255 }
      ]);
      for (const f of fields) {
        body.appendChild(
          buildRow(
            f.label,
            buildSlider({
              value: ev[f.prop] ?? 0,
              min: f.min,
              max: f.max,
              onChange: (v) => commit(ev, f.prop, v)
            })
          )
        );
      }
    })
  );

  return wrap;
}

/**
 * Naive bubble preview color from RGB tone deltas + gray amount.
 * @param {{ r: number; g: number; b: number; gray: number }} tone
 */
function toneToCssColor({ r, g, b, gray }) {
  const base = 128;
  const cr = clamp(base + r, 0, 255);
  const cg = clamp(base + g, 0, 255);
  const cb = clamp(base + b, 0, 255);
  const grayPct = (gray / 255) * 0.5;
  const lerp = (c) => c * (1 - grayPct) + base * grayPct;
  return `rgb(${Math.round(lerp(cr))}, ${Math.round(lerp(cg))}, ${Math.round(lerp(cb))})`;
}
