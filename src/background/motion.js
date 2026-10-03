// The drag dynamics every background shares, from reactbits-kit's own modules (MIT; no React Bits
// code): the pointer coasting on after a fling (PointerFeed, with Momentum), the local ripple-
// stretch and swirl under it (RippleField), the whole field following the drag like a sheet on
// water and gliding on after release without springing back (ClothFollow), and the pattern as
// the inside of a ball that a drag turns and a fling spins (SphereSpin). Their constants are the
// kit's own, which are the figurewright hero's tuning: the sheet follows 30% of the drag, capped
// at 12% of the shorter side, and glides 3 to 9 s; the ripple and swirl at the hero's doubled
// strength; the ball turns at 0.1 of the pointer.
//
// One per view: the view tells it the drag (grab, move, release, cancel) and each background
// reads it once per frame. Coordinates are client pixels (the layer is fixed over the whole
// viewport); times are performance.now() milliseconds. Under reduced motion none of it moves.
import { ClothFollow, FOLLOW } from '@rpbostick/reactbits-kit/modules/clothFollow';
import { PointerFeed } from '@rpbostick/reactbits-kit/modules/pointerFeed';
import { RIPPLE, RippleField, rippleRadius } from '@rpbostick/reactbits-kit/modules/rippleField';
import { SPIN, SphereSpin } from '@rpbostick/reactbits-kit/modules/sphereSpin';
import { MOTIONS } from './backgrounds.js';

// The furthest the ripple field moves a point, and the ripple and the sheet together: a line
// background draws REACH_PX of its grid beyond each edge, so a moved line's end never shows.
export const RIPPLE_LIMIT_PX = RIPPLE.MAX_RADIUS_PX * RIPPLE.MAX_DISPLACEMENT_SHARE;
export const REACH_PX = RIPPLE_LIMIT_PX + FOLLOW.MAX_SHIFT_PX;

// One full turn of the ball in pattern pixels: a pattern that repeats on it turns without a seam.
export const PERIOD_PX = SPIN.PERIOD_PX;

// How the view bends towards its edges, as SphereSpin's curved(): a point r px from the middle
// reads the pattern CURVE_PX·atan(r / CURVE_PX) px from it; 0 is flat.
export const CURVE_PX = SPIN.CURVATURE === 0 ? 0 : SPIN.PERIOD_PX / (2 * Math.PI) / SPIN.CURVATURE;

// The sheet's twist for the shader backgrounds: the field turns about the middle of the view by
// this share of the angle the shift sweeps there, seen from the dragged point, at most MAX_RAD.
// SOFT_SHARE of the shorter side keeps a drag near the middle from whirling it.
export const TWIST = { SHARE: 0.5, MAX_RAD: 0.12, SOFT_SHARE: 0.25 };

/** Checks { ripple, sheet, spin, momentum } of booleans, as parseMotion() gives. */
export function checkedMotion(options) {
  if (!options || typeof options !== 'object') throw new Error(`motion must be { ${MOTIONS.join(', ')} }, not ${JSON.stringify(options)}`);
  for (const name of MOTIONS) {
    if (typeof options[name] !== 'boolean') throw new Error(`motion.${name} must be true or false, not ${JSON.stringify(options[name])}`);
  }
  const extra = Object.keys(options).filter((name) => !MOTIONS.includes(name));
  if (extra.length) throw new Error(`motion has no ${extra.join(', ')}`);
  return { ...options };
}

/**
 * now(): the time; size(): { width, height } of the layer. A layer with no size yet (nothing laid
 * out) has nothing to coast across or turn, so the coast, ripple, sheet and spin wait for one.
 */
export function createMotion({ now, size }) {
  const feed = new PointerFeed();
  const ripple = new RippleField();
  const cloth = new ClothFollow();
  let spin = new SphereSpin();
  let options = checkedMotion({ ripple: true, sheet: true, spin: true, momentum: true });
  let reduced = false;
  // Where the sheet's falloff is centred: the dragged point, kept after release.
  let center = { x: 0, y: 0 };

  function view() {
    const { width, height } = size();
    return width > 0 && height > 0 ? { width, height } : null;
  }

  /** The dragged point, or the coasting one after a fling; null otherwise. */
  function pointer(at = now()) {
    const box = view();
    if (!box) return feed.current;
    return feed.at(at, { left: 0, top: 0, right: box.width, bottom: box.height });
  }

  function freshSpin() {
    spin = new SphereSpin();
    spin.reducedMotion = reduced;
  }

  function stepSheet(at, box) {
    cloth.step({ pointer: feed.current, stroke: feed.stroke, now: at, width: box.width, height: box.height });
  }

  const still = () => ({ x: 0, y: 0, centerX: center.x, centerY: center.y, reach: 1, farWeight: FOLLOW.FAR_WEIGHT, angle: 0, moving: false, weightAt: () => 0 });

  /** The sheet this frame: its shift at the dragged point and how that falls off and twists. */
  function sheet(at = now()) {
    const box = view();
    if (!options.sheet || reduced || !box) return still();
    stepSheet(at, box);
    const { x, y } = cloth.shift;
    const fromMiddleX = center.x - box.width / 2;
    const fromMiddleY = center.y - box.height / 2;
    const soft = (TWIST.SOFT_SHARE * Math.min(box.width, box.height)) ** 2;
    const swept = (fromMiddleX * y - fromMiddleY * x) / (fromMiddleX ** 2 + fromMiddleY ** 2 + soft);
    const angle = Math.max(-TWIST.MAX_RAD, Math.min(TWIST.MAX_RAD, TWIST.SHARE * swept));
    return {
      x, y, centerX: center.x, centerY: center.y,
      reach: FOLLOW.FAR_DISTANCE_SHARE * Math.hypot(box.width, box.height),
      farWeight: FOLLOW.FAR_WEIGHT, angle, moving: !cloth.atRest,
      weightAt: (place) => cloth.weightAt(place),
    };
  }

  /** The ball's turn in pattern pixels and as yaw and pitch in radians. */
  function turn(at = now()) {
    if (!options.spin) return { x: 0, y: 0, yaw: 0, pitch: 0, period: PERIOD_PX, moving: false };
    const { x, y } = spin.advance(at);
    const { yaw, pitch } = spin.orientation(at);
    return { x, y, yaw, pitch, period: PERIOD_PX, moving: spin.held || spin.spinning };
  }

  /** Where each point of a grid (lines of { x, y }) reads the pattern on the turning ball; null with the spin off. */
  function sample(grid, at = now()) {
    const box = view();
    if (!options.spin || !box) return null;
    return spin.sample(grid, box, at);
  }

  /** The ripple field's offsets for a grid (lines of { x, y, wave: { x, y } }); null at rest or off. */
  function stir(grid, at = now()) {
    const box = view();
    if (!options.ripple || reduced || !box) {
      ripple.reset();
      return null;
    }
    return ripple.step(grid, { pointer: pointer(at), stroke: feed.stroke, now: at, radius: rippleRadius(box.width, box.height) });
  }

  /** The ripple and the sheet together, for a grid, as figurewright's waves draw them; null at rest. */
  function displace(grid, at = now()) {
    const offsets = stir(grid, at);
    const box = view();
    if (!options.sheet || reduced || !box) return offsets;
    stepSheet(at, box);
    return cloth.displace(grid, offsets);
  }

  return {
    grab(x, y) {
      const at = now();
      center = { x, y };
      feed.grab(x, y, at);
      const box = view();
      if (options.spin && box) spin.grab({ x, y }, box, at);
    },
    move(x, y) {
      const at = now();
      center = { x, y };
      feed.move(x, y, at);
      const box = view();
      if (options.spin && box) spin.drag({ x, y }, box, at);
    },
    /** Let go: the pointer coasts on (with momentum on) and the ball spins on. */
    release() {
      const at = now();
      if (options.momentum) feed.release(at);
      else feed.cancel();
      spin.release(at);
    },
    cancel() {
      feed.cancel();
      spin.cancel();
    },
    /** Whether the pointer is coasting after a fling (not held, still moving). */
    coasting(at = now()) {
      return feed.current === null && pointer(at) !== null;
    },
    /** Ends a coast at once (the interaction or the momentum turned off). */
    stopCoast() {
      if (feed.current === null) feed.cancel();
    },
    setOptions(next) {
      options = checkedMotion(next);
      if (!options.ripple) ripple.reset();
      if (!options.sheet) cloth.reset();
      if (!options.spin) freshSpin();
      if (!options.momentum && feed.current === null) feed.cancel();
    },
    setReducedMotion(on) {
      reduced = on;
      feed.reducedMotion = on;
      cloth.reducedMotion = on;
      spin.reducedMotion = on;
      if (!on) return;
      ripple.reset();
      cloth.reset();
      if (feed.current === null) feed.cancel();
    },
    /** A new background starts from rest; a drag in progress carries on. */
    reset() {
      ripple.reset();
      cloth.reset();
      freshSpin();
    },
    /**
     * What a background reads, once per frame (api.motion): `at` is performance.now()
     * milliseconds, now when left out.
     */
    api: Object.freeze({
      pointer,
      sheet,
      spin: turn,
      sample,
      ripple: stir,
      displace,
      get held() { return feed.current; },
      get stroke() { return feed.stroke; },
      get options() { return { ...options }; },
      get reducedMotion() { return reduced; },
    }),
  };
}
