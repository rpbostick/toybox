// <draw-layer> and <toy-pages> in happy-dom, with an in-memory store for IndexedDB: the layer
// lies over its target and draws only in Draw mode, Show scribbles hides it on screen only and
// Print scribbles in print only, strokes are in units of the target's width and saved per page;
// pages are added, reordered, removed, kept and printed one per sheet after the page; Save file
// and Open file round-trip pages, scribbles and the tray's log, and refuse a file that does not fit.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OVERLAY_CSS, UNITS } from '../src/draw/layer.js';
import { PAGES_CSS } from '../src/draw/pages.js';
import { applyFile, fileText } from '../src/draw/file.js';
import { onOpenFile, onSaveFile } from '../src/page-api.js';
import { memoryStore, useStore } from '../src/draw/store.js';
import { add, makeWindow } from './happy-window.js';

const store = memoryStore();
useStore(store);

/** Gives an element a size on screen (happy-dom lays nothing out). */
function sized(element, width, height) {
  element.getBoundingClientRect = () => ({ left: 0, top: 0, x: 0, y: 0, width, height, right: width, bottom: height });
  return element;
}

async function page(html, url = 'https://host.example/sheet/') {
  // Reduced motion turns quick roll on, so the tray's 2D dice land without the tumble's timers.
  const { win, doc } = makeWindow({ url, reducedMotion: 'reduce' });
  doc.body.innerHTML = html;
  const elements = [...doc.querySelectorAll('draw-layer, toy-pages, dice-tray')];
  await Promise.all(elements.map((element) => element.ready));
  await Promise.all(elements.filter((element) => element.localName !== 'dice-tray').map(async (element) => (await element.implementation()).restored()));
  return { win, doc };
}

function stroke(win, svg, points) {
  const fire = (type, [x, y]) => svg.dispatchEvent(new win.PointerEvent(type, { button: 0, clientX: x, clientY: y, pointerId: 7, pointerType: 'mouse', pressure: 0.5, bubbles: true }));
  fire('pointerdown', points[0]);
  for (const point of points.slice(1)) fire('pointermove', point);
  fire('pointerup', points.at(-1));
}

const overlayOf = (doc) => doc.querySelector('[data-toybox-ink]');

test('<draw-layer for> lays its overlay over the target, drawing only while Draw is on', async () => {
  const { doc } = await page('<div id="card" style="width:500px;height:250px">Card</div><draw-layer id="ink" for="#card"></draw-layer>');
  const card = doc.getElementById('card');
  const overlay = overlayOf(doc);
  assert.equal(overlay.parentElement, card);
  assert.equal(card.style.position, 'relative', 'a static target is positioned so the overlay can cover it');
  assert.match(OVERLAY_CSS, /:host \{ position: absolute; inset: 0;[^}]*pointer-events: none;/);
  assert.match(OVERLAY_CSS, /:host\(\[data-drawing="1"\]\) \{ pointer-events: auto;/);
  assert.equal(overlay.dataset.drawing, '0');
  const layer = doc.querySelector('draw-layer');
  layer.shadowRoot.querySelector('.draw').click();
  assert.equal(overlay.dataset.drawing, '1');
  assert.throws(() => doc.body.append(Object.assign(doc.createElement('draw-layer'), { id: 'x' })), /needs for="#selector"/);
});

test('a stroke is in units of the target\'s width, so it scales with the target, and is saved per page', async () => {
  const { win, doc } = await page('<div id="card"></div><draw-layer id="ink" for="#card"></draw-layer>', 'https://host.example/one/');
  const layer = doc.querySelector('draw-layer');
  const svg = sized(overlayOf(doc).shadowRoot.querySelector('svg'), 500, 250);
  svg.setAttribute('viewBox', `0 0 ${UNITS} 500`);
  layer.shadowRoot.querySelector('.draw').click();
  stroke(win, svg, [[50, 50], [100, 75], [250, 125]]);
  const [drawn] = await layer.strokes();
  assert.deepEqual(drawn.points, [[100, 100], [200, 150], [500, 250]], 'half the 500 px target is 500 of its 1000 units');
  assert.equal(drawn.tool, 'pen');
  await (await layer.implementation()).flush();
  assert.deepEqual(store.items.get('/one/#draw-layer#ink').strokes, [drawn]);
  const again = await page('<div id="card"></div><draw-layer id="ink" for="#card"></draw-layer>', 'https://host.example/one/');
  assert.equal((await again.doc.querySelector('draw-layer').strokes()).length, 1, 'the same page shows the saved strokes');
  const other = await page('<div id="card"></div><draw-layer id="ink" for="#card"></draw-layer>', 'https://host.example/two/');
  assert.equal((await other.doc.querySelector('draw-layer').strokes()).length, 0, 'another page keeps its own');
});

test('Show scribbles hides them on screen only and Print scribbles in print only, each remembered on its own', async () => {
  const { doc, win } = await page('<div id="card"></div><draw-layer id="ink" for="#card"></draw-layer>', 'https://host.example/show/');
  const layer = doc.querySelector('draw-layer');
  const overlay = overlayOf(doc);
  const box = (name) => layer.shadowRoot.querySelector(`.${name}`);
  const change = (input, checked) => { input.checked = checked; input.dispatchEvent(new win.Event('change')); };
  assert.deepEqual([box('show').checked, box('print').checked], [true, true]);
  change(box('show'), false);
  assert.deepEqual([overlay.dataset.show, overlay.dataset.print], ['0', '1'], 'hidden on screen, still printed');
  change(box('show'), true);
  change(box('print'), false);
  assert.deepEqual([overlay.dataset.show, overlay.dataset.print], ['1', '0'], 'shown on screen, not printed');
  assert.match(OVERLAY_CSS, /@media screen \{ :host\(\[data-show="0"\]\) svg \{ visibility: hidden; \} \}/);
  assert.match(OVERLAY_CSS, /@media print \{ :host\(\[data-print="0"\]\) \{ display: none !important; \} \}/);
  assert.doesNotMatch(OVERLAY_CSS.replace(/@media screen \{[^}]*\} \}/, ''), /data-show/, 'Show scribbles reaches only the screen');
  layer.remove();
  const again = add(doc, '<draw-layer id="ink" for="#card"></draw-layer>');
  await again.ready;
  const overlay2 = overlayOf(doc);
  assert.deepEqual([overlay2.dataset.show, overlay2.dataset.print], ['1', '0'], 'the choices are remembered');
});

test('removing the layer removes its overlay and gives the target its own position back', async () => {
  const { doc } = await page('<div id="card"></div><draw-layer id="ink" for="#card"></draw-layer>');
  doc.querySelector('draw-layer').remove();
  assert.equal(overlayOf(doc), null);
  assert.equal(doc.getElementById('card').style.position, '');
});

test('<toy-pages> adds notes and drawing pages, reorders and removes them, and keeps them per page', async () => {
  const { doc } = await page('<toy-pages id="extra"></toy-pages>', 'https://host.example/pages/');
  const pages = doc.querySelector('toy-pages');
  const notes = await pages.addPage('notes');
  const drawing = await pages.addPage('drawing');
  const labels = () => [...pages.shadowRoot.querySelectorAll('.pagebar .label')].map((node) => node.textContent);
  assert.deepEqual(labels(), ['Page 1 · Notes', 'Page 2 · Drawing']);
  const notesPage = pages.shadowRoot.querySelector('.notes-page');
  notesPage.querySelector('.title').value = 'Rumours';
  notesPage.querySelector('.text').value = 'The well is haunted.';
  notesPage.dispatchEvent(new doc.defaultView.Event('input', { bubbles: true }));
  (await pages.implementation()).pasteInto(drawing, { src: 'data:image/png;base64,AAAA', w: 200, h: 100 });
  await pages.movePage(drawing, -1);
  assert.deepEqual(labels(), ['Page 1 · Drawing', 'Page 2 · Notes']);
  assert.equal(pages.shadowRoot.querySelector('.page-wrap .up').disabled, true);
  const saved = await pages.pages();
  assert.deepEqual(saved.map((entry) => entry.kind), ['drawing', 'notes']);
  assert.equal(saved[1].title, 'Rumours');
  assert.equal(saved[0].images.length, 1);
  assert.deepEqual(saved[0].images[0].w, 800, 'a picture fits 80 % of the page');
  await (await pages.implementation()).flush();
  const again = await page('<toy-pages id="extra"></toy-pages>', 'https://host.example/pages/');
  assert.deepEqual(await again.doc.querySelector('toy-pages').pages(), saved);
  await pages.removePage(notes);
  assert.deepEqual(labels(), ['Page 1 · Drawing']);
  await assert.rejects(pages.addPage('map'), /"notes" or "drawing"/);
});

test('<toy-pages>\'s "Draw on pages" button shows only while a page exists, and removing the last turns drawing off', async () => {
  const { doc } = await page('<toy-pages id="drawon"></toy-pages>', 'https://host.example/draw-on/');
  const pages = doc.querySelector('toy-pages');
  const toggle = pages.shadowRoot.querySelector('.draw');
  const container = pages.shadowRoot.querySelector('.pages');
  assert.deepEqual([toggle.textContent, toggle.title], ['✎ Draw on pages', 'Draw on pages']);
  assert.equal(toggle.hidden, true, 'no pages, nothing to draw on');
  const notes = await pages.addPage('notes');
  assert.equal(toggle.hidden, false, 'a notes page brings it');
  toggle.click();
  assert.equal(container.classList.contains('drawing'), true);
  await pages.removePage(notes);
  assert.equal(toggle.hidden, true, 'the last page gone takes it');
  assert.equal(container.classList.contains('drawing'), false, 'and turns drawing off');
  assert.equal(toggle.getAttribute('aria-pressed'), 'false');
  await pages.addPage('drawing');
  assert.deepEqual([toggle.hidden, container.classList.contains('drawing')], [false, true], 'a drawing page turns drawing on as before');
  await (await pages.implementation()).flush();
  const again = await page('<toy-pages id="drawon"></toy-pages>', 'https://host.example/draw-on/');
  assert.equal(again.doc.querySelector('toy-pages').shadowRoot.querySelector('.draw').hidden, false, 'saved pages bring it');
  await pages.loadToyboxState({ pages: [] });
  assert.equal(toggle.hidden, true, 'a file with no pages takes it');
  await pages.loadToyboxState(await again.doc.querySelector('toy-pages').toyboxState());
  assert.equal(toggle.hidden, false, 'a file with pages brings it');
});

test('the pages print after the page, one per sheet, without their buttons', () => {
  const print = PAGES_CSS.slice(PAGES_CSS.indexOf('@media print'));
  assert.match(print, /\.bar, \.pagebar, \.toast \{ display: none !important; \}/);
  assert.match(print, /\.page-wrap \{ break-before: page; break-inside: avoid; \}/);
  assert.match(PAGES_CSS, /\.pages:empty \{ display: none; \}/, 'no pages leave no blank sheet');
});

test('size="a4" makes A4 pages; a bad size fails loud', async () => {
  const { doc } = await page('<toy-pages size="a4"></toy-pages>');
  const pages = doc.querySelector('toy-pages');
  await pages.addPage('notes');
  assert.equal(pages.shadowRoot.querySelector('.page').style.aspectRatio, `1000 / ${(1000 * 297 / 210).toFixed(2)}`);
  const bad = doc.createElement('toy-pages');
  bad.setAttribute('size', 'legal');
  assert.throws(() => doc.body.append(bad), /size="legal": use one of letter, a4/);
});

test('buttons="none" hides Save file, Open file and Print, and buttons="all" brings them back; a bad value fails loud', async () => {
  const { doc } = await page('<toy-pages buttons="none"></toy-pages>');
  const pages = doc.querySelector('toy-pages');
  const hiddenOf = () => ['[data-act="save"]', '.file', '[data-act="print"]'].map((selector) => pages.shadowRoot.querySelector(selector).hidden);
  assert.deepEqual(hiddenOf(), [true, true, true]);
  assert.equal(pages.shadowRoot.querySelector('[data-act="notes"]').hidden, false, 'the page buttons stay');
  pages.setAttribute('buttons', 'all');
  assert.deepEqual(hiddenOf(), [false, false, false]);
  assert.throws(() => pages.setAttribute('buttons', 'some'), /buttons="some": use one of all, none/);
});

const SAVED_PAGE = `<div id="card"></div><draw-layer id="ink" for="#card"></draw-layer>
  <toy-pages id="extra"></toy-pages><dice-tray id="dice" save-log></dice-tray>`;

test('Save file and Open file round-trip the pages, the scribbles and the tray\'s log', async () => {
  const { win, doc } = await page(SAVED_PAGE, 'https://host.example/file-a/');
  const pages = doc.querySelector('toy-pages');
  await pages.addPage('notes');
  const svg = sized(overlayOf(doc).shadowRoot.querySelector('svg'), 500, 250);
  svg.setAttribute('viewBox', `0 0 ${UNITS} 500`);
  doc.querySelector('draw-layer').shadowRoot.querySelector('.draw').click();
  stroke(win, svg, [[10, 10], [20, 20]]);
  await doc.querySelector('dice-tray').roll('2d6');
  const text = await fileText(doc);
  const file = JSON.parse(text);
  assert.deepEqual(Object.keys(file.elements).sort(), ['dice-tray#dice', 'draw-layer#ink', 'toy-pages#extra']);
  assert.equal(file.format, 'toybox-file');

  const other = await page(SAVED_PAGE, 'https://host.example/file-b/');
  assert.deepEqual((await applyFile(other.doc, text)).sort(), ['dice-tray#dice', 'draw-layer#ink', 'toy-pages#extra']);
  assert.deepEqual(await other.doc.querySelector('toy-pages').pages(), await pages.pages());
  assert.deepEqual(await other.doc.querySelector('draw-layer').strokes(), await doc.querySelector('draw-layer').strokes());
  assert.deepEqual(await other.doc.querySelector('dice-tray').log(), await doc.querySelector('dice-tray').log());
});

test('onSaveFile adds the page\'s own fields to a saved file and onOpenFile gets them back after the elements load', async () => {
  const { doc } = await page(SAVED_PAGE, 'https://host.example/file-hooks-a/');
  await doc.querySelector('toy-pages').addPage('notes');
  const stopSave = onSaveFile(() => ({ character: { name: 'Wren' } }));
  const stopSaveToo = onSaveFile(async () => ({ sheetVersion: 3 }));
  const text = await fileText(doc);
  assert.deepEqual(JSON.parse(text).extra, { character: { name: 'Wren' }, sheetVersion: 3 });
  const clash = onSaveFile(() => ({ sheetVersion: 4 }));
  await assert.rejects(fileText(doc), /two onSaveFile hooks both save the field "sheetVersion"/);
  clash();
  const notObject = onSaveFile(() => 'Wren');
  await assert.rejects(fileText(doc), /an onSaveFile hook returned "Wren", not an object of fields/);
  notObject();
  stopSave();
  stopSaveToo();

  const other = await page(SAVED_PAGE, 'https://host.example/file-hooks-b/');
  const opened = [];
  const stopOpen = onOpenFile(async (extra, { page: from }) => {
    opened.push({ extra, from, pages: (await other.doc.querySelector('toy-pages').pages()).length });
  });
  await applyFile(other.doc, text);
  stopOpen();
  assert.deepEqual(opened, [{ extra: { character: { name: 'Wren' }, sheetVersion: 3 }, from: '/file-hooks-a/', pages: 1 }],
    'the hook runs once, after the pages have loaded');
  assert.throws(() => onSaveFile('save'), /onSaveFile\(fn\): fn must be a function/);
});

test('a tray without save-log keeps its log out of the file', async () => {
  const { doc } = await page('<dice-tray id="dice"></dice-tray><toy-pages></toy-pages>');
  await doc.querySelector('dice-tray').roll('1d6');
  assert.deepEqual(Object.keys(JSON.parse(await fileText(doc)).elements), ['toy-pages#pages']);
});

/** A page whose saved copy for `key` is `damaged`; resolves once the element has tried to load it. */
async function damagedPage(html, url, key, damaged) {
  store.items.set(key, damaged);
  const { win, doc } = makeWindow({ url, reducedMotion: 'reduce' });
  doc.body.innerHTML = html;
  const element = doc.querySelector('draw-layer, toy-pages');
  const impl = await element.implementation();
  await assert.rejects(impl.restored(), /must be|strokes/);
  return { win, doc, element, impl };
}

test('a damaged saved layer says so, leaves autosave off and untouched, and can still be saved to a file', async () => {
  const key = '/damaged-layer/#draw-layer#ink';
  const damaged = { strokes: [{ tool: 'spray' }] };
  const { win, doc, element, impl } = await damagedPage('<div id="card"></div><draw-layer id="ink" for="#card"></draw-layer>',
    'https://host.example/damaged-layer/', key, damaged);
  assert.match(element.shadowRoot.querySelector('.savestate').textContent, /^Saved scribbles could not be read \(.*strokes\[0\]\.tool.*\); autosave is off\.$/);
  const svg = sized(overlayOf(doc).shadowRoot.querySelector('svg'), 500, 250);
  svg.setAttribute('viewBox', `0 0 ${UNITS} 500`);
  element.shadowRoot.querySelector('.draw').click();
  stroke(win, svg, [[10, 10], [20, 20]]);
  await impl.flush();
  assert.deepEqual(store.items.get(key), damaged, 'the damaged copy is not overwritten');
  assert.match(element.shadowRoot.querySelector('.savestate').textContent, /autosave is off/, 'a new stroke does not hide the message');
  assert.equal(JSON.parse(await fileText(doc)).elements['draw-layer#ink'].strokes.length, 1, 'the new stroke goes into a saved file');
});

test('a damaged saved pages entry says so, leaves autosave off and untouched, and can still be saved to a file', async () => {
  const key = '/damaged-pages/#toy-pages#extra';
  const damaged = { pages: [{ id: 'p1', kind: 'map', strokes: [] }] };
  const { doc, element, impl } = await damagedPage('<toy-pages id="extra"></toy-pages>', 'https://host.example/damaged-pages/', key, damaged);
  assert.match(element.shadowRoot.querySelector('.savestate').textContent, /^Saved pages could not be read \(.*pages\[0\].*\); autosave is off\.$/);
  await element.addPage('notes');
  await impl.flush();
  assert.deepEqual(store.items.get(key), damaged, 'the damaged copy is not overwritten');
  assert.match(element.shadowRoot.querySelector('.savestate').textContent, /autosave is off/, 'a new page does not hide the message');
  assert.equal(JSON.parse(await fileText(doc)).elements['toy-pages#extra'].pages.length, 1, 'the new page goes into a saved file');
});

test('Open file refuses a file whose parts this page has no element for, or that fails a check, and changes nothing', async () => {
  const { doc } = await page(SAVED_PAGE, 'https://host.example/file-c/');
  const pages = doc.querySelector('toy-pages');
  await pages.addPage('drawing');
  const before = await pages.pages();
  const file = (elements) => JSON.stringify({ format: 'toybox-file', version: 1, page: '/', elements });
  await assert.rejects(applyFile(doc, file({ 'toy-pages#extra': { pages: [] }, 'draw-layer#other': { strokes: [] } })), /no element for draw-layer#other/);
  await assert.rejects(applyFile(doc, file({ 'toy-pages#extra': { pages: [] }, 'draw-layer#ink': { strokes: [{ tool: 'spray' }] } })), /draw-layer#ink\.strokes\[0\]\.tool/);
  assert.deepEqual(await pages.pages(), before, 'nothing was loaded from either file');
});
