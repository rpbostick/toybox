// The colours last drawn with or picked by the eyedropper, newest first, shared by every pen tool
// bar in the browser and remembered in localStorage (remembered.js).
import { remembered } from '../elements/remembered.js';

export const RECENT_MAX = 8;
const KEY = 'draw.recent-colors';
// Told to every tool bar on the page when one of them adds a colour, so their rows match.
export const RECENT_EVENT = 'toybox-recent-colors';
const HEX = /^#[0-9a-f]{6}$/;

/** `list` with `hex` moved to the front, without repeats, at most RECENT_MAX long. */
export function withRecent(list, hex) {
  if (!HEX.test(hex)) throw new Error(`a recent colour is #rrggbb in lower case, not ${JSON.stringify(hex)}`);
  return [hex, ...list.filter((color) => color !== hex)].slice(0, RECENT_MAX);
}

/**
 * Deliberate: like every display preference in remembered.js, a stored list that is not a JSON
 * array of #rrggbb reads as empty (and is replaced on the next colour), since a lost row of
 * recent colours costs nothing a user made.
 */
export function parseRecent(text) {
  if (text === null) return [];
  let list;
  try {
    list = JSON.parse(text);
  } catch {
    return [];
  }
  if (!Array.isArray(list) || !list.every((color) => typeof color === 'string' && HEX.test(color))) return [];
  return [...new Set(list)].slice(0, RECENT_MAX);
}

export function recentColors(win) {
  const store = remembered(win, KEY);
  return {
    read: () => parseRecent(store.read()),
    add(hex) {
      const next = withRecent(parseRecent(store.read()), hex);
      store.write(JSON.stringify(next));
      win.dispatchEvent(new win.CustomEvent(RECENT_EVENT));
      return next;
    },
  };
}
