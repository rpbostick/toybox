// The eyedropper (src/draw/eyedropper.js, src/draw/tools.js) and the recent colours
// (src/draw/recent.js), in happy-dom: picking from a stroke, a picture and the host element
// under the layer with the pixel reads stubbed (happy-dom has no canvas), the EyeDropper API
// path with a stubbed EyeDropper, Esc cancelling a pick, and the recent colours' order and
// persistence, through <draw-layer>, <toy-pages> and the image editor.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UNITS } from '../src/draw/layer.js';
import { editImage } from '../src/draw/image-editor.js';
import { hexOf, over, parseColor, sampleColor } from '../src/draw/eyedropper.js';
import { RECENT_MAX, parseRecent, withRecent } from '../src/draw/recent.js';
import { HIGHLIGHT_OPACITY } from '../src/draw/strokes.js';
import { memoryStore, useStore } from '../src/draw/store.js';
import { makeWindow } from './happy-window.js';

useStore(memoryStore());

/** Gives an element a size on screen (happy-dom lays nothing out). */
function sized(element, width, height) {
  element.getBoundingClientRect = () => ({ left: 0, top: 0, x: 0, y: 0, width, height, right: width, bottom: height });
  return element;
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

/** A 500 × 250 px svg 1000 units across, as the layers are. */
function layerSvg(doc) {
  const svg = sized(doc.createElementNS('http://www.w3.org/2000/svg', 'svg'), 500, 250);
  svg.setAttribute('viewBox', `0 0 ${UNITS} 500`);
  return svg;
}

const PEN = { tool: 'pen', color: '#b5523b', size: 10, points: [[100, 100], [300, 100]] };

test('colours composite top over bottom and read back as #rrggbb', () => {
  assert.deepEqual(over([255, 0, 0, 1], [0, 0, 255, 1]), [255, 0, 0, 1]);
  assert.equal(hexOf(over([255, 0, 0, 0.5], [0, 0, 255, 1])), '#800080');
  assert.deepEqual(parseColor(null, 'rgba(10, 20, 30, 0.5)'), [10, 20, 30, 0.5]);
  assert.deepEqual(parseColor(null, 'rgb(10 20 30 / 25%)'), [10, 20, 30, 0.25]);
  assert.deepEqual(parseColor(null, '#abc'), [170, 187, 204, 1]);
  assert.deepEqual(parseColor(null, 'transparent'), [0, 0, 0, 0]);
});

test('a pick on a pen stroke gives the stroke\'s own colour; a highlighter is its colour at its opacity over what is under it', async () => {
  const { win, doc } = makeWindow();
  const svg = layerSvg(doc);
  const root = { elementsFromPoint: () => { throw new Error('an opaque stroke needs nothing under it'); } };
  // (50, 50) px is (100, 100) units: the start of the stroke.
  assert.equal(await sampleColor(win, { x: 60, y: 50, root, skip: () => false, ink: { svg, strokes: [PEN] } }), '#b5523b');
  const card = doc.createElement('div');
  card.style.backgroundColor = '#3b6fb5';
  doc.body.append(card);
  const marker = { tool: 'highlighter', color: '#ffd400', size: 20, points: [[100, 100], [300, 100]] };
  const picked = await sampleColor(win, { x: 60, y: 50, root: { elementsFromPoint: () => [card] }, skip: () => false, ink: { svg, strokes: [PEN, marker] } });
  assert.equal(picked, hexOf(over([255, 212, 0, HIGHLIGHT_OPACITY], [181, 82, 59, 1])), 'the highlighter is on top of the pen stroke');
  const offStroke = await sampleColor(win, { x: 60, y: 200, root: { elementsFromPoint: () => [card] }, skip: () => false, ink: { svg, strokes: [PEN, marker] } });
  assert.equal(offStroke, '#3b6fb5', 'away from the strokes the host shows');
});

test('a pick on a picture reads its pixel at the point (the topmost picture), over the host', async () => {
  const { win, doc } = makeWindow();
  const svg = layerSvg(doc);
  const images = [
    { id: 'a', src: 'data:image/png;base64,AAAA', x: 0, y: 0, w: 1000, h: 500 },
    { id: 'b', src: 'data:image/png;base64,BBBB', x: 200, y: 200, w: 400, h: 200 },
  ];
  const reads = [];
  const read = (_win, source, fx, fy) => {
    reads.push([source.src, fx, fy]);
    return source.src.endsWith('BBBB') ? [10, 20, 30, 1] : [200, 200, 200, 1];
  };
  const load = async (_win, src) => ({ src });
  const pick = (x, y) => sampleColor(win, { x, y, root: { elementsFromPoint: () => [] }, skip: () => false, ink: { svg, strokes: [] }, pictures: { svg, images }, read, load });
  // (200, 150) px is (400, 300) units: a quarter across and halfway down picture b.
  assert.equal(await pick(200, 150), '#0a141e');
  assert.deepEqual(reads.at(-1), ['data:image/png;base64,BBBB', 0.5, 0.5]);
  assert.equal(await pick(10, 10), '#c8c8c8', 'outside b, picture a');
  const strokeOver = await sampleColor(win, { x: 60, y: 50, root: { elementsFromPoint: () => [] }, skip: () => false, ink: { svg, strokes: [PEN] }, pictures: { svg, images }, read, load });
  assert.equal(strokeOver, '#b5523b', 'a stroke covers the picture');
});

test('the host under the layer: an <img> gives its pixel, a cross-origin one its background, other elements their background colour, nothing at all is white', async () => {
  const { win, doc } = makeWindow();
  const svg = layerSvg(doc);
  const overlay = doc.createElement('div');
  const text = doc.createElement('span');
  const card = doc.createElement('div');
  card.style.backgroundColor = 'rgb(51, 102, 153)';
  const img = sized(doc.createElement('img'), 100, 100);
  img.style.backgroundColor = '#00ff00';
  doc.body.append(overlay, text, card, img);
  const pixel = (_win, source, fx, fy) => {
    assert.equal(source, img);
    assert.deepEqual([fx, fy], [0.25, 0.5]);
    return [1, 2, 3, 1];
  };
  const tainted = () => { throw Object.assign(new Error('tainted'), { name: 'SecurityError' }); };
  const pick = (stack, read) => sampleColor(win, { x: 25, y: 50, root: { elementsFromPoint: () => stack }, skip: (element) => element === overlay, ink: { svg, strokes: [] }, read });
  assert.equal(await pick([overlay, text, card], pixel), '#336699', 'the transparent text passes to its card; the overlay is skipped');
  assert.equal(await pick([overlay, img, card], pixel), '#010203');
  assert.equal(await pick([img, card], tainted), '#00ff00', 'an image the canvas may not read gives its background colour');
  assert.equal(await pick([text], pixel), '#ffffff');
  const broken = () => { throw new Error('out of memory'); };
  await assert.rejects(pick([img], broken), /out of memory/, 'any other failure is not hidden');
});

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
  const { win, doc } = makeWindow({ url: `https://host.example/eyedropper/${Math.random()}/` });
  doc.body.innerHTML = '<div id="card" style="background-color: #fffaf0"></div><draw-layer id="ink" for="#card"></draw-layer>';
  const layer = doc.querySelector('draw-layer');
  await layer.ready;
  await (await layer.implementation()).restored();
  const overlay = doc.querySelector('[data-toybox-ink]');
  const svg = sized(overlay.shadowRoot.querySelector('svg'), 500, 250);
  svg.setAttribute('viewBox', `0 0 ${UNITS} 500`);
  doc.elementsFromPoint = () => [overlay, doc.getElementById('card'), doc.body, doc.documentElement];
  const root = layer.shadowRoot;
  root.querySelector('.draw').click();
  const fire = (type, [x, y], target = svg) => target.dispatchEvent(new win.PointerEvent(type, { button: 0, clientX: x, clientY: y, pointerId: 7, pointerType: 'mouse', bubbles: true, composed: true }));
  const draw = (points) => {
    fire('pointerdown', points[0]);
    for (const point of points.slice(1)) fire('pointermove', point);
    fire('pointerup', points.at(-1));
  };
  const swatch = (hex) => root.querySelector(`.swatches [data-color="${hex}"]`).click();
  const color = () => root.querySelector('.color').value;
  const recents = () => [...root.querySelectorAll('.recents button')].map((button) => button.dataset.color);
  return { win, doc, layer, root, overlay, svg, fire, draw, swatch, color, recents };
}

test('<draw-layer> without the EyeDropper API: the next click picks from a stroke, sets the pen colour, draws nothing, and the pen is back', async () => {
  const { win, layer, root, fire, draw, swatch, color, recents } = await layerPage();
  assert.equal(win.EyeDropper, undefined);
  swatch('#b5523b');
  draw([[50, 50], [150, 50]]);
  swatch('#3b6fb5');
  root.querySelector('.eyedropper').click();
  await tick();
  assert.equal(root.querySelector('.eyedropper').getAttribute('aria-pressed'), 'true');
  assert.match(root.querySelector('.pickstate').textContent, /Esc cancels/);
  fire('pointerdown', [60, 50]);
  fire('pointerup', [60, 50]);
  await tick();
  assert.equal(color(), '#b5523b', 'the stroke\'s colour');
  assert.equal(root.querySelector('.eyedropper').getAttribute('aria-pressed'), 'false');
  assert.equal((await layer.strokes()).length, 1, 'the pick drew nothing');
  assert.equal(root.querySelector('[data-tool="pen"]').getAttribute('aria-pressed'), 'true', 'the pen is still in hand');
  assert.deepEqual(recents(), ['#b5523b'], 'drawn with, then picked: one entry');
  fire('pointerdown', [60, 200]);
  fire('pointerup', [60, 200]);
  assert.equal((await layer.strokes()).length, 2, 'the next press draws again');
});

test('<draw-layer>: a pick off the strokes takes the target\'s own background colour', async () => {
  const { root, fire, color } = await layerPage();
  root.querySelector('.eyedropper').click();
  await tick();
  fire('pointerdown', [100, 200]);
  await tick();
  assert.equal(color(), '#fffaf0');
});

test('Esc cancels a pick: the colour stays and the next press draws', async () => {
  const { win, doc, layer, root, fire, color } = await layerPage();
  const before = color();
  root.querySelector('.eyedropper').click();
  await tick();
  doc.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(root.querySelector('.eyedropper').getAttribute('aria-pressed'), 'false');
  assert.match(root.querySelector('.pickstate').textContent, /cancelled/);
  fire('pointerdown', [60, 50]);
  fire('pointerup', [60, 50]);
  assert.equal(color(), before);
  assert.equal((await layer.strokes()).length, 1);
});

test('with the EyeDropper API the browser\'s picker is used; its Esc (AbortError) changes nothing', async () => {
  const { win, root, color, recents } = await layerPage();
  let answer = Promise.resolve({ sRGBHex: '#12AB34' });
  win.EyeDropper = class { open() { return answer; } };
  root.querySelector('.eyedropper').click();
  await tick();
  assert.equal(color(), '#12ab34');
  assert.equal(recents()[0], '#12ab34');
  assert.equal(root.querySelector('.eyedropper').getAttribute('aria-pressed'), 'false', 'no waiting for a click on the page');
  answer = Promise.reject(Object.assign(new Error('The user canceled the selection.'), { name: 'AbortError' }));
  root.querySelector('.eyedropper').click();
  await tick();
  assert.equal(color(), '#12ab34');
  assert.match(root.querySelector('.pickstate').textContent, /cancelled/);
});

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

test('<toy-pages>: the eyedropper picks from a stroke on an extra page', async () => {
  const { win, doc } = makeWindow({ url: 'https://host.example/eyedropper-pages/' });
  doc.body.innerHTML = '<toy-pages id="extra"></toy-pages>';
  const pages = doc.querySelector('toy-pages');
  await pages.ready;
  await (await pages.implementation()).restored();
  await pages.addPage('drawing');
  const root = pages.shadowRoot;
  const svg = sized(root.querySelector('.page svg.ink'), 500, 647);
  sized(root.querySelector('.page svg.pics'), 500, 647);
  const fire = (type, [x, y]) => svg.dispatchEvent(new win.PointerEvent(type, { button: 0, clientX: x, clientY: y, pointerId: 3, pointerType: 'mouse', bubbles: true, composed: true }));
  root.querySelector('.swatches [data-color="#3f8f4f"]').click();
  fire('pointerdown', [50, 50]);
  fire('pointermove', [150, 50]);
  fire('pointerup', [150, 50]);
  root.querySelector('.swatches [data-color="#ffffff"]').click();
  root.querySelector('.eyedropper').click();
  await tick();
  assert.ok(root.querySelector('.pages').classList.contains('picking'));
  fire('pointerdown', [100, 50]);
  await tick();
  assert.equal(root.querySelector('.color').value, '#3f8f4f');
  assert.equal((await pages.pages())[0].strokes.length, 1);
});

test('the image editor: the eyedropper picks from a stroke, and Esc during a pick cancels it without closing the editor', async () => {
  const { win, doc } = makeWindow({ url: 'https://host.example/eyedropper-editor/' });
  const portrait = sized(doc.createElement('div'), 140, 180);
  doc.body.append(portrait);
  const closed = editImage(portrait, { theme: 'light' });
  const root = doc.querySelector('[data-toybox-image-editor]').shadowRoot;
  const svg = sized(root.querySelector('svg.ink'), 400, 400);
  svg.setAttribute('viewBox', '0 0 1000 1000');
  const fire = (type, [x, y]) => svg.dispatchEvent(new win.PointerEvent(type, { button: 0, clientX: x, clientY: y, pointerId: 4, pointerType: 'mouse', bubbles: true, composed: true }));
  root.querySelector('.swatches [data-color="#b5523b"]').click();
  fire('pointerdown', [100, 100]);
  fire('pointermove', [200, 100]);
  fire('pointerup', [200, 100]);
  root.querySelector('.swatches [data-color="#2b2622"]').click();
  root.querySelector('.eyedropper').click();
  await tick();
  doc.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.ok(doc.querySelector('[data-toybox-image-editor]'), 'Esc ended the pick, not the editor');
  root.querySelector('.eyedropper').click();
  await tick();
  assert.ok(root.querySelector('.box').classList.contains('picking'));
  fire('pointerdown', [150, 100]);
  await tick();
  assert.equal(root.querySelector('.color').value, '#b5523b');
  root.querySelector('.cancel').click();
  assert.equal(await closed, null);
});
