// <dice-tray id="…" side="right|left" theme="…" roll-links save-log>: the floating dice tray.
// This class is all toybox.js holds of it; the tray itself (src/dice/tray.js, with the notation
// engine and the 2D dice) is a chunk loaded when the element connects.
//
// With roll-links, a click on any element of the page carrying data-roll="2d6+2" (and
// optionally data-roll-label, data-roll-bands, data-roll-tray="#id") rolls into the nearest
// tray: the one named by data-roll-tray, else the tray the element is inside, else the first
// tray on the page that has roll-links.
import { lazyElementBase } from './lazy.js';

const linkTrays = new WeakMap(); // document -> Set of <dice-tray roll-links>

function trayFor(link, path, trays) {
  const named = link.getAttribute('data-roll-tray');
  if (named) {
    const tray = link.ownerDocument.querySelector(named);
    if (!tray || tray.localName !== 'dice-tray') throw new Error(`data-roll-tray="${named}" names no <dice-tray>`);
    return tray;
  }
  const inside = path.find((node) => trays.has(node));
  if (inside) return inside;
  return [...trays].sort((a, b) => (a.compareDocumentPosition(b) & 4 ? -1 : 1))[0];
}

function onRollClick(event) {
  const trays = linkTrays.get(event.currentTarget);
  const path = event.composedPath();
  const link = path.find((node) => node.nodeType === 1 && node.hasAttribute('data-roll'));
  if (!link || !trays?.size) return;
  event.preventDefault();
  const tray = trayFor(link, path, trays);
  const label = link.getAttribute('data-roll-label') ?? undefined;
  const bands = link.getAttribute('data-roll-bands') ?? undefined;
  // The tray writes a failed roll (bad notation) into its own log, where the user sees it.
  tray.roll(link.getAttribute('data-roll'), { label, bands }).catch(() => {});
}

function listenForLinks(tray, on) {
  const doc = tray.ownerDocument;
  let trays = linkTrays.get(doc);
  if (!trays) {
    trays = new Set();
    linkTrays.set(doc, trays);
  }
  const before = trays.size;
  if (on) trays.add(tray);
  else trays.delete(tray);
  if (before === 0 && trays.size > 0) doc.addEventListener('click', onRollClick);
  if (before > 0 && trays.size === 0) doc.removeEventListener('click', onRollClick);
}

export const TRAY_SIDES = ['right', 'left'];

export function diceTrayClass(Base, catalog, load) {
  const Lazy = lazyElementBase(Base, {
    load,
    css: ':host { display: contents; } .toybox > .error { position: fixed; right: 16px; bottom: 16px; }',
  });
  return class DiceTray extends Lazy {
    static get observedAttributes() { return [...super.observedAttributes, 'side', 'roll-links']; }

    connected() {
      super.connected();
      listenForLinks(this, this.hasAttribute('roll-links'));
    }

    disconnected() {
      listenForLinks(this, false);
      super.disconnected();
    }

    attributeChanged(name) {
      if (name === 'roll-links') listenForLinks(this, this.hasAttribute('roll-links'));
      super.attributeChanged(name);
    }

    get side() {
      const value = this.getAttribute('side') ?? 'right';
      if (!TRAY_SIDES.includes(value)) throw new Error(`<dice-tray> side="${value}": use one of ${TRAY_SIDES.join(', ')}`);
      return value;
    }

    /**
     * Rolls notation ("2d6+2", "4d6kh3", "3d13") into the tray: logs it, fires `roll`, and
     * resolves to the result { notation, label, total, dice, groups, band }. options.label names
     * the roll in the log; options.bands names a band set (registerBands) to read the total by.
     */
    async roll(notation, options = {}) { return (await this.implementation()).roll(notation, options); }

    async open() { (await this.implementation()).open(); }

    async close() { (await this.implementation()).close(); }

    async clearLog() { (await this.implementation()).clearLog(); }

    /** The log, oldest first, as plain entries { time, what, faces, groups, total, band }. */
    async log() { return (await this.implementation()).log(); }

    /** The name the log is saved under in a saved file (with save-log). */
    get toyboxKey() { return `dice-tray#${this.id || 'dice-tray'}`; }

    async toyboxState() { return (await this.implementation()).saveState(); }

    async loadToyboxState(state) { (await this.implementation()).loadState(state); }
  };
}
