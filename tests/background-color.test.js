// The background's color loop (src/background/colorDrive.js): the drive drifts on its own, wheel
// ticks and a pick on the colour wheel ease it to whole stops, and the drift resumes a while
// after the last; wheelTicks turns a mouse-wheel notch into one tick and adds trackpad deltas up.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ColorDrive, wheelTicks, DRIFT_MS_PER_STOP, EASE_MS, RESUME_AFTER_MS } from "../src/background/colorDrive.js";

// Advances the drive frame by frame (16 ms) from `from` to `to`, returning the last position.
function run(drive, from, to) {
  let position = drive.advance(from);
  for (let now = from + 16; now <= to; now += 16) position = drive.advance(now);
  return position;
}

test("the color drifts one stop every DRIFT_MS_PER_STOP", () => {
  const drive = new ColorDrive();
  assert.equal(drive.advance(1000), 0);
  const position = run(drive, 1000, 1000 + DRIFT_MS_PER_STOP);
  assert.ok(Math.abs(position - 1) < 0.01, `drifted to ${position}`);
});

test("a long frame gap (a hidden tab) counts as 100 ms, so the color never leaps", () => {
  const drive = new ColorDrive();
  drive.advance(0);
  assert.equal(drive.advance(60000), 100 / DRIFT_MS_PER_STOP);
});

test("reduced motion holds the color still", () => {
  const drive = new ColorDrive();
  drive.reducedMotion = true;
  assert.equal(run(drive, 0, 10000), 0);
});

test("the first tick after a drift eases to the next whole stop in its direction", () => {
  const drive = new ColorDrive();
  const drifted = run(drive, 0, 2000);
  assert.ok(drifted > 0.4 && drifted < 0.6);
  drive.step(1, 2000);
  const halfway = drive.advance(2000 + EASE_MS / 2);
  assert.ok(halfway > drifted && halfway < 1, `mid-ease at ${halfway}`);
  assert.equal(drive.advance(2000 + EASE_MS), 1);

  const back = new ColorDrive();
  run(back, 0, 2000);
  back.step(-1, 2000);
  assert.equal(back.advance(2000 + EASE_MS), 0);
});

test("further ticks add up, and a step back across stop 0 stays continuous", () => {
  const drive = new ColorDrive();
  drive.advance(0);
  drive.step(-1, 0);
  drive.step(-1, 10);
  assert.equal(drive.advance(10 + EASE_MS), -2);
});

test("the drift resumes RESUME_AFTER_MS after the last tick, not before", () => {
  const drive = new ColorDrive();
  drive.advance(0);
  drive.step(1, 0);
  assert.equal(run(drive, 0, RESUME_AFTER_MS - 16), 1);
  const resumed = run(drive, RESUME_AFTER_MS, RESUME_AFTER_MS + 2000);
  assert.ok(resumed > 1.4, `resumed drift at ${resumed}`);
});

test("a step is +1 or -1", () => {
  assert.throws(() => new ColorDrive().step(2, 0), /\+1 or -1/);
});

test("a stop picked on the wheel is reached the short way round the loop", () => {
  const drive = new ColorDrive();
  drive.advance(0);
  drive.pick(10, 0);
  assert.equal(drive.advance(EASE_MS), 10);
  drive.pick(70, EASE_MS);
  assert.equal(drive.advance(2 * EASE_MS), -2, "70 is two stops back from 0 across the seam, not 60 forward");
  assert.throws(() => drive.pick(72, 0), /0 to 71/);
  assert.throws(() => drive.pick(1.5, 0), /0 to 71/);
});

test("a mouse-wheel notch is one tick, in either browser's notch size", () => {
  assert.equal(wheelTicks({ pixels: 0 }, 100, 0, 800), 1);
  assert.equal(wheelTicks({ pixels: 0 }, 50, 0, 800), 1);
  assert.equal(wheelTicks({ pixels: 0 }, -53, 0, 800), -1);
  assert.equal(wheelTicks({ pixels: 0 }, 3, 1, 800), 1);
});

test("trackpad deltas add up to a tick per 100 px and carry the rest", () => {
  const accumulator = { pixels: 0 };
  const ticks = [];
  for (let i = 0; i < 25; i++) ticks.push(wheelTicks(accumulator, 10, 0, 800));
  assert.equal(ticks.reduce((sum, tick) => sum + tick, 0), 2);
  assert.equal(accumulator.pixels, 50);
  assert.equal(wheelTicks(accumulator, -10, 0, 800), 0);
  assert.equal(accumulator.pixels, -10);
});

test("a page-mode delta scrolls by the page height", () => {
  assert.equal(wheelTicks({ pixels: 0 }, 1, 2, 800), 8);
  assert.equal(wheelTicks({ pixels: 0 }, 0, 0, 800), 0);
});
