// A page's own fields in a saved file: onSaveFile(fn) adds what fn() returns to the file's
// "extra" object, and onOpenFile(fn) hands that object back once the file has loaded. Kept apart
// from file.js so a page can add its hooks before that chunk loads.

// Kept on the global object, so every copy of the library on a page (the module and a classic
// script) shares one set: a hook added through any of them runs for Save file and Open file
// called through any other.
const shared = (globalThis[Symbol.for('toybox.file-hooks')] ??= { save: new Set(), open: new Set() });

function add(set, name, fn) {
  if (typeof fn !== 'function') throw new TypeError(`${name}(fn): fn must be a function`);
  set.add(fn);
  return () => { set.delete(fn); };
}

/** fn() returns (or resolves to) an object of fields to save; returns the unsubscribe. */
export const onSaveFile = (fn) => add(shared.save, 'onSaveFile', fn);

/** fn(extra, { page }) runs after a file has loaded into the page's elements; returns the unsubscribe. */
export const onOpenFile = (fn) => add(shared.open, 'onOpenFile', fn);

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

/** Every save hook's fields in one object; two hooks giving the same field fail loud. */
export async function extraFields() {
  const extra = {};
  for (const fn of shared.save) {
    const fields = await fn();
    if (!isPlainObject(fields)) throw new Error(`an onSaveFile hook returned ${JSON.stringify(fields)}, not an object of fields`);
    for (const [key, value] of Object.entries(fields)) {
      if (Object.hasOwn(extra, key)) throw new Error(`two onSaveFile hooks both save the field "${key}"`);
      extra[key] = value;
    }
  }
  return extra;
}

export async function openedExtra(extra, page) {
  for (const fn of shared.open) await fn(extra, { page });
}
