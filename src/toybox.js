// The library as an ES module, built to dist/toybox.js:
//   <script type="module" src="…/toybox.js"></script>
// defines <toy-drawer>, <toy-box>, <dice-tray>, <toy-background>, <draw-layer> and <toy-pages>.
// Each element's code, the toys and the files they load (the framed pages, dice-box, source
// zips, licences) are found next to this script, wherever it is served from, and load on first
// use.
import { setAssetBase } from './assets.js';
import { defineElements } from './elements/registry.js';

setAssetBase(new URL('./', import.meta.url));
// Deliberate: importing without a DOM (server-side rendering, a test runner) defines nothing
// instead of failing, so the exports stay usable there.
if (globalThis.customElements) defineElements();

export { setAssetBase, assetUrl } from './assets.js';
export { defineElements, ELEMENTS } from './elements/registry.js';
export { CATALOG } from './catalog.js';
export { defineToy, PALETTES } from './runtime.js';
export { editImage, onOpenFile, onSaveFile, openFile, registerBands, saveFile } from './page-api.js';
export { registerBackground } from './background/backgrounds.js';
