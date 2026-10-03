// The rolls the tray makes (src/dice/rolls.js, notation.js, log.js): notation as typed, the pool
// the die buttons build, dice of any size, d100 shown as two d10, the modifier added once, the
// totals from the faces, and the log entry with its time.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseNotation, rollPlan } from '../src/dice/notation.js';
import { checkEntry, clock, entryFor, entryText } from '../src/dice/log.js';
import * as Rolls from '../src/dice/rolls.js';

const d = (qty, sides, select = null) => ({ kind: 'dice', sign: 1, qty, sides, select });
const k = (value) => ({ kind: 'constant', sign: 1, value });

test('typed notation is read as the engine wants it: spaces, capitals and true minus signs', () => {
  assert.deepEqual(Rolls.notationRoll('2D6 + 1d8 − 1'), { label: '2d6+1d8-1', notation: '2d6+1d8-1' });
  assert.deepEqual(Rolls.notationRoll('2d6+2', 'STR'), { label: 'STR 2d6+2', notation: '2d6+2' });
  assert.throws(() => Rolls.notationRoll('  '), /nothing to roll/);
  assert.throws(() => parseNotation(Rolls.notationRoll('two dice').notation), /"twodice" is not dice notation/);
});

test('die buttons build a pool shown as "2d6 + 1d8 + 1d20 + 2", rolled as one notation', () => {
  let pool = Rolls.emptyPool();
  for (const sides of [20, 6, 8, 6]) pool = Rolls.addDie(pool, sides);
  pool = Rolls.withPoolModifier(pool, 2);
  assert.equal(Rolls.poolText(pool), '2d6 + 1d8 + 1d20 + 2');
  assert.deepEqual(Rolls.poolRoll(pool), { label: '2d6+1d8+1d20+2', notation: '2d6+1d8+1d20+2' });
  assert.equal(Rolls.poolText(Rolls.withPoolModifier(pool, -3)), '2d6 + 1d8 + 1d20 − 3');
  assert.equal(Rolls.poolText(Rolls.emptyPool()), '');
  assert.throws(() => Rolls.poolRoll(Rolls.emptyPool()), /the pool is empty/);
});

test('a pool takes dice of 2 to 1000 sides, up to its limit, and clamps the modifier', () => {
  let pool = Rolls.addDie(Rolls.emptyPool(), 7);
  pool = Rolls.addDie(pool, 1000);
  assert.equal(Rolls.poolText(pool), '1d7 + 1d1000');
  for (const bad of [1, 1001, 2.5, Number.NaN]) assert.throws(() => Rolls.addDie(pool, bad), /2 to 1000 sides/);
  let full = Rolls.emptyPool();
  for (let i = 0; i < Rolls.POOL_LIMIT; i++) full = Rolls.addDie(full, 6);
  assert.throws(() => Rolls.addDie(full, 6), /at most 60 dice/);
  assert.equal(Rolls.withPoolModifier(pool, 500).modifier, Rolls.MODIFIER_LIMIT);
});

test('the modifier is added to a roll once, in the label and the notation', () => {
  const roll = Rolls.withModifier(Rolls.notationRoll('1d20'), 2);
  assert.deepEqual([roll.label, roll.notation], ['1d20+2', '1d20+2']);
  const plain = Rolls.notationRoll('d6');
  assert.equal(Rolls.withModifier(plain, 0), plain);
  assert.throws(() => Rolls.withModifier(plain, 1.5), TypeError);
  assert.equal(Rolls.resultFor(roll, { terms: [d(1, 20), k(2)] }, [[11]]).total, 13);
});

test('a d100 result is its value, shown as two d10: 100 as 00 and 0, 47 as 40 and 7', () => {
  const roll = Rolls.notationRoll('1d100');
  for (const [value, pair] of [[100, ['00', '0']], [47, ['40', '7']], [10, ['10', '0']], [5, ['00', '5']]]) {
    const result = Rolls.resultFor(roll, { terms: [d(1, 100)] }, [[value]]);
    assert.equal(result.total, value);
    assert.deepEqual(result.dice[0].pair, pair, String(value));
  }
});

test('a mixed pool result sums each die type and shows them in the log', () => {
  const roll = Rolls.notationRoll('2d6+1d8+2');
  const result = Rolls.resultFor(roll, { terms: [d(2, 6), d(1, 8), k(2)] }, [[3, 4], [5]]);
  assert.equal(result.total, 14);
  assert.equal(Rolls.groupsText(result.groups), '2d6 7 · d8 5');
  const entry = entryFor(result, null, new Date(2026, 9, 2, 9, 5, 7));
  assert.equal(entryText(entry), '09:05:07 2d6+1d8+2: 3, 4, 5 (2d6 7 · d8 5) = 14');
});

test('a log entry: the time as HH:MM:SS, what was rolled, the faces with dropped ones, the total and the band', () => {
  const date = new Date(2026, 9, 2, 9, 5, 7);
  assert.equal(clock(date), '09:05:07');
  const roll = Rolls.notationRoll('3d6kh1', 'HIT DICE');
  const entry = entryFor(Rolls.resultFor(roll, { terms: [d(3, 6, { mode: 'keep', end: 'h', qty: 1 })] }, [[2, 5, 4]]), null, date);
  assert.deepEqual(entry, {
    time: '09:05:07', what: 'HIT DICE 3d6kh1', total: 5, band: null, groups: '',
    faces: [{ face: '2', sides: 6, dropped: true }, { face: '5', sides: 6, dropped: false }, { face: '4', sides: 6, dropped: true }],
  });
  assert.equal(entryText(entry), '09:05:07 HIT DICE 3d6kh1: (2), 5, (4) = 5');
  const str = Rolls.notationRoll('2d6+2', 'STR');
  const strEntry = entryFor(Rolls.resultFor(str, { terms: [d(2, 6), k(2)] }, [[5, 4]]), { key: 'full', label: 'Success' }, new Date(2026, 9, 2, 23, 59, 0));
  assert.equal(entryText(strEntry), '23:59:00 STR 2d6+2: 5, 4 = 11, Success');
  assert.equal(checkEntry(structuredClone(strEntry), 'log[0]').total, 11);
  assert.throws(() => checkEntry({ ...strEntry, total: '11' }, 'log[0]'), /log\[0\]\.total must be an integer/);
});

test('typed notation rolled through the parser and roller stays within its bounds', () => {
  for (const notation of ['2d6+2', '4d6kh1', '1d6+2', '1d100+3', '2d6+1d8+1d20+2', '4d6kh3', 'd7', '3d13', 'd%']) {
    for (let i = 0; i < 50; i++) {
      const roll = Rolls.notationRoll(notation);
      const plan = parseNotation(roll.notation);
      const result = Rolls.resultFor(roll, plan, rollPlan(plan));
      assert.equal(result.terms.reduce((sum, term) => sum + term.subtotal, 0), result.total);
      if (notation === '1d100+3') assert.ok(result.total >= 4 && result.total <= 103, `${notation} gave ${result.total}`);
      if (notation === '4d6kh1') assert.equal(result.dice.filter((die) => die.dropped).length, 3);
      if (notation === '3d13') assert.ok(result.dice.every((die) => die.value >= 1 && die.value <= 13));
    }
  }
});
