// The dice settings: 2D by default, quick roll on when the system asks for reduced motion, every
// remembered value checked, and a value no control can produce refused.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Settings from '../src/dice/settings.js';

test('the defaults are 2D dice with sound off; quick roll follows prefers-reduced-motion', () => {
  assert.equal(Settings.defaults(false).mode, '2d');
  assert.equal(Settings.defaults(false).quick, false);
  assert.equal(Settings.defaults(true).quick, true);
  assert.equal(Settings.defaults(false).sound, false);
});

test('remembered settings are read back; unknown or out-of-range values keep their defaults', () => {
  const saved = { ...Settings.defaults(false), mode: '3d', quick: true, dieColor: '#112233', pipStyle: 'numeral', throwForce: 9.5 };
  assert.deepEqual(Settings.parse(JSON.stringify(saved), false), saved);
  const odd = Settings.parse(JSON.stringify({ mode: '4d', quick: 'yes', dieColor: 'red', pipStyle: 'stars', throwForce: 99, scale3d: 4 }), true);
  assert.deepEqual(odd, { ...Settings.defaults(true), scale3d: 4 });
  assert.deepEqual(Settings.parse('not json', true), Settings.defaults(true));
  assert.deepEqual(Settings.parse(null, false), Settings.defaults(false));
});

test('a remembered quick roll wins over reduced motion', () => {
  assert.equal(Settings.parse(JSON.stringify({ quick: false }), true).quick, false);
});

test('withSetting changes one setting and refuses a value or a name the popup cannot produce', () => {
  const start = Settings.defaults(false);
  assert.deepEqual(Settings.withSetting(start, 'mode', '3d'), { ...start, mode: '3d' });
  assert.throws(() => Settings.withSetting(start, 'mode', '4d'), /not a value for the dice setting mode/);
  assert.throws(() => Settings.withSetting(start, 'scale3d', '6'), /not a value/);
  assert.throws(() => Settings.withSetting(start, 'volume', 1), /no dice setting volume/);
});
