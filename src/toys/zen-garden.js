// Zen sand garden: rake grooves into the sand with the pointer, place and move stones, and
// Smooth the sand to start over. The grooves are drawn into a sand layer that keeps them;
// stones are drawn on top and can be dragged.
import { toyMeta } from '../catalog.js';
import { defineToy } from '../runtime.js';
import { clear } from './view.js';

const SAND = 600;
export const RAKES = {
  fine: { tines: 7, spacing: 9, width: 3.2 },
  wide: { tines: 5, spacing: 18, width: 6 },
  stick: { tines: 1, spacing: 0, width: 4 },
};
const SAND_COLOURS = {
  light: { base: '#e8dcc2', groove: 'rgba(120,98,66,0.38)', ridge: 'rgba(255,250,236,0.55)', stone: '#7d7468', moss: '#6f8a4e' },
  dark: { base: '#4a4337', groove: 'rgba(15,12,8,0.5)', ridge: 'rgba(160,145,118,0.35)', stone: '#9a9284', moss: '#5c7341' },
};

/** The tine offsets across the rake, centred on the pointer. */
export function tineOffsets({ tines, spacing }) {
  return Array.from({ length: tines }, (_, i) => (i - (tines - 1) / 2) * spacing);
}

function defaultStones() {
  return [
    { x: 410, y: 220, r: 46, squash: 0.78, moss: true },
    { x: 455, y: 265, r: 22, squash: 0.85, moss: false },
    { x: 170, y: 420, r: 34, squash: 0.7, moss: false },
  ];
}

export default defineToy(toyMeta('zen-garden'), (ctx) => {
  const surface = ctx.canvas();
  const sand = ctx.element('canvas', { width: SAND, height: SAND });
  const sandG = sand.getContext('2d');
  const colours = SAND_COLOURS[ctx.theme];
  let rake = 'fine';
  let stones = defaultStones();
  let layout = { scale: 1, left: 0, top: 0 };
  const strokes = new Map(); // pointer id -> { last, stone, dx, dy }

  function smooth() {
    sandG.fillStyle = colours.base;
    sandG.fillRect(0, 0, SAND, SAND);
    // fixed grain, so the sand does not look flat
    let seed = 7;
    const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < 9000; i += 1) {
      sandG.fillStyle = random() < 0.5 ? colours.groove : colours.ridge;
      sandG.globalAlpha = 0.25;
      sandG.fillRect(random() * SAND, random() * SAND, 1.4, 1.4);
    }
    sandG.globalAlpha = 1;
  }

  function reset() {
    stones = defaultStones();
    smooth();
  }
  reset();

  ctx.controls([
    { label: 'Rake', options: [['fine', 'Fine rake'], ['wide', 'Wide rake'], ['stick', 'Stick']], value: rake,
      onChange(value) { rake = value; } },
    { label: 'Add stone', onClick() {
      if (stones.length >= 9) return;
      stones.push({ x: 120 + Math.random() * 360, y: 120 + Math.random() * 360, r: 18 + Math.random() * 26, squash: 0.7 + Math.random() * 0.2, moss: Math.random() < 0.4 });
      ctx.redraw();
    } },
    { label: 'Smooth', onClick() { smooth(); ctx.redraw(); } },
  ]);

  // The ridge uses butt caps: round ones showed every pointer step as a light dot across the
  // groove next to it.
  function rakeSegment(from, to) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.hypot(dx, dy);
    if (length < 0.5) return;
    const nx = -dy / length;
    const ny = dx / length;
    const { width } = RAKES[rake];
    const lit = nx + ny < 0 ? 1 : -1;
    for (const offset of tineOffsets(RAKES[rake])) {
      // the ridge of sand pushed up beside the groove (lit from the top left), then the groove
      const ridge = offset + width * 0.7 * lit;
      sandG.lineCap = 'butt';
      sandG.strokeStyle = colours.ridge;
      sandG.lineWidth = width * 0.55;
      sandG.beginPath();
      sandG.moveTo(from.x + nx * ridge, from.y + ny * ridge);
      sandG.lineTo(to.x + nx * ridge, to.y + ny * ridge);
      sandG.stroke();
      sandG.lineCap = 'round';
      sandG.strokeStyle = colours.groove;
      sandG.lineWidth = width;
      sandG.beginPath();
      sandG.moveTo(from.x + nx * offset, from.y + ny * offset);
      sandG.lineTo(to.x + nx * offset, to.y + ny * offset);
      sandG.stroke();
    }
  }

  const toSand = (x, y) => ({ x: (x - layout.left) / layout.scale, y: (y - layout.top) / layout.scale });
  const stoneAt = (point) => [...stones].reverse().find((stone) => Math.hypot(point.x - stone.x, (point.y - stone.y) / stone.squash) < stone.r);

  ctx.drag(surface.canvas, {
    down({ x, y, id }) {
      const point = toSand(x, y);
      const stone = stoneAt(point);
      strokes.set(id, stone ? { stone, dx: point.x - stone.x, dy: point.y - stone.y } : { last: point });
    },
    move({ x, y, id }, pressed) {
      const stroke = strokes.get(id);
      if (!pressed || !stroke) return;
      const point = toSand(x, y);
      if (stroke.stone) {
        stroke.stone.x = Math.max(0, Math.min(SAND, point.x - stroke.dx));
        stroke.stone.y = Math.max(0, Math.min(SAND, point.y - stroke.dy));
      } else {
        rakeSegment(stroke.last, point);
        stroke.last = point;
      }
      ctx.redraw();
    },
    up({ id }) { strokes.delete(id); },
  });

  ctx.onFrame(() => {
    const { g } = surface;
    const { palette } = ctx;
    clear(surface, palette.paper);
    const side = Math.min(surface.width, surface.height) - 16;
    layout = { scale: side / SAND, left: (surface.width - side) / 2, top: (surface.height - side) / 2 };
    g.fillStyle = palette.soft;
    g.fillRect(layout.left - 8, layout.top - 8, side + 16, side + 16);
    g.drawImage(sand, layout.left, layout.top, side, side);
    g.translate(layout.left, layout.top);
    g.scale(layout.scale, layout.scale);
    for (const stone of stones) {
      g.fillStyle = 'rgba(0,0,0,0.18)';
      g.beginPath();
      g.ellipse(stone.x + 6, stone.y + 8, stone.r, stone.r * stone.squash, 0, 0, Math.PI * 2);
      g.fill();
      const shade = g.createRadialGradient(stone.x - stone.r * 0.4, stone.y - stone.r * 0.4, stone.r * 0.1, stone.x, stone.y, stone.r);
      shade.addColorStop(0, '#c9c2b6');
      shade.addColorStop(1, colours.stone);
      g.fillStyle = shade;
      g.beginPath();
      g.ellipse(stone.x, stone.y, stone.r, stone.r * stone.squash, 0, 0, Math.PI * 2);
      g.fill();
      if (stone.moss) {
        g.fillStyle = colours.moss;
        g.beginPath();
        g.ellipse(stone.x - stone.r * 0.2, stone.y - stone.r * stone.squash * 0.45, stone.r * 0.55, stone.r * 0.22, -0.2, 0, Math.PI * 2);
        g.fill();
      }
    }
  });

  return { reset };
});
