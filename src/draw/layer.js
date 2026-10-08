// <draw-layer>'s implementation, a chunk of its own: a scribble layer over the element its for="…"
// names, with a Draw button fixed in a corner of the window (or dragged anywhere) that opens the
// pen tool bar, Show scribbles (screen) and Print scribbles (print). The layer is an <svg> 1000
// units across inside an overlay added to the target, so strokes scale with the target's width;
// it is saved in the browser per page.
import { pageKey, remembered } from '../elements/remembered.js';
import { CONTROL_RULES, THEME_RULES } from '../elements/theme.js';
import { DOCK_CSS, createDock } from './button-dock.js';
import { InkLayer, makeSvg } from './ink.js';
import { checkLayerState } from './savefile.js';
import { autosave, load } from './store.js';
import { TOOLBAR_CSS, createToolbar } from './tools.js';

export const UNITS = 1000;

const ELEMENT_CSS = `
  :host { display: block; }
  :host([hidden]) { display: none; }
  ${THEME_RULES}
  ${CONTROL_RULES}
  ${TOOLBAR_CSS}
  ${DOCK_CSS}
  .row { display: flex; flex-wrap: wrap; align-items: center; gap: .3rem .8rem; }
  .savestate { font-size: .75rem; color: var(--soft); }
  @media print { .toybox { display: none !important; } }`;

// The overlay's own shadow-root styles: on top of the target's content, drawing only while Draw
// is on, hidden on screen by Show scribbles and in print by Print scribbles, separately.
export const OVERLAY_CSS = `
  :host { position: absolute; inset: 0; z-index: 2147480000; pointer-events: none; overflow: hidden; }
  :host([data-drawing="1"]) { pointer-events: auto; cursor: crosshair; touch-action: none; }
  svg { display: block; width: 100%; height: 100%; }
  @media screen { :host([data-show="0"]) svg { visibility: hidden; } }
  @media print { :host([data-print="0"]) { display: none !important; } }`;

const typing = (node) => node?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(node?.tagName ?? '');

export function mount(host, wrapper) {
  const doc = host.ownerDocument;
  const win = doc.defaultView;
  const target = host.target;
  const key = pageKey(win, host.toyboxKey);
  wrapper.querySelector('style').textContent = ELEMENT_CSS;
  const abort = new AbortController();
  const on = (node, type, handler, options = {}) => node.addEventListener(type, handler, { ...options, signal: abort.signal });

  // ---- the overlay over the target ----
  const overlay = doc.createElement('div');
  overlay.setAttribute('data-toybox-ink', host.toyboxKey);
  const shadow = overlay.attachShadow({ mode: 'open' });
  shadow.innerHTML = `<style>${OVERLAY_CSS}</style>`;
  const svg = makeSvg(doc, 'ink', `0 0 ${UNITS} ${UNITS}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  shadow.append(svg);
  // An element not laid out (yet) has no computed position; it is static until styled otherwise.
  const position = win.getComputedStyle(target).position;
  const positioned = Boolean(position) && position !== 'static';
  const oldPosition = target.style.position;
  if (!positioned) target.style.position = 'relative';
  target.append(overlay);
  const fit = () => {
    const { width, height } = target.getBoundingClientRect();
    if (width > 0 && height > 0) svg.setAttribute('viewBox', `0 0 ${UNITS} ${((UNITS * height) / width).toFixed(2)}`);
  };
  const resizeObserver = new win.ResizeObserver(fit);
  resizeObserver.observe(target);
  fit();

  // ---- the tool bar, Show and Print scribbles ----
  let loaded = false;
  const saveState = wrapper.ownerDocument.createElement('span');
  saveState.className = 'savestate';
  saveState.setAttribute('aria-live', 'polite');
  const saver = autosave(win, key, () => ({ strokes: ink.dump() }), (text) => { saveState.textContent = text; });
  const toolbar = createToolbar(doc, {
    toggleLabel: host.label,
    onDraw: (drawing) => {
      overlay.dataset.drawing = drawing ? '1' : '0';
      dock.setDrawing(drawing);
    },
    onUndo: () => ink.undo(), onRedo: () => ink.redo(), onClear: () => ink.clear(),
  });
  const ink = new InkLayer(svg, {
    name: host.toyboxKey, brush: toolbar.brush,
    onChange: () => {
      if (loaded) saver.changed();
      host.dispatchEvent(new win.CustomEvent('ink-change', { detail: { strokes: ink.count }, bubbles: true, composed: true }));
    },
  });
  const choices = doc.createElement('span');
  choices.className = 'row';
  choices.innerHTML = `<label class="check"><input type="checkbox" class="show"> Show scribbles</label>
    <label class="check"><input type="checkbox" class="print"> Print scribbles</label>`;
  const dock = createDock(doc, {
    toggle: toolbar.toggle, body: [toolbar.el, choices, saveState],
    store: remembered(win, `draw-layer.place.${key}`), corner: host.corner,
  });
  wrapper.append(dock.el);
  // toggles-scope="browser": one Show and one Print choice for every layer on every page.
  const togglesKey = host.togglesScope === 'browser' ? 'browser' : key;
  const showStore = remembered(win, `draw-layer.show.${togglesKey}`);
  const printStore = remembered(win, `draw-layer.print.${togglesKey}`);
  const showBox = choices.querySelector('.show');
  const printBox = choices.querySelector('.print');
  function setShow(shown) {
    showBox.checked = shown;
    overlay.dataset.show = shown ? '1' : '0';
  }
  function setPrint(printed) {
    printBox.checked = printed;
    overlay.dataset.print = printed ? '1' : '0';
  }
  on(showBox, 'change', () => { setShow(showBox.checked); showStore.write(showBox.checked ? '1' : '0'); });
  on(printBox, 'change', () => { setPrint(printBox.checked); printStore.write(printBox.checked ? '1' : '0'); });
  setShow(showStore.read() !== '0');
  setPrint(printStore.read() !== '0');
  overlay.dataset.drawing = '0';

  // Ctrl+Z and Ctrl+Shift+Z (or Ctrl+Y) undo and redo while drawing.
  on(doc, 'keydown', (event) => {
    if (!toolbar.drawing || typing(event.target)) return;
    const mod = event.ctrlKey || event.metaKey;
    const letter = event.key.toLowerCase();
    if (mod && letter === 'z') {
      event.preventDefault();
      if (event.shiftKey) ink.redo();
      else ink.undo();
    } else if (mod && letter === 'y') {
      event.preventDefault();
      ink.redo();
    }
  });

  // What was drawn before; autosave stays off until it has loaded, and off for good when it
  // could not be read or fails its check, so a damaged copy is not overwritten before it can be
  // looked at. The catch comes after the check so a failed check reaches it too.
  const restored = load(key).then((saved) => {
    if (saved !== undefined) ink.load(checkLayerState(saved, `saved scribbles for ${host.toyboxKey}`).strokes);
    loaded = true;
  }).catch((error) => {
    saveState.textContent = `Saved scribbles could not be read (${error.message}); autosave is off.`;
    throw error;
  });
  restored.catch(() => {}); // shown in the save state above; restored() hands the error on

  return {
    restored: () => restored,
    strokes: () => ink.dump(),
    clear: () => ink.clear(),
    setDraw: (drawing) => toolbar.setDraw(drawing),
    setShow,
    setPrint,
    overlay: () => overlay,
    flush: () => saver.flush(),
    saveState: () => ({ strokes: ink.dump() }),
    checkState: (state) => checkLayerState(state, host.toyboxKey),
    loadState(state) {
      ink.load(checkLayerState(state, host.toyboxKey).strokes);
      loaded = true;
      saver.changed();
    },
    destroy() {
      saver.flush();
      abort.abort();
      toolbar.destroy();
      ink.destroy();
      resizeObserver.disconnect();
      overlay.remove();
      if (!positioned) target.style.position = oldPosition;
      dock.destroy();
      dock.el.remove();
    },
    attributeChanged(name) {
      if (name === 'corner') dock.setCorner(host.corner);
      else if (name === 'label') toolbar.setToggleLabel(host.label);
    },
    place: () => dock.place(),
  };
}
