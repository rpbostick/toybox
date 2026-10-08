// The recent colours (src/draw/recent.js, src/draw/tools.js) in happy-dom: their order and
// persistence through <draw-layer>, and the tool bars of <draw-layer>, <toy-pages> and the image
// editor offering no Eyedropper.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UNITS } from '../src/draw/layer.js';
import { editImage } from '../src/draw/image-editor.js';
import { RECENT_MAX, parseRecent, withRecent } from '../src/draw/recent.js';
import { memoryStore, useStore } from '../src/draw/store.js';
import { makeWindow } from './happy-window.js';

useStore(memoryStore());

/** Gives an element a size on screen (happy-dom lays nothing out). */
function sized(element, width, height) {
  element.getBoundingClientRect = () => ({ left: 0, top: 0, x: 0, y: 0, width, height, right: width, bottom: height });
  return element;
}

const hasEyedropper = (root) => [...root.querySelectorAll('.inkbar button')].some((button) => /eyedropper/i.test(`${button.className} ${button.textContent} ${button.title}`));

test('recent colours: newest first, no repeats, at most eight; a stored list that is not one reads as empty', () => {
  let list = [];
  for (const hex of ['#000001', '#000002', '#000001']) list = withRecent(list, hex);
  assert.deepEqual(list, ['#000001', '#000002']);
  for (let i = 3; i <= 12; i++) list = withRecent(list, `#0000${String(i).padStart(2, '0')}`);
  assert.equal(list.length, RECENT_MAX);
  assert.equal(list[0], '#000012');
  assert.throws(() => withRecent([], 'red'), /#rrggbb/);
  assert.deepEqual(parseRecent(null), []);
  assert.deepEqual(parseRecent('not json'), []);
  assert.deepEqual(parseRecent('{"a":1}'), []);
  assert.deepEqual(parseRecent('["#123456", 7]'), []);
  assert.deepEqual(parseRecent('["#123456","#abcdef"]'), ['#123456', '#abcdef']);
});

async function layerPage() {
  const { win, doc } = makeWindow({ url: `https://host.example/recent/${Math.random()}/` });
  doc.body.innerHTML = '<div id="card" style="background-color: #fffaf0"></div><draw-layer id="ink" for="#card"></draw-layer>';
  const layer = doc.querySelector('draw-layer');
  await layer.ready;
  await (await layer.implementation()).restored();
  const overlay = doc.querySelector('[data-toybox-ink]');
  const svg = sized(overlay.shadowRoot.querySelector('svg'), 500, 250);
  svg.setAttribute('viewBox', `0 0 ${UNITS} 500`);
  const root = layer.shadowRoot;
  root.querySelector('.draw').click();
  const fire = (type, [x, y]) => svg.dispatchEvent(new win.PointerEvent(type, { button: 0, clientX: x, clientY: y, pointerId: 7, pointerType: 'mouse', bubbles: true, composed: true }));
  const draw = (points) => {
    fire('pointerdown', points[0]);
    for (const point of points.slice(1)) fire('pointermove', point);
    fire('pointerup', points.at(-1));
  };
  const swatch = (hex) => root.querySelector(`.swatches [data-color="${hex}"]`).click();
  const color = () => root.querySelector('.color').value;
  const recents = () => [...root.querySelectorAll('.recents button')].map((button) => button.dataset.color);
  return { win, doc, root, draw, swatch, color, recents };
}

test('recent colours: the row is newest first, buttons a keyboard can reach, set the colour, and is kept per browser', async () => {
  const { win, doc, draw, swatch, color, recents, root } = await layerPage();
  swatch('#b5523b');
  draw([[10, 10], [20, 20]]);
  swatch('#3f8f4f');
  draw([[10, 30], [20, 40]]);
  assert.deepEqual(recents(), ['#3f8f4f', '#b5523b']);
  assert.equal(win.localStorage.getItem('toybox.draw.recent-colors'), '["#3f8f4f","#b5523b"]');
  const older = root.querySelector('.recents [data-color="#b5523b"]');
  assert.equal(older.localName, 'button');
  assert.equal(older.getAttribute('aria-label'), 'Recent colour #b5523b');
  older.click();
  assert.equal(color(), '#b5523b');
  // Another tool bar in the same browser shows the same row.
  doc.body.insertAdjacentHTML('beforeend', '<div id="other"></div><draw-layer id="ink2" for="#other"></draw-layer>');
  const second = doc.querySelector('#ink2');
  await second.ready;
  assert.deepEqual([...second.shadowRoot.querySelectorAll('.recents button')].map((button) => button.dataset.color), ['#3f8f4f', '#b5523b']);
});

test('no tool bar has an Eyedropper; a swatch picked in <draw-layer>, <toy-pages> or the image editor and drawn with heads the recent colours', async () => {
  const { draw, swatch, recents, root } = await layerPage();
  assert.ok(root.querySelector('.inkbar'), 'the tool bar is there');
  assert.equal(hasEyedropper(root), false, '<draw-layer>');
  swatch('#3b6fb5');
  draw([[10, 10], [20, 20]]);
  assert.equal(recents()[0], '#3b6fb5');

  const { win, doc } = makeWindow({ url: `https://host.example/recent-pages/${Math.random()}/` });
  doc.body.innerHTML = '<toy-pages id="extra"></toy-pages>';
  const pages = doc.querySelector('toy-pages');
  await pages.ready;
  await (await pages.implementation()).restored();
  await pages.addPage('drawing');
  const pagesRoot = pages.shadowRoot;
  assert.equal(hasEyedropper(pagesRoot), false, '<toy-pages>');
  const pageSvg = sized(pagesRoot.querySelector('.page svg.ink'), 500, 647);
  const firePage = (type, [x, y]) => pageSvg.dispatchEvent(new win.PointerEvent(type, { button: 0, clientX: x, clientY: y, pointerId: 3, pointerType: 'mouse', bubbles: true, composed: true }));
  pagesRoot.querySelector('.draw').click();
  pagesRoot.querySelector('.swatches [data-color="#3f8f4f"]').click();
  firePage('pointerdown', [50, 50]);
  firePage('pointermove', [150, 50]);
  firePage('pointerup', [150, 50]);
  assert.equal(pagesRoot.querySelector('.recents button')?.dataset.color, '#3f8f4f');

  const portrait = sized(doc.createElement('div'), 140, 180);
  doc.body.append(portrait);
  const closed = editImage(portrait, { theme: 'light' });
  const editorRoot = doc.querySelector('[data-toybox-image-editor]').shadowRoot;
  assert.equal(hasEyedropper(editorRoot), false, 'the image editor');
  const editorSvg = sized(editorRoot.querySelector('svg.ink'), 400, 400);
  editorSvg.setAttribute('viewBox', '0 0 1000 1000');
  const fireEditor = (type, [x, y]) => editorSvg.dispatchEvent(new win.PointerEvent(type, { button: 0, clientX: x, clientY: y, pointerId: 4, pointerType: 'mouse', bubbles: true, composed: true }));
  editorRoot.querySelector('.swatches [data-color="#b5523b"]').click();
  fireEditor('pointerdown', [100, 100]);
  fireEditor('pointermove', [200, 100]);
  fireEditor('pointerup', [200, 100]);
  assert.equal(editorRoot.querySelector('.recents button')?.dataset.color, '#b5523b');
  editorRoot.querySelector('.cancel').click();
  assert.equal(await closed, null);
});
