// Which drag dynamics each built-in background reads (its `dynamics` list against the api.motion
// calls its frames make), mounted in happy-dom with a stand-in canvas context that accepts every
// call (happy-dom has no canvas 2D or WebGL). Line waves and grid ripples take the ripple field,
// the sheet and the ball's spin; aurora, soap film, plasma and starfield the coasting pointer and
// the sheet.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MOTIONS } from '../src/background/backgrounds.js';
import { BUILT_IN_EFFECTS } from '../src/background/effects/index.js';
import { onSheet } from '../src/background/effects/stars.js';
import { createMotion } from '../src/background/motion.js';
import { makeWindow } from './happy-window.js';

/** A context whose every method returns another such object, and whose fields take anything. */
function anyContext() {
  const handler = {
    get(target, name) {
      if (typeof name === 'symbol' || name === 'then') return undefined;
      return () => new Proxy({}, handler);
    },
    set: () => true,
  };
  return new Proxy({}, handler);
}

// Which dynamic each api.motion method belongs to.
const READS = { pointer: ['momentum'], sheet: ['sheet'], ripple: ['ripple'], displace: ['ripple', 'sheet'], sample: ['spin'], spin: ['spin'] };

/** api.motion of a real motion, recording which dynamics its methods were called for. */
function spiedMotion(options) {
  const motion = createMotion({ now: () => 1000, size: () => ({ width: 800, height: 600 }) });
  motion.setOptions(options);
  const used = new Set();
  const api = { get options() { return motion.api.options; } };
  for (const [name, dynamics] of Object.entries(READS)) {
    api[name] = (...args) => {
      for (const dynamic of dynamics) used.add(dynamic);
      return motion.api[name](...args);
    };
  }
  return { api, used };
}

function mount(id, options = { ripple: true, sheet: true, spin: true, momentum: true }) {
  const { win, doc } = makeWindow();
  win.HTMLCanvasElement.prototype.getContext = anyContext;
  const el = doc.createElement('div');
  doc.body.append(el);
  const { api, used } = spiedMotion(options);
  const colors = { theme: 'light', hex: ['#112233', '#445566', '#778899'], rgb: [[0.1, 0.2, 0.3], [0.4, 0.5, 0.6], [0.7, 0.8, 0.9]] };
  const handle = BUILT_IN_EFFECTS[id].mount(el, { colors, theme: 'light', reducedMotion: false, motion: api });
  return { handle, used };
}

const CLAIMS = {
  lines: ['momentum', 'ripple', 'sheet', 'spin'],
  ripples: ['momentum', 'ripple', 'sheet', 'spin'],
  aurora: ['momentum', 'sheet'],
  film: ['momentum', 'sheet'],
  plasma: ['momentum', 'sheet'],
  stars: ['momentum', 'sheet'],
};

test('every built-in background lists the dynamics it reads, and a frame reads exactly those', () => {
  assert.deepEqual(Object.keys(CLAIMS).sort(), Object.keys(BUILT_IN_EFFECTS).sort());
  for (const [id, claim] of Object.entries(CLAIMS)) {
    assert.deepEqual([...BUILT_IN_EFFECTS[id].dynamics].sort(), [...claim].sort(), `${id} lists ${claim}`);
    assert.ok(BUILT_IN_EFFECTS[id].dynamics.every((name) => MOTIONS.includes(name)));
    const { handle, used } = mount(id);
    assert.deepEqual([...used].sort(), [...claim].sort(), `${id}'s first frame reads ${claim}`);
    handle.destroy();
  }
});

test('every built-in background draws with every dynamic off', () => {
  for (const id of Object.keys(BUILT_IN_EFFECTS)) {
    const { handle } = mount(id, { ripple: false, sheet: false, spin: false, momentum: false });
    handle.destroy();
  }
});

test('a built-in background mounted without api.motion fails loud', () => {
  const { win, doc } = makeWindow();
  win.HTMLCanvasElement.prototype.getContext = anyContext;
  for (const id of Object.keys(BUILT_IN_EFFECTS)) {
    assert.throws(() => BUILT_IN_EFFECTS[id].mount(doc.body, { colors: {}, theme: 'light', reducedMotion: false }), /api\.motion/, id);
  }
});

test('a star on the moving sheet is carried by its weight of the shift and turned against the twist', () => {
  const sheet = { x: 30, y: -10, angle: 0.1, weightAt: ({ x }) => (x === 500 ? 1 : 0.5) };
  const [x, y] = onSheet(500, 300, sheet, 500, 300);
  assert.deepEqual([x, y], [530, 290], 'the middle only shifts');
  const [farX, farY] = onSheet(600, 300, sheet, 500, 300);
  assert.ok(Math.abs(farX - (500 + 100 * Math.cos(-0.05) + 15)) < 1e-9);
  assert.ok(Math.abs(farY - (300 + 100 * Math.sin(-0.05) - 5)) < 1e-9);
});
