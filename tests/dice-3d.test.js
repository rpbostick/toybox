// 3D dice: dice-box is imported only when 3D is switched on, from dice-box/ next to the script,
// a load that fails leaves the dice in 2D with the reason reported, and a roll with a die
// dice-box has no model for is thrown in 2D. dice-box itself is a stand-in here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Dice3D from '../src/dice/roller3d.js';
import * as Settings from '../src/dice/settings.js';

const settings = Settings.defaults(false);

/** A stand-in for dice-box's DiceBox class that records what the tray asked of it. */
function fakeDiceBox(calls, valueFor = (group, i) => Math.min(group.sides, i + 2)) {
  return class {
    constructor(config) { calls.push(['new', config]); }
    async init() { calls.push(['init']); }
    async updateConfig(config) { calls.push(['updateConfig', config]); }
    async roll(groups) {
      calls.push(['roll', groups]);
      return groups.flatMap((group, groupId) => Array.from({ length: group.qty }, (_, i) => ({ groupId, value: valueFor(group, i) })));
    }
    show() { calls.push(['show']); }
    hide() { calls.push(['hide']); }
    clear() { calls.push(['clear']); }
  };
}

const loadWith = (importModule) => Dice3D.load({
  importModule, base: 'https://cdn.example/some/path/toybox/dice-box/', container: { id: 'stage3d' }, settings,
});

test('load imports dice-box from the dice-box directory next to the script and points it at the assets beside it', async () => {
  const calls = [];
  const imported = [];
  await loadWith(async (url) => { imported.push(url); return { default: fakeDiceBox(calls) }; });
  assert.deepEqual(imported, ['https://cdn.example/some/path/toybox/dice-box/dice-box.es.min.js']);
  const [, config] = calls[0];
  assert.deepEqual(config, { container: '#stage3d', origin: 'https://cdn.example', assetPath: '/some/path/toybox/dice-box/assets/',
    theme: 'default', themeColor: settings.color3d, scale: settings.scale3d, throwForce: settings.throwForce });
  assert.deepEqual(calls[1], ['init']);
});

test('a 3D roll throws each dice term and returns its faces in plan order; quick suspends the physics', async () => {
  const calls = [];
  const box = await loadWith(async () => ({ default: fakeDiceBox(calls) }));
  const plan = { terms: [{ kind: 'dice', sign: 1, qty: 3, sides: 6, select: null }, { kind: 'constant', sign: 1, value: 2 }, { kind: 'dice', sign: 1, qty: 1, sides: 4, select: null }] };
  assert.deepEqual(await box.roll(plan, { quick: true }), [[2, 3, 4], [2]]);
  assert.deepEqual(calls.filter(([name]) => name !== 'new' && name !== 'init'), [
    ['updateConfig', { suspendSimulation: true }], ['roll', [{ qty: 3, sides: 6 }, { qty: 1, sides: 4 }]],
  ]);
});

test('a 3D d100 is thrown as a tens and a ones d10 and read back as one value', async () => {
  const calls = [];
  // Tens d10 shows 4 (40), ones d10 shows 10 (0): 40.
  const box = await loadWith(async () => ({ default: fakeDiceBox(calls, (group, i) => (i % 2 === 0 ? 4 : 10)) }));
  const plan = { terms: [{ kind: 'dice', sign: 1, qty: 2, sides: 100, select: null }] };
  assert.deepEqual(await box.roll(plan, { quick: false }), [[40, 40]]);
  assert.deepEqual(calls.find(([name]) => name === 'roll')[1], [{ qty: 4, sides: 10 }]);
});

test('dice dice-box has no model for are not thrown in 3D', async () => {
  const plan = (sides) => ({ terms: [{ kind: 'dice', sign: 1, qty: 1, sides, select: null }] });
  assert.equal(Dice3D.throwable(plan(20)), true);
  assert.equal(Dice3D.throwable(plan(100)), true);
  assert.equal(Dice3D.throwable(plan(7)), false);
  const box = await loadWith(async () => ({ default: fakeDiceBox([]) }));
  await assert.rejects(box.roll(plan(13), { quick: false }), /no 3D model/);
});

test('load fails loud when the module is not dice-box', async () => {
  await assert.rejects(loadWith(async () => ({})), /did not export the DiceBox class/);
});

test('the switch does not load dice-box until 3D is turned on, and loads it once', async () => {
  let loads = 0;
  const box = { shown: 0, hidden: 0, show() { this.shown++; }, hide() { this.hidden++; } };
  const modes = Dice3D.createModeSwitch({ load3d: async () => { loads++; return box; }, report: (err) => assert.fail(err) });
  assert.equal(modes.mode(), '2d');
  assert.equal(await modes.set('2d'), '2d');
  assert.equal(loads, 0);
  assert.equal(await modes.set('3d'), '3d');
  assert.equal(modes.box(), box);
  assert.equal(await modes.set('2d'), '2d');
  assert.equal(modes.box(), null);
  assert.equal(await modes.set('3d'), '3d');
  assert.deepEqual([loads, box.shown, box.hidden], [1, 2, 1]);
  await assert.rejects(modes.set('4d'), /unknown dice mode/);
});

test('a failed load reports why and leaves the dice in 2D; the next switch tries again', async () => {
  const reported = [];
  let attempts = 0;
  const modes = Dice3D.createModeSwitch({
    load3d: async () => { attempts++; if (attempts === 1) throw new Error('cannot import from file://'); return { show() {}, hide() {} }; },
    report: (err) => reported.push(err.message),
  });
  assert.equal(await modes.set('3d'), '2d');
  assert.deepEqual(reported, ['cannot import from file://']);
  assert.equal(modes.box(), null);
  assert.equal(await modes.set('3d'), '3d');
  assert.equal(attempts, 2);
});

test('switching back to 2D while dice-box loads wins, and two quick switches share one load', async () => {
  let release;
  let loads = 0;
  const box = { shown: 0, show() { this.shown++; }, hide() {} };
  const modes = Dice3D.createModeSwitch({ load3d: () => { loads++; return new Promise((resolve) => { release = () => resolve(box); }); }, report: (err) => assert.fail(err) });
  const first = modes.set('3d');
  const second = modes.set('3d');
  const back = modes.set('2d');
  release();
  assert.deepEqual(await Promise.all([first, second, back]), ['2d', '2d', '2d']);
  assert.deepEqual([loads, box.shown, modes.mode()], [1, 0, '2d']);
});
