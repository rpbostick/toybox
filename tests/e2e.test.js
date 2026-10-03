// The Firefox run (e2e/drive.mjs) on the demo page, served under a sub-path: drives the dice
// tray, the background, the drawing layer, the pages and the image editor, opens every toy in
// the drawer, checks the embeds and the floating window. Skips without Firefox, or before
// build.sh has built the framed pages and copied dice-box (none of which are in git).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serveDist } from '../e2e/serve.mjs';

const firefox = spawnSync('firefox', ['--version'], { encoding: 'utf8' });
const framedBuilt = ['../dist/twisty/app/main.js', '../dist/music-box/app/all.js', '../dist/dice-box/dice-box.es.min.js'].every((path) => existsSync(new URL(path, import.meta.url)));
const skip = firefox.status !== 0 ? 'Firefox is not installed'
  : !framedBuilt ? 'the framed pages and dice-box are not built (bash build.sh)' : false;

test('the demo page drives every element and opens every toy in headless Firefox from a sub-path', { skip, timeout: 330000 }, async () => {
  const server = await serveDist({ prefix: '/somewhere/else/toybox/' });
  const out = mkdtempSync(join(tmpdir(), 'toybox-e2e-'));
  try {
    const drive = fileURLToPath(new URL('../e2e/drive.mjs', import.meta.url));
    const result = await new Promise((resolve) => {
      execFile(process.execPath, [drive, `${server.url}index.html`, out], { timeout: 320000, maxBuffer: 1 << 24 }, (error, stdout, stderr) => resolve({ code: error ? error.code : 0, stdout, stderr }));
    });
    const failures = result.stdout.split('\n').filter((line) => line.startsWith('FAIL'));
    assert.deepEqual(failures, [], result.stderr);
    assert.equal(result.code, 0, result.stdout.slice(-2000));
    assert.match(result.stdout, /^ok +zen-garden: Close empties the panel$/m, 'the run reached the last toy');
  } finally {
    await server.close();
    rmSync(out, { recursive: true, force: true });
  }
});
