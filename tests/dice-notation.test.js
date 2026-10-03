// Dice notation, rolls and totals (src/dice/notation.js), World of Dungeons bands and the band
// registry (src/dice/bands.js), and reading d100 from two d10.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bandFor, registerBands, wodBand } from '../src/dice/bands.js';
import {
  MAX_DICE, d100AsD10s, diceTerms, parseNotation, readD100, rollNotation, rollPlan, termText, totalFromValues,
} from '../src/dice/notation.js';

test('World of Dungeons bands at every boundary: 6- miss, 7-9 partial, 10+ success, 12+ critical', () => {
  const expected = { 1: 'Miss', 6: 'Miss', 7: 'Partial success', 9: 'Partial success', 10: 'Success', 11: 'Success', 12: 'Critical success', 15: 'Critical success' };
  for (const [total, label] of Object.entries(expected)) assert.equal(wodBand(Number(total)).label, label, `total ${total}`);
});

test('the band rejects a total that is not an integer', () => {
  assert.throws(() => wodBand(7.5), TypeError);
  assert.throws(() => wodBand(undefined), TypeError);
});

test('wod is a built-in band set; a page registers its own, and a bad one fails loud', () => {
  assert.equal(bandFor('wod', 10, {}).label, 'Success');
  assert.equal(bandFor(undefined, 10, {}), null, 'no set named, no band');
  registerBands('test-high-low', (total) => (total >= 10 ? { key: 'high', label: 'High' } : null));
  assert.deepEqual(bandFor('test-high-low', 12, {}), { key: 'high', label: 'High' });
  assert.equal(bandFor('test-high-low', 3, {}), null);
  assert.throws(() => registerBands('test-high-low', () => null), /already registered/);
  assert.throws(() => registerBands('Bad Name', () => null), /lower-case/);
  assert.throws(() => bandFor('nope', 3, {}), /no band set "nope"; the sets are wod, test-high-low/);
  registerBands('test-broken', () => 'Success');
  assert.throws(() => bandFor('test-broken', 3, {}), /returned "Success", not \{ key, label \}/);
});

const keep = (end, qty) => ({ mode: 'keep', end, qty });
const drop = (end, qty) => ({ mode: 'drop', end, qty });
const die = (sign, qty, sides, select = null) => ({ kind: 'dice', sign, qty, sides, select });
const constant = (sign, value) => ({ kind: 'constant', sign, value });

/** mulberry32: a small seeded source of [0, 1), so a run of rolls is the same every time. */
function seeded(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test('parsing: dice of any 2 to 1000 sides, d% and d100, pools, keep and drop, constants, spaces and capitals', () => {
  const cases = {
    d6: [die(1, 1, 6)],
    '3d13': [die(1, 3, 13)],
    '1d1000': [die(1, 1, 1000)],
    'd%': [die(1, 1, 100)],
    '2d%': [die(1, 2, 100)],
    d100: [die(1, 1, 100)],
    '2d6+1d8+3': [die(1, 2, 6), die(1, 1, 8), constant(1, 3)],
    '4d6kh3': [die(1, 4, 6, keep('h', 3))],
    '4d6k3': [die(1, 4, 6, keep('h', 3))],
    '2d20kl1': [die(1, 2, 20, keep('l', 1))],
    '4d6dl1': [die(1, 4, 6, drop('l', 1))],
    '4d6d1': [die(1, 4, 6, drop('l', 1))],
    '5d10dh2': [die(1, 5, 10, drop('h', 2))],
    '1d8-1d4-1': [die(1, 1, 8), die(-1, 1, 4), constant(-1, 1)],
    '-1+d6': [constant(-1, 1), die(1, 1, 6)],
    ' 2D6 + 1 ': [die(1, 2, 6), constant(1, 1)],
  };
  for (const [text, terms] of Object.entries(cases)) assert.deepEqual(parseNotation(text).terms, terms, text);
  assert.equal(diceTerms(parseNotation('2d6+1d8+3')).length, 2);
});

test('parsing refuses anything else and says why', () => {
  const cases = {
    '': /"" is not dice notation: it is empty/,
    'two dice': /"two dice" is not dice notation: "twodice" is neither dice/,
    '2d6!': /"!" after 2d6 is not a keep or drop/,
    '2d6r1': /"r1" after 2d6 is not a keep or drop/,
    '2d6*2': /"\*2" after 2d6 is not a keep or drop/,
    '(2d6)': /neither dice/,
    '2d6+': /it ends with "\+"/,
    '2d6++1': /"\+" is followed by another sign/,
    '1d1': /2 to 1000 sides, not 1$/,
    '1d1001': /2 to 1000 sides, not 1001/,
    '0d6': /0d6 rolls no dice/,
    '2d6kh3': /2d6kh3 can keep 1 to 2 dice, not 3/,
    '4d6dl0': /can drop 1 to 4 dice, not 0/,
    '2d6kh': /"kh" after 2d6 is not a keep or drop/,
    '3+4': /it has no dice/,
    '101d6': /it has 101 dice; a roll holds at most 100/,
    '1d6+9999999': /9999999 is larger than/,
    'd6.5': /neither dice|not a keep or drop/,
  };
  for (const [text, message] of Object.entries(cases)) assert.throws(() => parseNotation(text), message, text);
});

test('each term is notation again: 4d6kh3, 1d100, 3', () => {
  assert.deepEqual(parseNotation('4d6k3+d%-3').terms.map(termText), ['4d6kh3', '1d100', '3']);
  assert.equal(termText(die(1, 4, 6, drop('l', 1))), '4d6dl1');
});

test('totals: sum, keep highest, keep lowest, drop lowest, negative terms', () => {
  assert.equal(totalFromValues(parseNotation('2d6+1'), [[3, 4]]).total, 8);
  const hit = totalFromValues(parseNotation('3d6kh1'), [[2, 5, 5]]);
  assert.equal(hit.total, 5);
  assert.deepEqual(hit.dice.map((d) => d.dropped), [true, false, true], 'of two equal highest, the first is kept');
  assert.equal(totalFromValues(parseNotation('2d20kl1'), [[17, 4]]).total, 4);
  assert.equal(totalFromValues(parseNotation('4d6dl1'), [[1, 6, 3, 4]]).total, 13);
  assert.equal(totalFromValues(parseNotation('4d6dh1'), [[1, 6, 3, 4]]).total, 8);
  assert.equal(totalFromValues(parseNotation('1d8-1d4-1'), [[8], [3]]).total, 4);
});

test('the result lists every die with kept or dropped, each term\'s subtotal and the total', () => {
  const result = totalFromValues(parseNotation('4d6kh3+1d8-2'), [[1, 6, 3, 4], [5]]);
  assert.deepEqual(result.dice, [
    { sides: 6, value: 1, dropped: true }, { sides: 6, value: 6, dropped: false }, { sides: 6, value: 3, dropped: false },
    { sides: 6, value: 4, dropped: false }, { sides: 8, value: 5, dropped: false },
  ]);
  assert.deepEqual(result.terms, [{ text: '4d6kh3', sign: 1, subtotal: 13 }, { text: '1d8', sign: 1, subtotal: 5 }, { text: '2', sign: -1, subtotal: -2 }]);
  assert.equal(result.total, 16);
  assert.equal(result.terms.reduce((sum, term) => sum + term.subtotal, 0), result.total);
});

test('keep and drop choose the right dice over many seeded rolls', () => {
  const random = seeded(7);
  for (const [text, pick] of [['4d6kh3', (v) => v.slice(1)], ['2d20kl1', (v) => v.slice(0, 1)], ['4d6dl1', (v) => v.slice(1)], ['5d10dh2', (v) => v.slice(0, 3)]]) {
    for (let i = 0; i < 2000; i++) {
      const rolled = rollNotation(text, random);
      const values = rolled.dice.map((d) => d.value);
      const expected = pick(values.slice().sort((a, b) => a - b)).reduce((sum, v) => sum + v, 0);
      assert.equal(rolled.total, expected, `${text} ${values}`);
      assert.equal(rolled.dice.filter((d) => !d.dropped).reduce((sum, d) => sum + d.value, 0), expected);
    }
  }
});

test('every face of a d7 comes up about 1/7 of the time from a seeded source, and a d% covers 1 to 100', () => {
  const random = seeded(2026);
  const rolls = 70000;
  const counts = new Array(8).fill(0);
  const [values] = rollPlan(parseNotation(`${MAX_DICE}d7`), random);
  for (let i = 0; i < rolls / MAX_DICE - 1; i++) values.push(...rollPlan(parseNotation(`${MAX_DICE}d7`), random)[0]);
  for (const value of values) counts[value] += 1;
  assert.equal(values.length, rolls);
  assert.equal(counts[0], 0);
  for (let face = 1; face <= 7; face++) {
    // 10000 expected per face; the standard deviation is about 92, so 400 is over four of them.
    assert.ok(Math.abs(counts[face] - rolls / 7) < 400, `face ${face} came up ${counts[face]} times`);
  }
  const seen = new Set();
  for (let i = 0; i < 2000; i++) seen.add(rollNotation('d%', random).total);
  assert.equal(seen.size, 100);
  assert.ok(Math.min(...seen) === 1 && Math.max(...seen) === 100);
});

test('the rolls use the random source given, and a bad source fails loud', () => {
  assert.deepEqual(rollPlan(parseNotation('3d6+1d20'), () => 0), [[1, 1, 1], [1]]);
  assert.deepEqual(rollPlan(parseNotation('2d6'), () => 0.999999), [[6, 6]]);
  assert.throws(() => rollPlan(parseNotation('1d6'), () => 1), /gave 1, not a number in \[0, 1\)/);
  assert.throws(() => rollPlan(parseNotation('1d6'), () => Number.NaN), /gave NaN/);
});

test('each die type is summed over its kept dice, across terms of the same size', () => {
  const plan = parseNotation('2d6+1d8+1d6+2');
  assert.deepEqual(totalFromValues(plan, [[3, 4], [7], [6]]).groups, [{ sides: 6, count: 3, sum: 13 }, { sides: 8, count: 1, sum: 7 }]);
  const kept = totalFromValues(parseNotation('4d6kh3'), [[1, 6, 3, 4]]);
  assert.deepEqual(kept.groups, [{ sides: 6, count: 3, sum: 13 }]);
});

test('totals fail loud on a value a die cannot show or a missing die', () => {
  const plan = parseNotation('2d6');
  assert.throws(() => totalFromValues(plan, [[0, 7]]), /impossible value/);
  assert.throws(() => totalFromValues(plan, [[3]]), /expected 2 values/);
  assert.throws(() => totalFromValues(plan, []), /expected values for 1 dice terms/);
});

test('d100 reads a tens die and a ones die: 00+0 is 100, 90+9 is 99, 10+0 is 10', () => {
  // Each d10 rolls 1-10; a 10 shows 0 (00 on the tens die).
  assert.deepEqual(readD100(10, 10), { value: 100, tensFace: '00', onesFace: '0' });
  assert.deepEqual(readD100(9, 9), { value: 99, tensFace: '90', onesFace: '9' });
  assert.deepEqual(readD100(1, 10), { value: 10, tensFace: '10', onesFace: '0' });
  assert.deepEqual(readD100(10, 1), { value: 1, tensFace: '00', onesFace: '1' });
  assert.throws(() => readD100(0, 5), /impossible value 0/);
  assert.throws(() => readD100(3, 11), /impossible value 11/);
});

test('every d100 value splits into the two d10 that read back as it', () => {
  for (let value = 1; value <= 100; value++) assert.equal(readD100(...d100AsD10s(value)).value, value);
  assert.throws(() => d100AsD10s(0), /cannot show 0/);
});
