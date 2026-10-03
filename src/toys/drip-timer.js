// Drip timer: a Galton board closed into an hourglass. The bead and peg physics (tiny beads
// with almost no friction or bounce dropping through a triangle of static pegs into tubes)
// follow Galton board by Lucio Paiva, Copyright 2018 Lucio Paiva, MIT licence. Changed: the
// board is closed, the beads start in a reservoir above a neck instead of spawning on a
// timer, and Flip turns the board over (gravity and view rotate together) so the beads run
// back through the pegs, like an hourglass.
import Matter from 'matter-js';
import { toyMeta } from '../catalog.js';
import { defineToy } from '../runtime.js';
import { stepEngine } from './matter-hand.js';
import { drawBody } from './matter-ink.js';
import { clear } from './view.js';

const { Bodies, Composite, Engine, Vertices } = Matter;

const BOARD = { left: 20, right: 280, top: 10, bottom: 390 };
const CENTRE = { x: 150, y: 200 };
const NECK = { top: 150, bottom: 162, half: 8 };
const BINS_TOP = 300;
const BEAD_RADIUS = 3.2;
const BEADS = 160;
const FLIP_SECONDS = 1.4;

function solid(points, options) {
  const centre = Vertices.centre(points);
  return Bodies.fromVertices(centre.x, centre.y, [points], { isStatic: true, ...options });
}

export function buildBoard() {
  const { left, right, top, bottom } = BOARD;
  const statics = [
    Bodies.rectangle(150, top - 10, 300, 20, { isStatic: true }),
    Bodies.rectangle(150, bottom + 10, 300, 20, { isStatic: true }),
    Bodies.rectangle(left - 10, 200, 20, 420, { isStatic: true }),
    Bodies.rectangle(right + 10, 200, 20, 420, { isStatic: true }),
    // The shoulders between the reservoir and the pegs: a funnel above the neck, and walls
    // below it that follow the edge of the peg triangle, so beads run back to the neck when
    // the board is upside down.
    solid([{ x: left, y: 90 }, { x: 150 - NECK.half, y: NECK.top }, { x: 150 - NECK.half, y: NECK.bottom }, { x: left, y: BINS_TOP - 4 }]),
    solid([{ x: right, y: 90 }, { x: right, y: BINS_TOP - 4 }, { x: 150 + NECK.half, y: NECK.bottom }, { x: 150 + NECK.half, y: NECK.top }]),
  ];
  const pegs = [];
  for (let row = 0, y = 176; y < BINS_TOP - 14; row += 1, y += 13) {
    const halfWidth = NECK.half + ((y - NECK.bottom) / (BINS_TOP - 4 - NECK.bottom)) * (150 - left - NECK.half);
    const offset = row % 2 ? 0 : 8;
    for (let x = 150 - 160 + offset; x <= 150 + 160; x += 16) {
      if (Math.abs(x - 150) < halfWidth - 7) pegs.push(Bodies.circle(x, y, 2.4, { isStatic: true, label: 'peg' }));
    }
  }
  const dividers = [];
  for (let x = left + 16; x < right; x += 16) {
    dividers.push(Bodies.rectangle(x, (BINS_TOP + 8 + bottom) / 2, 2, bottom - BINS_TOP - 8, { isStatic: true, label: 'divider' }));
  }
  return { statics, pegs, dividers };
}

function fillReservoir() {
  const beads = [];
  for (let i = 0; i < BEADS; i += 1) {
    const column = i % 30;
    const row = Math.floor(i / 30);
    const x = BOARD.left + 10 + column * 8 + (row % 2) * 4;
    const y = BOARD.top + 8 + row * 8;
    beads.push(Bodies.circle(x, y, BEAD_RADIUS, { friction: 1e-5, frictionStatic: 0, restitution: 0.001, density: 1e-3, slop: 0.02 }));
  }
  return beads;
}

export default defineToy(toyMeta('drip-timer'), (ctx) => {
  const surface = ctx.canvas();
  const engine = Engine.create();
  let beads = [];
  let board = null;
  let angle = 0;
  let turning = null; // { from, to, elapsed }

  function setGravity() {
    engine.gravity.x = Math.sin(angle);
    engine.gravity.y = Math.cos(angle);
  }

  function reset() {
    Composite.clear(engine.world, false);
    board = buildBoard();
    beads = fillReservoir();
    angle = 0;
    turning = null;
    setGravity();
    Composite.add(engine.world, [...board.statics, ...board.pegs, ...board.dividers, ...beads]);
  }
  reset();

  function flip() {
    if (turning) return;
    turning = { from: angle, to: angle + Math.PI, elapsed: 0 };
    if (!ctx.running) {
      // Paused: turn over at once so the change shows.
      angle = turning.to % (Math.PI * 2);
      turning = null;
      setGravity();
      ctx.redraw();
    }
  }

  ctx.controls([{ label: 'Flip', onClick: flip }]);
  ctx.drag(surface.canvas, { up: flip });

  ctx.onFrame((dt) => {
    if (turning) {
      turning.elapsed += dt;
      const t = Math.min(turning.elapsed / FLIP_SECONDS, 1);
      const eased = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      angle = turning.from + (turning.to - turning.from) * eased;
      if (t >= 1) {
        angle = turning.to % (Math.PI * 2);
        turning = null;
      }
      setGravity();
    }
    stepEngine(engine, dt);
    for (const bead of beads) {
      // A bead squeezed out through a wall during the flip goes back to the centre.
      const { x, y } = bead.position;
      if (x < BOARD.left - 2 || x > BOARD.right + 2 || y < BOARD.top - 2 || y > BOARD.bottom + 2) {
        Matter.Body.setPosition(bead, CENTRE);
        Matter.Body.setVelocity(bead, { x: 0, y: 0 });
      }
    }
    draw();
  });

  function draw() {
    const { g } = surface;
    const { palette } = ctx;
    clear(surface, palette.paper);
    const scale = Math.min(surface.width, surface.height) / 410;
    g.setTransform(surface.ratio, 0, 0, surface.ratio, 0, 0);
    g.translate(surface.width / 2, surface.height / 2);
    g.rotate(angle);
    g.scale(scale, scale);
    g.translate(-CENTRE.x, -CENTRE.y);
    g.fillStyle = palette.glass;
    g.strokeStyle = palette.ink;
    g.lineWidth = 2;
    g.beginPath();
    g.rect(BOARD.left, BOARD.top, BOARD.right - BOARD.left, BOARD.bottom - BOARD.top);
    g.fill();
    g.stroke();
    for (const body of board.statics.slice(4)) drawBody(g, body, { fill: palette.faint, stroke: palette.ink, lineWidth: 1.5 });
    for (const body of board.dividers) drawBody(g, body, { fill: palette.soft });
    for (const body of board.pegs) drawBody(g, body, { fill: palette.ink });
    g.fillStyle = palette.accent;
    g.beginPath();
    for (const bead of beads) {
      g.moveTo(bead.position.x + BEAD_RADIUS, bead.position.y);
      g.arc(bead.position.x, bead.position.y, BEAD_RADIUS, 0, Math.PI * 2);
    }
    g.fill();
  }

  return { reset };
});
