// <draw-layer>'s Draw button: in any corner by corner="…" or its "⋯" menu, dragged anywhere by
// its grip but kept on screen, Reset position, the place remembered per page, the tool bar
// opening toward the middle of the window; and toggles-scope="browser".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DOCK_CSS } from '../src/draw/button-dock.js';
import { MARGIN, anchors, cornerSpot, keepOnScreen, parsePlace, serializePlace } from '../src/draw/button-place.js';
import { memoryStore, useStore } from '../src/draw/store.js';
import { add, makeWindow } from './happy-window.js';

useStore(memoryStore());

const VIEW = { width: 1400, height: 1000 };
const HEAD = { width: 120, height: 40 };

test('each corner puts the button 16 px in from both of its edges', () => {
  assert.deepEqual(cornerSpot('bottom-left', VIEW, HEAD), { x: 16, y: 944 });
  assert.deepEqual(cornerSpot('bottom-right', VIEW, HEAD), { x: 1264, y: 944 });
  assert.deepEqual(cornerSpot('top-left', VIEW, HEAD), { x: 16, y: 16 });
  assert.deepEqual(cornerSpot('top-right', VIEW, HEAD), { x: 1264, y: 16 });
  assert.throws(() => cornerSpot('middle', VIEW, HEAD), /corner "middle" is not one of bottom-left, bottom-right, top-left, top-right/);
});

test('a spot is pulled fully on screen and clear of the edges; a window too small keeps its start in sight', () => {
  assert.deepEqual(keepOnScreen({ x: -300, y: 5000 }, VIEW, HEAD), { x: MARGIN, y: 1000 - 40 - MARGIN });
  assert.deepEqual(keepOnScreen({ x: 5000, y: -1 }, VIEW, HEAD), { x: 1400 - 120 - MARGIN, y: MARGIN });
  assert.deepEqual(keepOnScreen({ x: 700, y: 500 }, VIEW, HEAD), { x: 700, y: 500 });
  assert.deepEqual(keepOnScreen({ x: 50, y: 50 }, { width: 100, height: 50 }, HEAD), { x: MARGIN, y: MARGIN });
});

test('the tool bar opens toward the middle: pinned on the side nearest the button', () => {
  assert.deepEqual(anchors({ corner: 'bottom-left', spot: null }, VIEW, HEAD), {
    open: { x: 'right', y: 'up' }, css: { left: '16px', right: 'auto', top: 'auto', bottom: '16px' },
  });
  assert.deepEqual(anchors({ corner: 'top-right', spot: null }, VIEW, HEAD), {
    open: { x: 'left', y: 'down' }, css: { left: 'auto', right: '16px', top: '16px', bottom: 'auto' },
  });
  assert.deepEqual(anchors({ corner: 'top-right', spot: { x: 1000, y: 700 } }, VIEW, HEAD), {
    open: { x: 'left', y: 'up' }, css: { left: 'auto', right: '280px', top: 'auto', bottom: '260px' },
  }, 'a dragged button opens from where it is, whatever its corner');
  assert.deepEqual(anchors({ corner: 'bottom-left', spot: { x: -50, y: 9999 } }, VIEW, HEAD).css.bottom, '16px', 'kept on screen');
  assert.match(DOCK_CSS, /\.dock\[data-open-y="up"\] \{ flex-direction: column-reverse; \}/);
  assert.match(DOCK_CSS, /\.dock\[data-open-x="left"\] \{ align-items: flex-end; \}/);
});

test('the remembered place round-trips; anything else reads as none', () => {
  for (const place of [{ corner: 'top-left', spot: null }, { corner: 'bottom-right', spot: { x: 12.5, y: 300 } }]) {
    assert.deepEqual(parsePlace(serializePlace(place)), place);
  }
  for (const text of [null, '', 'nope', '[]', '{"corner":"middle","spot":null}', '{"corner":"top-left","spot":{"x":"1","y":2}}', '{"corner":"top-left"}']) {
    assert.equal(parsePlace(text), null, text);
  }
});

async function page(html, url = 'https://host.example/sheet/') {
  const { win, doc } = makeWindow({ url, width: VIEW.width, height: VIEW.height });
  // happy-dom lays nothing out; the button measures the window inside its scroll bars.
  Object.defineProperties(doc.documentElement, { clientWidth: { value: VIEW.width }, clientHeight: { value: VIEW.height } });
  doc.body.innerHTML = html;
  const layers = [...doc.querySelectorAll('draw-layer')];
  await Promise.all(layers.map((layer) => layer.ready));
  return { win, doc, layer: layers[0], dock: (layer = layers[0]) => layer.shadowRoot.querySelector('.dock') };
}

const pinned = (dock) => ['left', 'right', 'top', 'bottom'].map((side) => dock.style[side]);
const dockOf = (layer) => layer.shadowRoot.querySelector('.dock');

/** The same layer taken off the page and put back, as on the page's next visit. */
async function reload(doc, layer) {
  const html = layer.outerHTML;
  layer.remove();
  const again = add(doc, html);
  await again.ready;
  return again;
}

test('the button sits in the lower left by default and in the corner="…" given; a bad corner fails loud', async () => {
  const { doc, dock } = await page('<div id="card"></div><draw-layer id="ink" for="#card"></draw-layer>');
  assert.deepEqual(pinned(dock()), ['16px', 'auto', 'auto', '16px']);
  assert.deepEqual([dock().dataset.openX, dock().dataset.openY], ['right', 'up']);
  assert.ok(dock().querySelector('.head .draw'), 'the Draw button is in the button\'s head, not the tool bar');
  const other = add(doc, '<draw-layer id="ink2" for="#card" corner="top-right"></draw-layer>');
  await other.ready;
  assert.deepEqual(pinned(dock(other)), ['auto', '16px', '16px', 'auto']);
  other.setAttribute('corner', 'bottom-right');
  assert.deepEqual(pinned(dock(other)), ['auto', '16px', 'auto', '16px'], 'a changed corner moves it');
  assert.throws(() => add(doc, '<draw-layer id="ink3" for="#card" corner="middle"></draw-layer>'), /corner "middle" is not one of/);
});

test('the tool bar shows only while drawing', async () => {
  const { dock } = await page('<div id="card"></div><draw-layer id="ink" for="#card"></draw-layer>');
  assert.match(DOCK_CSS, /\.dock:not\(\.drawing\) \.body \{ display: none; \}/);
  assert.equal(dock().classList.contains('drawing'), false);
  dock().querySelector('.draw').click();
  assert.equal(dock().classList.contains('drawing'), true);
  assert.equal(dock().querySelector('.draw').getAttribute('aria-pressed'), 'true');
  assert.ok(dock().querySelector('.body .inkbar .undo'));
});

test('the "⋯" menu picks a corner, which is remembered per page and wins over corner="…"', async () => {
  const url = 'https://host.example/menu/';
  const html = '<div id="card"></div><draw-layer id="ink" for="#card" corner="bottom-right"></draw-layer>';
  const { win, doc, layer, dock } = await page(html, url);
  const menu = dock().querySelector('.menu');
  assert.equal(menu.hidden, true);
  dock().querySelector('.place').click();
  assert.equal(menu.hidden, false);
  assert.equal(menu.querySelector('input[value="bottom-right"]').checked, true);
  const radio = menu.querySelector('input[value="top-left"]');
  radio.checked = true;
  radio.dispatchEvent(new win.Event('change', { bubbles: true }));
  assert.deepEqual(pinned(dock()), ['16px', 'auto', '16px', 'auto']);
  assert.deepEqual([dock().dataset.openX, dock().dataset.openY], ['right', 'down']);
  assert.equal(menu.hidden, true, 'a pick closes the menu');
  const again = await reload(doc, layer);
  assert.deepEqual(pinned(dockOf(again)), ['16px', 'auto', '16px', 'auto']);
  const elsewhere = await page(html, 'https://host.example/other/');
  assert.deepEqual(pinned(elsewhere.dock()), ['auto', '16px', 'auto', '16px'], 'another page keeps its own');
});

function drag(win, grip, from, to) {
  grip.setPointerCapture = () => {};
  const fire = (type, [x, y]) => grip.dispatchEvent(new win.PointerEvent(type, { button: 0, clientX: x, clientY: y, pointerId: 3, pointerType: 'touch', bubbles: true }));
  fire('pointerdown', from);
  fire('pointermove', to);
  fire('pointerup', to);
}

test('the grip drags the button anywhere, kept on screen, remembered; Reset position puts it back in its corner', async () => {
  const url = 'https://host.example/drag/';
  const html = '<div id="card"></div><draw-layer id="ink" for="#card"></draw-layer>';
  const { win, doc, layer, dock } = await page(html, url);
  const head = dock().querySelector('.head');
  let at = { left: 16, top: 944 };
  head.getBoundingClientRect = () => ({ ...at, width: HEAD.width, height: HEAD.height });
  const grip = dock().querySelector('.grip');
  drag(win, grip, [20, 960], [1220, 20]);
  assert.deepEqual(pinned(dock()), ['auto', '64px', '16px', 'auto'], 'moved 1200 right and up past the top edge: stopped 16 px from it');
  assert.deepEqual([dock().dataset.openX, dock().dataset.openY], ['left', 'down'], 'in the upper right it opens down and to the left');
  at = { left: 1216, top: 16 };
  drag(win, grip, [1220, 20], [9000, 9000]);
  assert.deepEqual(pinned(dock()), ['auto', '16px', 'auto', '16px'], 'never past the lower right corner');
  at = { left: 1264, top: 944 };
  drag(win, grip, [1270, 950], [770, 550]);
  assert.deepEqual([dock().dataset.openX, dock().dataset.openY], ['left', 'up'], 'just right of and below the middle');
  const again = await reload(doc, layer);
  assert.deepEqual((await again.implementation()).place(), { corner: 'bottom-left', spot: { x: 764, y: 544 } }, 'the dragged place is remembered');
  assert.deepEqual([dockOf(again).dataset.openX, dockOf(again).dataset.openY], ['left', 'up']);
  dockOf(again).querySelector('.place').click();
  dockOf(again).querySelector('.reset').click();
  assert.equal(dockOf(again).querySelector('.menu').hidden, true, 'Reset position closes the menu');
  assert.deepEqual(pinned(dockOf(again)), ['16px', 'auto', 'auto', '16px']);
  const third = await reload(doc, again);
  assert.deepEqual((await third.implementation()).place(), { corner: 'bottom-left', spot: null }, 'the reset is remembered');
});

test('toggles-scope="browser" keeps one Show and Print choice for every layer; "layer" (the default) one per layer; a bad scope fails loud', async () => {
  const change = (win, input, checked) => { input.checked = checked; input.dispatchEvent(new win.Event('change')); };
  const browserWide = '<div id="card"></div><draw-layer id="ink" for="#card" toggles-scope="browser"></draw-layer>';
  const first = await page(browserWide, 'https://host.example/a/');
  change(first.win, first.layer.shadowRoot.querySelector('.show'), false);
  change(first.win, first.layer.shadowRoot.querySelector('.print'), false);
  // Each page is a window of its own, so the shared choice is carried over by hand as the browser would.
  const carry = (from, to) => { for (let i = 0; i < from.localStorage.length; i++) to.localStorage.setItem(from.localStorage.key(i), from.localStorage.getItem(from.localStorage.key(i))); };
  const second = makeWindow({ url: 'https://host.example/b/' });
  carry(first.win, second.win);
  second.doc.body.innerHTML = '<div id="card"></div><draw-layer id="other" for="#card" toggles-scope="browser"></draw-layer><draw-layer id="own" for="#card"></draw-layer>';
  const [shared, own] = second.doc.querySelectorAll('draw-layer');
  await Promise.all([shared.ready, own.ready]);
  assert.deepEqual([shared.shadowRoot.querySelector('.show').checked, shared.shadowRoot.querySelector('.print').checked], [false, false]);
  assert.deepEqual([own.shadowRoot.querySelector('.show').checked, own.shadowRoot.querySelector('.print').checked], [true, true]);
  assert.equal(first.win.localStorage.getItem('toybox.draw-layer.show.browser'), '0');
  assert.throws(() => add(second.doc, '<draw-layer id="x" for="#card" toggles-scope="tab"></draw-layer>'), /toggles-scope="tab": use one of layer, browser/);
});
