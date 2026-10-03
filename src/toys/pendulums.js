// Two pendulums in one toy.
//
// Double pendulum: the equations of motion, the RK4 step, the fading tail history and the
// 2D drawing are from double-pendulum by Christopher Wellons (skeeto), released into the
// public domain (Unlicense). Changed: the WebGL renderer is dropped (the Canvas 2D one is
// kept), and the keyboard-only controls (a add, c clone, d delete) became buttons; a
// pendulum's bobs can be dragged with the pointer.
//
// Magnetic pendulum: the force model (gravity, a spring towards the fixture, centripetal
// term, magnets pulling with inverse-square force, air resistance) and the presets are from
// magnetic-pendulum by Rob Dawson (codebox), Copyright (c) 2019 Rob Dawson, MIT licence.
// Changed: the vector helper is replaced by plain arrays, Shift+click positioning became a
// pointer drag of the weight, and only the presets are offered (no sliders).
import { toyMeta } from '../catalog.js';
import { defineToy } from '../runtime.js';
import { clear } from './view.js';

// ---- double pendulum (skeeto) ----
const G = 1.2;
const M = 1.0;
const L = 1.0;
const TAIL_MAX = 400;
const BAR_LENGTH = 0.23;
const MASS_RADIUS = 0.035;
const TAIL_THICKNESS = 0.012;
const BAR_WIDTH = 0.04;

function derivative(a1, a2, p1, p2) {
  const ml2 = M * L * L;
  const cos12 = Math.cos(a1 - a2);
  const sin12 = Math.sin(a1 - a2);
  const da1 = 6 / ml2 * (2 * p1 - 3 * cos12 * p2) / (16 - 9 * cos12 * cos12);
  const da2 = 6 / ml2 * (8 * p2 - 3 * cos12 * p1) / (16 - 9 * cos12 * cos12);
  const dp1 = ml2 / -2 * (+da1 * da2 * sin12 + 3 * G / L * Math.sin(a1));
  const dp2 = ml2 / -2 * (-da1 * da2 * sin12 + 3 * G / L * Math.sin(a2));
  return [da1, da2, dp1, dp2];
}

export function rk4(k1a1, k1a2, k1p1, k1p2, dt) {
  const [k1da1, k1da2, k1dp1, k1dp2] = derivative(k1a1, k1a2, k1p1, k1p2);
  const k2a1 = k1a1 + k1da1 * dt / 2;
  const k2a2 = k1a2 + k1da2 * dt / 2;
  const k2p1 = k1p1 + k1dp1 * dt / 2;
  const k2p2 = k1p2 + k1dp2 * dt / 2;
  const [k2da1, k2da2, k2dp1, k2dp2] = derivative(k2a1, k2a2, k2p1, k2p2);
  const k3a1 = k1a1 + k2da1 * dt / 2;
  const k3a2 = k1a2 + k2da2 * dt / 2;
  const k3p1 = k1p1 + k2dp1 * dt / 2;
  const k3p2 = k1p2 + k2dp2 * dt / 2;
  const [k3da1, k3da2, k3dp1, k3dp2] = derivative(k3a1, k3a2, k3p1, k3p2);
  const k4a1 = k1a1 + k3da1 * dt;
  const k4a2 = k1a2 + k3da2 * dt;
  const k4p1 = k1p1 + k3dp1 * dt;
  const k4p2 = k1p2 + k3dp2 * dt;
  const [k4da1, k4da2, k4dp1, k4dp2] = derivative(k4a1, k4a2, k4p1, k4p2);
  return [
    k1a1 + (k1da1 + 2 * k2da1 + 2 * k3da1 + k4da1) * dt / 6,
    k1a2 + (k1da2 + 2 * k2da2 + 2 * k3da2 + k4da2) * dt / 6,
    k1p1 + (k1dp1 + 2 * k2dp1 + 2 * k3dp1 + k4dp1) * dt / 6,
    k1p2 + (k1dp2 + 2 * k2dp2 + 2 * k3dp2 + k4dp2) * dt / 6,
  ];
}

function history(n) {
  const tail = {
    i: 0,
    length: 0,
    v: new Float32Array(n * 2),
    push(a1, a2) {
      tail.v[tail.i * 2] = Math.sin(a1) + Math.sin(a2);
      tail.v[tail.i * 2 + 1] = Math.cos(a1) + Math.cos(a2);
      tail.i = (tail.i + 1) % n;
      if (tail.length < n) tail.length += 1;
    },
    clear() { tail.length = 0; },
    visit(f) {
      for (let j = tail.i + n - 2; j > tail.i + n - tail.length - 1; j -= 1) {
        const a = (j + 1) % n;
        const b = j % n;
        f(tail.v[a * 2], tail.v[a * 2 + 1], tail.v[b * 2], tail.v[b * 2 + 1]);
      }
    },
  };
  return tail;
}

function pendulum(tailColour, init) {
  let [a1, a2, p1, p2] = init ?? [
    Math.random() * Math.PI / 2 + Math.PI * 3 / 4,
    Math.random() * Math.PI / 2 + Math.PI * 3 / 4,
    0, 0,
  ];
  const tail = history(TAIL_MAX);
  return {
    tailColour,
    tail,
    get angles() { return [a1, a2]; },
    setAngles(next1, next2) { a1 = next1; a2 = next2; p1 = 0; p2 = 0; },
    step(dt) {
      [a1, a2, p1, p2] = rk4(a1, a2, p1, p2, dt);
      tail.push(a1, a2);
    },
    /* A slightly imperfect clone, so the two drift apart. */
    clone(colour) {
      const cp2 = p2 === 0 ? Math.random() * 1e-12 : p2 * (1 - Math.random() * 1e-10);
      return pendulum(colour, [a1, a2, p1, cp2]);
    },
  };
}

function drawDouble(g, width, height, item, inkColour) {
  const cx = width / 2;
  const cy = height / 2;
  const z = Math.min(width, height);
  const d = z * BAR_LENGTH;
  const [a1, a2] = item.angles;
  const x0 = Math.sin(a1) * d + cx;
  const y0 = Math.cos(a1) * d + cy;
  const x1 = Math.sin(a2) * d + x0;
  const y1 = Math.cos(a2) * d + y0;
  g.lineCap = 'butt';
  g.lineWidth = z * TAIL_THICKNESS / 2;
  g.strokeStyle = item.tailColour;
  let n = item.tail.length;
  item.tail.visit((tx0, ty0, tx1, ty1) => {
    g.globalAlpha = n / item.tail.length;
    n -= 1;
    g.beginPath();
    g.moveTo(tx0 * d + cx, ty0 * d + cy);
    g.lineTo(tx1 * d + cx, ty1 * d + cy);
    g.stroke();
  });
  g.lineWidth = z * BAR_WIDTH / 4;
  g.lineCap = 'round';
  g.lineJoin = 'bevel';
  g.strokeStyle = inkColour;
  g.fillStyle = inkColour;
  g.globalAlpha = 1;
  g.beginPath();
  g.moveTo(cx, cy);
  g.lineTo(x0, y0);
  g.lineTo(x1, y1);
  g.stroke();
  g.beginPath();
  g.arc(x0, y0, z * MASS_RADIUS / 2, 0, 2 * Math.PI);
  g.arc(x1, y1, z * MASS_RADIUS / 2, 0, 2 * Math.PI);
  g.fill();
  return { x0, y0, x1, y1, cx, cy, d };
}

// ---- magnetic pendulum (codebox) ----
const SPRING_LENGTH = 10;
const MAGNET_M = 100;
const DAMPING = 1;

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, f) => [a[0] * f, a[1] * f, a[2] * f];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (a) => { const l = len(a); return l ? mul(a, 1 / l) : a; };
const angleBetween = (a, b) => { const l = len(a) * len(b); return l ? Math.acos(Math.max(-1, Math.min(1, dot(a, b) / l))) : 0; };

function ring(sides, distance, m, y = 0, offset = 0) {
  return Array.from({ length: sides }, (_, i) => {
    const angle = i * Math.PI * 2 / sides + offset;
    return { position: [distance * Math.sin(angle), y, distance * Math.cos(angle)], m };
  });
}

const MAGNET_PRESETS = {
  Triangle: { magnets: ring(3, 5, 8, -1), velocity: [0, 0, 10] },
  Square: { magnets: ring(4, 4, 6, 0, Math.PI / 4), velocity: [0, 0, -10] },
  Hexagons: { magnets: ring(6, 4, 2).concat(ring(6, 6, 6, 0, Math.PI / 6)), velocity: [0, 0, 10] },
};

function magneticModel(presetName) {
  const preset = MAGNET_PRESETS[presetName];
  return {
    gravity: [0, -10, 0],
    springConstant: 100,
    airResistance: 5,
    magnets: preset.magnets.map((magnet) => ({ ...magnet })),
    fixture: [0, SPRING_LENGTH, 0],
    mass: { m: 10, position: [SPRING_LENGTH, SPRING_LENGTH, 0], velocity: [...preset.velocity] },
  };
}

export function magneticForce(model) {
  const { mass } = model;
  const toFixture = sub(model.fixture, mass.position);
  const theta = angleBetween(mul(toFixture, -1), model.gravity);
  const gravityComponent = mass.m * len(model.gravity) * Math.cos(theta);
  const l = len(toFixture);
  const velAngle = angleBetween(toFixture, mass.velocity);
  const velocity = Math.abs(len(mass.velocity) * Math.sin(velAngle));
  const centripetal = mass.m * velocity * velocity / l;
  const springForce = (l - SPRING_LENGTH) * model.springConstant;
  const springDamping = velocity * DAMPING;
  let magneticAcc = [0, 0, 0];
  for (const magnet of model.magnets) {
    const toMagnet = sub(magnet.position, mass.position);
    const d = len(toMagnet);
    magneticAcc = add(magneticAcc, mul(unit(toMagnet), MAGNET_M * magnet.m / Math.max(d * d, 0.1)));
  }
  const theta2 = angleBetween(mul(toFixture, -1), magneticAcc);
  const magneticComponent = mass.m * len(magneticAcc) * Math.cos(theta2);
  const tension = mul(unit(toFixture), gravityComponent + centripetal + springForce - springDamping + magneticComponent);
  const air = mul(unit(mul(mass.velocity, -1)), model.airResistance / 10 * velocity * velocity);
  return add(add(add(mul(model.gravity, mass.m), tension), air), mul(magneticAcc, mass.m));
}

function stepMagnetic(model, t) {
  const acceleration = mul(magneticForce(model), 1 / model.mass.m);
  const { position, velocity } = model.mass;
  model.mass.position = add(position, add(mul(velocity, t), mul(acceleration, t * t / 2)));
  model.mass.velocity = add(velocity, mul(acceleration, t));
}

// ---- the toy ----
const TAIL_COLOURS = ['#3b6fb5', '#b5523b', '#3b9b6f', '#9b3bb5', '#c9a227'];

export default defineToy(toyMeta('pendulums'), (ctx) => {
  const surface = ctx.canvas();
  let mode = 'double';
  let doubles = [];
  let magnetic = null;
  let preset = 'Triangle';
  let trace = [];
  let held = null; // which bob or weight the pointer holds
  let lastDouble = null;

  function reset() {
    doubles = [pendulum(TAIL_COLOURS[0])];
    magnetic = magneticModel(preset);
    trace = [];
    held = null;
  }
  reset();

  const controls = ctx.controls([
    { label: 'Pendulum', options: [['double', 'Double pendulum'], ['magnetic', 'Magnetic pendulum']], value: mode,
      onChange(value) { mode = value; showControls(); ctx.redraw(); } },
    { key: 'add', label: 'Add', onClick() { if (doubles.length < 5) doubles.push(pendulum(TAIL_COLOURS[doubles.length])); ctx.redraw(); } },
    { key: 'clone', label: 'Clone', onClick() { if (doubles.length && doubles.length < 5) doubles.push(doubles[0].clone(TAIL_COLOURS[doubles.length])); ctx.redraw(); } },
    { key: 'remove', label: 'Remove', onClick() { if (doubles.length > 1) doubles.pop(); ctx.redraw(); } },
    { key: 'preset', label: 'Magnets', options: Object.keys(MAGNET_PRESETS).map((name) => [name, name]), value: preset,
      onChange(value) { preset = value; magnetic = magneticModel(preset); trace = []; ctx.redraw(); } },
  ]);
  function showControls() {
    for (const key of ['add', 'clone', 'remove']) controls[key].hidden = mode !== 'double';
    controls.preset.hidden = mode !== 'magnetic';
  }
  showControls();

  // Magnetic view: looking down on the x/z plane, 14 model units across the shorter side.
  const magneticScale = () => Math.min(surface.width, surface.height) / 16;
  const toPlane = (x, y) => [(x - surface.width / 2) / magneticScale(), (y - surface.height / 2) / magneticScale()];

  ctx.drag(surface.canvas, {
    down({ x, y }) {
      if (mode === 'double' && lastDouble) {
        // Grab the outer bob if near, otherwise the inner one.
        const near = (px, py) => Math.hypot(x - px, y - py) < 30;
        for (const [index, geometry] of lastDouble.entries()) {
          if (near(geometry.x1, geometry.y1)) { held = { index, bob: 2 }; break; }
          if (near(geometry.x0, geometry.y0)) { held = { index, bob: 1 }; break; }
        }
      } else if (mode === 'magnetic') {
        held = { weight: true, last: toPlane(x, y), time: performance.now() };
        trace = [];
      }
    },
    move({ x, y }, pressed) {
      if (!pressed || !held) return;
      if (held.weight) {
        const [px, pz] = toPlane(x, y);
        const now = performance.now();
        const seconds = Math.max((now - held.time) / 1000, 1 / 120);
        const velocity = [(px - held.last[0]) / seconds, 0, (pz - held.last[1]) / seconds];
        const speed = len(velocity);
        magnetic.mass.velocity = speed > 50 ? mul(velocity, 50 / speed) : velocity;
        magnetic.mass.position = [px, Math.max(0.5, SPRING_LENGTH - Math.sqrt(Math.max(0, SPRING_LENGTH ** 2 - px * px - pz * pz))), pz];
        held.last = [px, pz];
        held.time = now;
      } else {
        const item = doubles[held.index];
        const geometry = lastDouble[held.index];
        const [a1, a2] = item.angles;
        if (held.bob === 1) item.setAngles(Math.atan2(x - geometry.cx, y - geometry.cy), a2);
        else item.setAngles(a1, Math.atan2(x - geometry.x0, y - geometry.y0));
        item.tail.clear();
      }
      ctx.redraw();
    },
    up() { held = null; },
  });

  ctx.onFrame((dt) => {
    const { g } = surface;
    const { palette } = ctx;
    clear(surface, palette.paper);
    if (mode === 'double') {
      if (!held) for (const item of doubles) item.step(dt);
      lastDouble = doubles.map((item) => drawDouble(g, surface.width, surface.height, item, palette.ink));
    } else {
      if (!held?.weight) {
        // The original steps once per frame with t up to 0.1 s; smaller substeps keep it stable.
        const steps = Math.ceil(dt / 0.004);
        for (let i = 0; i < steps; i += 1) stepMagnetic(magnetic, dt / steps);
      }
      const { position } = magnetic.mass;
      if (!Number.isFinite(position[0]) || len(position) > 1e3) magnetic = magneticModel(preset);
      trace.push([magnetic.mass.position[0], magnetic.mass.position[2]]);
      if (trace.length > 600) trace.shift();
      drawMagnetic(g, palette);
    }
  });

  function drawMagnetic(g, palette) {
    const scale = magneticScale();
    const cx = surface.width / 2;
    const cy = surface.height / 2;
    for (const magnet of magnetic.magnets) {
      g.fillStyle = palette.accent2;
      g.globalAlpha = 0.35 + magnet.m / 20;
      g.beginPath();
      g.arc(cx + magnet.position[0] * scale, cy + magnet.position[2] * scale, 6 + magnet.m, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
    g.strokeStyle = palette.accent;
    g.lineWidth = 1;
    g.beginPath();
    trace.forEach(([x, z], i) => {
      if (i === 0) g.moveTo(cx + x * scale, cy + z * scale);
      else g.lineTo(cx + x * scale, cy + z * scale);
    });
    g.stroke();
    const [mx, my, mz] = magnetic.mass.position;
    g.strokeStyle = palette.soft;
    g.beginPath();
    g.moveTo(cx, cy);
    g.lineTo(cx + mx * scale, cy + mz * scale);
    g.stroke();
    g.fillStyle = palette.ink;
    g.beginPath();
    // Higher weights (larger y) are nearer the viewer, so a little larger.
    g.arc(cx + mx * scale, cy + mz * scale, 8 + Math.max(0, my) * 0.6, 0, Math.PI * 2);
    g.fill();
  }

  return { reset };
});
