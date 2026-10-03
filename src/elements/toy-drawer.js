// <toy-drawer toys="a,b,…" theme="light|dark|auto" panel="inline|floating" max-running="4">: a
// drawer of toy cards. Inline, opening one shows it in a panel under the cards with Pause, Reset
// and Close; one toy is open at a time and only the open toy runs. Floating, the drawer is a
// window of its own (moved, resized, minimized, closed to a launcher) and each toy opens in a
// window of its own beside it, several at once, under the page's running cap.
import { assetUrl } from '../assets.js';
import { createDrawer } from '../drawer.js';
import { PREVIEWS } from '../previews.js';
import { pageKey, remembered } from './remembered.js';
import { DEFAULT_MAX_RUNNING } from './running-cap.js';
import { DRAWER_CSS } from './styles.js';
import { createToyWindows } from './toy-windows.js';
import { attachWindow, windowStack } from './window.js';

export const PANEL_MODES = ['inline', 'floating'];
export const DRAWER_WINDOW_SIZE = { w: 440, h: 520 };
export const DRAWER_WINDOW_MIN = { w: 240, h: 200 };
// The gap between the drawer's default window and the browser window's lower left corner.
export const DRAWER_WINDOW_MARGIN = 16;

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

/** max-running="…": a whole number of toys, 1 or more; absent means DEFAULT_MAX_RUNNING. */
export function parseMaxRunning(value) {
  if (value === null) return DEFAULT_MAX_RUNNING;
  if (!/^\s*\d+\s*$/.test(value) || Number(value) < 1) throw new Error(`<toy-drawer> max-running="${value}": use a whole number of toys, 1 or more`);
  return Number(value);
}

const TEMPLATE = `
  <div class="toybox" part="drawer"><style></style>
    <section class="window drawer-window" part="window">
      <header class="bar drawer-bar" part="window-bar" tabindex="0">
        <h2 id="drawer-title">Toys</h2>
        <button class="window-minimize" type="button">–</button>
        <button class="window-close" type="button" aria-label="Close the toy drawer" title="Close the toy drawer">×</button>
      </header>
      <div class="drawer-body">
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
      </div>
      <div class="grip drawer-grip" part="resize-handle" title="Resize"></div>
    </section>
    <button class="launcher" part="launcher" type="button" hidden>Toys</button>
    <div class="windows"></div>
  </div>`;

export function toyDrawerClass(Base, catalog) {
  return class ToyDrawer extends Base {
    static get observedAttributes() { return [...super.observedAttributes, 'toys', 'panel', 'max-running']; }

    #drawer = null;
    #parts = null;
    // Floating only: the drawer's own window, the toy windows, and the launcher's listener.
    #frame = null;
    #windows = null;
    #floating = null;

    connected() {
      this.root.innerHTML = TEMPLATE;
      const find = (selector) => this.root.querySelector(selector);
      find('style').textContent = DRAWER_CSS;
      this.#parts = {
        wrapper: find('.toybox'), cards: find('.cards'), panel: find('.panel'), stage: find('.stage'),
        title: find('#title'), pause: find('.pause'), credits: find('.credits ul'),
        drawerWindow: find('.drawer-window'), drawerBar: find('.drawer-bar'), grip: find('.drawer-grip'),
        minimize: find('.window-minimize'), windowClose: find('.window-close'), launcher: find('.launcher'), windows: find('.windows'),
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
      this.listen(find('.close'), 'click', () => this.#drawer.close());
      // Floating windows handle Escape themselves, each closing only itself.
      this.listen(this, 'keydown', (event) => { if (event.key === 'Escape' && this.panelMode === 'inline') this.#drawer.close(); });
      this.#renderCards();
      this.#applyPanelMode();
    }

    disconnected() {
      this.#drawer.close();
      this.#endFloating();
    }

    attributeChanged(name) {
      if (name === 'toys') this.#renderCards();
      if (name === 'panel') this.#applyPanelMode();
      if (name === 'max-running') {
        parseMaxRunning(this.getAttribute('max-running'));
        this.#windows?.update();
      }
    }

    environmentChanged() {
      this.#drawer.remount();
      this.#windows?.remount();
    }

    hiddenChanged(outOfSight) {
      if (this.#windows) this.#windows.update();
      else this.#drawer.setHidden(outOfSight);
    }

    visibilityTarget() { return this.#parts.panel; }

    /** The toys this drawer shows, in order. */
    get toys() { return parseToyList(this.getAttribute('toys'), catalog); }

    /**
     * { id, running, pausedByUser } of the open toy (id null when none is open); floating, of
     * the toy window focused last.
     */
    get state() {
      if (this.#windows) {
        const [front] = this.#windows.list();
        return front ? { id: front.id, running: front.running, pausedByUser: front.pausedByUser } : { id: null, running: false, pausedByUser: false };
      }
      return this.#drawer.state();
    }

    /** Floating: the open toy windows, focused last first, as { id, running, pausedByUser, minimized, capped }. */
    get windows() { return this.#windows ? this.#windows.list() : []; }

    get panelMode() {
      const value = this.getAttribute('panel') ?? 'inline';
      if (!PANEL_MODES.includes(value)) throw new Error(`<toy-drawer> panel="${value}": use one of ${PANEL_MODES.join(', ')}`);
      return value;
    }

    get maxRunning() { return parseMaxRunning(this.getAttribute('max-running')); }

    /** Floating: the drawer window's { x, y, w, h, open, minimized }; null inline. */
    get windowState() { return this.#frame ? this.#frame.state() : null; }

    async open(id) {
      const meta = this.toys.find((entry) => entry.id === id);
      if (!meta) throw new Error(`<toy-drawer>: no toy "${id}" in this drawer`);
      if (this.#windows) return this.#windows.open(id);
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

    /** Closes the open toy; floating, the window of toy `id`, or every toy window without one. */
    close(id) {
      if (!this.#windows) this.#drawer.close();
      else if (id === undefined) this.#windows.closeAll();
      else this.#windows.close(id);
    }

    #show(state) {
      const { panel, pause, title } = this.#parts;
      panel.hidden = state.id === null;
      pause.textContent = state.running ? 'Pause' : 'Play';
      this.#pressCards();
      if (state.id) title.textContent = catalog.find((entry) => entry.id === state.id).name;
      this.#changed();
    }

    #changed() {
      this.dispatchEvent(new this.ownerDocument.defaultView.CustomEvent('toy-change', { detail: this.state, bubbles: true, composed: true }));
    }

    #isOpen(id) { return this.#windows ? this.#windows.has(id) : this.#drawer.state().id === id; }

    #pressCards() {
      for (const card of this.#parts.cards.children) card.setAttribute('aria-pressed', String(this.#isOpen(card.dataset.toy)));
    }

    #renderCards() {
      const { cards, credits } = this.#parts;
      const toys = this.toys;
      const kept = (id) => toys.some((meta) => meta.id === id);
      if (this.#windows) {
        for (const { id } of this.#windows.list()) if (!kept(id)) this.#windows.close(id);
      } else {
        const openId = this.#drawer.state().id;
        if (openId && !kept(openId)) this.#drawer.close();
      }
      cards.replaceChildren(...toys.map((meta) => {
        const card = this.ownerDocument.createElement('button');
        card.type = 'button';
        card.className = 'card';
        card.setAttribute('part', 'card');
        card.dataset.toy = meta.id;
        card.setAttribute('aria-pressed', String(this.#isOpen(meta.id)));
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
      this.#parts.wrapper.dataset.panel = mode;
      this.#endFloating();
      if (mode === 'floating') {
        this.#drawer.close();
        this.#startFloating();
      }
      this.#pressCards();
    }

    #startFloating() {
      const win = this.ownerDocument.defaultView;
      const key = pageKey(win, this.id || 'toy-drawer');
      const { drawerWindow, drawerBar, grip, minimize, windowClose, launcher, windows } = this.#parts;
      drawerWindow.setAttribute('role', 'dialog');
      drawerWindow.setAttribute('aria-modal', 'false');
      drawerWindow.setAttribute('aria-labelledby', 'drawer-title');
      this.#frame = attachWindow({
        win,
        els: { box: drawerWindow, bar: drawerBar, grip, minimize, close: windowClose },
        store: remembered(win, `toy-drawer.window.${key}`),
        place: (viewport) => ({
          ...DRAWER_WINDOW_SIZE, x: DRAWER_WINDOW_MARGIN, y: viewport.height - DRAWER_WINDOW_SIZE.h - DRAWER_WINDOW_MARGIN, open: true, minimized: false,
        }),
        min: DRAWER_WINDOW_MIN,
        name: 'the toy drawer',
        stack: windowStack(this.ownerDocument),
        escapeCloses: true,
        onChange: (state) => { launcher.hidden = state.open; },
        onClose: () => launcher.focus(),
      });
      const abort = new AbortController();
      launcher.addEventListener('click', () => {
        this.#frame.open();
        drawerBar.focus();
      }, { signal: abort.signal });
      this.#floating = abort;
      this.#windows = createToyWindows({
        win,
        container: windows,
        catalog,
        environment: () => this.environment(),
        tabHidden: () => this.ownerDocument.hidden,
        storeFor: (id) => remembered(win, `toy-drawer.toy-window.${key}.${id}`),
        anchor: () => this.#frame.state(),
        maxRunning: () => this.maxRunning,
        onChange: () => {
          this.#pressCards();
          this.#changed();
        },
      });
      this.#windows.restore(this.toys.map((meta) => meta.id)).catch(() => {}); // each window shows its own failure
    }

    #endFloating() {
      if (!this.#frame) return;
      this.#windows.destroy();
      this.#frame.detach();
      this.#floating.abort();
      this.#windows = null;
      this.#frame = null;
      this.#floating = null;
      const { drawerWindow, launcher } = this.#parts;
      for (const name of ['role', 'aria-modal', 'aria-labelledby']) drawerWindow.removeAttribute(name);
      for (const property of ['left', 'top', 'width', 'height', 'z-index']) drawerWindow.style.removeProperty(property);
      drawerWindow.classList.remove('minimized');
      drawerWindow.hidden = false;
      launcher.hidden = true;
    }
  };
}
