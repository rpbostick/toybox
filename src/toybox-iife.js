// The toys as a classic script, built to dist/toybox.iife.js:
//   <script src="…/toybox.iife.js"></script>
// defines <toy-drawer> and <toy-box> with every toy inside this one file; the other elements are
// in dist/toybox-all.iife.js (both can be loaded on one page). The asset base is this script's
// own URL, read while it runs (document.currentScript is null afterwards).
import { setAssetBase } from './assets.js';
import { CATALOG } from './catalog.js';
import { defineToyElements } from './elements/toy-elements.js';
import { defineToy } from './runtime.js';

const script = document.currentScript;
if (!script?.src) throw new Error('toybox.iife.js: load it with <script src="…/toybox.iife.js">, not as a module or inline');
setAssetBase(new URL('./', script.src));
defineToyElements();

// Added to, not replaced, so loading toybox-all.iife.js as well keeps the functions it brings.
window.Toybox = Object.assign(window.Toybox ?? {}, { setAssetBase, defineToyElements, CATALOG, defineToy });
