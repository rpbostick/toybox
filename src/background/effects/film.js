// Soap film: the thickness of a slowly flowing film (fbm noise warped by more fbm) turned into
// interference bands, each band coloured from the look's three colours, with a soft sheen where
// bands meet. The pointer (coasting on after a fling) stirs a swirl into the film, and a drag
// pulls the film like a sheet. Written for this library.
import { shaderBackground } from './shader.js';

export default shaderBackground(`
void main() {
  vec2 screen = gl_FragCoord.xy / uRes;
  vec2 uv = sheetFrag() / uRes;
  float aspect = uRes.x / uRes.y;
  vec2 p = vec2(uv.x * aspect, uv.y) * 1.6;
  float t = uTime * 0.05;
  vec2 flow = vec2(fbm(p + vec2(0.0, t)), fbm(p + vec2(5.2, 1.3) - vec2(t, 0.0)));
  vec2 away = (screen - uPointer) * vec2(aspect, 1.0);
  float swirl = uPointerOn * exp(-dot(away, away) * 10.0);
  flow += swirl * vec2(-away.y, away.x) * 4.0;
  float thickness = fbm(p + 1.8 * flow + vec2(t * 0.5, -t * 0.3));
  vec3 bands = 0.5 + 0.5 * cos(6.2832 * (thickness * 2.2 + vec3(0.0, 0.33, 0.67)));
  float total = bands.r + bands.g + bands.b;
  vec3 color = (uColor[0] * bands.r + uColor[1] * bands.g + uColor[2] * bands.b) / max(total, 0.001);
  float sheen = pow(bands.r * bands.g * bands.b * 2.0, 2.0) * (1.0 - 0.6 * uLight);
  color = min(color + sheen, vec3(1.0));
  float alpha = 0.78 + 0.12 * sheen;
  gl_FragColor = vec4(color * alpha, alpha);
}`, { scale: 0.5, dynamics: 'sheet' });
