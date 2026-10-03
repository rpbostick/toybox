// Ripple tank. The WebGL wave simulation (float-texture height field, drop/update/render
// shaders, the specular highlight and refraction of the background) is from jquery.ripples by
// Pim Schreurs (sirxemic), Copyright (c) 2014 Pim Schreurs, MIT licence. Changed: no jQuery
// (the plugin wrapper, CSS background lookup and window resize binding are gone; the toy owns
// its canvas and draws its own pool floor), pointer events instead of mouse and touch
// handlers, and an optional rain of small drops.
import { toyMeta } from '../catalog.js';
import { defineToy } from '../runtime.js';

const RESOLUTION = 256;
const DROP_RADIUS = 20;
const PERTURBANCE = 0.04;

const VERTEX = `
attribute vec2 vertex;
varying vec2 coord;
void main() {
  coord = vertex * 0.5 + 0.5;
  gl_Position = vec4(vertex, 0.0, 1.0);
}`;

const DROP = `
precision highp float;
const float PI = 3.141592653589793;
uniform sampler2D texture;
uniform vec2 center;
uniform float radius;
uniform float strength;
varying vec2 coord;
void main() {
  vec4 info = texture2D(texture, coord);
  float drop = max(0.0, 1.0 - length(center * 0.5 + 0.5 - coord) / radius);
  drop = 0.5 - cos(drop * PI) * 0.5;
  info.r += drop * strength;
  gl_FragColor = info;
}`;

const UPDATE = `
precision highp float;
uniform sampler2D texture;
uniform vec2 delta;
varying vec2 coord;
void main() {
  vec4 info = texture2D(texture, coord);
  vec2 dx = vec2(delta.x, 0.0);
  vec2 dy = vec2(0.0, delta.y);
  float average = (
    texture2D(texture, coord - dx).r +
    texture2D(texture, coord - dy).r +
    texture2D(texture, coord + dx).r +
    texture2D(texture, coord + dy).r
  ) * 0.25;
  info.g += (average - info.r) * 2.0;
  info.g *= 0.995;
  info.r += info.g;
  gl_FragColor = info;
}`;

const RENDER_VERTEX = `
precision highp float;
attribute vec2 vertex;
uniform vec2 topLeft;
uniform vec2 bottomRight;
uniform vec2 containerRatio;
varying vec2 ripplesCoord;
varying vec2 backgroundCoord;
void main() {
  backgroundCoord = mix(topLeft, bottomRight, vertex * 0.5 + 0.5);
  backgroundCoord.y = 1.0 - backgroundCoord.y;
  ripplesCoord = vec2(vertex.x, -vertex.y) * containerRatio * 0.5 + 0.5;
  gl_Position = vec4(vertex.x, -vertex.y, 0.0, 1.0);
}`;

const RENDER = `
precision highp float;
uniform sampler2D samplerBackground;
uniform sampler2D samplerRipples;
uniform vec2 delta;
uniform float perturbance;
varying vec2 ripplesCoord;
varying vec2 backgroundCoord;
void main() {
  float height = texture2D(samplerRipples, ripplesCoord).r;
  float heightX = texture2D(samplerRipples, vec2(ripplesCoord.x + delta.x, ripplesCoord.y)).r;
  float heightY = texture2D(samplerRipples, vec2(ripplesCoord.x, ripplesCoord.y + delta.y)).r;
  vec3 dx = vec3(delta.x, heightX - height, 0.0);
  vec3 dy = vec3(0.0, heightY - height, delta.y);
  vec2 offset = -normalize(cross(dy, dx)).xz;
  float specular = pow(max(0.0, dot(offset, normalize(vec2(-0.6, 1.0)))), 4.0);
  gl_FragColor = texture2D(samplerBackground, backgroundCoord + offset * perturbance) + specular;
}`;

/** Picks a float texture type the GPU can render to (loadConfig in jquery.ripples). */
function textureConfig(gl) {
  const extensions = {};
  for (const name of ['OES_texture_float', 'OES_texture_half_float', 'OES_texture_float_linear', 'OES_texture_half_float_linear']) {
    const extension = gl.getExtension(name);
    if (extension) extensions[name] = extension;
  }
  if (!extensions.OES_texture_float) return null;
  const configs = [{ type: gl.FLOAT, arrayType: Float32Array, linearSupport: 'OES_texture_float_linear' in extensions }];
  if (extensions.OES_texture_half_float) {
    configs.push({ type: extensions.OES_texture_half_float.HALF_FLOAT_OES, arrayType: null, linearSupport: 'OES_texture_half_float_linear' in extensions });
  }
  const texture = gl.createTexture();
  const framebuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  let chosen = null;
  for (const config of configs) {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 32, 32, 0, gl.RGBA, config.type, null);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE) {
      chosen = config;
      break;
    }
  }
  gl.deleteTexture(texture);
  gl.deleteFramebuffer(framebuffer);
  return chosen;
}

function createProgram(gl, vertexSource, fragmentSource) {
  const compile = (type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(`ripples shader: ${gl.getShaderInfoLog(shader)}`);
    return shader;
  };
  const id = gl.createProgram();
  gl.attachShader(id, compile(gl.VERTEX_SHADER, vertexSource));
  gl.attachShader(id, compile(gl.FRAGMENT_SHADER, fragmentSource));
  gl.linkProgram(id);
  if (!gl.getProgramParameter(id, gl.LINK_STATUS)) throw new Error(`ripples program: ${gl.getProgramInfoLog(id)}`);
  const locations = {};
  const pattern = /uniform (\w+) (\w+)/g;
  for (const match of (vertexSource + fragmentSource).matchAll(pattern)) locations[match[2]] = gl.getUniformLocation(id, match[2]);
  gl.useProgram(id);
  gl.enableVertexAttribArray(0);
  return { id, locations };
}

/** A pool floor: deep-to-shallow water, soft caustic bands and a few pebbles. */
function paintPoolFloor(ctx) {
  const floor = ctx.element('canvas', { width: 512, height: 512 });
  const g = floor.getContext('2d');
  const dark = ctx.theme === 'dark';
  const water = g.createLinearGradient(0, 0, 0, 512);
  water.addColorStop(0, dark ? '#0b2a3a' : '#5fb3c9');
  water.addColorStop(1, dark ? '#05141d' : '#2f7f9a');
  g.fillStyle = water;
  g.fillRect(0, 0, 512, 512);
  g.globalAlpha = dark ? 0.08 : 0.15;
  g.strokeStyle = '#ffffff';
  g.lineWidth = 6;
  for (let i = 0; i < 18; i += 1) {
    g.beginPath();
    const y = (i / 18) * 560 - 20;
    g.moveTo(0, y);
    for (let x = 0; x <= 512; x += 32) g.lineTo(x, y + Math.sin(x / 40 + i) * 12);
    g.stroke();
  }
  g.globalAlpha = 1;
  const pebbles = [[90, 380, 26, '#c8b89a'], [140, 410, 18, '#a89880'], [380, 120, 22, '#d8cbb0'], [420, 160, 14, '#9a8a72'], [300, 430, 30, '#bfae90']];
  for (const [x, y, r, colour] of pebbles) {
    g.fillStyle = dark ? '#3a3a3a' : colour;
    g.beginPath();
    g.ellipse(x, y, r, r * 0.7, 0.3, 0, Math.PI * 2);
    g.fill();
  }
  return floor;
}

export default defineToy(toyMeta('ripple-tank'), (ctx) => {
  const surface = ctx.canvas({ context: null });
  const gl = surface.canvas.getContext('webgl', { premultipliedAlpha: false }) ?? surface.canvas.getContext('experimental-webgl');
  const config = gl ? textureConfig(gl) : null;
  if (!config) {
    ctx.add(ctx.element('p', { className: 'toy-message', textContent: 'This toy needs WebGL with float textures, which this browser does not offer.' }));
    ctx.onFrame(() => {});
    return { reset() {} };
  }
  if (config.linearSupport) gl.getExtension(config.type === gl.FLOAT ? 'OES_texture_float_linear' : 'OES_texture_half_float_linear');

  const textureDelta = new Float32Array([1 / RESOLUTION, 1 / RESOLUTION]);
  const textures = [];
  const framebuffers = [];
  let writeIndex = 0;
  let readIndex = 1;
  let raining = false;
  let rainClock = 0;

  function initBuffers() {
    const data = config.arrayType ? new config.arrayType(RESOLUTION * RESOLUTION * 4) : null;
    for (let i = 0; i < 2; i += 1) {
      const texture = textures[i] ?? gl.createTexture();
      const framebuffer = framebuffers[i] ?? gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      const filter = config.linearSupport ? gl.LINEAR : gl.NEAREST;
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, RESOLUTION, RESOLUTION, 0, gl.RGBA, config.type, data);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
      textures[i] = texture;
      framebuffers[i] = framebuffer;
    }
  }
  initBuffers();

  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, +1, -1, +1, +1, -1, +1]), gl.STATIC_DRAW);

  const dropProgram = createProgram(gl, VERTEX, DROP);
  const updateProgram = createProgram(gl, VERTEX, UPDATE);
  gl.uniform2fv(updateProgram.locations.delta, textureDelta);
  const renderProgram = createProgram(gl, RENDER_VERTEX, RENDER);
  gl.uniform2fv(renderProgram.locations.delta, textureDelta);

  const backgroundTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, backgroundTexture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, paintPoolFloor(ctx));
  gl.clearColor(0, 0, 0, 0);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  const bindTexture = (texture, unit = 0) => {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, texture);
  };
  const drawQuad = () => {
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
  };
  const swap = () => { writeIndex = 1 - writeIndex; readIndex = 1 - readIndex; };

  function drop(x, y, radius, strength) {
    const longestSide = Math.max(surface.width, surface.height);
    gl.viewport(0, 0, RESOLUTION, RESOLUTION);
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffers[writeIndex]);
    bindTexture(textures[readIndex]);
    gl.useProgram(dropProgram.id);
    gl.uniform2fv(dropProgram.locations.center, new Float32Array([(2 * x - surface.width) / longestSide, (surface.height - 2 * y) / longestSide]));
    gl.uniform1f(dropProgram.locations.radius, radius / longestSide);
    gl.uniform1f(dropProgram.locations.strength, strength);
    drawQuad();
    swap();
  }

  function update() {
    gl.viewport(0, 0, RESOLUTION, RESOLUTION);
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffers[writeIndex]);
    bindTexture(textures[readIndex]);
    gl.useProgram(updateProgram.id);
    drawQuad();
    swap();
  }

  function render() {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, surface.canvas.width, surface.canvas.height);
    gl.enable(gl.BLEND);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(renderProgram.id);
    bindTexture(backgroundTexture, 0);
    bindTexture(textures[0], 1);
    const maxSide = Math.max(surface.canvas.width, surface.canvas.height);
    gl.uniform1f(renderProgram.locations.perturbance, PERTURBANCE);
    gl.uniform2fv(renderProgram.locations.topLeft, new Float32Array([0, 0]));
    gl.uniform2fv(renderProgram.locations.bottomRight, new Float32Array([1, 1]));
    gl.uniform2fv(renderProgram.locations.containerRatio, new Float32Array([surface.canvas.width / maxSide, surface.canvas.height / maxSide]));
    gl.uniform1i(renderProgram.locations.samplerBackground, 0);
    gl.uniform1i(renderProgram.locations.samplerRipples, 1);
    drawQuad();
    gl.disable(gl.BLEND);
  }

  ctx.drag(surface.canvas, {
    down({ x, y }) { drop(x, y, DROP_RADIUS * 1.5, 0.14); ctx.redraw(); },
    move({ x, y }) { if (ctx.running) drop(x, y, DROP_RADIUS, 0.01); },
  });
  ctx.controls([
    { label: 'Rain', onClick(button) { raining = !raining; button.textContent = raining ? 'Stop rain' : 'Rain'; } },
  ]);

  ctx.onFrame((dt) => {
    if (dt > 0) {
      if (raining) {
        rainClock += dt;
        while (rainClock > 0.15) {
          rainClock -= 0.15;
          drop(Math.random() * surface.width, Math.random() * surface.height, 6 + Math.random() * 6, 0.04);
        }
      }
      // The simulation is tuned to one update per 60 Hz frame.
      const updates = Math.max(1, Math.round(dt * 60));
      for (let i = 0; i < updates; i += 1) update();
    }
    render();
  });

  return {
    reset() {
      initBuffers();
      writeIndex = 0;
      readIndex = 1;
    },
    // Frees the GPU memory now rather than whenever the canvas is collected.
    destroy() {
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };
});
