// __tests__/elements-contract.test.mjs
//
// DOM contract: every element ID required by initElements() must exist
// in src/index.html. The $() helper in elements.js throws on missing
// IDs, so a missed swap would crash the app at boot — this test
// catches that class of regression cheaply.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('elements.js DOM contract', () => {
  it('every $() ID required by initElements is present in src/index.html', () => {
    const root = resolve(process.cwd());
    const elementsSrc = readFileSync(resolve(root, 'src/modules/elements.js'), 'utf8');
    const htmlSrc = readFileSync(resolve(root, 'src/index.html'), 'utf8');

    const requiredIds = Array.from(elementsSrc.matchAll(/\$\('([^']+)'\)/g)).map((m) => m[1]);
    expect(requiredIds.length).toBeGreaterThan(20); // sanity — we cache lots

    const missing = [];
    for (const id of requiredIds) {
      // Match id="X" with X being the exact ID (no partial)
      const re = new RegExp(`\\bid="${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`);
      if (!re.test(htmlSrc)) missing.push(id);
    }
    expect(missing).toEqual([]);
  });
});
