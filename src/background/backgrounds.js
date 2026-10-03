// The animated backgrounds, in the order the name button cycles through them: the library's own
// six, then any a page adds with registerBackground(), and the effects="…" attribute that picks a
// subset. Kept apart from the drawing code so the element's class in toybox.js can check the
// attribute, and a page can register a background, without loading that code.

export const BUILT_IN = [
  { id: 'lines', name: 'Line Waves' },
  { id: 'aurora', name: 'Aurora' },
  { id: 'film', name: 'Soap Film' },
  { id: 'plasma', name: 'Plasma' },
  { id: 'stars', name: 'Starfield' },
  { id: 'ripples', name: 'Grid Ripples' },
];

// Kept on the global object, so every copy of the library on a page (the module and a classic
// script, or a site's bundled copy beside a script tag) shares one list: a background
// registered through any of them reaches every <toy-background>.
const shared = (globalThis[Symbol.for('toybox.backgrounds')] ??= { plugins: new Map(), listeners: new Set() });
const { plugins, listeners } = shared;

const ID = /^[a-z][a-zA-Z0-9-]*$/;
const OPTIONAL = ['setColors', 'pointer', 'pause', 'resume', 'destroy'];

/**
 * Adds a background a page draws itself: definition { name, mount(el, api), setColors?(colors),
 * pointer?(point), pause?(), resume?(), destroy?() }. mount may return an object with those
 * methods instead (one per mount); destroy() is required on one of the two. Elements already on
 * the page without effects="…" take it into their cycle at once. pointer(point) hears the drag and,
 * after a fling, the coasting pointer once a frame; api.motion is the drag dynamics' state
 * (motion.js), for a background that wants the ripple field, the sheet or the spin too.
 */
export function registerBackground(id, definition) {
  if (typeof id !== 'string' || !ID.test(id)) throw new Error(`registerBackground: the id must be lower-case letters, digits and dashes, starting with a letter, not ${JSON.stringify(id)}`);
  if (BUILT_IN.some((entry) => entry.id === id) || plugins.has(id)) throw new Error(`registerBackground: "${id}" is already a background`);
  if (!definition || typeof definition !== 'object') throw new Error(`registerBackground("${id}"): give { name, mount(el, api), … }`);
  if (typeof definition.name !== 'string' || !definition.name.trim()) throw new Error(`registerBackground("${id}"): name must be the text its button shows`);
  if (typeof definition.mount !== 'function') throw new Error(`registerBackground("${id}"): mount(el, api) must be a function`);
  for (const method of OPTIONAL) {
    if (method in definition && typeof definition[method] !== 'function') throw new Error(`registerBackground("${id}"): ${method} must be a function`);
  }
  if ('wash' in definition) checkWash(id, definition.wash);
  plugins.set(id, definition);
  for (const listener of listeners) listener(id);
}

const isFraction = (value) => Number.isFinite(value) && value >= 0 && value <= 1;

// wash: how strongly the page colour lies over the background, 0 (none) to 1 (only the page
// colour), the same in both themes or { light, dark }.
function checkWash(id, wash) {
  const ok = isFraction(wash) || (wash !== null && typeof wash === 'object' && isFraction(wash.light) && isFraction(wash.dark));
  if (!ok) throw new Error(`registerBackground("${id}"): wash must be a number from 0 to 1, or { light, dark } of such numbers, not ${JSON.stringify(wash)}`);
}

/** Calls listener(id) after each registerBackground(); returns the unsubscribe. */
export function onRegistered(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** A registered background's definition, or undefined for a built-in or unknown id. */
export const pluginDefinition = (id) => plugins.get(id);

/** Every background, built-in first, then registered ones in the order they were added. */
export function allBackgrounds() {
  return [...BUILT_IN, ...[...plugins].map(([id, definition]) => ({ id, name: definition.name }))];
}

const allIds = () => allBackgrounds().map((background) => background.id);

export const isBackground = (id) => allIds().includes(id);

export function backgroundName(id) {
  const background = allBackgrounds().find((entry) => entry.id === id);
  if (!background) throw new Error(`unknown background ${JSON.stringify(id)}`);
  return background.name;
}

/** The background after `id` among `ids`, wrapping round. */
export function nextBackground(id, ids = allIds()) {
  const at = ids.indexOf(id);
  if (at < 0) throw new Error(`unknown background ${JSON.stringify(id)}`);
  return ids[(at + 1) % ids.length];
}

/** The ids an effects="…" attribute names, in its order; null means every background. */
export function parseEffects(value) {
  const known = allIds();
  if (value === null) return known;
  const ids = value.split(',').map((id) => id.trim()).filter(Boolean);
  if (ids.length === 0) throw new Error('<toy-background> effects="": name at least one, or leave the attribute out for all');
  const seen = new Set();
  for (const id of ids) {
    if (!known.includes(id)) throw new Error(`<toy-background> effects: no background "${id}"; they are ${known.join(', ')} (register a page's own with registerBackground() first)`);
    if (seen.has(id)) throw new Error(`<toy-background> effects: "${id}" is named twice`);
    seen.add(id);
  }
  return ids;
}

export const CONTROL_MODES = ['full', 'compact', 'none'];

// The drag dynamics (motion.js), each an attribute of <toy-background> that is on unless set to
// "off": ripple (the local stretch and swirl), sheet (the field following the drag and gliding
// on), spin (the inside-of-a-ball turn), momentum (the pointer coasting on after a fling).
export const MOTIONS = ['ripple', 'sheet', 'spin', 'momentum'];

/** { ripple, sheet, spin, momentum } from the attributes: absent or "on" is on, "off" is off. */
export function parseMotion(getAttribute) {
  return Object.fromEntries(MOTIONS.map((name) => {
    const value = getAttribute(name);
    if (value !== null && value !== 'on' && value !== 'off') throw new Error(`<toy-background> ${name}="${value}": use on or off (on when left out)`);
    return [name, value !== 'off'];
  }));
}
