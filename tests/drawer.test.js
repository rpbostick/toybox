// The drawer opens one toy at a time, pauses it while the tab is hidden, and opens toys
// paused under reduced motion.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDrawer } from '../src/drawer.js';
import { defineToy } from '../src/runtime.js';
import { createFakeBrowser } from './fake-dom.js';

function makeCatalog(log) {
  const make = (id) => defineToy({ id, name: id, licence: 'MIT' }, (ctx) => {
    log.push(`setup ${id}`);
    ctx.onFrame(() => {});
    return { reset() { log.push(`reset ${id}`); }, destroy() { log.push(`destroy ${id}`); } };
  });
  const toys = { a: make('a'), b: make('b'), c: make('c') };
  // load() resolves on a later tick, like a dynamic import. create() hands back the same
  // object each time, so the tests can watch the instance the drawer mounts.
  const module = (id) => ({ default: { create: () => toys[id] } });
  return { toys, catalog: Object.keys(toys).map((id) => ({ id, load: () => new Promise((resolve) => setTimeout(() => resolve(module(id)), 1)) })) };
}

function setup({ reducedMotion = false } = {}) {
  const log = [];
  const browser = createFakeBrowser();
  const { toys, catalog } = makeCatalog(log);
  const states = [];
  const drawer = createDrawer({
    catalog,
    stage: browser.stage,
    environment: () => ({ theme: 'light', reducedMotion }),
    onChange: (state) => states.push(state),
  });
  return { log, browser, toys, drawer, states };
}

test('opening a second toy destroys the first before mounting the second', async () => {
  const { log, toys, drawer, browser } = setup();
  await drawer.open('a');
  assert.equal(toys.a.running, true);
  await drawer.open('b');
  assert.equal(toys.a.mounted, false);
  assert.equal(toys.b.mounted, true);
  assert.deepEqual(log, ['setup a', 'destroy a', 'setup b']);
  assert.equal(browser.frames.size, 1, 'only the open toy has a frame pending');
  drawer.close();
  assert.equal(toys.b.mounted, false);
  assert.equal(browser.frames.size, 0);
});

test('two quick opens leave only the last one mounted', async () => {
  const { toys, drawer } = setup();
  const first = drawer.open('a');
  const second = drawer.open('b');
  await Promise.all([first, second]);
  assert.equal(toys.a.mounted, false);
  assert.equal(toys.b.mounted, true);
  assert.equal(drawer.state().id, 'b');
  drawer.close();
});

test('closing while a toy loads leaves nothing mounted', async () => {
  const { toys, drawer } = setup();
  const opening = drawer.open('c');
  drawer.close();
  await opening;
  assert.equal(toys.c.mounted, false);
  assert.equal(drawer.state().id, null);
});

test('a hidden tab pauses the open toy and showing it again resumes it', async () => {
  const { toys, drawer, browser } = setup();
  await drawer.open('a');
  drawer.setHidden(true);
  assert.equal(toys.a.running, false);
  assert.equal(browser.frames.size, 0);
  drawer.setHidden(false);
  assert.equal(toys.a.running, true);
  drawer.close();
});

test('a toy paused by the user stays paused when the tab comes back', async () => {
  const { toys, drawer } = setup();
  await drawer.open('a');
  drawer.togglePause();
  drawer.setHidden(true);
  drawer.setHidden(false);
  assert.equal(toys.a.running, false);
  drawer.togglePause();
  assert.equal(toys.a.running, true);
  drawer.close();
});

test('Play on a toy held paused (hidden, or by the running cap) waits for the hold to end; Pause then holds it too', async () => {
  const { toys, drawer } = setup();
  await drawer.open('a');
  drawer.setHidden(true);
  drawer.togglePause();
  assert.equal(toys.a.running, false, 'pausing a held toy does not start it');
  assert.equal(drawer.state().pausedByUser, true);
  drawer.setHidden(false);
  assert.equal(toys.a.running, false, 'paused by the user stays paused');
  drawer.setHidden(true);
  drawer.togglePause();
  assert.equal(toys.a.running, false, 'Play while held does not run it yet');
  drawer.setHidden(false);
  assert.equal(toys.a.running, true, 'it runs once the hold ends');
  drawer.close();
});

test('reduced motion opens toys paused; Play starts them', async () => {
  const { toys, drawer, states } = setup({ reducedMotion: true });
  await drawer.open('a');
  assert.equal(toys.a.running, false);
  assert.equal(states.at(-1).running, false);
  drawer.togglePause();
  assert.equal(toys.a.running, true);
  drawer.close();
});

test('reset reaches the open toy only', async () => {
  const { log, drawer } = setup();
  await drawer.open('a');
  drawer.reset();
  assert.ok(log.includes('reset a'));
  assert.ok(!log.includes('reset b'));
  drawer.close();
});

test('two drawers open the same toy at once, each with its own instance', async () => {
  const toy = defineToy({ id: 'shared', name: 'shared', licence: 'MIT' }, (ctx) => {
    ctx.onFrame(() => {});
    return { reset() {} };
  });
  const catalog = [{ id: 'shared', load: async () => ({ default: toy }) }];
  const browsers = [createFakeBrowser(), createFakeBrowser()];
  const drawers = browsers.map((browser) => createDrawer({ catalog, stage: browser.stage, environment: () => ({ theme: 'light', reducedMotion: false }) }));
  await drawers[0].open('shared');
  await drawers[1].open('shared');
  assert.equal(drawers[0].state().running, true);
  assert.equal(drawers[1].state().running, true);
  assert.equal(toy.mounted, false, "the module's own object stays free");
  drawers[0].close();
  assert.equal(drawers[1].state().running, true, 'closing one leaves the other running');
  assert.equal(browsers[0].frames.size, 0);
  drawers[1].close();
});

test('opening an unknown toy fails loud', async () => {
  const { drawer } = setup();
  await assert.rejects(drawer.open('nope'), /no toy nope/);
});
