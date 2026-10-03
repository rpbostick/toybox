// Stacking blocks. The stack and pyramid builds follow the matter.js examples
// examples/stack.js and examples/pyramid.js (Composites.stack / Composites.pyramid of boxes in
// walls), Copyright (c) Liam Brummitt and contributors, MIT licence. Drag blocks to stack
// them, knock the tower down, Reset to build it again.
import Matter from 'matter-js';
import { toyMeta } from '../catalog.js';
import { defineToy } from '../runtime.js';
import { attachHand, stepEngine } from './matter-hand.js';
import { drawBody } from './matter-ink.js';
import { clear, fitView } from './view.js';

const { Bodies, Composite, Composites, Engine } = Matter;

const WORLD = { width: 400, height: 400 };
const FLOOR = 380;
const SIZE = 30;
const BUILDS = {
  pyramid: () => Composites.pyramid(80, FLOOR - 8 * SIZE, 8, 8, 0, 0, (x, y) => Bodies.rectangle(x, y, SIZE, SIZE)),
  tower: () => Composites.stack(170, FLOOR - 10 * SIZE, 2, 10, 0, 0, (x, y) => Bodies.rectangle(x, y, SIZE, SIZE)),
  wall: () => Composites.stack(80, FLOOR - 5 * SIZE, 8, 5, 0, 0, (x, y, column, row) =>
    Bodies.rectangle(x + (row % 2) * SIZE / 2, y, SIZE, SIZE * 0.6)),
};
const INKS = ['accent', 'accent2', 'soft'];

export default defineToy(toyMeta('stacking-blocks'), (ctx) => {
  const surface = ctx.canvas();
  const engine = Engine.create();
  engine.positionIterations = 10;
  let build = 'pyramid';
  let blocks = [];
  let view = fitView(surface, WORLD.width, WORLD.height);
  ctx.onResize(() => { view = fitView(surface, WORLD.width, WORLD.height); });

  function reset() {
    Composite.clear(engine.world, false);
    const walls = [
      Bodies.rectangle(200, FLOOR + 25, 460, 50, { isStatic: true, label: 'floor' }),
      Bodies.rectangle(-25, 200, 50, 800, { isStatic: true, label: 'wall' }),
      Bodies.rectangle(425, 200, 50, 800, { isStatic: true, label: 'wall' }),
    ];
    const stack = BUILDS[build]();
    blocks = Composite.allBodies(stack);
    blocks.forEach((block, i) => { block.ink = INKS[i % INKS.length]; });
    Composite.add(engine.world, [...walls, stack]);
  }
  reset();

  attachHand(ctx, surface, { engine, toWorld: (x, y) => view.toWorld(x, y) });

  ctx.controls([
    { label: 'Build', options: [['pyramid', 'Pyramid'], ['tower', 'Tower'], ['wall', 'Wall']], value: build,
      onChange(value) { build = value; reset(); ctx.redraw(); } },
    { label: 'Throw a ball', onClick() {
      const ball = Bodies.circle(20, 120, 18, { density: 0.02, restitution: 0.3 });
      ball.ink = 'ink';
      Matter.Body.setVelocity(ball, { x: 14, y: -2 });
      Composite.add(engine.world, ball);
      blocks.push(ball);
    } },
  ]);

  ctx.onFrame((dt) => {
    stepEngine(engine, dt);
    const { g } = surface;
    const { palette } = ctx;
    clear(surface, palette.paper);
    view.apply(g);
    g.fillStyle = palette.faint;
    g.fillRect(0, FLOOR, WORLD.width, 6);
    for (const block of blocks) {
      drawBody(g, block, { fill: palette[block.ink], stroke: palette.ink, lineWidth: 1.5 });
    }
  });

  return { reset };
});
