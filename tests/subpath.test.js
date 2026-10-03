// The built library served under a sub-path of another host finds its files next to itself:
// the ES modules are imported over HTTP (tests/http-hooks.mjs) so import.meta.url is the
// served URL, and the classic script runs in happy-dom from a <script src>.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { register } from 'node:module';
import { fileURLToPath } from 'node:url';
import { Window } from 'happy-dom';
import { distMissing } from './dist-built.js';
import { createFakeBrowser } from './fake-dom.js';

register('./http-hooks.mjs', import.meta.url);

const PREFIX = '/some/sub/path/toybox/';
// In a child process: the import hooks run on their own thread and wait on this one, so a
// server on this thread would never answer them.
let server;
before(async () => {
  if (distMissing) return;
  const child = spawn(process.execPath, [fileURLToPath(new URL('../e2e/serve.mjs', import.meta.url)), '0', PREFIX], { stdio: ['ignore', 'pipe', 'inherit'] });
  const url = await new Promise((resolve, reject) => {
    let seen = '';
    child.stdout.on('data', (chunk) => {
      seen += chunk;
      const match = /serving dist\/ at (\S+)index\.html/.exec(seen);
      if (match) resolve(match[1]);
    });
    child.on('exit', (code) => reject(new Error(`serve.mjs exited with ${code}: ${seen}`)));
  });
  server = { url, close: () => child.kill() };
});
after(() => server?.close());

const framedBuilt = existsSync(new URL('../dist/twisty/app/main.js', import.meta.url)) && existsSync(new URL('../dist/music-box/app/all.js', import.meta.url))
  ? false : 'the framed pages are not built (bash build.sh)';

test('a per-toy module loaded alone sets the asset base from its own URL', { skip: distMissing }, async () => {
  // First, so that toybox.js has not set the base yet.
  const toy = (await import(`${server.url}toys/twisty-cube.js`)).default;
  assert.equal(toy.id, 'twisty-cube');
  const browser = createFakeBrowser();
  toy.mount(browser.stage, { theme: 'light', reducedMotion: true });
  const frame = browser.stage.children.find((child) => child.tagName === 'IFRAME');
  assert.equal(frame.src, `${server.url}twisty/index.html?theme=light`);
  toy.destroy();
});

test('toybox.js resolves every file it links relative to its own URL, and they are served', { skip: distMissing }, async () => {
  const toybox = await import(`${server.url}toybox.js`);
  assert.equal(toybox.assetUrl('THIRD_PARTY_LICENSES.txt'), `${server.url}THIRD_PARTY_LICENSES.txt`);
  const paths = ['THIRD_PARTY_LICENSES.txt', 'LICENSE', ...toybox.CATALOG.filter((meta) => meta.page).map((meta) => meta.page)];
  for (const path of paths) {
    const response = await fetch(toybox.assetUrl(path));
    assert.equal(response.status, 200, path);
  }
  for (const meta of toybox.CATALOG) {
    const module = await import(`${server.url}toys/${meta.id}.js`);
    assert.equal(module.default.id, meta.id, `toys/${meta.id}.js loads with its chunks`);
  }
});

test('every element\'s chunk is imported relative to toybox.js and loads from under the sub-path', { skip: distMissing }, async () => {
  const entry = await (await fetch(`${server.url}toybox.js`)).text();
  const lazy = [...entry.matchAll(/import\("(\.\/chunks\/[^"]+)"\)/g)].map((match) => match[1]);
  // The dice tray, the background, the drawing layer, the pages, the image editor and the file.
  for (const name of ['tray', 'background', 'layer', 'pages', 'image-editor', 'file']) {
    assert.ok(lazy.some((path) => new RegExp(`^\\./chunks/${name}-[A-Z0-9]+\\.js$`).test(path)), `toybox.js imports the ${name} chunk from ./chunks/`);
  }
  for (const path of lazy) {
    const module = await import(new URL(path, server.url).href);
    assert.ok(Object.keys(module).length > 0, `${path} loads over HTTP with the chunks it imports`);
  }
  const tray = await import(new URL(lazy.find((path) => path.includes('/tray-')), server.url).href);
  assert.equal(typeof tray.mount, 'function');
});

test('the framed pages, their bundles and source zips are served next to the script', { skip: distMissing || framedBuilt }, async () => {
  for (const path of ['twisty/app/main.js', 'twisty/source.zip', 'music-box/app/all.js', 'music-box/source.zip']) {
    assert.equal((await fetch(`${server.url}${path}`)).status, 200, path);
  }
});

/** A happy-dom window on another origin than the server's, as a blog embedding the library from elsewhere. */
function blogWindow() {
  return new Window({ url: 'http://localhost/blog/post.html', settings: { enableJavaScriptEvaluation: true, suppressInsecureJavaScriptEnvironmentWarning: true } });
}

/** Loads one of this repository's built classic scripts into the window with a <script src>. */
async function loadClassic(win, name) {
  const script = win.document.createElement('script');
  script.src = `${server.url}${name}`;
  const loaded = new Promise((resolve, reject) => {
    script.addEventListener('load', resolve);
    script.addEventListener('error', () => reject(new Error(`${name} did not load: ${win.happyDOM.virtualConsolePrinter.readAsString()}`)));
  });
  win.document.head.append(script);
  await loaded;
}

const ALL_TAGS = ['toy-drawer', 'toy-box', 'dice-tray', 'toy-background', 'draw-layer', 'toy-pages'];

test('toybox.iife.js defines the toy elements only; loaded with toybox-all.iife.js, a page has every element and both sets of functions', { skip: distMissing }, async () => {
  for (const order of [['toybox.iife.js', 'toybox-all.iife.js'], ['toybox-all.iife.js', 'toybox.iife.js']]) {
    const win = blogWindow();
    try {
      await loadClassic(win, order[0]);
      if (order[0] === 'toybox.iife.js') {
        assert.deepEqual(ALL_TAGS.filter((tag) => win.customElements.get(tag)), ['toy-drawer', 'toy-box']);
        assert.equal(win.Toybox.registerBackground, undefined);
      }
      await loadClassic(win, order[1]);
      for (const tag of ALL_TAGS) assert.ok(win.customElements.get(tag), `${tag} after ${order.join(' then ')}`);
      for (const name of ['defineToy', 'defineToyElements', 'defineElements', 'registerBackground', 'editImage', 'registerBands']) {
        assert.equal(typeof win.Toybox[name], 'function', `Toybox.${name} after ${order.join(' then ')}`);
      }
    } finally {
      await win.happyDOM.close();
    }
  }
});

test('toybox-all.iife.js from a <script src> defines the elements with assets next to it', { skip: distMissing }, async () => {
  // The evaluated script is this repository's own build.
  const win = blogWindow();
  try {
    await loadClassic(win, 'toybox-all.iife.js');
    for (const tag of ALL_TAGS) assert.ok(win.customElements.get(tag), tag);
    const drawer = win.document.createElement('toy-drawer');
    drawer.setAttribute('toys', 'music-box,pin-art');
    win.document.body.append(drawer);
    assert.equal(drawer.shadowRoot.querySelectorAll('.card').length, 2);
    assert.equal(drawer.shadowRoot.querySelector('.licences').href, `${server.url}THIRD_PARTY_LICENSES.txt`);
    assert.match(drawer.shadowRoot.querySelector('.credits').innerHTML, new RegExp(`href="${server.url}music-box/source\\.zip"`));
  } finally {
    await win.happyDOM.close();
  }
});
