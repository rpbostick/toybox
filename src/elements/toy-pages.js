// <toy-pages id="…" size="letter|a4" buttons="all|none" theme="…">: notes and drawing pages after the page's own
// content, saved in the browser and printed one per sheet, with Save file and Open file for
// everything the page's Toybox elements keep. This class is all toybox.js holds of it; the pages
// (src/draw/pages.js) are the chunk loaded when it connects.
import { lazyElementBase } from './lazy.js';

// Height over width: US Letter (8.5 × 11 in) and A4 (210 × 297 mm).
const SIZES = { letter: 11 / 8.5, a4: 297 / 210 };
export const BUTTON_MODES = ['all', 'none'];

export function toyPagesClass(Base, catalog, load) {
  const Lazy = lazyElementBase(Base, { load, css: ':host { display: block; }' });
  return class ToyPages extends Lazy {
    static get observedAttributes() { return [...super.observedAttributes, 'buttons']; }

    connected() {
      super.connected();
      void this.pageRatio;
      void this.buttonsSetting;
    }

    /** buttons="none" hides Save file, Open file and Print, for a page that has its own. */
    get buttonsSetting() {
      const value = this.getAttribute('buttons') ?? 'all';
      if (!BUTTON_MODES.includes(value)) throw new Error(`<toy-pages> buttons="${value}": use one of ${BUTTON_MODES.join(', ')}`);
      return value;
    }

    /** The page's height over its width, from size="letter|a4" (letter by default). */
    get pageRatio() {
      const size = this.getAttribute('size') ?? 'letter';
      if (!Object.hasOwn(SIZES, size)) throw new Error(`<toy-pages> size="${size}": use one of ${Object.keys(SIZES).join(', ')}`);
      return SIZES[size];
    }

    /** The name the pages are saved under, in the browser and in a saved file. */
    get toyboxKey() { return `toy-pages#${this.id || 'pages'}`; }

    /** Adds a "notes" or "drawing" page at the end; resolves to its id. */
    async addPage(kind) { return (await this.implementation()).addPage(kind); }

    async removePage(id) { (await this.implementation()).removePage(id); }

    /** Moves a page `step` places (-1 up, 1 down). */
    async movePage(id, step) { (await this.implementation()).movePage(id, step); }

    /** The pages, in order, as they are saved. */
    async pages() { return (await this.implementation()).pages(); }

    async toyboxState() { return (await this.implementation()).saveState(); }

    async loadToyboxState(state) { (await this.implementation()).loadState(state); }
  };
}
