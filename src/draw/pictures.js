// Pasted or dropped pictures on a drawing page or in the image editor: an <svg> of <image>
// elements under the strokes, moved by dragging and scaled by the corner handle or the wheel
// while the Move picture tool is on. Also renders a layer's pictures and strokes to a canvas.
import { SVGNS, toUnits } from './ink.js';

// Pictures are downscaled on arrival to keep a saved file small: 1200 px still covers a full
// page width at about 150 dpi.
const MAX_SIDE = 1200;
const QUALITY = 0.8;
const HANDLE = 16;
let nextId = 1;

const pictureId = () => `img${Date.now().toString(36)}${nextId++}`;

export function imageFileFrom(dataTransfer) {
  if (!dataTransfer) return null;
  return [...dataTransfer.files].find((file) => file.type.startsWith('image/')) ?? null;
}

/** WebP where the browser can encode it (smaller for photos, keeps transparency); PNG otherwise. */
function encode(canvas, quality) {
  const webp = canvas.toDataURL('image/webp', quality);
  return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/png');
}

export async function readPicture(win, file) {
  const bitmap = await win.createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = win.document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return { src: encode(canvas, QUALITY), w: canvas.width, h: canvas.height };
}

const attr = (value) => String(value).replace(/&/g, '&amp;').replace(/'/g, '&#39;').replace(/</g, '&lt;');

export function picturesMarkup(images) {
  return images.map((img) => `<image href='${attr(img.src)}' x="${img.x}" y="${img.y}" width="${img.w}" height="${img.h}" preserveAspectRatio="none"/>`).join('');
}

/**
 * A standalone SVG of pictures and strokes, cut to `box` (in the layer's units), drawn into a
 * canvas of width × height pixels, optionally only inside `clip` ([[x, y], …] in layer units).
 */
export async function renderToCanvas(win, { box, width, height, background, images, ink, clip }) {
  const markup = `<svg xmlns="${SVGNS}" width="${width}" height="${height}" viewBox="${box.x} ${box.y} ${box.w} ${box.h}">`
    + (background ? `<rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" fill="${background}"/>` : '')
    + picturesMarkup(images) + ink + '</svg>';
  const img = new win.Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
  await img.decode();
  const canvas = win.document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (clip) {
    context.beginPath();
    clip.forEach(([x, y]) => context.lineTo(((x - box.x) * width) / box.w, ((y - box.y) * height) / box.h));
    context.closePath();
    context.clip();
  }
  context.drawImage(img, 0, 0, width, height);
  return canvas;
}

export function canvasBlob(canvas, type) {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error(`the browser could not encode ${type}`))), type));
}

export const canvasDataURL = (canvas) => encode(canvas, 0.9);

export class PictureLayer {
  constructor(svg, { onChange, movable }) {
    this.svg = svg;
    this.doc = svg.ownerDocument;
    this.onChange = onChange;
    // movable(): whether the Move picture tool is on.
    this.movable = movable;
    this.images = [];
    this.selected = null;
    this.abort = new AbortController();
    svg.addEventListener('pointerdown', (event) => this.pointerDown(event), { signal: this.abort.signal });
    svg.addEventListener('wheel', (event) => this.wheel(event), { passive: false, signal: this.abort.signal });
  }

  load(images) {
    this.images = images.map((img) => ({ ...img }));
    this.selected = null;
    this.render();
  }

  list() {
    return this.images.map((img) => ({ ...img }));
  }

  /** A new picture fits inside 80 % of `frame` (layer units), centred on it. */
  add({ src, w, h }, frame) {
    const scale = Math.min((frame.w * 0.8) / w, (frame.h * 0.8) / h);
    const img = { id: pictureId(), src, w: w * scale, h: h * scale };
    img.x = frame.x + (frame.w - img.w) / 2;
    img.y = frame.y + (frame.h - img.h) / 2;
    this.images.push(img);
    this.selected = img.id;
    this.render();
    this.onChange();
  }

  removeSelected() {
    if (!this.selected) return false;
    this.images = this.images.filter((img) => img.id !== this.selected);
    this.selected = null;
    this.render();
    this.onChange();
    return true;
  }

  render() {
    this.svg.replaceChildren();
    const place = (node, box) => {
      for (const [key, name] of [['x', 'x'], ['y', 'y'], ['w', 'width'], ['h', 'height']]) node.setAttribute(name, box[key]);
    };
    for (const img of this.images) {
      const node = this.doc.createElementNS(SVGNS, 'image');
      node.setAttribute('href', img.src);
      place(node, img);
      node.setAttribute('preserveAspectRatio', 'none');
      node.dataset.id = img.id;
      this.svg.append(node);
    }
    const sel = this.images.find((img) => img.id === this.selected);
    if (!sel) return;
    const outline = this.doc.createElementNS(SVGNS, 'rect');
    place(outline, sel);
    outline.setAttribute('class', 'pic-outline');
    const handle = this.doc.createElementNS(SVGNS, 'rect');
    place(handle, { x: sel.x + sel.w - HANDLE / 2, y: sel.y + sel.h - HANDLE / 2, w: HANDLE, h: HANDLE });
    handle.setAttribute('class', 'pic-handle');
    handle.dataset.handle = sel.id;
    this.svg.append(outline, handle);
  }

  pointerDown(event) {
    if (!this.movable()) return;
    const target = event.target;
    const id = target.dataset?.handle ?? target.dataset?.id;
    const img = this.images.find((candidate) => candidate.id === id);
    if (!img) {
      if (this.selected) {
        this.selected = null;
        this.render();
      }
      return;
    }
    event.preventDefault();
    this.selected = img.id;
    const resizing = Boolean(target.dataset.handle);
    const start = toUnits(this.svg, event.clientX, event.clientY);
    const from = { ...img };
    const win = this.doc.defaultView;
    const move = (moveEvent) => {
      const at = toUnits(this.svg, moveEvent.clientX, moveEvent.clientY);
      if (resizing) {
        const scale = Math.max(0.05, (from.w + at.x - start.x) / from.w);
        img.w = from.w * scale;
        img.h = from.h * scale;
      } else {
        img.x = from.x + at.x - start.x;
        img.y = from.y + at.y - start.y;
      }
      this.render();
    };
    const up = () => {
      win.removeEventListener('pointermove', move);
      win.removeEventListener('pointerup', up);
      this.onChange();
    };
    win.addEventListener('pointermove', move);
    win.addEventListener('pointerup', up);
    this.render();
  }

  wheel(event) {
    const img = this.images.find((candidate) => candidate.id === this.selected);
    if (!img || !this.movable()) return;
    event.preventDefault();
    const at = toUnits(this.svg, event.clientX, event.clientY);
    const scale = event.deltaY < 0 ? 1.06 : 1 / 1.06;
    img.x = at.x - (at.x - img.x) * scale;
    img.y = at.y - (at.y - img.y) * scale;
    img.w *= scale;
    img.h *= scale;
    this.render();
    this.onChange();
  }

  destroy() {
    this.abort.abort();
  }
}
