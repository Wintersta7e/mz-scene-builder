// src/modules/properties/move.js
//
// Move Picture section — target position with path viz, scale, opacity,
// duration, easing.

import {
  buildSection,
  buildRow,
  buildPair,
  buildCell,
  buildSelect,
  buildSlider,
  buildPathMini,
  buildTargetPictureSection,
  commit,
  triggerRerender
} from './shared.js';

export function renderMoveProperties(ev) {
  const wrap = document.createElement('div');

  wrap.appendChild(buildTargetPictureSection(ev));

  wrap.appendChild(
    buildSection('Destination', (body) => {
      body.appendChild(
        buildPair(
          buildCell({
            label: '→ X',
            value: ev.x || 0,
            unit: 'px',
            onChange: (v) => {
              commit(ev, 'x', /** @type {number} */ (v));
              triggerRerender();
            }
          }),
          buildCell({
            label: '→ Y',
            value: ev.y || 0,
            unit: 'px',
            onChange: (v) => {
              commit(ev, 'y', /** @type {number} */ (v));
              triggerRerender();
            }
          })
        )
      );
      body.appendChild(buildRow('Path', buildPathMini({ toX: ev.x || 0, toY: ev.y || 0 }), true));
    })
  );

  wrap.appendChild(
    buildSection('Scale', (body) => {
      body.appendChild(
        buildPair(
          buildCell({
            label: 'X',
            value: ev.scaleX ?? 100,
            unit: '%',
            onChange: (v) => commit(ev, 'scaleX', /** @type {number} */ (v))
          }),
          buildCell({
            label: 'Y',
            value: ev.scaleY ?? 100,
            unit: '%',
            onChange: (v) => commit(ev, 'scaleY', /** @type {number} */ (v))
          })
        )
      );
    })
  );

  wrap.appendChild(
    buildSection('Effects', (body) => {
      body.appendChild(
        buildRow(
          'Opacity',
          buildSlider({
            value: ev.opacity ?? 255,
            min: 0,
            max: 255,
            onChange: (v) => commit(ev, 'opacity', v)
          })
        )
      );
      body.appendChild(
        buildRow(
          'Easing',
          buildSelect({
            value: ev.easingType ?? 0,
            options: [
              { value: 0, label: 'Linear' },
              { value: 1, label: 'Ease In' },
              { value: 2, label: 'Ease Out' },
              { value: 3, label: 'Ease In-Out' }
            ],
            onChange: (v) => commit(ev, 'easingType', v)
          })
        )
      );
    })
  );

  return wrap;
}
