// Oil and water: WebGL Fluid Simulation (see fluid-sim.js) in a panel, with colour presets
// and a Splash button instead of the dat.gui settings panel.
import { toyMeta } from '../catalog.js';
import { defineToy } from '../runtime.js';
import { createFluid, getWebGLContext } from './fluid-sim.js';

function hsv(h, s, v) {
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const [r, g, b] = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i % 6];
  return { r, g, b };
}

// Each preset picks a hue (0..1) for a new splat; the original is "rainbow".
const PRESETS = {
  rainbow: () => Math.random(),
  'oil and water': () => (Math.random() < 0.5 ? 0.07 + Math.random() * 0.05 : 0.55 + Math.random() * 0.08),
  lava: () => Math.random() * 0.1,
  sea: () => 0.42 + Math.random() * 0.2,
};

export default defineToy(toyMeta('oil-and-water'), (ctx) => {
  const surface = ctx.canvas({ context: null });
  let preset = 'oil and water';
  const generateColor = () => {
    const c = hsv(PRESETS[preset](), 1.0, 1.0);
    return { r: c.r * 0.15, g: c.g * 0.15, b: c.b * 0.15 };
  };
  const context = getWebGLContext(surface.canvas);
  if (!context) {
    const note = ctx.add(ctx.element('p', { className: 'toy-message', textContent: 'This toy needs WebGL with half-float textures, which this browser does not offer.' }));
    note.setAttribute?.('role', 'status');
    ctx.onFrame(() => {});
    return { reset() {} };
  }
  const fluid = createFluid(surface.canvas, context, generateColor);

  function reset() {
    fluid.clearDye();
    fluid.splash();
  }
  fluid.splash();

  ctx.onResize(() => fluid.resize());
  ctx.controls([
    { label: 'Colours', options: Object.keys(PRESETS).map((name) => [name, name[0].toUpperCase() + name.slice(1)]), value: preset,
      onChange(value) { preset = value; } },
    { label: 'Splash', onClick() { fluid.splash(); ctx.redraw(); } },
  ]);

  const scaled = (value) => value * surface.ratio;
  ctx.drag(surface.canvas, {
    down({ x, y, id }) { fluid.pointerDown(id, scaled(x), scaled(y)); },
    move({ x, y, id }, pressed) {
      if (!pressed) return;
      fluid.pointerMove(id, scaled(x), scaled(y));
      ctx.redraw();
    },
    up({ id }) { fluid.pointerUp(id); },
  });

  ctx.onFrame((dt) => fluid.frame(dt, ctx.running));
  return {
    reset,
    // Frees the GPU memory now rather than whenever the canvas is collected.
    destroy() { context.gl.getExtension('WEBGL_lose_context')?.loseContext(); },
  };
});
