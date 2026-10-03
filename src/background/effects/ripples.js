// Grid ripples: a square grid of thin lines bent by rings spreading slowly from the middle and
// quickly from the pointer (coasting on after a fling), brighter on the crests and fading
// towards the edges. A drag stretches and swirls the grid under it (the ripple field), pulls the
// whole grid like a sheet, and turns it as the inside of a ball that a fling spins on. Written
// for this library.
import { PERIOD_PX } from '../motion.js';
import { shaderBackground } from './shader.js';

export default shaderBackground(`
// A whole number of cells to the ball's turn, so a full turn closes without a seam; about 14
// cells to the view's height, as before the ball.
const float PERIOD = ${PERIOD_PX.toFixed(1)};

void main() {
  float aspect = uRes.x / uRes.y;
  vec2 view = uRes / uRatio;
  // This pixel in CSS px (y down), with the sheet and the ripple field applied.
  vec2 frag = sheetFrag();
  vec2 css = vec2(frag.x, uRes.y - frag.y) / uRatio;
  css -= fieldAt(css);
  // In units of the view's height from the middle, y up, as the rings are drawn.
  vec2 p = vec2(css.x - 0.5 * view.x, 0.5 * view.y - css.y) / view.y;
  float r0 = length(p);
  float wave0 = sin(r0 * 20.0 - uTime * 1.4) * exp(-r0 * 2.2);
  vec2 hand = (uPointer - 0.5) * vec2(aspect, 1.0);
  vec2 fromHand = p - hand;
  float r1 = length(fromHand);
  float wave1 = uPointerOn * sin(r1 * 34.0 - uTime * 4.0) * exp(-r1 * 7.0);
  vec2 bent = p + normalize(p + 1e-5) * wave0 * 0.012 + normalize(fromHand + 1e-5) * wave1 * 0.018;
  vec2 ball = onBall(vec2(bent.x, -bent.y) * view.y + 0.5 * view);
  float cell = PERIOD / max(1.0, floor(PERIOD / (view.y / 14.0) + 0.5));
  vec2 grid = abs(fract(ball / cell) - 0.5);
  float line = 0.5 - max(grid.x, grid.y);
  float pixel = 1.0 / (cell * uRatio);
  float ink = 1.0 - smoothstep(pixel * 0.6, pixel * 1.8, line);
  float crest = clamp(0.5 + 0.5 * (wave0 + wave1), 0.0, 1.0);
  float fade = smoothstep(1.0, 0.15, r0);
  vec3 color = mix(uColor[0], uColor[1], crest);
  float alpha = ink * fade * (0.3 + 0.55 * crest) + (1.0 - ink) * fade * 0.12 * crest;
  color = mix(uColor[2], color, ink);
  gl_FragColor = vec4(color * alpha, alpha);
}`, { dynamics: 'field' });
