# Toy sizes

Written by `scripts/measure-sizes.mjs` (run by `build.sh`). KB = 1024 bytes; gzip is level 9.

## Each toy's own code

Each toy module bundled alone and minified with esbuild, leaving out what toys share: the
toy runtime and catalog, and matter.js for the physics toys. For the two framed toys this is
only the small module that frames the page; the page itself is measured below.

| Toy | Minified | Gzipped | Also needs |
|---|---:|---:|---|
| Oil and water | 24.9 KB | 6.7 KB | — |
| Ripple tank | 8.2 KB | 3.1 KB | — |
| Kaleidoscope | 3.1 KB | 1.5 KB | — |
| Newton's cradle | 3.1 KB | 1.5 KB | + matter.js |
| Drip timer | 3.5 KB | 1.7 KB | + matter.js |
| Stacking blocks | 3.1 KB | 1.6 KB | + matter.js |
| Pendulums | 6.1 KB | 2.9 KB | — |
| String and cloth | 5.7 KB | 2.5 KB | — |
| Spirograph | 2.9 KB | 1.4 KB | — |
| Twisty cube | 1.4 KB | 0.8 KB | + own page (twisty) |
| Music box | 1.3 KB | 0.8 KB | + own page (music-box) |
| Lava lamp | 3.4 KB | 1.7 KB | — |
| Pin art | 3.1 KB | 1.6 KB | — |
| Bubble wrap | 2.6 KB | 1.4 KB | — |
| Fidget spinner | 3.1 KB | 1.4 KB | — |
| Zen sand garden | 3.2 KB | 1.6 KB | — |

## Shared pieces

| Piece | Minified | Gzipped |
|---|---:|---:|
| matter.js 0.20.0 (Newton's cradle, Drip timer, Stacking blocks) | 83.8 KB | 26.9 KB |
| Toy runtime (`src/runtime.js`) | 4.7 KB | 2.1 KB |
| The elements' classes and card drawings (`src/toybox.js` without the toys, the elements' chunks, catalogue loader and runtime) | 40.5 KB | 13.4 KB |

## The library as built

| Build | Files | On disk | Gzipped |
|---|---:|---:|---:|
| ES modules: `dist/toybox.js`, `dist/toys/`, `dist/chunks/` (a page loads the entry and only the toys and elements it uses) | 74 | 349.3 KB | 134.6 KB |
| Classic script: `dist/toybox.iife.js` (the toys, `<toy-drawer>` and `<toy-box>`, in one file) | 1 | 197.2 KB | 65.2 KB |
| Classic script: `dist/toybox-all.iife.js` (every toy and element in one file) | 1 | 340.9 KB | 115.7 KB |
| dice-box for the 3D dice, `dist/dice-box/` (loaded when 3D is switched on; copied by `build.sh` from the npm package) | 13 | 3258.9 KB | 972.9 KB |

## The base script and its chunks

What a page using `dist/toybox.js` downloads: the script itself, then each chunk the first time
something needs it (the dice tray's chunk when a `<dice-tray>` connects, the background's chunk
when a `<toy-background>` connects, and so on). Each
`dist/toys/<id>.js` entry (not listed) is a few hundred bytes that import the toy's chunk.

| File | Minified | Gzipped | Holds | Imported by |
|---|---:|---:|---|---|
| `toybox.js` | 32.7 KB | 10.4 KB | `src/toybox.js`: drawer.js, elements/, page-api.js, previews.js, toybox.js | the page |
| `chunks/chunk-PDEAU5CD.js` | 85.2 KB | 27.5 KB | matter-js, toys/ | chunks/chunk-64CIRSZI.js, chunks/chunk-GANQSWJV.js, chunks/chunk-KLMKOO5R.js and 6 more |
| `chunks/background-S6EHDIYT.js` | 51.7 KB | 19.4 KB | `src/background/background.js`: @rpbostick/reactbits-kit, background/, background/effects/ | toybox.js |
| `chunks/chunk-3QUE5FBM.js` | 24.9 KB | 6.7 KB | toys/ | chunks/oil-and-water-6OO3BH44.js, toys/oil-and-water.js |
| `chunks/tray-PXCFORLL.js` | 21.4 KB | 8.4 KB | `src/dice/tray.js`: dice/ | toybox.js |
| `chunks/chunk-KZ4PSQ55.js` | 18.5 KB | 7.4 KB | draw/, perfect-freehand | chunks/chunk-DG3WYSYG.js, chunks/image-editor-CL4AQ6N4.js, chunks/layer-AQ6P3QBQ.js and 1 more |
| `chunks/pages-UBPTNSNO.js` | 10.0 KB | 4.2 KB | `src/draw/pages.js`: draw/ | toybox.js |
| `chunks/chunk-VLVJMUNF.js` | 8.2 KB | 3.1 KB | toys/ | chunks/ripple-tank-3R27W7U2.js, toys/ripple-tank.js |
| `chunks/layer-AQ6P3QBQ.js` | 7.6 KB | 3.3 KB | `src/draw/layer.js`: draw/ | toybox.js |
| `chunks/chunk-4RRQYAXX.js` | 6.1 KB | 2.7 KB | dice/ | chunks/chunk-M67JAIKU.js, chunks/file-TSHGLGDJ.js, chunks/pages-UBPTNSNO.js and 1 more |
| `chunks/chunk-B2H3XYVZ.js` | 6.0 KB | 2.8 KB | toys/ | chunks/pendulums-VMOAZRKF.js, toys/pendulums.js |
| `chunks/image-editor-CL4AQ6N4.js` | 5.5 KB | 2.6 KB | `src/draw/image-editor.js`: draw/ | toybox.js |
| `chunks/chunk-6SXSQMXM.js` | 5.4 KB | 2.4 KB | toys/ | chunks/string-K6TZITAK.js, toys/string.js |
| `chunks/chunk-I3M5WXFC.js` | 4.7 KB | 2.1 KB | runtime.js | chunks/background-S6EHDIYT.js, chunks/bubble-wrap-5UI5FWJ7.js, chunks/chunk-2HAHNKBT.js and 52 more |
| `chunks/chunk-2MSCG6NQ.js` | 4.1 KB | 2.0 KB | dice/, elements/ | chunks/tray-PXCFORLL.js, toybox.js |
| `chunks/chunk-DG3WYSYG.js` | 3.9 KB | 1.8 KB | draw/ | chunks/image-editor-CL4AQ6N4.js, chunks/pages-UBPTNSNO.js |
| `chunks/chunk-ISKHTSV2.js` | 3.4 KB | 1.2 KB | catalog.js | chunks/bubble-wrap-5UI5FWJ7.js, chunks/chunk-2HAHNKBT.js, chunks/chunk-3K7NK4ZP.js and 46 more |
| `chunks/chunk-JLIJZRM2.js` | 3.3 KB | 1.7 KB | toys/ | chunks/lava-lamp-NKOWV3OA.js, toys/lava-lamp.js |
| `chunks/chunk-N26AOHMI.js` | 3.1 KB | 1.5 KB | toys/ | chunks/kaleidoscope-7G7CI5QT.js, toys/kaleidoscope.js |
| `chunks/chunk-2HAHNKBT.js` | 3.1 KB | 1.6 KB | toys/ | chunks/zen-garden-6C6WAHTR.js, toys/zen-garden.js |
| `chunks/chunk-5RRYKUS4.js` | 3.0 KB | 1.6 KB | toys/ | chunks/pin-art-V7MJF2BQ.js, toys/pin-art.js |
| `chunks/chunk-3K7NK4ZP.js` | 3.0 KB | 1.4 KB | toys/ | chunks/fidget-spinner-WCAM4JKD.js, toys/fidget-spinner.js |
| `chunks/chunk-OYAUKGGD.js` | 2.9 KB | 1.2 KB | draw/ | chunks/chunk-M67JAIKU.js, chunks/file-TSHGLGDJ.js, chunks/image-editor-CL4AQ6N4.js and 2 more |
| `chunks/chunk-P3O4WOSU.js` | 2.9 KB | 1.4 KB | toys/ | chunks/spirograph-YJHJV4IA.js, toys/spirograph.js |
| `chunks/chunk-KLMKOO5R.js` | 2.8 KB | 1.4 KB | toys/ | chunks/drip-timer-KAWN4IZY.js, toys/drip-timer.js |
| `chunks/chunk-TRYF5R3P.js` | 2.7 KB | 1.2 KB | background/ | chunks/background-S6EHDIYT.js, toybox.js |
| `chunks/chunk-TDE3UTQM.js` | 2.6 KB | 1.3 KB | toys/ | chunks/bubble-wrap-5UI5FWJ7.js, toys/bubble-wrap.js |
| `chunks/chunk-3CDEPU2A.js` | 1.7 KB | 0.8 KB | elements/ | chunks/background-S6EHDIYT.js, chunks/chunk-KZ4PSQ55.js, chunks/image-editor-CL4AQ6N4.js and 4 more |
| `chunks/chunk-64CIRSZI.js` | 1.6 KB | 0.9 KB | toys/ | chunks/stacking-blocks-RGJC7MCA.js, toys/stacking-blocks.js |
| `chunks/chunk-GANQSWJV.js` | 1.6 KB | 0.9 KB | toys/ | chunks/newtons-cradle-VVRIGPW2.js, toys/newtons-cradle.js |
| `chunks/chunk-M67JAIKU.js` | 1.4 KB | 0.8 KB | draw/ | chunks/file-TSHGLGDJ.js, chunks/pages-UBPTNSNO.js |
| `chunks/chunk-IS57XJVY.js` | 1.2 KB | 0.6 KB | draw/ | chunks/layer-AQ6P3QBQ.js, toybox.js |
| `chunks/chunk-MTZBQDF3.js` | 1.1 KB | 0.6 KB | draw/, idb-keyval | chunks/layer-AQ6P3QBQ.js, chunks/pages-UBPTNSNO.js |
| `chunks/chunk-XWRXV264.js` | 0.7 KB | 0.4 KB | draw/ | chunks/chunk-M67JAIKU.js, chunks/file-TSHGLGDJ.js, chunks/pages-UBPTNSNO.js and 1 more |
| `chunks/chunk-2VKSGUMZ.js` | 0.7 KB | 0.5 KB | toys/ | chunks/chunk-GCJJ56R4.js, chunks/chunk-QGE247I7.js, chunks/music-box-VUUFJFDG.js and 3 more |
| `chunks/chunk-DCANE7XH.js` | 0.6 KB | 0.4 KB | esbuild's module helpers | chunks/background-S6EHDIYT.js, chunks/bubble-wrap-5UI5FWJ7.js, chunks/chunk-2MSCG6NQ.js and 41 more |
| `chunks/chunk-WNI6WUEP.js` | 0.5 KB | 0.3 KB | elements/ | chunks/chunk-2MSCG6NQ.js, chunks/layer-AQ6P3QBQ.js, chunks/tray-PXCFORLL.js and 1 more |
| `chunks/chunk-QGE247I7.js` | 0.4 KB | 0.3 KB | toys/ | chunks/twisty-cube-ZKNPVB2B.js, toys/twisty-cube.js |
| `chunks/chunk-IL75OGFX.js` | 0.4 KB | 0.3 KB | assets.js | chunks/chunk-2VKSGUMZ.js, chunks/music-box-VUUFJFDG.js, chunks/tray-PXCFORLL.js and 18 more |
| `chunks/chunk-GCJJ56R4.js` | 0.4 KB | 0.3 KB | toys/ | chunks/music-box-VUUFJFDG.js, toys/music-box.js |
| `chunks/chunk-MO6FVN6X.js` | 0.3 KB | 0.2 KB | toys/ | chunks/bubble-wrap-5UI5FWJ7.js, chunks/chunk-2HAHNKBT.js, chunks/chunk-3K7NK4ZP.js and 30 more |
| `chunks/file-TSHGLGDJ.js` | 0.2 KB | 0.2 KB | `src/draw/file.js`: esbuild's module helpers | toybox.js |
| `chunks/lava-lamp-NKOWV3OA.js` | 0.2 KB | 0.2 KB | `src/toys/lava-lamp.js`: esbuild's module helpers | chunks/chunk-ISKHTSV2.js |
| `chunks/newtons-cradle-VVRIGPW2.js` | 0.2 KB | 0.1 KB | `src/toys/newtons-cradle.js`: esbuild's module helpers | chunks/chunk-ISKHTSV2.js |
| `chunks/drip-timer-KAWN4IZY.js` | 0.2 KB | 0.1 KB | `src/toys/drip-timer.js`: esbuild's module helpers | chunks/chunk-ISKHTSV2.js |
| `chunks/zen-garden-6C6WAHTR.js` | 0.2 KB | 0.1 KB | `src/toys/zen-garden.js`: esbuild's module helpers | chunks/chunk-ISKHTSV2.js |
| `chunks/bubble-wrap-5UI5FWJ7.js` | 0.2 KB | 0.1 KB | `src/toys/bubble-wrap.js`: esbuild's module helpers | chunks/chunk-ISKHTSV2.js |
| `chunks/pendulums-VMOAZRKF.js` | 0.2 KB | 0.1 KB | `src/toys/pendulums.js`: esbuild's module helpers | chunks/chunk-ISKHTSV2.js |
| `chunks/fidget-spinner-WCAM4JKD.js` | 0.2 KB | 0.1 KB | `src/toys/fidget-spinner.js`: esbuild's module helpers | chunks/chunk-ISKHTSV2.js |
| `chunks/twisty-cube-ZKNPVB2B.js` | 0.2 KB | 0.1 KB | `src/toys/twisty-cube.js`: esbuild's module helpers | chunks/chunk-ISKHTSV2.js |
| `chunks/music-box-VUUFJFDG.js` | 0.2 KB | 0.1 KB | `src/toys/music-box.js`: esbuild's module helpers | chunks/chunk-ISKHTSV2.js |
| `chunks/stacking-blocks-RGJC7MCA.js` | 0.2 KB | 0.1 KB | `src/toys/stacking-blocks.js`: esbuild's module helpers | chunks/chunk-ISKHTSV2.js |
| `chunks/pin-art-V7MJF2BQ.js` | 0.2 KB | 0.1 KB | `src/toys/pin-art.js`: esbuild's module helpers | chunks/chunk-ISKHTSV2.js |
| `chunks/spirograph-YJHJV4IA.js` | 0.2 KB | 0.1 KB | `src/toys/spirograph.js`: esbuild's module helpers | chunks/chunk-ISKHTSV2.js |
| `chunks/string-K6TZITAK.js` | 0.2 KB | 0.1 KB | `src/toys/string.js`: esbuild's module helpers | chunks/chunk-ISKHTSV2.js |
| `chunks/oil-and-water-6OO3BH44.js` | 0.1 KB | 0.1 KB | `src/toys/oil-and-water.js`: esbuild's module helpers | chunks/chunk-ISKHTSV2.js |
| `chunks/ripple-tank-3R27W7U2.js` | 0.1 KB | 0.1 KB | `src/toys/ripple-tank.js`: esbuild's module helpers | chunks/chunk-ISKHTSV2.js |
| `chunks/kaleidoscope-7G7CI5QT.js` | 0.1 KB | 0.1 KB | `src/toys/kaleidoscope.js`: esbuild's module helpers | chunks/chunk-ISKHTSV2.js |

## Framed pages

| Page | Files | On disk | Gzipped | Of which |
|---|---:|---:|---:|---|
| Twisty cube, `dist/twisty/` (without source.zip) | 14 | 1029.4 KB | 251.1 KB | `app/`: 971.4 KB, 11 files |
| Twisty cube source, `dist/twisty/source.zip` | 1 | 7138.7 KB | — | |
| Music box, `dist/music-box/` (without source.zip) | 9 | 490.0 KB | 118.5 KB | `app/`: 402.0 KB, 4 files |
| Music box source, `dist/music-box/source.zip` | 1 | 308.2 KB | — | |

Nothing under `dist/` is in git: `build.sh` writes all of it (the framed pages from pinned
upstream sources, each with its source zip), and the release zip (`scripts/release.sh`)
holds it.
