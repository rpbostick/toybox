// Where a floating window (the dice tray, the floating toy drawer, a toy's window) sits and how
// big it is, kept inside the browser window, and the form it is remembered in. All sizes are CSS
// pixels; viewport is { width, height }; a state is { x, y, w, h, open, minimized }.

const within = (value, low, high) => Math.min(Math.max(value, low), high);

/**
 * The whole rectangle stays inside the viewport. A viewport smaller than `min` wins over the
 * minimum: the window shrinks to the viewport rather than leave it. A minimized window is only
 * its title bar (barHeight tall), at the bottom of its rectangle (anchor "bottom", where the
 * dice tray keeps it, so it stays in its corner) or at the top (anchor "top", where the bar
 * already is), so then the bar is what stays inside.
 */
export function clamp(state, viewport, { min, barHeight = 0, anchor = 'top' }) {
  if (anchor !== 'top' && anchor !== 'bottom') throw new Error(`unknown window anchor ${JSON.stringify(anchor)}`);
  const w = Math.min(Math.max(state.w, min.w), viewport.width);
  const h = Math.min(Math.max(state.h, min.h), viewport.height);
  const bar = state.minimized && barHeight > 0;
  const low = bar && anchor === 'bottom' ? barHeight - h : 0;
  const high = bar && anchor === 'top' ? viewport.height - barHeight : viewport.height - h;
  return { ...state, w, h, x: within(state.x, 0, viewport.width - w), y: within(state.y, low, high) };
}

const KEYS = { x: 'number', y: 'number', w: 'number', h: 'number', open: 'boolean', minimized: 'boolean' };

/**
 * The remembered state, or null when there is none or it is not one this library wrote (the
 * caller then places the window afresh): a layout preference, so a stale entry is not an error.
 */
export function parse(text) {
  if (typeof text !== 'string') return null;
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (!value || typeof value !== 'object') return null;
  const ok = Object.entries(KEYS).every(([key, type]) => typeof value[key] === type && (type !== 'number' || Number.isFinite(value[key])));
  return ok ? Object.fromEntries(Object.keys(KEYS).map((key) => [key, value[key]])) : null;
}

export const serialize = (state) => JSON.stringify(Object.fromEntries(Object.keys(KEYS).map((key) => [key, state[key]])));
