// The pen tool bar shared by <draw-layer>, <toy-pages> and the image editor: Draw on/off, the
// tools, colour swatches and picker, the eyedropper and recent colours, size, undo, redo and
// clear. Sizes are in the layers' own units (1000 across), so a stroke keeps its weight relative
// to what it is drawn on at any size and in print.
import { RECENT_EVENT, recentColors } from './recent.js';

export const START = {
  pen: { color: '#2b2622', size: 4 },
  highlighter: { color: '#ffd400', size: 20 },
};
export const TOOL_LABELS = { pen: 'Pen', highlighter: 'Highlighter', eraser: 'Eraser', move: 'Move picture' };
const SWATCHES = ['#2b2622', '#b5523b', '#3b6fb5', '#3f8f4f', '#ffd400', '#ffffff'];

export const TOOLBAR_CSS = `
  .inkbar { display: flex; flex-wrap: wrap; align-items: center; gap: .3rem .45rem; }
  .inkbar .tools, .inkbar .swatches, .inkbar .recents { display: inline-flex; gap: .2rem; }
  .inkbar .recents:empty { display: none; }
  .inkbar .recents .swatch { width: 1rem; height: 1rem; }
  .inkbar .pickstate { font-size: .75rem; color: var(--soft); }
  .inkbar .swatch { width: 1.3rem; height: 1.3rem; padding: 0; border-radius: 50%; border: 1px solid var(--soft); cursor: pointer; }
  .inkbar .swatch[aria-pressed="true"] { outline: 2px solid var(--accent); outline-offset: 1px; }
  .inkbar input[type=range] { width: 80px; }
  .inkbar .target { font-size: .75rem; color: var(--soft); }
  .inkbar:not(.drawing) .when-drawing { display: none; }`;

/**
 * tools: which of pen, highlighter, eraser, move to offer. drawToggle false leaves the tools
 * always on (the image editor); toggleLabel names the Draw button, so a page with two of them
 * can say what each draws on. Callbacks: onDraw(on), onUndo(), onRedo(), onClear(),
 * onPicking(on) while the eyedropper waits for a click on the surface, and
 * sampleAt(pointerEvent), resolving to the #rrggbb under the click (eyedropper.js) for browsers
 * without the EyeDropper API. The host passes its drawing surface to watchPicks().
 */
export function createToolbar(doc, { tools = ['pen', 'highlighter', 'eraser'], drawToggle = true, toggleLabel = 'Draw', onDraw = () => {}, onUndo, onRedo, onClear, onPicking = () => {}, sampleAt }) {
  for (const name of tools) if (!TOOL_LABELS[name]) throw new Error(`no drawing tool ${name}`);
  if (typeof sampleAt !== 'function') throw new Error('createToolbar: sampleAt(event) must be a function');
  const win = doc.defaultView;
  const abort = new AbortController();
  const recent = recentColors(win);
  const settings = structuredClone(START);
  let tool = tools[0];
  let lastDrawing = tool;
  let drawing = !drawToggle;
  let picking = false;
  const bar = doc.createElement('div');
  bar.className = `inkbar${drawing ? ' drawing' : ''}`;
  bar.setAttribute('role', 'toolbar');
  bar.setAttribute('aria-label', 'Drawing tools');
  bar.setAttribute('part', 'toolbar');
  bar.innerHTML = `
    ${drawToggle ? '<button type="button" class="btn draw" aria-pressed="false"></button>' : ''}
    <span class="tools when-drawing">${tools.map((key) => `<button type="button" class="btn" data-tool="${key}" aria-pressed="${key === tool}">${TOOL_LABELS[key]}</button>`).join('')}</span>
    <span class="swatches when-drawing">${SWATCHES.map((color) => `<button type="button" class="swatch" data-color="${color}" style="background:${color}" aria-label="Colour ${color}"></button>`).join('')}</span>
    <label class="check when-drawing">Colour <input type="color" class="color"></label>
    <button type="button" class="btn eyedropper when-drawing" aria-pressed="false" title="Pick a colour from what is under the pointer (Esc cancels)">Eyedropper</button>
    <span class="recents when-drawing" role="group" aria-label="Recent colours"></span>
    <span class="pickstate when-drawing" aria-live="polite"></span>
    <label class="check when-drawing">Size <input type="range" class="size" min="1" max="60"></label>
    <button type="button" class="btn undo when-drawing" title="Undo (Ctrl+Z)">Undo</button>
    <button type="button" class="btn redo when-drawing" title="Redo (Ctrl+Shift+Z)">Redo</button>
    <button type="button" class="btn clear when-drawing" title="Remove every stroke here (can be undone)">Clear</button>
    <span class="target when-drawing" aria-live="polite"></span>`;
  const $ = (selector) => bar.querySelector(selector);
  const color = $('.color');
  const size = $('.size');
  const dropper = $('.eyedropper');
  const recents = $('.recents');
  // Its own listener rather than the bar's, so the host can put it anywhere (<draw-layer> keeps
  // it in place while the bar opens beside it).
  const toggle = $('.draw');
  toggle?.addEventListener('click', () => setDraw(!drawing), { signal: abort.signal });
  // As text, not markup: the label can come from a page's attribute.
  function setToggleLabel(label) {
    if (typeof label !== 'string' || !label.trim()) throw new Error(`createToolbar: the Draw button's label must be text, not ${JSON.stringify(label)}`);
    if (!toggle) throw new Error('createToolbar: no Draw button to label without drawToggle');
    toggle.textContent = `✎ ${label}`;
    toggle.title = label;
  }
  if (toggle) setToggleLabel(toggleLabel);
  const say = (text) => { $('.pickstate').textContent = text; };

  function showRecents() {
    recents.replaceChildren(...recent.read().map((hex) => {
      const swatch = doc.createElement('button');
      swatch.type = 'button';
      swatch.className = 'swatch recent';
      swatch.dataset.color = hex;
      swatch.style.background = hex;
      swatch.setAttribute('aria-label', `Recent colour ${hex}`);
      return swatch;
    }));
    showSettings();
  }

  function showSettings() {
    const own = settings[tool];
    color.disabled = !own;
    size.disabled = !own;
    if (own) {
      color.value = own.color;
      size.value = own.size;
    }
    for (const swatch of bar.querySelectorAll('.swatch')) {
      swatch.disabled = !own;
      swatch.setAttribute('aria-pressed', String(Boolean(own) && swatch.dataset.color === own.color));
    }
  }

  /**
   * The brush the ink layers draw with; under Move picture the last drawing tool's is kept. An
   * ink layer asks once per stroke as it starts, so its colour counts as used here.
   */
  function brush() {
    const current = tool === 'move' ? lastDrawing : tool;
    if (current === 'eraser') return { tool: 'eraser' };
    recent.add(settings[current].color);
    return { tool: current, ...settings[current] };
  }

  // A picked colour goes to the tool in hand when it has a colour, else to the last drawing tool
  // that has one (Move picture keeps it), else the pen.
  function usePicked(hex) {
    const owner = settings[tool] ? tool : settings[lastDrawing] ? lastDrawing : 'pen';
    settings[owner].color = hex;
    recent.add(hex);
    say(`Picked ${hex}.`);
    showSettings();
  }

  function setPicking(on) {
    picking = on;
    bar.classList.toggle('picking', on);
    dropper.setAttribute('aria-pressed', String(on));
    onPicking(on);
  }

  // With the EyeDropper API (Chromium) the browser's own picker samples anything on screen and
  // handles Esc itself; elsewhere the next click on the surface is sampled by sampleAt.
  async function startPicking() {
    if (picking) {
      setPicking(false);
      say('');
      return;
    }
    if (win.EyeDropper) {
      let result;
      try {
        result = await new win.EyeDropper().open();
      } catch (error) {
        if (error?.name !== 'AbortError') throw error;
        say('Eyedropper cancelled.');
        return;
      }
      usePicked(checkedHex(result.sRGBHex));
      return;
    }
    setPicking(true);
    say('Click to pick a colour; Esc cancels.');
  }

  async function pickAt(event) {
    setPicking(false);
    say('');
    usePicked(checkedHex(await sampleAt(event)));
  }

  function setTool(next) {
    if (!tools.includes(next)) throw new Error(`no drawing tool ${next} here; the tools are ${tools.join(', ')}`);
    tool = next;
    if (tool !== 'move') lastDrawing = tool;
    for (const button of bar.querySelectorAll('[data-tool]')) button.setAttribute('aria-pressed', String(button.dataset.tool === tool));
    showSettings();
  }

  function setDraw(on) {
    drawing = on;
    bar.classList.toggle('drawing', on);
    toggle?.setAttribute('aria-pressed', String(on));
    if (!on && picking) setPicking(false);
    onDraw(on);
  }

  bar.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.tool) setTool(button.dataset.tool);
    else if (button.dataset.color) {
      if (!settings[tool]) return;
      settings[tool].color = button.dataset.color;
      showSettings();
    } else if (button === dropper) startPicking().catch((error) => say(`The eyedropper failed: ${error.message}`));
    else if (button.classList.contains('undo')) onUndo();
    else if (button.classList.contains('redo')) onRedo();
    else if (button.classList.contains('clear')) onClear();
  });
  color.addEventListener('input', () => { settings[tool].color = color.value; showSettings(); });
  size.addEventListener('input', () => { settings[tool].size = Number(size.value); });
  // Esc ends a pick before anything else hears it (the image editor closes on Esc otherwise).
  win.addEventListener('keydown', (event) => {
    if (!picking || event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    setPicking(false);
    say('Eyedropper cancelled.');
  }, { capture: true, signal: abort.signal });
  win.addEventListener(RECENT_EVENT, showRecents, { signal: abort.signal });
  showRecents();

  return {
    el: bar,
    /** The Draw button (null without drawToggle). */
    toggle,
    brush,
    setTool,
    setDraw,
    setToggleLabel,
    get tool() { return tool; },
    get drawing() { return drawing; },
    get picking() { return picking; },
    showTarget(name) { $('.target').textContent = name ? `on: ${name}` : ''; },
    /** While picking, a press on `surface` is sampled instead of drawing or moving a picture. */
    watchPicks(surface) {
      surface.addEventListener('pointerdown', (event) => {
        if (!picking || event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        pickAt(event).catch((error) => say(`The eyedropper failed: ${error.message}`));
      }, { capture: true, signal: abort.signal });
    },
    destroy() {
      abort.abort();
    },
  };
}

function checkedHex(value) {
  if (typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value)) throw new Error(`the eyedropper gave ${JSON.stringify(value)}, not #rrggbb`);
  return value.toLowerCase();
}
