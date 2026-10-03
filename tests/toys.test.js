// Every toy implements the drawer's interface, and mount / pause / resume / reset / destroy
// leave nothing running: no animation frames, listeners, timers, observers, audio or DOM.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { setAssetBase } from '../src/assets.js';
import { CATALOG } from '../src/catalog.js';
import { createFakeBrowser, swipe } from './fake-dom.js';

const MATTER_TOYS = new Set(['newtons-cradle', 'drip-timer', 'stacking-blocks']);
const matterInstalled = existsSync(fileURLToPath(new URL('../node_modules/matter-js/package.json', import.meta.url)));
const skipFor = (id) => (MATTER_TOYS.has(id) && !matterInstalled ? 'node_modules not installed (npm ci)' : false);
// The framed toys resolve their pages against it.
setAssetBase('http://localhost:8797/toybox/');

test('the catalog has sixteen toys with unique ids', () => {
  assert.equal(CATALOG.length, 16);
  assert.equal(new Set(CATALOG.map((meta) => meta.id)).size, 16);
});

for (const meta of CATALOG) {
  test(`${meta.id}: implements the toy interface`, { skip: skipFor(meta.id) }, async () => {
    const toy = (await meta.load()).default;
    assert.equal(toy.id, meta.id);
    assert.equal(toy.name, meta.name);
    assert.equal(toy.licence, meta.licence);
    for (const method of ['mount', 'pause', 'resume', 'reset', 'destroy', 'create']) assert.equal(typeof toy[method], 'function', method);
  });

  test(`${meta.id}: mount, play, pause, resume, reset and destroy leave nothing running`, { skip: skipFor(meta.id) }, async () => {
    const toy = (await meta.load()).default;
    const browser = createFakeBrowser();
    const { stage, frames } = browser;
    const listenersBefore = browser.listenerCount();

    toy.mount(stage, { theme: 'light', reducedMotion: false });
    assert.equal(toy.running, true);
    assert.equal(frames.size, 1, 'one animation frame pending while running');
    assert.ok(stage.children.length > 0, 'the toy put something on the stage');

    browser.runFrames(5);
    assert.equal(frames.size, 1, 'still exactly one frame pending after running frames');
    const surface = stage.children.find((child) => child.tagName === 'CANVAS');
    if (surface) {
      swipe(surface, [200, 200], [260, 230]);
      swipe(surface, [120, 300], [100, 120], 2);
      browser.runFrames(3);
    }

    toy.pause();
    assert.equal(toy.running, false);
    assert.equal(frames.size, 0, 'no frame pending while paused');
    toy.reset();
    assert.equal(frames.size, 0, 'reset while paused does not restart the loop');
    toy.resume();
    assert.equal(frames.size, 1);
    toy.reset();
    browser.runFrames(2);

    toy.destroy();
    assert.equal(toy.mounted, false);
    assert.equal(frames.size, 0, 'no animation frame left');
    assert.equal(browser.timers.size, 0, 'no timer left');
    assert.equal(browser.observers.size, 0, 'no resize observer left');
    assert.equal(browser.listenerCount(), listenersBefore, 'every listener removed');
    assert.deepEqual(stage.children, [], 'every element the toy added is gone');
    for (const audio of browser.audioContexts) assert.equal(audio.state, 'closed', 'audio closed');
  });

  test(`${meta.id}: reduced motion mounts paused and draws a still frame`, { skip: skipFor(meta.id) }, async () => {
    const toy = (await meta.load()).default;
    const browser = createFakeBrowser();
    toy.mount(browser.stage, { theme: 'dark', reducedMotion: true });
    assert.equal(toy.running, false);
    assert.equal(browser.frames.size, 0);
    toy.resume();
    assert.equal(browser.frames.size, 1);
    toy.destroy();
    assert.equal(browser.frames.size, 0);
  });

  test(`${meta.id}: refuses a second mount and calls after destroy`, { skip: skipFor(meta.id) }, async () => {
    const toy = (await meta.load()).default;
    const browser = createFakeBrowser();
    toy.mount(browser.stage, { theme: 'light', reducedMotion: true });
    assert.throws(() => toy.mount(browser.stage, { theme: 'light', reducedMotion: true }), /already mounted/);
    toy.destroy();
    assert.throws(() => toy.pause(), /not mounted/);
    assert.throws(() => toy.destroy(), /not mounted/);
  });
}

test('the five toys written here say MIT', async () => {
  const own = CATALOG.filter((meta) => !meta.source);
  assert.deepEqual(own.map((meta) => meta.id), ['lava-lamp', 'pin-art', 'bubble-wrap', 'fidget-spinner', 'zen-garden']);
  for (const meta of own) {
    assert.equal(meta.licence, 'MIT', meta.id);
    assert.equal((await meta.load()).default.licence, 'MIT', `${meta.id} module`);
  }
});

test('create() gives an independent instance of the same toy', async () => {
  const toy = (await CATALOG.find((meta) => meta.id === 'lava-lamp').load()).default;
  const other = toy.create();
  assert.notEqual(other, toy);
  assert.equal(other.id, toy.id);
  const browser = createFakeBrowser();
  toy.mount(browser.stage, { theme: 'light', reducedMotion: false });
  other.mount(browser.stage, { theme: 'dark', reducedMotion: false });
  toy.destroy();
  assert.equal(other.running, true);
  other.destroy();
  assert.equal(browser.frames.size, 0);
});

test('mount fails loud without a theme', async () => {
  const toy = (await CATALOG.find((meta) => meta.id === 'bubble-wrap').load()).default;
  const browser = createFakeBrowser();
  assert.throws(() => toy.mount(browser.stage, {}), /theme/);
  assert.equal(toy.mounted, false);
});

test('bubble wrap: popping every bubble plays pops and refills after a timer', async () => {
  const toy = (await CATALOG.find((meta) => meta.id === 'bubble-wrap').load()).default;
  const browser = createFakeBrowser();
  toy.mount(browser.stage, { theme: 'light', reducedMotion: false });
  browser.runFrames(60); // let the sheet inflate
  const canvas = browser.stage.children.find((child) => child.tagName === 'CANVAS');
  // Press everywhere on a fine grid; every bubble is under at least one press.
  for (let y = 0; y < 400; y += 8) {
    for (let x = 0; x < 400; x += 8) canvas.dispatch('pointerdown', { clientX: x, clientY: y, pointerId: 1, button: 0 });
  }
  assert.equal(browser.audioContexts.length, 1, 'one audio context, made on the first pop');
  assert.equal(browser.timers.size, 1, 'a refill is scheduled once the sheet is all popped');
  browser.runTimers();
  toy.destroy();
  assert.equal(browser.audioContexts[0].state, 'closed');
});

test('closing a toy right after Play does not leave a rejected audio promise', async () => {
  const rejections = [];
  const record = (reason) => rejections.push(reason);
  process.on('unhandledRejection', record);
  try {
    const toy = (await CATALOG.find((meta) => meta.id === 'bubble-wrap').load()).default;
    const browser = createFakeBrowser();
    toy.mount(browser.stage, { theme: 'light', reducedMotion: false });
    browser.runFrames(60);
    const canvas = browser.stage.children.find((child) => child.tagName === 'CANVAS');
    canvas.dispatch('pointerdown', { clientX: 200, clientY: 177, pointerId: 1, button: 0 }); // a bubble's centre
    assert.equal(browser.audioContexts.length, 1);
    toy.pause();
    await new Promise((done) => setImmediate(done));
    toy.resume(); // resume() of the suspended audio is now in flight
    toy.destroy(); // and the context closes under it
    await new Promise((done) => setTimeout(done, 20));
    assert.deepEqual(rejections.map(String), []);
  } finally {
    process.off('unhandledRejection', record);
  }
});

test('WebGL toys explain themselves when WebGL is missing, and still tear down cleanly', async () => {
  for (const id of ['oil-and-water', 'ripple-tank']) {
    const toy = (await CATALOG.find((meta) => meta.id === id).load()).default;
    const browser = createFakeBrowser({ webgl: false });
    toy.mount(browser.stage, { theme: 'light', reducedMotion: false });
    const message = browser.stage.children.find((child) => child.tagName === 'P');
    assert.match(message.textContent, /needs WebGL/);
    toy.destroy();
    assert.deepEqual(browser.stage.children, []);
    assert.equal(browser.frames.size, 0);
  }
});
