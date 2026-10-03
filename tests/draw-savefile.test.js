// What the drawing elements keep and the saved file (src/draw/savefile.js): pages, pictures and
// strokes round-trip, the order of pages is kept, and anything this version cannot read is
// refused by name instead of being half loaded.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkLayerState, checkPagesState, fileName, fromFile, toFile, VERSION } from '../src/draw/savefile.js';
import { notchedPolygon } from '../src/draw/image-editor.js';
import { reordered } from '../src/draw/pages.js';

const PICTURE = { id: 'i1', src: 'data:image/webp;base64,AAAA', x: 1, y: 2, w: 30, h: 40 };
const STROKE = { tool: 'pen', color: '#3b2a7a', size: 6, points: [[1, 1, 0.4], [2, 2, 0.6]] };
const HIGHLIGHT = { tool: 'highlighter', color: '#ffd400', size: 34, points: [[0, 0], [9, 0]] };

function elements() {
  return {
    'draw-layer#card': { strokes: [{ ...STROKE }, { ...HIGHLIGHT }] },
    'toy-pages#pages': {
      pages: [
        { id: 'p1', kind: 'notes', title: 'Rumours', text: 'The well is haunted.', strokes: [] },
        { id: 'p2', kind: 'drawing', images: [{ ...PICTURE }], strokes: [{ ...STROKE }] },
      ],
    },
  };
}

test('a saved file round-trips every page, picture and stroke, and the page it came from', () => {
  const state = elements();
  assert.deepEqual(fromFile(toFile('/sheet/', state)), { page: '/sheet/', elements: state, extra: {} });
});

test('the page\'s extra fields round-trip; a file without them (written before 0.4.1) reads as extra {}', () => {
  const extra = { character: { name: 'Wren', hp: 7 } };
  assert.deepEqual(fromFile(toFile('/sheet/', elements(), extra)).extra, extra);
  assert.equal('extra' in JSON.parse(toFile('/sheet/', elements())), false, 'no fields, no extra key');
  const old = JSON.stringify({ format: 'toybox-file', version: VERSION, page: '/sheet/', elements: elements() });
  assert.deepEqual(fromFile(old), { page: '/sheet/', elements: elements(), extra: {} });
  const bad = JSON.stringify({ format: 'toybox-file', version: VERSION, page: '/', elements: {}, extra: ['x'] });
  assert.throws(() => fromFile(bad), /extra fields must be an object/);
  assert.throws(() => toFile('/', {}, 'x'), /extra fields must be an object/);
});

test('the pages keep their order through the file', () => {
  const state = elements();
  state['toy-pages#pages'].pages.reverse();
  assert.deepEqual(fromFile(toFile('/', state)).elements['toy-pages#pages'].pages.map((page) => page.id), ['p2', 'p1']);
});

test('a file of another format, or of an unknown version, is rejected, not half loaded', () => {
  assert.throws(() => fromFile(JSON.stringify({ format: 'wod-character', version: 2 })), /not a Toybox file: format is "wod-character"/);
  assert.throws(() => fromFile('{not json'), /not a Toybox file/);
  const text = JSON.stringify({ ...JSON.parse(toFile('/', elements())), version: VERSION + 1 });
  assert.throws(() => fromFile(text), new RegExp(`version ${VERSION + 1} is not supported`));
  assert.throws(() => fromFile(JSON.stringify({ format: 'toybox-file', version: VERSION, page: '/', elements: [] })), /elements must be an object/);
});

test('a page of an unknown kind, a repeated page id or a missing field is rejected by name', () => {
  const pages = elements()['toy-pages#pages'];
  assert.throws(() => checkPagesState({ pages: [...pages.pages, { id: 'p3', kind: 'map', strokes: [] }] }), /pages\[2\]\.kind/);
  assert.throws(() => checkPagesState({ pages: [...pages.pages, { ...pages.pages[0] }] }), /pages\[2\]\.id "p1" is used twice/);
  assert.throws(() => checkPagesState({ pages: [{ id: 'p1', kind: 'notes', text: '', strokes: [] }] }), /pages\[0\]\.title must be a string/);
  assert.throws(() => checkPagesState({}), /must be \{ pages: \[\.\.\.\] \}/);
});

test('a picture that is not an image data URL, or misses its position, is rejected', () => {
  const bad = (img) => ({ pages: [{ id: 'p', kind: 'drawing', images: [img], strokes: [] }] });
  assert.throws(() => checkPagesState(bad({ ...PICTURE, src: 'https://example.com/a.png' })), /images\[0\]\.src must be an image data URL/);
  const { w, ...noWidth } = PICTURE;
  assert.ok(w);
  assert.throws(() => checkPagesState(bad(noWidth)), /images\[0\]\.w must be a number/);
});

test('strokes with an unknown tool, a bad colour, no size or mixed point shapes are rejected', () => {
  for (const [change, where] of [
    [{ tool: 'spray' }, /strokes\[0\]\.tool/],
    [{ color: 'red' }, /strokes\[0\]\.color/],
    [{ size: 0 }, /strokes\[0\]\.size/],
    [{ points: [] }, /strokes\[0\]\.points must/],
    [{ points: [[1, 1, 0.5], [2, 2]] }, /strokes\[0\]\.points\[1\]/],
  ]) {
    assert.throws(() => checkLayerState({ strokes: [{ ...STROKE, ...change }] }), where);
  }
});

test('the file is named after the page\'s title', () => {
  assert.equal(fileName('Ana the Unlucky'), 'Ana-the-Unlucky.json');
  assert.equal(fileName('  <> '), 'toybox.json');
  assert.equal(fileName(undefined), 'toybox.json');
});

test('Move up and Move down reorder the pages, and stop at either end', () => {
  const pages = ['a', 'b', 'c'];
  assert.deepEqual(reordered(pages, 0, 1), ['b', 'a', 'c']);
  assert.deepEqual(reordered(pages, 2, -1), ['a', 'c', 'b']);
  assert.equal(reordered(pages, 0, -1), pages);
  assert.equal(reordered(pages, 2, 1), pages);
});

test('the image editor\'s frame is the box, with notched corners when asked', () => {
  assert.equal(notchedPolygon(100, 50, 5).length, 12);
  assert.deepEqual(notchedPolygon(100, 50, 0), [[0, 0], [100, 0], [100, 50], [0, 50]]);
});
