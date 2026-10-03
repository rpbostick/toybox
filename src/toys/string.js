// String and cloth, on the verlet engine ported from verlet-js (see verlet.js).
//
// Cat's cradle: a loop of string strung around two hands of three fingers each. Pull the
// string with the pointer (several fingers on a touch screen); let go of it near a finger to
// hook it there, tap a hooked point to let it go; drag a palm to move that hand.
// Cloth: the verlet-js cloth example (20 x 20 particles, every sixth top particle pinned,
// shaded by how far each cell is pulled), with pointer events instead of mouse handlers.
import { toyMeta } from '../catalog.js';
import { defineToy } from '../runtime.js';
import { cloth, createWorld, distanceConstraint, particle, pinConstraint } from './verlet.js';
import { clear, fitView } from './view.js';

const WORLD = { width: 400, height: 400 };
const FINGER_RADIUS = 7;
const LOOP_POINTS = 90;
const STEP_SECONDS = 1 / 60;

function makeHands() {
  const hand = (x, side) => ({
    side,
    palm: { x: x + side * 38, y: 210 },
    fingers: [-46, 0, 46].map((dy) => ({ x, y: 210 + dy, r: FINGER_RADIUS + 3 })),
  });
  return [hand(115, -1), hand(285, 1)];
}

/** Points around the outside of all the fingers: the loop as it sits before any figure. */
function loopAround(hands) {
  const fingers = hands.flatMap((hand) => hand.fingers);
  const xs = fingers.map((finger) => finger.x);
  const ys = fingers.map((finger) => finger.y);
  const pad = FINGER_RADIUS + 4;
  const left = Math.min(...xs) - pad;
  const right = Math.max(...xs) + pad;
  const top = Math.min(...ys) - pad;
  const bottom = Math.max(...ys) + pad;
  const perimeter = 2 * (right - left + bottom - top);
  const points = [];
  for (let i = 0; i < LOOP_POINTS; i += 1) {
    let d = (i / LOOP_POINTS) * perimeter;
    if (d < right - left) { points.push([left + d, top]); continue; }
    d -= right - left;
    if (d < bottom - top) { points.push([right, top + d]); continue; }
    d -= bottom - top;
    if (d < right - left) { points.push([right - d, bottom]); continue; }
    d -= right - left;
    points.push([left, bottom - d]);
  }
  return points;
}

export default defineToy(toyMeta('string'), (ctx) => {
  const surface = ctx.canvas();
  let view = fitView(surface, WORLD.width, WORLD.height);
  ctx.onResize(() => { view = fitView(surface, WORLD.width, WORLD.height); });
  let mode = 'cradle';
  let world = null;
  let hands = [];
  let loop = [];
  let sheet = null;
  let accumulated = 0;
  const hooks = new Map(); // particle -> pin constraint
  const handDrags = new Map(); // pointer id -> { hand, dx, dy }
  const pressedAt = new Map(); // pointer id -> { x, y, particle }

  function reset() {
    hooks.clear();
    handDrags.clear();
    pressedAt.clear();
    accumulated = 0;
    if (mode === 'cradle') {
      world = createWorld({ ...WORLD, gravity: 0.06, friction: 0.98 });
      hands = makeHands();
      world.pegs = hands.flatMap((hand) => hand.fingers);
      loop = loopAround(hands).map(([x, y]) => particle(x, y));
      world.particles.push(...loop);
      loop.forEach((p, i) => {
        const next = loop[(i + 1) % loop.length];
        // A little slack, so the string can be pulled into figures.
        const rest = Math.hypot(p.pos.x - next.pos.x, p.pos.y - next.pos.y) * 1.25;
        world.constraints.push(distanceConstraint(p, next, 0.9, rest));
      });
      sheet = null;
    } else {
      world = createWorld({ ...WORLD, gravity: 0.2, friction: 1 });
      hands = [];
      loop = [];
      sheet = cloth(world, { x: 200, y: 150 }, 220, 220, 20, 6, 0.9);
    }
  }
  reset();

  ctx.controls([
    { label: 'String', options: [['cradle', "Cat's cradle"], ['cloth', 'Cloth']], value: mode,
      onChange(value) { mode = value; reset(); ctx.redraw(); } },
  ]);

  const hookAt = (p) => {
    for (const hand of hands) {
      for (const finger of hand.fingers) {
        if (Math.hypot(p.pos.x - finger.x, p.pos.y - finger.y) < finger.r + 12) return finger;
      }
    }
    return null;
  };

  ctx.drag(surface.canvas, {
    down({ x, y, id }) {
      const point = view.toWorld(x, y);
      const hand = hands.find((candidate) => Math.hypot(point.x - candidate.palm.x, point.y - candidate.palm.y) < 30);
      if (hand) {
        handDrags.set(id, { hand, last: point });
        return;
      }
      const p = world.nearest(point.x, point.y, 18);
      if (!p) return;
      pressedAt.set(id, { ...point, particle: p, moved: false });
      if (!hooks.has(p)) world.grabs.set(id, { particle: p, x: point.x, y: point.y });
    },
    move({ x, y, id }, pressed) {
      if (!pressed) return;
      const point = view.toWorld(x, y);
      const handDrag = handDrags.get(id);
      if (handDrag) {
        const dx = point.x - handDrag.last.x;
        const dy = point.y - handDrag.last.y;
        handDrag.last = point;
        handDrag.hand.palm.x += dx;
        handDrag.hand.palm.y += dy;
        for (const finger of handDrag.hand.fingers) {
          finger.x += dx;
          finger.y += dy;
        }
        ctx.redraw();
        return;
      }
      const press = pressedAt.get(id);
      if (press && Math.hypot(point.x - press.x, point.y - press.y) > 4) press.moved = true;
      const grab = world.grabs.get(id);
      if (grab) {
        grab.x = point.x;
        grab.y = point.y;
        ctx.redraw();
      }
    },
    up({ id }) {
      handDrags.delete(id);
      const press = pressedAt.get(id);
      pressedAt.delete(id);
      const grab = world.grabs.get(id);
      world.grabs.delete(id);
      if (!press || mode !== 'cradle') return;
      const p = press.particle;
      if (hooks.has(p) && !press.moved) {
        world.constraints.splice(world.constraints.indexOf(hooks.get(p)), 1);
        hooks.delete(p);
      } else if (grab) {
        const finger = hookAt(p);
        if (finger) {
          const pin = pinConstraint(p, finger);
          hooks.set(p, pin);
          world.constraints.push(pin);
        }
      }
      ctx.redraw();
    },
  });

  ctx.onFrame((dt) => {
    accumulated = Math.min(accumulated + dt, STEP_SECONDS * 4);
    while (accumulated >= STEP_SECONDS) {
      world.frame(16);
      accumulated -= STEP_SECONDS;
    }
    if (dt === 0) world.collide();
    draw();
  });

  function draw() {
    const { g } = surface;
    const { palette } = ctx;
    clear(surface, palette.paper);
    view.apply(g);
    if (mode === 'cradle') drawCradle(g, palette);
    else drawCloth(g, palette);
  }

  function drawCradle(g, palette) {
    for (const hand of hands) {
      g.fillStyle = palette.faint;
      g.strokeStyle = palette.soft;
      g.lineWidth = 1.5;
      g.beginPath();
      g.ellipse(hand.palm.x, hand.palm.y, 26, 58, 0, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      for (const finger of hand.fingers) {
        g.beginPath();
        g.moveTo(hand.palm.x, finger.y);
        g.lineTo(finger.x, finger.y);
        g.lineWidth = FINGER_RADIUS * 2;
        g.lineCap = 'round';
        g.strokeStyle = palette.faint;
        g.stroke();
        g.beginPath();
        g.arc(finger.x, finger.y, FINGER_RADIUS, 0, Math.PI * 2);
        g.fillStyle = palette.soft;
        g.fill();
      }
    }
    g.strokeStyle = palette.accent;
    g.lineWidth = 2.2;
    g.lineJoin = 'round';
    g.beginPath();
    loop.forEach((p, i) => (i === 0 ? g.moveTo(p.pos.x, p.pos.y) : g.lineTo(p.pos.x, p.pos.y)));
    g.closePath();
    g.stroke();
    g.fillStyle = palette.ink;
    for (const p of hooks.keys()) {
      g.beginPath();
      g.arc(p.pos.x, p.pos.y, 3, 0, Math.PI * 2);
      g.fill();
    }
  }

  function drawCloth(g, palette) {
    const { particles, segments, stride } = sheet;
    for (let y = 1; y < segments; y += 1) {
      for (let x = 1; x < segments; x += 1) {
        const i1 = (y - 1) * segments + x - 1;
        const i2 = y * segments + x;
        g.beginPath();
        g.moveTo(particles[i1].pos.x, particles[i1].pos.y);
        g.lineTo(particles[i1 + 1].pos.x, particles[i1 + 1].pos.y);
        g.lineTo(particles[i2].pos.x, particles[i2].pos.y);
        g.lineTo(particles[i2 - 1].pos.x, particles[i2 - 1].pos.y);
        let off = particles[i2].pos.x - particles[i1].pos.x + particles[i2].pos.y - particles[i1].pos.y;
        off *= 0.25;
        const coef = Math.min(255, Math.round((Math.abs(off) / stride) * 255));
        g.fillStyle = `rgba(${coef},0,${255 - coef},${0.25 + 0.75 * (coef / 255)})`;
        g.fill();
      }
    }
    g.fillStyle = palette.ink;
    for (const constraint of world.constraints) {
      if (!constraint.pin) continue;
      g.beginPath();
      g.arc(constraint.at.x, constraint.at.y, 2, 0, Math.PI * 2);
      g.fill();
    }
  }

  return { reset };
});
