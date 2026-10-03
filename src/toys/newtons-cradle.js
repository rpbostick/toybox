// Newton's cradle. The cradle construction (circles with infinite inertia, restitution 1, no
// friction, hung from fixed points 1.9 radii apart) is the matter.js example
// examples/newtonsCradle.js, Copyright (c) Liam Brummitt and contributors, MIT licence.
// Drawn in ink with a frame; pull a ball with the pointer and let go.
import Matter from 'matter-js';
import { toyMeta } from '../catalog.js';
import { defineToy } from '../runtime.js';
import { attachHand, stepEngine } from './matter-hand.js';
import { drawBody } from './matter-ink.js';
import { clear, fitView } from './view.js';

const { Bodies, Body, Composite, Constraint, Engine } = Matter;

const WORLD = { width: 400, height: 400 };
const BALLS = 5;
const RADIUS = 22;
const STRING = 190;
const TOP = 70;

export function buildCradle(engine) {
  Composite.clear(engine.world, false);
  const left = WORLD.width / 2 - ((BALLS - 1) * RADIUS * 1.9) / 2;
  const balls = [];
  for (let i = 0; i < BALLS; i += 1) {
    const x = left + i * RADIUS * 1.9;
    const ball = Bodies.circle(x, TOP + STRING, RADIUS, {
      inertia: Infinity, restitution: 1, friction: 0, frictionAir: 0, slop: RADIUS * 0.02,
    });
    Composite.add(engine.world, [ball, Constraint.create({ pointA: { x, y: TOP }, bodyB: ball, stiffness: 1 })]);
    balls.push(ball);
  }
  return balls;
}

export default defineToy(toyMeta('newtons-cradle'), (ctx) => {
  const surface = ctx.canvas();
  const engine = Engine.create();
  let balls = [];
  let view = fitView(surface, WORLD.width, WORLD.height);
  ctx.onResize(() => { view = fitView(surface, WORLD.width, WORLD.height); });

  function reset() {
    balls = buildCradle(engine);
    // Start with the first ball pulled back, as in the example, so it swings at once.
    Body.translate(balls[0], { x: -120, y: -70 });
  }
  reset();

  attachHand(ctx, surface, { engine, toWorld: (x, y) => view.toWorld(x, y), stiffness: 0.6 });

  ctx.onFrame((dt) => {
    stepEngine(engine, dt);
    const { g } = surface;
    const { palette } = ctx;
    clear(surface, palette.paper);
    view.apply(g);
    // frame
    g.strokeStyle = palette.soft;
    g.lineWidth = 6;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(70, TOP - 10);
    g.lineTo(330, TOP - 10);
    g.moveTo(80, TOP - 10);
    g.lineTo(60, 360);
    g.moveTo(320, TOP - 10);
    g.lineTo(340, 360);
    g.moveTo(40, 360);
    g.lineTo(360, 360);
    g.stroke();
    g.lineWidth = 1;
    g.strokeStyle = palette.ink;
    for (const constraint of Composite.allConstraints(engine.world)) {
      if (!constraint.pointA || constraint.bodyA) continue;
      const end = constraint.bodyB.position;
      g.beginPath();
      g.moveTo(constraint.pointA.x, constraint.pointA.y);
      g.lineTo(end.x, end.y);
      g.stroke();
    }
    for (const ball of balls) drawBody(g, ball, { fill: palette.faint, stroke: palette.ink, lineWidth: 2 });
    for (const ball of balls) {
      g.fillStyle = palette.glass;
      g.beginPath();
      g.arc(ball.position.x - RADIUS * 0.35, ball.position.y - RADIUS * 0.35, RADIUS * 0.3, 0, Math.PI * 2);
      g.fill();
    }
  });

  return { reset };
});
