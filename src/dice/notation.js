// Dice notation, rolls and totals. parseNotation() reads what the tray rolls: NdX (any 2 to 1000
// sides), d% and d100, one keep or drop per dice term (kh, kl, dh, dl; k and d alone are kh and
// dl), and signed constants, joined by + and -. The syntax is the common dice-roller one for
// those parts; anything else (exploding, rerolls, multiplication, brackets) fails with a message.
// A plan holds only what a roller that reports bare faces (the 2D dice, dice-box's 3D dice) can
// be totalled from, and the total is always computed here, so 2D and 3D rolls add up the same way.

export const MIN_SIDES = 2;
export const MAX_SIDES = 1000;
// More dice than this in one roll is a typing slip, not a roll anyone means, and would bury the tray.
export const MAX_DICE = 100;
// Larger constants lose integer precision once added up.
const MAX_CONSTANT = 1_000_000;

export function checkSides(sides) {
  if (!Number.isInteger(sides) || sides < MIN_SIDES || sides > MAX_SIDES) {
    throw new Error(`a die has ${MIN_SIDES} to ${MAX_SIDES} sides, not ${String(sides)}`);
  }
  return sides;
}

// One term: [count]d(sides|%)[k|kh|kl|d|dh|dl n], or a whole number.
const DICE = /^(\d*)d(\d+|%)(?:(kh|kl|k|dh|dl|d)(\d+))?$/;
const CONSTANT = /^\d+$/;
const SELECT = { k: ['keep', 'h'], kh: ['keep', 'h'], kl: ['keep', 'l'], d: ['drop', 'l'], dh: ['drop', 'h'], dl: ['drop', 'l'] };

function readTerm(text, sign) {
  if (CONSTANT.test(text)) {
    const value = Number(text);
    if (value > MAX_CONSTANT) throw new Error(`${text} is larger than ${MAX_CONSTANT}`);
    return { kind: 'constant', sign, value };
  }
  const match = DICE.exec(text);
  if (!match) {
    const known = /^(\d*)d(\d+|%)/.exec(text);
    if (known) throw new Error(`"${text.slice(known[0].length)}" after ${known[0]} is not a keep or drop (kh3, kl1, dl1, dh1)`);
    throw new Error(`"${text}" is neither dice (2d6, d%) nor a whole number`);
  }
  const qty = match[1] === '' ? 1 : Number(match[1]);
  if (qty < 1) throw new Error(`${text} rolls no dice`);
  const sides = checkSides(match[2] === '%' ? 100 : Number(match[2]));
  let select = null;
  if (match[3]) {
    const count = Number(match[4]);
    if (count < 1 || count > qty) throw new Error(`${text} can ${SELECT[match[3]][0]} 1 to ${qty} dice, not ${count}`);
    select = { mode: SELECT[match[3]][0], end: SELECT[match[3]][1], qty: count };
  }
  return { kind: 'dice', sign, qty, sides, select };
}

/**
 * Reads notation ("2d6+1d8+3", "4d6kh3", "d%") into a plan: { terms } of dice terms
 * { kind: 'dice', sign, qty, sides, select } and constants { kind: 'constant', sign, value }.
 * Spaces and capitals are ignored. Throws `"…" is not dice notation: <why>` for anything else.
 */
export function parseNotation(text) {
  const source = String(text ?? '');
  const compact = source.replace(/\s+/g, '').toLowerCase();
  try {
    if (!compact) throw new Error('it is empty');
    const parts = compact.split(/([+-])/);
    // A leading sign leaves an empty first part: "-1+d6" is ['', '-', '1', '+', 'd6'].
    if (parts[0] === '') parts.splice(0, 1);
    else parts.unshift('+');
    const terms = [];
    for (let i = 0; i < parts.length; i += 2) {
      const sign = parts[i] === '-' ? -1 : 1;
      const term = parts[i + 1];
      if (!term) throw new Error(i + 2 >= parts.length ? `it ends with "${parts[i]}"` : `"${parts[i]}" is followed by another sign`);
      terms.push(readTerm(term, sign));
    }
    const count = terms.reduce((sum, term) => sum + (term.kind === 'dice' ? term.qty : 0), 0);
    if (count === 0) throw new Error('it has no dice');
    if (count > MAX_DICE) throw new Error(`it has ${count} dice; a roll holds at most ${MAX_DICE}`);
    return { terms };
  } catch (error) {
    throw new Error(`"${source.trim()}" is not dice notation: ${error.message}`);
  }
}

export const diceTerms = (plan) => plan.terms.filter((term) => term.kind === 'dice');

/** A term as notation again: "4d6kh3", "1d100", "3". */
export function termText(term) {
  if (term.kind === 'constant') return String(term.value);
  const select = term.select ? `${term.select.mode[0]}${term.select.end}${term.select.qty}` : '';
  return `${term.qty}d${term.sides}${select}`;
}

/**
 * Faces for every dice term of the plan, from `random` (a function returning [0, 1), as
 * Math.random does; a test passes a seeded one).
 */
export function rollPlan(plan, random = Math.random) {
  return diceTerms(plan).map((term) => Array.from({ length: term.qty }, () => {
    const draw = random();
    if (!(draw >= 0 && draw < 1)) throw new Error(`the random source gave ${draw}, not a number in [0, 1)`);
    return 1 + Math.floor(draw * term.sides);
  }));
}

function keptFlags(values, select) {
  if (!select) return values.map(() => true);
  const order = values.map((value, index) => ({ value, index }));
  order.sort((a, b) => (select.end === 'h' ? b.value - a.value : a.value - b.value) || a.index - b.index);
  const chosen = new Set(order.slice(0, select.qty).map((entry) => entry.index));
  return values.map((value, index) => (select.mode === 'keep' ? chosen.has(index) : !chosen.has(index)));
}

/**
 * valuesPerDiceTerm: one array of faces per dice term, in plan order. Returns the total, each
 * die with dropped dice marked, each term's signed subtotal ({ text, sign, subtotal }), and the
 * kept dice summed per die type ("2d6: 7").
 */
export function totalFromValues(plan, valuesPerDiceTerm) {
  const dice = diceTerms(plan);
  if (valuesPerDiceTerm.length !== dice.length) throw new Error(`expected values for ${dice.length} dice terms, got ${valuesPerDiceTerm.length}`);
  let total = 0;
  const breakdown = [];
  const subtotals = [];
  const groups = new Map();
  let diceIndex = 0;
  for (const term of plan.terms) {
    if (term.kind === 'constant') {
      total += term.sign * term.value;
      subtotals.push({ text: termText(term), sign: term.sign, subtotal: term.sign * term.value });
      continue;
    }
    const values = valuesPerDiceTerm[diceIndex++];
    if (values.length !== term.qty) throw new Error(`expected ${term.qty} values for d${term.sides}, got ${values.length}`);
    for (const value of values) {
      if (!Number.isInteger(value) || value < 1 || value > term.sides) throw new Error(`d${term.sides} reported impossible value ${value}`);
    }
    const kept = keptFlags(values, term.select);
    const group = groups.get(term.sides) ?? { sides: term.sides, count: 0, sum: 0 };
    let subtotal = 0;
    values.forEach((value, index) => {
      if (kept[index]) {
        subtotal += term.sign * value;
        group.count += 1;
      }
      breakdown.push({ sides: term.sides, value, dropped: !kept[index] });
    });
    group.sum += subtotal;
    total += subtotal;
    subtotals.push({ text: termText(term), sign: term.sign, subtotal });
    groups.set(term.sides, group);
  }
  return { total, dice: breakdown, terms: subtotals, groups: [...groups.values()].sort((a, b) => a.sides - b.sides) };
}

/** Parses and rolls in one step: the plan and its total, dice, terms and groups. */
export function rollNotation(text, random = Math.random) {
  const plan = parseNotation(text);
  return { plan, ...totalFromValues(plan, rollPlan(plan, random)) };
}

/**
 * d100 is read from two d10, each rolled 1-10 and read by its face (10 shows 0): the tens die
 * shows 00, 10 ... 90, the ones die 0-9, and 00 with 0 is 100.
 */
export function readD100(tensRoll, onesRoll) {
  for (const value of [tensRoll, onesRoll]) {
    if (!Number.isInteger(value) || value < 1 || value > 10) throw new Error(`a d10 reported impossible value ${value}`);
  }
  const tens = (tensRoll % 10) * 10;
  const ones = onesRoll % 10;
  return { value: tens + ones === 0 ? 100 : tens + ones, tensFace: String(tens).padStart(2, '0'), onesFace: String(ones) };
}

/** The two d10 a d100 value 1-100 is shown as: [tens roll, ones roll], each 1-10. */
export function d100AsD10s(value) {
  if (!Number.isInteger(value) || value < 1 || value > 100) throw new Error(`a d100 cannot show ${value}`);
  const tens = Math.floor((value % 100) / 10);
  const ones = value % 10;
  return [tens === 0 ? 10 : tens, ones === 0 ? 10 : ones];
}
