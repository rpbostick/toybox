// A happy-dom window with the library's elements defined, for the element tests: a stub
// IntersectionObserver the test can drive, and the window closed after the test file.
import { after } from 'node:test';
import { Window } from 'happy-dom';
import { setAssetBase } from '../src/assets.js';
import { CATALOG } from '../src/catalog.js';
import { defineElements } from '../src/elements/registry.js';

setAssetBase('https://cdn.example/toybox/');

const windows = [];
after(() => Promise.all(windows.map((win) => win.happyDOM.close())));

export function makeWindow({ url = 'https://host.example/page/', colorScheme = 'light', reducedMotion = 'no-preference', width = 1400, height = 1000, loaders = {} } = {}) {
  const win = new Window({ url, width, height, settings: { device: { prefersColorScheme: colorScheme, prefersReducedMotion: reducedMotion } } });
  windows.push(win);
  win.IntersectionObserver = class {
    constructor(callback) { this.callback = callback; }
    observe() {}
    disconnect() {}
  };
  defineElements({ win, catalog: CATALOG, loaders });
  return { win, doc: win.document };
}

export function add(doc, html, parent = doc.body) {
  const holder = doc.createElement('div');
  holder.innerHTML = html;
  const element = holder.firstElementChild;
  parent.append(element);
  return element;
}
