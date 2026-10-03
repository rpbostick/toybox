// A clean build from a fresh clone of this repository: `git clone` of the working tree into a
// temporary folder, `npm ci`, `bash build.sh`; it must write every file the README's "What
// `bash build.sh` writes" lists, and building the library again must give the same file names
// and bytes. It fetches from npm and GitHub and takes minutes, so it runs only with
// TOYBOX_FRESH_BUILD=1, or as `node tests/fresh-build.test.js --fresh-build`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CATALOG } from '../src/catalog.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const wanted = process.env.TOYBOX_FRESH_BUILD === '1' || process.argv.includes('--fresh-build');
const skip = wanted ? false : 'fetches from npm and GitHub: set TOYBOX_FRESH_BUILD=1 (or run node tests/fresh-build.test.js --fresh-build) to run it';

/** The paths under dist/ the README's build section lists, with toys/<id>.js for every toy. */
function listedFiles(readme) {
  const start = readme.indexOf('### What `bash build.sh` writes');
  if (start < 0) throw new Error('README.md has no "What `bash build.sh` writes" section');
  const section = readme.slice(start, readme.indexOf('\n#', start + 1) < 0 ? undefined : readme.indexOf('\n#', start + 1));
  const items = section.split('\n').filter((line) => line.startsWith('- ')).flatMap((line) => [...line.matchAll(/`([^`]+)`/g)].map((match) => match[1]));
  const paths = items.filter((item) => !item.startsWith('src/')).flatMap((item) => (item === 'toys/<id>.js' ? CATALOG.map((meta) => `toys/${meta.id}.js`) : [item]));
  if (paths.length < 10) throw new Error(`the README's build section lists only ${paths.length} files`);
  return paths;
}

/** Every file under `dir` with the sha256 of its bytes, by path relative to `dir`. */
function digest(dir) {
  const walk = (at) => readdirSync(at, { withFileTypes: true }).flatMap((entry) => (entry.isDirectory() ? walk(join(at, entry.name)) : [join(at, entry.name)]));
  return Object.fromEntries(walk(dir).sort().map((file) => [relative(dir, file), createHash('sha256').update(readFileSync(file)).digest('hex')]));
}

const run = (command, args, cwd) => execFileSync(command, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', maxBuffer: 1 << 26 });

test('the README lists the build\'s files, the toys\' modules included', () => {
  const paths = listedFiles(readFileSync(join(root, 'README.md'), 'utf8'));
  for (const path of ['toybox.js', 'toybox.iife.js', 'toybox-all.iife.js', 'index.html', 'THIRD_PARTY_LICENSES.txt', 'twisty/source.zip', 'music-box/source.zip', `toys/${CATALOG[0].id}.js`]) {
    assert.ok(paths.includes(path), path);
  }
});

/** A clone of this repository at `clone`, installed and built; its dist/ folder. */
function freshBuild(clone) {
  run('git', ['clone', '--quiet', root, clone], tmpdir());
  run('npm', ['ci', '--silent', '--no-audit', '--no-fund'], clone);
  run('bash', ['build.sh'], clone);
  return join(clone, 'dist');
}

// What esbuild writes: the entry points, the toys' modules and the content-hashed chunks.
const library = (dist) => Object.fromEntries(Object.entries(digest(dist)).filter(([path]) => /^(chunks|toys)\/|^toybox(-all)?(\.iife)?\.js$/.test(path)));

test('a fresh clone builds with npm ci and bash build.sh, writes every file the README lists, and builds the library the same twice and in another folder', { skip, timeout: 30 * 60 * 1000 }, () => {
  const temp = mkdtempSync(join(tmpdir(), 'toybox-fresh-'));
  const clone = join(temp, 'toybox');
  try {
    const dist = freshBuild(clone);
    for (const path of listedFiles(readFileSync(join(clone, 'README.md'), 'utf8'))) {
      assert.ok(existsSync(join(dist, path)), `dist/${path}`);
      if (path.endsWith('/')) assert.ok(statSync(join(dist, path)).isDirectory() && readdirSync(join(dist, path)).length > 0, `dist/${path} has files`);
    }
    assert.match(readFileSync(join(dist, 'THIRD_PARTY_LICENSES.txt'), 'utf8'), /^Package: @rpbostick\/reactbits-kit 0\.3\.0 \(npm\)\nLicence: MIT$/m);
    const first = library(dist);
    assert.ok(Object.keys(first).some((path) => path.startsWith('chunks/background-')), 'the background chunk is among them');
    run('node', ['scripts/build.mjs'], clone);
    assert.deepEqual(library(dist), first, 'the second build writes the same chunk names and bytes');
    const elsewhere = freshBuild(join(temp, 'another', 'folder', 'toybox'));
    assert.deepEqual(library(elsewhere), first, 'a clone in another folder builds the same chunk names and bytes');
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});
