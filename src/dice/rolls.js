// What a roll is before and after the dice. The tray's buttons build a pool ("2d6 + 1d8 + 2"),
// the notation box and tray.roll() take typed notation; each becomes a roll
// ({ label, notation }), and resultFor() turns the faces a roller reports into the dice shown,
// the total and each die type's sum.
import { checkSides, d100AsD10s, readD100, totalFromValues } from './notation.js';

export const BUTTON_SIDES = [4, 6, 8, 10, 12, 20, 100];
export const MODIFIER_LIMIT = 99;
// More dice than this in one pool is a stuck button, not a roll anyone means.
export const POOL_LIMIT = 60;

// Typed text may use the true minus sign or an en dash for a negative number.
const MINUS = /[−–]/g;

export const signed = (n) => (n === 0 ? '' : n > 0 ? `+${n}` : `${n}`);

/** Notation as typed ("2d6 + 1D8 − 1") in the form the engine reads ("2d6+1d8-1"). */
export function normalizeNotation(text) {
  const notation = String(text ?? '').replace(MINUS, '-').replace(/\s+/g, '').toLowerCase();
  if (!notation) throw new Error('nothing to roll: type dice such as 2d6+1');
  return notation;
}

export function notationRoll(text, label) {
  const notation = normalizeNotation(text);
  return { label: label ? `${label} ${notation}` : notation, notation };
}

export function withModifier(roll, modifier) {
  if (!Number.isInteger(modifier)) throw new TypeError(`modifier must be an integer, got ${modifier}`);
  if (modifier === 0) return roll;
  return { ...roll, label: roll.label + signed(modifier), notation: roll.notation + signed(modifier) };
}

export const clampModifier = (value) => Math.max(-MODIFIER_LIMIT, Math.min(MODIFIER_LIMIT, value));

// ---- the pool the die buttons build ----

export const emptyPool = () => ({ dice: [], modifier: 0 });

/** The pool with one more die of `sides` (any 2 to 1000). */
export function addDie(pool, sides) {
  checkSides(sides);
  const count = pool.dice.reduce((sum, entry) => sum + entry.count, 0);
  if (count >= POOL_LIMIT) throw new Error(`a pool holds at most ${POOL_LIMIT} dice`);
  const found = pool.dice.find((entry) => entry.sides === sides);
  const dice = found
    ? pool.dice.map((entry) => (entry === found ? { ...entry, count: entry.count + 1 } : entry))
    : [...pool.dice, { sides, count: 1 }].sort((a, b) => a.sides - b.sides);
  return { ...pool, dice };
}

export const withPoolModifier = (pool, modifier) => ({ ...pool, modifier: clampModifier(modifier) });

export const poolIsEmpty = (pool) => pool.dice.length === 0;

function poolTerms(pool) {
  const terms = pool.dice.map(({ sides, count }) => `${count}d${sides}`);
  if (pool.modifier) terms.push(String(Math.abs(pool.modifier)));
  return terms;
}

/** "2d6 + 1d8 + 1d20 + 2", as shown above the buttons. */
export function poolText(pool) {
  const terms = poolTerms(pool);
  if (!terms.length) return '';
  const last = pool.modifier ? terms.length - 1 : -1;
  return terms.map((term, index) => (index === 0 ? term : `${index === last && pool.modifier < 0 ? '−' : '+'} ${term}`)).join(' ');
}

export function poolRoll(pool) {
  if (poolIsEmpty(pool)) throw new Error('the pool is empty: pick some dice first');
  const notation = pool.dice.map(({ sides, count }) => `${count}d${sides}`).join('+') + signed(pool.modifier);
  return { label: notation, notation };
}

// ---- results ----

/**
 * valuesPerDiceTerm: the faces each dice term of the plan rolled (1 to its sides). A d100 is
 * also given as its two d10 faces (00-90 and 0-9), the way it is drawn and read.
 */
export function resultFor(roll, plan, valuesPerDiceTerm) {
  const summed = totalFromValues(plan, valuesPerDiceTerm);
  const dice = summed.dice.map((die) => {
    if (die.sides !== 100) return { ...die, face: String(die.value) };
    const read = readD100(...d100AsD10s(die.value));
    return { ...die, face: String(die.value), pair: [read.tensFace, read.onesFace] };
  });
  return { notation: roll.notation, label: roll.label, total: summed.total, dice, terms: summed.terms, groups: summed.groups };
}

/** "2d6 7 · d20 13": each die type's kept dice summed, for a roll of more than one type. */
export function groupsText(groups) {
  return groups.map((group) => `${group.count > 1 ? group.count : ''}d${group.sides} ${group.sum}`).join(' · ');
}
