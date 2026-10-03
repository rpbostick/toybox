// Kaleidoscope. The bead chamber (beads tumbling in a square, pushed round by the turning
// tube, fading trails) and the triangle mirror tiling are from kaleidoscope by Kazuhiko Arase,
// Copyright (c) 2014 Kazuhiko Arase, MIT licence. Changed: the beads are drawn here instead of
// loaded from PNGs, the canvas follows the panel instead of the window, the mouse and touch
// handlers became pointer events, and the mouse wheel turns the tube too.
import { toyMeta } from '../catalog.js';
import { defineToy } from '../runtime.js';

const RECT = 160;
const LEN = RECT * Math.sqrt(3) / 2;
const OX = LEN / 2;
const OY = LEN / Math.sqrt(3) / 2;
const BEADS = 32;
const BEAD_COLOURS = ['#e63946', '#f4a261', '#e9c46a', '#2a9d8f', '#457b9d', '#9b5de5', '#f15bb5', '#00bbf9'];

function beadImage(ctx, colour, shape) {
  const image = ctx.element('canvas', { width: 28, height: 28 });
  const g = image.getContext('2d');
  g.fillStyle = colour;
  g.globalAlpha = 0.85;
  g.beginPath();
  if (shape === 0) g.arc(14, 14, 10, 0, Math.PI * 2);
  else if (shape === 1) { g.moveTo(14, 2); g.lineTo(26, 24); g.lineTo(2, 24); g.closePath(); }
  else g.ellipse(14, 14, 12, 5, 0.6, 0, Math.PI * 2);
  g.fill();
  g.globalAlpha = 0.6;
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.arc(10, 10, 3, 0, Math.PI * 2);
  g.fill();
  return image;
}

function createChamber(ctx, images) {
  let deltaAngle = 0;
  const content = ctx.element('canvas', { width: RECT, height: RECT });
  const g = content.getContext('2d');
  const buffer = ctx.element('canvas', { width: RECT, height: RECT });
  const bufferG = buffer.getContext('2d');

  const particle = () => {
    const img = images[Math.floor(Math.random() * images.length)];
    let ax = 0; let ay = 0; let vx = 0; let vy = 0;
    let x = Math.random() * RECT;
    let y = Math.random() * RECT;
    let arot = 0; let vrot = 0;
    let rot = Math.random() * Math.PI;
    const scale = Math.random() * 0.7 + 0.3;
    return {
      move() {
        g.save();
        g.translate(x, y);
        g.rotate(rot);
        g.translate(-img.width / 2 * scale, -img.height / 2 * scale);
        g.transform(scale, 0, 0, scale, 0, 0);
        g.drawImage(img, 0, 0);
        g.restore();
        vx += ax; vy += ay; vrot += arot;
        x += vx; y += vy;
        rot = (rot + vrot) % (Math.PI * 2);
        if (x > RECT) { x = RECT; vx = -vx; }
        if (x < 0) { x = 0; vx = -vx; }
        if (y > RECT) { y = RECT; vy = -vy; }
        if (y < 0) { y = 0; vy = -vy; }
        const dx = x - OX;
        const dy = y - OY;
        const r = Math.sqrt(dx * dx + dy * dy);
        const t = Math.atan2(dy, dx) + Math.PI / 2;
        const a = deltaAngle * r / RECT;
        ax = Math.cos(t) * a;
        ay = Math.sin(t) * a;
        arot = a * 0.1;
        vx *= 0.99; vy *= 0.99; vrot *= 0.99;
      },
    };
  };
  let particles = [];
  return {
    canvas: content,
    fill() {
      particles = Array.from({ length: BEADS }, particle);
      g.clearRect(0, 0, RECT, RECT);
    },
    moveAll() {
      bufferG.clearRect(0, 0, RECT, RECT);
      bufferG.drawImage(content, 0, 0);
      g.clearRect(0, 0, RECT, RECT);
      g.save();
      g.globalAlpha = 0.8;
      g.drawImage(buffer, 0, 0);
      g.restore();
      for (const p of particles) p.move();
    },
    setDeltaAngle(value) { deltaAngle = value; },
  };
}

const absmod = (m, n) => { const r = m % n; return r < 0 ? n + r : r; };

export default defineToy(toyMeta('kaleidoscope'), (ctx) => {
  const surface = ctx.canvas();
  const images = BEAD_COLOURS.map((colour, i) => beadImage(ctx, colour, i % 3));
  const chamber = createChamber(ctx, images);
  let angle = 0;
  let deltaAngle = 0;
  let pressed = false;
  let holdAngle = 0;

  function reset() {
    angle = 0;
    deltaAngle = 0.02;
    chamber.fill();
    // Let the beads settle into trails before the first frame is shown.
    for (let i = 0; i < 30; i += 1) chamber.moveAll();
  }
  reset();

  const angleOf = (x, y) => Math.atan2(y - surface.height / 2, x - surface.width / 2);
  ctx.drag(surface.canvas, {
    down({ x, y }) { holdAngle = angleOf(x, y); deltaAngle = 0; pressed = true; },
    move({ x, y }, isPressed) {
      if (!pressed || !isPressed) return;
      const current = angleOf(x, y);
      deltaAngle = current - holdAngle;
      if (deltaAngle > Math.PI) deltaAngle -= 2 * Math.PI;
      if (deltaAngle < -Math.PI) deltaAngle += 2 * Math.PI;
      holdAngle = current;
      angle += deltaAngle;
      if (!ctx.running) { chamber.setDeltaAngle(deltaAngle); chamber.moveAll(); ctx.redraw(); }
    },
    up() { pressed = false; },
  });
  ctx.listen(surface.canvas, 'wheel', (event) => {
    event.preventDefault();
    deltaAngle += Math.sign(event.deltaY) * 0.01;
    deltaAngle = Math.max(-0.2, Math.min(0.2, deltaAngle));
    if (!ctx.running) { angle += deltaAngle; chamber.setDeltaAngle(deltaAngle); chamber.moveAll(); ctx.redraw(); }
  }, { passive: false });

  ctx.onFrame((dt) => {
    const frames = dt * 60;
    const dist = deltaAngle * frames;
    if (!pressed && dist !== 0) {
      angle += dist;
      deltaAngle *= 0.99 ** frames;
    }
    if (dt > 0) {
      chamber.setDeltaAngle(dist);
      chamber.moveAll();
    }
    drawTriangles();
  });

  function drawTriangles() {
    const { g } = surface;
    const w = surface.width;
    const h = surface.height;
    g.setTransform(surface.ratio, 0, 0, surface.ratio, 0, 0);
    g.fillStyle = ctx.theme === 'dark' ? '#000000' : '#101014';
    g.fillRect(0, 0, w, h);
    const cx = w / 2;
    const cy = h / 2;
    const n = Math.ceil(Math.sqrt(w * w + h * h) / 2 / LEN) + 1;
    const mxx = Math.cos(angle) * LEN;
    const mxy = Math.sin(angle) * LEN;
    const myx = Math.cos(angle + Math.PI / 2) * LEN * Math.sqrt(3) / 2;
    const myy = Math.sin(angle + Math.PI / 2) * LEN * Math.sqrt(3) / 2;
    for (let x = -n; x <= n; x += 1) {
      for (let y = -n; y <= n; y += 1) {
        const dx = x + (y % 2 !== 0 ? 0.5 : 0);
        const tx = mxx * dx + myx * y + cx;
        const ty = mxy * dx + myy * y + cy;
        const rot = (absmod(x, 3) + absmod(y, 2) * 2) % 3;
        drawUnit(g, tx, ty, rot, false);
        drawUnit(g, tx, ty, rot, true);
      }
    }
  }

  function drawUnit(g, x, y, rot, inv) {
    g.save();
    g.translate(x, y);
    g.rotate(angle);
    g.translate(-OX, -OY);
    if (inv) g.transform(1, 0, 0, -1, 0, 0);
    for (let i = 0; i < rot; i += 1) {
      g.rotate(-Math.PI / 3 * 2);
      g.translate(-LEN, 0);
    }
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(LEN, 0);
    g.lineTo(LEN / 2, LEN * Math.sqrt(3) / 2);
    g.closePath();
    g.clip();
    g.translate(OX, OY);
    g.rotate(-angle);
    g.translate(-RECT / 2, -RECT / 2);
    g.drawImage(chamber.canvas, 0, 0);
    g.restore();
  }

  return { reset };
});
