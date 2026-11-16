'use strict';
// Copies extension/ to dist/extension-store (without the "key" field) and dist/extension-sideload (as is).
// The store assigns its own extension ID, so the dev "key" must not be uploaded.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const src = path.join(root, 'extension');
const dist = path.join(root, 'dist');
fs.rmSync(dist, { recursive: true, force: true });

for (const [name, strip] of [['extension-sideload', false], ['extension-store', true]]) {
  const dest = path.join(dist, name);
  fs.cpSync(src, dest, { recursive: true });
  if (strip) {
    const mp = path.join(dest, 'manifest.json');
    const m = JSON.parse(fs.readFileSync(mp, 'utf8'));
    delete m.key;
    fs.writeFileSync(mp, JSON.stringify(m, null, 2) + '\n');
  }
  console.log('Wrote', path.relative(root, dest));
}
