// Lava lamp: wax blobs heated at the base rise, cool at the top and sink. The blobs are
// metaballs: a low-resolution field sum(r^2 / d^2) is thresholded with a soft edge into an
// ImageData and scaled up into the glass. Touch the glass to warm the wax near the pointer.
import { toyMeta } from '../catalog.js';
import { defineToy } from '../runtime.js';
import { clear } from './view.js';

const LAMP = { width: 160, height: 330, top: 40 };
const FIELD = { columns: 64, rows: 132 };
const BLOBS = 7;
export const PRESETS = {
  classic: { wax: [235, 92, 44], liquid: [255, 196, 82], glow: '#ffcf6b' },
  violet: { wax: [214, 74, 182], liquid: [70, 40, 120], glow: '#c48bff' },
  ocean: { wax: [58, 220, 190], liquid: [20, 60, 120], glow: '#7fe0ff' },
  ember: { wax: [255, 210, 80], liquid: [120, 20, 30], glow: '#ff7a4a' },
};

/** Half the glass width at height y (0 = top of the glass): narrow at the cap, wide low down. */
export function glassHalfWidth(y) {
  const t = Math.min(Math.max(y / LAMP.height, 0), 1);
  return 34 + 46 * Math.sin(t * Math.PI * 0.85);
}

function makeBlobs() {
  return Array.from({ length: BLOBS }, (_, i) => ({
    x: (Math.random() - 0.5) * 60,
    y: LAMP.height - 20 - Math.random() * 60 - (i % 3) * 70,
    vx: 0,
    vy: 0,
    r: 16 + Math.random() * 14,
    heat: Math.random(),
  }));
}

export function stepBlobs(blobs, dt) {
  for (const blob of blobs) {
    // Heat comes from the bulb at the base and leaks away near the cap.
    const depth = blob.y / LAMP.height;
    blob.heat += (depth > 0.82 ? 0.22 : -0.05 - (depth < 0.25 ? 0.1 : 0)) * dt;
    blob.heat = Math.min(1, Math.max(0, blob.heat));
    const buoyancy = (blob.heat - 0.5) * 30;
    blob.vy += -buoyancy * dt;
    blob.vx += (Math.random() - 0.5) * 4 * dt;
    blob.vx *= 1 - 0.8 * dt;
    blob.vy *= 1 - 0.8 * dt;
    blob.x += blob.vx * dt * 6;
    blob.y += blob.vy * dt * 6;
    const minY = blob.r * 0.6;
    const maxY = LAMP.height - blob.r * 0.5;
    if (blob.y < minY) { blob.y = minY; blob.vy = Math.abs(blob.vy) * 0.2; }
    if (blob.y > maxY) { blob.y = maxY; blob.vy = -Math.abs(blob.vy) * 0.2; }
    const half = glassHalfWidth(blob.y) - blob.r * 0.6;
    if (blob.x < -half) { blob.x = -half; blob.vx = Math.abs(blob.vx) * 0.3; }
    if (blob.x > half) { blob.x = half; blob.vx = -Math.abs(blob.vx) * 0.3; }
  }
}

export default defineToy(toyMeta('lava-lamp'), (ctx) => {
  const surface = ctx.canvas();
  const fieldCanvas = ctx.element('canvas', { width: FIELD.columns, height: FIELD.rows });
  const fieldG = fieldCanvas.getContext('2d');
  const image = fieldG.createImageData(FIELD.columns, FIELD.rows);
  let preset = 'classic';
  let blobs = makeBlobs();

  function reset() { blobs = makeBlobs(); }

  ctx.controls([
    { label: 'Colours', options: Object.keys(PRESETS).map((name) => [name, name[0].toUpperCase() + name.slice(1)]), value: preset,
      onChange(value) { preset = value; ctx.redraw(); } },
  ]);

  let layout = null;
  const toLamp = (x, y) => ({ x: (x - layout.cx) / layout.scale, y: (y - layout.top) / layout.scale });
  ctx.drag(surface.canvas, {
    down({ x, y }) { warm(toLamp(x, y)); },
    move({ x, y }, pressed) { if (pressed) warm(toLamp(x, y)); },
  });
  function warm(point) {
    for (const blob of blobs) {
      if (Math.hypot(blob.x - point.x, blob.y - point.y) < blob.r + 30) blob.heat = Math.min(1, blob.heat + 0.15);
    }
  }

  function paintField() {
    const { wax, liquid } = PRESETS[preset];
    const data = image.data;
    for (let row = 0; row < FIELD.rows; row += 1) {
      const y = (row / FIELD.rows) * LAMP.height;
      for (let column = 0; column < FIELD.columns; column += 1) {
        const x = (column / FIELD.columns - 0.5) * LAMP.width;
        let sum = 0;
        for (const blob of blobs) {
          const dx = x - blob.x;
          const dy = (y - blob.y) * 0.85;
          sum += (blob.r * blob.r) / (dx * dx + dy * dy + 1);
        }
        const t = Math.min(1, Math.max(0, (sum - 0.85) / 0.35));
        const edge = t * t * (3 - 2 * t);
        const glow = 0.75 + 0.25 * (y / LAMP.height);
        const i = (row * FIELD.columns + column) * 4;
        data[i] = (liquid[0] + (wax[0] - liquid[0]) * edge) * glow;
        data[i + 1] = (liquid[1] + (wax[1] - liquid[1]) * edge) * glow;
        data[i + 2] = (liquid[2] + (wax[2] - liquid[2]) * edge) * glow;
        data[i + 3] = 255;
      }
    }
    fieldG.putImageData(image, 0, 0);
  }

  function traceGlass(g) {
    g.beginPath();
    for (let y = 0; y <= LAMP.height; y += 6) g.lineTo(-glassHalfWidth(y), y);
    for (let y = LAMP.height; y >= 0; y -= 6) g.lineTo(glassHalfWidth(y), y);
    g.closePath();
  }

  ctx.onFrame((dt) => {
    stepBlobs(blobs, dt);
    paintField();
    const { g } = surface;
    const { palette } = ctx;
    clear(surface, palette.paper);
    const scale = Math.min(surface.width / 220, surface.height / (LAMP.height + LAMP.top + 70));
    layout = { scale, cx: surface.width / 2, top: (surface.height - (LAMP.height + LAMP.top + 70) * scale) / 2 + LAMP.top * scale };
    g.translate(layout.cx, layout.top);
    g.scale(scale, scale);
    // glow behind the glass
    g.save();
    g.shadowColor = PRESETS[preset].glow;
    g.shadowBlur = 40 * scale;
    traceGlass(g);
    g.fillStyle = PRESETS[preset].glow;
    g.globalAlpha = 0.25;
    g.fill();
    g.restore();
    // wax in the glass
    g.save();
    traceGlass(g);
    g.clip();
    g.imageSmoothingEnabled = true;
    g.drawImage(fieldCanvas, -LAMP.width / 2, 0, LAMP.width, LAMP.height);
    const shine = g.createLinearGradient(-80, 0, 80, 0);
    shine.addColorStop(0, 'rgba(255,255,255,0)');
    shine.addColorStop(0.3, 'rgba(255,255,255,0.18)');
    shine.addColorStop(0.45, 'rgba(255,255,255,0)');
    g.fillStyle = shine;
    g.fillRect(-90, 0, 180, LAMP.height);
    g.restore();
    traceGlass(g);
    g.strokeStyle = palette.ink;
    g.lineWidth = 2;
    g.stroke();
    // cap and base
    g.fillStyle = palette.soft;
    g.strokeStyle = palette.ink;
    g.beginPath();
    g.moveTo(-26, -LAMP.top);
    g.lineTo(26, -LAMP.top);
    g.lineTo(glassHalfWidth(0) + 2, 0);
    g.lineTo(-glassHalfWidth(0) - 2, 0);
    g.closePath();
    g.fill();
    g.stroke();
    const baseTop = LAMP.height;
    const half = glassHalfWidth(LAMP.height);
    g.beginPath();
    g.moveTo(-half - 2, baseTop);
    g.lineTo(half + 2, baseTop);
    g.lineTo(half + 26, baseTop + 64);
    g.lineTo(-half - 26, baseTop + 64);
    g.closePath();
    g.fill();
    g.stroke();
  });

  return { reset };
});
