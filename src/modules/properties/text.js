// src/modules/properties/text.js
//
// Show Text section — text body, background style, position.

import { buildSection, buildRow, buildSelect, commit } from './shared.js';

export function renderTextProperties(ev) {
  const wrap = document.createElement('div');

  wrap.appendChild(
    buildSection('Body', (body) => {
      const ta = document.createElement('textarea');
      ta.className = 'prop-input';
      ta.rows = 4;
      ta.value = ev.text || '';
      ta.addEventListener('change', () => commit(ev, 'text', ta.value));
      body.appendChild(ta);
    })
  );

  wrap.appendChild(
    buildSection('Style', (body) => {
      body.appendChild(
        buildRow(
          'Background',
          buildSelect({
            value: ev.background ?? 0,
            options: [
              { value: 0, label: 'Window' },
              { value: 1, label: 'Dim' },
              { value: 2, label: 'Transparent' }
            ],
            onChange: (v) => commit(ev, 'background', v)
          })
        )
      );
      body.appendChild(
        buildRow(
          'Position',
          buildSelect({
            value: ev.position ?? 2,
            options: [
              { value: 0, label: 'Top' },
              { value: 1, label: 'Middle' },
              { value: 2, label: 'Bottom' }
            ],
            onChange: (v) => commit(ev, 'position', v)
          })
        )
      );
    })
  );

  return wrap;
}
