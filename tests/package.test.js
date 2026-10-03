// The npm package: its exports resolve to built files (through Node's own resolver, by the
// package's name), and it ships only dist/, the licence, the README and the changelog.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CATALOG } from '../src/catalog.js';
import { distMissing } from './dist-built.js';

const root = new URL('../', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'));

test('the package is @rpbostick/toybox with a semantic version and a changelog entry for it', () => {
  assert.equal(manifest.name, '@rpbostick/toybox');
  assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
  const changelog = readFileSync(new URL('CHANGELOG.md', root), 'utf8');
  assert.match(changelog, new RegExp(`^## ${manifest.version.replaceAll('.', '\\.')} `, 'm'));
  assert.deepEqual(manifest.dependencies ?? {}, {}, 'the build is self-contained; consumers install nothing else');
});

test('every export resolves by the package name to a built file', { skip: distMissing }, async () => {
  const resolved = (specifier) => fileURLToPath(import.meta.resolve(specifier));
  assert.equal(resolved('@rpbostick/toybox'), fileURLToPath(new URL('dist/toybox.js', root)));
  assert.equal(resolved('@rpbostick/toybox/toybox.iife.js'), fileURLToPath(new URL('dist/toybox.iife.js', root)));
  assert.equal(resolved('@rpbostick/toybox/toybox-all.iife.js'), fileURLToPath(new URL('dist/toybox-all.iife.js', root)));
  for (const meta of CATALOG) {
    const file = resolved(`@rpbostick/toybox/toys/${meta.id}`);
    assert.equal(file, fileURLToPath(new URL(`dist/toys/${meta.id}.js`, root)));
    assert.ok(existsSync(file), file);
  }
  const library = await import('@rpbostick/toybox');
  assert.equal(library.CATALOG.length, CATALOG.length);
  assert.equal(typeof library.defineElements, 'function');
  assert.equal(typeof library.registerBackground, 'function');
  const cradle = await import('@rpbostick/toybox/toys/newtons-cradle');
  assert.equal(cradle.default.id, 'newtons-cradle');
});

test('npm pack ships dist/ (git-ignored, but named in "files"), the licence, README, changelog and package.json only', { skip: distMissing }, () => {
  const [pack] = JSON.parse(execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], { cwd: fileURLToPath(root), encoding: 'utf8' }));
  const paths = pack.files.map((file) => file.path);
  const outside = paths.filter((path) => !path.startsWith('dist/') && !['LICENSE', 'CHANGELOG.md', 'README.md', 'package.json'].includes(path));
  assert.deepEqual(outside, []);
  for (const path of ['dist/toybox.js', 'dist/toybox.iife.js', 'dist/toybox-all.iife.js', 'dist/THIRD_PARTY_LICENSES.txt', 'dist/LICENSE', 'LICENSE']) assert.ok(paths.includes(path), path);
});
