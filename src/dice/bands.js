// Result bands: a named way to read a roll's total ("Partial success"). A page registers its own
// with registerBands(name, read); read(total, result) returns { key, label } or null. Kept out
// of the dice tray's chunk so a page can register bands before the tray has loaded.

const BANDS = new Map();

/** World of Dungeons, 2d6 + attribute: 6 or less a miss, 7-9 a partial success, 10+ a success, 12+ a critical. */
export function wodBand(total) {
  if (!Number.isInteger(total)) throw new TypeError(`total must be an integer, got ${total}`);
  if (total >= 12) return { key: 'critical', label: 'Critical success' };
  if (total >= 10) return { key: 'full', label: 'Success' };
  if (total >= 7) return { key: 'partial', label: 'Partial success' };
  return { key: 'miss', label: 'Miss' };
}

const NAME = /^[a-z][a-z0-9-]*$/;

export function registerBands(name, read) {
  if (!NAME.test(name)) throw new Error(`band set name "${name}": use lower-case letters, digits and -`);
  if (typeof read !== 'function') throw new TypeError(`band set "${name}" needs a function (total, result) => { key, label } | null`);
  if (BANDS.has(name)) throw new Error(`band set "${name}" is already registered`);
  BANDS.set(name, read);
}

/** The band of a result under the named set; null when no set is named. */
export function bandFor(name, total, result) {
  if (name === undefined || name === null) return null;
  const read = BANDS.get(name);
  if (!read) throw new Error(`no band set "${name}"; the sets are ${[...BANDS.keys()].join(', ')}`);
  const band = read(total, result);
  if (band === null) return null;
  if (!band || typeof band.key !== 'string' || typeof band.label !== 'string') {
    throw new Error(`band set "${name}" returned ${JSON.stringify(band)}, not { key, label } or null`);
  }
  return band;
}

export const bandNames = () => [...BANDS.keys()];

registerBands('wod', (total) => wodBand(total));
