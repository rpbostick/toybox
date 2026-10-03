// Fidget spinner: flick it round with the pointer; it keeps its momentum and slows with
// bearing friction. A soft hum (an oscillator, no sound files) follows the speed.
import { toyMeta } from '../catalog.js';
import { defineToy } from '../runtime.js';
import { clear } from './view.js';

const MAX_SPIN = 60; // rad/s
export const STYLES = {
  classic: { lobes: 3, colour: 'accent', weight: 'circle' },
  star: { lobes: 5, colour: 'accent2', weight: 'circle' },
  dice: { lobes: 3, colour: 'soft', weight: 'd6' },
  double: { lobes: 2, colour: 'ink', weight: 'circle' },
};

/** Spin after dt seconds: constant bearing friction plus a little air drag. */
export function slowDown(spin, dt) {
  const friction = 0.6 + Math.abs(spin) * 0.03;
  const next = Math.abs(spin) - friction * dt;
  return next <= 0 ? 0 : Math.sign(spin) * next;
}

export default defineToy(toyMeta('fidget-spinner'), (ctx) => {
  const surface = ctx.canvas();
  let style = 'classic';
  let angle = 0;
  let spin = 0;
  let grab = null; // { angle, time }
  let hum = null; // { oscillator, gain }
  let muted = false;

  function reset() {
    angle = 0;
    spin = 0;
  }

  ctx.controls([
    { label: 'Style', options: Object.keys(STYLES).map((name) => [name, name[0].toUpperCase() + name.slice(1)]), value: style,
      onChange(value) { style = value; ctx.redraw(); } },
    { label: 'Hum on', onClick(button) { muted = !muted; button.textContent = muted ? 'Hum off' : 'Hum on'; } },
  ]);

  function startHum() {
    if (hum || muted) return;
    const audio = ctx.audio();
    if (!audio) return;
    const oscillator = audio.createOscillator();
    oscillator.type = 'triangle';
    const filter = audio.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 600;
    const gain = audio.createGain();
    gain.gain.value = 0;
    oscillator.connect(filter).connect(gain).connect(audio.destination);
    oscillator.start();
    hum = { oscillator, gain, audio };
  }

  function updateHum() {
    if (!hum) return;
    const speed = Math.min(Math.abs(spin) / MAX_SPIN, 1);
    const now = hum.audio.currentTime;
    hum.oscillator.frequency.setTargetAtTime(70 + speed * 260, now, 0.05);
    hum.gain.gain.setTargetAtTime(muted ? 0 : speed * 0.12, now, 0.08);
  }

  const angleAt = (x, y) => Math.atan2(y - surface.height / 2, x - surface.width / 2);
  ctx.drag(surface.canvas, {
    down({ x, y }) {
      startHum();
      grab = { angle: angleAt(x, y), time: performance.now() };
      spin *= 0.5; // a finger on the spinner brakes it
    },
    move({ x, y }, pressed) {
      if (!pressed || !grab) return;
      const now = performance.now();
      const current = angleAt(x, y);
      let delta = current - grab.angle;
      if (delta > Math.PI) delta -= 2 * Math.PI;
      if (delta < -Math.PI) delta += 2 * Math.PI;
      const seconds = Math.max((now - grab.time) / 1000, 1 / 240);
      spin = Math.max(-MAX_SPIN, Math.min(MAX_SPIN, spin * 0.3 + (delta / seconds) * 0.7));
      angle += delta;
      grab = { angle: current, time: now };
      ctx.redraw();
    },
    up() { grab = null; },
  });

  ctx.onFrame((dt) => {
    if (dt > 0 && !grab) {
      angle += spin * dt;
      spin = slowDown(spin, dt);
    }
    updateHum();
    draw();
  });

  function drawSpinner(g, size, palette, alpha) {
    const { lobes, colour, weight } = STYLES[style];
    g.globalAlpha = alpha;
    // arms joining the hub to the weights
    g.strokeStyle = palette[colour];
    g.lineWidth = size * 0.26;
    g.lineCap = 'round';
    g.beginPath();
    for (let i = 0; i < lobes; i += 1) {
      const a = (i / lobes) * Math.PI * 2;
      g.moveTo(0, 0);
      g.lineTo(Math.cos(a) * size * 0.62, Math.sin(a) * size * 0.62);
    }
    g.stroke();
    g.fillStyle = palette[colour];
    g.strokeStyle = palette.ink;
    g.lineWidth = size * 0.02;
    g.beginPath();
    for (let i = 0; i < lobes; i += 1) {
      const a = (i / lobes) * Math.PI * 2;
      g.moveTo(Math.cos(a) * size * 0.62 + size * 0.24, Math.sin(a) * size * 0.62);
      g.arc(Math.cos(a) * size * 0.62, Math.sin(a) * size * 0.62, size * 0.24, 0, Math.PI * 2);
    }
    g.moveTo(size * 0.3, 0);
    g.arc(0, 0, size * 0.3, 0, Math.PI * 2);
    g.fill();
    for (let i = 0; i < lobes; i += 1) {
      const a = (i / lobes) * Math.PI * 2;
      g.beginPath();
      const cx = Math.cos(a) * size * 0.62;
      const cy = Math.sin(a) * size * 0.62;
      if (weight === 'd6') {
        g.rect(cx - size * 0.14, cy - size * 0.14, size * 0.28, size * 0.28);
        g.fillStyle = palette.paper;
        g.fill();
        g.stroke();
        g.fillStyle = palette.ink;
        for (let pip = 0; pip <= i; pip += 1) {
          g.beginPath();
          g.arc(cx + (pip - i / 2) * size * 0.07, cy, size * 0.025, 0, Math.PI * 2);
          g.fill();
        }
      } else {
        g.arc(cx, cy, size * 0.15, 0, Math.PI * 2);
        g.fillStyle = palette.faint;
        g.fill();
        g.stroke();
      }
    }
    g.beginPath();
    g.arc(0, 0, size * 0.14, 0, Math.PI * 2);
    g.fillStyle = palette.faint;
    g.fill();
    g.stroke();
    g.globalAlpha = 1;
  }

  function draw() {
    const { g } = surface;
    const { palette } = ctx;
    clear(surface, palette.paper);
    const size = Math.min(surface.width, surface.height) * 0.4;
    g.translate(surface.width / 2, surface.height / 2);
    // Motion blur: faint copies trailing behind when it spins fast.
    const ghosts = Math.min(6, Math.floor(Math.abs(spin) / 8));
    for (let i = ghosts; i >= 1; i -= 1) {
      g.save();
      g.rotate(angle - Math.sign(spin) * i * 0.05);
      drawSpinner(g, size, palette, 0.12);
      g.restore();
    }
    g.save();
    g.rotate(angle);
    drawSpinner(g, size, palette, 1);
    g.restore();
  }

  return {
    reset,
    pause() { if (hum) hum.gain.gain.value = 0; },
    destroy() { hum?.oscillator.stop(); hum = null; },
  };
});
