// One drawing layer: an <svg> in its own units holding only strokes (pictures live on a separate
// svg underneath), drawn and erased with the pointer. The strokes and their undo steps are a
// StrokeHistory (strokes.js); this turns pointer input into strokes and shows them.
import { capturedPoints, strokeMarkup, strokeTouched, StrokeHistory } from './strokes.js';

export const SVGNS = 'http://www.w3.org/2000/svg';

export function makeSvg(doc, className, viewBox) {
  const svg = doc.createElementNS(SVGNS, 'svg');
  svg.setAttribute('class', className);
  svg.setAttribute('viewBox', viewBox);
  return svg;
}

/**
 * A client point in an svg's own units. The svgs are laid out at their viewBox's aspect ratio,
 * so the box on screen maps straight onto the viewBox.
 */
export function toUnits(svg, clientX, clientY) {
  const rect = svg.getBoundingClientRect();
  const [x, y, width, height] = svg.getAttribute('viewBox').split(/[\s,]+/).map(Number);
  if (!rect.width || !rect.height) throw new Error('the drawing layer has no size on screen');
  return { x: x + ((clientX - rect.left) * width) / rect.width, y: y + ((clientY - rect.top) * height) / rect.height };
}

// A stroke's markup never changes once drawn, and perfect-freehand's outline is the costly part.
const markupOf = new WeakMap();
function cachedMarkup(stroke) {
  if (!markupOf.has(stroke)) markupOf.set(stroke, strokeMarkup(stroke));
  return markupOf.get(stroke);
}

export class InkLayer {
  /**
   * brush(): the tool bar's current { tool: "pen" | "highlighter" | "eraser", color, size }.
   * onStart(layer): a stroke or erase begins here. onChange(layer): the strokes changed.
   */
  constructor(svg, { name, brush, onStart = () => {}, onChange }) {
    this.svg = svg;
    this.name = name;
    this.brush = brush;
    this.onStart = onStart;
    this.onChange = onChange;
    this.history = new StrokeHistory();
    this.erasing = new Set();
    this.live = null;
    this.abort = new AbortController();
    svg.addEventListener('pointerdown', (event) => this.down(event), { signal: this.abort.signal });
  }

  toLayer(event) {
    const at = toUnits(this.svg, event.clientX, event.clientY);
    return [at.x, at.y, event.pressure ?? 0.5];
  }

  down(event) {
    if (event.button !== 0 || this.live) return;
    event.preventDefault();
    this.onStart(this);
    const brush = this.brush();
    const id = event.pointerId;
    this.svg.setPointerCapture?.(id);
    const raw = [this.toLayer(event)];
    const live = { brush, raw, pointerType: event.pointerType };
    this.live = live;
    if (brush.tool === 'eraser') this.erase(raw[0], raw[0]);
    else this.showLive();
    const move = (moveEvent) => {
      if (moveEvent.pointerId !== id) return;
      const events = moveEvent.getCoalescedEvents?.() ?? [];
      for (const each of events.length ? events : [moveEvent]) {
        const at = this.toLayer(each);
        if (brush.tool === 'eraser') this.erase(raw.at(-1), at);
        raw.push(at);
      }
      if (brush.tool !== 'eraser') this.showLive();
    };
    const up = (upEvent) => {
      if (upEvent.pointerId !== id) return;
      this.svg.removeEventListener('pointermove', move);
      this.svg.removeEventListener('pointerup', up);
      this.svg.removeEventListener('pointercancel', up);
      this.live = null;
      if (brush.tool === 'eraser') this.endErase();
      else this.endStroke(live);
    };
    this.svg.addEventListener('pointermove', move);
    this.svg.addEventListener('pointerup', up);
    this.svg.addEventListener('pointercancel', up);
  }

  liveStroke({ brush, raw, pointerType }) {
    return { tool: brush.tool, color: brush.color, size: brush.size, points: capturedPoints(raw, pointerType) };
  }

  showLive() {
    this.render(strokeMarkup(this.liveStroke(this.live)));
  }

  endStroke(live) {
    this.history.add(this.liveStroke(live));
    this.render();
    this.onChange(this);
  }

  /** Strokes touched during one eraser drag disappear at once and go as one undo step when it ends. */
  erase(from, to) {
    const move = { x1: from[0], y1: from[1], x2: to[0], y2: to[1] };
    let hit = false;
    for (const stroke of this.history.strokes) {
      if (!this.erasing.has(stroke) && strokeTouched(stroke, move)) {
        this.erasing.add(stroke);
        hit = true;
      }
    }
    if (hit) this.render();
  }

  endErase() {
    const removed = this.history.remove([...this.erasing]);
    this.erasing.clear();
    this.render();
    if (removed) this.onChange(this);
  }

  /** The committed strokes, as one SVG fragment (for rendering a page or an image to a picture). */
  markup() {
    return this.history.strokes.map(cachedMarkup).join('');
  }

  render(extra = '') {
    this.svg.innerHTML = this.history.strokes.filter((stroke) => !this.erasing.has(stroke)).map(cachedMarkup).join('') + extra;
  }

  load(strokes) {
    this.history.load(strokes);
    this.render();
  }

  dump() {
    return this.history.dump();
  }

  get count() {
    return this.history.strokes.length;
  }

  undo() {
    if (this.live || !this.history.undo()) return;
    this.render();
    this.onChange(this);
  }

  redo() {
    if (this.live || !this.history.redo()) return;
    this.render();
    this.onChange(this);
  }

  clear() {
    if (this.live || !this.history.clear()) return;
    this.render();
    this.onChange(this);
  }

  destroy() {
    this.abort.abort();
  }
}
