// src/modules/properties/picture.js
//
// Show Picture section — image, origin, position, scale, opacity, blend.

import { openImagePicker } from '../preview/image-picker.js';
import {
  buildSection,
  buildRow,
  buildPair,
  buildCell,
  buildSelect,
  buildSlider,
  buildOriginPad,
  buildImagePickerControl,
  commit
} from './shared.js';

export function renderPictureProperties(ev, index) {
  const wrap = document.createElement('div');

  // ----- Image -----
  wrap.appendChild(
    buildSection('Image', (body) => {
      body.appendChild(
        buildImagePickerControl({
          imageName: ev.imageName || '',
          // openImagePicker writes the chosen path directly to the
          // currently-selected event's imageName via selectPickerImage,
          // then emits Events.RENDER which retriggers renderProperties().
          onPick: () => openImagePicker()
        })
      );
    })
  );

  // ----- Target -----
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

  // ----- Position -----
  wrap.appendChild(
    buildSection('Position', (body) => {
      body.appendChild(
        buildRow(
          'Origin',
          buildOriginPad({
            origin: ev.origin || 0,
            onChange: (origin) => commit(ev, 'origin', origin, index)
          })
        )
      );
      body.appendChild(
        buildPair(
          buildCell({
            label: 'X',
            value: ev.x || 0,
            unit: 'px',
            onChange: (v) => commit(ev, 'x', /** @type {number} */ (v), index)
          }),
          buildCell({
            label: 'Y',
            value: ev.y || 0,
            unit: 'px',
            onChange: (v) => commit(ev, 'y', /** @type {number} */ (v), index)
          })
        )
      );
    })
  );

  // ----- Scale -----
  wrap.appendChild(
    buildSection('Scale', (body) => {
      body.appendChild(
        buildPair(
          buildCell({
            label: 'X',
            value: ev.scaleX ?? 100,
            unit: '%',
            onChange: (v) => commit(ev, 'scaleX', /** @type {number} */ (v), index)
          }),
          buildCell({
            label: 'Y',
            value: ev.scaleY ?? 100,
            unit: '%',
            onChange: (v) => commit(ev, 'scaleY', /** @type {number} */ (v), index)
          })
        )
      );
    })
  );

  // ----- Effects -----
  wrap.appendChild(
    buildSection('Effects', (body) => {
      body.appendChild(
        buildRow(
          'Opacity',
          buildSlider({
            value: ev.opacity ?? 255,
            min: 0,
            max: 255,
            onChange: (v) => commit(ev, 'opacity', v, index)
          })
        )
      );
      body.appendChild(
        buildRow(
          'Blend',
          buildSelect({
            value: ev.blend ?? 0,
            options: [
              { value: 0, label: 'Normal' },
              { value: 1, label: 'Add' },
              { value: 2, label: 'Multiply' },
              { value: 3, label: 'Screen' }
            ],
            onChange: (v) => commit(ev, 'blend', v, index)
          })
        )
      );
    })
  );

  return wrap;
}
