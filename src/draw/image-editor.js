// toybox.editImage(element, options): a full-window editor for any image box on the page. Its
// frame has the box's shape (notched corners with options.notch); pictures move and scale under
// the frame, strokes go over them, and Done renders the frame into the box (an <img>'s src, or
// any other element's background image). The pictures and strokes are kept per box, so opening
// it again loses nothing; options.state reopens a box from what Done gave before.
import { CONTROL_RULES, THEME_RULES } from '../elements/theme.js';
import { PALETTES } from '../runtime.js';
import { InkLayer, makeSvg } from './ink.js';
import { PictureLayer, canvasBlob, canvasDataURL, imageFileFrom, readPicture, renderToCanvas } from './pictures.js';
import { checkImages, checkStrokes } from './savefile.js';
import { TOOLBAR_CSS, createToolbar } from './tools.js';

const UNITS = 1000;
// The result is rendered at this many pixels per CSS pixel of the box, so it stays sharp in print.
const OUT_SCALE = 3;
const kept = new WeakMap();

/** The box's outline, w × h with n × n notches cut from its corners, as [x, y] corners. */
export function notchedPolygon(w, h, n) {
  if (n <= 0) return [[0, 0], [w, 0], [w, h], [0, h]];
  return [[n, 0], [w - n, 0], [w - n, n], [w, n], [w, h - n], [w - n, h - n], [w - n, h], [n, h], [n, h - n], [0, h - n], [0, n], [n, n]];
}

const EDITOR_CSS = `
  ${THEME_RULES}
  ${CONTROL_RULES}
  ${TOOLBAR_CSS}
  .editor { position: fixed; inset: 0; z-index: 2147483600; display: flex; flex-direction: column; background: rgba(20,18,16,.85); }
  .ebar { display: flex; flex-wrap: wrap; align-items: center; gap: .35rem .6rem; padding: .5rem .8rem; background: var(--card);
    border-bottom: 1px solid var(--soft); }
  .ebar strong { font-weight: 600; }
  .ebar .hint { font-size: .75rem; color: var(--soft); }
  .ebar .file input { display: none; }
  .ebar .done { border-color: var(--accent); }
  .stage { flex: 1; min-height: 0; display: grid; place-items: center; padding: 1rem; }
  .box { position: relative; max-width: 100%; max-height: 100%; height: 100%; }
  .box svg { position: absolute; inset: 0; width: 100%; height: 100%; display: block; touch-action: none; }
  .box svg.dim { pointer-events: none; }
  .box svg.dim path { fill: rgba(0,0,0,.55); }
  .box svg.dim .frame { fill: none; stroke: #fff; stroke-width: 3; vector-effect: non-scaling-stroke; }
  .box.moving svg.ink { pointer-events: none; }
  .pic-outline { fill: none; stroke: #7aa6e0; stroke-width: 3; stroke-dasharray: 8 5; vector-effect: non-scaling-stroke; }
  .pic-handle { fill: #7aa6e0; cursor: nwse-resize; }`;

/**
 * Opens the editor on `element`. Resolves when it closes: null for Cancel, otherwise
 * { src, images, strokes } (src null when the box was emptied).
 */
export function editImage(element, { notch = 0, theme, state } = {}) {
  const doc = element.ownerDocument;
  const win = doc.defaultView;
  const rect = element.getBoundingClientRect();
  if (!rect.width || !rect.height) throw new Error('toybox.editImage: the image box has no size on the page');
  if (state) {
    checkImages(state.images, 'editImage state.images');
    checkStrokes(state.strokes, 'editImage state.strokes');
    kept.set(element, { images: state.images, strokes: state.strokes });
  }
  const W = UNITS;
  const H = Number(((UNITS * rect.height) / rect.width).toFixed(2));
  const N = (notch * UNITS) / rect.width;
  const M = Math.round(W * 0.3);
  const viewBox = `${-M} ${-M} ${W + 2 * M} ${H + 2 * M}`;
  const clip = notchedPolygon(W, H, N);
  const clipPoints = clip.map(([x, y]) => `${x},${y}`).join(' ');
  const frame = { x: 0, y: 0, w: W, h: H };
  const resolvedTheme = theme ?? (win.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  if (!Object.hasOwn(PALETTES, resolvedTheme)) throw new Error(`toybox.editImage: theme "${resolvedTheme}": use light or dark`);

  const host = doc.createElement('div');
  host.setAttribute('data-toybox-image-editor', '');
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `<div class="toybox" data-theme="${resolvedTheme}"><style>${EDITOR_CSS}</style>
    <div class="editor" role="dialog" aria-modal="true" aria-label="Image editor">
      <div class="ebar">
        <strong>Image</strong>
        <span class="hint">Paste (Ctrl+V) or drop a picture, or</span>
        <label class="btn file">Add picture <input type="file" accept="image/*"></label>
        <span class="tools-slot"></span>
        <button type="button" class="btn copy">Copy as PNG</button>
        <button type="button" class="btn delete">Delete picture</button>
        <button type="button" class="btn empty">Remove image</button>
        <button type="button" class="btn cancel">Cancel</button>
        <button type="button" class="btn done">Done</button>
      </div>
      <div class="stage"><div class="box" style="aspect-ratio:${W + 2 * M}/${H + 2 * M}"></div></div>
    </div></div>`;
  const $ = (selector) => shadow.querySelector(selector);
  const box = $('.box');
  const pics = makeSvg(doc, 'pics', viewBox);
  const inkSvg = makeSvg(doc, 'ink', viewBox);
  const dim = makeSvg(doc, 'dim', viewBox);
  dim.innerHTML = `<path fill-rule="evenodd" d="M${-M},${-M}h${W + 2 * M}v${H + 2 * M}h${-(W + 2 * M)}Z M${clipPoints.split(' ').join(' L')}Z"/>`
    + `<polygon class="frame" points="${clipPoints}"/>`;
  box.append(pics, dim, inkSvg);

  const toolbar = createToolbar(doc, {
    tools: ['pen', 'highlighter', 'eraser', 'move'], drawToggle: false,
    onUndo: () => ink.undo(), onRedo: () => ink.redo(), onClear: () => ink.clear(),
  });
  $('.tools-slot').replaceWith(toolbar.el);
  toolbar.el.addEventListener('click', () => box.classList.toggle('moving', toolbar.tool === 'move'));
  const pictures = new PictureLayer(pics, { onChange: () => {}, movable: () => toolbar.tool === 'move' });
  const ink = new InkLayer(inkSvg, { name: 'image', brush: toolbar.brush, onChange: () => {} });
  const previous = kept.get(element);
  pictures.load(previous?.images ?? []);
  ink.load(previous?.strokes ?? []);

  const render = () => renderToCanvas(win, {
    box: frame, width: Math.round(rect.width * OUT_SCALE), height: Math.round(rect.height * OUT_SCALE),
    images: pictures.list(), ink: ink.markup(), clip,
  });
  const addPicture = async (file) => pictures.add(await readPicture(win, file), frame);

  return new Promise((resolve) => {
    const abort = new AbortController();
    const on = (node, type, handler) => node.addEventListener(type, handler, { signal: abort.signal });
    const close = (result) => {
      abort.abort();
      toolbar.destroy();
      ink.destroy();
      pictures.destroy();
      host.remove();
      element.focus?.();
      resolve(result);
    };
    on($('.cancel'), 'click', () => close(null));
    on($('.done'), 'click', async () => {
      const images = pictures.list();
      const strokes = ink.dump();
      const empty = !images.length && !strokes.length;
      const src = empty ? null : canvasDataURL(await render());
      if (element.localName === 'img') {
        if (src) element.src = src;
        else element.removeAttribute('src');
      } else {
        element.style.backgroundImage = src ? `url("${src}")` : '';
        element.style.backgroundSize = src ? '100% 100%' : '';
      }
      kept.set(element, { images, strokes });
      close({ src, images, strokes });
    });
    on($('.copy'), 'click', async () => {
      const png = render().then((canvas) => canvasBlob(canvas, 'image/png'));
      await win.navigator.clipboard.write([new win.ClipboardItem({ 'image/png': png })]);
    });
    on($('.delete'), 'click', () => pictures.removeSelected());
    on($('.empty'), 'click', () => { pictures.load([]); ink.clear(); });
    on($('.file input'), 'change', (event) => {
      const file = event.target.files[0];
      event.target.value = '';
      if (file) addPicture(file);
    });
    on(box, 'dragover', (event) => event.preventDefault());
    on(box, 'drop', (event) => {
      const file = imageFileFrom(event.dataTransfer);
      if (!file) return;
      event.preventDefault();
      addPicture(file);
    });
    on(doc, 'paste', (event) => {
      const file = imageFileFrom(event.clipboardData);
      if (!file) return;
      event.preventDefault();
      addPicture(file);
    });
    on(doc, 'keydown', (event) => { if (event.key === 'Escape') close(null); });
    doc.body.append(host);
    $('.done').focus();
  });
}
