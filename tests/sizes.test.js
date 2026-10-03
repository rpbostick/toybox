// Size budgets for the two classic scripts as built. The toys-only file stays small enough for
// a page that wants only the drawer; the all-in-one file stays well under 500 KB, with dice-box's
// 3D files kept apart in dist/dice-box/ (loaded only when 3D dice are switched on).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { distMissing } from './dist-built.js';

const KB = 1024;
const BUDGETS = {
  'toybox.iife.js': { minified: 230 * KB, gzip: 75 * KB },
  // 112.5 KB gzipped at 0.5.0, of which about 9 KB is the backgrounds' drag dynamics
  // (reactbits-kit's modules).
  'toybox-all.iife.js': { minified: 360 * KB, gzip: 120 * KB },
};

for (const [name, budget] of Object.entries(BUDGETS)) {
  test(`dist/${name} stays within ${budget.minified / KB} KB minified and ${budget.gzip / KB} KB gzipped`, { skip: distMissing }, () => {
    const bytes = readFileSync(new URL(`../dist/${name}`, import.meta.url));
    const gzip = gzipSync(bytes, { level: 9 }).length;
    assert.ok(bytes.length <= budget.minified, `${name} is ${(bytes.length / KB).toFixed(1)} KB`);
    assert.ok(gzip <= budget.gzip, `${name} is ${(gzip / KB).toFixed(1)} KB gzipped`);
  });
}

test('the all-in-one classic script holds no dice-box or Babylon.js code; the 3D dice load from dice-box/', { skip: distMissing }, () => {
  const code = readFileSync(new URL('../dist/toybox-all.iife.js', import.meta.url), 'utf8');
  assert.doesNotMatch(code, /BABYLON|babylonjs|ammo\.wasm/);
  assert.match(code, /dice-box\//);
});
