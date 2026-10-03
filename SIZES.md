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
| The elements' classes and card drawings (`src/toybox.js` without the toys, the elements' chunks, catalogue loader and runtime) | 28.7 KB | 9.3 KB |

## The library as built

| Build | Files | On disk | Gzipped |
|---|---:|---:|---:|
| ES modules: `dist/toybox.js`, `dist/toys/`, `dist/chunks/` (a page loads the entry and only the toys and elements it uses) | 75 | 339.5 KB | 131.1 KB |
| Classic script: `dist/toybox.iife.js` (the toys, `<toy-drawer>` and `<toy-box>`, in one file) | 1 | 185.4 KB | 61.3 KB |
| Classic script: `dist/toybox-all.iife.js` (every toy and element in one file) | 1 | 331.1 KB | 112.5 KB |
| dice-box for the 3D dice, `dist/dice-box/` (loaded when 3D is switched on; copied by `build.sh` from the npm package) | 13 | 3258.9 KB | 972.9 KB |

## The base script and its chunks

What a page using `dist/toybox.js` downloads: the script itself, then each chunk the first time
something needs it (the dice tray's chunk when a `<dice-tray>` connects, the background's chunk
when a `<toy-background>` connects, and so on). Each
`dist/toys/<id>.js` entry (not listed) is a few hundred bytes that import the toy's chunk.

| File | Minified | Gzipped | Holds | Imported by |
|---|---:|---:|---|---|
| `toybox.js` | 24.6 KB | 7.9 KB | `src/toybox.js`: drawer.js, elements/, page-api.js, previews.js, toybox.js | the page |
| `chunks/chunk-7F7RRFMY.js` | 85.2 KB | 27.5 KB | matter-js, toys/ | chunks/chunk-3JQUIABP.js, chunks/chunk-BYWSBF62.js, chunks/chunk-ZXRRQLZV.js and 6 more |
| `chunks/background-XJLZPDZL.js` | 51.7 KB | 19.4 KB | `src/background/background.js`: @rpbostick/reactbits-kit, background/, background/effects/ | toybox.js |
| `chunks/chunk-QRK2X4FV.js` | 24.9 KB | 6.7 KB | toys/ | chunks/oil-and-water-NMOQXJRE.js, toys/oil-and-water.js |
| `chunks/tray-JN4KAFUQ.js` | 22.8 KB | 8.8 KB | `src/dice/tray.js`: dice/ | toybox.js |
| `chunks/chunk-I6C6VYEJ.js` | 18.5 KB | 7.4 KB | draw/, perfect-freehand | chunks/chunk-74E4O3GB.js, chunks/image-editor-KQOO3JIV.js, chunks/layer-ZYNYMGYX.js and 1 more |
| `chunks/pages-LIXK3D26.js` | 10.1 KB | 4.2 KB | `src/draw/pages.js`: draw/ | toybox.js |
| `chunks/chunk-MIYNQWRM.js` | 8.2 KB | 3.1 KB | toys/ | chunks/ripple-tank-MLXELJDY.js, toys/ripple-tank.js |
| `chunks/layer-ZYNYMGYX.js` | 7.7 KB | 3.3 KB | `src/draw/layer.js`: draw/ | toybox.js |
| `chunks/chunk-4RRQYAXX.js` | 6.1 KB | 2.7 KB | dice/ | chunks/chunk-M67JAIKU.js, chunks/file-T5RNLEI3.js, chunks/pages-LIXK3D26.js and 1 more |
| `chunks/chunk-BNOKFNNM.js` | 6.0 KB | 2.8 KB | toys/ | chunks/pendulums-UPJNNXBE.js, toys/pendulums.js |
| `chunks/image-editor-KQOO3JIV.js` | 5.6 KB | 2.6 KB | `src/draw/image-editor.js`: draw/ | toybox.js |
| `chunks/chunk-XQ5XP7XP.js` | 5.4 KB | 2.4 KB | toys/ | chunks/string-43JVKBXP.js, toys/string.js |
| `chunks/chunk-I3M5WXFC.js` | 4.7 KB | 2.1 KB | runtime.js | chunks/background-XJLZPDZL.js, chunks/bubble-wrap-5ZZ2VEQA.js, chunks/chunk-34S2X4FG.js and 52 more |
| `chunks/chunk-74E4O3GB.js` | 3.9 KB | 1.8 KB | draw/ | chunks/image-editor-KQOO3JIV.js, chunks/pages-LIXK3D26.js |
| `chunks/chunk-CLVE5TZJ.js` | 3.4 KB | 1.2 KB | catalog.js | chunks/bubble-wrap-5ZZ2VEQA.js, chunks/chunk-34S2X4FG.js, chunks/chunk-3JQUIABP.js and 46 more |
| `chunks/chunk-ZYJBBWK7.js` | 3.3 KB | 1.7 KB | toys/ | chunks/lava-lamp-MYWQXFHL.js, toys/lava-lamp.js |
| `chunks/chunk-UGE5VPWN.js` | 3.1 KB | 1.5 KB | toys/ | chunks/kaleidoscope-UKHV7DD6.js, toys/kaleidoscope.js |
| `chunks/chunk-EZWXYRJD.js` | 3.1 KB | 1.6 KB | toys/ | chunks/zen-garden-TMN3PYVS.js, toys/zen-garden.js |
| `chunks/chunk-EENZ2UG5.js` | 3.0 KB | 1.6 KB | toys/ | chunks/pin-art-35PABGNP.js, toys/pin-art.js |
| `chunks/chunk-TVW5KMIJ.js` | 3.0 KB | 1.4 KB | toys/ | chunks/fidget-spinner-CMNZ5S6D.js, toys/fidget-spinner.js |
| `chunks/chunk-OYAUKGGD.js` | 2.9 KB | 1.2 KB | draw/ | chunks/chunk-M67JAIKU.js, chunks/file-T5RNLEI3.js, chunks/image-editor-KQOO3JIV.js and 2 more |
| `chunks/chunk-34S2X4FG.js` | 2.9 KB | 1.4 KB | toys/ | chunks/spirograph-XDSJ64R7.js, toys/spirograph.js |
| `chunks/chunk-ZXRRQLZV.js` | 2.8 KB | 1.4 KB | toys/ | chunks/drip-timer-6FPLWX7N.js, toys/drip-timer.js |
| `chunks/chunk-TRYF5R3P.js` | 2.7 KB | 1.2 KB | background/ | chunks/background-XJLZPDZL.js, toybox.js |
| `chunks/chunk-FNODLTWC.js` | 2.6 KB | 1.3 KB | toys/ | chunks/bubble-wrap-5ZZ2VEQA.js, toys/bubble-wrap.js |
| `chunks/chunk-3JQUIABP.js` | 1.6 KB | 0.9 KB | toys/ | chunks/stacking-blocks-APNC6KPR.js, toys/stacking-blocks.js |
| `chunks/chunk-BYWSBF62.js` | 1.6 KB | 0.9 KB | toys/ | chunks/newtons-cradle-JWE27OI2.js, toys/newtons-cradle.js |
| `chunks/chunk-M67JAIKU.js` | 1.4 KB | 0.8 KB | draw/ | chunks/file-T5RNLEI3.js, chunks/pages-LIXK3D26.js |
| `chunks/chunk-PU46EIHF.js` | 1.2 KB | 0.6 KB | elements/ | chunks/background-XJLZPDZL.js, chunks/image-editor-KQOO3JIV.js, chunks/layer-ZYNYMGYX.js and 3 more |
| `chunks/chunk-IS57XJVY.js` | 1.2 KB | 0.6 KB | draw/ | chunks/layer-ZYNYMGYX.js, toybox.js |
| `chunks/chunk-EMRGDJE7.js` | 1.1 KB | 0.6 KB | draw/, idb-keyval | chunks/layer-ZYNYMGYX.js, chunks/pages-LIXK3D26.js |
| `chunks/chunk-L5VCWBLG.js` | 1.0 KB | 0.5 KB | dice/ | chunks/tray-JN4KAFUQ.js, toybox.js |
| `chunks/chunk-XWRXV264.js` | 0.7 KB | 0.4 KB | draw/ | chunks/chunk-M67JAIKU.js, chunks/file-T5RNLEI3.js, chunks/pages-LIXK3D26.js and 1 more |
| `chunks/chunk-2VKSGUMZ.js` | 0.7 KB | 0.5 KB | toys/ | chunks/chunk-4U572K4N.js, chunks/chunk-WTBDNIJJ.js, chunks/music-box-CIZYABNS.js and 3 more |
| `chunks/chunk-6DHFEWGX.js` | 0.6 KB | 0.4 KB | esbuild's module helpers | chunks/background-XJLZPDZL.js, chunks/bubble-wrap-5ZZ2VEQA.js, chunks/chunk-3JQUIABP.js and 40 more |
| `chunks/chunk-WNI6WUEP.js` | 0.5 KB | 0.3 KB | elements/ | chunks/layer-ZYNYMGYX.js, chunks/tray-JN4KAFUQ.js |
| `chunks/chunk-4U572K4N.js` | 0.4 KB | 0.3 KB | toys/ | chunks/twisty-cube-Z5NIBNFZ.js, toys/twisty-cube.js |
| `chunks/chunk-XTBY6X2W.js` | 0.4 KB | 0.3 KB | elements/ | chunks/background-XJLZPDZL.js, chunks/chunk-I6C6VYEJ.js, chunks/image-editor-KQOO3JIV.js and 3 more |
| `chunks/chunk-IL75OGFX.js` | 0.4 KB | 0.3 KB | assets.js | chunks/chunk-2VKSGUMZ.js, chunks/music-box-CIZYABNS.js, chunks/tray-JN4KAFUQ.js and 18 more |
| `chunks/chunk-WTBDNIJJ.js` | 0.4 KB | 0.3 KB | toys/ | chunks/music-box-CIZYABNS.js, toys/music-box.js |
| `chunks/chunk-MO6FVN6X.js` | 0.3 KB | 0.2 KB | toys/ | chunks/bubble-wrap-5ZZ2VEQA.js, chunks/chunk-34S2X4FG.js, chunks/chunk-3JQUIABP.js and 30 more |
| `chunks/file-T5RNLEI3.js` | 0.2 KB | 0.2 KB | `src/draw/file.js`: esbuild's module helpers | toybox.js |
| `chunks/lava-lamp-MYWQXFHL.js` | 0.2 KB | 0.2 KB | `src/toys/lava-lamp.js`: esbuild's module helpers | chunks/chunk-CLVE5TZJ.js |
| `chunks/newtons-cradle-JWE27OI2.js` | 0.2 KB | 0.1 KB | `src/toys/newtons-cradle.js`: esbuild's module helpers | chunks/chunk-CLVE5TZJ.js |
| `chunks/drip-timer-6FPLWX7N.js` | 0.2 KB | 0.1 KB | `src/toys/drip-timer.js`: esbuild's module helpers | chunks/chunk-CLVE5TZJ.js |
| `chunks/zen-garden-TMN3PYVS.js` | 0.2 KB | 0.1 KB | `src/toys/zen-garden.js`: esbuild's module helpers | chunks/chunk-CLVE5TZJ.js |
| `chunks/bubble-wrap-5ZZ2VEQA.js` | 0.2 KB | 0.1 KB | `src/toys/bubble-wrap.js`: esbuild's module helpers | chunks/chunk-CLVE5TZJ.js |
| `chunks/pendulums-UPJNNXBE.js` | 0.2 KB | 0.1 KB | `src/toys/pendulums.js`: esbuild's module helpers | chunks/chunk-CLVE5TZJ.js |
| `chunks/fidget-spinner-CMNZ5S6D.js` | 0.2 KB | 0.1 KB | `src/toys/fidget-spinner.js`: esbuild's module helpers | chunks/chunk-CLVE5TZJ.js |
| `chunks/twisty-cube-Z5NIBNFZ.js` | 0.2 KB | 0.1 KB | `src/toys/twisty-cube.js`: esbuild's module helpers | chunks/chunk-CLVE5TZJ.js |
| `chunks/music-box-CIZYABNS.js` | 0.2 KB | 0.1 KB | `src/toys/music-box.js`: esbuild's module helpers | chunks/chunk-CLVE5TZJ.js |
| `chunks/stacking-blocks-APNC6KPR.js` | 0.2 KB | 0.1 KB | `src/toys/stacking-blocks.js`: esbuild's module helpers | chunks/chunk-CLVE5TZJ.js |
| `chunks/pin-art-35PABGNP.js` | 0.2 KB | 0.1 KB | `src/toys/pin-art.js`: esbuild's module helpers | chunks/chunk-CLVE5TZJ.js |
| `chunks/spirograph-XDSJ64R7.js` | 0.2 KB | 0.1 KB | `src/toys/spirograph.js`: esbuild's module helpers | chunks/chunk-CLVE5TZJ.js |
| `chunks/string-43JVKBXP.js` | 0.2 KB | 0.1 KB | `src/toys/string.js`: esbuild's module helpers | chunks/chunk-CLVE5TZJ.js |
| `chunks/oil-and-water-NMOQXJRE.js` | 0.1 KB | 0.1 KB | `src/toys/oil-and-water.js`: esbuild's module helpers | chunks/chunk-CLVE5TZJ.js |
| `chunks/ripple-tank-MLXELJDY.js` | 0.1 KB | 0.1 KB | `src/toys/ripple-tank.js`: esbuild's module helpers | chunks/chunk-CLVE5TZJ.js |
| `chunks/kaleidoscope-UKHV7DD6.js` | 0.1 KB | 0.1 KB | `src/toys/kaleidoscope.js`: esbuild's module helpers | chunks/chunk-CLVE5TZJ.js |

## Framed pages

| Page | Files | On disk | Gzipped | Of which |
|---|---:|---:|---:|---|
| Twisty cube, `dist/twisty/` (without source.zip) | 14 | 1020.2 KB | 247.5 KB | `app/`: 966.9 KB, 11 files |
| Twisty cube source, `dist/twisty/source.zip` | 1 | 7132.3 KB | — | |
| Music box, `dist/music-box/` (without source.zip) | 9 | 490.0 KB | 118.5 KB | `app/`: 402.0 KB, 4 files |
| Music box source, `dist/music-box/source.zip` | 1 | 308.2 KB | — | |

Nothing under `dist/` is in git: `build.sh` writes all of it (the framed pages from pinned
upstream sources, each with its source zip), and the release zip (`scripts/release.sh`)
holds it.
