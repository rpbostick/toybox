// Where <draw-layer> and <toy-pages> keep what was drawn and written: IndexedDB through
// idb-keyval, one entry per element and page (pageKey), in the "toybox" database. Unlike a
// display preference, a failure here is the user's work not being kept, so it is never hidden.
import { createStore, del, get, set } from 'idb-keyval';

let store = null;

/** idb-keyval's own get/set/del, or the stand-in a test puts in with useStore(). */
function backing() {
  store ??= (() => {
    const idb = createStore('toybox', 'saved');
    return { get: (key) => get(key, idb), set: (key, value) => set(key, value, idb), del: (key) => del(key, idb) };
  })();
  return store;
}

/** Replaces IndexedDB with another { get, set, del } (an in-memory map in the tests). */
export function useStore(replacement) {
  for (const name of ['get', 'set', 'del']) if (typeof replacement?.[name] !== 'function') throw new TypeError(`a store needs ${name}(key…)`);
  store = replacement;
}

export const load = (key) => backing().get(key);
export const save = (key, value) => backing().set(key, value);
export const forget = (key) => backing().del(key);

/** An in-memory store, for tests and for pages that do not want anything kept. */
export function memoryStore() {
  const items = new Map();
  return {
    items,
    get: async (key) => structuredClone(items.get(key)),
    set: async (key, value) => { items.set(key, structuredClone(value)); },
    del: async (key) => { items.delete(key); },
  };
}

/**
 * Saves `collect()` under `key` SAVE_DELAY_MS after the last change, so a burst of strokes is
 * one write. onState(text) hears "Saving…", "Saved in this browser." or the error.
 */
const SAVE_DELAY_MS = 400;
export function autosave(win, key, collect, onState) {
  let timer = null;
  let pending = Promise.resolve();
  const run = () => {
    timer = null;
    pending = save(key, collect()).then(
      () => onState('Saved in this browser.'),
      (error) => { onState(`Not saved: ${error.message}`); throw error; },
    );
    return pending;
  };
  return {
    changed() {
      win.clearTimeout(timer);
      onState('Saving…');
      timer = win.setTimeout(run, SAVE_DELAY_MS);
    },
    /** Writes now if a save is waiting; resolves when the last write is done. */
    flush() {
      if (timer !== null) {
        win.clearTimeout(timer);
        return run();
      }
      return pending;
    },
    cancel() { win.clearTimeout(timer); timer = null; },
  };
}
