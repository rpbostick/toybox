// Aurora: three curtains of light hanging across the upper half, each with a bright lower hem
// that fades upward into rays, drifting sideways on fbm noise. The pointer (coasting on after a
// fling) lifts the curtains under it, and a drag pulls them like a sheet. Written for this
// library.
import { shaderBackground } from './shader.js';

export default shaderBackground(`
void main() {
  vec2 screen = gl_FragCoord.xy / uRes;
  vec2 uv = sheetFrag() / uRes;
  float aspect = uRes.x / uRes.y;
  float x = uv.x * aspect;
  float t = uTime * 0.06;
  float lift = uPointerOn * exp(-pow((screen.x - uPointer.x) * aspect * 2.5, 2.0)) * 0.12;
  vec3 light = vec3(0.0);
  float glow = 0.0;
  for (int i = 0; i < 3; i++) {
    float layer = float(i);
    float hem = 0.42 + 0.13 * layer + 0.22 * (fbm(vec2(x * 0.45 + layer * 7.3, t + layer * 1.7)) - 0.5) + lift;
    float above = uv.y - hem;
    // A sharp hem below, a long fade above it.
    float shape = above < 0.0 ? exp(above * 45.0) : exp(-above * (4.5 - layer));
    float rays = 0.55 + 0.45 * noise(vec2(x * 18.0 + layer * 11.0, t * 4.0));
    float strength = shape * rays * (0.75 - 0.15 * layer);
    light += uColor[i] * strength;
    glow += strength;
  }
  float alpha = clamp(glow * 0.75, 0.0, 0.9);
  vec3 color = light / max(glow, 0.001);
  gl_FragColor = vec4(color * alpha, alpha);
}`, { scale: 0.5, dynamics: 'sheet' });
