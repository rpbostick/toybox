// A background drawn by one fragment shader over the whole layer, in plain WebGL 1: one
// triangle that covers the canvas, and the uniforms every shader here reads:
//   uRes (canvas pixels), uTime (seconds), uPointer (0–1, y up: the dragged or coasting
//   pointer), uPointerOn (0–1, eased), uColor[3] (the look's three colours, 0–1), uLight (1 on
//   the light theme, 0 on dark), and the drag dynamics (motion.js) below PRELUDE's uniforms.
// The shader returns premultiplied colour with alpha, so the page colour under the layer shows
// through wherever the effect is faint.
//
// Two kinds of dynamics (shaderBackground's `dynamics`):
//   'sheet'  the sampling coordinates follow the sheet: shifted with a falloff from the dragged
//            point and turned a little about the middle (sheetFrag()); for aurora, film, plasma
//   'field'  the sheet's shift without the twist, plus the ripple field (a spring mesh on the
//            CPU, its offsets uploaded as a small texture each frame it moves) and the turn of
//            the ball (uTurn, uCurve); for the grid ripples
//
// hash12 below is "Hash without Sine" by David Hoskins (MIT; https://www.shadertoy.com/view/4djSRW,
// licence in THIRD_PARTY_LICENSES); the value noise and fbm around it are written here.
import { wrap } from '@rpbostick/reactbits-kit/modules/sphereSpin';
import { CURVE_PX, RIPPLE_LIMIT_PX } from '../motion.js';
import { easedPointer, frameLoop, makeCanvas } from './surface.js';

const VERTEX = `
attribute vec2 aPosition;
void main() { gl_Position = vec4(aPosition, 0.0, 1.0); }`;

export const PRELUDE = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uPointer;
uniform float uPointerOn;
uniform vec3 uColor[3];
uniform float uLight;
// The sheet: its shift at the dragged point and that point (canvas px, y up), the distance at
// which a point follows uSheetFar of the shift, and its twist about the middle (radians).
uniform vec2 uSheet;
uniform vec2 uSheetCenter;
uniform float uSheetReach;
uniform float uSheetFar;
uniform float uSheetAngle;
// The ripple field: offsets at grid points uFieldGap CSS px apart, uFieldSize of them, each byte
// 128 ± 127 for ± uFieldLimit CSS px; uFieldOn is 0 while it is at rest.
uniform sampler2D uField;
uniform vec2 uFieldSize;
uniform float uFieldGap;
uniform float uFieldLimit;
uniform float uFieldOn;
// The ball: canvas px per CSS px, its turn in CSS px, and how its inside bends (0 = flat).
uniform float uRatio;
uniform vec2 uTurn;
uniform float uCurve;

// Where this pixel reads the pattern once the sheet has moved (canvas px, y up): the shift falls
// off from the dragged point, and the field turns a little about the middle.
vec2 sheetFrag() {
  vec2 frag = gl_FragCoord.xy;
  vec2 fromCenter = (frag - uSheetCenter) / uSheetReach;
  float weight = pow(uSheetFar, dot(fromCenter, fromCenter));
  vec2 middle = 0.5 * uRes;
  vec2 offset = frag - middle;
  float angle = uSheetAngle * weight;
  offset = vec2(cos(angle) * offset.x - sin(angle) * offset.y, sin(angle) * offset.x + cos(angle) * offset.y);
  return middle + offset - uSheet * weight;
}

// The ripple field's offset at a point (CSS px, y down).
vec2 fieldAt(vec2 css) {
  vec2 cell = css / uFieldGap + 0.5;
  vec2 bytes = texture2D(uField, cell / uFieldSize).ra * 255.0;
  return uFieldOn * (bytes - 128.0) / 127.0 * uFieldLimit;
}

// Where a point (CSS px, y down) looks on the inside of the turning ball, as SphereSpin's
// curved() and sample() do.
vec2 onBall(vec2 css) {
  vec2 middle = 0.5 * uRes / uRatio;
  vec2 offset = css - middle;
  float r = length(offset);
  if (uCurve > 0.0 && r > 0.0) offset *= uCurve * atan(r / uCurve) / r;
  return middle + offset - uTurn;
}

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float noise(vec2 p) {
  vec2 cell = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(cell), hash12(cell + vec2(1.0, 0.0)), u.x),
             mix(hash12(cell + vec2(0.0, 1.0)), hash12(cell + vec2(1.0, 1.0)), u.x), u.y);
}

float fbm(vec2 p) {
  float sum = 0.0;
  float amp = 0.5;
  mat2 turn = mat2(0.8, 0.6, -0.6, 0.8);
  for (int octave = 0; octave < 5; octave++) {
    sum += amp * noise(p);
    p = turn * p * 2.03;
    amp *= 0.5;
  }
  return sum;
}

// The three colours round a loop: 0 → first, 1/3 → second, 2/3 → third, 1 → first again.
vec3 ramp(float t) {
  float k = fract(t) * 3.0;
  if (k < 1.0) return mix(uColor[0], uColor[1], k);
  if (k < 2.0) return mix(uColor[1], uColor[2], k - 1.0);
  return mix(uColor[2], uColor[0], k - 2.0);
}
`;

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(`a background shader did not compile: ${gl.getShaderInfoLog(shader)}`);
  return shader;
}

function link(gl, fragment) {
  const program = gl.createProgram();
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, PRELUDE + fragment));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(`a background shader did not link: ${gl.getProgramInfoLog(program)}`);
  return program;
}

const UNIFORMS = ['uRes', 'uTime', 'uPointer', 'uPointerOn', 'uColor', 'uLight', 'uSheet', 'uSheetCenter', 'uSheetReach', 'uSheetFar', 'uSheetAngle',
  'uField', 'uFieldSize', 'uFieldGap', 'uFieldLimit', 'uFieldOn', 'uRatio', 'uTurn', 'uCurve'];

// The ripple field's mesh for a shader background: coarser than a line background's, since the
// shader interpolates between its points.
export const FIELD_GAP_PX = 24;

/** Grid points FIELD_GAP_PX apart over a width × height view, as lines (columns) of { x, y, wave }. */
export function fieldGrid(width, height) {
  const columns = Math.ceil(width / FIELD_GAP_PX) + 1;
  const rows = Math.ceil(height / FIELD_GAP_PX) + 1;
  return Array.from({ length: columns }, (_, column) => Array.from({ length: rows }, (_, row) => ({ x: column * FIELD_GAP_PX, y: row * FIELD_GAP_PX, wave: { x: 0, y: 0 } })));
}

/** The field's offsets as LUMINANCE_ALPHA bytes, texel (column, row) = 128 ± 127 for ± limit px. */
export function fieldBytes(offsets, columns, rows, limit, bytes = new Uint8Array(columns * rows * 2)) {
  const byte = (value) => Math.round(128 + 127 * Math.max(-1, Math.min(1, value / limit)));
  for (let column = 0; column < columns; column++) {
    for (let row = 0; row < rows; row++) {
      const k = column * rows + row;
      const texel = (row * columns + column) * 2;
      bytes[texel] = byte(offsets.x[k]);
      bytes[texel + 1] = byte(offsets.y[k]);
    }
  }
  return bytes;
}

/**
 * The ripple field's texture and the ball's uniforms for a 'field' background: each frame the
 * field moves, its offsets at FIELD_GAP_PX grid points go up as bytes (WebGL 1 has no float
 * textures everywhere; 1.1 px a step is finer than the lines it bends), interpolated between.
 */
function fieldTexture(gl, where) {
  const texture = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  // A row of an odd number of columns is not a multiple of 4 bytes.
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE_ALPHA, 1, 1, 0, gl.LUMINANCE_ALPHA, gl.UNSIGNED_BYTE, new Uint8Array([128, 128]));
  gl.uniform1i(where.uField, 0);
  gl.uniform1f(where.uFieldGap, FIELD_GAP_PX);
  gl.uniform1f(where.uFieldLimit, RIPPLE_LIMIT_PX);
  gl.uniform2f(where.uFieldSize, 1, 1);
  let grid = null;
  let bytes = null;
  let size = '';
  return {
    draw(motion, width, height, now) {
      if (size !== `${width}×${height}`) {
        size = `${width}×${height}`;
        grid = fieldGrid(width, height);
        bytes = new Uint8Array(grid.length * grid[0].length * 2);
      }
      const offsets = motion.ripple(grid, now);
      gl.uniform1f(where.uFieldOn, offsets ? 1 : 0);
      if (offsets) {
        const columns = grid.length;
        const rows = grid[0].length;
        fieldBytes(offsets, columns, rows, RIPPLE_LIMIT_PX, bytes);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE_ALPHA, columns, rows, 0, gl.LUMINANCE_ALPHA, gl.UNSIGNED_BYTE, bytes);
        gl.uniform2f(where.uFieldSize, columns, rows);
      }
      const turn = motion.spin(now);
      gl.uniform2f(where.uTurn, wrap(turn.x, turn.period), wrap(turn.y, turn.period));
      gl.uniform1f(where.uCurve, motion.options.spin ? CURVE_PX : 0);
    },
    destroy() {
      gl.deleteTexture(texture);
    },
  };
}

/**
 * A background definition from a fragment shader's body (after PRELUDE). scale draws at a
 * fraction of the screen's pixels, for soft effects that do not need every one. dynamics:
 * 'sheet' or 'field' (above).
 */
export function shaderBackground(fragment, { scale = 1, maxRatio = 2, dynamics }) {
  if (dynamics !== 'sheet' && dynamics !== 'field') throw new Error(`shaderBackground: dynamics must be 'sheet' or 'field', not ${JSON.stringify(dynamics)}`);
  return {
    dynamics: dynamics === 'field' ? ['momentum', 'ripple', 'sheet', 'spin'] : ['momentum', 'sheet'],
    mount(el, api) {
      const win = el.ownerDocument.defaultView;
      const { motion } = api;
      if (!motion) throw new Error('a built-in background is mounted with api.motion');
      const surface = makeCanvas(el, { scale, maxRatio });
      const gl = surface.canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' });
      if (!gl) {
        surface.canvas.remove();
        throw new Error('this browser has no WebGL');
      }
      const program = link(gl, fragment);
      gl.useProgram(program);
      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const position = gl.getAttribLocation(program, 'aPosition');
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      const where = Object.fromEntries(UNIFORMS.map((name) => [name, gl.getUniformLocation(program, name)]));
      const field = dynamics === 'field' ? fieldTexture(gl, where) : null;
      const pointer = easedPointer(el);
      let colors = api.colors;

      const draw = (seconds) => {
        surface.fit();
        const { canvas } = surface;
        const width = Math.max(1, el.clientWidth);
        const height = Math.max(1, el.clientHeight);
        const ratio = canvas.width / width;
        const now = win.performance.now();
        gl.viewport(0, 0, canvas.width, canvas.height);
        pointer.set(motion.pointer(now));
        const at = pointer.step();
        gl.uniform2f(where.uRes, canvas.width, canvas.height);
        gl.uniform1f(where.uTime, seconds);
        gl.uniform2f(where.uPointer, at.x / width, 1 - at.y / height);
        gl.uniform1f(where.uPointerOn, at.on);
        gl.uniform3fv(where.uColor, colors.rgb.flat());
        gl.uniform1f(where.uLight, colors.theme === 'light' ? 1 : 0);
        const sheet = motion.sheet(now);
        gl.uniform2f(where.uSheet, sheet.x * ratio, -sheet.y * ratio);
        gl.uniform2f(where.uSheetCenter, sheet.centerX * ratio, canvas.height - sheet.centerY * ratio);
        gl.uniform1f(where.uSheetReach, sheet.reach * ratio);
        gl.uniform1f(where.uSheetFar, sheet.farWeight);
        gl.uniform1f(where.uSheetAngle, dynamics === 'sheet' ? sheet.angle : 0);
        gl.uniform1f(where.uRatio, ratio);
        if (field) field.draw(motion, width, height, now);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      };
      const loop = frameLoop(win, draw);
      const resized = new win.ResizeObserver(() => loop.redraw());
      resized.observe(el);
      loop.redraw();
      loop.resume();
      return {
        setColors(next) {
          colors = next;
          loop.redraw();
        },
        pause: () => loop.pause(),
        resume: () => loop.resume(),
        destroy() {
          loop.pause();
          resized.disconnect();
          field?.destroy();
          gl.deleteBuffer(buffer);
          gl.deleteProgram(program);
          gl.getExtension('WEBGL_lose_context')?.loseContext();
          surface.canvas.remove();
        },
      };
    },
  };
}
