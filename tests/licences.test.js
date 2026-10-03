// The build's licence file lists every bundled package and adapted source, and the GPL and
// MPL toys are only reachable through their own pages, with their source zips linked.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assetUrl, setAssetBase } from '../src/assets.js';
import { CATALOG } from '../src/catalog.js';
import { ADAPTED_SOURCES, MUSIC_BOX_SOURCES, bundledPackages, readLicenceTitles } from '../scripts/licences.mjs';
import { distMissing } from './dist-built.js';
import { createFakeBrowser } from './fake-dom.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = join(root, 'dist');
const licenceText = distMissing ? '' : readFileSync(join(dist, 'THIRD_PARTY_LICENSES.txt'), 'utf8');
const titles = readLicenceTitles(licenceText);
const builtPackages = distMissing ? {} : JSON.parse(readFileSync(join(dist, 'bundled-packages.json'), 'utf8'));
const nodeModulesMissing = existsSync(join(root, 'node_modules', 'esbuild', 'package.json'))
  ? false : 'node_modules not installed (npm ci)';
const COPYLEFT = /GPL|MPL/;
// The drag dynamics' modules (src/background/motion.js), bundled into the background chunk.
const KIT = '@rpbostick/reactbits-kit';
// On another origin than the fake window (http://localhost:8797), as when a page loads the
// library from a CDN.
const BASE = 'https://cdn.example/toybox/';
setAssetBase(BASE);

/** Every JavaScript file of the library as built: the module entry, toys, chunks and the classic script. */
function libraryFiles() {
  const inDir = (dir) => readdirSync(join(dist, dir)).filter((name) => name.endsWith('.js')).map((name) => join(dir, name));
  return ['toybox.js', 'toybox.iife.js', 'toybox-all.iife.js', ...inDir('toys'), ...inDir('chunks')];
}

/** Every file of ours under a directory, recursively; the framed pages and dice-box are third-party builds. */
function ourFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return ['twisty', 'music-box', 'dice-box'].includes(entry.name) && dir === dist ? [] : ourFiles(path);
    return [path];
  });
}

/**
 * A file's text without reactbits-kit's licence section: the kit (MIT, our own modules) ships its
 * licence with a scope note saying it holds no React Bits code, which names React Bits and its
 * licence.
 */
function withoutKitLicence(text) {
  const start = text.indexOf(`Package: ${KIT} `);
  if (start < 0) return text;
  const end = text.indexOf('='.repeat(78), start);
  return text.slice(0, start) + (end < 0 ? '' : text.slice(end));
}

test('no file in src/ or dist/ holds React Bits code, React, ogl, mathjs or rpg-dice-roller', { skip: distMissing }, () => {
  const files = [...ourFiles(join(root, 'src')), ...ourFiles(dist)];
  assert.ok(files.some((file) => file.endsWith('toybox-all.iife.js')) && files.some((file) => file.includes(join('src', 'background'))));
  const banned = [
    // The kit's name is ours ("reactbits-kit"), not React Bits.
    [/react-?bits(?!-kit)/i, 'React Bits'],
    [/Commons Clause/i, "React Bits' licence"],
    [/DavidHDev|David Haz/, "React Bits' author"],
    [/\b(LiquidChrome|SoftAurora|RippleGrid|Balatro|Iridescence|GalaxyProps|ThreadsProps)\b/, 'a React Bits component name'],
    [/from\s*["']react(-dom)?(\/[^"']*)?["']|\breact-dom\b|__SECRET_INTERNALS|react\.element/, 'React'],
    [/from\s*["']ogl["']/, 'ogl'],
    [/mathjs|typed-function|decimal\.js/i, 'mathjs'],
    [/rpg-dice-roller|random-js/, 'rpg-dice-roller'],
  ];
  for (const file of files) {
    const text = withoutKitLicence(readFileSync(file, 'utf8'));
    for (const [pattern, what] of banned) assert.doesNotMatch(text, pattern, `${file}: ${what}`);
  }
  for (const name of ['react', 'react-dom', 'scheduler', 'ogl', 'mathjs', '@dice-roller/rpg-dice-roller']) {
    assert.ok(!Object.values(builtPackages).flat().includes(name), `${name} is not bundled`);
  }
});

test('THIRD_PARTY_LICENSES lists every package the build bundled or copied', { skip: distMissing }, () => {
  assert.deepEqual(Object.keys(builtPackages).sort(), ['classic', 'classicAll', 'copied', 'library', 'twisty']);
  const all = Object.values(builtPackages).flat();
  assert.ok(all.includes('matter-js') && all.includes('cubing'), 'the package list is not empty');
  for (const name of all) {
    assert.ok(titles.some((title) => title.startsWith(`Package: ${name} `)), `${name} has a section`);
  }
});

test('the licence list is complete for the dice tray, the backgrounds and the drawing elements', { skip: distMissing }, () => {
  // What the elements ship, by what they are: the drawing libraries, dice-box and what its own
  // build carries, and the hash the shader backgrounds use.
  for (const name of ['perfect-freehand', 'idb-keyval', '@3d-dice/dice-box', '@babylonjs/core', KIT]) {
    assert.ok(titles.some((title) => title.startsWith(`Package: ${name} `)), `${name} has a section`);
  }
  const kit = licenceText.slice(licenceText.indexOf(`Package: ${KIT} `));
  assert.match(kit, /^Package: @rpbostick\/reactbits-kit 0\.3\.0 \(npm\)\nLicence: MIT\nUsed by: [^\n]*dist\/chunks/, 'the kit\'s modules, MIT, in the background chunk');
  assert.ok(builtPackages.library.includes(KIT) && !builtPackages.library.some((name) => /ts-morph|postcss/.test(name)), 'its modules only, not its codemod tooling');
  for (const source of ['Hash without Sine', 'ammo.js', 'Bullet Physics']) {
    assert.ok(titles.some((title) => title.startsWith(`Adapted source: ${source}`)), `${source} has a section`);
  }
  assert.match(readFileSync(join(root, 'src', 'background', 'effects', 'shader.js'), 'utf8'), /"Hash without Sine" by David Hoskins \(MIT/, 'credited where it is used');
});

test('every package the library ships is a dependency the build pins, and each has its licence text', { skip: distMissing || nodeModulesMissing }, () => {
  const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  for (const name of ['@3d-dice/dice-box', 'idb-keyval', 'perfect-freehand']) {
    assert.ok(manifest.devDependencies[name], `${name} is in devDependencies`);
  }
  for (const name of [...builtPackages.library, ...builtPackages.copied]) {
    const section = licenceText.slice(licenceText.indexOf(`Package: ${name} `));
    assert.ok(section.length > 200, `${name}: its section has a licence text`);
  }
});

test('THIRD_PARTY_LICENSES lists every adapted source and every part of the music box', { skip: distMissing }, () => {
  for (const entry of [...ADAPTED_SOURCES, ...MUSIC_BOX_SOURCES]) {
    assert.ok(titles.some((title) => title.startsWith(`Adapted source: ${entry.name},`)), `${entry.name} has a section`);
  }
  assert.match(licenceText, /GNU GENERAL PUBLIC LICENSE/);
  assert.match(licenceText, /Mozilla Public License/);
  assert.doesNotMatch(licenceText, /spikes\//);
});

test('the built package list matches what esbuild bundles now', { skip: distMissing || nodeModulesMissing }, async () => {
  const { build } = await import('esbuild');
  const { SOURCE_OPTIONS, SOURCE_PLUGINS } = await import('../scripts/esbuild-options.mjs');
  const packagesOf = async (entry) => {
    const result = await build({ absWorkingDir: root, entryPoints: [entry], bundle: true, format: 'esm', splitting: true, outdir: 'out', write: false, metafile: true,
      ...SOURCE_OPTIONS, plugins: SOURCE_PLUGINS, logLevel: 'silent' });
    return bundledPackages(result.metafile);
  };
  assert.deepEqual(await packagesOf('src/toybox.js'), builtPackages.library);
  assert.deepEqual(await packagesOf('src/toybox-iife.js'), builtPackages.classic);
  assert.deepEqual(await packagesOf('src/toybox-all-iife.js'), builtPackages.classicAll);
  assert.deepEqual(await packagesOf('src/twisty/main.js'), builtPackages.twisty);
});

test('the library bundles no GPL or MPL package', { skip: distMissing }, () => {
  for (const name of [...builtPackages.library, ...builtPackages.classic, ...builtPackages.classicAll]) {
    const manifest = join(root, 'node_modules', name, 'package.json');
    if (existsSync(manifest)) assert.doesNotMatch(JSON.parse(readFileSync(manifest, 'utf8')).license, COPYLEFT, name);
    assert.ok(!['cubing', 'three'].includes(name), name);
  }
});

test("the library's built code contains no cubing.js, three.js or ToneMatrix code", { skip: distMissing }, () => {
  const files = libraryFiles();
  assert.ok(files.length > 3);
  for (const name of files) {
    const code = readFileSync(join(dist, name), 'utf8');
    assert.doesNotMatch(code, /["'`]twisty-player["'`]|THREE\./, `${name}: no cubing.js or three.js code`);
    assert.doesNotMatch(code, /Tone\.Transport|class ToneMatrix|new ToneMatrix/, `${name}: no ToneMatrix or Tone.js code`);
  }
});

test('every GPL or MPL toy has its own page and frames it, resolved against the asset base', { skip: distMissing }, async () => {
  const copyleft = CATALOG.filter((meta) => COPYLEFT.test(meta.licence));
  assert.deepEqual(copyleft.map((meta) => meta.id).sort(), ['music-box', 'twisty-cube']);
  for (const meta of copyleft) {
    assert.ok(meta.page, `${meta.id} names its page`);
    assert.ok(existsSync(join(dist, meta.page)), `${meta.page} is built`);
    const source = readFileSync(join(root, 'src', 'toys', `${meta.id}.js`), 'utf8');
    const imports = [...source.matchAll(/from '([^']+)'/g)].map((match) => match[1]).sort();
    assert.deepEqual(imports, ['../catalog.js', '../runtime.js', './framed-page.js'], `${meta.id} imports only our framing code`);
    const toy = (await meta.load()).default;
    const browser = createFakeBrowser();
    toy.mount(browser.stage, { theme: 'dark', reducedMotion: false });
    const frame = browser.stage.children.find((child) => child.tagName === 'IFRAME');
    assert.equal(frame.src, `${BASE}${meta.page}?theme=dark`);
    toy.destroy();
  }
});

test("a framed toy's panel links its source zip next to its page", async () => {
  for (const meta of CATALOG.filter((entry) => entry.page)) {
    assert.equal(meta.sourceZip, `${meta.page.split('/')[0]}/source.zip`);
    const toy = (await meta.load()).default;
    const browser = createFakeBrowser();
    toy.mount(browser.stage, { theme: 'light', reducedMotion: true });
    const bar = browser.stage.children.find((child) => child.className === 'toy-controls');
    const link = bar.children.find((child) => child.tagName === 'A');
    assert.equal(link.href, assetUrl(meta.sourceZip));
    assert.match(link.textContent, /Source code/);
    toy.destroy();
  }
});

test("framed toys send commands only after their page says it is ready, only to it and to its origin", async () => {
  const meta = CATALOG.find((entry) => entry.id === 'twisty-cube');
  const toy = (await meta.load()).default;
  const browser = createFakeBrowser();
  toy.mount(browser.stage, { theme: 'light', reducedMotion: false });
  const frame = browser.stage.children.find((child) => child.tagName === 'IFRAME');
  toy.reset();
  assert.deepEqual(frame.contentWindow.posted, [], 'nothing posted before ready');
  browser.win.dispatch('message', { source: {}, data: { toy: 'twisty-cube', type: 'ready' } });
  assert.deepEqual(frame.contentWindow.posted, [], 'a ready message from another window is ignored');
  browser.win.dispatch('message', { source: frame.contentWindow, data: { toy: 'twisty-cube', type: 'ready' } });
  // 'resume' is the start at mount, queued with the reset until the page was ready.
  assert.deepEqual(frame.contentWindow.posted.map((item) => item.message.type), ['resume', 'reset']);
  assert.equal(frame.contentWindow.posted[0].origin, 'https://cdn.example', "posted to the frame's origin, not the embedding page's");
  toy.pause();
  assert.deepEqual(frame.contentWindow.posted.map((item) => item.message.type), ['resume', 'reset', 'pause']);
  toy.destroy();
});

test('the framed pages link their licence and source, and say ready to any embedding origin', { skip: distMissing }, () => {
  const musicBox = readFileSync(join(dist, 'music-box', 'index.html'), 'utf8');
  assert.match(musicBox, /href="LICENSE"/);
  assert.match(musicBox, /href="source\.zip"/);
  assert.ok(existsSync(join(dist, 'music-box', 'LICENSE')));
  assert.ok(existsSync(join(dist, 'music-box', 'SOURCE.md')));
  const bridge = readFileSync(join(dist, 'music-box', 'bridge.js'), 'utf8');
  assert.match(bridge, /addEventListener\('click', start\)/);
  assert.match(bridge, /postMessage\(\{ toy: TOY, type: 'ready' \}, '\*'\)/);
  assert.doesNotMatch(musicBox, /new ToneMatrix/, 'the page does not start ToneMatrix on load');
  const twisty = readFileSync(join(dist, 'twisty', 'index.html'), 'utf8');
  assert.match(twisty, /href="LICENSES\.txt"/);
  assert.match(twisty, /href="source\.zip"/);
  assert.ok(existsSync(join(dist, 'twisty', 'SOURCE.md')));
  assert.ok(existsSync(join(dist, 'twisty', 'LICENSES.txt')));
});

test('dist/ carries our licence, and the demo page links the licence file without loading the framed pages\' code', { skip: distMissing }, () => {
  assert.equal(readFileSync(join(dist, 'LICENSE'), 'utf8'), readFileSync(join(root, 'LICENSE'), 'utf8'));
  assert.match(readFileSync(join(root, 'LICENSE'), 'utf8'), /^MIT License/);
  const page = readFileSync(join(dist, 'index.html'), 'utf8');
  assert.match(page, /href="THIRD_PARTY_LICENSES\.txt"/);
  assert.doesNotMatch(page, /twisty\/app|music-box\/app/);
});
