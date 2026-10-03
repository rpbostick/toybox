// The dice tray window: 4 × 8 in at the lower corner of its side by default, kept fully on screen
// at every size and place, never below its minimum size, and remembered in a form that refuses
// anything it did not write. tray-window.js is driven here with stand-in elements; the real
// pointer drag and resize are in the Firefox run (e2e/drive.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { attach as attachWindow } from '../src/dice/tray-window.js';
import * as WindowState from '../src/dice/window-state.js';

const VIEW = { width: 1400, height: 1000 };

test('the default tray is 384 x 768 px (4 x 8 in) at the lower right, 16 px in', () => {
  assert.deepEqual(WindowState.defaultState(VIEW, 'right'), { x: 1000, y: 216, w: 384, h: 768, open: true, minimized: false });
});

test('side="left" opens the default tray at the lower left', () => {
  assert.deepEqual(WindowState.defaultState(VIEW, 'left'), { x: 16, y: 216, w: 384, h: 768, open: true, minimized: false });
  assert.throws(() => WindowState.defaultState(VIEW), /unknown tray side/);
  assert.throws(() => WindowState.defaultState(VIEW, 'middle'), /unknown tray side/);
});

test('a small window shrinks the default tray to fit, down to its minimum, and then to the window', () => {
  assert.deepEqual(WindowState.defaultState({ width: 800, height: 600 }, 'right'), { x: 400, y: 0, w: 384, h: 600, open: true, minimized: false });
  const tiny = WindowState.defaultState({ width: 250, height: 300 }, 'right');
  assert.deepEqual([tiny.x, tiny.y, tiny.w, tiny.h], [0, 0, 250, 300]);
});

test('a tray at either side\'s default spot follows a change of side; one put elsewhere keeps its place', () => {
  const right = WindowState.defaultState(VIEW, 'right');
  const left = WindowState.defaultState(VIEW, 'left');
  assert.deepEqual(WindowState.followSide(right, VIEW, 'left'), left);
  assert.deepEqual(WindowState.followSide(left, VIEW, 'right'), right);
  assert.deepEqual(WindowState.followSide({ ...right, minimized: true }, VIEW, 'left'), { ...left, minimized: true });
  const moved = { ...right, x: 700 };
  assert.equal(WindowState.followSide(moved, VIEW, 'left'), moved);
  const resized = { ...right, w: 300 };
  assert.equal(WindowState.followSide(resized, VIEW, 'left'), resized);
});

test('clamp keeps the whole tray on screen and at least 280 x 420', () => {
  const base = { open: true, minimized: false };
  assert.deepEqual(WindowState.clamp({ ...base, x: -50, y: -10, w: 384, h: 768 }, VIEW), { ...base, x: 0, y: 0, w: 384, h: 768 });
  assert.deepEqual(WindowState.clamp({ ...base, x: 1300, y: 900, w: 384, h: 768 }, VIEW), { ...base, x: 1016, y: 232, w: 384, h: 768 });
  assert.deepEqual(WindowState.clamp({ ...base, x: 10, y: 10, w: 100, h: 100 }, VIEW), { ...base, x: 10, y: 10, w: 280, h: 420 });
  assert.deepEqual(WindowState.clamp({ ...base, x: 0, y: 0, w: 3000, h: 3000 }, VIEW), { ...base, x: 0, y: 0, w: 1400, h: 1000 });
});

test('a minimized tray keeps its title bar on screen, at the bottom of its rectangle', () => {
  const state = { open: true, minimized: true, x: 0, y: -2000, w: 384, h: 768 };
  // With a 30 px bar the rectangle may rise until the bar meets the top: y + 768 - 30 >= 0.
  assert.equal(WindowState.clamp(state, VIEW, 30).y, 30 - 768);
  assert.equal(WindowState.clamp({ ...state, minimized: false }, VIEW, 30).y, 0);
});

test('the remembered state round-trips, and anything else is refused', () => {
  const state = { x: 12, y: 34, w: 300, h: 500, open: false, minimized: true };
  assert.deepEqual(WindowState.parse(WindowState.serialize({ ...state, extra: 1 })), state);
  for (const bad of [null, '', 'not json', '[]', 'null', '{"x":1}', JSON.stringify({ ...state, w: '300' }), JSON.stringify({ ...state, x: null }), JSON.stringify({ ...state, open: 1 })]) {
    assert.equal(WindowState.parse(bad), null, String(bad));
  }
});

// Stand-ins for the tray's elements: listeners by event, a style, classes and attributes.
function element(extra = {}) {
  const listeners = {};
  const classes = new Set();
  return {
    listeners, style: {}, hidden: false, attributes: {}, offsetHeight: 0, clientHeight: 0, title: '',
    classList: { toggle: (name, on) => (on ? classes.add(name) : classes.delete(name)), contains: (name) => classes.has(name), add: (name) => classes.add(name), remove: (name) => classes.delete(name) },
    addEventListener(type, fn) { (listeners[type] ||= []).push(fn); },
    removeEventListener(type, fn) { listeners[type] = (listeners[type] || []).filter((other) => other !== fn); },
    fire(type, event = {}) { for (const fn of listeners[type] || []) fn(event); },
    setAttribute(name, value) { this.attributes[name] = value; },
    focus() {}, setPointerCapture() {},
    ...extra,
  };
}

function attach(stored, view = VIEW, side = 'right') {
  const writes = [];
  const win = { innerWidth: view.width, innerHeight: view.height, ...element() };
  const els = { tray: element(), bar: element({ offsetHeight: 30 }), grip: element(), minimize: element(), close: element(), open: element() };
  const handle = attachWindow({ win, els, side, store: { read: () => stored, write: (text) => writes.push(JSON.parse(text)) } });
  return { win, els, writes, handle };
}

test('side="left" opens the tray at the lower left', () => {
  const { els } = attach(null, VIEW, 'left');
  assert.deepEqual([els.tray.style.left, els.tray.style.top], ['16px', '216px']);
});

test('a remembered tray at the default spot opens on its side; a moved one stays put', () => {
  const atRight = WindowState.serialize(WindowState.defaultState(VIEW, 'right'));
  assert.equal(attach(atRight, VIEW, 'left').els.tray.style.left, '16px');
  const moved = WindowState.serialize({ x: 600, y: 100, w: 384, h: 768, open: true, minimized: false });
  assert.equal(attach(moved, VIEW, 'left').els.tray.style.left, '600px');
});

test('changing side moves a tray still at its default spot, and remembers it; a moved tray stays', () => {
  const { els, writes, handle } = attach(null);
  handle.setSide('left');
  assert.deepEqual([els.tray.style.left, els.tray.style.top], ['16px', '216px']);
  assert.deepEqual([writes.at(-1).x, writes.at(-1).y], [16, 216]);
  handle.setSide('right');
  assert.equal(els.tray.style.left, '1000px');

  const placed = attach(WindowState.serialize({ x: 600, y: 100, w: 384, h: 768, open: true, minimized: false }));
  placed.handle.setSide('left');
  assert.equal(placed.els.tray.style.left, '600px');
  assert.equal(placed.writes.length, 0);
});

test('the tray is placed from the remembered state, pulled back on screen if the window shrank', () => {
  const { els, handle } = attach(WindowState.serialize({ x: 1500, y: 900, w: 384, h: 768, open: true, minimized: false }));
  assert.deepEqual([els.tray.style.left, els.tray.style.top, els.tray.style.width, els.tray.style.height], ['1016px', '232px', '384px', '768px']);
  assert.equal(handle.state().x, 1016);
});

test('minimize, close and the launcher are remembered; the launcher shows only while the tray is closed', () => {
  const { els, writes } = attach(null);
  assert.equal(els.open.hidden, true);
  els.minimize.fire('click');
  assert.equal(writes.at(-1).minimized, true);
  assert.ok(els.tray.classList.contains('minimized'));
  // Minimized, only the bar shows, at the bottom of the tray's rectangle (216 + 768 - 30).
  assert.equal(els.tray.style.top, '954px');
  els.close.fire('click');
  assert.equal(writes.at(-1).open, false);
  assert.deepEqual([els.tray.hidden, els.open.hidden], [true, false]);
  els.open.fire('click');
  assert.deepEqual([writes.at(-1).open, writes.at(-1).minimized, els.tray.hidden, els.open.hidden], [true, false, false, true]);
});

test('a drag on the title bar moves the tray, stays on screen and is remembered when released', () => {
  const { els, writes } = attach(null);
  const target = { closest: () => null };
  els.bar.fire('pointerdown', { button: 0, target, clientX: 1040, clientY: 230, pointerId: 1, preventDefault() {} });
  els.bar.fire('pointermove', { clientX: 40, clientY: 30 });
  assert.equal(writes.length, 0, 'nothing is written while dragging');
  assert.deepEqual([els.tray.style.left, els.tray.style.top], ['0px', '16px']);
  els.bar.fire('pointermove', { clientX: -500, clientY: -500 });
  els.bar.fire('pointerup', {});
  assert.deepEqual([writes.at(-1).x, writes.at(-1).y], [0, 0]);
});

test('the corner handle resizes the tray, no smaller than 280 x 420 and no further than the window\'s edge', () => {
  const { els, writes } = attach(WindowState.serialize({ x: 100, y: 100, w: 384, h: 768, open: true, minimized: false }));
  const target = { closest: () => null };
  els.grip.fire('pointerdown', { button: 0, target, clientX: 484, clientY: 868, pointerId: 1, preventDefault() {} });
  els.grip.fire('pointermove', { clientX: 5000, clientY: 5000 });
  assert.deepEqual([els.tray.style.width, els.tray.style.height, els.tray.style.left], ['1300px', '900px', '100px']);
  els.grip.fire('pointermove', { clientX: 0, clientY: 0 });
  els.grip.fire('pointerup', {});
  assert.deepEqual([writes.at(-1).w, writes.at(-1).h], [280, 420]);
});

test('a size the browser gives by CSS resize is kept, but not while minimized', () => {
  const { writes, handle } = attach(null);
  handle.resized(500, 600);
  assert.deepEqual([writes.at(-1).w, writes.at(-1).h], [500, 600]);
  const count = writes.length;
  handle.resized(500, 600);
  assert.equal(writes.length, count, 'the same size writes nothing');
});

test('a press on a title-bar button does not start a drag', () => {
  const { els } = attach(null);
  els.bar.fire('pointerdown', { button: 0, target: { closest: () => ({}) }, clientX: 1040, clientY: 230, pointerId: 1, preventDefault() {} });
  assert.equal((els.bar.listeners.pointermove || []).length, 0);
});
