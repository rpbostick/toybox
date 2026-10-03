// Pointer grabbing for matter.js toys. Replaces Matter.Mouse/MouseConstraint, which bind
// mouse and touch listeners to the canvas with no way to remove them; this one uses pointer
// events through the toy session, so destroy() releases them.
import Matter from 'matter-js';

const { Composite, Constraint, Query } = Matter;

export function attachHand(ctx, surface, { engine, toWorld, canGrab = () => true, stiffness = 0.2, onRelease }) {
  const grips = new Map();

  ctx.drag(surface.canvas, {
    down({ x, y, id }) {
      const point = toWorld(x, y);
      const bodies = Composite.allBodies(engine.world).filter((body) => !body.isStatic && canGrab(body));
      const [body] = Query.point(bodies, point);
      if (!body) return;
      // As in Matter.MouseConstraint: pointB is the world-axis offset at grab time; matter
      // rotates it with the body from then on.
      const constraint = Constraint.create({
        pointA: point,
        bodyB: body,
        pointB: { x: point.x - body.position.x, y: point.y - body.position.y },
        stiffness,
        damping: 0.1,
        length: 0,
      });
      Composite.add(engine.world, constraint);
      grips.set(id, constraint);
      ctx.redraw();
    },
    move({ x, y, id }, pressed) {
      const constraint = grips.get(id);
      if (!pressed || !constraint) return;
      const point = toWorld(x, y);
      constraint.pointA.x = point.x;
      constraint.pointA.y = point.y;
    },
    up({ id }) {
      const constraint = grips.get(id);
      if (!constraint) return;
      Composite.remove(engine.world, constraint);
      grips.delete(id);
      onRelease?.(constraint.bodyB);
    },
  });

  return {
    get holding() { return grips.size > 0; },
    holds: (body) => [...grips.values()].some((constraint) => constraint.bodyB === body),
    releaseAll() {
      for (const constraint of grips.values()) Composite.remove(engine.world, constraint);
      grips.clear();
    },
  };
}

/** Steps the engine in fixed 1/120 s substeps so a slow frame cannot make bodies tunnel. */
export function stepEngine(engine, dt) {
  const steps = Math.max(1, Math.round(dt / (1 / 120)));
  const each = Math.min(dt / steps, 1 / 60) * 1000;
  if (each <= 0) return;
  for (let i = 0; i < steps; i += 1) Matter.Engine.update(engine, each);
}
