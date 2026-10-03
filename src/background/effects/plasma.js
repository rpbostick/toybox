// Plasma: the demoscene sum of sines (horizontal, vertical, diagonal and a wandering circle)
// mapped round the look's three colours. The pointer (coasting on after a fling) drops rings into
// it, and a drag pulls it like a sheet. Written for this library.
import { shaderBackground } from './shader.js';

export default shaderBackground(`
void main() {
  vec2 screen = gl_FragCoord.xy / uRes;
  vec2 uv = sheetFrag() / uRes;
  float aspect = uRes.x / uRes.y;
  vec2 p = (uv - 0.5) * vec2(aspect, 1.0) * 5.0;
  vec2 here = (screen - 0.5) * vec2(aspect, 1.0) * 5.0;
  float t = uTime * 0.35;
  vec2 centre = vec2(sin(t * 0.7), cos(t * 0.5)) * 2.0;
  float sum = sin(p.x * 0.9 + t)
    + sin((p.y * 0.8 - t) * 0.9)
    + sin((p.x + p.y) * 0.55 + t * 0.6)
    + sin(length(p - centre) * 1.3 - t * 1.2);
  vec2 hand = (uPointer - 0.5) * vec2(aspect, 1.0) * 5.0;
  float reach = length(here - hand);
  sum += uPointerOn * 1.6 * sin(reach * 3.0 - uTime * 3.0) * exp(-reach * 0.6);
  vec3 color = ramp(sum * 0.12 + 0.5 + t * 0.02);
  float alpha = 0.85;
  gl_FragColor = vec4(color * alpha, alpha);
}`, { scale: 0.5, dynamics: 'sheet' });
