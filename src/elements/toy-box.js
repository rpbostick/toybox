// <toy-box toy="newtons-cradle" theme="light|dark|auto">: one toy, embedded at the element's
// size (320 x 360 px unless the page sizes it), with Pause and Reset. Several boxes can show
// the same toy; each has its own instance.
import { createDrawer } from '../drawer.js';
import { BOX_CSS } from './styles.js';

const TEMPLATE = `
  <div class="toybox" part="box"><style></style>
    <div class="bar" part="bar">
      <h2 class="title"></h2>
      <button class="pause" type="button">Pause</button>
      <button class="reset" type="button">Reset</button>
    </div>
    <div class="stage"></div>
  </div>`;

export function toyBoxClass(Base, catalog) {
  return class ToyBox extends Base {
    static get observedAttributes() { return [...super.observedAttributes, 'toy']; }

    #drawer = null;
    #parts = null;
    /** Settles when the toy named by toy="…" has been mounted (or failed to load). */
    loaded = null;

    connected() {
      this.root.innerHTML = TEMPLATE;
      const find = (selector) => this.root.querySelector(selector);
      find('style').textContent = BOX_CSS;
      this.#parts = { stage: find('.stage'), title: find('.title'), pause: find('.pause') };
      this.#drawer = createDrawer({
        catalog,
        stage: this.#parts.stage,
        environment: () => this.environment(),
        hidden: () => this.outOfSight,
        onChange: (state) => this.#show(state),
      });
      this.listen(this.#parts.pause, 'click', () => this.#drawer.togglePause());
      this.listen(find('.reset'), 'click', () => this.#drawer.reset());
      this.#openToy();
    }

    disconnected() { this.#drawer.close(); }

    attributeChanged(name) { if (name === 'toy') this.#openToy(); }

    environmentChanged() { this.#drawer.remount(); }

    hiddenChanged(outOfSight) { this.#drawer.setHidden(outOfSight); }

    /** { id, running, pausedByUser } of the toy (id null until it has loaded). */
    get state() { return this.#drawer.state(); }

    get toyMeta() {
      const id = this.getAttribute('toy');
      const meta = catalog.find((entry) => entry.id === id);
      if (!meta) throw new Error(`<toy-box toy="${id ?? ''}">: no such toy; the toys are ${catalog.map((entry) => entry.id).join(', ')}`);
      return meta;
    }

    #openToy() {
      const { title, stage } = this.#parts;
      let meta;
      try {
        meta = this.toyMeta;
      } catch (error) {
        this.#drawer.close();
        title.textContent = 'No toy';
        const message = this.ownerDocument.createElement('p');
        message.className = 'error';
        message.textContent = error.message;
        stage.replaceChildren(message);
        throw error;
      }
      stage.replaceChildren();
      title.textContent = `${meta.name}…`;
      title.title = `${meta.credit}. Licence: ${meta.licence}.`;
      this.loaded = this.#drawer.open(meta.id);
    }

    #show(state) {
      const { pause, title } = this.#parts;
      pause.textContent = state.running ? 'Pause' : 'Play';
      if (state.id) title.textContent = catalog.find((entry) => entry.id === state.id).name;
      this.dispatchEvent(new this.ownerDocument.defaultView.CustomEvent('toy-change', { detail: state, bubbles: true, composed: true }));
    }
  };
}
