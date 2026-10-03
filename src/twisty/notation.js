// Cube notation for the twisty cube page: the turns its buttons and keys make, in the WCA
// and Twizzle convention (a letter turns that layer clockwise as seen looking at it, ' turns
// it the other way; x, y and z turn the whole cube, M, E and S the middle slices).

/** The face turns, then the "More" row, each with the hover text its buttons show. */
export const FACE_TURNS = [
  { family: 'U', title: 'U: up face' },
  { family: 'D', title: 'D: down face' },
  { family: 'L', title: 'L: left face' },
  { family: 'R', title: 'R: right face' },
  { family: 'F', title: 'F: front face' },
  { family: 'B', title: 'B: back face' },
];
export const MORE_TURNS = [
  { family: 'x', title: 'x: whole cube, turned like R' },
  { family: 'y', title: 'y: whole cube, turned like U' },
  { family: 'z', title: 'z: whole cube, turned like F' },
  { family: 'M', title: 'M: middle slice, between L and R, turned like L' },
  { family: 'E', title: 'E: equator slice, between U and D, turned like D' },
  { family: 'S', title: 'S: standing slice, between F and B, turned like F' },
];
const FAMILIES = new Map([...FACE_TURNS, ...MORE_TURNS].map((turn) => [turn.family.toLowerCase(), turn.family]));

export function moveString(family, counterClockwise) {
  if (![...FAMILIES.values()].includes(family)) throw new Error(`twisty page: unknown turn ${family}`);
  return counterClockwise ? `${family}'` : family;
}

/**
 * What a key press does: { move } for a turn, { undo: true } for Ctrl/Cmd+Z, or null for a key
 * the page leaves alone. Reads event.key, not event.code, so the letters follow the keyboard's
 * own layout; Shift gives the counter-clockwise turn.
 */
export function keyAction({ key, shiftKey = false, ctrlKey = false, metaKey = false, altKey = false }) {
  if (altKey) return null;
  if (ctrlKey || metaKey) return key.toLowerCase() === 'z' && !shiftKey ? { undo: true } : null;
  const family = FAMILIES.get(key.toLowerCase());
  return family ? { move: moveString(family, shiftKey) } : null;
}

const FACES = ['U', 'D', 'L', 'R', 'F', 'B'];
const AXIS = { U: 0, D: 0, L: 1, R: 1, F: 2, B: 2 };
const SUFFIXES = ['', "'", '2'];

/**
 * A random-move scramble: 25 face turns, never the same axis twice in a row. Not a
 * random-state scramble (cubing/scramble does that, with a search worker of its own); for a
 * desk toy, mixed up is enough.
 */
export function randomMoveScramble(length = 25, random = Math.random) {
  const moves = [];
  let lastAxis = -1;
  while (moves.length < length) {
    const face = FACES[Math.floor(random() * FACES.length)];
    if (AXIS[face] === lastAxis) continue;
    lastAxis = AXIS[face];
    moves.push(face + SUFFIXES[Math.floor(random() * SUFFIXES.length)]);
  }
  return moves.join(' ');
}
