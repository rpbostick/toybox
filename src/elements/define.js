// Defines a list of the library's elements in a window. An entry is { tag, make, load? }: make is
// a class factory taking (Base, catalog, load). The lists are registry.js (every element) and
// toy-elements.js (the drawer and the box only, for dist/toybox.iife.js).
import { CATALOG } from '../catalog.js';
import { toyElementBase } from './base.js';

// Marks a class as this library's, so loading the library twice (say, as a module and as a
// classic script, or both classic scripts) defines each element once instead of failing.
const OURS = Symbol.for('toybox.element');

/**
 * Defines the entries in a window's registry; returns the tags it defined just now. loaders
 * replaces an element's chunk by tag (a test's stand-in for the background's view, say).
 */
export function defineFrom(entries, { win = globalThis, catalog = CATALOG, loaders = {} } = {}) {
  const Base = toyElementBase(win);
  const defined = [];
  for (const unknown of Object.keys(loaders)) {
    if (!entries.some((entry) => entry.tag === unknown && entry.load)) throw new Error(`toybox: no element <${unknown}> loads a chunk`);
  }
  for (const { tag, make, load } of entries) {
    const existing = win.customElements.get(tag);
    if (existing) {
      if (existing[OURS]) continue;
      throw new Error(`toybox: <${tag}> is already defined by other code on this page`);
    }
    const ElementClass = make(Base, catalog, loaders[tag] ?? load);
    ElementClass[OURS] = true;
    win.customElements.define(tag, ElementClass);
    defined.push(tag);
  }
  return defined;
}
