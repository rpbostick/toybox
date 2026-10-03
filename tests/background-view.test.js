// The background view (src/background/view.js) in happy-dom, with recording stand-ins for the
// built-in backgrounds and a registered one (happy-dom has no WebGL or canvas): what a
// background is mounted with and told (colours, pointer only during a drag that started on bare
// background and only while "reacts to the mouse" is on, the grab and grabbing cursors, pause out
// of sight and under reduced motion), switching,
// turning off, a background that fails, and the middle press that asks for the color mode.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerBackground } from '../src/background/backgrounds.js';
import { PAGE } from '../src/background/looks.js';
import { mountView } from '../src/background/view.js';
import { makeWindow } from './happy-window.js';

/** A background that records every call, in the shape a page's own would have. */
function recorder(log, name) {
  return {
    mount(el, api) {
      log.push([name, 'mount', api]);
      el.append(Object.assign(el.ownerDocument.createElement('canvas'), { className: name }));
      return {
        setColors: (colors) => log.push([name, 'setColors', colors]),
        pointer: (point) => log.push([name, 'pointer', point]),
        pause: () => log.push([name, 'pause']),
        resume: () => log.push([name, 'resume']),
        destroy: () => log.push([name, 'destroy']),
      };
    },
  };
}

function setup({ reducedMotion = 'no-preference', ...settings } = {}) {
  const { win, doc } = makeWindow({ reducedMotion });
  doc.body.innerHTML = '<div id="wrap"><div data-solid id="card">text</div></div>';
  const layer = doc.createElement('div');
  doc.body.append(layer);
  const log = [];
  const requests = [];
  const reports = [];
  const effects = { lines: recorder(log, 'lines'), aurora: recorder(log, 'aurora') };
  const view = mountView(layer, {
    background: 'lines', theme: 'light', paper: null, on: true, hidden: false, interactive: true, colorMode: false,
    motion: { ripple: true, sheet: true, spin: true, momentum: true },
    onColorMode: (...args) => reports.push(args), onColorModeRequest: (active) => requests.push(active), ...settings,
  }, { effects });
  const calls = (name, kind) => log.filter((entry) => entry[0] === name && entry[1] === kind);
  return { win, doc, layer, view, log, calls, requests, reports };
}

const move = (win, target, x, y, extra = {}) => target.dispatchEvent(new win.PointerEvent('pointermove', { clientX: x, clientY: y, pointerId: 1, pointerType: 'mouse', bubbles: true, ...extra }));

test('the background is mounted under a wash of the page colour with the look\'s three colours', () => {
  const { layer, calls } = setup();
  const [[, , api]] = calls('lines', 'mount');
  assert.equal(api.theme, 'light');
  assert.equal(api.colors.theme, 'light');
  assert.equal(api.colors.hex.length, 3);
  for (const hex of api.colors.hex) assert.match(hex, /^#[0-9a-f]{6}$/);
  for (const rgb of api.colors.rgb) assert.ok(rgb.length === 3 && rgb.every((channel) => channel >= 0 && channel <= 1));
  assert.ok(layer.querySelector('.backdrop-layers > .backdrop-effect > canvas.lines'));
  const wash = layer.querySelector('.backdrop-wash');
  assert.ok(Number(wash.style.opacity) > 0 && Number(wash.style.opacity) < 1);
  assert.ok(layer.querySelector('.backdrop-layers').style.backgroundColor, 'the page colour is under the effect');
  assert.ok(PAGE.light);
});

const pointer = (type) => (win, target, x, y, extra = {}) => target.dispatchEvent(new win.PointerEvent(type, { button: 0, clientX: x, clientY: y, pointerId: 1, pointerType: 'mouse', bubbles: true, ...extra }));
const down = pointer('pointerdown');
const up = pointer('pointerup');
const points = (calls, name = 'lines') => calls(name, 'pointer').map((entry) => entry[2]);
const classOn = (doc, name) => doc.documentElement.classList.contains(name);

test('hovering bare background feeds the background nothing', () => {
  const { win, doc, calls } = setup();
  // happy-dom lays nothing out: the point is over the wrapper, as it would be in a browser.
  doc.elementFromPoint = () => doc.getElementById('wrap');
  move(win, doc.getElementById('wrap'), 40, 50);
  move(win, doc.body, 60, 50);
  assert.deepEqual(points(calls), []);
});

test('a drag from bare background feeds every move wherever it goes, and release sends the leave', () => {
  const { win, doc, calls } = setup();
  const wrap = doc.getElementById('wrap');
  const card = doc.getElementById('card');
  down(win, wrap, 10, 20);
  move(win, wrap, 30, 20);
  move(win, card, 140, 50);
  up(win, card, 140, 50);
  move(win, wrap, 50, 50);
  assert.deepEqual(points(calls), [{ x: 10, y: 20 }, { x: 30, y: 20 }, { x: 140, y: 50 }, null], 'over content too while held; nothing after release');
});

test('a drag from content feeds nothing; cancel and the pointer leaving the window end a drag', () => {
  const { win, doc, calls } = setup();
  const wrap = doc.getElementById('wrap');
  down(win, doc.getElementById('card'), 140, 50);
  move(win, wrap, 30, 20);
  up(win, wrap, 30, 20);
  assert.deepEqual(points(calls), [], 'a press on data-solid content is not a drag');
  down(win, wrap, 10, 10);
  wrap.dispatchEvent(new win.PointerEvent('pointercancel', { pointerId: 1, bubbles: true }));
  assert.deepEqual(points(calls), [{ x: 10, y: 10 }, null]);
  down(win, wrap, 12, 12);
  doc.body.dispatchEvent(new win.MouseEvent('mouseout', { relatedTarget: null, bubbles: true }));
  move(win, wrap, 14, 14);
  assert.deepEqual(points(calls).slice(2), [{ x: 12, y: 12 }, null]);
});

test('bare background shows grab, a drag shows grabbing everywhere with no text selection, and release clears it', () => {
  const { win, doc } = setup();
  const sheet = doc.head.querySelector('style[data-toybox-background]');
  assert.match(sheet.textContent, /html\.toybox-background-grab \{ cursor: grab; \}/);
  assert.match(sheet.textContent, /html\.toybox-background-dragging, html\.toybox-background-dragging \* \{ cursor: grabbing !important; user-select: none !important;/);
  const wrap = doc.getElementById('wrap');
  const card = doc.getElementById('card');
  move(win, wrap, 10, 10);
  assert.equal(classOn(doc, 'toybox-background-grab'), true);
  move(win, card, 140, 10);
  assert.equal(classOn(doc, 'toybox-background-grab'), false, 'no grab over content');
  down(win, wrap, 10, 10);
  assert.equal(classOn(doc, 'toybox-background-dragging'), true);
  move(win, card, 140, 10);
  assert.equal(classOn(doc, 'toybox-background-dragging'), true, 'grabbing stays over content during the drag');
  up(win, card, 140, 10);
  assert.equal(classOn(doc, 'toybox-background-dragging'), false);
});

test('"reacts to the mouse" off: no grab cursor, no drag, and turning it off mid-drag sends the leave', () => {
  const { win, doc, view, calls } = setup();
  const wrap = doc.getElementById('wrap');
  down(win, wrap, 5, 5);
  view.update({ interactive: false });
  assert.deepEqual(points(calls), [{ x: 5, y: 5 }, null]);
  assert.equal(classOn(doc, 'toybox-background-dragging'), false);
  up(win, wrap, 5, 5);
  move(win, wrap, 6, 6);
  assert.equal(classOn(doc, 'toybox-background-grab'), false);
  down(win, wrap, 7, 7);
  move(win, wrap, 8, 8);
  assert.equal(points(calls).length, 2, 'nothing reaches it with the mouse response off');
  up(win, wrap, 8, 8);
  view.update({ interactive: true });
  down(win, wrap, 9, 9);
  assert.deepEqual(points(calls).at(-1), { x: 9, y: 9 });
  view.unmount();
  assert.equal(doc.head.querySelector('style[data-toybox-background]'), null, 'unmount removes the cursor rules');
});

test('a registered background gets the same drag-only pointer', () => {
  const heard = [];
  registerBackground('test-drag', {
    name: 'Drag',
    mount: () => ({ pointer: (point) => heard.push(point), destroy() {} }),
  });
  const { win, doc } = setup({ background: 'test-drag' });
  const wrap = doc.getElementById('wrap');
  move(win, wrap, 1, 1);
  down(win, doc.getElementById('card'), 2, 2);
  up(win, doc.getElementById('card'), 2, 2);
  down(win, wrap, 3, 3);
  move(win, doc.getElementById('card'), 4, 4);
  up(win, wrap, 4, 4);
  assert.deepEqual(heard, [{ x: 3, y: 3 }, { x: 4, y: 4 }, null]);
});

const wait = (win, ms) => new Promise((resolve) => win.setTimeout(resolve, ms));

/** The layer sized as the viewport it covers (happy-dom lays nothing out). */
function sized(layer) {
  Object.defineProperty(layer, 'clientWidth', { value: 1000 });
  Object.defineProperty(layer, 'clientHeight', { value: 800 });
}

/** A drag rightwards on bare background, 8 px every 16 ms, then let go. */
async function flingOn(win, wrap) {
  down(win, wrap, 100, 400);
  for (let step = 1; step <= 8; step++) {
    await wait(win, 16);
    move(win, wrap, 100 + 8 * step, 400);
  }
  up(win, wrap, 164, 400);
}

test('a fling coasts on: the background hears the coasting pointer once a frame after the release, onwards, then null', async () => {
  const { win, doc, layer, view, calls } = setup();
  sized(layer);
  await flingOn(win, doc.getElementById('wrap'));
  const atRelease = points(calls).length;
  assert.deepEqual(points(calls).at(-1), { x: 164, y: 400 }, 'no null at the release');
  await wait(win, 150);
  const coast = points(calls).slice(atRelease);
  assert.ok(coast.length >= 2, `coasting points after the release (${coast.length})`);
  assert.ok(coast[0].x > 164 && coast.at(-1).x > coast[0].x, 'on to the right');
  view.update({ interactive: false });
  assert.equal(points(calls).at(-1), null, 'turning the mouse response off ends the coast');
  const after = points(calls).length;
  await wait(win, 60);
  assert.equal(points(calls).length, after);
  view.unmount();
});

test('momentum="off" or reduced motion: the release sends null at once and nothing coasts', async () => {
  for (const settings of [{ motion: { ripple: true, sheet: true, spin: true, momentum: false } }, { reducedMotion: 'reduce' }]) {
    const { win, doc, layer, view, calls } = setup(settings);
    sized(layer);
    await flingOn(win, doc.getElementById('wrap'));
    assert.equal(points(calls).at(-1), null);
    const count = points(calls).length;
    await wait(win, 60);
    assert.equal(points(calls).length, count);
    view.unmount();
  }
});

test('a registered background gets api.motion: the coasting pointer, the sheet, the ripple field and the spin, with the options set', async () => {
  let motion = null;
  let frame = null;
  registerBackground('test-motion', {
    name: 'Motion',
    // Reads the sheet once a frame, as the documented use is: the sheet moves as it is read.
    mount(el, api) {
      motion = api.motion;
      const win = el.ownerDocument.defaultView;
      const tick = () => {
        motion.sheet();
        frame = win.requestAnimationFrame(tick);
      };
      tick();
      return { destroy: () => win.cancelAnimationFrame(frame) };
    },
  });
  const { win, doc, layer, view } = setup({ background: 'test-motion' });
  sized(layer);
  for (const name of ['pointer', 'sheet', 'spin', 'sample', 'ripple', 'displace']) assert.equal(typeof motion[name], 'function', name);
  assert.deepEqual(motion.options, { ripple: true, sheet: true, spin: true, momentum: true });
  assert.equal(motion.reducedMotion, false);
  assert.equal(motion.pointer(), null);
  await flingOn(win, doc.getElementById('wrap'));
  assert.equal(motion.held, null);
  assert.ok(motion.pointer().x > 164, 'coasting');
  assert.ok(motion.sheet().moving, 'the sheet glides');
  view.update({ motion: { ripple: false, sheet: false, spin: true, momentum: true } });
  assert.deepEqual(motion.options, { ripple: false, sheet: false, spin: true, momentum: true });
  assert.equal(motion.sheet().moving, false);
  assert.throws(() => view.update({ motion: { ripple: 'off' } }), /motion/);
  view.unmount();
});

test('out of sight pauses the background and back in sight resumes it; reduced motion mounts it paused', () => {
  const { view, calls } = setup();
  view.update({ hidden: true });
  view.update({ hidden: true });
  assert.equal(calls('lines', 'pause').length, 1);
  view.update({ hidden: false });
  assert.equal(calls('lines', 'resume').length, 1);
  const still = setup({ reducedMotion: 'reduce' });
  assert.equal(still.calls('lines', 'pause').length, 1, 'a still frame under reduced motion');
  assert.equal(still.calls('lines', 'resume').length, 0);
});

test('a theme change gives the background the other theme\'s colours without mounting it again', () => {
  const { view, calls } = setup();
  view.update({ theme: 'dark' });
  assert.equal(calls('lines', 'mount').length, 1);
  assert.equal(calls('lines', 'setColors').at(-1)[2].theme, 'dark');
});

test('picking another background destroys the old one first; off removes the layers; unmount destroys it', () => {
  const { layer, view, log, calls } = setup();
  view.update({ background: 'aurora' });
  assert.deepEqual(log.filter((entry) => entry[1] === 'destroy' || entry[1] === 'mount').map((entry) => `${entry[0]} ${entry[1]}`), ['lines mount', 'lines destroy', 'aurora mount']);
  assert.equal(layer.querySelectorAll('canvas').length, 1);
  view.update({ on: false });
  assert.equal(calls('aurora', 'destroy').length, 1);
  assert.equal(layer.children.length, 0);
  view.update({ on: true });
  assert.equal(calls('aurora', 'mount').length, 2);
  view.unmount();
  assert.equal(calls('aurora', 'destroy').length, 2);
});

test('a background that fails to draw is logged and named on the layer; the page colour stays and the others still work', () => {
  const failing = 'test-fails';
  registerBackground(failing, { name: 'Fails', mount() { throw new Error('no WebGL here'); } });
  const { win, layer, view, calls } = setup();
  const errors = [];
  win.console.error = (...args) => errors.push(args.join(' '));
  view.update({ background: failing });
  assert.equal(layer.querySelector('.backdrop-layers').dataset.failed, failing);
  assert.match(errors[0], /"test-fails" background could not draw/);
  assert.ok(layer.querySelector('.backdrop-wash'));
  view.update({ theme: 'dark' });
  assert.equal(errors.length, 1, 'not retried on every change');
  view.update({ background: 'aurora' });
  assert.equal(calls('aurora', 'mount').length, 1);
  assert.equal(layer.querySelector('.backdrop-layers').dataset.failed, undefined);
});

test('a registered background may keep its methods on the definition; one without destroy() fails loud', () => {
  const heard = [];
  registerBackground('test-flat', {
    name: 'Flat',
    mount: () => heard.push('mount'),
    setColors: () => heard.push('setColors'),
    destroy: () => heard.push('destroy'),
  });
  registerBackground('test-leaky', { name: 'Leaky', mount() {} });
  const { win, layer, view } = setup({ background: 'test-flat' });
  view.update({ theme: 'dark' });
  view.update({ background: 'aurora' });
  assert.deepEqual(heard, ['mount', 'setColors', 'destroy']);
  const errors = [];
  win.console.error = (...args) => errors.push(args.map(String).join(' '));
  view.update({ background: 'test-leaky' });
  assert.match(errors[0], /background "test-leaky" has no destroy\(\)/);
  assert.equal(layer.querySelector('.backdrop-layers').dataset.failed, 'test-leaky');
});

test('a middle press on bare background asks for the color mode; on content it does not; Esc asks to end it', () => {
  const { win, doc, view, requests } = setup();
  const press = (target, button) => target.dispatchEvent(new win.PointerEvent('pointerdown', { button, pointerId: 2, pointerType: 'mouse', bubbles: true }));
  press(doc.getElementById('wrap'), 1);
  press(doc.getElementById('card'), 1);
  assert.deepEqual(requests, [true]);
  view.update({ colorMode: true });
  assert.ok(doc.documentElement.classList.contains('toybox-background-color-mode'));
  doc.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape' }));
  assert.deepEqual(requests, [true, false]);
  view.update({ colorMode: false });
  assert.equal(doc.documentElement.classList.contains('toybox-background-color-mode'), false);
});

test('a stop picked on the wheel reaches the background as new colours and the page as the stop', async () => {
  const { win, view, calls, reports } = setup();
  const before = calls('lines', 'mount')[0][2].colors.hex.join();
  view.pick(36);
  await new Promise((resolve) => win.setTimeout(resolve, 400));
  assert.notEqual(calls('lines', 'setColors').at(-1)?.[2].hex.join(), before);
  assert.equal(reports.at(-1)[2], 36);
  view.unmount();
});
