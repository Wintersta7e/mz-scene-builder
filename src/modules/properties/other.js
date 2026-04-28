// src/modules/properties/other.js
//
// Rotate / Erase / Wait / Flash sections. Each is small.

import { buildSection, buildRow, buildSlider, buildColorBubble, commit } from './shared.js';

const FLASH_COLORS = [
  { name: 'White', color: 'oklch(1 0 0)' },
  { name: 'Red', color: 'oklch(0.7 0.2 25)' },
  { name: 'Yellow', color: 'oklch(0.9 0.18 90)' },
  { name: 'Cyan', color: 'oklch(0.85 0.15 200)' }
];

export function renderRotateProperties(ev, index) {
  const wrap = document.createElement('div');
  wrap.appendChild(
    buildSection('Rotation', (body) => {
      body.appendChild(
        buildRow(
          'Speed',
          buildSlider({
            value: ev.speed ?? 0,
            min: -90,
            max: 90,
            onChange: (v) => commit(ev, 'speed', v, index)
          })
        )
      );
    })
  );
  return wrap;
}

export function renderEraseProperties() {
  // Erase has no fields beyond the timing block (rendered by index.js).
  return document.createElement('div');
}

export function renderWaitProperties() {
  // Wait shows its frame count via the timing block (LEN cell). No
  // type-specific fields yet.
  return document.createElement('div');
}

export function renderFlashProperties(ev, index) {
  const wrap = document.createElement('div');
  const color = ev.color || 'oklch(1 0 0)';

  // Quick re-render so the color bubble preview updates after picking.
  function refresh() {
    import('./index.js').then((m) => m.renderProperties()).catch(() => {});
  }

  wrap.appendChild(
    buildSection('Flash', (body) => {
      const row = document.createElement('div');
      row.className = 'tint-row';
      row.appendChild(buildColorBubble({ color, glow: true }));

      const presets = document.createElement('div');
      presets.className = 'tint-presets';
      for (const p of FLASH_COLORS) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `tint-preset${p.color === color ? ' is-active' : ''}`;
        btn.title = p.name;
        btn.style.background = p.color;
        btn.textContent = p.name.slice(0, 4).toUpperCase();
        btn.addEventListener('click', () => {
          commit(ev, 'color', p.color, index);
          refresh();
        });
        presets.appendChild(btn);
      }
      row.appendChild(presets);
      body.appendChild(row);

      body.appendChild(
        buildRow(
          'Intensity',
          buildSlider({
            value: ev.intensity ?? 100,
            min: 0,
            max: 100,
            unit: '%',
            onChange: (v) => commit(ev, 'intensity', v, index)
          })
        )
      );
    })
  );

  return wrap;
}
