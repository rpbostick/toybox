// <toy-background> in happy-dom, with a stand-in for the view (WebGL is not there): the layer is
// fixed behind the page and lets the pointer through, the name button cycles the element's
// effects, on/off and the mouse box are remembered, reduced motion starts it off, the theme and
// the page's --toybox-paper reach the view, the color mode and its wheel stay in step both ways,
// and controls="compact|none" show less.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mountBackground } from '../src/background/element.js';
import { STORE } from '../src/background/controls.js';
import { BUILT_IN, nextBackground, parseEffects, registerBackground } from '../src/background/backgrounds.js';
import { add, makeWindow } from './happy-window.js';

const ORDER = ['Line Waves', 'Aurora', 'Soap Film', 'Plasma', 'Starfield', 'Grid Ripples'];

/** A stand-in view that records what the element tells it. */
function fakeView() {
  const view = { mounted: null, updates: [], picks: [], unmounted: 0 };
  view.mountView = (layer, options) => {
    view.mounted = { layer, options };
    return { update: (change) => view.updates.push(change), pick: (stop) => view.picks.push(stop), unmount: () => { view.unmounted++; } };
  };
  view.loader = async () => ({ mount: (host, wrapper) => mountBackground(host, wrapper, { mountView: view.mountView }) });
  return view;
}

async function background(options = {}, html = '<toy-background></toy-background>') {
  const view = fakeView();
  const { win, doc } = makeWindow({ ...options, loaders: { 'toy-background': view.loader } });
  if (options.stored) for (const [key, value] of Object.entries(options.stored)) win.localStorage.setItem(`toybox.${key}`, value);
  const element = add(doc, html);
  await element.ready;
  const $ = (selector) => element.shadowRoot.querySelector(selector);
  return { win, doc, element, view, $ };
}

const change = (input, checked) => {
  input.checked = checked;
  input.dispatchEvent(new input.ownerDocument.defaultView.Event('change', { bubbles: true }));
};

test('the button cycles the six backgrounds in order and wraps round; effects="…" picks a subset', () => {
  assert.deepEqual(BUILT_IN.map((entry) => entry.name), ORDER);
  assert.equal(nextBackground('ripples', BUILT_IN.map((entry) => entry.id)), 'lines');
  assert.deepEqual(parseEffects('stars, lines'), ['stars', 'lines']);
  assert.throws(() => parseEffects('lava'), /no background "lava"/);
  assert.throws(() => parseEffects('lines,lines'), /named twice/);
  assert.throws(() => nextBackground('lava'), /unknown background/);
});

test('the layer is fixed behind the page and takes no pointer events; the controls sit where the element is', async () => {
  const { $, view } = await background();
  const css = $('style').textContent;
  assert.match(css, /\.layer \{ position: fixed; inset: 0; z-index: -1; pointer-events: none; \}/);
  assert.equal(view.mounted.layer, $('.layer'));
  assert.equal($('.layer').getAttribute('aria-hidden'), 'true');
  assert.ok($('.controls').compareDocumentPosition($('slot')) & 4, 'a slot follows the controls for the page\'s own content');
  assert.match(css, /@media print \{ \.layer, \.controls \{ display: none !important; \} \}/);
});

test('with nothing remembered: the first effect, on unless the system asks for reduced motion, following the mouse', async () => {
  const plain = await background();
  assert.deepEqual(plain.view.mounted.options.background, 'lines');
  assert.equal(plain.view.mounted.options.on, true);
  assert.equal(plain.view.mounted.options.interactive, true);
  assert.equal(plain.$('.name').textContent, 'Line Waves');
  const reduced = await background({ reducedMotion: 'reduce' });
  assert.equal(reduced.view.mounted.options.on, false);
  assert.equal(reduced.$('.on').checked, false);
  const subset = await background({}, '<toy-background effects="stars,plasma"></toy-background>');
  assert.equal(subset.view.mounted.options.background, 'stars');
});

test('a remembered choice wins over the defaults, reduced motion included; a remembered effect outside effects="…" does not', async () => {
  const stored = { [STORE.background]: 'stars', [STORE.on]: '1', [STORE.interactive]: '0' };
  const { view } = await background({ reducedMotion: 'reduce', stored });
  assert.deepEqual([view.mounted.options.background, view.mounted.options.on, view.mounted.options.interactive], ['stars', true, false]);
  const outside = await background({ stored }, '<toy-background effects="lines,aurora"></toy-background>');
  assert.equal(outside.view.mounted.options.background, 'lines');
  const odd = await background({ stored: { [STORE.background]: 'lava', [STORE.on]: 'maybe' } });
  assert.deepEqual([odd.view.mounted.options.background, odd.view.mounted.options.on], ['lines', true]);
});

test('pressing the name button shows the next of its effects, relabels it and remembers it', async () => {
  const { $, view, win } = await background({}, '<toy-background effects="plasma,stars"></toy-background>');
  $('.name').click();
  assert.equal($('.name').textContent, 'Starfield');
  assert.equal(view.updates.at(-1).background, 'stars');
  assert.equal(win.localStorage.getItem(`toybox.${STORE.background}`), 'stars');
  $('.name').click();
  assert.equal($('.name').textContent, 'Plasma');
});

test('the on/off box turns the background off and on, remembered; off ends the color mode and disables it', async () => {
  const { $, view, win } = await background();
  view.mounted.options.onColorModeRequest(true);
  view.mounted.options.onColorMode(true, 'Azure C', 45);
  assert.equal($('.hint').hidden, false);
  change($('.on'), false);
  assert.deepEqual([view.updates.at(-1).on, view.updates.at(-1).colorMode], [false, false]);
  assert.equal(win.localStorage.getItem(`toybox.${STORE.on}`), '0');
  assert.equal($('.hint').hidden, true);
  assert.equal($('.color-mode').checked, false);
  assert.equal($('.color-mode').disabled, true, 'no color mode without a background');
  change($('.on'), true);
  assert.equal(view.updates.at(-1).on, true);
  assert.equal($('.color-mode').disabled, false);
});

test('"Background reacts to the mouse" turns the pointer response off and on, remembered, leaving the color mode alone', async () => {
  const { $, view, win } = await background();
  view.mounted.options.onColorModeRequest(true);
  change($('.interactive'), false);
  assert.deepEqual([view.updates.at(-1).interactive, view.updates.at(-1).colorMode], [false, true]);
  assert.equal(win.localStorage.getItem(`toybox.${STORE.interactive}`), '0');
  assert.equal($('.color-mode').checked, true, 'the wheel and middle press still work with the mouse response off');
  assert.equal(win.localStorage.getItem(`toybox.${STORE.on}`), null, 'only what changed is remembered; the color mode never is');
});

test('the color mode box and a middle press (or Esc) on the background stay in step both ways', async () => {
  const { $, view } = await background();
  change($('.color-mode'), true);
  assert.equal(view.updates.at(-1).colorMode, true);
  view.mounted.options.onColorModeRequest(false);
  assert.equal($('.color-mode').checked, false);
  assert.equal(view.updates.at(-1).colorMode, false);
  view.mounted.options.onColorModeRequest(true);
  assert.equal($('.color-mode').checked, true);
});

test('the 72-colour wheel picks a stop, and its marker and the hint follow the color the view reports', async () => {
  const { $, view, element } = await background();
  const stops = element.shadowRoot.querySelectorAll('.wheel [data-stop]');
  assert.equal(stops.length, 72);
  stops[30].dispatchEvent(new element.ownerDocument.defaultView.MouseEvent('click', { bubbles: true }));
  assert.deepEqual(view.picks, [30]);
  view.mounted.options.onColorMode(true, 'Green A', 30);
  const marker = $('.wheel .marker');
  assert.notEqual(marker.getAttribute('cx'), '50');
  assert.equal($('.color-name').textContent, 'Green A');
  assert.deepEqual((await element.state()).stop, 30);
});

test('the theme and the page\'s --toybox-paper reach the view, at mount and when the theme changes', async () => {
  const { element, view, doc } = await background({ colorScheme: 'dark' });
  assert.deepEqual([view.mounted.options.theme, view.mounted.options.paper], ['dark', null]);
  const style = doc.createElement('style');
  style.textContent = 'toy-background { --toybox-paper: #123456; }';
  doc.head.append(style);
  element.setAttribute('theme', 'light');
  assert.deepEqual([view.updates.at(-1).theme, view.updates.at(-1).paper], ['light', '#123456']);
});

test('ripple, sheet, spin and momentum="off" reach the view, at mount and when changed; a bad value fails loud', async () => {
  const plain = await background();
  assert.deepEqual(plain.view.mounted.options.motion, { ripple: true, sheet: true, spin: true, momentum: true });
  const { element, view } = await background({}, '<toy-background ripple="off" spin="off"></toy-background>');
  assert.deepEqual(view.mounted.options.motion, { ripple: false, sheet: true, spin: false, momentum: true });
  element.setAttribute('momentum', 'off');
  element.setAttribute('ripple', 'on');
  assert.deepEqual(view.updates.at(-1).motion, { ripple: true, sheet: true, spin: false, momentum: false });
  element.removeAttribute('spin');
  assert.equal(view.updates.at(-1).motion.spin, true);
  assert.throws(() => element.setAttribute('sheet', 'no'), /sheet="no": use on or off/);
});

test('controls="compact" shows the name and on/off only; "none" shows nothing; a bad value fails loud', async () => {
  const compact = await background({}, '<toy-background controls="compact"></toy-background>');
  assert.equal(compact.$('.controls').dataset.mode, 'compact');
  assert.match(compact.$('style').textContent, /\.controls\[data-mode="compact"\] \.full-only \{ display: none; \}/);
  assert.ok(compact.$('.wheel').classList.contains('full-only'));
  assert.ok(!compact.$('.name').classList.contains('full-only') && !compact.$('.on').closest('label').classList.contains('full-only'));
  const none = await background({}, '<toy-background controls="none"></toy-background>');
  assert.equal(none.$('.controls').children.length, 0);
  await none.element.set({ background: 'aurora' });
  assert.equal(none.view.updates.at(-1).background, 'aurora', 'a page without controls drives it by set()');
  assert.throws(() => none.element.setAttribute('controls', 'big'), /controls="big": use one of full, compact, none/);
  await assert.rejects(none.element.set({ background: 'lava' }), /not one of its effects/);
});

test('every change fires background-change; removing the element unmounts the view', async () => {
  const { element, view, $ } = await background();
  const heard = [];
  element.addEventListener('background-change', (event) => heard.push(event.detail.background));
  $('.name').click();
  assert.deepEqual(heard, ['aurora']);
  element.remove();
  assert.equal(view.unmounted, 1);
});

// Last in the file: a registered background stays registered for the rest of it.
test('registerBackground checks what it is given, and an element showing every background takes the new one in', async () => {
  const { $, element, view } = await background();
  const subset = await background({}, '<toy-background effects="plasma"></toy-background>');
  const mount = () => ({ destroy() {} });
  assert.throws(() => registerBackground('Bad id', { name: 'Glow', mount }), /lower-case letters/);
  assert.throws(() => registerBackground('aurora', { name: 'Glow', mount }), /"aurora" is already a background/);
  assert.throws(() => registerBackground('test-glow', { mount }), /name must be the text its button shows/);
  assert.throws(() => registerBackground('test-glow', { name: 'Glow' }), /mount\(el, api\) must be a function/);
  assert.throws(() => registerBackground('test-glow', { name: 'Glow', mount, pause: true }), /pause must be a function/);
  assert.equal(element.effects.includes('test-glow'), false);
  registerBackground('test-glow', { name: 'Glow', mount });
  assert.equal(element.effects.at(-1), 'test-glow');
  await element.set({ background: 'test-glow' });
  assert.equal($('.name').textContent, 'Glow');
  assert.equal(view.updates.at(-1).background, 'test-glow');
  assert.deepEqual(subset.element.effects, ['plasma'], 'an element with effects="…" keeps its own list');
  assert.throws(() => registerBackground('test-glow', { name: 'Glow', mount }), /already a background/);
  // Another copy of the library on the page (a site's bundle beside the script tag) shares the list.
  const other = await import('../src/background/backgrounds.js?another-copy');
  other.registerBackground('test-from-copy', { name: 'From a copy', mount });
  assert.equal(element.effects.at(-1), 'test-from-copy');
});
