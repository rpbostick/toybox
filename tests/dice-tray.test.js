// <dice-tray> in happy-dom: its chunk loads on connect, the die buttons build a pool that rolls
// as one log entry, dN adds a die of any size, the resize handle is there and resizes, tray.roll()
// resolves to the result and fires `roll`, data-roll links roll into the nearest tray, and the
// window is remembered per page under the element's id.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { add, makeWindow } from './happy-window.js';

// Under reduced motion quick roll is on, so the 2D dice land without the tumble's timers.
const quickWindow = (options = {}) => makeWindow({ reducedMotion: 'reduce', ...options });

async function tray(doc, html = '<dice-tray id="tray"></dice-tray>') {
  const element = add(doc, html);
  await element.ready;
  return element;
}

const $ = (element, selector) => element.shadowRoot.querySelector(selector);
const $$ = (element, selector) => [...element.shadowRoot.querySelectorAll(selector)];
const button = (element, text) => $$(element, '.buttons button').find((node) => node.textContent === text);
const logLines = (element) => $$(element, '.log li:not(.note)').map((item) => item.getAttribute('aria-label'));
const notes = (element) => $$(element, '.log li.note .what').map((item) => item.textContent);

test('the tray opens at the lower right with the log above the roller and d4-d100, dN and a modifier below', async () => {
  const { doc } = quickWindow();
  const element = await tray(doc);
  assert.equal($(element, '.tray').hidden, false);
  assert.deepEqual([$(element, '.tray').style.left, $(element, '.tray').style.top], ['1000px', '216px']);
  assert.deepEqual($$(element, '.buttons button').map((node) => node.textContent), ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100', 'dN']);
  const order = ['.log', '.stage', '.pool', '.buttons', '.modifier'].map((selector) => [...$(element, '.body').children].indexOf($(element, selector)));
  assert.deepEqual(order, [...order].sort((a, b) => a - b), 'log, roller, pool, buttons, modifier from top to bottom');
});

test('die buttons build a pool shown above them; Roll rolls it together into one log entry', async () => {
  const { doc } = quickWindow();
  const element = await tray(doc);
  for (const text of ['d6', 'd8', 'd6', 'd20']) button(element, text).click();
  $(element, '.mod-up').click();
  $(element, '.mod-up').click();
  assert.equal($(element, '.pool-text').textContent, '2d6 + 1d8 + 1d20 + 2');
  const rolled = new Promise((resolve) => element.addEventListener('roll', (event) => resolve(event.detail)));
  $(element, '.roll-pool').click();
  const result = await rolled;
  assert.equal(result.notation, '2d6+1d8+1d20+2');
  assert.equal(result.dice.length, 4);
  assert.equal(result.total, result.dice.reduce((sum, die) => sum + die.value, 0) + 2);
  assert.deepEqual(result.groups.map((group) => [group.sides, group.count]), [[6, 2], [8, 1], [20, 1]]);
  assert.equal(logLines(element).length, 1);
  assert.match(logLines(element)[0], /^\d\d:\d\d:\d\d 2d6\+1d8\+1d20\+2: \d+, \d+, \d+, \d+ \(2d6 \d+ · d8 \d+ · d20 \d+\) = \d+$/);
  assert.equal($$(element, '.stage2d .die').length, 4, 'the 2D roller shows every die');
  assert.equal($(element, '.pool-text').textContent, '', 'the pool empties once rolled');
  assert.equal($(element, '.roll-pool').disabled, true);
});

test('Clear empties the pool and its modifier without rolling', async () => {
  const { doc } = quickWindow();
  const element = await tray(doc);
  button(element, 'd4').click();
  $(element, '.mod-down').click();
  assert.equal($(element, '.pool-text').textContent, '1d4 − 1');
  $(element, '.clear-pool').click();
  assert.deepEqual((await element.implementation()).pool(), { dice: [], modifier: 0 });
  assert.equal(logLines(element).length, 0);
});

test('dN opens a number field; 2 to 1000 sides goes into the pool, anything else is refused with a note', async () => {
  const { doc } = quickWindow();
  const element = await tray(doc);
  const form = $(element, '.dn');
  assert.equal(form.hidden, true);
  button(element, 'dN').click();
  assert.equal(form.hidden, false);
  const input = form.querySelector('input');
  assert.deepEqual([input.min, input.max], ['2', '1000']);
  for (const value of ['13', '1001', '1', 'x']) {
    input.value = value;
    form.dispatchEvent(new doc.defaultView.Event('submit', { cancelable: true }));
  }
  assert.equal($(element, '.pool-text').textContent, '1d13');
  assert.equal(notes(element).filter((text) => /2 to 1000 sides/.test(text)).length, 3);
  const result = await element.roll('3d13+d7');
  assert.ok(result.dice.every((die) => die.value >= 1 && die.value <= die.sides));
  const dn = $$(element, '.stage2d .die.dn');
  assert.equal(dn.length, 4, 'a non-standard die is drawn as the generic polygon');
  assert.equal(dn[0].dataset.sides, 'd13');
});

test('tray.roll() logs the roll, resolves to its result and reads the total by a band set', async () => {
  const { doc } = quickWindow();
  const element = await tray(doc);
  const events = [];
  element.addEventListener('roll', (event) => events.push(event.detail));
  const result = await element.roll('2d6+2', { label: 'STR', bands: 'wod' });
  assert.equal(result.label, 'STR 2d6+2');
  assert.ok(['Miss', 'Partial success', 'Success', 'Critical success'].includes(result.band.label));
  assert.equal(events.length, 1);
  assert.equal(events[0].total, result.total);
  assert.match(logLines(element)[0], new RegExp(`STR 2d6\\+2: \\d, \\d = ${result.total}, ${result.band.label}$`));
  const kept = await element.roll('4d6kh3');
  assert.equal(kept.dice.filter((die) => die.dropped).length, 1);
  await assert.rejects(element.roll('2d6!'), /"!" after 2d6 is not a keep or drop/);
  await assert.rejects(element.roll('2d6', { bands: 'nope' }), /no band set "nope"/);
  assert.ok(notes(element).some((text) => /"2d6!" is not dice notation/.test(text)), 'a failed roll is noted in the log');
  assert.equal((await element.log()).length, 2);
});

test('the notation box rolls what is typed, pools included', async () => {
  const { doc } = quickWindow();
  const element = await tray(doc);
  const rolled = new Promise((resolve) => element.addEventListener('roll', (event) => resolve(event.detail)));
  const form = $(element, '.notation');
  form.querySelector('input').value = '2d6 + 1d8 + 3';
  form.dispatchEvent(new doc.defaultView.Event('submit', { cancelable: true }));
  assert.equal((await rolled).notation, '2d6+1d8+3');
});

test('data-roll elements roll into the nearest tray with roll-links; without roll-links nothing happens', async () => {
  const { doc } = quickWindow();
  const first = await tray(doc, '<dice-tray id="first" roll-links></dice-tray>');
  const second = await tray(doc, '<dice-tray id="second" roll-links></dice-tray>');
  const off = await tray(doc, '<dice-tray id="off"></dice-tray>');
  const page = add(doc, `<div>
    <button id="str" data-roll="2d6+2" data-roll-label="STR" data-roll-bands="wod">STR</button>
    <span id="named" data-roll="1d20" data-roll-tray="#second">d20</span></div>`);
  const inside = add(doc, '<button data-roll="1d4">d4</button>', off);
  const heard = (element) => new Promise((resolve) => element.addEventListener('roll', (event) => resolve(event.detail), { once: true }));
  const fromStr = heard(first);
  page.querySelector('#str').click();
  const str = await fromStr;
  assert.equal(str.label, 'STR 2d6+2');
  assert.ok(str.band, 'data-roll-bands reads the band');
  const fromNamed = heard(second);
  page.querySelector('#named').click();
  assert.equal((await fromNamed).notation, '1d20');
  const fromInside = heard(first);
  inside.click();
  assert.equal((await fromInside).notation, '1d4', 'the first tray with roll-links takes a link no tray of its own claims');
  assert.equal((await off.log()).length, 0, 'a tray without roll-links takes no data-roll, even from inside it');
  assert.equal((await first.log()).length, 2);
  first.removeAttribute('roll-links');
  second.removeAttribute('roll-links');
  page.querySelector('#str').click();
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal((await first.log()).length, 2, 'with roll-links off, links do nothing');
});

test('the resize handle is in the lower-right corner, with CSS resize as the fallback; it resizes, no smaller than 280 x 420', async () => {
  const { doc, win } = quickWindow();
  const element = await tray(doc);
  const grip = $(element, '.grip');
  assert.equal(grip.getAttribute('part'), 'resize-handle');
  const css = $(element, 'style').textContent;
  assert.match(css, /\.grip \{ position: absolute; right: 0; bottom: 0; width: 22px; height: 22px; cursor: nwse-resize;/);
  assert.match(css, /\.tray \{[^}]*min-width: 280px; min-height: 420px;[^}]*resize: both;/);
  grip.setPointerCapture = () => {};
  const pointer = (type, x, y) => grip.dispatchEvent(new win.PointerEvent(type, { button: 0, clientX: x, clientY: y, pointerId: 1, bubbles: true }));
  pointer('pointerdown', 1384, 984);
  pointer('pointermove', 1300, 900);
  pointer('pointerup', 1300, 900);
  const state = (await element.implementation()).windowState();
  assert.deepEqual([state.w, state.h], [300, 684]);
  pointer('pointerdown', 1300, 900);
  pointer('pointermove', 900, 300);
  pointer('pointerup', 900, 300);
  const small = (await element.implementation()).windowState();
  assert.deepEqual([small.w, small.h], [280, 420]);
});

test('the window is remembered per page under the tray\'s id', async () => {
  const { doc, win } = quickWindow({ url: 'https://host.example/sheet/' });
  const element = await tray(doc, '<dice-tray id="dice"></dice-tray>');
  $(element, '.minimize').click();
  assert.match(win.localStorage.getItem('toybox.dice-tray.window./sheet/#dice'), /"minimized":true/);
  element.remove();
  const again = await tray(doc, '<dice-tray id="dice"></dice-tray>');
  assert.ok($(again, '.tray').classList.contains('minimized'));
  const other = await tray(doc, '<dice-tray id="other"></dice-tray>');
  assert.ok(!$(other, '.tray').classList.contains('minimized'), 'another id keeps its own window');
});

test('closing shows the launcher; rolling reopens the tray', async () => {
  const { doc } = quickWindow();
  const element = await tray(doc);
  $(element, '.close').click();
  assert.deepEqual([$(element, '.tray').hidden, $(element, '.launcher').hidden], [true, false]);
  await element.roll('1d6');
  assert.deepEqual([$(element, '.tray').hidden, $(element, '.launcher').hidden], [false, true]);
});

test('removing the tray removes its 3D stage from the page and undoes its listeners', async () => {
  const { doc } = quickWindow();
  const element = await tray(doc);
  assert.equal(element.querySelectorAll('[slot="stage3d"]').length, 1);
  element.remove();
  assert.equal(element.querySelectorAll('[slot="stage3d"]').length, 0);
  await assert.rejects(element.roll('1d6'), /not on the page/);
});

test('a bad side fails loud', async () => {
  const { doc } = quickWindow();
  const element = await tray(doc, '<dice-tray side="left"></dice-tray>');
  assert.equal($(element, '.tray').style.left, '16px');
  assert.throws(() => element.setAttribute('side', 'up'), /side="up": use one of right, left/);
});
