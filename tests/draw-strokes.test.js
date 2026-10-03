// Strokes (src/draw/strokes.js): what a captured stroke keeps, how it is drawn, what the eraser
// touches, and undo and redo of adding, erasing and clearing.
import { test } from "node:test";
import assert from "node:assert/strict";
import { capturedPoints, strokeMarkup, strokeTouched, StrokeHistory, HIGHLIGHT_OPACITY } from "../src/draw/strokes.js";

const pen = (x, extra = {}) => ({ tool: "pen", color: "#3b2a7a", size: 6, points: [[x, 0], [x, 50], [x, 100]], ...extra });

test("a mouse stroke keeps no pressure; a pen's varying pressure is kept, rounded", () => {
  assert.deepEqual(capturedPoints([[1.234, 2.345, 0.5], [3, 4, 0.5]], "mouse"), [[1.2, 2.3], [3, 4]]);
  assert.deepEqual(capturedPoints([[1, 2, 0.123], [3, 4, 0.8]], "pen"), [[1, 2, 0.12], [3, 4, 0.8]]);
});

test("a pen or touch that only reports the no-pressure values keeps no pressure", () => {
  assert.deepEqual(capturedPoints([[1, 2, 0.5], [3, 4, 0.5]], "pen"), [[1, 2], [3, 4]]);
  assert.deepEqual(capturedPoints([[1, 2, 0], [3, 4, 0]], "touch"), [[1, 2], [3, 4]]);
});

test("a pen stroke is a filled outline in its colour; pressure changes its shape", () => {
  const plain = strokeMarkup(pen(10));
  assert.match(plain, /^<path d="M[\d.,]+Q[^"]+Z" fill="#3b2a7a"\/>$/);
  const pressed = strokeMarkup({ ...pen(10), points: [[10, 0, 0.1], [10, 50, 0.9], [10, 100, 0.1]] });
  assert.notEqual(pressed, plain);
});

test("a single tap of the pen still draws a dot", () => {
  assert.match(strokeMarkup({ ...pen(10), points: [[10, 10]] }), /d="M[\d.,]+Q/);
});

test("a highlighter stroke is a translucent round-capped line of its size", () => {
  const markup = strokeMarkup({ tool: "highlighter", color: "#ffd400", size: 34, points: [[0, 0], [100, 0]] });
  assert.equal(markup, `<path d="M0,0L100,0" fill="none" stroke="#ffd400" stroke-opacity="${HIGHLIGHT_OPACITY}" stroke-width="34" stroke-linecap="round" stroke-linejoin="round"/>`);
});

test("an unknown tool fails loud", () => {
  assert.throws(() => strokeMarkup({ ...pen(0), tool: "spray" }), /unknown stroke tool "spray"/);
});

test("the eraser touches a stroke it crosses or passes within reach of, and not one further away", () => {
  const stroke = pen(100);
  assert.equal(strokeTouched(stroke, { x1: 50, y1: 50, x2: 150, y2: 50 }), true, "crossing");
  // Reach is the eraser's radius (ERASER_RADIUS, 6) plus half the stroke's size (3).
  assert.equal(strokeTouched(stroke, { x1: 108, y1: 0, x2: 108, y2: 100 }), true, "alongside, within reach");
  assert.equal(strokeTouched(stroke, { x1: 110, y1: 0, x2: 110, y2: 100 }), false, "alongside, just out of reach");
  assert.equal(strokeTouched(stroke, { x1: 130, y1: 0, x2: 130, y2: 100 }), false, "alongside, out of reach");
  assert.equal(strokeTouched({ ...stroke, points: [[100, 100]] }, { x1: 105, y1: 105, x2: 105, y2: 105 }), true, "a dot under a tap");
});

test("undo and redo step through added strokes", () => {
  const history = new StrokeHistory();
  const [a, b] = [pen(1), pen(2)];
  history.add(a);
  history.add(b);
  assert.equal(history.undo(), true);
  assert.deepEqual(history.strokes, [a]);
  assert.equal(history.redo(), true);
  assert.deepEqual(history.strokes, [a, b]);
  assert.equal(history.redo(), false, "nothing left to redo");
});

test("undoing an erase puts the strokes back in their places; a new stroke ends redo", () => {
  const history = new StrokeHistory();
  const [a, b, c, d] = [pen(1), pen(2), pen(3), pen(4)];
  history.load([a, b, c, d]);
  const [la, lb, lc, ld] = history.strokes;
  assert.equal(history.remove([lb, ld]), true);
  assert.deepEqual(history.strokes, [la, lc]);
  history.undo();
  assert.deepEqual(history.strokes, [la, lb, lc, ld]);
  history.redo();
  assert.deepEqual(history.strokes, [la, lc]);
  history.undo();
  history.add(pen(5));
  assert.equal(history.redo(), false);
});

test("clear is one undo step, and loaded strokes take part in undo like drawn ones", () => {
  const history = new StrokeHistory();
  history.load([pen(1), pen(2)]);
  history.add(pen(3));
  assert.equal(history.clear(), true);
  assert.equal(history.strokes.length, 0);
  history.undo();
  assert.equal(history.strokes.length, 3);
  history.undo();
  assert.deepEqual(history.dump(), [pen(1), pen(2)]);
  assert.equal(history.undo(), false, "loading is not an undo step");
});

test("erasing nothing records no step", () => {
  const history = new StrokeHistory();
  history.add(pen(1));
  assert.equal(history.remove([pen(9)]), false);
  assert.equal(new StrokeHistory().clear(), false);
  history.undo();
  assert.equal(history.strokes.length, 0);
});

test("dump copies the strokes, so later drawing does not change a saved copy", () => {
  const history = new StrokeHistory();
  history.add(pen(1));
  const saved = history.dump();
  history.strokes[0].points.push([9, 9]);
  assert.equal(saved[0].points.length, 3);
});
