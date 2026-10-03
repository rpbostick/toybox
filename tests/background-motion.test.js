// The drag dynamics every background shares (src/background/motion.js, on reactbits-kit's
// modules) driven on a fake clock: a fling coasts on and decays, the sheet glides on after
// release without springing back, the ripple field and the ball turn under a drag, each of them
// switches off, and reduced motion moves none of them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FOLLOW } from '@rpbostick/reactbits-kit/modules/clothFollow';
import { SPIN } from '@rpbostick/reactbits-kit/modules/sphereSpin';
import { parseMotion } from '../src/background/backgrounds.js';
import { checkedMotion, createMotion } from '../src/background/motion.js';

const ALL_ON = { ripple: true, sheet: true, spin: true, momentum: true };
const WIDTH = 1000;
const HEIGHT = 800;

function setup({ options = ALL_ON, reduced = false } = {}) {
  const clock = { t: 1000 };
  const motion = createMotion({ now: () => clock.t, size: () => ({ width: WIDTH, height: HEIGHT }) });
  motion.setOptions(options);
  motion.setReducedMotion(reduced);
  return { clock, motion, api: motion.api };
}

/** A drag rightwards from (100, 400), `step` px every 16 ms for `frames` frames, then let go. */
function fling(clock, motion, { step = 5, frames = 10 } = {}) {
  motion.grab(100, 400);
  for (let frame = 1; frame <= frames; frame++) {
    clock.t += 16;
    motion.move(100 + step * frame, 400);
  }
  motion.release();
}

const grid = () => Array.from({ length: 12 }, (_, column) => Array.from({ length: 10 }, (_, row) => ({ x: column * 90, y: row * 90, wave: { x: 0, y: 0 } })));

test('a fling coasts on in its direction, slowing, and stops', () => {
  const { clock, motion, api } = setup();
  fling(clock, motion);
  assert.equal(api.held, null);
  assert.ok(motion.coasting(), 'coasting after the release');
  const xs = [];
  for (let frame = 0; frame < 30; frame++) {
    clock.t += 16;
    xs.push(api.pointer().x);
  }
  const steps = xs.slice(1).map((x, i) => x - xs[i]);
  assert.ok(xs[0] > 150, `past the release point (${xs[0]})`);
  assert.ok(steps.every((step) => step > 0), 'onwards to the right');
  assert.ok(steps.at(-1) < steps[0], `slowing: ${steps[0]} then ${steps.at(-1)}`);
  let frames = 0;
  while (api.pointer() !== null && frames < 20 * 60) {
    clock.t += 1000 / 60;
    frames++;
  }
  assert.equal(api.pointer(), null, `over within 20 s (${frames} frames)`);
  assert.equal(motion.coasting(), false);
});

test('momentum off, reduced motion, or a cancel: no coast', () => {
  for (const make of [() => setup({ options: { ...ALL_ON, momentum: false } }), () => setup({ reduced: true })]) {
    const { clock, motion, api } = make();
    fling(clock, motion);
    clock.t += 16;
    assert.equal(api.pointer(), null);
    assert.equal(motion.coasting(), false);
  }
  const { clock, motion, api } = setup();
  motion.grab(100, 400);
  clock.t += 16;
  motion.move(140, 400);
  motion.cancel();
  clock.t += 16;
  assert.equal(api.pointer(), null);
});

test('the sheet follows a share of the drag, capped, then glides on for seconds without springing back', () => {
  const { clock, motion, api } = setup();
  motion.grab(100, 400);
  api.sheet();
  for (let frame = 1; frame <= 60; frame++) {
    clock.t += 16;
    motion.move(100 + 10 * frame, 400);
    api.sheet();
  }
  const held = api.sheet();
  assert.ok(held.moving);
  assert.ok(held.x > 0, 'follows the drag');
  assert.ok(held.x <= FOLLOW.CAP_SHARE * Math.min(WIDTH, HEIGHT) * 1.1, `capped at ${FOLLOW.CAP_SHARE} of the shorter side (${held.x})`);
  assert.equal(held.weightAt({ x: held.centerX, y: held.centerY }), 1, 'all of it at the dragged point');
  assert.ok(held.weightAt({ x: 0, y: 0 }) < 1, 'less away from it');
  motion.release();
  let last = held.x;
  for (let frame = 0; frame < 3 * 60; frame++) {
    clock.t += 1000 / 60;
    const { x } = api.sheet();
    assert.ok(x >= last - 1e-9 || x > 0.5 * held.x, 'no spring back');
    last = x;
  }
  assert.ok(api.sheet().moving, 'still gliding 3 s after the release');
  assert.ok(last > held.x * 0.5, `kept its place (${last} from ${held.x})`);
});

test('the ripple field stirs a grid under a drag; the displacement adds the sheet to it', () => {
  const { clock, motion, api } = setup();
  const points = grid();
  assert.equal(api.ripple(points), null, 'at rest before a drag');
  motion.grab(500, 400);
  api.ripple(points);
  for (let frame = 1; frame <= 20; frame++) {
    clock.t += 16;
    motion.move(500 + 6 * frame, 400 + 3 * frame);
    api.ripple(points);
  }
  clock.t += 16;
  const stir = api.ripple(points);
  assert.ok(stir && stir.x.some((offset) => Math.abs(offset) > 0.1), 'points moved');
  const moved = api.displace(points);
  assert.ok(moved && moved.x.length === points.length * points[0].length);
});

test('the ball turns with a drag, at 0.1 of it, and samples a grid', () => {
  const { clock, motion, api } = setup();
  motion.grab(500, 400);
  for (let frame = 1; frame <= 10; frame++) {
    clock.t += 16;
    motion.move(500 + 10 * frame, 400);
  }
  const turn = api.spin();
  assert.equal(SPIN.SCALE, 0.1);
  assert.ok(Math.abs(turn.x) > 0 && Math.abs(turn.x) < 100 * SPIN.SCALE * 1.5, `turned a tenth of 100 px (${turn.x})`);
  assert.equal(turn.period, SPIN.PERIOD_PX);
  const sampled = api.sample(grid());
  assert.equal(sampled.x.length, 120);
});

test('each dynamic switches off on its own', () => {
  const { clock, motion, api } = setup({ options: { ripple: false, sheet: false, spin: false, momentum: true } });
  const points = grid();
  motion.grab(500, 400);
  for (let frame = 1; frame <= 10; frame++) {
    clock.t += 16;
    motion.move(500 + 10 * frame, 400);
    api.ripple(points);
    api.sheet();
  }
  assert.equal(api.ripple(points), null, 'ripple off');
  assert.equal(api.displace(points), null, 'no ripple and no sheet: nothing moves');
  assert.deepEqual([api.sheet().x, api.sheet().y, api.sheet().moving], [0, 0, false], 'sheet off');
  assert.deepEqual([api.spin().x, api.spin().y], [0, 0], 'spin off');
  assert.equal(api.sample(points), null);
  assert.deepEqual(api.options, { ripple: false, sheet: false, spin: false, momentum: true });
});

test('reduced motion: no ripple, no sheet; turning it on mid-glide stops the glide', () => {
  const { clock, motion, api } = setup({ reduced: true });
  const points = grid();
  motion.grab(500, 400);
  for (let frame = 1; frame <= 10; frame++) {
    clock.t += 16;
    motion.move(500 + 10 * frame, 400);
  }
  assert.equal(api.ripple(points), null);
  assert.equal(api.sheet().moving, false);
  assert.equal(api.reducedMotion, true);
  const live = setup();
  fling(live.clock, live.motion, { step: 10, frames: 20 });
  live.api.sheet();
  live.motion.setReducedMotion(true);
  live.clock.t += 16;
  assert.equal(live.api.pointer(), null, 'the coast ends');
  assert.equal(live.api.sheet().moving, false, 'the glide ends');
});

test('motion options are four booleans; the attributes give them, on unless "off"', () => {
  assert.throws(() => checkedMotion(undefined), /motion must be/);
  assert.throws(() => checkedMotion({ ...ALL_ON, ripple: 'off' }), /motion.ripple must be true or false/);
  assert.throws(() => checkedMotion({ ...ALL_ON, wobble: true }), /motion has no wobble/);
  const attributes = { sheet: 'off', spin: 'on' };
  assert.deepEqual(parseMotion((name) => attributes[name] ?? null), { ripple: true, sheet: false, spin: true, momentum: true });
  assert.throws(() => parseMotion((name) => (name === 'momentum' ? 'no' : null)), /momentum="no": use on or off/);
});
