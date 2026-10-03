// <toy-drawer> and <toy-box> in happy-dom (a DOM with custom elements and shadow roots, but no
// canvas): they register once, render the cards a toys="…" attribute names, open toys from a
// catalog of DOM-only test toys, follow the theme and reduced motion, and pause when hidden.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { setAssetBase } from '../src/assets.js';
import { CATALOG } from '../src/catalog.js';
import { defineElements, ELEMENTS } from '../src/elements/registry.js';
import { parseToyList } from '../src/elements/toy-drawer.js';
import { defineToy } from '../src/runtime.js';

setAssetBase('https://cdn.example/toybox/');

// Closed here as well as in each test, so a failing test does not leave frames running.
const windows = [];
after(() => Promise.all(windows.map((win) => win.happyDOM.close())));

/** A toy that only adds a <p> saying how it was mounted; it records what happened to it. */
function testToy(id, log) {
  return defineToy({ id, name: `Toy ${id}`, licence: 'MIT' }, (ctx) => {
    log.push(`mount ${id} ${ctx.theme}${ctx.reducedMotion ? ' reduced' : ''}`);
    ctx.add(ctx.element('p', { className: 'test-toy', textContent: `${id} ${ctx.theme}` }));
    ctx.onFrame(() => {});
    return { reset() { log.push(`reset ${id}`); }, destroy() { log.push(`destroy ${id}`); } };
  });
}

function testCatalog(log) {
  return ['alpha', 'beta', 'gamma'].map((id) => {
    const toy = testToy(id, log);
    return { id, name: toy.name, licence: 'MIT', credit: 'Made for the tests', load: async () => ({ default: toy }) };
  });
}

/** A window with the elements defined; IntersectionObserver is a stub the test can drive. */
function makeWindow({ catalog, colorScheme = 'light', reducedMotion = 'no-preference' } = {}) {
  const win = new Window({ url: 'https://host.example/page/', settings: { device: { prefersColorScheme: colorScheme, prefersReducedMotion: reducedMotion } } });
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
  defineElements({ win, catalog: catalog ?? CATALOG });
  return { win, doc: win.document, observers, setTabHidden };
}

function add(doc, html) {
  const holder = doc.createElement('div');
  holder.innerHTML = html;
  const element = holder.firstElementChild;
  doc.body.append(element);
  return element;
}

/** Resolves when the element next reports an open toy (a running toy keeps frames queued, so
 * happy-dom's whenAsyncComplete would never resolve). */
const opened = (element) => new Promise((resolve) => {
  const listener = (event) => {
    if (event.detail.id === null) return;
    element.removeEventListener('toy-change', listener);
    resolve(event.detail);
  };
  element.addEventListener('toy-change', listener);
});

const cardIds =(drawer) => [...drawer.shadowRoot.querySelectorAll('.card')].map((card) => card.dataset.toy);

test('the elements register once; loading the library again defines nothing new', async () => {
  const { win } = makeWindow();
  for (const { tag } of ELEMENTS) assert.ok(win.customElements.get(tag), `${tag} is defined`);
  assert.deepEqual(defineElements({ win }), [], 'a second call defines nothing and does not throw');
  await win.happyDOM.close();
});

test('a tag already taken by other code fails loud', async () => {
  const win = new Window();
  win.customElements.define('toy-drawer', class extends win.HTMLElement {});
  assert.throws(() => defineElements({ win }), /<toy-drawer> is already defined by other code/);
  await win.happyDOM.close();
});

test('<toy-drawer> shows every toy by default, in catalogue order, with credits', async () => {
  const { win, doc } = makeWindow();
  const drawer = add(doc, '<toy-drawer></toy-drawer>');
  assert.deepEqual(cardIds(drawer), CATALOG.map((meta) => meta.id));
  assert.equal(drawer.shadowRoot.querySelectorAll('.credits li').length, CATALOG.length);
  assert.equal(drawer.shadowRoot.querySelector('.licences').href, 'https://cdn.example/toybox/THIRD_PARTY_LICENSES.txt');
  assert.equal(drawer.shadowRoot.querySelector('.panel').hidden, true, 'no panel until a toy opens');
  await win.happyDOM.close();
});

test('<toy-drawer toys="…"> shows that subset in that order, and follows changes', async () => {
  const { win, doc } = makeWindow();
  const drawer = add(doc, '<toy-drawer toys="zen-garden, pin-art,newtons-cradle"></toy-drawer>');
  assert.deepEqual(cardIds(drawer), ['zen-garden', 'pin-art', 'newtons-cradle']);
  assert.deepEqual([...drawer.shadowRoot.querySelectorAll('.credits strong')].map((node) => node.textContent), ['Zen sand garden', 'Pin art', "Newton's cradle"]);
  drawer.setAttribute('toys', 'music-box');
  assert.deepEqual(cardIds(drawer), ['music-box']);
  assert.match(drawer.shadowRoot.querySelector('.credits li').innerHTML, /href="https:\/\/cdn\.example\/toybox\/music-box\/source\.zip"/);
  await win.happyDOM.close();
});

test('toys="…" with an unknown, repeated or empty list fails loud', () => {
  assert.throws(() => parseToyList('pin-art,nope', CATALOG), /no toy "nope"/);
  assert.throws(() => parseToyList('pin-art,pin-art', CATALOG), /named twice/);
  assert.throws(() => parseToyList(' , ', CATALOG), /name at least one toy/);
  assert.equal(parseToyList(null, CATALOG), CATALOG);
});

test('opening a card mounts the toy in the panel; Pause, Reset and Close work', async () => {
  const log = [];
  const { win, doc } = makeWindow({ catalog: testCatalog(log) });
  const drawer = add(doc, '<toy-drawer toys="beta,alpha"></toy-drawer>');
  const root = drawer.shadowRoot;
  const changes = [];
  drawer.addEventListener('toy-change', (event) => changes.push(event.detail.id));
  const opening = opened(drawer);
  root.querySelector('.card[data-toy="alpha"]').click();
  await opening;
  assert.equal(drawer.state.id, 'alpha');
  assert.equal(root.querySelector('.panel').hidden, false);
  assert.equal(root.querySelector('#title').textContent, 'Toy alpha');
  assert.equal(root.querySelector('.stage .test-toy').textContent, 'alpha light');
  assert.equal(root.querySelector('.card[data-toy="alpha"]').getAttribute('aria-pressed'), 'true');
  root.querySelector('.pause').click();
  assert.equal(drawer.state.running, false);
  assert.equal(root.querySelector('.pause').textContent, 'Play');
  root.querySelector('.reset').click();
  assert.ok(log.includes('reset alpha'));
  root.querySelector('.close').click();
  assert.equal(root.querySelector('.panel').hidden, true);
  assert.equal(root.querySelector('.stage').children.length, 0);
  assert.deepEqual(changes.at(-1), null);
  await assert.rejects(drawer.open('gamma'), /no toy "gamma" in this drawer/, 'a toy left out by toys= cannot be opened');
  await win.happyDOM.close();
});

test('theme="dark" mounts toys dark; changing the attribute re-mounts them in the new theme', async () => {
  const log = [];
  const { win, doc } = makeWindow({ catalog: testCatalog(log) });
  const drawer = add(doc, '<toy-drawer theme="dark"></toy-drawer>');
  assert.equal(drawer.shadowRoot.querySelector('.toybox').dataset.theme, 'dark');
  await drawer.open('beta');
  const remounted = opened(drawer);
  drawer.setAttribute('theme', 'light');
  await remounted;
  assert.equal(drawer.shadowRoot.querySelector('.toybox').dataset.theme, 'light');
  assert.deepEqual(log, ['mount beta dark', 'destroy beta', 'mount beta light']);
  assert.throws(() => drawer.setAttribute('theme', 'sepia'), /theme="sepia": use one of light, dark, auto/);
  await win.happyDOM.close();
});

test('theme="auto" (the default) follows the system colour scheme', async () => {
  const log = [];
  const { win, doc } = makeWindow({ catalog: testCatalog(log), colorScheme: 'dark' });
  const drawer = add(doc, '<toy-drawer></toy-drawer>');
  await drawer.open('alpha');
  assert.deepEqual(log, ['mount alpha dark']);
  await win.happyDOM.close();
});

test('under prefers-reduced-motion toys open paused, and Play starts them', async () => {
  const log = [];
  const { win, doc } = makeWindow({ catalog: testCatalog(log), reducedMotion: 'reduce' });
  const box = add(doc, '<toy-box toy="gamma"></toy-box>');
  await box.loaded;
  assert.deepEqual(log, ['mount gamma light reduced']);
  assert.equal(box.state.running, false);
  assert.equal(box.shadowRoot.querySelector('.pause').textContent, 'Play');
  box.shadowRoot.querySelector('.pause').click();
  assert.equal(box.state.running, true);
  await win.happyDOM.close();
});

test('a hidden tab or an off-screen element pauses the toy, and showing it resumes it', async () => {
  const log = [];
  const { win, doc, observers, setTabHidden } = makeWindow({ catalog: testCatalog(log) });
  const box = add(doc, '<toy-box toy="alpha"></toy-box>');
  await box.loaded;
  assert.equal(box.state.running, true);
  setTabHidden(true);
  assert.equal(box.state.running, false, 'hidden tab');
  setTabHidden(false);
  assert.equal(box.state.running, true);
  const observer = observers.find((item) => item.targets.includes(box));
  observer.show(false);
  assert.equal(box.state.running, false, 'scrolled off screen');
  observer.show(true);
  assert.equal(box.state.running, true);
  box.shadowRoot.querySelector('.pause').click();
  observer.show(false);
  observer.show(true);
  assert.equal(box.state.running, false, 'paused by the user stays paused');
  await win.happyDOM.close();
});

test('a toy that finishes loading while its box is off screen starts paused', async () => {
  const { win, doc, observers } = makeWindow({ catalog: testCatalog([]) });
  const box = add(doc, '<toy-box toy="beta"></toy-box>');
  observers.find((item) => item.targets.includes(box)).show(false); // before the load resolves
  await box.loaded;
  assert.equal(box.state.running, false);
  observers.find((item) => item.targets.includes(box)).show(true);
  assert.equal(box.state.running, true);
  await win.happyDOM.close();
});

test('<toy-drawer> watches its panel for being on screen', async () => {
  const { win, doc, observers } = makeWindow({ catalog: testCatalog([]) });
  const drawer = add(doc, '<toy-drawer></toy-drawer>');
  await drawer.open('alpha');
  const observer = observers.find((item) => item.targets.includes(drawer.shadowRoot.querySelector('.panel')));
  observer.show(false);
  assert.equal(drawer.state.running, false);
  observer.show(true);
  assert.equal(drawer.state.running, true);
  await win.happyDOM.close();
});

test('several <toy-box>es show the same toy, each its own instance; removing one stops only it', async () => {
  const log = [];
  const { win, doc } = makeWindow({ catalog: testCatalog(log) });
  const first = add(doc, '<toy-box toy="beta"></toy-box>');
  const second = add(doc, '<toy-box toy="beta"></toy-box>');
  await Promise.all([first.loaded, second.loaded]);
  assert.equal(first.shadowRoot.querySelector('.test-toy').textContent, 'beta light');
  assert.equal(second.shadowRoot.querySelector('.test-toy').textContent, 'beta light');
  assert.equal(first.shadowRoot.querySelector('.title').textContent, 'Toy beta');
  first.remove();
  assert.deepEqual(log, ['mount beta light', 'mount beta light', 'destroy beta']);
  assert.equal(second.state.running, true);
  second.setAttribute('toy', 'gamma');
  await second.loaded;
  assert.equal(second.shadowRoot.querySelector('.test-toy').textContent, 'gamma light');
  await win.happyDOM.close();
});

test('<toy-box> without a known toy says so and fails loud', async () => {
  const { win, doc } = makeWindow({ catalog: testCatalog([]) });
  const box = doc.createElement('toy-box');
  assert.throws(() => doc.body.append(box), /no such toy/);
  assert.match(box.shadowRoot.querySelector('.error').textContent, /<toy-box toy="">: no such toy; the toys are alpha, beta, gamma/);
  assert.throws(() => box.setAttribute('toy', 'nope'), /toy="nope"/);
  box.setAttribute('toy', 'alpha');
  await box.loaded;
  assert.equal(box.state.id, 'alpha', 'naming a known toy afterwards opens it');
  assert.equal(box.shadowRoot.querySelector('.error'), null);
  await win.happyDOM.close();
});

test('panel="floating" makes the drawer a window and back; a bad value fails loud', async () => {
  const { win, doc } = makeWindow({ catalog: testCatalog([]) });
  const drawer = add(doc, '<toy-drawer panel="floating"></toy-drawer>');
  const wrapper = drawer.shadowRoot.querySelector('.toybox');
  assert.equal(wrapper.dataset.panel, 'floating');
  const frame = drawer.shadowRoot.querySelector('.drawer-window');
  assert.deepEqual([frame.getAttribute('role'), frame.style.left === ''], ['dialog', false]);
  drawer.setAttribute('panel', 'inline');
  assert.equal(wrapper.dataset.panel, 'inline');
  assert.deepEqual([frame.getAttribute('role'), frame.style.left, frame.style.zIndex], [null, '', ''], 'inline leaves no window behind');
  assert.throws(() => drawer.setAttribute('panel', 'sideways'), /panel="sideways": use one of inline, floating/);
  await win.happyDOM.close();
});
