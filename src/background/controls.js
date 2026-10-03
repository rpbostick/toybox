// The background's controls: the button named after the current background (pressing it shows
// the next of the element's effects), the on/off box, "Background reacts to the mouse", the
// color mode box, the 72-colour wheel and the color-mode hint. The background itself is drawn by
// the view (view.js); this only tells it what to show and shows what it reports back. The view
// is passed in (mountView), so the controls run in a test without WebGL.
import { remembered, rememberedChoice } from '../elements/remembered.js';
import { allBackgrounds, backgroundName, nextBackground } from './backgrounds.js';
import { STOP_COUNT, STOPS } from './palette.js';

// Per browser; the color mode is not remembered: every visit starts with the wheel scrolling
// the page.
export const STORE = { background: 'background.effect', on: 'background.on', interactive: 'background.interactive' };
const SVGNS = 'http://www.w3.org/2000/svg';

/** A choice the browser remembers wins; with none, reduced motion starts the background off. */
export function readSettings(win, effects) {
  const ids = allBackgrounds().map((background) => background.id);
  const saved = rememberedChoice(win, STORE.background, ids, effects[0]).read();
  const background = effects.includes(saved) ? saved : effects[0];
  const on = rememberedChoice(win, STORE.on, ['1', '0', 'unset'], 'unset').read();
  const reduced = win.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const interactive = rememberedChoice(win, STORE.interactive, ['1', '0'], '1').read() === '1';
  return { background, on: on === 'unset' ? !reduced : on === '1', interactive };
}

function wheelMarkup(theme) {
  const step = (2 * Math.PI) / STOP_COUNT;
  const point = (radius, angle) => `${(50 + radius * Math.sin(angle)).toFixed(2)},${(50 - radius * Math.cos(angle)).toFixed(2)}`;
  return STOPS[theme].map((stop, i) => {
    const from = i * step;
    const to = from + step;
    const d = `M${point(48, from)}A48,48 0 0 1 ${point(48, to)}L${point(30, to)}A30,30 0 0 0 ${point(30, from)}Z`;
    return `<path d="${d}" fill="${stop.hex}" data-stop="${i}"><title>${stop.name}</title></path>`;
  }).join('');
}

const TEMPLATE = `
  <button type="button" class="btn name" title="Show the next background"></button>
  <label class="check"><input type="checkbox" class="on"> Background</label>
  <label class="check full-only"><input type="checkbox" class="interactive"> Background reacts to the mouse</label>
  <label class="check full-only"><input type="checkbox" class="color-mode"> Color mode</label>
  <svg class="wheel full-only" viewBox="0 0 100 100" role="group" aria-label="Background colour (72 stops)"><g class="stops"></g>
    <circle class="marker" r="5" cx="50" cy="11"></circle></svg>
  <span class="hint" hidden>Wheel: colors · middle-click to stop · <output class="color-name"></output></span>`;

/**
 * Builds the controls into `box` (mode "full", "compact" or "none") and mounts the view into
 * `layer`. effects: the ids the name button cycles. environment(): { theme, paper, hidden, motion }.
 * Returns { update(), set(change), state(), destroy() }.
 */
export function startControls({ win, box, layer, mode, effects, environment, mountView, onChange }) {
  const doc = box.ownerDocument;
  const abort = new AbortController();
  const on = (target, type, handler) => target.addEventListener(type, handler, { signal: abort.signal });
  box.innerHTML = mode === 'none' ? '' : TEMPLATE;
  box.dataset.mode = mode;
  const find = (selector) => box.querySelector(selector);
  let { background, on: shown, interactive } = readSettings(win, effects);
  let colorMode = false;
  let stop = 0;
  let colorName = '';
  let wheelTheme = null;

  const state = () => ({ background, on: shown, interactive, colorMode, color: colorName, stop });

  function show() {
    if (mode !== 'none') {
      find('.name').textContent = backgroundName(background);
      find('.on').checked = shown;
      find('.interactive').checked = interactive;
      find('.color-mode').checked = colorMode;
      find('.color-mode').disabled = !shown;
      find('.hint').hidden = !(shown && colorMode);
      find('.color-name').textContent = colorName;
      const { theme } = environment();
      if (wheelTheme !== theme) {
        find('.wheel .stops').innerHTML = wheelMarkup(theme);
        wheelTheme = theme;
      }
      const angle = ((stop + 0.5) / STOP_COUNT) * 2 * Math.PI;
      const marker = find('.wheel .marker');
      marker.setAttribute('cx', (50 + 39 * Math.sin(angle)).toFixed(2));
      marker.setAttribute('cy', (50 - 39 * Math.cos(angle)).toFixed(2));
      find('.wheel').classList.toggle('off', !shown);
    }
    onChange(state());
  }

  const view = mountView(layer, {
    background, on: shown, interactive, colorMode, ...environment(),
    onColorMode(active, name, at) {
      colorName = name;
      stop = at;
      show();
    },
    onColorModeRequest: (active) => set({ colorMode: active }),
  });

  /** Changes any of { background, on, interactive, colorMode }; the first three are remembered. */
  function set(change) {
    for (const key of Object.keys(change)) {
      if (!['background', 'on', 'interactive', 'colorMode'].includes(key)) throw new Error(`<toy-background>: no setting ${key}`);
      if (key !== 'background' && typeof change[key] !== 'boolean') throw new Error(`<toy-background>: ${key} must be true or false`);
    }
    if ('background' in change) {
      if (!effects.includes(change.background)) throw new Error(`<toy-background>: "${change.background}" is not one of its effects (${effects.join(', ')})`);
      background = change.background;
      remembered(win, STORE.background).write(background);
    }
    if ('on' in change) {
      shown = change.on;
      remembered(win, STORE.on).write(shown ? '1' : '0');
    }
    if ('interactive' in change) {
      interactive = change.interactive;
      remembered(win, STORE.interactive).write(interactive ? '1' : '0');
    }
    if ('colorMode' in change) colorMode = change.colorMode;
    // Off ends the color mode, so the wheel scrolls the page again.
    if (!shown) colorMode = false;
    view.update({ background, on: shown, interactive, colorMode });
    show();
  }

  if (mode !== 'none') {
    on(find('.name'), 'click', () => set({ background: nextBackground(background, effects) }));
    on(find('.on'), 'change', (event) => set({ on: event.target.checked }));
    on(find('.interactive'), 'change', (event) => set({ interactive: event.target.checked }));
    on(find('.color-mode'), 'change', (event) => set({ colorMode: event.target.checked }));
    on(find('.wheel'), 'click', (event) => {
      const segment = event.target.closest?.('[data-stop]');
      if (segment && shown) view.pick(Number(segment.dataset.stop));
    });
  }
  show();

  return {
    set,
    state,
    /** The theme, page colour or visibility changed. */
    update() {
      view.update(environment());
      show();
    },
    destroy() {
      abort.abort();
      view.unmount();
      box.replaceChildren();
      doc.documentElement.classList.remove('toybox-background-color-mode');
    },
  };
}
