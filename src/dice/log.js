// One line of the tray's results log: when, what was rolled, the faces (dropped ones marked), the
// total, each die type's sum for a mixed pool, and the band when the roll asked for one.
import { groupsText } from './rolls.js';

const two = (n) => String(n).padStart(2, '0');

/** The local wall-clock time, HH:MM:SS. */
export const clock = (date) => `${two(date.getHours())}:${two(date.getMinutes())}:${two(date.getSeconds())}`;

export function entryFor(result, band, date) {
  return {
    time: clock(date),
    what: result.label,
    faces: result.dice.map((die) => ({ face: die.face, sides: die.sides, dropped: die.dropped })),
    groups: result.groups.length > 1 ? groupsText(result.groups) : '',
    total: result.total,
    band: band ? band.label : null,
  };
}

/**
 * The plain-text form, also the screen reader's announcement: "14:02:09 STR 2d6+2: 3, 5 = 10,
 * Success". A dropped die is in parentheses: "3d6kh1: (2), 5, (4) = 5".
 */
export function entryText(entry) {
  const faces = entry.faces.map((f) => (f.dropped ? `(${f.face})` : f.face)).join(', ');
  const groups = entry.groups ? ` (${entry.groups})` : '';
  return `${entry.time} ${entry.what}: ${faces}${groups} = ${entry.total}${entry.band ? `, ${entry.band}` : ''}`;
}

const isFace = (face) => face && typeof face.face === 'string' && Number.isInteger(face.sides) && typeof face.dropped === 'boolean';

/** Checks a log entry read back from a saved file; throws naming the first thing wrong. */
export function checkEntry(entry, where) {
  if (!entry || typeof entry !== 'object') throw new Error(`${where} must be an object`);
  for (const key of ['time', 'what', 'groups']) if (typeof entry[key] !== 'string') throw new Error(`${where}.${key} must be a string`);
  if (!Number.isInteger(entry.total)) throw new Error(`${where}.total must be an integer`);
  if (entry.band !== null && typeof entry.band !== 'string') throw new Error(`${where}.band must be a string or null`);
  if (!Array.isArray(entry.faces) || !entry.faces.every(isFace)) throw new Error(`${where}.faces must be a list of { face, sides, dropped }`);
  return entry;
}
