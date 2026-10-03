// The dice tray as a floating window: dragged by its title bar, resized from its corner handle,
// minimized to the bar, closed and reopened from its launcher, always kept inside the browser
// window, its place, size and state remembered. Plain pointer events; no window library.
import { trackPointer } from '../elements/pointer-track.js';
import * as WindowState from './window-state.js';

/**
 * els: { tray, bar, grip, minimize, close, open } elements; store: { read(), write(text) };
 * side: "left" or "right", the lower corner the tray opens in. Returns the window's controls
 * and detach(), which removes every listener it added.
 */
export function attach({ win, els, store, side }) {
  const abort = new AbortController();
  const on = (target, type, handler) => target.addEventListener(type, handler, { signal: abort.signal });
  const viewport = () => ({ width: win.innerWidth, height: win.innerHeight });
  // The minimized tray's height: its title bar and the tray's own top and bottom border.
  const barHeight = () => els.bar.offsetHeight + els.tray.offsetHeight - els.tray.clientHeight;
  const remembered = WindowState.parse(store.read());
  const placed = remembered ? WindowState.clamp(remembered, viewport(), barHeight()) : WindowState.defaultState(viewport(), side);
  let state = WindowState.clamp(WindowState.followSide(placed, viewport(), side), viewport(), barHeight());

  function show() {
    const { tray } = els;
    tray.hidden = !state.open;
    els.open.hidden = state.open;
    tray.classList.toggle('minimized', state.minimized);
    tray.style.left = `${state.x}px`;
    tray.style.width = `${state.w}px`;
    // Minimized, only the bar shows, at the bottom of the tray's rectangle.
    tray.style.top = `${state.minimized ? state.y + state.h - barHeight() : state.y}px`;
    tray.style.height = state.minimized ? '' : `${state.h}px`;
    els.minimize.setAttribute('aria-expanded', String(!state.minimized));
    els.minimize.title = state.minimized ? 'Restore the dice tray' : 'Minimize the dice tray';
    els.minimize.setAttribute('aria-label', els.minimize.title);
  }

  function set(next, save = true) {
    state = WindowState.clamp({ ...state, ...next }, viewport(), barHeight());
    show();
    if (save) store.write(WindowState.serialize(state));
  }

  // move(dx, dy, start) gives the new state for the distance moved from the state at the press.
  function track(handle, move) {
    trackPointer(handle, {
      signal: abort.signal,
      start: () => {
        els.tray.classList.add('moving');
        return { ...state };
      },
      move: (dx, dy, start) => set(move(dx, dy, start), false),
      end: () => {
        els.tray.classList.remove('moving');
        set({});
      },
    });
  }

  track(els.bar, (dx, dy, start) => ({ x: start.x + dx, y: start.y + dy }));
  // Growing past the window's right or bottom edge stops at the edge instead of moving the tray.
  track(els.grip, (dx, dy, start) => ({
    w: Math.min(start.w + dx, win.innerWidth - start.x), h: Math.min(start.h + dy, win.innerHeight - start.y),
  }));

  on(els.minimize, 'click', () => set({ minimized: !state.minimized }));
  on(els.close, 'click', () => {
    set({ open: false });
    els.open.focus();
  });
  on(els.open, 'click', () => {
    set({ open: true, minimized: false });
    els.bar.focus();
  });
  on(win, 'resize', () => set({}, false));
  show();

  return {
    /** Opens and restores the tray, e.g. when a roll goes into it. */
    reveal() { if (!state.open || state.minimized) set({ open: true, minimized: false }); },
    open() { set({ open: true, minimized: false }); },
    close() { set({ open: false }); },
    /** The size the browser gave the tray by CSS resize (the fallback to the handle). */
    resized(w, h) { if (!state.minimized && state.open && (w !== state.w || h !== state.h)) set({ w, h }); },
    /** side="…" changed: a tray at its default spot moves to the other corner. */
    setSide(next) {
      const moved = WindowState.followSide(state, viewport(), next);
      if (moved !== state) set({ x: moved.x, y: moved.y });
    },
    state: () => ({ ...state }),
    detach() { abort.abort(); },
  };
}
