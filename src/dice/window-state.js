// Where the dice tray window sits and how big it is, kept fully inside the browser window, and the
// form it is remembered in. All sizes are CSS pixels; viewport is { width, height }.

// 4 in by 8 in at CSS's 96 px to the inch.
export const DEFAULT_SIZE = { w: 384, h: 768 };
export const MIN_SIZE = { w: 280, h: 420 };
// The gap left between the tray and the window's lower corner.
export const MARGIN = 16;
export const SIDES = ['left', 'right'];

const within = (value, low, high) => Math.min(Math.max(value, low), high);

/**
 * The whole rectangle stays inside the viewport. A viewport smaller than the minimum size wins
 * over the minimum: the tray shrinks to the viewport rather than leave it. A minimized tray is
 * only its title bar (barHeight tall) at the bottom of its rectangle, so then the bar is what
 * stays inside.
 */
export function clamp(state, viewport, barHeight = 0) {
  const w = Math.min(Math.max(state.w, MIN_SIZE.w), viewport.width);
  const h = Math.min(Math.max(state.h, MIN_SIZE.h), viewport.height);
  const top = state.minimized && barHeight > 0 ? barHeight - h : 0;
  return { ...state, w, h, x: within(state.x, 0, viewport.width - w), y: within(state.y, top, viewport.height - h) };
}

/** side: the lower corner the tray opens in, the element's side="left|right". */
export function defaultState(viewport, side) {
  if (!SIDES.includes(side)) throw new Error(`unknown tray side ${JSON.stringify(side)}`);
  const { w, h } = DEFAULT_SIZE;
  const x = side === 'left' ? MARGIN : viewport.width - w - MARGIN;
  const y = viewport.height - h - MARGIN;
  return clamp({ x, y, w, h, open: true, minimized: false }, viewport);
}

/**
 * A tray still at the default spot of either side (where it opened, never moved or resized)
 * follows a change of side; one put anywhere else keeps its place.
 */
export function followSide(state, viewport, side) {
  const atDefault = SIDES.some((other) => {
    const spot = defaultState(viewport, other);
    return state.x === spot.x && state.y === spot.y && state.w === spot.w && state.h === spot.h;
  });
  if (!atDefault) return state;
  const spot = defaultState(viewport, side);
  return { ...state, x: spot.x, y: spot.y };
}

const KEYS = { x: 'number', y: 'number', w: 'number', h: 'number', open: 'boolean', minimized: 'boolean' };

/**
 * The remembered state, or null when there is none or it is not one this library wrote (the
 * caller then uses defaultState): a layout preference, so a stale entry is not an error.
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
