// What every Toybox element shares: an open shadow root, the theme attribute (light, dark or
// auto, which follows the system), prefers-reduced-motion, and knowing when it cannot be
// seen (the tab is hidden, or its visible part is scrolled off screen). Subclasses implement
// connected() (which must put one wrapper element in this.root), disconnected(),
// environmentChanged() and hiddenChanged(outOfSight), and may override attributeChanged(name)
// and visibilityTarget().
//
// The class is made per window (toyElementBase(win)) so tests can define the elements in a
// DOM of their own without touching globals.

export const THEMES = ['light', 'dark', 'auto'];

export function toyElementBase(win) {
  return class ToyElement extends win.HTMLElement {
    static get observedAttributes() { return ['theme']; }

    #cleanups = [];
    #darkQuery = null;
    #motionQuery = null;
    #offscreen = false;
    #live = false;

    constructor() {
      super();
      this.root = this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
      this.#darkQuery = win.matchMedia('(prefers-color-scheme: dark)');
      this.#motionQuery = win.matchMedia('(prefers-reduced-motion: reduce)');
      this.listen(this.#darkQuery, 'change', () => { if (this.themeSetting === 'auto') this.#environmentChanged(); });
      this.listen(this.#motionQuery, 'change', () => this.#environmentChanged());
      this.listen(win.document, 'visibilitychange', () => this.hiddenChanged(this.outOfSight));
      // An element whose attributes are wrong when it connects (say, an unknown toy) throws,
      // but stays live, so fixing the attribute afterwards brings it up.
      this.#live = true;
      try {
        this.connected();
      } finally {
        const observer = new win.IntersectionObserver((entries) => {
          this.#offscreen = !entries.at(-1).isIntersecting;
          this.hiddenChanged(this.outOfSight);
        });
        observer.observe(this.visibilityTarget());
        this.#cleanups.push(() => observer.disconnect());
        this.applyTheme();
      }
    }

    disconnectedCallback() {
      this.#live = false;
      for (const cleanup of this.#cleanups.splice(0)) cleanup();
      this.#offscreen = false;
      this.disconnected();
    }

    attributeChangedCallback(name, before, after) {
      if (!this.#live || before === after) return;
      if (name === 'theme') this.#environmentChanged();
      else this.attributeChanged(name);
    }

    /** addEventListener that is undone when the element leaves the page. */
    listen(target, type, handler) {
      target.addEventListener(type, handler);
      this.#cleanups.push(() => target.removeEventListener(type, handler));
    }

    get themeSetting() {
      const value = this.getAttribute('theme') ?? 'auto';
      if (!THEMES.includes(value)) throw new Error(`<${this.localName}> theme="${value}": use one of ${THEMES.join(', ')}`);
      return value;
    }

    /** What a toy is mounted with: { theme: 'light' | 'dark', reducedMotion }. */
    environment() {
      const setting = this.themeSetting;
      const theme = setting === 'auto' ? (this.#darkQuery.matches ? 'dark' : 'light') : setting;
      return { theme, reducedMotion: this.#motionQuery.matches };
    }

    /** The tab is hidden or the element's visible part is off screen. */
    get outOfSight() {
      return win.document.hidden || this.#offscreen;
    }

    /** Puts the resolved theme on the shadow root's first element, which the styles key on. */
    applyTheme() {
      this.root.firstElementChild.dataset.theme = this.environment().theme;
    }

    #environmentChanged() {
      this.applyTheme();
      this.environmentChanged();
    }

    /** The element whose being on screen decides whether the toy runs; the host by default. */
    visibilityTarget() { return this; }

    attributeChanged() {}
  };
}
