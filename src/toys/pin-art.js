// Pin art box: a grid of pins pushed out by the pointer (press and drag) or by an image (drop
// a picture on the box, or pick a stamp), slowly settling back.
import { toyMeta } from '../catalog.js';
import { defineToy } from '../runtime.js';
import { clear } from './view.js';

const COLUMNS = 36;
const ROWS = 36;
const PRESS_RADIUS = 2.6; // in pins
const SETTLE_PER_SECOND = 0.12;

/** Heights (0..1) from an image's darkness, sampled onto the pin grid. */
export function heightsFromImage(g, columns, rows) {
  const { data } = g.getImageData(0, 0, columns, rows);
  const heights = new Float32Array(columns * rows);
  for (let i = 0; i < heights.length; i += 1) {
    const alpha = data[i * 4 + 3] / 255;
    const light = (data[i * 4] + data[i * 4 + 1] + data[i * 4 + 2]) / (3 * 255);
    heights[i] = alpha * (1 - light);
  }
  return heights;
}

function drawStamp(g, name) {
  g.clearRect(0, 0, COLUMNS, ROWS);
  g.fillStyle = '#000000';
  g.save();
  g.translate(COLUMNS / 2, ROWS / 2);
  g.beginPath();
  if (name === 'hand') {
    g.ellipse(0, 5, 8, 9, 0, 0, Math.PI * 2);
    for (const [x, length, tilt] of [[-7, 9, -0.25], [-2.5, 12, -0.05], [2.5, 12, 0.05], [7, 10, 0.2]]) {
      g.save();
      g.translate(x, -2);
      g.rotate(tilt);
      g.rect(-1.8, -length, 3.6, length);
      g.restore();
    }
    g.save();
    g.translate(-8, 6);
    g.rotate(-1.0);
    g.rect(-1.8, -9, 3.6, 9);
    g.restore();
  } else if (name === 'd20') {
    for (let i = 0; i < 6; i += 1) {
      const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
      g.lineTo(Math.cos(angle) * 15, Math.sin(angle) * 15);
    }
    g.closePath();
  } else {
    g.moveTo(0, 12);
    g.bezierCurveTo(-18, -2, -10, -16, 0, -6);
    g.bezierCurveTo(10, -16, 18, -2, 0, 12);
  }
  g.fill();
  g.restore();
}

export default defineToy(toyMeta('pin-art'), (ctx) => {
  const surface = ctx.canvas();
  const sample = ctx.element('canvas', { width: COLUMNS, height: ROWS });
  const sampleG = sample.getContext('2d', { willReadFrequently: true });
  const heights = new Float32Array(COLUMNS * ROWS);
  const presses = new Map(); // pointer id -> { column, row }
  let layout = { cell: 10, left: 0, top: 0 };

  function reset() { heights.fill(0); }

  function imprint(newHeights) {
    for (let i = 0; i < heights.length; i += 1) heights[i] = Math.max(heights[i], newHeights[i]);
    ctx.redraw();
  }

  const controls = ctx.controls([
    { label: 'Stamp', options: [['', 'Stamp…'], ['hand', 'Hand'], ['d20', 'Die'], ['heart', 'Heart']], value: '',
      onChange(value) {
        if (!value) return;
        drawStamp(sampleG, value);
        imprint(heightsFromImage(sampleG, COLUMNS, ROWS));
        controls.Stamp.value = ''; // so the same stamp can be pressed again
      } },
  ]);

  const toGrid = (x, y) => ({ column: (x - layout.left) / layout.cell, row: (y - layout.top) / layout.cell });
  ctx.drag(surface.canvas, {
    down({ x, y, id }) { presses.set(id, toGrid(x, y)); ctx.redraw(); },
    move({ x, y, id }, pressed) { if (pressed && presses.has(id)) { presses.set(id, toGrid(x, y)); ctx.redraw(); } },
    up({ id }) { presses.delete(id); },
  });

  ctx.listen(ctx.el, 'dragover', (event) => event.preventDefault());
  ctx.listen(ctx.el, 'drop', (event) => {
    event.preventDefault();
    const file = [...(event.dataTransfer?.files ?? [])].find((candidate) => candidate.type.startsWith('image/'));
    if (!file) return;
    const url = URL.createObjectURL(file);
    const picture = ctx.element('img');
    picture.onload = () => {
      sampleG.clearRect(0, 0, COLUMNS, ROWS);
      const scale = Math.min(COLUMNS / picture.width, ROWS / picture.height);
      const w = picture.width * scale;
      const h = picture.height * scale;
      sampleG.drawImage(picture, (COLUMNS - w) / 2, (ROWS - h) / 2, w, h);
      URL.revokeObjectURL(url);
      imprint(heightsFromImage(sampleG, COLUMNS, ROWS));
    };
    picture.src = url;
  });

  function press() {
    for (const { column, row } of presses.values()) {
      const c0 = Math.max(0, Math.floor(column - PRESS_RADIUS));
      const c1 = Math.min(COLUMNS - 1, Math.ceil(column + PRESS_RADIUS));
      const r0 = Math.max(0, Math.floor(row - PRESS_RADIUS));
      const r1 = Math.min(ROWS - 1, Math.ceil(row + PRESS_RADIUS));
      for (let r = r0; r <= r1; r += 1) {
        for (let c = c0; c <= c1; c += 1) {
          const d = Math.hypot(c + 0.5 - column, r + 0.5 - row) / PRESS_RADIUS;
          if (d < 1) heights[r * COLUMNS + c] = Math.max(heights[r * COLUMNS + c], Math.cos(d * Math.PI / 2));
        }
      }
    }
  }

  ctx.onFrame((dt) => {
    press();
    if (dt > 0) for (let i = 0; i < heights.length; i += 1) heights[i] = Math.max(0, heights[i] - SETTLE_PER_SECOND * dt);
    const { g } = surface;
    const { palette } = ctx;
    clear(surface, palette.paper);
    const cell = Math.min(surface.width, surface.height) / (COLUMNS + 2);
    layout = { cell, left: (surface.width - cell * COLUMNS) / 2, top: (surface.height - cell * ROWS) / 2 };
    g.fillStyle = palette.faint;
    g.fillRect(layout.left - cell / 2, layout.top - cell / 2, cell * (COLUMNS + 1), cell * (ROWS + 1));
    const lift = cell * 0.9;
    const head = cell * 0.36;
    // Back rows first, so a raised pin covers the pins behind it.
    for (let r = 0; r < ROWS; r += 1) {
      for (let c = 0; c < COLUMNS; c += 1) {
        const h = heights[r * COLUMNS + c];
        const x = layout.left + (c + 0.5) * cell;
        const y = layout.top + (r + 0.5) * cell;
        if (h > 0.02) {
          g.strokeStyle = palette.soft;
          g.lineWidth = cell * 0.12;
          g.beginPath();
          g.moveTo(x, y);
          g.lineTo(x - h * lift * 0.6, y - h * lift);
          g.stroke();
        }
        const hx = x - h * lift * 0.6;
        const hy = y - h * lift;
        g.fillStyle = h > 0.02 ? palette.ink : palette.soft;
        g.beginPath();
        g.arc(hx, hy, head, 0, Math.PI * 2);
        g.fill();
        if (h > 0.02) {
          g.fillStyle = palette.glass;
          g.beginPath();
          g.arc(hx - head * 0.3, hy - head * 0.3, head * 0.4, 0, Math.PI * 2);
          g.fill();
        }
      }
    }
  });

  return { reset };
});
