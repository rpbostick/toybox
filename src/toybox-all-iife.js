// The whole library as one classic script, built to dist/toybox-all.iife.js:
//   <script src="…/toybox-all.iife.js"></script>
// Same elements as dist/toybox.js; the toys and every element's code are inside this one file
// (dice-box for the 3D dice still loads from dice-box/ next to it). The asset base is this
// script's own URL, read while it runs (document.currentScript is null afterwards).
import { setAssetBase } from './assets.js';
import { registerBackground } from './background/backgrounds.js';
import { CATALOG } from './catalog.js';
import { defineElements } from './elements/registry.js';
import { defineToyElements } from './elements/toy-elements.js';
import { editImage, onOpenFile, onSaveFile, openFile, registerBands, saveFile } from './page-api.js';
import { defineToy } from './runtime.js';

const script = document.currentScript;
if (!script?.src) throw new Error('toybox-all.iife.js: load it with <script src="…/toybox-all.iife.js">, not as a module or inline');
setAssetBase(new URL('./', script.src));
defineElements();

// Added to, not replaced, so loading toybox.iife.js as well keeps the functions this brings.
window.Toybox = Object.assign(window.Toybox ?? {}, {
  setAssetBase, defineElements, defineToyElements, CATALOG, defineToy, editImage, saveFile, openFile, onSaveFile, onOpenFile, registerBands,
  registerBackground,
});
