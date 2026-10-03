// The dice tray as a floating window (src/elements/window.js): opened in the lower corner of its
// side, minimized to the bottom of its rectangle so the bar stays in that corner, and reopened
// from its launcher once closed.
import { attachWindow } from '../elements/window.js';
import * as WindowState from './window-state.js';

/**
 * els: { tray, bar, grip, minimize, close, open } elements; store: { read(), write(text) };
 * side: "left" or "right", the lower corner the tray opens in. Returns the window's controls
 * and detach(), which removes every listener it added.
 */
export function attach({ win, els, store, side }) {
  const viewport = () => ({ width: win.innerWidth, height: win.innerHeight });
  const frame = attachWindow({
    win,
    els: { box: els.tray, bar: els.bar, grip: els.grip, minimize: els.minimize, close: els.close },
    store,
    place: (view) => WindowState.defaultState(view, side),
    min: WindowState.MIN_SIZE,
    anchor: 'bottom',
    name: 'the dice tray',
    onChange: (state) => { els.open.hidden = state.open; },
    onClose: () => els.open.focus(),
  });
  // A remembered tray at either side's default spot opens on this side; nothing is written.
  const placed = frame.state();
  const followed = WindowState.followSide(placed, viewport(), side);
  if (followed !== placed) frame.set({ x: followed.x, y: followed.y }, false);

  const onLauncher = () => {
    frame.open();
    els.bar.focus();
  };
  els.open.addEventListener('click', onLauncher);

  return {
    /** Opens and restores the tray, e.g. when a roll goes into it. */
    reveal() {
      const { open, minimized } = frame.state();
      if (!open || minimized) frame.open();
    },
    open: () => frame.open(),
    close: () => frame.close(),
    /** The size the browser gave the tray by CSS resize (the fallback to the handle). */
    resized(w, h) {
      const state = frame.state();
      if (!state.minimized && state.open && (w !== state.w || h !== state.h)) frame.set({ w, h });
    },
    /** side="…" changed: a tray at its default spot moves to the other corner. */
    setSide(next) {
      const state = frame.state();
      const moved = WindowState.followSide(state, viewport(), next);
      if (moved !== state) frame.set({ x: moved.x, y: moved.y });
    },
    state: () => frame.state(),
    detach() {
      els.open.removeEventListener('click', onLauncher);
      frame.detach();
    },
  };
}
