// Collects the licence texts of everything dist/ ships: the npm packages esbuild bundled (read
// from its metafiles), the packages copied as files into dist/dice-box/, the open-source code
// adapted into src/ (the toys, a shader hash), and the parts of the music box page. A bundled
// package without a licence text is an error.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// Packages that ship no licence file; their texts are kept in src/licences/.
const LICENCE_OVERRIDES = {
  cubing: ['cubing-mpl.txt', 'cubing-gpl.txt'],
};

// Open-source code adapted (not bundled from npm) into the library.
const toys = (names) => `the library's toys: ${names}`;
const ADAPTED = [
  { name: 'WebGL Fluid Simulation', by: 'Pavel Dobryakov', url: 'https://github.com/PavelDoGreat/WebGL-Fluid-Simulation', licence: 'MIT', file: 'webgl-fluid-simulation.txt', usedBy: toys('Oil and water') },
  { name: 'jquery.ripples', by: 'Pim Schreurs (sirxemic)', url: 'https://github.com/sirxemic/jquery.ripples', licence: 'MIT', file: 'jquery.ripples.txt', usedBy: toys('Ripple tank') },
  { name: 'kaleidoscope', by: 'Kazuhiko Arase', url: 'https://github.com/kazuhikoarase/kaleidoscope', licence: 'MIT', file: 'kaleidoscope.txt', usedBy: toys('Kaleidoscope') },
  { name: 'Galton board', by: 'Lucio Paiva', url: 'https://github.com/luciopaiva/galton', licence: 'MIT', file: 'galton.txt', usedBy: toys('Drip timer') },
  { name: 'double-pendulum', by: 'Christopher Wellons (skeeto)', url: 'https://github.com/skeeto/double-pendulum', licence: 'Unlicense', file: 'double-pendulum.txt', usedBy: toys('Pendulums') },
  { name: 'magnetic-pendulum', by: 'Rob Dawson (codebox)', url: 'https://github.com/codebox/magnetic-pendulum', licence: 'MIT', file: 'magnetic-pendulum.txt', usedBy: toys('Pendulums') },
  { name: 'verlet-js', by: 'Sub Protocol and other contributors', url: 'https://github.com/subprotocol/verlet-js', licence: 'MIT', file: 'verlet-js.txt', usedBy: toys('String and cloth') },
  { name: 'circles (Simple spirograph toy)', by: 'Andrei Kashcha (anvaka)', url: 'https://github.com/anvaka/circles', licence: 'MIT', file: 'circles.txt', usedBy: toys('Spirograph') },
  { name: 'Hash without Sine (hash12, in src/background/effects/shader.js)', by: 'David Hoskins', url: 'https://www.shadertoy.com/view/4djSRW', licence: 'MIT',
    file: 'hash-without-sine.txt', usedBy: "<toy-background>'s shader backgrounds (Aurora, Soap Film, Plasma, Grid Ripples)" },
];

// Files copied as they are from a package into dist/ (not bundled by esbuild), with what they
// carry inside them: dice-box's own build bundles parts of Babylon.js, and its physics worker
// and wasm are ammo.js, a port of Bullet.
const DICE_BOX_USE = '3D dice of <dice-tray> (dist/dice-box/, loaded on first use)';
const COPIED_PACKAGES = ['@3d-dice/dice-box', '@babylonjs/core', '@babylonjs/loaders', '@babylonjs/materials'];
const COPIED_SOURCES = [
  { name: 'ammo.js (inside dice-box: its physics worker and ammo.wasm.wasm)', by: 'the ammo.js contributors', url: 'https://github.com/kripken/ammo.js', licence: 'Zlib', file: 'ammo.js.txt', usedBy: DICE_BOX_USE },
  { name: 'Bullet Physics (inside ammo.js)', by: 'Erwin Coumans', url: 'https://github.com/bulletphysics/bullet3', licence: 'Zlib', file: 'bullet.txt', usedBy: DICE_BOX_USE },
];

// What the music box page ships (built from vendor/tonematrix, not from npm).
const MUSIC_BOX = [
  { name: 'ToneMatrix Redux', by: 'Wolfy (lupine-dev)', url: 'https://github.com/lupine-dev/ToneMatrixRedux', licence: 'GPL-3.0', file: 'tonematrix-redux.txt' },
  { name: 'Tone.js (in ToneMatrix Redux lib/)', by: 'Yotam Mann', url: 'https://github.com/Tonejs/Tone.js', licence: 'MIT; bundles tslib, Apache-2.0', file: 'tone.js.txt' },
  { name: 'tslib (inside Tone.js)', by: 'Microsoft Corporation', url: 'https://github.com/microsoft/tslib', licence: 'Apache-2.0', file: 'apache-2.0.txt' },
  { name: 'clipboard.js 2.0.4 (in ToneMatrix Redux lib/)', by: 'Zeno Rocha', url: 'https://github.com/zenorocha/clipboard.js', licence: 'MIT', file: 'clipboard.js.txt' },
];

/** The npm packages whose code is in a bundle, by name ("@scope/name" or "name"). */
export function bundledPackages(metafile) {
  const names = new Set();
  for (const input of Object.keys(metafile.inputs)) {
    const match = /(?:^|\/)node_modules\/((?:@[^/]+\/)?[^/]+)\//.exec(input);
    if (match) names.add(match[1]);
  }
  return [...names].sort();
}

function packageLicence(root, name) {
  const dir = join(root, 'node_modules', name);
  const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
  const overrides = LICENCE_OVERRIDES[name];
  let text;
  if (overrides) {
    text = overrides.map((file) => readFileSync(join(root, 'src', 'licences', file), 'utf8')).join('\n\n');
  } else {
    const file = readdirSync(dir).find((entry) => /^licen[cs]e(\.md|\.txt)?$/i.test(entry));
    if (!file) throw new Error(`${name} has no licence file and no entry in LICENCE_OVERRIDES`);
    text = readFileSync(join(dir, file), 'utf8');
  }
  if (!manifest.license) throw new Error(`${name} has no "license" in package.json`);
  return { title: `Package: ${name} ${manifest.version} (npm)`, licence: manifest.license, text };
}

function section({ title, licence, usedBy, source, text }) {
  return [
    '='.repeat(78),
    title,
    `Licence: ${licence}`,
    usedBy ? `Used by: ${usedBy}` : null,
    source ? `Source: ${source}` : null,
    '-'.repeat(78),
    text.trim(),
    '',
  ].filter((line) => line !== null).join('\n');
}

function adaptedSection(root, entry, usedBy) {
  return section({
    title: `Adapted source: ${entry.name}, by ${entry.by}`,
    licence: entry.licence,
    usedBy,
    source: entry.url,
    text: readFileSync(join(root, 'src', 'licences', entry.file), 'utf8'),
  });
}

// Which part of dist/ each metafile built, as the licence file names it.
const BUNDLES = {
  library: 'the library as ES modules (dist/toybox.js, dist/toys/, dist/chunks/)',
  classic: 'the toys as a classic script (dist/toybox.iife.js)',
  classicAll: 'the library as one classic script (dist/toybox-all.iife.js)',
  twisty: 'twisty cube page (dist/twisty)',
};

export function thirdPartyLicences({ root, metafiles }) {
  const packages = Object.fromEntries(Object.keys(BUNDLES).map((bundle) => {
    if (!metafiles[bundle]) throw new Error(`no metafile for ${bundle}`);
    return [bundle, bundledPackages(metafiles[bundle])];
  }));
  const usedBy = new Map();
  for (const [bundle, names] of Object.entries(packages)) {
    for (const name of names) usedBy.set(name, [...(usedBy.get(name) ?? []), BUNDLES[bundle]]);
  }
  for (const name of COPIED_PACKAGES) usedBy.set(name, [...(usedBy.get(name) ?? []), DICE_BOX_USE]);
  const packageSections = (names) => names.map((name) => section({ ...packageLicence(root, name), usedBy: usedBy.get(name).join(', ') }));
  const adapted = [...ADAPTED, ...COPIED_SOURCES].map((entry) => adaptedSection(root, entry, entry.usedBy));
  const musicBox = MUSIC_BOX.map((entry) => adaptedSection(root, entry, 'music box page (dist/music-box)'));
  const header = (what) => `Third-party licences: ${what}.\nGenerated by scripts/build.mjs from the bundles' esbuild metafiles, the files copied into dist/dice-box/ and src/licences/.\nToybox's own code is MIT (LICENSE).\n\n`;

  return {
    packages: { ...packages, copied: COPIED_PACKAGES },
    all: header('everything under dist/') + [...packageSections([...usedBy.keys()].sort()), ...adapted, ...musicBox].join('\n'),
    twisty: header('the twisty cube page') + packageSections(packages.twisty).join('\n'),
    musicBox: header('the music box page') + musicBox.join('\n'),
  };
}

export function readLicenceTitles(text) {
  return text.split('\n').filter((line) => /^(Package|Adapted source): /.test(line));
}

export const ADAPTED_SOURCES = [...ADAPTED, ...COPIED_SOURCES];
export const MUSIC_BOX_SOURCES = MUSIC_BOX;
export const hasNodeModules = (root) => existsSync(join(root, 'node_modules', 'matter-js', 'package.json'));
