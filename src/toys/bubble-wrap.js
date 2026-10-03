// Bubble wrap: press a bubble to pop it, with a short generated pop (a burst of filtered
// noise; no sound files). When every bubble is popped, a new sheet rolls in.
import { toyMeta } from '../catalog.js';
import { defineToy } from '../runtime.js';
import { clear } from './view.js';

const COLUMNS = 8;
const ROWS = 8;
const REFILL_MS = 900;

export function makeSheet() {
  const bubbles = [];
  for (let row = 0; row < ROWS; row += 1) {
    for (let column = 0; column < COLUMNS - (row % 2); column += 1) {
      bubbles.push({ column: column + (row % 2) * 0.5, row, popped: false, inflate: 0, wobble: Math.random() * 6 });
    }
  }
  return bubbles;
}

/** A pop: white noise through a band-pass filter, with a fast attack and decay. */
export function playPop(audio) {
  const now = audio.currentTime;
  const length = Math.floor(audio.sampleRate * 0.09);
  const buffer = audio.createBuffer(1, length, audio.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) samples[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 3;
  const noise = audio.createBufferSource();
  noise.buffer = buffer;
  const filter = audio.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 900 + Math.random() * 900;
  filter.Q.value = 1.4;
  const gain = audio.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.9, now + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
  noise.connect(filter).connect(gain).connect(audio.destination);
  noise.start(now);
  noise.stop(now + 0.1);
}

export default defineToy(toyMeta('bubble-wrap'), (ctx) => {
  const surface = ctx.canvas();
  let bubbles = makeSheet();
  let layout = { cell: 40, left: 0, top: 0 };
  let refilling = false;
  let clock = 0;
  let muted = false;

  function reset() {
    bubbles = makeSheet();
    for (const bubble of bubbles) bubble.inflate = 1;
    refilling = false;
  }
  reset();

  ctx.controls([
    { label: 'Sound on', onClick(button) { muted = !muted; button.textContent = muted ? 'Sound off' : 'Sound on'; } },
  ]);

  const bubbleAt = (x, y) => bubbles.find((bubble) => {
    const bx = layout.left + (bubble.column + 0.5) * layout.cell;
    const by = layout.top + (bubble.row + 0.5) * layout.cell;
    return Math.hypot(x - bx, y - by) < layout.cell * 0.45;
  });

  ctx.drag(surface.canvas, {
    down({ x, y }) {
      const bubble = bubbleAt(x, y);
      if (!bubble || bubble.popped || bubble.inflate < 0.9) return;
      bubble.popped = true;
      const audio = muted ? null : ctx.audio();
      if (audio) playPop(audio);
      if (!refilling && bubbles.every((candidate) => candidate.popped)) {
        refilling = true;
        ctx.timeout(() => {
          bubbles = makeSheet();
          refilling = false;
          ctx.redraw();
        }, REFILL_MS);
      }
      ctx.redraw();
    },
  });

  ctx.onFrame((dt) => {
    clock += dt;
    for (const bubble of bubbles) bubble.inflate = Math.min(1, bubble.inflate + dt * 2.5);
    if (!ctx.running) for (const bubble of bubbles) bubble.inflate = 1;
    const { g } = surface;
    const { palette } = ctx;
    clear(surface, palette.paper);
    const cell = Math.min(surface.width / (COLUMNS + 0.6), surface.height / (ROWS + 0.6));
    layout = { cell, left: (surface.width - cell * COLUMNS) / 2, top: (surface.height - cell * ROWS) / 2 };
    g.fillStyle = ctx.theme === 'dark' ? 'rgba(180,210,230,0.10)' : 'rgba(170,205,225,0.35)';
    g.fillRect(layout.left - cell * 0.2, layout.top - cell * 0.2, cell * (COLUMNS + 0.4), cell * (ROWS + 0.4));
    for (const bubble of bubbles) {
      const x = layout.left + (bubble.column + 0.5) * cell;
      const y = layout.top + (bubble.row + 0.5) * cell;
      const r = cell * 0.4 * (bubble.popped ? 1 : 0.4 + 0.6 * bubble.inflate);
      if (bubble.popped) {
        g.strokeStyle = palette.soft;
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(x - r * 0.7, y - r * 0.2);
        g.lineTo(x - r * 0.1, y + r * 0.3);
        g.lineTo(x + r * 0.4, y - r * 0.4);
        g.lineTo(x + r * 0.7, y + r * 0.1);
        g.stroke();
        g.beginPath();
        g.arc(x, y, r, 0, Math.PI * 2);
        g.globalAlpha = 0.5;
        g.stroke();
        g.globalAlpha = 1;
        continue;
      }
      const wobble = 1 + Math.sin(clock * 2 + bubble.wobble) * 0.015;
      const shade = g.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r * wobble);
      shade.addColorStop(0, 'rgba(255,255,255,0.95)');
      shade.addColorStop(0.35, ctx.theme === 'dark' ? 'rgba(160,200,230,0.35)' : 'rgba(200,230,245,0.55)');
      shade.addColorStop(1, ctx.theme === 'dark' ? 'rgba(120,160,190,0.55)' : 'rgba(120,170,200,0.65)');
      g.fillStyle = shade;
      g.beginPath();
      g.arc(x, y, r * wobble, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = palette.soft;
      g.lineWidth = 1;
      g.stroke();
    }
  });

  return { reset };
});
