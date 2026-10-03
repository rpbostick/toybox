// A small verlet-integration engine, ported from verlet-js (lib/verlet.js, lib/constraint.js,
// lib/objects.js), Copyright 2013 Sub Protocol and other contributors, MIT licence.
// Changed: plain {x, y} points instead of the Vec2 class, no canvas or mouse handling (the toy
// owns those, through pointer events), particles can be grabbed by several pointers, and a
// collision pass pushes particles out of round pegs. The AngleConstraint is not ported.

export function particle(x, y) {
  return { pos: { x, y }, last: { x, y } };
}

export function distanceConstraint(a, b, stiffness, distance = Math.hypot(a.pos.x - b.pos.x, a.pos.y - b.pos.y)) {
  return {
    a, b, stiffness, distance,
    relax(stepCoef) {
      const nx = a.pos.x - b.pos.x;
      const ny = a.pos.y - b.pos.y;
      const m = nx * nx + ny * ny || 1e-9;
      const scale = ((distance * distance - m) / m) * stiffness * stepCoef;
      a.pos.x += nx * scale;
      a.pos.y += ny * scale;
      b.pos.x -= nx * scale;
      b.pos.y -= ny * scale;
    },
  };
}

/** Holds a particle at a point; `at` may be a moving object (a finger), read every step. */
export function pinConstraint(a, at) {
  return {
    a, at, pin: true,
    relax() {
      a.pos.x = at.x;
      a.pos.y = at.y;
    },
  };
}

export function createWorld({ width, height, gravity = 0.2, friction = 0.99, groundFriction = 0.8 }) {
  const world = {
    width, height, gravity, friction, groundFriction,
    particles: [],
    constraints: [],
    pegs: [], // { x, y, r }
    grabs: new Map(), // pointer id -> { particle, x, y }

    frame(steps) {
      for (const p of world.particles) {
        let vx = (p.pos.x - p.last.x) * world.friction;
        let vy = (p.pos.y - p.last.y) * world.friction;
        if (p.pos.y >= world.height - 1 && vx * vx + vy * vy > 0.000001) {
          vx *= world.groundFriction;
          vy *= world.groundFriction;
        }
        p.last.x = p.pos.x;
        p.last.y = p.pos.y;
        p.pos.x += vx;
        p.pos.y += vy + world.gravity;
      }
      for (const { particle: p, x, y } of world.grabs.values()) {
        p.pos.x = x;
        p.pos.y = y;
      }
      const stepCoef = 1 / steps;
      for (let i = 0; i < steps; i += 1) {
        for (const constraint of world.constraints) constraint.relax(stepCoef);
        world.collide();
      }
      for (const p of world.particles) {
        p.pos.y = Math.min(p.pos.y, world.height - 1);
        p.pos.x = Math.max(0, Math.min(world.width - 1, p.pos.x));
      }
    },

    collide() {
      for (const p of world.particles) {
        for (const peg of world.pegs) {
          const dx = p.pos.x - peg.x;
          const dy = p.pos.y - peg.y;
          const d = Math.hypot(dx, dy);
          if (d < peg.r && d > 1e-6) {
            p.pos.x = peg.x + (dx / d) * peg.r;
            p.pos.y = peg.y + (dy / d) * peg.r;
          }
        }
      }
    },

    nearest(x, y, radius) {
      let best = null;
      let bestD2 = radius * radius;
      for (const p of world.particles) {
        const d2 = (p.pos.x - x) ** 2 + (p.pos.y - y) ** 2;
        if (d2 <= bestD2) {
          best = p;
          bestD2 = d2;
        }
      }
      return best;
    },
  };
  return world;
}

/** The cloth from verlet-js objects.js: a grid of particles, every pinMod-th top particle pinned. */
export function cloth(world, origin, width, height, segments, pinMod, stiffness) {
  const xStride = width / segments;
  const yStride = height / segments;
  const particles = [];
  for (let y = 0; y < segments; y += 1) {
    for (let x = 0; x < segments; x += 1) {
      const p = particle(origin.x + x * xStride - width / 2 + xStride / 2, origin.y + y * yStride - height / 2 + yStride / 2);
      particles.push(p);
      if (x > 0) world.constraints.push(distanceConstraint(p, particles[y * segments + x - 1], stiffness));
      if (y > 0) world.constraints.push(distanceConstraint(p, particles[(y - 1) * segments + x], stiffness));
    }
  }
  for (let x = 0; x < segments; x += 1) {
    if (x % pinMod === 0) world.constraints.push(pinConstraint(particles[x], { ...particles[x].pos }));
  }
  world.particles.push(...particles);
  return { particles, segments, stride: Math.min(xStride, yStride) };
}
