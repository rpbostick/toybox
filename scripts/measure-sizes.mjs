// Measures each toy, minified and gzipped, and writes SIZES.md.
// A toy's own size is its module bundled alone with the shared pieces left out (the drawer
// runtime and catalog, and matter.js for the physics toys), so the numbers add up instead of
// counting matter.js four times; the shared pieces get their own rows. The two framed pages
// are measured as built on disk.
import { build } from 'esbuild';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { CATALOG } from '../src/catalog.js';
import { SOURCE_OPTIONS, SOURCE_PLUGINS } from './esbuild-options.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const gzip = (bytes) => gzipSync(bytes, { level: 9 }).length;
const kb = (bytes) => (bytes / 1024).toFixed(1);

// Left out of a measurement: what the toys share, and the elements' own chunks (measured as
// built, below), so the elements' row is what toybox.js itself holds.
const SHARED = /(^|\/)(runtime|catalog)\.js$|(^|\/)(dice\/tray|background\/background|draw\/(layer|pages|file|image-editor))\.js$/;
const leaveOutShared = {
  name: 'leave-out-shared',
  setup(builder) {
    builder.onResolve({ filter: SHARED }, (args) => ({ path: args.path, external: true }));
  },
};

async function minified(entry, { external = [], plugins = [] } = {}) {
  const result = await build({
    absWorkingDir: root,
    entryPoints: [entry],
    bundle: true,
    format: 'esm',
    minify: true,
    target: 'es2022',
    write: false,
    external,
    plugins: [...plugins, ...SOURCE_PLUGINS],
    ...SOURCE_OPTIONS,
    logLevel: 'silent',
    metafile: true,
  });
  const code = result.outputFiles[0].contents;
  const externals = Object.values(result.metafile.outputs).flatMap((output) => output.imports.filter((item) => item.external).map((item) => item.path));
  return { bytes: code.length, gzip: gzip(code), externals };
}

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)]);
}

function onDisk(dir, filter = () => true) {
  const files = walk(join(root, dir)).filter(filter);
  return {
    files: files.length,
    bytes: files.reduce((sum, file) => sum + statSync(file).size, 0),
    gzip: files.reduce((sum, file) => sum + gzip(readFileSync(file)), 0),
  };
}

const rows = [];
for (const meta of CATALOG) {
  const size = await minified(`src/toys/${meta.id}.js`, { external: ['matter-js'], plugins: [leaveOutShared] });
  const usesMatter = size.externals.includes('matter-js');
  rows.push({ name: meta.name, ...size, usesMatter, note: [usesMatter ? '+ matter.js' : '', meta.page ? `+ own page (${meta.page.split('/')[0]})` : ''].filter(Boolean).join(' ') });
}

const matter = await minified('node_modules/matter-js/build/matter.js');
const shared = await minified('src/runtime.js', { plugins: [] });
const elements = await minified('src/toybox.js', { external: ['matter-js'], plugins: [leaveOutShared] });
const library = onDisk('dist', (file) => /dist\/(toybox\.js|toys\/|chunks\/)/.test(file));
const classic = onDisk('dist', (file) => file.endsWith('dist/toybox.iife.js'));
const classicAll = onDisk('dist', (file) => file.endsWith('dist/toybox-all.iife.js'));
const twisty = onDisk('dist/twisty', (file) => !file.endsWith('source.zip'));
const twistyApp = onDisk('dist/twisty/app');
const musicBox = onDisk('dist/music-box', (file) => !file.endsWith('source.zip'));
const musicBoxApp = onDisk('dist/music-box/app');
const zipSize = (page) => statSync(join(root, 'dist', page, 'source.zip')).size;

// The ES module build as a page loads it: toybox.js, then each chunk on first use. What a chunk
// holds is named from the inputs esbuild put in it.
const moduleMeta = JSON.parse(readFileSync(join(root, '.build', 'module-meta.json'), 'utf8'));
function holds(output) {
  const parts = new Set();
  for (const input of Object.keys(output.inputs)) {
    const pkg = /(?:^|\/)node_modules\/((?:@[^/]+\/)?[^/]+)\//.exec(input);
    if (pkg) parts.add(pkg[1]);
    else if (input.startsWith('src/')) parts.add(input.replace(/^src\//, '').replace(/\/[^/]+$/, '/').replace(/^[^/]+\.js$/, (name) => name));
  }
  return parts.size ? [...parts].sort().join(', ') : "esbuild's module helpers";
}
const loadedBy = (name) => {
  if (name === 'dist/toybox.js') return 'the page';
  const importers = Object.entries(moduleMeta.outputs).filter(([, output]) => output.imports.some((item) => item.path === name)).map(([other]) => other.replace(/^dist\//, '')).sort();
  if (!importers.length) return '—';
  return importers.length > 3 ? `${importers.slice(0, 3).join(', ')} and ${importers.length - 3} more` : importers.join(', ');
};
const chunkRows = Object.entries(moduleMeta.outputs)
  .filter(([name]) => name.endsWith('.js') && !name.startsWith('dist/toys/'))
  .map(([name, output]) => {
    const bytes = readFileSync(join(root, name));
    return { name: name.replace(/^dist\//, ''), bytes: bytes.length, gzip: gzip(bytes), holds: holds(output), entry: output.entryPoint ?? '' };
  })
  .sort((a, b) => (a.name === 'toybox.js' ? -1 : b.name === 'toybox.js' ? 1 : b.bytes - a.bytes));
const chunkTable = [
  '| File | Minified | Gzipped | Holds | Imported by |',
  '|---|---:|---:|---|---|',
  ...chunkRows.map((row) => `| \`${row.name}\` | ${kb(row.bytes)} KB | ${kb(row.gzip)} KB | ${row.entry ? `\`${row.entry}\`: ` : ''}${row.holds} | ${loadedBy(`dist/${row.name}`)} |`),
].join('\n');
const diceBox = onDisk('dist/dice-box');

const table = [
  '| Toy | Minified | Gzipped | Also needs |',
  '|---|---:|---:|---|',
  ...rows.map((row) => `| ${row.name} | ${kb(row.bytes)} KB | ${kb(row.gzip)} KB | ${row.note || '—'} |`),
].join('\n');

const text = `# Toy sizes

Written by \`scripts/measure-sizes.mjs\` (run by \`build.sh\`). KB = 1024 bytes; gzip is level 9.

## Each toy's own code

Each toy module bundled alone and minified with esbuild, leaving out what toys share: the
toy runtime and catalog, and matter.js for the physics toys. For the two framed toys this is
only the small module that frames the page; the page itself is measured below.

${table}

## Shared pieces

| Piece | Minified | Gzipped |
|---|---:|---:|
| matter.js ${JSON.parse(readFileSync(join(root, 'node_modules', 'matter-js', 'package.json'), 'utf8')).version} (${rows.filter((row) => row.usesMatter).map((row) => row.name).join(', ')}) | ${kb(matter.bytes)} KB | ${kb(matter.gzip)} KB |
| Toy runtime (\`src/runtime.js\`) | ${kb(shared.bytes)} KB | ${kb(shared.gzip)} KB |
| The elements' classes and card drawings (\`src/toybox.js\` without the toys, the elements' chunks, catalogue loader and runtime) | ${kb(elements.bytes)} KB | ${kb(elements.gzip)} KB |

## The library as built

| Build | Files | On disk | Gzipped |
|---|---:|---:|---:|
| ES modules: \`dist/toybox.js\`, \`dist/toys/\`, \`dist/chunks/\` (a page loads the entry and only the toys and elements it uses) | ${library.files} | ${kb(library.bytes)} KB | ${kb(library.gzip)} KB |
| Classic script: \`dist/toybox.iife.js\` (the toys, \`<toy-drawer>\` and \`<toy-box>\`, in one file) | ${classic.files} | ${kb(classic.bytes)} KB | ${kb(classic.gzip)} KB |
| Classic script: \`dist/toybox-all.iife.js\` (every toy and element in one file) | ${classicAll.files} | ${kb(classicAll.bytes)} KB | ${kb(classicAll.gzip)} KB |
| dice-box for the 3D dice, \`dist/dice-box/\` (loaded when 3D is switched on; copied by \`build.sh\` from the npm package) | ${diceBox.files} | ${kb(diceBox.bytes)} KB | ${kb(diceBox.gzip)} KB |

## The base script and its chunks

What a page using \`dist/toybox.js\` downloads: the script itself, then each chunk the first time
something needs it (the dice tray's chunk when a \`<dice-tray>\` connects, the background's chunk
when a \`<toy-background>\` connects, and so on). Each
\`dist/toys/<id>.js\` entry (not listed) is a few hundred bytes that import the toy's chunk.

${chunkTable}

## Framed pages

| Page | Files | On disk | Gzipped | Of which |
|---|---:|---:|---:|---|
| Twisty cube, \`dist/twisty/\` (without source.zip) | ${twisty.files} | ${kb(twisty.bytes)} KB | ${kb(twisty.gzip)} KB | \`app/\`: ${kb(twistyApp.bytes)} KB, ${twistyApp.files} files |
| Twisty cube source, \`dist/twisty/source.zip\` | 1 | ${kb(zipSize('twisty'))} KB | — | |
| Music box, \`dist/music-box/\` (without source.zip) | ${musicBox.files} | ${kb(musicBox.bytes)} KB | ${kb(musicBox.gzip)} KB | \`app/\`: ${kb(musicBoxApp.bytes)} KB, ${musicBoxApp.files} files |
| Music box source, \`dist/music-box/source.zip\` | 1 | ${kb(zipSize('music-box'))} KB | — | |

Nothing under \`dist/\` is in git: \`build.sh\` writes all of it (the framed pages from pinned
upstream sources, each with its source zip), and the release zip (\`scripts/release.sh\`)
holds it.
`;

writeFileSync(join(root, 'SIZES.md'), text);
console.log(`wrote ${relative(process.cwd(), join(root, 'SIZES.md'))}`);
