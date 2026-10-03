// The eraser's geometry (src/draw/segments.js), with the moves drauu 1.0.0's own test misses.
import { test } from "node:test";
import assert from "node:assert/strict";
import { segmentsCross, segmentDistance, pointToSegment } from "../src/draw/segments.js";

// Stroke fragments and exactly vertical or horizontal eraser moves in layer units that drauu
// 1.0.0's own crossing test reports as not crossing (it misses about half of such moves).
const VERTICAL = [{ x1: 82.99, y1: 1546.45, x2: 104.51, y2: 1598.61 }, { x1: 91.24, y1: 1273.54, x2: 91.24, y2: 1873.54 }];
const HORIZONTAL = [{ x1: 676.35, y1: 152.27, x2: 666.45, y2: 174.68 }, { x1: 372.28, y1: 173.12, x2: 972.28, y2: 173.12 }];

test("an exactly vertical eraser move crosses the fragment it passes through", () => {
  assert.equal(segmentsCross(...VERTICAL), true);
});

test("an exactly horizontal eraser move crosses the fragment it passes through", () => {
  assert.equal(segmentsCross(...HORIZONTAL), true);
});

test("a move that stops short of the fragment does not cross", () => {
  assert.equal(segmentsCross(VERTICAL[0], { ...VERTICAL[1], y2: 1500 }), false);
});

test("a move beside the fragment's end does not cross", () => {
  assert.equal(segmentsCross(VERTICAL[0], { ...VERTICAL[1], x1: 110, x2: 110 }), false);
});

test("parallel segments do not cross", () => {
  assert.equal(segmentsCross({ x1: 0, y1: 0, x2: 10, y2: 0 }, { x1: 0, y1: 1, x2: 10, y2: 1 }), false);
});

test("crossing segments are zero apart; others are as far apart as their nearest ends", () => {
  assert.equal(segmentDistance(...VERTICAL), 0);
  assert.equal(segmentDistance({ x1: 0, y1: 0, x2: 10, y2: 0 }, { x1: 0, y1: 3, x2: 10, y2: 3 }), 3);
  assert.equal(segmentDistance({ x1: 0, y1: 0, x2: 10, y2: 0 }, { x1: 13, y1: 4, x2: 20, y2: 4 }), 5);
});

test("a point's distance to a zero-length segment is its distance to that point", () => {
  assert.equal(pointToSegment(3, 4, { x1: 0, y1: 0, x2: 0, y2: 0 }), 5);
});
