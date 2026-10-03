// Where the dice tray window sits and how big it is: its default corner and sizes on top of the
// shared window state (src/elements/window-state.js). All sizes are CSS pixels; viewport is
// { width, height }.
import * as WindowState from '../elements/window-state.js';

// 4 in by 8 in at CSS's 96 px to the inch.
export const DEFAULT_SIZE = { w: 384, h: 768 };
export const MIN_SIZE = { w: 280, h: 420 };
// The gap left between the tray and the window's lower corner.
export const MARGIN = 16;
export const SIDES = ['left', 'right'];

/** The shared clamp at the tray's minimum, minimized to the bottom of its rectangle. */
export const clamp = (state, viewport, barHeight = 0) => WindowState.clamp(state, viewport, { min: MIN_SIZE, barHeight, anchor: 'bottom' });

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

export const { parse, serialize } = WindowState;
