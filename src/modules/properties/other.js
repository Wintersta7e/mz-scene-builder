// src/modules/properties/other.js
//
// Rotate / Erase / Wait / Flash sections. Each is small.

import { buildSection, buildRow, buildCell, buildSlider, buildColorBubble, commit } from './shared.js';

const FLASH_COLORS = [
  { name: 'White', r: 255, g: 255, b: 255, css: 'rgb(255, 255, 255)' },
  { name: 'Red', r: 255, g: 64, b: 64, css: 'rgb(255, 64, 64)' },
  { name: 'Yellow', r: 255, g: 255, b: 64, css: 'rgb(255, 255, 64)' },
  { name: 'Cyan', r: 64, g: 255, b: 255, css: 'rgb(64, 255, 255)' }
];

export function renderRotateProperties(ev, index) {
  const wrap = document.createElement('div');
  wrap.appendChild(
    buildSection('Target', (body) => {
      body.appendChild(
        buildCell({
          label: 'PIC #',
          value: ev.pictureNumber ?? 1,
          onChange: (v) => commit(ev, 'pictureNumber', Math.max(1, Math.min(100, /** @type {number} */ (v))), index)
        })
      );
    })
  );
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

export function renderEraseProperties(ev, index) {
  const wrap = document.createElement('div');
  wrap.appendChild(
    buildSection('Target', (body) => {
      body.appendChild(
        buildCell({
          label: 'PIC #',
          value: ev.pictureNumber ?? 1,
          onChange: (v) => commit(ev, 'pictureNumber', Math.max(1, Math.min(100, /** @type {number} */ (v))), index)
        })
      );
    })
  );
  return wrap;
}

export function renderWaitProperties() {
  // Wait shows its frame count via the timing block (LEN cell). No
  // type-specific fields yet.
  return document.createElement('div');
}

export function renderFlashProperties(ev, index) {
  const wrap = document.createElement('div');

  // Lazy re-render so the bubble + active-preset highlight update after commits.
  function refresh() {
    import('./index.js').then((m) => m.renderProperties()).catch(() => {});
  }

  // Compose preview color from MZ-native red/green/blue. Defaults match the
  // exporter's defaults (255/255/255 → white) at src/lib/mz-converter.js:141.
  const r = ev.red ?? 255;
  const g = ev.green ?? 255;
  const b = ev.blue ?? 255;
  const previewCss = `rgb(${r}, ${g}, ${b})`;
  const activePreset = FLASH_COLORS.find((p) => p.r === r && p.g === g && p.b === b);

  wrap.appendChild(
    buildSection('Flash', (body) => {
      const row = document.createElement('div');
      row.className = 'tint-row';
      row.appendChild(buildColorBubble({ color: previewCss, glow: true }));

      const presets = document.createElement('div');
      presets.className = 'tint-presets';
      for (const p of FLASH_COLORS) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `tint-preset${activePreset && activePreset.name === p.name ? ' is-active' : ''}`;
        btn.title = p.name;
        btn.style.background = p.css;
        btn.textContent = p.name.slice(0, 4).toUpperCase();
        btn.addEventListener('click', () => {
          commit(ev, 'red', p.r, index);
          commit(ev, 'green', p.g, index);
          commit(ev, 'blue', p.b, index);
          // Reset gray (the screenFlash event type doesn't export gray, but
          // some scenes carry it from older code paths — clear it for safety).
          commit(ev, 'gray', 0, index);
          refresh();
        });
        presets.appendChild(btn);
      }
      row.appendChild(presets);
      body.appendChild(row);

      // Intensity: stored 0-255, displayed 0-100. Default 170 → ~67%.
      const storedIntensity = ev.intensity ?? 170;
      body.appendChild(
        buildRow(
          'Intensity',
          buildSlider({
            value: Math.round((storedIntensity / 255) * 100),
            min: 0,
            max: 100,
            unit: '%',
            onChange: (v) => commit(ev, 'intensity', Math.round((v / 100) * 255), index)
          })
        )
      );
    })
  );

  return wrap;
}
