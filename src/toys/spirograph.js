// Spirograph. The nested-circle model (each child circle rolls inside its parent, turning by
// -alpha * parentRadius / childRadius, with the pen in a hole at holeRadius of the innermost
// circle) and the randomiser are from circles ("Simple spirograph toy") by Andrei Kashcha
// (anvaka), Copyright (c) 2018-2026 Andrei Kashcha, MIT licence. Changed: no query-state
// (settings stay in the toy), sliders for the gear sizes and the pen hole, pen colours, a
// "show gears" overlay, and the drawing lives on its own layer so the gears can move over it.
// Drag on the paper to turn the gears by hand.
import { toyMeta } from '../catalog.js';
import { defineToy } from '../runtime.js';
import { clear } from './view.js';

const LAYER = 800;
const SIZE = 12; // half the visible model width; the outer ring has radius 10
const PENS = { ink: null, rust: '#b5523b', blue: '#3b6fb5', green: '#3b9b6f', gold: '#c9a227' };

function defaultSpiral() {
  return {
    radiusRatio: 1,
    children: [
      { radiusRatio: 0.52, holeRadius: 0.15, initialAngle: 2.1 },
      { radiusRatio: 0.15, holeRadius: 0.53, initialAngle: 0.1 },
    ],
  };
}

function randomSpiral() {
  const one = () => ({
    radiusRatio: Math.max(1, Math.round(Math.random() * 42)) / 42,
    holeRadius: Math.random() * 0.8 + 0.2,
    initialAngle: Math.random() * 2 * Math.PI,
  });
  const children = [one()];
  if (Math.random() < 0.5) children.push(one());
  return { radiusRatio: 1, children };
}

/** Walks the circles at angle alpha and calls pen(x, y) for each pen hole, circle(...) for each gear. */
export function traceSpiral(spiral, alpha, { pen, circle = () => {} }, cx = 0, cy = 0, parentR = 10) {
  const radius = spiral.radiusRatio * parentR;
  const turned = alpha + (spiral.initialAngle || 0);
  if (!spiral.children || spiral.children.length === 0) {
    circle(cx, cy, radius);
    pen(spiral, cx + Math.cos(turned) * radius * spiral.holeRadius, cy + Math.sin(turned) * radius * spiral.holeRadius);
    return;
  }
  circle(cx, cy, radius);
  for (const child of spiral.children) {
    const childRadius = child.radiusRatio * radius;
    const childCentre = radius - childRadius;
    const x = cx + Math.cos(turned) * childCentre;
    const y = cy + Math.sin(turned) * childCentre;
    traceSpiral(child, -turned * radius / childRadius, { pen, circle }, x, y, radius);
  }
}

export default defineToy(toyMeta('spirograph'), (ctx) => {
  const surface = ctx.canvas();
  const layer = ctx.element('canvas', { width: LAYER, height: LAYER });
  const paper = layer.getContext('2d');
  let spiral = defaultSpiral();
  let alpha = 0;
  let speed = Math.PI; // radians of the outer ring per second (the original: PI/30 per frame)
  let pen = 'ink';
  let showGears = true;
  const last = new Map(); // child spiral -> last pen point

  const toLayer = (v) => LAYER / 2 + (v / (2 * SIZE)) * LAYER;

  function clearPaper() {
    paper.clearRect(0, 0, LAYER, LAYER);
    last.clear();
  }

  function reset() {
    spiral = defaultSpiral();
    alpha = 0;
    clearPaper();
    syncSliders();
  }

  function advance(byAngle) {
    const steps = Math.max(1, Math.ceil(Math.abs(byAngle) / (Math.PI / 60)));
    paper.strokeStyle = PENS[pen] ?? ctx.palette.ink;
    paper.lineWidth = 1.6;
    paper.lineCap = 'round';
    for (let i = 0; i < steps; i += 1) {
      alpha += byAngle / steps;
      traceSpiral(spiral, alpha, {
        pen(child, x, y) {
          const previous = last.get(child);
          if (previous) {
            paper.beginPath();
            paper.moveTo(toLayer(previous[0]), toLayer(previous[1]));
            paper.lineTo(toLayer(x), toLayer(y));
            paper.stroke();
          }
          last.set(child, [x, y]);
        },
      });
    }
  }

  const sliders = ctx.controls([
    { key: 'gear', label: 'Gear', range: [0.05, 0.95, 0.01], value: spiral.children[0].radiusRatio,
      onInput(value) { spiral.children[0].radiusRatio = value; last.clear(); ctx.redraw(); } },
    { key: 'hole', label: 'Pen hole', range: [0.05, 1, 0.01], value: spiral.children[0].holeRadius,
      onInput(value) { spiral.children[0].holeRadius = value; last.clear(); ctx.redraw(); } },
    { label: 'Speed', range: [0.2, 6, 0.1], value: speed, onInput(value) { speed = value; } },
  ]);
  ctx.controls([
    { label: 'Pen', options: Object.keys(PENS).map((name) => [name, name[0].toUpperCase() + name.slice(1)]), value: pen,
      onChange(value) { pen = value; } },
    { label: 'Gears', onClick() { showGears = !showGears; ctx.redraw(); } },
    { label: 'Random', onClick() { spiral = randomSpiral(); clearPaper(); syncSliders(); ctx.redraw(); } },
    { label: 'Clear', onClick() { clearPaper(); ctx.redraw(); } },
  ]);
  function syncSliders() {
    sliders.gear.value = String(spiral.children[0].radiusRatio);
    sliders.hole.value = String(spiral.children[0].holeRadius);
  }

  let turning = null;
  ctx.drag(surface.canvas, {
    down({ x, y }) { turning = Math.atan2(y - surface.height / 2, x - surface.width / 2); },
    move({ x, y }, pressed) {
      if (!pressed || turning === null) return;
      const angle = Math.atan2(y - surface.height / 2, x - surface.width / 2);
      let delta = angle - turning;
      if (delta > Math.PI) delta -= 2 * Math.PI;
      if (delta < -Math.PI) delta += 2 * Math.PI;
      turning = angle;
      advance(delta);
      ctx.redraw();
    },
    up() { turning = null; },
  });

  ctx.onFrame((dt) => {
    if (dt > 0) advance(speed * dt);
    const { g } = surface;
    const { palette } = ctx;
    clear(surface, palette.paper);
    const side = Math.min(surface.width, surface.height);
    const left = (surface.width - side) / 2;
    const top = (surface.height - side) / 2;
    g.drawImage(layer, left, top, side, side);
    if (!showGears) return;
    const scale = side / (2 * SIZE);
    g.strokeStyle = palette.soft;
    g.lineWidth = 1;
    g.globalAlpha = 0.6;
    traceSpiral(spiral, alpha, {
      circle(cx, cy, radius) {
        g.beginPath();
        g.arc(left + side / 2 + cx * scale, top + side / 2 + cy * scale, radius * scale, 0, Math.PI * 2);
        g.stroke();
      },
      pen(child, x, y) {
        g.beginPath();
        g.arc(left + side / 2 + x * scale, top + side / 2 + y * scale, 3, 0, Math.PI * 2);
        g.fillStyle = PENS[pen] ?? palette.ink;
        g.fill();
      },
    });
    g.globalAlpha = 1;
  });

  return { reset };
});
