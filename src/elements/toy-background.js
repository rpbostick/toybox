// <toy-background effects="lines,aurora" controls="full|compact|none" theme="…"
// ripple|sheet|spin|momentum="off">: an animated background fixed behind the page, with its
// controls where the element sits. Content the
// background must not react under is marked data-solid. This class is all toybox.js holds of
// it; the backgrounds are the chunk loaded when it connects. A page adds its own backgrounds
// with registerBackground().
import { CONTROL_MODES, MOTIONS, onRegistered, parseEffects, parseMotion } from '../background/backgrounds.js';
import { lazyElementBase } from './lazy.js';

export function toyBackgroundClass(Base, catalog, load) {
  const Lazy = lazyElementBase(Base, { load, css: ':host { display: block; }' });
  return class ToyBackground extends Lazy {
    #unsubscribe = null;

    static get observedAttributes() { return [...super.observedAttributes, 'effects', 'controls', ...MOTIONS]; }

    connected() {
      super.connected();
      // Checked now rather than when the chunk has loaded, so a typo fails at once.
      void this.effects;
      void this.controlsMode;
      void this.motion;
      // A background registered later joins the cycle of an element that shows every one. An
      // element that cannot restart (its own controls="…" is wrong, which threw when it was set)
      // says so on its page's console rather than failing the registration for every element.
      this.#unsubscribe = onRegistered((id) => {
        if (this.hasAttribute('effects')) return;
        try {
          super.attributeChanged('effects');
        } catch (error) {
          this.ownerDocument.defaultView.console.error(`<toy-background> could not take in the background "${id}":`, error);
        }
      });
    }

    disconnected() {
      this.#unsubscribe?.();
      this.#unsubscribe = null;
      super.disconnected();
    }

    attributeChanged(name) {
      if (name === 'effects') void this.effects;
      if (name === 'controls') void this.controlsMode;
      if (MOTIONS.includes(name)) void this.motion;
      super.attributeChanged(name);
    }

    /** Which drag dynamics are on: { ripple, sheet, spin, momentum }. */
    get motion() { return parseMotion((name) => this.getAttribute(name)); }

    /** The background ids the name button cycles through, in order. */
    get effects() { return parseEffects(this.getAttribute('effects')); }

    get controlsMode() {
      const value = this.getAttribute('controls') ?? 'full';
      if (!CONTROL_MODES.includes(value)) throw new Error(`<toy-background> controls="${value}": use one of ${CONTROL_MODES.join(', ')}`);
      return value;
    }

    /** { background, on, interactive, colorMode, color, stop }. */
    async state() { return (await this.implementation()).state(); }

    /** Changes any of { background, on, interactive, colorMode }, as the controls do. */
    async set(change) { (await this.implementation()).set(change); }
  };
}
