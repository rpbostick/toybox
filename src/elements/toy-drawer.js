// <toy-drawer toys="a,b,…" theme="light|dark|auto" panel="inline|floating">: a drawer of toy
// cards; opening one shows it in a panel with Pause, Reset and Close. One toy is open at a
// time and only the open toy runs.
import { assetUrl } from '../assets.js';
import { createDrawer } from '../drawer.js';
import { PREVIEWS } from '../previews.js';
import { makeDraggable } from './floating.js';
import { DRAWER_CSS } from './styles.js';

export const PANEL_MODES = ['inline', 'floating'];

/** The catalog entries a toys="…" attribute names, in its order; null means all of them. */
export function parseToyList(value, catalog) {
  if (value === null) return catalog;
  const ids = value.split(',').map((id) => id.trim()).filter(Boolean);
  if (ids.length === 0) throw new Error('<toy-drawer> toys="": name at least one toy, or leave the attribute out for all');
  const seen = new Set();
  return ids.map((id) => {
    const meta = catalog.find((entry) => entry.id === id);
    if (!meta) throw new Error(`<toy-drawer> toys: no toy "${id}"; the toys are ${catalog.map((entry) => entry.id).join(', ')}`);
    if (seen.has(id)) throw new Error(`<toy-drawer> toys: "${id}" is named twice`);
    seen.add(id);
    return meta;
  });
}

const TEMPLATE = `
  <div class="toybox" part="drawer"><style></style>
    <div class="cards" part="cards"></div>
    <section class="panel" part="panel" hidden aria-labelledby="title">
      <div class="bar" part="panel-bar">
        <h2 id="title"></h2>
        <button class="pause" type="button">Pause</button>
        <button class="reset" type="button">Reset</button>
        <button class="close" type="button" aria-label="Close">Close</button>
      </div>
      <div class="stage"></div>
    </section>
    <details class="credits" part="credits">
      <summary>Credits and licences</summary>
      <ul></ul>
      <p>Full licence texts: <a class="licences">THIRD_PARTY_LICENSES.txt</a>. The physics toys use
        <a href="https://github.com/liabru/matter-js">matter.js</a> (MIT). The twisty cube and the music box run on
        their own pages in a frame, with their source zips linked under them.</p>
    </details>
  </div>`;

export function toyDrawerClass(Base, catalog) {
  return class ToyDrawer extends Base {
    static get observedAttributes() { return [...super.observedAttributes, 'toys', 'panel']; }

    #drawer = null;
    #parts = null;
    #undrag = null;

    connected() {
      this.root.innerHTML = TEMPLATE;
      const find = (selector) => this.root.querySelector(selector);
      find('style').textContent = DRAWER_CSS;
      this.#parts = {
        wrapper: find('.toybox'), cards: find('.cards'), panel: find('.panel'), stage: find('.stage'),
        title: find('#title'), pause: find('.pause'), credits: find('.credits ul'),
      };
      find('.licences').href = assetUrl('THIRD_PARTY_LICENSES.txt');
      this.#drawer = createDrawer({
        catalog,
        stage: this.#parts.stage,
        environment: () => this.environment(),
        hidden: () => this.outOfSight,
        onChange: (state) => this.#show(state),
      });
      this.listen(this.#parts.pause, 'click', () => this.#drawer.togglePause());
      this.listen(find('.reset'), 'click', () => this.#drawer.reset());
      this.listen(find('.close'), 'click', () => this.close());
      this.listen(this, 'keydown', (event) => { if (event.key === 'Escape') this.close(); });
      this.#renderCards();
      this.#applyPanelMode();
    }

    disconnected() {
      this.#drawer.close();
      this.#undrag?.();
      this.#undrag = null;
    }

    attributeChanged(name) {
      if (name === 'toys') this.#renderCards();
      if (name === 'panel') this.#applyPanelMode();
    }

    environmentChanged() { this.#drawer.remount(); }

    hiddenChanged(outOfSight) { this.#drawer.setHidden(outOfSight); }

    visibilityTarget() { return this.#parts.panel; }

    /** The toys this drawer shows, in order. */
    get toys() { return parseToyList(this.getAttribute('toys'), catalog); }

    /** { id, running, pausedByUser } of the open toy (id null when none is open). */
    get state() { return this.#drawer.state(); }

    get panelMode() {
      const value = this.getAttribute('panel') ?? 'inline';
      if (!PANEL_MODES.includes(value)) throw new Error(`<toy-drawer> panel="${value}": use one of ${PANEL_MODES.join(', ')}`);
      return value;
    }

    async open(id) {
      const meta = this.toys.find((entry) => entry.id === id);
      if (!meta) throw new Error(`<toy-drawer>: no toy "${id}" in this drawer`);
      const { title, panel } = this.#parts;
      title.textContent = `${meta.name}…`;
      panel.hidden = false;
      try {
        await this.#drawer.open(id);
      } catch (error) {
        title.textContent = `${meta.name}: could not open (${error.message})`;
        throw error;
      }
    }

    close() { this.#drawer.close(); }

    #show(state) {
      const { panel, pause, title, cards } = this.#parts;
      panel.hidden = state.id === null;
      pause.textContent = state.running ? 'Pause' : 'Play';
      for (const card of cards.children) card.setAttribute('aria-pressed', String(card.dataset.toy === state.id));
      if (state.id) title.textContent = catalog.find((entry) => entry.id === state.id).name;
      this.dispatchEvent(new this.ownerDocument.defaultView.CustomEvent('toy-change', { detail: state, bubbles: true, composed: true }));
    }

    #renderCards() {
      const { cards, credits } = this.#parts;
      const toys = this.toys;
      const openId = this.#drawer.state().id;
      if (openId && !toys.some((meta) => meta.id === openId)) this.close();
      cards.replaceChildren(...toys.map((meta) => {
        const card = this.ownerDocument.createElement('button');
        card.type = 'button';
        card.className = 'card';
        card.setAttribute('part', 'card');
        card.dataset.toy = meta.id;
        card.setAttribute('aria-pressed', String(meta.id === openId));
        card.innerHTML = `${PREVIEWS[meta.id]}<span></span>`;
        card.querySelector('span').textContent = meta.name;
        card.addEventListener('click', () => { this.open(meta.id); });
        return card;
      }));
      credits.replaceChildren(...toys.map((meta) => this.#creditItem(meta)));
    }

    #creditItem(meta) {
      const doc = this.ownerDocument;
      const item = doc.createElement('li');
      const name = doc.createElement('strong');
      name.textContent = meta.name;
      item.append(name, `: ${meta.credit}. Licence: ${meta.licence}.`);
      const links = [['source', meta.source], ['source zip', meta.sourceZip && assetUrl(meta.sourceZip)]];
      for (const [label, href] of links) {
        if (!href) continue;
        const link = doc.createElement('a');
        link.href = href;
        link.textContent = label;
        item.append(' ', link);
      }
      return item;
    }

    #applyPanelMode() {
      const mode = this.panelMode;
      const { wrapper, panel } = this.#parts;
      wrapper.dataset.panel = mode;
      this.#undrag?.();
      this.#undrag = mode === 'floating'
        ? makeDraggable({ handle: panel.querySelector('.bar'), box: panel, win: this.ownerDocument.defaultView })
        : null;
    }
  };
}
