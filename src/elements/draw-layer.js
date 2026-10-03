// <draw-layer for="#selector" id="…" corner="…" toggles-scope="layer|browser" theme="…">: a
// scribble layer over the element `for` names, with a Draw button in a corner of the window
// that opens its pen tool bar, Show scribbles and Print scribbles. This class is all toybox.js
// holds of it; the layer (src/draw/layer.js, with perfect-freehand and idb-keyval) is the chunk
// loaded when it connects.
import { DEFAULT_CORNER, checkCorner } from '../draw/button-place.js';
import { lazyElementBase } from './lazy.js';

export const TOGGLES_SCOPES = ['layer', 'browser'];

export function drawLayerClass(Base, catalog, load) {
  const Lazy = lazyElementBase(Base, { load, css: ':host { display: block; }' });
  return class DrawLayer extends Lazy {
    static get observedAttributes() { return [...super.observedAttributes, 'for', 'corner', 'toggles-scope']; }

    connected() {
      super.connected();
      void this.target;
      void this.corner;
      void this.togglesScope;
    }

    attributeChanged(name) {
      if (name === 'corner') {
        void this.corner;
        super.attributeChanged(name);
        return;
      }
      // A layer over another element, or keeping its Show and Print choices elsewhere, is a
      // different layer: mount it afresh.
      this.disconnected();
      try {
        this.connected();
      } finally {
        this.applyTheme();
      }
    }

    /** The element drawn over. */
    get target() {
      const selector = this.getAttribute('for');
      if (!selector) throw new Error('<draw-layer> needs for="#selector": the element to draw over');
      const found = this.ownerDocument.querySelector(selector);
      if (!found) throw new Error(`<draw-layer for="${selector}">: no such element on the page`);
      return found;
    }

    /** corner="bottom-left|bottom-right|top-left|top-right": where the Draw button sits until moved. */
    get corner() { return checkCorner(this.getAttribute('corner') ?? DEFAULT_CORNER, '<draw-layer>'); }

    /** toggles-scope="layer|browser": Show and Print scribbles kept per layer, or once per browser. */
    get togglesScope() {
      const value = this.getAttribute('toggles-scope') ?? 'layer';
      if (!TOGGLES_SCOPES.includes(value)) throw new Error(`<draw-layer> toggles-scope="${value}": use one of ${TOGGLES_SCOPES.join(', ')}`);
      return value;
    }

    /** The name the layer is saved under, in the browser and in a saved file. */
    get toyboxKey() { return `draw-layer#${this.id || this.getAttribute('for')}`; }

    async strokes() { return (await this.implementation()).strokes(); }

    async clear() { (await this.implementation()).clear(); }

    /** Turns Draw on or off: while on, the pointer draws instead of reaching the target. */
    async setDraw(on) { (await this.implementation()).setDraw(on); }

    async toyboxState() { return (await this.implementation()).saveState(); }

    async loadToyboxState(state) { (await this.implementation()).loadState(state); }
  };
}
