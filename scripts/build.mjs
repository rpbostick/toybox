// Builds dist/: the library (dist/toybox.js with dist/toys/ and dist/chunks/, and the classic
// scripts dist/toybox.iife.js and dist/toybox-all.iife.js), dice-box's files for the 3D dice, the demo page, the
// twisty cube page, the music box page and THIRD_PARTY_LICENSES.txt. build.sh runs this after
// fetching ToneMatrix Redux into vendor/.
import { build, transform } from 'esbuild';
import * as sass from 'sass';
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CATALOG } from '../src/catalog.js';
import { DICE_BOX_FILES } from './dice-box-files.mjs';
import { SOURCE_OPTIONS, SOURCE_PLUGINS } from './esbuild-options.mjs';
import { thirdPartyLicences } from './licences.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const scratch = join(root, '.build');
const tonematrix = join(root, 'vendor', 'tonematrix');

mkdirSync(scratch, { recursive: true });

const COMMON = {
  absWorkingDir: root,
  bundle: true,
  minify: true,
  target: 'es2022',
  metafile: true,
  legalComments: 'eof',
  logLevel: 'warning',
  ...SOURCE_OPTIONS,
};

// dist/toys/<id>.js: the toy's module, after setting the asset base from its own URL (dist/
// is the folder above it), so a page can import one toy without toybox.js.
const TOY_ENTRY = 'toybox-toy:';
const toyEntries = {
  name: 'toy-entries',
  setup(builder) {
    builder.onResolve({ filter: /^toybox-toy:/ }, (args) => ({ path: args.path.slice(TOY_ENTRY.length), namespace: 'toybox-toy' }));
    builder.onLoad({ filter: /.*/, namespace: 'toybox-toy' }, (args) => ({
      resolveDir: join(root, 'src'),
      contents: [
        "import { setAssetBase } from './assets.js';",
        "setAssetBase(new URL('../', import.meta.url));",
        `export { default } from './toys/${args.path}.js';`,
      ].join('\n'),
    }));
  },
};

async function bundle({ outdir, metaName, ...options }) {
  const result = await build({ ...COMMON, outdir, ...options });
  writeFileSync(join(scratch, metaName), JSON.stringify(result.metafile, null, 1));
  return result.metafile;
}

// The library as ES modules: one entry, one module per toy, shared chunks.
for (const old of ['app', 'toys', 'chunks', 'toybox.js', 'toybox.iife.js', 'toybox-all.iife.js']) rmSync(join(dist, old), { recursive: true, force: true });
const moduleMeta = await bundle({
  entryPoints: {
    toybox: 'src/toybox.js',
    ...Object.fromEntries(CATALOG.map((meta) => [`toys/${meta.id}`, `${TOY_ENTRY}${meta.id}`])),
  },
  outdir: 'dist',
  format: 'esm',
  splitting: true,
  chunkNames: 'chunks/[name]-[hash]',
  plugins: [toyEntries, ...SOURCE_PLUGINS],
  metaName: 'module-meta.json',
});

// The library as classic scripts: esbuild inlines the toys' and elements' dynamic imports. One
// with the toy elements only, one with every element.
const classicMeta = await bundle({
  entryPoints: { 'toybox.iife': 'src/toybox-iife.js' },
  outdir: 'dist',
  format: 'iife',
  plugins: SOURCE_PLUGINS,
  metaName: 'classic-meta.json',
});
const classicAllMeta = await bundle({
  entryPoints: { 'toybox-all.iife': 'src/toybox-all-iife.js' },
  outdir: 'dist',
  format: 'iife',
  plugins: SOURCE_PLUGINS,
  metaName: 'classic-all-meta.json',
});

cpSync(join(root, 'src', 'demo', 'index.html'), join(dist, 'index.html'));

rmSync(join(dist, 'dice-box'), { recursive: true, force: true });
const diceBoxPackage = join(root, 'node_modules', '@3d-dice', 'dice-box');
for (const file of DICE_BOX_FILES) {
  mkdirSync(dirname(join(dist, 'dice-box', file)), { recursive: true });
  cpSync(join(diceBoxPackage, 'dist', file), join(dist, 'dice-box', file));
}
cpSync(join(diceBoxPackage, 'LICENSE'), join(dist, 'dice-box', 'LICENSE'));

// The twisty cube page: cubing.js and what it bundles.
rmSync(join(dist, 'twisty', 'app'), { recursive: true, force: true });
const twistyMeta = await bundle({ entryPoints: ['src/twisty/main.js'], outdir: 'dist/twisty/app', format: 'esm', splitting: true, metaName: 'twisty-meta.json' });
cpSync(join(root, 'src', 'twisty', 'index.html'), join(dist, 'twisty', 'index.html'));

// The music box page: ToneMatrix Redux built the way its gulpfile does (lib/*.js then
// src/*.js concatenated, then minified; style.scss compiled), with esbuild and sass in
// place of gulp.
const musicBox = join(dist, 'music-box');
rmSync(join(musicBox, 'app'), { recursive: true, force: true });
mkdirSync(join(musicBox, 'app'), { recursive: true });
const scriptsIn = (dir) => readdirSync(join(tonematrix, dir)).filter((name) => name.endsWith('.js')).sort().map((name) => join(tonematrix, dir, name));
const toneMatrixFiles = [...scriptsIn('lib'), ...scriptsIn('src')];
const concatenated = toneMatrixFiles.map((file) => readFileSync(file, 'utf8')).join('\n;\n');
const minified = await transform(concatenated, { minify: true, legalComments: 'inline', target: 'es2019' });
if (!/class ToneMatrix\b/.test(minified.code) && !/ToneMatrix=class/.test(minified.code)) {
  throw new Error('music box: ToneMatrix is not a global in the minified script');
}
writeFileSync(join(musicBox, 'app', 'all.js'), minified.code);
writeFileSync(join(musicBox, 'app', 'style.css'), sass.compile(join(tonematrix, 'src', 'style.scss'), { style: 'compressed' }).css);
for (const asset of ['volume-up.svg', 'volume-mute.svg']) cpSync(join(tonematrix, 'static', asset), join(musicBox, 'app', asset));
cpSync(join(root, 'src', 'music-box', 'index.html'), join(musicBox, 'index.html'));
cpSync(join(root, 'src', 'music-box', 'bridge.js'), join(musicBox, 'bridge.js'));
cpSync(join(tonematrix, 'LICENSE.md'), join(musicBox, 'LICENSE'));

// Licences: one file for everything under dist/, and one next to each framed page.
const licences = thirdPartyLicences({ root, metafiles: { library: moduleMeta, classic: classicMeta, classicAll: classicAllMeta, twisty: twistyMeta } });
writeFileSync(join(dist, 'THIRD_PARTY_LICENSES.txt'), licences.all);
writeFileSync(join(dist, 'twisty', 'LICENSES.txt'), licences.twisty);
writeFileSync(join(musicBox, 'LICENSES.txt'), licences.musicBox);
// Kept with the build so the tests can check the licence file without node_modules.
writeFileSync(join(dist, 'bundled-packages.json'), `${JSON.stringify(licences.packages, null, 2)}\n`);
cpSync(join(root, 'LICENSE'), join(dist, 'LICENSE'));

const count = (meta) => Object.keys(meta.outputs).filter((name) => name.endsWith('.js')).length;
console.log(`built: library ${count(moduleMeta)} modules, classic scripts ${count(classicMeta) + count(classicAllMeta)} files, twisty ${count(twistyMeta)} files, music box from ${toneMatrixFiles.length} ToneMatrix files`);
