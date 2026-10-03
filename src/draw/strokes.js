// Strokes on a drawing layer, in the layer's own units: how each is drawn as SVG, which ones the
// eraser touches, and the layer's undo history. A stroke is
//   { tool: "pen" | "highlighter", color: "#rrggbb", size, points: [[x, y], ...] or [[x, y, pressure], ...] }
// and is saved exactly in this shape (savefile.js checks it).
import { getStroke } from 'perfect-freehand';
import { segmentDistance } from './segments.js';

// Pen strokes are perfect-freehand outlines with these settings.
const PEN = { thinning: 0.7, smoothing: 0.5, streamline: 0.45 };
// The highlighter is a constant-width line at this opacity, so text under it stays readable.
export const HIGHLIGHT_OPACITY = 0.35;
// How far from the eraser's path a stroke's centre line is still touched, in layer units (a
// layer is 1000 units across, so about 6 CSS px on a 1000 px wide target).
export const ERASER_RADIUS = 6;

const round = (value, places) => Number(value.toFixed(places));

/**
 * Points as captured: [x, y, pressure]. A mouse, and hardware without pressure, reports 0.5
 * while a button is down (0 on some touch screens), so such a stroke keeps no pressure and the
 * pen simulates it from speed instead.
 */
export function capturedPoints(raw, pointerType) {
  const pressured = pointerType !== 'mouse' && raw.some(([, , p]) => p > 0 && p !== 0.5);
  return raw.map(([x, y, p]) => (pressured ? [round(x, 1), round(y, 1), round(p, 2)] : [round(x, 1), round(y, 1)]));
}

/** perfect-freehand's outline as a smooth closed SVG path: quadratic curves through the midpoints. */
export function outlinePath(outline) {
  if (!outline.length) return '';
  const fmt = (value) => round(value, 1);
  const parts = [`M${fmt(outline[0][0])},${fmt(outline[0][1])}Q`];
  for (let i = 0; i < outline.length; i++) {
    const [x0, y0] = outline[i];
    const [x1, y1] = outline[(i + 1) % outline.length];
    parts.push(`${fmt(x0)},${fmt(y0)} ${fmt((x0 + x1) / 2)},${fmt((y0 + y1) / 2)} `);
  }
  parts.push('Z');
  return parts.join('');
}

function linePath(points) {
  const [first, ...rest] = points;
  return `M${first[0]},${first[1]}` + (rest.length ? rest.map(([x, y]) => `L${x},${y}`).join('') : `L${first[0]},${first[1]}`);
}

export function strokeMarkup(stroke) {
  if (stroke.tool === 'pen') {
    const outline = getStroke(stroke.points, { ...PEN, size: stroke.size, simulatePressure: stroke.points[0].length < 3, last: true });
    return `<path d="${outlinePath(outline)}" fill="${stroke.color}"/>`;
  }
  if (stroke.tool === 'highlighter') {
    return `<path d="${linePath(stroke.points)}" fill="none" stroke="${stroke.color}" stroke-opacity="${HIGHLIGHT_OPACITY}" `
      + `stroke-width="${stroke.size}" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  throw new Error(`unknown stroke tool ${JSON.stringify(stroke.tool)}`);
}

/** Whether the eraser's move (a segment) comes within the stroke's half width plus the eraser's radius. */
export function strokeTouched(stroke, move, radius = ERASER_RADIUS) {
  const reach = radius + stroke.size / 2;
  const points = stroke.points.length > 1 ? stroke.points : [stroke.points[0], stroke.points[0]];
  for (let i = 1; i < points.length; i++) {
    const piece = { x1: points[i - 1][0], y1: points[i - 1][1], x2: points[i][0], y2: points[i][1] };
    if (segmentDistance(move, piece) <= reach) return true;
  }
  return false;
}

/**
 * The strokes on one layer and its undo and redo steps. A step is a stroke added, a set of
 * strokes erased (one eraser drag) or a clear; undoing an erase or a clear puts each stroke back
 * at its place in the drawing order.
 */
export class StrokeHistory {
  constructor() {
    this.strokes = [];
    this.done = [];
    this.undone = [];
  }

  load(strokes) {
    this.strokes = strokes.map((stroke) => ({ ...stroke, points: stroke.points.map((point) => point.slice()) }));
    this.done = [];
    this.undone = [];
  }

  dump() {
    return this.strokes.map(({ tool, color, size, points }) => ({ tool, color, size, points: points.map((point) => point.slice()) }));
  }

  add(stroke) {
    this.strokes.push(stroke);
    this.record({ kind: 'add', stroke });
  }

  /** Removes the given strokes as one step; false when none of them is on the layer. */
  remove(strokes) {
    const removed = this.strokes.map((stroke, index) => ({ stroke, index })).filter(({ stroke }) => strokes.includes(stroke));
    if (!removed.length) return false;
    this.strokes = this.strokes.filter((stroke) => !strokes.includes(stroke));
    this.record({ kind: 'remove', removed });
    return true;
  }

  clear() {
    return this.remove(this.strokes.slice());
  }

  record(step) {
    this.done.push(step);
    this.undone = [];
  }

  undo() {
    const step = this.done.pop();
    if (!step) return false;
    if (step.kind === 'add') this.strokes = this.strokes.filter((stroke) => stroke !== step.stroke);
    else for (const { stroke, index } of step.removed) this.strokes.splice(index, 0, stroke);
    this.undone.push(step);
    return true;
  }

  redo() {
    const step = this.undone.pop();
    if (!step) return false;
    if (step.kind === 'add') this.strokes.push(step.stroke);
    else this.strokes = this.strokes.filter((stroke) => !step.removed.some((item) => item.stroke === stroke));
    this.done.push(step);
    return true;
  }
}
