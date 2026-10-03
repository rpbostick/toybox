// <toy-drawer panel="floating"> in happy-dom: the drawer is a window (moved, resized, minimized,
// closed to its launcher, remembered), and each toy opens in a window of its own, several at
// once, under the page's running cap. Animation frames and window listeners are counted, as
// tests/fake-dom.js counts them, to show a closed window leaves nothing running.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { setAssetBase } from '../src/assets.js';
import { defineElements } from '../src/elements/registry.js';
import { CASCADE, TOY_WINDOW_SIZE } from '../src/elements/toy-windows.js';
import { STACK_BASE } from '../src/elements/window.js';
import { defineToy } from '../src/runtime.js';

setAssetBase('https://cdn.example/toybox/');

const windows = [];
after(() => Promise.all(windows.map((win) => win.happyDOM.close())));

/** A DOM-only toy that listens on the window while mounted and records what happened to it. */
function testCatalog(log) {
  return ['alpha', 'beta', 'gamma', 'delta'].map((id) => {
    const toy = defineToy({ id, name: `Toy ${id}`, licence: 'MIT' }, (ctx) => {
      log.push(`mount ${id} ${ctx.theme}`);
      ctx.add(ctx.element('p', { className: 'test-toy', textContent: id }));
      ctx.listen(ctx.win, 'resize', () => {});
      ctx.onFrame(() => {});
      return { reset() { log.push(`reset ${id}`); }, destroy() { log.push(`destroy ${id}`); } };
    });
    return { id, name: toy.name, licence: 'MIT', credit: 'Made for the tests', load: async () => ({ default: toy }) };
  });
}

/**
 * A 1400 x 1000 window with the elements defined. Animation frames are kept, never run, so
 * `frames` holds one per running toy; `listeners` counts what is listening on the window.
 */
function makeWindow({ reducedMotion = 'no-preference' } = {}) {
  const log = [];
  const win = new Window({ url: 'https://host.example/page/', width: 1400, height: 1000, settings: { device: { prefersColorScheme: 'light', prefersReducedMotion: reducedMotion } } });
  windows.push(win);
  const observers = [];
  win.IntersectionObserver = class {
    constructor(callback) { this.callback = callback; this.targets = []; observers.push(this); }
    observe(target) { this.targets.push(target); }
    disconnect() { this.targets = []; }
    show(isIntersecting) { this.callback(this.targets.map((target) => ({ target, isIntersecting }))); }
  };
  let hidden = false;
  Object.defineProperty(win.document, 'hidden', { get: () => hidden, configurable: true });
  const setTabHidden = (value) => {
    hidden = value;
    win.document.dispatchEvent(new win.Event('visibilitychange'));
  };
  const frames = new Map();
  let nextFrame = 1;
  win.requestAnimationFrame = (callback) => { frames.set(nextFrame, callback); return nextFrame++; };
  win.cancelAnimationFrame = (id) => { frames.delete(id); };
  const listening = new Set();
  const add = win.addEventListener.bind(win);
  const remove = win.removeEventListener.bind(win);
  const forget = (type, handler) => { for (const item of listening) if (item.type === type && item.handler === handler) listening.delete(item); };
  win.addEventListener = (type, handler, options) => {
    add(type, handler, options);
    listening.add({ type, handler });
    options?.signal?.addEventListener('abort', () => forget(type, handler));
  };
  win.removeEventListener = (type, handler, options) => {
    remove(type, handler, options);
    forget(type, handler);
  };
  defineElements({ win, catalog: testCatalog(log) });
  return { win, doc: win.document, log, observers, frames, listeners: () => listening.size, setTabHidden };
}

function add(doc, html) {
  const holder = doc.createElement('div');
  holder.innerHTML = html;
  const element = holder.firstElementChild;
  doc.body.append(element);
  return element;
}

const toyWindow = (drawer, id) => drawer.shadowRoot.querySelector(`.toy-window[data-toy="${id}"]`);
const place = (box) => ['left', 'top', 'width', 'height'].map((key) => box.style[key]);
const key = (target, name, win, shiftKey = false) => target.dispatchEvent(new win.KeyboardEvent('keydown', { key: name, shiftKey, bubbles: true, composed: true }));
const running = (drawer) => Object.fromEntries(drawer.windows.map((item) => [item.id, item.running]));

test('the floating drawer is a window at the lower left: arrow keys move it, it minimizes and restores, closes to its launcher, and is remembered', async () => {
  const { win, doc } = makeWindow();
  const drawer = add(doc, '<toy-drawer id="toys" panel="floating"></toy-drawer>');
  const root = drawer.shadowRoot;
  const frame = root.querySelector('.drawer-window');
  assert.deepEqual(place(frame), ['16px', '464px', '440px', '520px']);
  assert.deepEqual([frame.getAttribute('role'), frame.getAttribute('aria-modal'), root.querySelector('.drawer-bar').tabIndex], ['dialog', 'false', 0]);
  assert.equal(root.querySelector('.launcher').hidden, true);
  key(root.querySelector('.drawer-bar'), 'ArrowRight', win, true);
  key(root.querySelector('.drawer-bar'), 'ArrowUp', win);
  assert.deepEqual(place(frame).slice(0, 2), ['66px', '454px']);
  root.querySelector('.window-minimize').click();
  assert.ok(frame.classList.contains('minimized'));
  assert.equal(frame.style.height, '');
  root.querySelector('.window-minimize').click();
  assert.equal(frame.style.height, '520px');
  root.querySelector('.window-close').click();
  assert.deepEqual([frame.hidden, root.querySelector('.launcher').hidden], [true, false]);

  drawer.remove();
  const again = add(doc, '<toy-drawer id="toys" panel="floating"></toy-drawer>');
  const kept = again.shadowRoot.querySelector('.drawer-window');
  assert.deepEqual([kept.hidden, ...place(kept).slice(0, 2)], [true, '66px', '454px'], 'closed and moved, as it was left');
  again.shadowRoot.querySelector('.launcher').click();
  assert.deepEqual([kept.hidden, again.shadowRoot.querySelector('.launcher').hidden], [false, true]);
  assert.deepEqual(again.windowState, { x: 66, y: 454, w: 440, h: 520, open: true, minimized: false });
});

test('two toys open in two windows side by side, cascading from the drawer; opening one again brings it to the front', async () => {
  const { doc } = makeWindow();
  const drawer = add(doc, '<toy-drawer panel="floating"></toy-drawer>');
  const root = drawer.shadowRoot;
  await drawer.open('alpha');
  await drawer.open('beta');
  const [alpha, beta] = [toyWindow(drawer, 'alpha'), toyWindow(drawer, 'beta')];
  // Beside the drawer (16 + 440 + 16), then one cascade step on.
  assert.deepEqual(place(alpha), ['472px', '464px', `${TOY_WINDOW_SIZE.w}px`, `${TOY_WINDOW_SIZE.h}px`]);
  assert.deepEqual(place(beta).slice(0, 2), [`${472 + CASCADE}px`, '480px'], 'pulled up to stay on screen');
  assert.equal(alpha.querySelector('.test-toy').textContent, 'alpha');
  assert.equal(alpha.querySelector('h2').textContent, 'Toy alpha');
  assert.deepEqual([alpha.getAttribute('role'), alpha.getAttribute('aria-labelledby'), alpha.querySelector('.bar').tabIndex], ['dialog', 'toy-window-alpha', 0]);
  assert.deepEqual(running(drawer), { alpha: true, beta: true });
  assert.equal(drawer.state.id, 'beta', 'the state is the window focused last');
  assert.ok(Number(beta.style.zIndex) > Number(alpha.style.zIndex));
  assert.equal(root.querySelector('.card[data-toy="alpha"]').getAttribute('aria-pressed'), 'true');

  await drawer.open('alpha');
  assert.equal(root.querySelectorAll('.toy-window').length, 2, 'a toy has one window');
  assert.ok(Number(alpha.style.zIndex) > Number(beta.style.zIndex));
  assert.equal(drawer.state.id, 'alpha');
  beta.dispatchEvent(new doc.defaultView.PointerEvent('pointerdown', { bubbles: true }));
  assert.equal(Number(beta.style.zIndex), STACK_BASE + 2, 'a press brings a window to the front');
  assert.equal(drawer.state.id, 'beta');
  root.querySelector('.card[data-toy="gamma"]').click();
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.deepEqual(drawer.windows.map((item) => item.id), ['gamma', 'beta', 'alpha']);
});

test('closing a toy window destroys its toy: no animation frame or window listener is left', async () => {
  const { doc, log, frames, listeners } = makeWindow();
  const drawer = add(doc, '<toy-drawer panel="floating"></toy-drawer>');
  const quiet = listeners();
  await drawer.open('alpha');
  await drawer.open('beta');
  assert.equal(frames.size, 2);
  assert.ok(listeners() > quiet);
  toyWindow(drawer, 'alpha').querySelector('.close').click();
  assert.equal(toyWindow(drawer, 'alpha'), null);
  assert.equal(frames.size, 1);
  key(toyWindow(drawer, 'beta').querySelector('.stage'), 'Escape', doc.defaultView);
  assert.equal(toyWindow(drawer, 'beta'), null, 'Escape closes the window it is pressed in');
  assert.equal(drawer.shadowRoot.querySelector('.drawer-window').hidden, false, 'and only that window');
  assert.deepEqual([frames.size, listeners()], [0, quiet]);
  assert.deepEqual(log.filter((line) => line.startsWith('destroy')), ['destroy alpha', 'destroy beta']);
  assert.deepEqual([drawer.windows, drawer.state.id], [[], null]);
  await drawer.open('gamma');
  drawer.remove();
  assert.deepEqual([frames.size, listeners()], [0, 0], 'removing the drawer takes down its windows too');
});

test('the running cap runs the most recently focused toys and pauses the rest, with a resume overlay', async () => {
  const { doc, frames } = makeWindow();
  const drawer = add(doc, '<toy-drawer panel="floating" max-running="2"></toy-drawer>');
  for (const id of ['alpha', 'beta', 'gamma']) await drawer.open(id);
  assert.deepEqual(running(drawer), { alpha: false, beta: true, gamma: true });
  assert.equal(frames.size, 2);
  const overlay = toyWindow(drawer, 'alpha').querySelector('.held');
  assert.deepEqual([overlay.hidden, overlay.textContent], [false, 'Paused, click to resume']);
  assert.equal(toyWindow(drawer, 'beta').querySelector('.held').hidden, true);
  assert.equal(toyWindow(drawer, 'alpha').querySelector('.pause').textContent, 'Pause', 'the user did not pause it');
  overlay.click();
  assert.deepEqual(running(drawer), { alpha: true, beta: false, gamma: true });
  assert.equal(overlay.hidden, true);
  drawer.setAttribute('max-running', '3');
  assert.deepEqual(running(drawer), { alpha: true, beta: true, gamma: true });
  assert.throws(() => drawer.setAttribute('max-running', '0'), /max-running="0": use a whole number of toys, 1 or more/);
  assert.throws(() => drawer.setAttribute('max-running', 'lots'), /max-running="lots"/);
});

test('a toy the user paused does not count towards the cap, and Play waits for its turn', async () => {
  const { doc } = makeWindow();
  const drawer = add(doc, '<toy-drawer panel="floating" max-running="1"></toy-drawer>');
  await drawer.open('alpha');
  toyWindow(drawer, 'alpha').querySelector('.pause').click();
  await drawer.open('beta');
  assert.deepEqual(running(drawer), { alpha: false, beta: true });
  assert.equal(toyWindow(drawer, 'alpha').querySelector('.held').hidden, true, 'paused by the user, not by the cap');
  toyWindow(drawer, 'alpha').querySelector('.pause').click();
  assert.deepEqual(running(drawer), { alpha: true, beta: false }, 'pressing Play focuses it, so it runs and the other waits');
});

test('the cap is page-wide: two floating drawers share it', async () => {
  const { doc } = makeWindow();
  const first = add(doc, '<toy-drawer id="one" panel="floating" toys="alpha,beta" max-running="2"></toy-drawer>');
  const second = add(doc, '<toy-drawer id="two" panel="floating" toys="gamma,delta"></toy-drawer>');
  await first.open('alpha');
  await first.open('beta');
  await second.open('gamma');
  assert.deepEqual({ ...running(first), ...running(second) }, { alpha: false, beta: true, gamma: true });
  first.remove();
  await second.open('delta');
  assert.deepEqual(running(second), { gamma: true, delta: true }, 'with the first drawer gone its limit no longer applies');
});

test('a minimized window pauses its toy, restoring runs it, and a hidden tab or off-screen window pauses it too', async () => {
  const { doc, observers, setTabHidden } = makeWindow();
  const drawer = add(doc, '<toy-drawer panel="floating"></toy-drawer>');
  await drawer.open('alpha');
  const box = toyWindow(drawer, 'alpha');
  box.querySelector('.minimize').click();
  assert.deepEqual(drawer.windows.map((item) => [item.running, item.minimized]), [[false, true]]);
  assert.equal(box.querySelector('.held').hidden, true, 'no overlay on a minimized window');
  box.querySelector('.minimize').click();
  assert.equal(drawer.windows[0].running, true);
  setTabHidden(true);
  assert.equal(drawer.windows[0].running, false);
  setTabHidden(false);
  assert.equal(drawer.windows[0].running, true);
  const observer = observers.find((item) => item.targets.includes(box));
  observer.show(false);
  assert.equal(drawer.windows[0].running, false);
  observer.show(true);
  assert.equal(drawer.windows[0].running, true);
  await drawer.open('beta');
  box.querySelector('.minimize').click();
  await drawer.open('alpha');
  assert.deepEqual([drawer.windows[0].id, drawer.windows[0].minimized, drawer.windows[0].running], ['alpha', false, true], 'opening a minimized toy restores it');
});

test('which toys are open, where and how big, and minimized, is remembered for the page', async () => {
  const { win, doc, log } = makeWindow();
  const drawer = add(doc, '<toy-drawer id="toys" panel="floating"></toy-drawer>');
  await drawer.open('alpha');
  await drawer.open('beta');
  await drawer.open('gamma');
  key(toyWindow(drawer, 'alpha').querySelector('.bar'), 'ArrowLeft', win, true);
  toyWindow(drawer, 'beta').querySelector('.minimize').click();
  const gammaPlace = place(toyWindow(drawer, 'gamma'));
  toyWindow(drawer, 'gamma').querySelector('.close').click();
  const before = ['alpha', 'beta'].map((id) => place(toyWindow(drawer, id)));
  drawer.remove();
  assert.equal(log.filter((line) => line.startsWith('destroy')).length, 3);

  const again = add(doc, '<toy-drawer id="toys" panel="floating"></toy-drawer>');
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.deepEqual(again.windows.map((item) => item.id).sort(), ['alpha', 'beta']);
  assert.deepEqual(['alpha', 'beta'].map((id) => place(toyWindow(again, id))), before);
  assert.equal(place(toyWindow(again, 'alpha'))[0], '422px', 'moved 50 px left');
  assert.deepEqual(again.windows.find((item) => item.id === 'beta').minimized, true);
  await again.open('gamma');
  assert.deepEqual(place(toyWindow(again, 'gamma')), gammaPlace, 'a closed toy reopens where its window was');

  const other = add(doc, '<toy-drawer id="elsewhere" panel="floating"></toy-drawer>');
  assert.deepEqual(other.windows, [], 'another drawer on the page keeps its own');
});

test('theme changes re-mount every open window in the new theme', async () => {
  const { doc, log } = makeWindow();
  const drawer = add(doc, '<toy-drawer panel="floating" theme="light"></toy-drawer>');
  await drawer.open('alpha');
  await drawer.open('beta');
  drawer.setAttribute('theme', 'dark');
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.deepEqual(log.filter((line) => line.startsWith('mount')), ['mount alpha light', 'mount beta light', 'mount alpha dark', 'mount beta dark']);
});

test('panel="inline" keeps one toy in the panel under the cards, with no windows', async () => {
  const { doc } = makeWindow();
  const drawer = add(doc, '<toy-drawer></toy-drawer>');
  await drawer.open('alpha');
  await drawer.open('beta');
  const root = drawer.shadowRoot;
  assert.deepEqual([root.querySelectorAll('.toy-window').length, root.querySelector('.panel').hidden, drawer.state.id], [0, false, 'beta']);
  assert.deepEqual(drawer.windows, []);
  assert.equal(drawer.windowState, null);
  drawer.setAttribute('panel', 'floating');
  assert.deepEqual([drawer.state.id, root.querySelector('.panel .stage').children.length], [null, 0], 'switching to floating closes the inline toy');
});
