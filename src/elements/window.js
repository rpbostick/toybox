// A floating window, shared by the dice tray, the floating toy drawer and the toys' own windows:
// dragged by its title bar, resized from its corner handle, minimized to the bar and restored,
// closed, always kept inside the browser window, its place, size and state remembered. Arrow
// keys move it while its title bar has focus (Shift for bigger steps). Windows that join a
// stack come to the front when pressed or focused. Plain pointer events; no window library.
import { trackPointer } from './pointer-track.js';
import * as WindowState from './window-state.js';

const KEY_STEP = 10;
const KEY_STEP_LARGE = 50;
const ARROWS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };

// Above the page's own content and the dice tray (2147482000), below the 32-bit maximum with
// room for 647 windows.
export const STACK_BASE = 2147483000;

const stacks = new WeakMap();

/**
 * The stacked windows of one document, back to front. Each raise renumbers them all from
 * STACK_BASE, so z-index never creeps towards the maximum however often windows are raised.
 */
export function windowStack(doc) {
  let stack = stacks.get(doc);
  if (stack) return stack;
  const boxes = [];
  const renumber = () => boxes.forEach((box, index) => { box.style.zIndex = String(STACK_BASE + index); });
  stack = {
    raise(box) {
      const at = boxes.indexOf(box);
      if (at === boxes.length - 1 && at >= 0) return;
      if (at >= 0) boxes.splice(at, 1);
      boxes.push(box);
      renumber();
    },
    remove(box) {
      const at = boxes.indexOf(box);
      if (at >= 0) boxes.splice(at, 1);
      box.style.zIndex = '';
      renumber();
    },
    /** Back to front. */
    order: () => [...boxes],
  };
  stacks.set(doc, stack);
  return stack;
}

/**
 * els: { box, bar, grip, minimize, close } elements (minimize and close may be null);
 * store: { read(), write(text) }; place(viewport): the state of a window with nothing
 * remembered; min: its smallest { w, h }; anchor: where a minimized window's bar sits, "top"
 * or "bottom" of its rectangle; name: what the minimize button's label calls the window.
 * stack: a windowStack to join (optional). escapeCloses: Escape inside the window closes it.
 * onChange(state) runs after every change is shown, onClose() after the close button or Escape
 * closed it, onFront() after a press or focus inside it. Returns the window's controls and
 * detach(), which removes every listener it added.
 */
export function attachWindow({
  win, els, store, place, min, anchor = 'top', name, stack = null, escapeCloses = false,
  onChange = () => {}, onClose = () => {}, onFront = () => {},
}) {
  const abort = new AbortController();
  const on = (target, type, handler, options = {}) => target.addEventListener(type, handler, { ...options, signal: abort.signal });
  const viewport = () => ({ width: win.innerWidth, height: win.innerHeight });
  // The minimized window's height: its title bar and the box's own top and bottom border.
  const barHeight = () => els.bar.offsetHeight + els.box.offsetHeight - els.box.clientHeight;
  const fit = (next) => WindowState.clamp(next, viewport(), { min, barHeight: barHeight(), anchor });
  let state = fit(WindowState.parse(store.read()) ?? place(viewport()));

  function show() {
    const { box, minimize } = els;
    box.hidden = !state.open;
    box.classList.toggle('minimized', state.minimized);
    box.style.left = `${state.x}px`;
    box.style.width = `${state.w}px`;
    box.style.top = `${state.minimized && anchor === 'bottom' ? state.y + state.h - barHeight() : state.y}px`;
    box.style.height = state.minimized ? '' : `${state.h}px`;
    if (minimize) {
      minimize.setAttribute('aria-expanded', String(!state.minimized));
      minimize.title = `${state.minimized ? 'Restore' : 'Minimize'} ${name}`;
      minimize.setAttribute('aria-label', minimize.title);
    }
    onChange({ ...state });
  }

  function set(next, save = true) {
    state = fit({ ...state, ...next });
    show();
    if (save) store.write(WindowState.serialize(state));
  }

  function front() {
    stack?.raise(els.box);
    onFront();
  }

  // move(dx, dy, start) gives the new state for the distance moved from the state at the press.
  function track(handle, move) {
    trackPointer(handle, {
      signal: abort.signal,
      start: () => {
        els.box.classList.add('moving');
        return { ...state };
      },
      move: (dx, dy, start) => set(move(dx, dy, start), false),
      end: () => {
        els.box.classList.remove('moving');
        set({});
      },
    });
  }

  track(els.bar, (dx, dy, start) => ({ x: start.x + dx, y: start.y + dy }));
  // Growing past the window's right or bottom edge stops at the edge instead of moving the box.
  if (els.grip) {
    track(els.grip, (dx, dy, start) => ({
      w: Math.min(start.w + dx, win.innerWidth - start.x), h: Math.min(start.h + dy, win.innerHeight - start.y),
    }));
  }
  on(els.bar, 'keydown', (event) => {
    const arrow = ARROWS[event.key];
    if (!arrow || event.target !== els.bar) return;
    event.preventDefault();
    const step = event.shiftKey ? KEY_STEP_LARGE : KEY_STEP;
    set({ x: state.x + arrow[0] * step, y: state.y + arrow[1] * step });
  });
  if (escapeCloses) {
    on(els.box, 'keydown', (event) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      set({ open: false });
      onClose();
    });
  }
  if (els.minimize) on(els.minimize, 'click', () => set({ minimized: !state.minimized }));
  if (els.close) {
    on(els.close, 'click', () => {
      set({ open: false });
      onClose();
    });
  }
  on(els.box, 'pointerdown', front, { capture: true });
  on(els.box, 'focusin', front);
  on(win, 'resize', () => set({}, false));
  stack?.raise(els.box);
  show();

  return {
    state: () => ({ ...state }),
    set,
    /** Opens and restores the window. */
    open() { set({ open: true, minimized: false }); },
    close() { set({ open: false }); },
    raise: front,
    detach() {
      abort.abort();
      stack?.remove(els.box);
    },
  };
}
