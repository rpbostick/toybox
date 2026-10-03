// The colour under a point of a drawing surface, for the eyedropper where the browser has no
// EyeDropper API (Firefox, Safari). The visible stack is composited from the top down until it
// is opaque:
//   1. the strokes: the topmost stroke whose line passes within its half width of the point, in
//      its own colour (a highlighter at its opacity), so a pick gives back the exact pen colour
//      rather than an anti-aliased edge;
//   2. the pictures on a drawing page or in the image editor: their pixel, drawn into a canvas;
//   3. the host content under the layer, element by element down the hit-test stack: an <img>
//      or <canvas> gives its pixel; any other element its computed background-color.
// Not sampled: text and borders (only backgrounds), CSS background images and gradients,
// <video>, <svg> content of the page, an <img> from another origin without CORS (the canvas is
// tainted, so its background-color is used instead), and a WebGL canvas without
// preserveDrawingBuffer (it reads as transparent).
import { HIGHLIGHT_OPACITY, strokeTouched } from './strokes.js';
import { toUnits } from './ink.js';

// Deliberate: the browser paints a page with no background on white (the light colour scheme's
// canvas), so a stack that stays see-through to the bottom is composited onto white.
const CANVAS_WHITE = [255, 255, 255, 1];
const TRANSPARENT = [0, 0, 0, 0];

/** [r, g, b, a] (0–255, alpha 0–1) as #rrggbb. */
export function hexOf([r, g, b]) {
  return `#${[r, g, b].map((channel) => Math.round(channel).toString(16).padStart(2, '0')).join('')}`;
}

/** `top` drawn over `bottom` (source-over). */
export function over(top, bottom) {
  const alpha = top[3] + bottom[3] * (1 - top[3]);
  if (alpha === 0) return TRANSPARENT;
  const mix = (i) => (top[i] * top[3] + bottom[i] * bottom[3] * (1 - top[3])) / alpha;
  return [mix(0), mix(1), mix(2), alpha];
}

const HEX_COLOR = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const RGB_COLOR = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/i;

/**
 * A computed CSS colour as [r, g, b, a]. Browsers compute background-color to rgb()/rgba() (and
 * happy-dom keeps hex); any other syntax (oklch(), color()) is converted by painting it in a
 * canvas.
 */
export function parseColor(win, text) {
  const value = text.trim();
  // An element with no computed style (not rendered; happy-dom for any unset property) paints nothing.
  if (value === 'transparent' || value === '') return TRANSPARENT;
  const hex = HEX_COLOR.exec(value);
  if (hex) {
    const digits = hex[1].length <= 4 ? [...hex[1]].map((digit) => digit + digit).join('') : hex[1];
    const channels = digits.match(/../g).map((pair) => parseInt(pair, 16));
    return [channels[0], channels[1], channels[2], channels.length === 4 ? channels[3] / 255 : 1];
  }
  const rgb = RGB_COLOR.exec(value);
  if (rgb) {
    const alpha = rgb[4] === undefined ? 1 : rgb[4].endsWith('%') ? parseFloat(rgb[4]) / 100 : Number(rgb[4]);
    return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3]), alpha];
  }
  const context = pixelContext(win);
  context.fillStyle = value;
  context.fillRect(0, 0, 1, 1);
  return pixelOf(context);
}

function pixelContext(win) {
  const canvas = win.document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('the eyedropper needs a 2D canvas, and this browser gave none');
  return context;
}

function pixelOf(context) {
  const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
  return [r, g, b, a / 255];
}

/**
 * The pixel of an <img>, <canvas> or decoded Image at (fx, fy), fractions of its width and height.
 * Throws the browser's SecurityError for a cross-origin image without CORS.
 */
export function readPixel(win, source, fx, fy) {
  const width = source.naturalWidth || source.width;
  const height = source.naturalHeight || source.height;
  if (!width || !height) return TRANSPARENT;
  const sx = Math.min(width - 1, Math.max(0, Math.floor(fx * width)));
  const sy = Math.min(height - 1, Math.max(0, Math.floor(fy * height)));
  const context = pixelContext(win);
  context.drawImage(source, sx, sy, 1, 1, 0, 0, 1, 1);
  return pixelOf(context);
}

export async function loadImage(win, src) {
  const image = new win.Image();
  image.src = src;
  await image.decode();
  return image;
}

/** The strokes under `point` (layer units), composited from the top down, as [r, g, b, a]. */
export function strokesColorAt(strokes, point) {
  const at = { x1: point.x, y1: point.y, x2: point.x, y2: point.y };
  let color = TRANSPARENT;
  for (let i = strokes.length - 1; i >= 0 && color[3] < 1; i--) {
    const stroke = strokes[i];
    if (!strokeTouched(stroke, at, 0)) continue;
    // A saved stroke's colour is #rrggbb (savefile.js), which needs no canvas to read.
    const [r, g, b] = parseColor(null, stroke.color);
    color = over(color, [r, g, b, stroke.tool === 'highlighter' ? HIGHLIGHT_OPACITY : 1]);
  }
  return color;
}

/** The topmost picture under `point` (layer units) and where in it, or null. */
export function pictureAt(images, point) {
  for (let i = images.length - 1; i >= 0; i--) {
    const image = images[i];
    const fx = (point.x - image.x) / image.w;
    const fy = (point.y - image.y) / image.h;
    if (fx >= 0 && fx < 1 && fy >= 0 && fy < 1) return { image, fx, fy };
  }
  return null;
}

const isSecurityError = (error) => error?.name === 'SecurityError';

/** One element of the host's hit-test stack as [r, g, b, a]. */
function elementColor(win, element, x, y, read) {
  const background = parseColor(win, win.getComputedStyle(element).backgroundColor);
  if (element.localName !== 'img' && element.localName !== 'canvas') return background;
  const rect = element.getBoundingClientRect();
  if (!rect.width || !rect.height) return background;
  try {
    return over(read(win, element, (x - rect.left) / rect.width, (y - rect.top) / rect.height), background);
  } catch (error) {
    if (!isSecurityError(error)) throw error;
    return background;
  }
}

/**
 * The colour under client point (x, y) of a drawing surface, as #rrggbb.
 * root: the document or shadow root to hit-test (elementsFromPoint);
 * skip(element): true for the drawing's own layers, which are sampled from their data instead;
 * ink: { svg, strokes }; pictures: { svg, images } or null.
 * read and load replace readPixel and loadImage in a test without a canvas.
 */
export async function sampleColor(win, { x, y, root, skip, ink, pictures = null, read = readPixel, load = loadImage }) {
  let color = strokesColorAt(ink.strokes, toUnits(ink.svg, x, y));
  const under = (layer) => { color = over(color, layer); };
  if (color[3] < 1 && pictures) {
    const hit = pictureAt(pictures.images, toUnits(pictures.svg, x, y));
    if (hit) under(read(win, await load(win, hit.image.src), hit.fx, hit.fy));
  }
  if (color[3] < 1) {
    for (const element of root.elementsFromPoint(x, y)) {
      if (skip(element)) continue;
      under(elementColor(win, element, x, y, read));
      if (color[3] >= 1) break;
    }
  }
  if (color[3] < 1) under(CANVAS_WHITE);
  return hexOf(color);
}
