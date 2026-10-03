// The shared floating window (src/elements/window.js and window-state.js), which the dice tray,
// the floating toy drawer and the toys' windows all use: kept on screen when dragged, never
// below its minimum when resized, minimized to its bar and restored, remembered, moved by the
// arrow keys from its focused title bar, closed by Escape, and raised to the front of a stack.
// Driven with stand-in elements; the real pointer drag is in the Firefox run (e2e/drive.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { attachWindow, STACK_BASE, windowStack } from '../src/elements/window.js';
import * as WindowState from '../src/elements/window-state.js';

const VIEW = { width: 1000, height: 800 };
const MIN = { w: 300, h: 360 };

test('clamp keeps the window inside the viewport and at its minimum, and a small viewport wins over the minimum', () => {
  const base = { open: true, minimized: false };
  assert.deepEqual(WindowState.clamp({ ...base, x: -40, y: 900, w: 440, h: 520 }, VIEW, { min: MIN }), { ...base, x: 0, y: 280, w: 440, h: 520 });
  assert.deepEqual(WindowState.clamp({ ...base, x: 10, y: 10, w: 50, h: 50 }, VIEW, { min: MIN }), { ...base, x: 10, y: 10, w: 300, h: 360 });
  assert.deepEqual(WindowState.clamp({ ...base, x: 0, y: 0, w: 50, h: 50 }, { width: 200, height: 100 }, { min: MIN }), { ...base, x: 0, y: 0, w: 200, h: 100 });
  assert.throws(() => WindowState.clamp({ ...base, x: 0, y: 0, w: 1, h: 1 }, VIEW, { min: MIN, anchor: 'middle' }), /unknown window anchor/);
});

test('a window minimized to the top of its rectangle may go down until only its bar is on screen', () => {
  const state = { open: true, minimized: true, x: 0, y: 5000, w: 440, h: 520 };
  assert.equal(WindowState.clamp(state, VIEW, { min: MIN, barHeight: 30 }).y, 800 - 30);
  assert.equal(WindowState.clamp({ ...state, minimized: false }, VIEW, { min: MIN, barHeight: 30 }).y, 800 - 520);
  assert.equal(WindowState.clamp({ ...state, y: -50 }, VIEW, { min: MIN, barHeight: 30 }).y, 0);
});

// Stand-ins: listeners by event, a style, classes and attributes.
function element(extra = {}) {
  const listeners = {};
  const classes = new Set();
  return {
    listeners, style: {}, hidden: false, attributes: {}, offsetHeight: 0, clientHeight: 0, title: '',
    classList: { toggle: (name, on) => (on ? classes.add(name) : classes.delete(name)), contains: (name) => classes.has(name), add: (name) => classes.add(name), remove: (name) => classes.delete(name) },
    addEventListener(type, fn, options) {
      (listeners[type] ||= []).push(fn);
      options?.signal?.addEventListener('abort', () => this.removeEventListener(type, fn));
    },
    removeEventListener(type, fn) { listeners[type] = (listeners[type] || []).filter((other) => other !== fn); },
    fire(type, event = {}) { for (const fn of listeners[type] || []) fn(event); },
    count() { return Object.values(listeners).reduce((sum, list) => sum + list.length, 0); },
    setAttribute(name, value) { this.attributes[name] = value; },
    focus() {}, setPointerCapture() {},
    ...extra,
  };
}

function open({ stored = null, stack = null, escapeCloses = false } = {}) {
  const writes = [];
  const events = [];
  const win = { innerWidth: VIEW.width, innerHeight: VIEW.height, ...element() };
  const els = { box: element(), bar: element({ offsetHeight: 30 }), grip: element(), minimize: element(), close: element() };
  const handle = attachWindow({
    win, els, stack, escapeCloses, min: MIN, name: 'Lava lamp',
    store: { read: () => stored, write: (text) => writes.push(JSON.parse(text)) },
    place: (view) => ({ x: 16, y: view.height - 520 - 16, w: 440, h: 520, open: true, minimized: false }),
    onClose: () => events.push('close'),
    onFront: () => events.push('front'),
  });
  return { win, els, writes, events, handle };
}

const press = (x, y) => ({ button: 0, target: { closest: () => null }, clientX: x, clientY: y, pointerId: 1, preventDefault() {} });

test('a new window opens where place() puts it; a remembered one where it was, pulled back on screen', () => {
  const { els } = open();
  assert.deepEqual([els.box.style.left, els.box.style.top, els.box.style.width, els.box.style.height], ['16px', '264px', '440px', '520px']);
  const kept = open({ stored: WindowState.serialize({ x: 900, y: 100, w: 440, h: 520, open: true, minimized: false }) });
  assert.equal(kept.els.box.style.left, '560px');
  assert.equal(open({ stored: '{"x":"no"}' }).els.box.style.left, '16px', 'an entry it did not write is ignored');
});

test('dragging the title bar moves the window, keeps it on screen and remembers it on release', () => {
  const { els, writes } = open();
  els.bar.fire('pointerdown', press(100, 280));
  els.bar.fire('pointermove', { clientX: 300, clientY: 180 });
  assert.equal(writes.length, 0, 'nothing is written while dragging');
  assert.deepEqual([els.box.style.left, els.box.style.top], ['216px', '164px']);
  els.bar.fire('pointermove', { clientX: 5000, clientY: -5000 });
  els.bar.fire('pointerup', {});
  assert.deepEqual([writes.at(-1).x, writes.at(-1).y], [560, 0]);
});

test('the corner handle resizes, no smaller than the minimum and no further than the window\'s edge', () => {
  const { els, writes } = open();
  els.grip.fire('pointerdown', press(456, 784));
  els.grip.fire('pointermove', { clientX: 5000, clientY: 5000 });
  assert.deepEqual([els.box.style.width, els.box.style.height], ['984px', '536px']);
  els.grip.fire('pointermove', { clientX: 0, clientY: 0 });
  els.grip.fire('pointerup', {});
  assert.deepEqual([writes.at(-1).w, writes.at(-1).h], [300, 360]);
});

test('minimize shows only the bar where it was, restore brings the window back, and both are remembered', () => {
  const { els, writes } = open();
  els.minimize.fire('click');
  assert.ok(els.box.classList.contains('minimized'));
  assert.equal(els.box.style.top, '264px', 'the bar stays where it was');
  assert.equal(els.box.style.height, '');
  assert.deepEqual([writes.at(-1).minimized, els.minimize.attributes['aria-expanded'], els.minimize.title], [true, 'false', 'Restore Lava lamp']);
  els.minimize.fire('click');
  assert.deepEqual([writes.at(-1).minimized, els.box.style.height, els.minimize.title], [false, '520px', 'Minimize Lava lamp']);
});

test('the close button and Escape close the window, remembered, and tell the owner', () => {
  const { els, writes, events } = open({ escapeCloses: true });
  els.close.fire('click');
  assert.deepEqual([els.box.hidden, writes.at(-1).open, events], [true, false, ['close']]);
  const second = open({ escapeCloses: true });
  let stopped = false;
  second.els.box.fire('keydown', { key: 'Escape', stopPropagation() { stopped = true; } });
  assert.deepEqual([second.els.box.hidden, second.events, stopped], [true, ['close'], true]);
  const third = open();
  third.els.box.fire('keydown', { key: 'Escape', stopPropagation() {} });
  assert.equal(third.els.box.hidden, false, 'without escapeCloses Escape is left alone');
});

test('arrow keys on the focused title bar move the window, Shift in bigger steps, kept on screen', () => {
  const { els, writes } = open();
  const key = (name, shiftKey = false) => els.bar.fire('keydown', { key: name, shiftKey, target: els.bar, preventDefault() {} });
  key('ArrowRight');
  key('ArrowUp', true);
  assert.deepEqual([writes.at(-1).x, writes.at(-1).y], [26, 214]);
  key('ArrowLeft', true);
  assert.equal(writes.at(-1).x, 0);
  const count = writes.length;
  els.bar.fire('keydown', { key: 'ArrowRight', target: els.minimize, preventDefault() {} });
  assert.equal(writes.length, count, 'arrows on a bar button do not move the window');
});

test('the stack raises a pressed window to the front and renumbers from its base', () => {
  const stack = windowStack({});
  const first = open({ stack });
  const second = open({ stack });
  assert.deepEqual([first.els.box.style.zIndex, second.els.box.style.zIndex], [String(STACK_BASE), String(STACK_BASE + 1)]);
  first.els.box.fire('pointerdown', {});
  assert.deepEqual(stack.order(), [second.els.box, first.els.box]);
  assert.deepEqual([first.els.box.style.zIndex, second.els.box.style.zIndex], [String(STACK_BASE + 1), String(STACK_BASE)]);
  assert.deepEqual(first.events, ['front']);
  second.els.box.fire('focusin', {});
  assert.equal(stack.order().at(-1), second.els.box);
  for (let i = 0; i < 1000; i += 1) (i % 2 ? first : second).els.box.fire('pointerdown', {});
  assert.ok(Number(first.els.box.style.zIndex) <= STACK_BASE + 1, 'raising often does not climb towards the maximum');
  first.handle.detach();
  assert.deepEqual(stack.order(), [second.els.box]);
  assert.equal(second.els.box.style.zIndex, String(STACK_BASE));
});

test('a window is pulled back on screen when the browser window shrinks, and detach removes every listener', () => {
  const { win, els, handle } = open({ stored: WindowState.serialize({ x: 500, y: 200, w: 440, h: 520, open: true, minimized: false }) });
  win.innerWidth = 700;
  win.fire('resize');
  assert.equal(els.box.style.left, '260px');
  handle.detach();
  for (const node of [win, els.box, els.bar, els.grip, els.minimize, els.close]) assert.equal(node.count(), 0);
});
