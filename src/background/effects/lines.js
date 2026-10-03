// Line waves: horizontal lines across the page, each swaying on two slow sine waves of its own
// phase, stroked with a gradient through the look's three colours. The pointer (coasting on
// after a fling) parts the lines around it; a drag stretches and swirls them under it (the
// ripple field), pulls the whole field like a sheet that glides on after release, and turns the
// sway pattern as the inside of a ball that a fling spins on, as figurewright's waves do.
// Canvas 2D; written for this library.
import { PERIOD_PX, REACH_PX } from '../motion.js';
import { easedPointer, frameLoop, makeCanvas } from './surface.js';

const GAP = 30; // CSS px between lines
const STEP = 14; // CSS px between points along a line
const SWAY = 16; // CSS px of sway at most
const PART = 60; // CSS px the pointer parts the lines by
const REACH = 140; // CSS px around the pointer that it reaches

// The sway's wave numbers (per pattern px), each a whole number of cycles to the ball's turn so a
// full turn closes without a seam: about the 0.0045 and 0.012 along a line, and 0.33 and 0.21 of
// phase a line, the sway had before the ball.
const cycles = (count) => (2 * Math.PI * count) / PERIOD_PX;
const ALONG_SLOW = cycles(6);
const ALONG_FAST = cycles(15);
const ACROSS_SLOW = cycles(14);
const ACROSS_FAST = cycles(9);

/** The sway at a point of the pattern (x along a line, y across the lines), in CSS px. */
export function sway(x, y, seconds) {
  return SWAY * (0.6 * Math.sin(x * ALONG_SLOW + seconds * 0.45 + y * ACROSS_SLOW) + 0.4 * Math.sin(x * ALONG_FAST - seconds * 0.7 + y * ACROSS_FAST));
}

/**
 * The lines' points as the ripple field reads a grid: columns STEP px apart (x), each holding one
 * point per line GAP px apart (y), REACH_PX beyond every edge so a moved line's end never shows.
 */
export function lineGrid(width, height) {
  const columns = Math.ceil((width + 2 * REACH_PX) / STEP) + 1;
  const rows = Math.ceil((height + 2 * REACH_PX) / GAP) + 1;
  const left = -Math.ceil(REACH_PX / STEP) * STEP;
  const top = -Math.ceil(REACH_PX / GAP) * GAP;
  return Array.from({ length: columns }, (_, column) => Array.from({ length: rows }, (_, row) => ({ x: left + column * STEP, y: top + row * GAP, wave: { x: 0, y: 0 } })));
}

export default {
  dynamics: ['momentum', 'ripple', 'sheet', 'spin'],
  mount(el, api) {
    const win = el.ownerDocument.defaultView;
    const { motion } = api;
    if (!motion) throw new Error('a built-in background is mounted with api.motion');
    const surface = makeCanvas(el);
    const ctx = surface.canvas.getContext('2d');
    if (!ctx) throw new Error('this browser has no canvas 2D');
    const pointer = easedPointer(el);
    let colors = api.colors;
    let grid = null;
    let size = '';

    function draw(seconds) {
      surface.fit();
      const { canvas, ratio } = surface;
      const width = canvas.width / ratio;
      const height = canvas.height / ratio;
      if (size !== `${width}×${height}`) {
        size = `${width}×${height}`;
        grid = lineGrid(width, height);
      }
      const now = win.performance.now();
      pointer.set(motion.pointer(now));
      const hand = pointer.step();
      const pattern = motion.sample(grid, now);
      const rows = grid[0].length;
      for (let column = 0; column < grid.length; column++) {
        for (let row = 0; row < rows; row++) {
          const point = grid[column][row];
          const k = column * rows + row;
          point.wave.y = pattern ? sway(pattern.x[k], pattern.y[k], seconds) : sway(point.x, point.y, seconds);
        }
      }
      const moved = motion.displace(grid, now);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, width, height);
      const gradient = ctx.createLinearGradient(0, 0, width, height);
      colors.hex.forEach((hex, i) => gradient.addColorStop(i / (colors.hex.length - 1), hex));
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 1.1;
      ctx.globalAlpha = colors.theme === 'light' ? 0.75 : 0.85;
      for (let row = 0; row < rows; row++) {
        ctx.beginPath();
        for (let column = 0; column < grid.length; column++) {
          const point = grid[column][row];
          const k = column * rows + row;
          const x = point.x + (moved ? moved.x[k] : 0);
          let y = point.y + point.wave.y + (moved ? moved.y[k] : 0);
          if (hand.on > 0.01) {
            const dx = x - hand.x;
            const dy = y - hand.y;
            const near = Math.exp(-(dx * dx + dy * dy) / (REACH * REACH));
            y += Math.sign(dy || 1) * PART * near * hand.on;
          }
          if (column === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
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
