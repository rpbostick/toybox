// Starfield: a slowly turning spiral of stars in three arms, inner stars turning faster than
// outer ones, each twinkling at its own pace, round a faint glow. The pointer (coasting on after
// a fling) pushes the stars near it aside, and a drag pulls and turns the sky a little like a
// sheet that glides on after release. Canvas 2D; written for this library.
import { easedPointer, frameLoop, makeCanvas } from './surface.js';

const ARMS = 3;
const PUSH = 50; // CSS px the pointer pushes a star by at most
const REACH = 110; // CSS px around the pointer that it reaches

/** A fixed pseudo-random sequence, so the same stars come back after a resize. */
function sequence(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function makeStars(count) {
  const random = sequence(20261002);
  return Array.from({ length: count }, () => {
    const radius = Math.sqrt(random()) * 0.95 + 0.02;
    const arm = Math.floor(random() * ARMS);
    return {
      radius,
      // A log spiral: the arm turns further the farther out it is, with some scatter off it.
      angle: (arm / ARMS) * Math.PI * 2 + Math.log(radius * 8 + 1) * 1.8 + (random() - 0.5) * 0.9 * (1 - radius * 0.5),
      size: 1 + random() * random() * 2.2,
      tint: Math.floor(random() * 3),
      phase: random() * Math.PI * 2,
      pace: 0.6 + random() * 1.8,
    };
  });
}

/**
 * Where a star at (x, y) shows once the sheet (motion.sheet()) has moved: carried by the shift
 * and turned against the twist about the middle (cx, cy), both by its weight, as the shader
 * backgrounds' sheetFrag() reads their pattern the other way round.
 */
export function onSheet(x, y, sheet, cx, cy) {
  const weight = sheet.weightAt({ x, y });
  const angle = -sheet.angle * weight;
  const dx = x - cx;
  const dy = y - cy;
  return [cx + Math.cos(angle) * dx - Math.sin(angle) * dy + sheet.x * weight, cy + Math.sin(angle) * dx + Math.cos(angle) * dy + sheet.y * weight];
}

export default {
  dynamics: ['momentum', 'sheet'],
  mount(el, api) {
    const win = el.ownerDocument.defaultView;
    const { motion } = api;
    if (!motion) throw new Error('a built-in background is mounted with api.motion');
    const surface = makeCanvas(el);
    const ctx = surface.canvas.getContext('2d');
    if (!ctx) throw new Error('this browser has no canvas 2D');
    const pointer = easedPointer(el);
    let colors = api.colors;
    let stars = [];

    function draw(seconds) {
      surface.fit();
      const { canvas, ratio } = surface;
      const width = canvas.width / ratio;
      const height = canvas.height / ratio;
      const wanted = Math.min(1400, Math.round((width * height) / 1200));
      if (stars.length !== wanted) stars = makeStars(wanted);
      const now = win.performance.now();
      pointer.set(motion.pointer(now));
      const hand = pointer.step();
      const sheet = motion.sheet(now);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, width, height);
      const cx = width / 2;
      const cy = height / 2;
      const span = Math.hypot(width, height) / 2;
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, span * 0.45);
      glow.addColorStop(0, colors.hex[0]);
      glow.addColorStop(1, 'transparent');
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, width, height);
      for (let tint = 0; tint < 3; tint++) {
        ctx.fillStyle = colors.hex[tint];
        for (const star of stars) {
          if (star.tint !== tint) continue;
          const angle = star.angle + seconds * 0.02 / (0.25 + star.radius);
          let x = cx + Math.cos(angle) * star.radius * span;
          let y = cy + Math.sin(angle) * star.radius * span * 0.8;
          if (sheet.moving) [x, y] = onSheet(x, y, sheet, cx, cy);
          if (hand.on > 0.01) {
            const dx = x - hand.x;
            const dy = y - hand.y;
            const distance = Math.hypot(dx, dy) || 1;
            const push = PUSH * hand.on * Math.exp(-(distance * distance) / (REACH * REACH));
            x += (dx / distance) * push;
            y += (dy / distance) * push;
          }
          ctx.globalAlpha = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(seconds * star.pace + star.phase));
          ctx.fillRect(x - star.size / 2, y - star.size / 2, star.size, star.size);
        }
      }
    }

    const loop = frameLoop(win, draw);
    const resized = new win.ResizeObserver(() => loop.redraw());
    resized.observe(el);
    loop.redraw();
    loop.resume();
    return {
      setColors(next) {
        colors = next;
        loop.redraw();
      },
      pause: () => loop.pause(),
      resume: () => loop.resume(),
      destroy() {
        loop.pause();
        resized.disconnect();
        surface.canvas.remove();
      },
    };
  },
};
