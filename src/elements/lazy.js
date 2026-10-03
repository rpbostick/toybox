// The base of the elements whose code is a chunk of its own (the dice tray, the background, the
// drawing layer, the pages): the class in toybox.js is only this, and connecting the element
// imports its implementation, from next to the script, the first time one is used.
//
// load() resolves to a module whose mount(host, wrapper) returns the implementation:
//   { destroy(), attributeChanged?(name), environmentChanged?(), hiddenChanged?(outOfSight) }
// plus whatever the element's methods call. `ready` settles with it once mounted, or with null
// when the element left the page before its chunk arrived.

export function lazyElementBase(Base, { load, css = '' }) {
  return class LazyToyElement extends Base {
    #impl = null;
    #generation = 0;
    /** Settles with the mounted implementation (null if the element left first). */
    ready = null;

    connected() {
      this.root.innerHTML = '<div class="toybox"><style></style></div>';
      this.root.querySelector('style').textContent = css;
      const wrapper = this.root.firstElementChild;
      const generation = ++this.#generation;
      this.ready = load().then((module) => {
        if (generation !== this.#generation || !this.isConnected) return null;
        this.#impl = module.mount(this, wrapper);
        return this.#impl;
      });
      this.ready.catch((error) => {
        if (generation !== this.#generation) return;
        const message = this.ownerDocument.createElement('p');
        message.className = 'error';
        message.textContent = `<${this.localName}> could not load: ${error.message}`;
        wrapper.append(message);
      });
    }

    disconnected() {
      this.#generation++;
      this.#impl?.destroy();
      this.#impl = null;
      this.ready = Promise.resolve(null);
    }

    attributeChanged(name) { this.#impl?.attributeChanged?.(name); }

    environmentChanged() { this.#impl?.environmentChanged?.(); }

    hiddenChanged(outOfSight) { this.#impl?.hiddenChanged?.(outOfSight); }

    /** The implementation, once loaded; throws when the element is not on the page. */
    async implementation() {
      const impl = await this.ready;
      if (!impl) throw new Error(`<${this.localName}> is not on the page`);
      return impl;
    }
  };
}
