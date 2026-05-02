// src/modules/properties/other.js
//
// Rotate / Erase / Wait / Flash sections. Each is small.

import {
  buildSection,
  buildRow,
  buildSlider,
  buildColorBubble,
  buildPresetGrid,
  buildTargetPictureSection,
  commit,
  triggerRerender
} from './shared.js';

const FLASH_COLORS = [
  { name: 'White', r: 255, g: 255, b: 255, color: 'rgb(255, 255, 255)' },
  { name: 'Red', r: 255, g: 64, b: 64, color: 'rgb(255, 64, 64)' },
  { name: 'Yellow', r: 255, g: 255, b: 64, color: 'rgb(255, 255, 64)' },
  { name: 'Cyan', r: 64, g: 255, b: 255, color: 'rgb(64, 255, 255)' }
];

export function renderRotateProperties(ev) {
  const wrap = document.createElement('div');
  wrap.appendChild(buildTargetPictureSection(ev));
  wrap.appendChild(
    buildSection('Rotation', (body) => {
      body.appendChild(
        buildRow(
          'Speed',
          buildSlider({
            value: ev.speed ?? 0,
            min: -90,
            max: 90,
            onChange: (v) => commit(ev, 'speed', v)
          })
        )
      );
    })
  );
  return wrap;
}

export function renderEraseProperties(ev) {
  const wrap = document.createElement('div');
  wrap.appendChild(buildTargetPictureSection(ev));
  return wrap;
}

export function renderWaitProperties() {
  // Wait shows its frame count via the timing block (LEN cell). No
  // type-specific fields yet.
  return document.createElement('div');
}

export function renderFlashProperties(ev) {
  const wrap = document.createElement('div');

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
      row.appendChild(
        buildPresetGrid({
          presets: FLASH_COLORS,
          active: activePreset ? activePreset.name : null,
          onChange: (p) => {
            commit(ev, 'red', p.r);
            commit(ev, 'green', p.g);
            commit(ev, 'blue', p.b);
            // screenFlash doesn't export gray, but some scenes carry it
            // from older code paths — clear it for safety.
            commit(ev, 'gray', 0);
            triggerRerender();
          }
        })
      );
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
            onChange: (v) => commit(ev, 'intensity', Math.round((v / 100) * 255))
          })
        )
      );
    })
  );

  return wrap;
}
