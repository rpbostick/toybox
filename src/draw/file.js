// Save file and Open file: everything the page's Toybox elements keep, in one JSON file with the
// pictures inside it. Each element with something to keep (<toy-pages>, <draw-layer>,
// <dice-tray save-log>) has a toyboxKey and toyboxState()/loadToyboxState(); a file is checked
// whole, against the elements on the page, before any of them changes.
import { checkEntry } from '../dice/log.js';
import { extraFields, openedExtra } from './file-hooks.js';
import { checkLayerState, checkPagesState, fileName, fromFile, toFile } from './savefile.js';

const KEEPERS = 'toy-pages, draw-layer, dice-tray';

const CHECKS = {
  'toy-pages': (state, where) => checkPagesState(state, where),
  'draw-layer': (state, where) => checkLayerState(state, where),
  'dice-tray': (state, where) => {
    if (!state || !Array.isArray(state.log)) throw new Error(`${where} must be { log: [entries] }`);
    state.log.forEach((entry, i) => checkEntry(entry, `${where}.log[${i}]`));
    return state;
  },
};

function keepers(doc) {
  const found = new Map();
  for (const element of doc.querySelectorAll(KEEPERS)) {
    const key = element.toyboxKey;
    if (found.has(key)) throw new Error(`two elements are kept as ${key}; give them different ids`);
    found.set(key, element);
  }
  return found;
}

/** { key: state } for every element with something to keep (a tray without save-log has nothing). */
export async function collect(doc) {
  const elements = {};
  for (const [key, element] of keepers(doc)) {
    const state = await element.toyboxState();
    if (state !== null) elements[key] = state;
  }
  return elements;
}

export async function fileText(doc) {
  return toFile(doc.defaultView.location.pathname, await collect(doc), await extraFields());
}

/**
 * Checks the whole file against the page, then loads each element's part, then hands the page's
 * own fields to its onOpenFile hooks.
 */
export async function applyFile(doc, text) {
  const { page, elements, extra } = fromFile(text);
  const onPage = keepers(doc);
  const missing = Object.keys(elements).filter((key) => !onPage.has(key));
  if (missing.length) throw new Error(`this page has no element for ${missing.join(', ')}`);
  for (const [key, state] of Object.entries(elements)) CHECKS[onPage.get(key).localName](state, key);
  for (const [key, state] of Object.entries(elements)) await onPage.get(key).loadToyboxState(state);
  await openedExtra(extra, page);
  return Object.keys(elements);
}

/** Downloads the file; resolves to its name. */
export async function saveFile(doc) {
  const win = doc.defaultView;
  const text = await fileText(doc);
  const url = win.URL.createObjectURL(new win.Blob([text], { type: 'application/json' }));
  const link = Object.assign(doc.createElement('a'), { href: url, download: fileName(doc.title) });
  link.click();
  win.setTimeout(() => win.URL.revokeObjectURL(url), 10000);
  return link.download;
}

export async function openFile(doc, file) {
  return applyFile(doc, await file.text());
}
