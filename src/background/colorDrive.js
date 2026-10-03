// Where the background sits on the 72-stop color loop, as a real number. It drifts forward on its
// own; wheel ticks and a pick on the color wheel take over, easing to whole stops, and the drift
// resumes a while after the last one. Time is passed in so the effects' draw loops and the tests
// drive it alike.
import { STOP_COUNT } from './palette.js';

const DRIFT_MS_PER_STOP = 4000;
const EASE_MS = 250;
const RESUME_AFTER_MS = 8000;
// A frame gap longer than this (a paused loop or a background tab) counts as this long, so the
// color never leaps on return.
const MAX_FRAME_MS = 100;

const easeOutCubic = progress => 1 - (1 - progress) ** 3;

class ColorDrive {
  constructor() {
    this.reducedMotion = false;
    // Unwrapped, so an ease across the 71 → 0 seam stays continuous.
    this.position = 0;
    this.lastFrame = null;
    this.stepping = false;
    this.target = 0;
    this.easeFrom = 0;
    this.easeStart = 0;
    this.lastTick = 0;
  }

  advance(now) {
    const frameMs = this.lastFrame === null ? 0 : Math.min(MAX_FRAME_MS, Math.max(0, now - this.lastFrame));
    this.lastFrame = now;
    if (this.stepping) {
      const progress = this.reducedMotion ? 1 : Math.min(1, (now - this.easeStart) / EASE_MS);
      this.position = progress >= 1 ? this.target : this.easeFrom + (this.target - this.easeFrom) * easeOutCubic(progress);
      if (now - this.lastTick >= RESUME_AFTER_MS) this.stepping = false;
    } else if (!this.reducedMotion) {
      this.position += frameMs / DRIFT_MS_PER_STOP;
    }
    return this.position;
  }

  // One wheel tick: +1 forward, -1 back. The first tick after a drift snaps to the next whole
  // stop in that direction.
  step(direction, now) {
    if (direction !== 1 && direction !== -1) throw new Error(`a color step is +1 or -1, not ${direction}`);
    if (this.stepping) {
      this.target += direction;
    } else {
      const epsilon = 1e-9;
      this.target = direction > 0 ? Math.floor(this.position + epsilon) + 1 : Math.ceil(this.position - epsilon) - 1;
      this.stepping = true;
    }
    this.easeFrom = this.position;
    this.easeStart = now;
    this.lastTick = now;
  }

  // A stop picked on the color wheel: eases there the short way round the loop.
  pick(stop, now) {
    if (!Number.isInteger(stop) || stop < 0 || stop >= STOP_COUNT) throw new Error(`a color stop is 0 to ${STOP_COUNT - 1}, not ${stop}`);
    const here = ((this.position % STOP_COUNT) + STOP_COUNT) % STOP_COUNT;
    const ahead = (((stop - here) % STOP_COUNT) + STOP_COUNT) % STOP_COUNT;
    this.target = Math.round(this.position + (ahead > STOP_COUNT / 2 ? ahead - STOP_COUNT : ahead));
    this.stepping = true;
    this.easeFrom = this.position;
    this.easeStart = now;
    this.lastTick = now;
  }
}

const PIXELS_PER_TICK = 100;
const PIXELS_PER_LINE = 40;
// A single event this big is a mouse-wheel notch (Firefox sends ~50 px per notch, Chrome 100);
// trackpads send many small deltas that must accumulate.
const NOTCH_PIXELS = 40;

// Converts one wheel event into whole ticks (+ forward, − back), carrying the remainder in
// `accumulator.pixels` so a trackpad swipe adds up to a few ticks rather than dozens.
function wheelTicks(accumulator, deltaY, deltaMode, pageHeight) {
  const pixels = deltaMode === 1 ? deltaY * PIXELS_PER_LINE : deltaMode === 2 ? deltaY * pageHeight : deltaY;
  if (pixels === 0) return 0;
  if (Math.sign(pixels) !== Math.sign(accumulator.pixels)) accumulator.pixels = 0;
  accumulator.pixels += pixels;
  const ticks = Math.trunc(accumulator.pixels / PIXELS_PER_TICK);
  if (ticks !== 0) {
    accumulator.pixels -= ticks * PIXELS_PER_TICK;
    return ticks;
  }
  if (Math.abs(pixels) >= NOTCH_PIXELS) {
    accumulator.pixels = 0;
    return Math.sign(pixels);
  }
  return 0;
}

export { ColorDrive, wheelTicks, DRIFT_MS_PER_STOP, EASE_MS, RESUME_AFTER_MS };
