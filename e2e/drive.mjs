// Opens the demo page (dist/index.html) in headless Firefox and, in its <toy-drawer
// id="drawer">, opens every toy, plays with it through real (trusted) pointer input over
// WebDriver BiDi, and saves a screenshot of each mid-play. Also checks the <toy-box> embeds
// pause off screen and run on screen, and the floating drawer: its window dragged, three toys
// open in windows of their own, one moved, one minimized and one closed. In the twisty cube:
// R and Shift+R by key (solved again), a move button, Undo, a click on the cube and the
// instructions panel.
// Also drives the page's elements: the dice tray, dragging the background, the drawing layer
// and its eyedropper, the pages and the image editor.
// Usage:
//   node e2e/drive.mjs <demo page url> <output dir> [--dark] [--reduced-motion]
// --reduced-motion also checks every toy opens paused (then presses Play and plays as usual).
// The url is http(s):// (module scripts do not load from file:// in Firefox); e2e/serve.mjs
// serves dist/ under a sub-path. Writes <id>.png per toy and results.json; exits 1 when a
// check fails.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { launchFirefox } from './bidi.js';
import { CATALOG } from '../src/catalog.js';

const [pageUrl, outArg, ...flags] = process.argv.slice(2);
if (!pageUrl || !outArg) {
  console.error('usage: node e2e/drive.mjs <demo page url> <output dir> [--dark] [--reduced-motion]');
  process.exit(2);
}
const dark = flags.includes('--dark');
const reducedMotion = flags.includes('--reduced-motion');
const suffix = `${dark ? '-dark' : ''}${reducedMotion ? '-reduced' : ''}`;
const out = resolve(outArg);
mkdirSync(out, { recursive: true });
const profile = mkdtempSync(join(tmpdir(), 'toybox-ff-'));
// prefers-color-scheme: 0 = dark, 1 = light. prefers-reduced-motion: 1 = reduce.
writeFileSync(join(profile, 'user.js'), [
  `user_pref("layout.css.prefers-color-scheme.content-override", ${dark ? 0 : 1});`,
  `user_pref("ui.prefersReducedMotion", ${reducedMotion ? 1 : 0});`,
  'user_pref("media.autoplay.default", 0);',
].join('\n'));

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
}

const PORT = 9300 + Math.floor(Math.random() * 600);
const ff = await launchFirefox({ profile, port: PORT });
setTimeout(() => {
  console.error('FAIL run did not finish within 5 minutes');
  writeFileSync(join(out, 'results.json'), JSON.stringify([...results, { name: 'run finished in time', ok: false }], null, 2));
  ff.child.kill();
  process.exit(1);
}, 300000).unref();
await ff.send('session.subscribe', { events: ['log.entryAdded'] });
await ff.send('browsingContext.setViewport', { context: ff.context, viewport: { width: 1000, height: 800 } });

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
async function waitFor(fn, what, timeout = 10000, ...args) {
  const end = Date.now() + timeout;
  let last;
  while (Date.now() < end) {
    try {
      last = await ff.run(fn, ...args);
      if (last) return last;
    } catch (err) {
      last = err.message;
    }
    await sleep(150);
  }
  throw new Error(`timed out waiting for ${what} (last: ${JSON.stringify(last)})`);
}

// Selectors are inside the shadow root of the element with id `host` (the demo's drawer by
// default). Page functions are serialised, so each looks its node up itself.
async function rect(selector, host = 'drawer') {
  return ff.run((sel, hostId) => {
    const node = document.getElementById(hostId).shadowRoot.querySelector(sel);
    if (!node) throw new Error(`no ${sel} in #${hostId}`);
    const r = node.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  }, selector, host);
}
const at = (r, fx, fy) => ({ x: Math.round(r.x + r.w * fx), y: Math.round(r.y + r.h * fy) });

async function stroke(selector, points, { pointerType = 'mouse', duration = 30, host } = {}) {
  const r = await rect(selector, host);
  const [first, ...rest] = points.map(([fx, fy]) => at(r, fx, fy));
  const actions = [{ type: 'pointerMove', x: first.x, y: first.y }, { type: 'pointerDown', button: 0 }];
  for (const p of rest) actions.push({ type: 'pointerMove', x: p.x, y: p.y, duration });
  actions.push({ type: 'pointerUp', button: 0 });
  await ff.send('input.performActions', { context: ff.context, actions: [{ type: 'pointer', id: pointerType, parameters: { pointerType }, actions }] });
  await ff.send('input.releaseActions', { context: ff.context });
}
const click = (selector, fx = 0.5, fy = 0.5, options) => stroke(selector, [[fx, fy]], options);
const circle = (cx, cy, r, steps = 12, turns = 1) => Array.from({ length: steps + 1 }, (_, i) => {
  const a = (i / steps) * Math.PI * 2 * turns;
  return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
});
const choose = (label, value) => ff.run((name, chosen) => {
  const select = [...document.getElementById('drawer').shadowRoot.querySelectorAll('.stage select')].find((node) => node.title === name);
  select.value = chosen;
  select.dispatchEvent(new Event('change'));
}, label, value);
const press = (text) => ff.run((wanted) => {
  [...document.getElementById('drawer').shadowRoot.querySelectorAll('.stage button')].find((node) => node.textContent === wanted).click();
}, text);
const frameDocument = `document.getElementById('drawer').shadowRoot.querySelector('.stage iframe')`;
const inFrame = (body) => ff.run(new Function(`const frame = ${frameDocument}; return (${body})(frame);`));
/** A real click on a node inside the drawer's framed page, at fractions of its box. */
async function frameClick(selector, fx = 0.5, fy = 0.5) {
  const frame = await rect('.stage iframe');
  const inner = await inFrame(`(frame) => { const r = frame.contentDocument.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; }`);
  const x = Math.round(frame.x + inner.x + inner.w * fx);
  const y = Math.round(frame.y + inner.y + inner.h * fy);
  await ff.send('input.performActions', { context: ff.context, actions: [{ type: 'pointer', id: 'mouse', parameters: { pointerType: 'mouse' },
    actions: [{ type: 'pointerMove', x, y }, { type: 'pointerDown', button: 0 }, { type: 'pointerUp', button: 0 }] }] });
  await ff.send('input.releaseActions', { context: ff.context });
}
/** Real key presses to whatever has the focus; { value, shift } each. */
async function keys(presses) {
  const SHIFT = '';
  const actions = presses.flatMap(({ value, shift }) => [
    ...(shift ? [{ type: 'keyDown', value: SHIFT }] : []),
    { type: 'keyDown', value }, { type: 'keyUp', value },
    ...(shift ? [{ type: 'keyUp', value: SHIFT }] : []),
  ]);
  await ff.send('input.performActions', { context: ff.context, actions: [{ type: 'key', id: 'keyboard', actions }] });
  await ff.send('input.releaseActions', { context: ff.context });
}

const CANVAS = '.stage canvas';
// What to do with each toy before its screenshot: real pointer input wherever it matters.
const PLAY = {
  'oil-and-water': async () => {
    await stroke(CANVAS, [[0.2, 0.3], [0.4, 0.5], [0.6, 0.4], [0.8, 0.7]]);
    await stroke(CANVAS, [[0.8, 0.2], [0.5, 0.6], [0.2, 0.8]], { pointerType: 'touch' });
    await sleep(500);
  },
  'ripple-tank': async () => {
    await click(CANVAS, 0.3, 0.35);
    await click(CANVAS, 0.7, 0.6, { pointerType: 'touch' });
    await stroke(CANVAS, [[0.1, 0.8], [0.5, 0.75], [0.9, 0.85]]);
    await sleep(300);
  },
  kaleidoscope: async () => {
    await stroke(CANVAS, circle(0.5, 0.5, 0.3, 16, 0.75), { duration: 40 });
    await sleep(1200);
  },
  'newtons-cradle': async () => {
    await sleep(600);
    await stroke(CANVAS, [[0.68, 0.62], [0.8, 0.5], [0.9, 0.45]], { duration: 80 });
    await sleep(700);
  },
  'drip-timer': async () => {
    await sleep(2500);
    await press('Flip');
    await sleep(700);
  },
  'stacking-blocks': async () => {
    await sleep(800);
    await press('Throw a ball');
    await stroke(CANVAS, [[0.5, 0.5], [0.3, 0.3]], { duration: 60 });
    await sleep(900);
  },
  pendulums: async () => {
    await press('Add');
    await press('Clone');
    await sleep(2500);
  },
  string: async () => {
    await stroke(CANVAS, [[0.5, 0.31], [0.5, 0.5], [0.45, 0.62]], { duration: 80 });
    await stroke(CANVAS, [[0.5, 0.71], [0.55, 0.55], [0.6, 0.42]], { pointerType: 'touch', duration: 80 });
    await sleep(800);
  },
  spirograph: async () => {
    await sleep(2500);
    await stroke(CANVAS, circle(0.5, 0.5, 0.35, 10, 0.5), { duration: 40 });
  },
  'twisty-cube': async () => {
    await waitFor(new Function(`return Boolean(${frameDocument}?.contentDocument?.querySelector('twisty-player')) && ${frameDocument}.contentDocument.querySelector('#count').textContent === 'Moves: 0';`), 'the twisty page to start');
    await sleep(1000);
    const twisty = (body) => inFrame(`async (frame) => { const doc = frame.contentDocument; const player = doc.querySelector('twisty-player'); return (${body}); }`);
    const state = () => twisty("{ alg: (await player.experimentalModel.alg.get()).alg.toString(), solved: (await player.experimentalModel.currentPattern.get()).experimentalIsSolved({ ignorePuzzleOrientation: true, ignoreCenterOrientation: true }), count: doc.querySelector('#count').textContent, help: !doc.querySelector('#help').hidden }");
    check('twisty-cube: the instructions show by themselves the first time', (await state()).help);
    await frameClick('#help-close');
    check('twisty-cube: "Got it" closes the instructions', !(await state()).help);
    // Keys reach the page only while its frame has the focus, which the click above gave it.
    await keys([{ value: 'r' }]);
    await waitFor(new Function(`return ${frameDocument}.contentDocument.querySelector('#count').textContent === 'Moves: 1';`), 'R to be turned');
    const turned = await state();
    check('twisty-cube: the R key turns R', turned.alg === 'R' && !turned.solved, JSON.stringify(turned));
    await keys([{ value: 'R', shift: true }]);
    await sleep(600);
    const back = await state();
    check("twisty-cube: Shift+R turns R' and the cube is solved again", back.alg === "R R'" && back.solved && back.count === 'Moves: 2', JSON.stringify(back));
    await frameClick('button[data-move="U"]');
    await sleep(600);
    const button = await state();
    check('twisty-cube: the U ⟳ button turns U', button.alg === "R R' U" && button.count === 'Moves: 3', JSON.stringify(button));
    await frameClick('#undo');
    await sleep(600);
    check('twisty-cube: Undo takes the U back', (await state()).alg === "R R'");
    await frameClick('#stage', 0.5, 0.25);
    await sleep(600);
    const clicked = await state();
    check("twisty-cube: a click on the top face turns it (U', cubing.js's direction)", clicked.alg === "R R' U'", JSON.stringify(clicked));
    await frameClick('#help-button');
    check('twisty-cube: "?" opens the instructions', (await state()).help);
    const panel = await ff.node("document.getElementById('drawer').shadowRoot.querySelector('.panel')");
    const { data } = await ff.send('browsingContext.captureScreenshot', { context: ff.context, origin: 'viewport', clip: { type: 'element', element: panel } });
    writeFileSync(join(out, `twisty-cube-help${suffix}.png`), Buffer.from(data, 'base64'));
    await frameClick('#help-close');
    await press('Scramble');
    await sleep(2500);
    await stroke('.stage iframe', [[0.3, 0.5], [0.6, 0.45]], { duration: 60 });
    await sleep(800);
  },
  'music-box': async () => {
    await waitFor(new Function(`return ${frameDocument}?.contentDocument?.querySelector('#start')?.disabled === false;`), 'the music box page to load');
    const frame = await rect('.stage iframe');
    const inner = await inFrame('(frame) => { const r = frame.contentDocument.querySelector("#start").getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }');
    await ff.send('input.performActions', { context: ff.context, actions: [{ type: 'pointer', id: 'mouse', parameters: { pointerType: 'mouse' },
      actions: [{ type: 'pointerMove', x: Math.round(frame.x + inner.x), y: Math.round(frame.y + inner.y) }, { type: 'pointerDown', button: 0 }, { type: 'pointerUp', button: 0 }] }] });
    await ff.send('input.releaseActions', { context: ff.context });
    await waitFor(new Function(`return ${frameDocument}.contentDocument.body.classList.contains('started');`), 'the music box to start');
    const grid = await inFrame('(frame) => { const r = frame.contentDocument.querySelector("canvas").getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; }');
    const cells = [[2, 3], [4, 6], [6, 9], [8, 12], [10, 9], [12, 6], [14, 3], [5, 12], [9, 4]];
    for (const [column, row] of cells) {
      const x = Math.round(frame.x + grid.x + ((column + 0.5) / 16) * grid.w);
      const y = Math.round(frame.y + grid.y + ((row + 0.5) / 16) * grid.h);
      await ff.send('input.performActions', { context: ff.context, actions: [{ type: 'pointer', id: 'mouse', parameters: { pointerType: 'mouse' },
        actions: [{ type: 'pointerMove', x, y }, { type: 'pointerDown', button: 0 }, { type: 'pointerUp', button: 0 }] }] });
    }
    await ff.send('input.releaseActions', { context: ff.context });
    await sleep(1200);
  },
  'lava-lamp': async () => {
    await sleep(3000);
    await click(CANVAS, 0.5, 0.75);
  },
  'pin-art': async () => {
    await choose('Stamp', 'hand');
    await stroke(CANVAS, [[0.2, 0.8], [0.4, 0.75], [0.6, 0.8], [0.8, 0.75]], { duration: 40 });
    await sleep(300);
  },
  'bubble-wrap': async () => {
    for (const [fx, fy] of [[0.3, 0.3], [0.42, 0.3], [0.5, 0.42], [0.62, 0.55], [0.35, 0.65]]) await click(CANVAS, fx, fy);
    await sleep(300);
  },
  'fidget-spinner': async () => {
    await stroke(CANVAS, circle(0.5, 0.5, 0.3, 8, 0.5), { duration: 15 });
    await sleep(400);
  },
  'zen-garden': async () => {
    await stroke(CANVAS, [[0.1, 0.25], [0.35, 0.2], [0.6, 0.3], [0.9, 0.25]], { duration: 50 });
    await stroke(CANVAS, [[0.1, 0.75], [0.4, 0.7], [0.7, 0.8], [0.9, 0.7]], { duration: 50 });
    await choose('Rake', 'wide');
    await stroke(CANVAS, circle(0.68, 0.37, 0.16, 40, 1), { duration: 15 });
    await sleep(200);
  },
};

const drawerRun = (body) => ff.run(new Function(`const drawer = document.getElementById('drawer'); const root = drawer.shadowRoot; return (${body});`));
const runningToys = () => drawerRun("root.querySelectorAll('.stage > canvas, .stage > iframe').length");
const pauseLabel = () => drawerRun("root.querySelector('.pause').textContent");
const scrollTo = (id) => ff.run((target) => { document.getElementById(target).scrollIntoView({ block: 'center' }); }, id);

async function openEveryToy() {
  check('the drawer shows sixteen cards', (await drawerRun("root.querySelectorAll('.card').length")) === 16);
  for (const meta of CATALOG) {
    await scrollTo('drawer');
    await click(`.card[data-toy="${meta.id}"]`);
    await waitFor(new Function(`const drawer = document.getElementById('drawer'); return drawer.state.id === ${JSON.stringify(meta.id)} && drawer.shadowRoot.querySelector('.stage').children.length > 0;`), `${meta.id} to open`);
    await ff.run(() => { document.getElementById('drawer').shadowRoot.querySelector('.panel').scrollIntoView({ block: 'nearest' }); });
    check(`${meta.id}: opens alone in the panel`, (await runningToys()) === 1);
    if (reducedMotion) {
      check(`${meta.id}: opens paused under reduced motion`, (await pauseLabel()) === 'Play');
      await click('.pause');
    } else {
      // A toy opens paused while its panel's visibility is unknown, then runs once it shows.
      await waitFor(() => document.getElementById('drawer').state.running, `${meta.id} to run`, 3000);
    }
    try {
      await PLAY[meta.id]();
    } catch (err) {
      check(`${meta.id}: play`, false, err.message);
    }
    const panel = await ff.node("document.getElementById('drawer').shadowRoot.querySelector('.panel')");
    const { data } = await ff.send('browsingContext.captureScreenshot', { context: ff.context, origin: 'viewport', clip: { type: 'element', element: panel } });
    writeFileSync(join(out, `${meta.id}${suffix}.png`), Buffer.from(data, 'base64'));
    if (await drawerRun("Boolean(root.querySelector('.stage > canvas'))")) {
      const fitted = await ff.run(async () => {
        const root = document.getElementById('drawer').shadowRoot;
        const panelNode = root.querySelector('.panel');
        panelNode.style.width = '640px';
        panelNode.style.height = '600px';
        await new Promise((done) => setTimeout(done, 300));
        const canvas = root.querySelector('.stage > canvas');
        const ratio = Math.min(devicePixelRatio || 1, 2);
        const result = { buffer: canvas.width, box: canvas.clientWidth, ratio };
        panelNode.style.width = '';
        panelNode.style.height = '';
        return result;
      });
      check(`${meta.id}: the canvas follows a resized panel`, fitted.box > 500 && fitted.buffer === Math.round(fitted.box * fitted.ratio), JSON.stringify(fitted));
    }
    await click('.pause');
    check(`${meta.id}: Pause pauses`, (await pauseLabel()) === 'Play');
    await click('.pause');
    await click('.reset');
    await click('.close');
    check(`${meta.id}: Close empties the panel`, await drawerRun("root.querySelector('.panel').hidden && root.querySelector('.stage').children.length === 0"));
  }
}

async function checkEmbeds() {
  await ff.run(() => window.scrollTo(0, 0));
  const boxes = () => ff.run(() => [...document.querySelectorAll('toy-box')].map((box) => ({ id: box.state.id, running: box.state.running })));
  await waitFor(() => [...document.querySelectorAll('toy-box')].every((box) => box.state.id), 'the toy boxes to load');
  await sleep(500);
  const top = await boxes();
  check('three <toy-box> embeds load their toys', top.length === 3 && top.every((box) => box.id), JSON.stringify(top));
  check('<toy-box> embeds off screen are paused', top.every((box) => !box.running), JSON.stringify(top));
  await ff.run(() => document.querySelector('.boxes').scrollIntoView({ block: 'center' }));
  await sleep(800);
  const shown = await boxes();
  if (reducedMotion) check('<toy-box> embeds on screen stay paused under reduced motion', shown.every((box) => !box.running), JSON.stringify(shown));
  else check('<toy-box> embeds on screen run', shown.every((box) => box.running), JSON.stringify(shown));
  const { data } = await ff.send('browsingContext.captureScreenshot', { context: ff.context, origin: 'viewport' });
  writeFileSync(join(out, `boxes${suffix}.png`), Buffer.from(data, 'base64'));
}

/** Closes the floating drawer's window from its own button, so it covers nothing until its check. */
async function closeFloatingDrawer() {
  await ff.run(() => document.getElementById('floating').shadowRoot.querySelector('.window-close').click());
  check('panel="floating": the drawer window closes to its launcher', await ff.run(() => {
    const root = document.getElementById('floating').shadowRoot;
    return root.querySelector('.drawer-window').hidden && !root.querySelector('.launcher').hidden;
  }));
}

// The floating drawer by real pointer input: its launcher, a drag of its window, the demo's
// "two side by side" button and a third toy from a card, then one toy window moved, one
// minimized and one closed.
async function checkFloatingWindow() {
  const floating = (body) => ff.run(new Function(`const drawer = document.getElementById('floating'); const root = drawer.shadowRoot; return (${body});`));
  await scrollTo('floating');
  // The button first, while the closed drawer window covers nothing: the toys open beside where
  // the drawer window will be.
  const two = await pageRect('#two-toys');
  await pointerAt([{ x: two.x + two.w / 2, y: two.y + two.h / 2 }]);
  // Under reduced motion the toys open paused, so only their windows are waited for.
  const ready = (count) => new Function(`const items = document.getElementById('floating').windows; return items.length === ${count} && (${reducedMotion} || items.every((item) => item.running));`);
  await waitFor(ready(2), 'the two toys side by side');

  await click('.launcher', 0.5, 0.5, { host: 'floating' });
  const before = await rect('.drawer-window', 'floating');
  check('panel="floating": the launcher opens the drawer window at the lower left', before.x < 40 && before.y + before.h > 800 - 40, JSON.stringify(before));
  // Fractions of the title bar: right by 20 % of its width, up by about two bar heights. The
  // press also brings the drawer window in front of the toy windows.
  await stroke('.drawer-bar', [[0.3, 0.5], [0.4, -0.5], [0.5, -1.5]], { host: 'floating', duration: 60 });
  const moved = await rect('.drawer-window', 'floating');
  check('the drawer window moves when its title bar is dragged', moved.x > before.x + 50 && moved.y < before.y - 30, JSON.stringify({ before, moved }));
  await click('.card[data-toy="pin-art"]', 0.5, 0.5, { host: 'floating' });
  await waitFor(ready(3), 'three toy windows');
  const boxes = await floating("[...root.querySelectorAll('.toy-window')].map((node) => { const r = node.getBoundingClientRect(); return { id: node.dataset.toy, x: r.left, y: r.top, w: r.width, h: r.height, canvas: Boolean(node.querySelector('.stage > canvas')) }; })");
  const apart = new Set(boxes.map((box) => `${box.x},${box.y}`)).size === 3;
  check('three toys open in three windows, each with its toy, none exactly on another', boxes.length === 3 && boxes.every((box) => box.canvas) && apart, JSON.stringify(boxes));
  await shot('floating-three');

  // A card of a toy already open brings its window to the front, where its bar can be reached.
  const toFront = async (id) => {
    await click(`.card[data-toy="${id}"]`, 0.5, 0.5, { host: 'floating' });
    await waitFor(new Function(`return document.getElementById('floating').state.id === ${JSON.stringify(id)};`), `${id} to come to the front`);
  };
  await toFront('fidget-spinner');
  check('opening an open toy again brings its window to the front, without a second window', await floating("root.querySelectorAll('.toy-window').length === 3 && [...root.querySelectorAll('.toy-window')].every((node) => Number(node.style.zIndex) <= Number(root.querySelector('.toy-window[data-toy=\"fidget-spinner\"]').style.zIndex))"));
  const fidget = boxes.find((box) => box.id === 'fidget-spinner');
  // Fractions of the title bar: left by 30 % of its width, up by about two bar heights.
  await stroke('.toy-window[data-toy="fidget-spinner"] .bar', [[0.2, 0.5], [0.1, -0.5], [-0.1, -1.5]], { host: 'floating', duration: 60 });
  const fidgetMoved = await rect('.toy-window[data-toy="fidget-spinner"]', 'floating');
  check('a toy window moves when its title bar is dragged', fidgetMoved.x < fidget.x - 50 && fidgetMoved.y < fidget.y - 30, JSON.stringify({ fidget, fidgetMoved }));
  await toFront('bubble-wrap');
  await click('.toy-window[data-toy="bubble-wrap"] .minimize', 0.5, 0.5, { host: 'floating' });
  const minimized = await floating("({ windows: drawer.windows.map(({ id, running, minimized }) => ({ id, running, minimized })), height: root.querySelector('.toy-window[data-toy=\"bubble-wrap\"]').getBoundingClientRect().height })");
  const bubble = minimized.windows.find((item) => item.id === 'bubble-wrap');
  check('minimizing a toy window leaves only its bar and pauses the toy', bubble.minimized && !bubble.running && minimized.height < 60, JSON.stringify(minimized));
  await click('.toy-window[data-toy="pin-art"] .close', 0.5, 0.5, { host: 'floating' });
  const left = await floating("({ ids: drawer.windows.map((item) => item.id).sort(), frames: root.querySelectorAll('.toy-window').length })");
  check('closing a toy window removes it and its toy', JSON.stringify(left) === JSON.stringify({ ids: ['bubble-wrap', 'fidget-spinner'], frames: 2 }), JSON.stringify(left));
  await shot('floating');
  await floating('drawer.close()');
  await closeFloatingDrawer();
}

// ---- the elements after the toys: real pointer input on each, in the demo page ----

const shot = async (name) => {
  const { data } = await ff.send('browsingContext.captureScreenshot', { context: ff.context, origin: 'viewport' });
  writeFileSync(join(out, `${name}${suffix}.png`), Buffer.from(data, 'base64'));
};
/** The viewport rectangle of a node in the page's own DOM. */
const pageRect = (selector) => ff.run((sel) => {
  const node = document.querySelector(sel);
  if (!node) throw new Error(`no ${sel}`);
  const r = node.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
}, selector);
// Points are kept inside the 1000 x 800 viewport (BiDi refuses others, and a refused move would
// leave the button held for every later click).
async function pointerAt(points, { button = 0, duration = 30 } = {}) {
  const inside = points.map((p) => ({ x: Math.round(Math.min(999, Math.max(1, p.x))), y: Math.round(Math.min(799, Math.max(1, p.y))) }));
  const [first, ...rest] = inside;
  const actions = [{ type: 'pointerMove', x: first.x, y: first.y }, { type: 'pointerDown', button }];
  for (const p of rest) actions.push({ type: 'pointerMove', x: p.x, y: p.y, duration });
  actions.push({ type: 'pointerUp', button });
  try {
    await ff.send('input.performActions', { context: ff.context, actions: [{ type: 'pointer', id: 'mouse', parameters: { pointerType: 'mouse' }, actions }] });
  } finally {
    await ff.send('input.releaseActions', { context: ff.context });
  }
}
const tray = (body) => ff.run(new Function(`const tray = document.getElementById('dice'); const root = tray.shadowRoot; return (async () => { ${body} })();`));
const logCount = () => tray("return root.querySelectorAll('.log li:not(.note)').length;");
const trayButton = async (text) => {
  const at = await ff.run((wanted) => {
    const node = [...document.getElementById('dice').shadowRoot.querySelectorAll('button')].find((item) => item.textContent === wanted);
    const r = node.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, text);
  await pointerAt([at]);
};

async function checkDiceTray() {
  await waitFor(() => Boolean(document.getElementById('dice')?.shadowRoot?.querySelector('.tray:not([hidden])')), 'the dice tray to load');
  for (const text of ['d6', 'd6', 'd8']) await trayButton(text);
  check('dice tray: die buttons build a pool', (await tray("return root.querySelector('.pool-text').textContent;")) === '2d6 + 1d8');
  await trayButton('Roll');
  await waitFor(() => document.getElementById('dice').shadowRoot.querySelectorAll('.log li:not(.note)').length === 1, 'the pool roll to be logged', 15000);
  const line = await tray("return root.querySelector('.log li:not(.note)').getAttribute('aria-label');");
  check('dice tray: the pool rolls together into one entry with each die type summed', /2d6\+1d8: \d+, \d+, \d+ \(2d6 \d+ · d8 \d+\) = \d+$/.test(line), line);

  await trayButton('dN');
  await tray("root.querySelector('.dn input').value = '13';");
  await trayButton('Add die');
  check('dice tray: dN adds a 13-sided die', (await tray("return root.querySelector('.pool-text').textContent;")) === '1d13');
  await trayButton('Roll');
  await waitFor(() => document.getElementById('dice').shadowRoot.querySelectorAll('.log li:not(.note)').length === 2, 'the d13 roll', 15000);
  check('dice tray: a d13 is drawn as the generic die', (await tray("return root.querySelectorAll('.stage2d .die.dn').length;")) === 1);
  await shot('dice-tray');

  // The resize handle, dragged with the mouse: smaller, and then past the minimum.
  const box = () => tray("const r = root.querySelector('.tray').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height };");
  const before = await box();
  const grip = await tray("const r = root.querySelector('.grip').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 };");
  await pointerAt([grip, { x: grip.x - 40, y: grip.y - 60 }, { x: grip.x - 80, y: grip.y - 200 }], { duration: 60 });
  const smaller = await box();
  check('dice tray: dragging the resize handle resizes the tray', Math.abs(smaller.w - (before.w - 80)) <= 2 && Math.abs(smaller.h - (before.h - 200)) <= 2, JSON.stringify({ before, smaller }));
  const reflow = await tray("const t = root.querySelector('.tray').getBoundingClientRect(); return ['.log', '.stage', '.buttons', '.notation'].map((s) => { const r = root.querySelector(s).getBoundingClientRect(); return r.height > 0 && r.bottom <= t.bottom + 1; });");
  check('dice tray: the log, roller and buttons reflow inside the smaller tray', reflow.every(Boolean), JSON.stringify(reflow));
  const grip2 = await tray("const r = root.querySelector('.grip').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 };");
  await pointerAt([grip2, { x: grip2.x - 600, y: grip2.y - 700 }], { duration: 60 });
  const smallest = await box();
  check('dice tray: the handle stops at 280 x 420', Math.round(smallest.w) === 280 && Math.round(smallest.h) === 420, JSON.stringify(smallest));
  await shot('dice-tray-resized');

  // data-roll on the card, with the wod bands.
  await ff.run(() => document.getElementById('card').scrollIntoView({ block: 'center' }));
  const str = await pageRect('#card [data-roll-label="STR"]');
  const count = await logCount();
  await pointerAt([{ x: str.x + str.w / 2, y: str.y + str.h / 2 }]);
  await waitFor(new Function(`return document.getElementById('dice').shadowRoot.querySelectorAll('.log li:not(.note)').length === ${count + 1};`), 'the data-roll roll', 15000);
  const last = await tray("return [...root.querySelectorAll('.log li:not(.note)')].at(-1).getAttribute('aria-label');");
  check('dice tray: a data-roll button rolls into the tray with its band', /STR 2d6\+2: \d, \d = \d+, (Miss|Partial success|Success|Critical success)$/.test(last), last);

  // 3D: dice-box loads from next to the script on the first switch, or the tray says why not.
  await trayButton('⚙');
  await tray("const box = root.querySelector('[data-setting=\"mode\"]'); box.checked = true; box.dispatchEvent(new Event('change', { bubbles: true }));");
  // dice-box adds its canvas before it has finished starting, so the wait is for the tray's own
  // switch to 3D (or its note saying why not), not for the canvas.
  await waitFor(() => {
    const root = document.getElementById('dice').shadowRoot;
    return root.querySelector('.stage').dataset.showing === '3d' || [...root.querySelectorAll('.log .note')].some((note) => /3D dice could not load/.test(note.textContent));
  }, 'dice-box to load or the tray to fall back', 30000);
  const loaded3d = await ff.run(() => performance.getEntriesByType('resource').map((entry) => entry.name).filter((name) => name.includes('/dice-box/')));
  check('dice tray: 3D loads dice-box from dice-box/ next to the script', loaded3d.some((name) => name.endsWith('/dice-box/dice-box.es.min.js')), loaded3d.join(' '));
  const mode = await tray("return root.querySelector('.stage').dataset.showing;");
  await tray("root.querySelector('dialog').close();");
  if (mode === '3d') {
    await trayButton('d20');
    await trayButton('Roll');
    await waitFor(() => document.getElementById('dice').shadowRoot.querySelectorAll('.log li:not(.note)').length >= 4, 'the 3D roll', 20000);
    await shot('dice-tray-3d');
    await tray("return document.getElementById('dice').roll('1d7');");
    const notes = await tray("return [...root.querySelectorAll('.log .note')].map((note) => note.textContent).join(' | ');");
    check('dice tray: a d7 falls back to 2D in 3D mode', /1d7 has a die with no 3D model; rolled in 2D/.test(notes), notes);
  } else {
    check('dice tray: 3D dice in this browser', false, 'dice-box did not start; the tray fell back to 2D');
  }
  await tray("const box = root.querySelector('[data-setting=\"mode\"]'); box.checked = false; box.dispatchEvent(new Event('change', { bubbles: true }));");
}

/** Closes the tray with its own button, so the window does not cover the toys' buttons later. */
async function closeDiceTray() {
  await trayButton('×');
  check('dice tray: Close hides it and shows the launcher', await tray("return root.querySelector('.tray').hidden && !root.querySelector('.launcher').hidden;"));
}

async function checkBackground() {
  await waitFor(() => Boolean(document.getElementById('background')?.shadowRoot?.querySelector('.layer .backdrop-layers')), 'the background to render');
  await ff.run(() => window.scrollTo(0, 0));
  const bg = (body) => ff.run(new Function(`const root = document.getElementById('background').shadowRoot; return (${body});`));
  const name = await pageRect('#background');
  const nameButton = await bg("(() => { const r = root.querySelector('.name').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()");
  const first = await bg("root.querySelector('.name').textContent");
  await pointerAt([nameButton]);
  const second = await bg("root.querySelector('.name').textContent");
  check('background: the name button shows the next background', first !== second && second.length > 0, `${first} -> ${second}`);
  check('background: the layer is fixed behind the page', await bg("getComputedStyle(root.querySelector('.layer')).position === 'fixed' && getComputedStyle(root.querySelector('.layer')).zIndex === '-1'"));
  // A middle press on bare background (the page's margin, left of the content) toggles the color mode.
  const bare = { x: 4, y: Math.round(name.y + name.h + 200) };
  check('background: the test point is bare background (no data-solid, no Toybox element)', await ff.run((x, y) => {
    const node = document.elementFromPoint(x, y);
    return Boolean(node) && !node.closest('[data-solid], toy-background, dice-tray, toy-drawer, toy-box, draw-layer, toy-pages, button, a');
  }, bare.x, bare.y));
  await pointerAt([bare], { button: 1 });
  check('background: a middle press on bare background turns the color mode on, and its box shows it', await bg("root.querySelector('.color-mode').checked"));
  await shot('background-color-mode');
  await pointerAt([bare], { button: 1 });
  check('background: a second middle press turns it off', !(await bg("root.querySelector('.color-mode').checked")));
  const card = await pageRect('#card');
  await ff.run(() => document.getElementById('card').scrollIntoView({ block: 'center' }));
  const cardNow = await pageRect('#card');
  await pointerAt([{ x: cardNow.x + 20, y: cardNow.y + cardNow.h - 10 }], { button: 1 });
  check('background: a middle press on data-solid content leaves the color mode alone', !(await bg("root.querySelector('.color-mode').checked")), JSON.stringify(card));
  await checkBackgroundDrag();
  await checkBackgroundFling();
  await checkEveryBackground();
}

/** A point of bare background in the viewport (the page's left margin), with the page at the top. */
async function bareBackgroundPoint() {
  await ff.run(() => window.scrollTo(0, 0));
  return ff.run(() => {
    for (let y = 120; y < 780; y += 20) {
      const node = document.elementFromPoint(6, y);
      if (node && !node.closest('[data-solid], toy-background, dice-tray, toy-drawer, toy-box, draw-layer, toy-pages, button, a')) return { x: 6, y };
    }
    return null;
  });
}

const mouse = (actions) => ff.send('input.performActions', { context: ff.context, actions: [{ type: 'pointer', id: 'mouse', parameters: { pointerType: 'mouse' }, actions }] });

// The background follows only a drag that starts on bare background. A probe background
// registered through the page's own copy of Toybox records the pointer it is told, which is
// what the built-in backgrounds are told too.
async function checkBackgroundDrag() {
  const bare = await bareBackgroundPoint();
  check('background drag: there is bare background to drag on', bare !== null);
  const content = await ff.run(() => {
    const r = document.querySelector('section[data-solid]').getBoundingClientRect();
    return { x: Math.round(r.left + 40), y: Math.round(Math.max(r.top, 0) + 30) };
  });
  await ff.run(async () => {
    const { registerBackground } = await import(new URL('toybox.js', document.baseURI).href);
    window.e2ePointer = [];
    registerBackground('e2e-probe', { name: 'Probe', mount: () => ({ pointer: (point) => window.e2ePointer.push(point), destroy() {} }) });
    await document.getElementById('background').set({ background: 'e2e-probe', on: true, interactive: true });
  });
  await sleep(300);
  const heard = () => ff.run(() => window.e2ePointer);
  const clear = () => ff.run(() => { window.e2ePointer = []; });
  const html = () => ff.run((x, y) => ({
    grab: document.documentElement.classList.contains('toybox-background-grab'),
    dragging: document.documentElement.classList.contains('toybox-background-dragging'),
    cursor: getComputedStyle(document.elementFromPoint(x, y)).cursor,
  }), content.x, content.y);

  await mouse([{ type: 'pointerMove', x: bare.x, y: bare.y }, { type: 'pointerMove', x: bare.x + 2, y: bare.y + 30, duration: 100 }]);
  check('background drag: hovering bare background feeds the background nothing', (await heard()).length === 0, JSON.stringify(await heard()));
  check('background drag: bare background shows the grab cursor', await ff.run((x, y) => getComputedStyle(document.elementFromPoint(x, y)).cursor === 'grab', bare.x + 2, bare.y + 30));
  await mouse([{ type: 'pointerDown', button: 0 }, { type: 'pointerMove', x: content.x, y: content.y, duration: 150 }]);
  const during = await html();
  check('background drag: while held, the cursor is grabbing even over content', during.dragging && during.cursor === 'grabbing', JSON.stringify(during));
  await mouse([{ type: 'pointerUp', button: 0 }]);
  await ff.send('input.releaseActions', { context: ff.context });
  // A release while still moving coasts on before the null.
  await waitFor(() => window.e2ePointer.at(-1) === null, 'the drag and any coast to end', 12000);
  const dragged = await heard();
  check('background drag: a drag from bare background feeds the pointer wherever it goes, then null once it ends',
    dragged.length >= 2 && dragged.at(-1) === null && dragged.some((point) => point && point.x === content.x && point.y === content.y), JSON.stringify(dragged));
  check('background drag: release ends grabbing', !(await html()).dragging);

  await clear();
  await pointerAt([content, { x: bare.x, y: bare.y }]);
  check('background drag: a drag that starts on content feeds nothing', (await heard()).length === 0, JSON.stringify(await heard()));

  await ff.run(() => document.getElementById('background').set({ interactive: false }));
  await mouse([{ type: 'pointerMove', x: bare.x, y: bare.y + 10 }]);
  await pointerAt([bare, { x: bare.x + 3, y: bare.y + 40 }]);
  check('background drag: with "reacts to the mouse" off there is no grab cursor and no feed',
    (await heard()).length === 0 && !(await ff.run(() => document.documentElement.classList.contains('toybox-background-grab'))), JSON.stringify(await heard()));
  await ff.run(() => document.getElementById('background').set({ interactive: true, background: 'lines' }));
}

// A fling on bare background coasts on: a probe background records each pointer it is told, and
// the release, and reads the sheet (api.motion.sheet()) once a frame.
async function checkBackgroundFling() {
  const bare = await bareBackgroundPoint();
  check('background fling: there is bare background to fling on', bare !== null);
  await ff.run(async () => {
    const { registerBackground } = await import(new URL('toybox.js', document.baseURI).href);
    window.e2eFling = { heard: [], gliding: [] };
    window.addEventListener('pointerup', () => window.e2eFling.heard.push('up'), { capture: true });
    registerBackground('e2e-fling', {
      name: 'Fling probe',
      mount(el, api) {
        let frame = requestAnimationFrame(function tick() {
          window.e2eFling.gliding.push(api.motion.sheet().moving);
          frame = requestAnimationFrame(tick);
        });
        return { pointer: (point) => window.e2eFling.heard.push(point), destroy: () => cancelAnimationFrame(frame) };
      },
    });
    await document.getElementById('background').set({ background: 'e2e-fling', on: true, interactive: true });
  });
  await sleep(300);
  const end = { x: bare.x, y: bare.y + 120 };
  await mouse([{ type: 'pointerMove', x: bare.x, y: bare.y }, { type: 'pointerDown', button: 0 }, { type: 'pointerMove', x: end.x, y: end.y, duration: 80 }, { type: 'pointerUp', button: 0 }]);
  await ff.send('input.releaseActions', { context: ff.context });
  await sleep(250);
  const soon = await ff.run(() => {
    const { heard, gliding } = window.e2eFling;
    const after = heard.slice(heard.indexOf('up') + 1);
    return { after, gliding: gliding.slice(-3) };
  });
  const coasting = soon.after.filter((point) => point && typeof point === 'object');
  check('background fling: after the release the background hears the pointer coasting on, past where it was let go',
    coasting.length >= 3 && coasting.at(-1).y > end.y && coasting.at(-1).y > coasting[0].y, JSON.stringify(soon.after.slice(0, 6)));
  check('background fling: the sheet glides on after the release', soon.gliding.length > 0 && soon.gliding.every(Boolean), JSON.stringify(soon.gliding));
  const ended = await waitFor(() => window.e2eFling.heard.at(-1) === null, 'the coast to end in null', 15000).then(() => true, () => false);
  check('background fling: the coast ends with null within 15 s', ended, JSON.stringify(await ff.run(() => window.e2eFling.heard.slice(-3))));
  await shot('background-fling');
  await ff.run(() => document.getElementById('background').set({ background: 'lines' }));
}

const BACKGROUND_IDS = ['lines', 'aurora', 'film', 'plasma', 'stars', 'ripples'];
// Each of the library's own backgrounds draws in a real browser: none is marked failed (a shader
// that does not compile or a missing WebGL context marks it, and logs to the console, which the
// run checks is clean), each fills the layer with a canvas, and the pointer dragged on bare
// background is drawn in. A screenshot of each is saved.
async function checkEveryBackground() {
  const bare = await bareBackgroundPoint();
  check('background: there is bare background to drag the pointer on', bare !== null);
  for (const id of BACKGROUND_IDS) {
    await ff.run((name) => document.getElementById('background').set({ background: name, on: true }), id);
    await sleep(500);
    const moves = [{ x: bare.x + 2, y: bare.y + 40 }, { x: bare.x + 1, y: bare.y + 80 }].map((p) => ({ type: 'pointerMove', x: p.x, y: Math.min(799, p.y), duration: 150 }));
    await mouse([{ type: 'pointerMove', x: bare.x, y: bare.y }, { type: 'pointerDown', button: 0 }, ...moves, { type: 'pointerUp', button: 0 }]);
    await ff.send('input.releaseActions', { context: ff.context });
    await sleep(400);
    const drawn = await ff.run(() => {
      const layers = document.getElementById('background').shadowRoot.querySelector('.backdrop-layers');
      const canvas = layers?.querySelector('.backdrop-effect canvas');
      return { failed: layers?.dataset.failed ?? null, width: canvas?.width ?? 0, height: canvas?.height ?? 0 };
    });
    check(`background ${id}: draws into a canvas that fills the layer`, drawn.failed === null && drawn.width > 0 && drawn.height > 0, JSON.stringify(drawn));
    await shot(`background-${id}`);
  }
}

async function checkDrawLayer() {
  await ff.run(() => document.getElementById('card').scrollIntoView({ block: 'center' }));
  await waitFor(() => Boolean(document.querySelector('#card [data-toybox-ink]')), 'the draw layer over the card');
  const ink = (body) => ff.run(new Function(`const layer = document.getElementById('card-ink'); const root = layer.shadowRoot; const overlay = document.querySelector('#card [data-toybox-ink]'); return (async () => { ${body} })();`));
  const draw = await ink("const r = root.querySelector('.draw').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 };");
  await pointerAt([draw]);
  const card = await pageRect('#card');
  const points = [[0.3, 0.3], [0.5, 0.6], [0.7, 0.4], [0.9, 0.7]].map(([fx, fy]) => ({ x: card.x + card.w * fx, y: card.y + card.h * fy }));
  await pointerAt(points, { duration: 40 });
  const strokes = await ink('return (await layer.strokes()).length;');
  check('draw layer: a stroke drawn over the card is kept', strokes === 1, String(strokes));
  await shot('draw-layer');
  await checkEyedropper(ink, points[1]);
  await ink("const box = root.querySelector('.show'); box.click();");
  check('draw layer: Show scribbles off hides them on screen', await ink("return overlay.dataset.show === '0' && getComputedStyle(overlay.shadowRoot.querySelector('svg')).visibility === 'hidden';"));
  check('draw layer: Print scribbles stays on while they are hidden on screen', await ink("return overlay.dataset.print === '1';"));
  await ink("root.querySelector('.show').click();");
  await pointerAt([draw]);
  const str = await pageRect('#card [data-roll-label="WIS"]');
  const count = await logCount();
  await pointerAt([{ x: str.x + str.w / 2, y: str.y + str.h / 2 }]);
  await waitFor(new Function(`return document.getElementById('dice').shadowRoot.querySelectorAll('.log li:not(.note)').length === ${count + 1};`), 'a click through the layer with Draw off', 15000);
  check('draw layer: with Draw off, clicks reach the card', true);
  await checkDrawButtonPlace(ink);
}

// The Draw button moved to the upper right from its "⋯" menu, drawn with there, dragged by its
// grip past the window's edge (it stops 16 px in), Reset position, and back to the lower left
// for the rest of the run. All by real pointer input.
async function checkDrawButtonPlace(ink) {
  const centre = (selector) => ink(`const r = root.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 };`);
  // Measured inside the scroll bars, as position: fixed is.
  const head = () => ink("const r = root.querySelector('.head').getBoundingClientRect(); const { clientWidth, clientHeight } = document.documentElement; return { left: r.left, top: r.top, right: clientWidth - r.right, bottom: clientHeight - r.bottom };");
  const openMenu = async () => {
    if (await ink("return root.querySelector('.menu').hidden;")) await pointerAt([await centre('.place')]);
  };
  const pickCorner = async (corner) => {
    await openMenu();
    await pointerAt([await centre(`.menu input[value="${corner}"]`)]);
  };
  await pickCorner('top-right');
  const upper = await head();
  check('draw button: the menu puts it in the upper right, 16 px from both edges',
    Math.abs(upper.right - 16) < 1 && Math.abs(upper.top - 16) < 1, JSON.stringify(upper));
  await pointerAt([await centre('.draw')]);
  const opens = await ink("const dock = root.querySelector('.dock'); return { x: dock.dataset.openX, y: dock.dataset.openY, body: root.querySelector('.body').getBoundingClientRect().width > 0 };");
  check('draw button: in the upper right its tool bar opens down and to the left', opens.x === 'left' && opens.y === 'down' && opens.body, JSON.stringify(opens));
  await shot('draw-button-top-right');
  const before = await ink('return (await layer.strokes()).length;');
  const card = await pageRect('#card');
  await pointerAt([[0.2, 0.8], [0.4, 0.9], [0.6, 0.8]].map(([fx, fy]) => ({ x: card.x + card.w * fx, y: card.y + card.h * fy })), { duration: 40 });
  const after = await ink('return (await layer.strokes()).length;');
  check('draw button: Draw from the upper right draws on the card', after === before + 1, JSON.stringify({ before, after }));
  await pointerAt([await centre('.draw')]);
  const grip = await centre('.grip');
  await pointerAt([grip, { x: grip.x - 200, y: grip.y + 300 }, { x: 999, y: 799 }], { duration: 60 });
  const dragged = await head();
  check('draw button: dragged past the lower right edge it stops 16 px in',
    Math.abs(dragged.right - 16) < 1 && Math.abs(dragged.bottom - 16) < 1, JSON.stringify(dragged));
  const kept = await ff.run(() => Object.entries(localStorage).find(([key]) => key.startsWith('toybox.draw-layer.place.'))?.[1] ?? null);
  check('draw button: the dragged place is remembered', JSON.parse(kept ?? 'null')?.spot !== null, String(kept));
  await openMenu();
  await pointerAt([await centre('.reset')]);
  const reset = await head();
  check('draw button: Reset position puts it back in the upper right', Math.abs(reset.right - 16) < 1 && Math.abs(reset.top - 16) < 1, JSON.stringify(reset));
  await pickCorner('bottom-left');
}

// Firefox has no EyeDropper API, so this is the path that samples Toybox's own drawing: with
// another colour chosen, the Eyedropper and a click on a point of the stroke give the pen the
// stroke's colour back, without drawing.
async function checkEyedropper(ink, onStroke) {
  const drawn = await ink("return (await layer.strokes())[0].color;");
  await ink("root.querySelector('.swatches [data-color=\"#3b6fb5\"]').click();");
  // Pressed from script: the dice tray's open window covers the tool bar at this scroll position.
  await ink("root.querySelector('.eyedropper').click();");
  const waiting = await ink("return { api: 'EyeDropper' in window, pressed: root.querySelector('.eyedropper').getAttribute('aria-pressed'), cursor: getComputedStyle(overlay).cursor, state: root.querySelector('.pickstate').textContent };");
  check('eyedropper: no EyeDropper API in Firefox, so it waits for a click with a crosshair',
    !waiting.api && waiting.pressed === 'true' && waiting.cursor === 'crosshair', JSON.stringify(waiting));
  await pointerAt([onStroke]);
  await sleep(200);
  const after = await ink("return { color: root.querySelector('.color').value, strokes: (await layer.strokes()).length, recent: root.querySelector('.recents button')?.dataset.color, picking: root.querySelector('.eyedropper').getAttribute('aria-pressed'), state: root.querySelector('.pickstate').textContent };");
  check('eyedropper: a click on the stroke picks its colour for the pen, draws nothing and ends the pick',
    after.color === drawn && after.strokes === 1 && after.picking === 'false', JSON.stringify({ drawn, after }));
  check('eyedropper: the picked colour heads the recent colours', after.recent === drawn, JSON.stringify(after));
  await shot('eyedropper');
}

async function checkPagesAndEditor() {
  await ff.run(() => document.getElementById('pages').scrollIntoView({ block: 'start' }));
  const pagesRun = (body) => ff.run(new Function(`const pages = document.getElementById('pages'); const root = pages.shadowRoot; return (async () => { ${body} })();`));
  const barButton = async (text) => {
    const at = await ff.run((wanted) => {
      const node = [...document.getElementById('pages').shadowRoot.querySelectorAll('.bar button')].find((item) => item.textContent === wanted);
      node.scrollIntoView({ block: 'center' });
      const r = node.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }, text);
    await pointerAt([at]);
  };
  await waitFor(() => Boolean(document.getElementById('pages')?.shadowRoot?.querySelector('.bar')), 'the pages to load');
  const start = await pagesRun('return (await pages.pages()).length;');
  await barButton('Add notes page');
  await pagesRun("const page = [...root.querySelectorAll('.notes-page')].at(-1); page.querySelector('.title').value = 'Rumours'; page.querySelector('.title').dispatchEvent(new Event('input', { bubbles: true }));");
  await barButton('Add drawing page');
  await sleep(600);
  const page = await pagesRun("const node = [...root.querySelectorAll('.drawing-page')].at(-1); node.scrollIntoView({ block: 'center' }); const r = node.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height };");
  await pointerAt([[0.2, 0.2], [0.5, 0.4], [0.8, 0.3]].map(([fx, fy]) => ({ x: page.x + page.w * fx, y: page.y + page.h * fy })), { duration: 40 });
  const after = await pagesRun('return (await pages.pages()).slice(-2).map((entry) => ({ kind: entry.kind, title: entry.title, strokes: entry.strokes.length }));');
  check('pages: a notes page and a drawing page are added, written and drawn on',
    JSON.stringify(after) === JSON.stringify([{ kind: 'notes', title: 'Rumours', strokes: 0 }, { kind: 'drawing', strokes: 1 }]), JSON.stringify({ start, after }));
  await shot('pages');
  const up = await pagesRun("const node = [...root.querySelectorAll('.page-wrap')].at(-1).querySelector('.up'); node.scrollIntoView({ block: 'center' }); const r = node.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 };");
  await pointerAt([up]);
  const order = await pagesRun('return (await pages.pages()).slice(-2).map((entry) => entry.kind);');
  check('pages: Move up reorders them', JSON.stringify(order) === '["drawing","notes"]', JSON.stringify(order));

  // The image editor on the card's portrait: draw, Done, and the portrait shows it.
  await ff.run(() => document.getElementById('card').scrollIntoView({ block: 'center' }));
  const portrait = await pageRect('#portrait');
  await pointerAt([{ x: portrait.x + portrait.w / 2, y: portrait.y + portrait.h / 2 }]);
  await waitFor(() => Boolean(document.querySelector('[data-toybox-image-editor]')), 'the image editor to open');
  const editor = (body) => ff.run(new Function(`const root = document.querySelector('[data-toybox-image-editor]').shadowRoot; return (${body});`));
  const box = await editor("(() => { const r = root.querySelector('.box').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; })()");
  await pointerAt([[0.35, 0.35], [0.5, 0.6], [0.65, 0.4]].map(([fx, fy]) => ({ x: box.x + box.w * fx, y: box.y + box.h * fy })), { duration: 40 });
  await shot('image-editor');
  const done = await editor("(() => { const r = root.querySelector('.done').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()");
  await pointerAt([done]);
  await waitFor(() => document.getElementById('portrait').style.backgroundImage.startsWith('url("data:image/'), 'the portrait to show the edit');
  check('image editor: Done draws the edit into the image box', true);
  check('image editor: closes after Done', await ff.run(() => !document.querySelector('[data-toybox-image-editor]')));
}

async function checkChunksUnderSubPath() {
  const loaded = await ff.run(() => performance.getEntriesByType('resource').map((entry) => entry.name));
  const base = new URL('./', pageUrl).href;
  const chunks = loaded.filter((name) => /\/chunks\//.test(name));
  check('every chunk loads from chunks/ next to the script, under the sub-path', chunks.length > 0 && chunks.every((name) => name.startsWith(`${base}chunks/`)), chunks.join(' '));
  for (const part of ['tray', 'background', 'layer', 'pages', 'image-editor']) {
    check(`the ${part} chunk loaded on use`, chunks.some((name) => new RegExp(`/chunks/${part}-[A-Z0-9]+\\.js$`).test(name)));
  }
}

try {
  await ff.send('browsingContext.navigate', { context: ff.context, url: pageUrl, wait: 'complete' });
  await waitFor(() => Boolean(document.getElementById('drawer')?.shadowRoot?.querySelector('.card')), 'the drawer to render');
  const pageShot = await ff.send('browsingContext.captureScreenshot', { context: ff.context, origin: 'viewport' });
  writeFileSync(join(out, `demo${suffix}.png`), Buffer.from(pageShot.data, 'base64'));
  for (const [name, run] of [['floating drawer', closeFloatingDrawer], ['dice tray', checkDiceTray], ['background', checkBackground], ['draw layer', checkDrawLayer], ['pages and image editor', checkPagesAndEditor], ['chunks', checkChunksUnderSubPath], ['closing the dice tray', closeDiceTray]]) {
    try {
      await run();
    } catch (err) {
      check(`${name}: run`, false, err.stack);
    }
  }
  await checkEmbeds();
  await checkFloatingWindow();
  await openEveryToy();
} catch (err) {
  check('run completed', false, err.stack);
} finally {
  const errors = ff.events.filter((event) => event.method === 'log.entryAdded' && event.params.level === 'error').map((event) => event.params.text);
  check('no errors in the page console', errors.length === 0, errors.join(' | '));
  writeFileSync(join(out, 'results.json'), JSON.stringify(results, null, 2));
  await ff.close();
  rmSync(profile, { recursive: true, force: true });
}
const failed = results.filter((result) => !result.ok).length;
console.log(`${results.filter((result) => result.ok).length} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
