// <toy-pages>'s implementation, a chunk of its own: ruled notes pages and blank drawing pages
// that take pasted or dropped pictures, added, removed and reordered, saved in the browser, and
// printed one per sheet after the rest of the page. Every page carries a drawing layer in its
// own units (1000 across); one pen tool bar acts on the page last touched. The bar also holds
// Save file and Open file for everything the page's Toybox elements keep (file.js).
import { pageKey } from '../elements/remembered.js';
import { CONTROL_RULES, THEME_RULES } from '../elements/theme.js';
import { openFile, saveFile } from './file.js';
import { sampleColor } from './eyedropper.js';
import { InkLayer, makeSvg } from './ink.js';
import { PictureLayer, canvasBlob, imageFileFrom, readPicture, renderToCanvas } from './pictures.js';
import { checkPagesState } from './savefile.js';
import { autosave, load } from './store.js';
import { TOOLBAR_CSS, createToolbar } from './tools.js';

export const UNITS = 1000;
// The notes page's ruling, in page units: the gap between lines.
const RULE = 34;

let nextId = 1;
const pageId = () => `page${Date.now().toString(36)}${nextId++}`;

/** The list with the item at `from` moved `step` places, or the same list when that would leave it. */
export function reordered(list, from, step) {
  const to = from + step;
  if (from < 0 || from >= list.length || to < 0 || to >= list.length) return list;
  const out = list.slice();
  const [item] = out.splice(from, 1);
  out.splice(to, 0, item);
  return out;
}

export const PAGES_CSS = `
  :host { display: block; }
  :host([hidden]) { display: none; }
  ${THEME_RULES}
  ${CONTROL_RULES}
  ${TOOLBAR_CSS}
  .bar { display: flex; flex-wrap: wrap; align-items: center; gap: .35rem .6rem; margin-bottom: .6rem; }
  .bar .file input { display: none; }
  .savestate, .toast { font-size: .75rem; color: var(--soft); }
  .pages { display: flex; flex-direction: column; gap: 1.2rem; }
  .pages:empty { display: none; }
  .pagebar { display: flex; flex-wrap: wrap; align-items: center; gap: .3rem; margin-bottom: .3rem; }
  .pagebar .label { flex: 1; font-size: .85rem; color: var(--soft); }
  .pagebar .file input { display: none; }
  .page { position: relative; width: 100%; max-width: 820px; background: #fff; color: #2b2622;
    border: 1px solid var(--faint); box-shadow: 0 2px 10px rgba(0,0,0,.15); overflow: hidden; }
  .page svg { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
  .page svg.ink { pointer-events: none; }
  .pages.drawing .page svg.ink { pointer-events: auto; cursor: crosshair; touch-action: none; }
  .pages.moving .page svg.ink { pointer-events: none; }
  .pages.picking .page svg.ink { pointer-events: auto; cursor: crosshair; }
  .page .pic-outline { fill: none; stroke: #3b6fb5; stroke-width: 2; stroke-dasharray: 6 4; }
  .page .pic-handle { fill: #3b6fb5; cursor: nwse-resize; }
  .notes { position: absolute; inset: 0; display: flex; flex-direction: column; padding: 6% 7%; }
  .notes .title { font: 600 1.3rem/1.3 var(--toybox-font, system-ui, sans-serif); border: 0; border-bottom: 2px solid #2b2622;
    background: transparent; color: inherit; padding: .2rem 0; }
  .notes .text { flex: 1; resize: none; border: 0; background: transparent; color: inherit; padding: 0; margin-top: .4rem;
    font: 1rem/var(--rule) var(--toybox-font, system-ui, sans-serif);
    background-image: repeating-linear-gradient(to bottom, transparent 0 calc(var(--rule) - 1px), #9db4cf calc(var(--rule) - 1px) var(--rule)); }
  @media print {
    .bar, .pagebar, .toast { display: none !important; }
    .page-wrap { break-before: page; break-inside: avoid; }
    .page { max-width: none; border: 0; box-shadow: none; }
    .page .pic-outline, .page .pic-handle { display: none; }
  }`;

export function mount(host, wrapper) {
  const doc = host.ownerDocument;
  const win = doc.defaultView;
  const ratio = host.pageRatio;
  const height = Number((UNITS * ratio).toFixed(2));
  const viewBox = `0 0 ${UNITS} ${height}`;
  const whole = { x: 0, y: 0, w: UNITS, h: height };
  const key = pageKey(win, host.toyboxKey);
  wrapper.querySelector('style').textContent = PAGES_CSS;
  const abort = new AbortController();
  const on = (node, type, handler, options = {}) => node.addEventListener(type, handler, { ...options, signal: abort.signal });

  wrapper.insertAdjacentHTML('beforeend', `
    <div class="bar" part="bar">
      <button type="button" class="btn" data-act="notes">Add notes page</button>
      <button type="button" class="btn" data-act="drawing">Add drawing page</button>
      <button type="button" class="btn" data-act="save" data-file-button>Save file</button>
      <label class="btn file" data-file-button>Open file <input type="file" accept=".json,application/json"></label>
      <button type="button" class="btn" data-act="print" data-file-button>Print</button>
      <span class="savestate" aria-live="polite"></span>
    </div>
    <div class="pages" part="pages"></div>
    <p class="toast" aria-live="polite"></p>`);
  const find = (selector) => wrapper.querySelector(selector);
  const container = find('.pages');
  const bar = find('.bar');
  const savestate = find('.savestate');
  const toastNode = find('.toast');
  const toast = (text) => { toastNode.textContent = text; };
  let pages = [];
  let active = null;
  let loaded = false;

  const saver = autosave(win, key, () => ({ pages: list() }), (text) => { savestate.textContent = text; });
  const changed = () => {
    if (loaded) saver.changed();
    host.dispatchEvent(new win.CustomEvent('pages-change', { detail: { pages: pages.length }, bubbles: true, composed: true }));
  };
  const toolbar = createToolbar(doc, {
    tools: ['pen', 'highlighter', 'eraser', 'move'],
    onDraw: (drawing) => container.classList.toggle('drawing', drawing),
    onUndo: () => active?.ink.undo(), onRedo: () => active?.ink.redo(), onClear: () => active?.ink.clear(),
    onPicking: (picking) => container.classList.toggle('picking', picking),
    sampleAt: (event) => {
      const entry = pages.find((item) => item.page.contains(event.target));
      if (!entry) throw new Error('pick a colour on a page');
      return sampleColor(win, {
        x: event.clientX, y: event.clientY, root: wrapper.getRootNode(), skip: (element) => Boolean(element.closest('svg.ink, svg.pics')),
        ink: { svg: entry.ink.svg, strokes: entry.ink.history.strokes },
        pictures: entry.pictures ? { svg: entry.pictures.svg, images: entry.pictures.images } : null,
      });
    },
  });
  bar.prepend(toolbar.el);
  on(toolbar.el, 'click', () => container.classList.toggle('moving', toolbar.tool === 'move'));

  function setActive(entry) {
    active = entry;
    toolbar.showTarget(entry ? entry.label.textContent : '');
  }

  function renumber() {
    pages.forEach((entry, i) => {
      entry.label.textContent = `Page ${i + 1} · ${entry.kind === 'notes' ? 'Notes' : 'Drawing'}`;
      entry.up.disabled = i === 0;
      entry.down.disabled = i === pages.length - 1;
    });
    if (active) toolbar.showTarget(active.label.textContent);
  }

  const button = (className, text) => Object.assign(doc.createElement('button'), { type: 'button', className: `btn ${className}`, textContent: text });

  async function copyPng(entry) {
    // The PNG is handed over as a promise so the write starts inside the click: browsers allow
    // clipboard writes only during a user action.
    const png = renderToCanvas(win, { box: whole, width: UNITS, height: Math.round(height), background: '#ffffff', images: entry.pictures.list(), ink: entry.ink.markup() })
      .then((canvas) => canvasBlob(canvas, 'image/png'));
    try {
      if (!win.ClipboardItem || !win.navigator.clipboard?.write) throw new Error('this browser has no image clipboard');
      await win.navigator.clipboard.write([new win.ClipboardItem({ 'image/png': png })]);
      toast(`Copied ${entry.label.textContent} as a PNG.`);
    } catch (error) {
      const url = win.URL.createObjectURL(await png);
      const link = Object.assign(doc.createElement('a'), { href: url, download: `${entry.label.textContent.replace(/\W+/g, '-')}.png` });
      link.click();
      win.setTimeout(() => win.URL.revokeObjectURL(url), 10000);
      toast(`Could not copy (${error.message}); downloaded ${link.download} instead.`);
    }
  }

  async function addPicture(entry, file) {
    entry.pictures.add(await readPicture(win, file), whole);
  }

  function build(data) {
    const entry = { id: data.id, kind: data.kind };
    const wrap = doc.createElement('section');
    wrap.className = 'page-wrap';
    wrap.setAttribute('aria-label', data.kind === 'notes' ? 'Notes page' : 'Drawing page');
    const pagebar = doc.createElement('div');
    pagebar.className = 'pagebar';
    entry.label = Object.assign(doc.createElement('span'), { className: 'label' });
    entry.up = button('up', 'Move up');
    entry.down = button('down', 'Move down');
    const remove = button('remove', 'Remove page');
    pagebar.append(entry.label, entry.up, entry.down);
    const page = doc.createElement('div');
    page.className = `page ${data.kind}-page`;
    page.style.aspectRatio = `${UNITS} / ${height}`;
    page.tabIndex = -1;
    if (data.kind === 'notes') {
      page.insertAdjacentHTML('beforeend', `<div class="notes"><input class="title" aria-label="Page title" placeholder="Title" spellcheck="false">
        <textarea class="text" aria-label="Notes" spellcheck="false"></textarea></div>`);
      entry.title = page.querySelector('.title');
      entry.text = page.querySelector('.text');
      entry.title.value = data.title;
      entry.text.value = data.text;
      // The ruling in page units, so it scales with the page like the strokes do.
      const rule = () => { entry.text.style.setProperty('--rule', `${(page.getBoundingClientRect().width * RULE) / UNITS || 24}px`); };
      entry.fitRule = rule;
      rule();
      page.addEventListener('input', changed);
    } else {
      const pics = makeSvg(doc, 'pics', viewBox);
      page.append(pics);
      entry.pictures = new PictureLayer(pics, { onChange: changed, movable: () => toolbar.tool === 'move' });
      entry.pictures.load(data.images);
      const add = Object.assign(doc.createElement('label'), { className: 'btn file', innerHTML: 'Add picture <input type="file" accept="image/*">' });
      const copy = button('copy', 'Copy as PNG');
      const del = button('delpic', 'Delete picture');
      pagebar.append(add, copy, del);
      add.querySelector('input').addEventListener('change', (event) => {
        const file = event.target.files[0];
        event.target.value = '';
        if (file) addPicture(entry, file);
      });
      copy.addEventListener('click', () => copyPng(entry));
      del.addEventListener('click', () => entry.pictures.removeSelected() || toast('Pick a picture with the Move picture tool first.'));
      page.addEventListener('dragover', (event) => event.preventDefault());
      page.addEventListener('drop', (event) => {
        const file = imageFileFrom(event.dataTransfer);
        if (!file) return;
        event.preventDefault();
        setActive(entry);
        addPicture(entry, file);
      });
    }
    pagebar.append(remove);
    const inkSvg = makeSvg(doc, 'ink', viewBox);
    page.append(inkSvg);
    entry.ink = new InkLayer(inkSvg, { name: entry.id, brush: toolbar.brush, onStart: () => setActive(entry), onChange: changed });
    entry.ink.load(data.strokes);
    // A pointer or focus on a page makes it the target of the tools, paste and copy.
    page.addEventListener('pointerdown', () => setActive(entry), { capture: true });
    toolbar.watchPicks(page);
    page.addEventListener('focusin', () => setActive(entry));
    entry.up.addEventListener('click', () => move(entry, -1));
    entry.down.addEventListener('click', () => move(entry, 1));
    remove.addEventListener('click', () => removePage(entry));
    wrap.append(pagebar, page);
    entry.wrap = wrap;
    entry.page = page;
    return entry;
  }

  function add(data) {
    const entry = build(data);
    pages.push(entry);
    container.append(entry.wrap);
    renumber();
    return entry;
  }

  function addNew(kind) {
    if (kind !== 'notes' && kind !== 'drawing') throw new Error(`<toy-pages>: a page is "notes" or "drawing", not ${JSON.stringify(kind)}`);
    const entry = add(kind === 'notes'
      ? { id: pageId(), kind, title: '', text: '', strokes: [] }
      : { id: pageId(), kind, images: [], strokes: [] });
    setActive(entry);
    if (kind === 'drawing') toolbar.setDraw(true);
    entry.wrap.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    changed();
    return entry.id;
  }

  function move(entry, step) {
    const next = reordered(pages, pages.indexOf(entry), step);
    if (next === pages) return;
    pages = next;
    container.append(...pages.map((item) => item.wrap));
    renumber();
    changed();
  }

  function drop(entry) {
    pages = pages.filter((item) => item !== entry);
    entry.wrap.remove();
    entry.ink.destroy();
    entry.pictures?.destroy();
    if (active === entry) setActive(null);
  }

  function removePage(entry) {
    drop(entry);
    renumber();
    changed();
  }

  function list() {
    return pages.map((entry) => (entry.kind === 'notes'
      ? { id: entry.id, kind: 'notes', title: entry.title.value, text: entry.text.value, strokes: entry.ink.dump() }
      : { id: entry.id, kind: 'drawing', images: entry.pictures.list(), strokes: entry.ink.dump() }));
  }

  function show(state) {
    checkPagesState(state, host.toyboxKey);
    pages.slice().forEach(drop);
    state.pages.forEach(add);
    renumber();
  }

  const byId = (id) => {
    const entry = pages.find((item) => item.id === id);
    if (!entry) throw new Error(`<toy-pages>: no page "${id}"`);
    return entry;
  };

  on(bar, 'click', (event) => {
    const act = event.target.closest('button')?.dataset.act;
    if (act === 'notes' || act === 'drawing') addNew(act);
    else if (act === 'save') saveFile(doc).then((name) => toast(`Saved ${name}.`), (error) => toast(`Could not save: ${error.message}`));
    else if (act === 'print') win.print();
  });
  on(find('.file input'), 'change', (event) => {
    const file = event.target.files[0];
    event.target.value = '';
    if (file) openFile(doc, file).then(() => toast(`Opened ${file.name}.`), (error) => toast(`${file.name} could not be opened: ${error.message}`));
  });
  // Ctrl+V with a picture on the clipboard goes to the drawing page last touched; text pastes
  // into fields as usual.
  on(doc, 'paste', (event) => {
    const file = imageFileFrom(event.clipboardData);
    if (!file || !active?.pictures) return;
    event.preventDefault();
    addPicture(active, file);
  });
  on(win, 'resize', () => pages.forEach((entry) => entry.fitRule?.()));
  const showFileButtons = () => {
    const shown = host.buttonsSetting === 'all';
    for (const button of bar.querySelectorAll('[data-file-button]')) button.hidden = !shown;
  };
  showFileButtons();

  // What was kept before; autosave stays off until it has loaded, and off for good when it could
  // not be read or fails its check, so a damaged copy is not overwritten before it can be looked
  // at. The catch comes after the check so a failed check reaches it too.
  const restored = load(key).then((saved) => {
    if (saved !== undefined) show(saved);
    loaded = true;
  }).catch((error) => {
    savestate.textContent = `Saved pages could not be read (${error.message}); autosave is off.`;
    throw error;
  });
  restored.catch(() => {}); // shown in the save state above; restored() hands the error on

  return {
    restored: () => restored,
    attributeChanged(name) { if (name === 'buttons') showFileButtons(); },
    addPage: addNew,
    removePage: (id) => removePage(byId(id)),
    movePage: (id, step) => move(byId(id), step),
    pages: list,
    /** The surfaces image pastes and the tools go to: for the tests and the page's own buttons. */
    pasteInto: (id, picture) => byId(id).pictures.add(picture, whole),
    flush: () => saver.flush(),
    saveState: () => ({ pages: list() }),
    checkState: (state) => checkPagesState(state, host.toyboxKey),
    loadState(state) {
      show(state);
      loaded = true;
      saver.changed();
    },
    destroy() {
      saver.flush();
      abort.abort();
      toolbar.destroy();
      pages.slice().forEach(drop);
      wrapper.querySelectorAll('.bar, .pages, .toast').forEach((node) => node.remove());
    },
  };
}
