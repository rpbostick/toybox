# Changelog

Versions follow [semantic versioning](https://semver.org/): a change to an element's
attributes, the toy interface or the files in `dist/` that breaks a page using them is a new
major version (a new minor version while the version starts with 0).

## 0.5.0 (2026-10-03)

The backgrounds coast, ripple, glide and spin under a drag; `dist/` is a build product.

- `<toy-background>`: a fling coasts on after release, slowing, before the background settles.
  A drag stretches and swirls Line Waves and Grid Ripples under the pointer, pulls the field
  like a sheet on water that glides on 3 to 9 s after release without springing back, and
  turns the pattern as the inside of a ball that a fling spins; Aurora, Soap Film, Plasma and
  Starfield take the coasting pointer and the sheet's shift and twist. The dynamics are
  reactbits-kit v0.3.0's modules (MIT), bundled into the background chunk, at the figurewright
  hero's tuning. `ripple="off"`, `sheet="off"`, `spin="off"` and `momentum="off"` turn each
  off; under reduced motion none of them moves.
- `registerBackground`: `pointer(point)` also hears the coasting pointer once a frame after a
  fling, before the `null`; `mount(el, api)` gets `api.motion`, the drag dynamics' state
  (pointer, sheet, ripple field, spin), documented in the README.
- `dist/` is no longer in git: run `npm ci` and `bash build.sh` (the README lists what it
  writes), or use the release zip; `npm pack` builds it first. esbuild is pinned to 0.28.2 so a build repeats; the tests
  that read `dist/` skip, saying so, until it is built.
- The all-in-one classic script's size budget is 120 KB gzipped (it is 112.5 KB with the drag
  dynamics).

## 0.4.1 (2026-10-02)

The Draw button goes in any corner or anywhere it is dragged; options for pages that bring
their own save, open and print.

- `<draw-layer>`: the tool bar no longer sits where the element is. A small Draw button is
  fixed in a corner of the window (`corner="bottom-left|bottom-right|top-left|top-right"`,
  lower left by default) and opens the tool bar, Show scribbles and Print scribbles toward the
  middle of the window while drawing. Its "⋯" menu picks the corner; its grip drags it anywhere
  (mouse, pen or touch), kept fully on screen and 16 px from the edges; Reset position puts it
  back in its corner. The corner and place are remembered per browser and page. The element
  gains a `dock` part.
- `<draw-layer toggles-scope="browser">` keeps one Show scribbles and one Print scribbles
  choice for every layer on every page; `layer` (the default) keeps them per layer as before.
- `onSaveFile(fn)` and `onOpenFile(fn)` (also on `window.Toybox`): a page's own fields go into
  a saved file's `"extra"` object and come back to it when the file is opened.
- `<toy-pages buttons="none">` hides its Save file, Open file and Print buttons.
- `registerBackground(id, { wash })`: how strongly the page colour lies over a page's own
  background, 0–1 or `{ light, dark }`; left out, it is as before.

## 0.4.0 (2026-10-02)

The backgrounds react to a drag only; the drawing tools have an eyedropper.

- `<toy-background>`: hovering no longer moves the background. A left-button press (or a
  touch) on bare background grabs it; while held it follows the pointer anywhere, with a
  `grabbing` cursor everywhere and no text selection; release, cancel or leaving the window lets
  it settle. Bare background shows a `grab` cursor while "Background reacts to the mouse" is
  on. Breaking for a page's own background (`registerBackground`): `pointer(point)` now hears
  only such drags, with `null` once at the end. A touch drag on bare background no longer
  scrolls the page.
- `<draw-layer>`, `<toy-pages>` and the image editor: an Eyedropper beside the colours. With
  the EyeDropper API (Chromium) the browser's picker samples anything on screen; in Firefox
  and Safari the next click samples the strokes, pictures and the element under the drawing
  (see the README for what can be sampled). Esc cancels.
- A row of the last 8 colours drawn with or picked, newest first, remembered per browser.

## 0.3.0 (2026-10-02)

A lighter library: the backgrounds and the dice notation are Toybox's own.

- `<toy-background>`: six backgrounds written for Toybox in plain WebGL and Canvas 2D (Line
  Waves, Aurora, Soap Film, Plasma, Starfield, Grid Ripples) replace the ten React Bits
  components; React and ogl are gone. Breaking: the `effects` ids are now `lines`, `aurora`,
  `film`, `plasma`, `stars`, `ripples` (a remembered choice of an old id falls back to the
  first). The controls, color mode, wheel and `data-solid` rules are unchanged.
- `registerBackground(id, { name, mount, setColors, pointer, pause, resume, destroy })` adds a
  page's own background, from the module or `window.Toybox`; `examples/react-bits-background/`
  shows a site adding a React Bits background this way.
- Dice notation is parsed and rolled by Toybox's own `src/dice/notation.js` (`NdX`, `d%`, pools,
  keep/drop, constants); rpg-dice-roller and mathjs are gone, and with them the tray's
  separate notation chunk. Roll results gain `terms`, each term's signed subtotal; a roll holds
  at most 100 dice.
- Two classic scripts: `toybox.iife.js` now holds the toys only (`<toy-drawer>`, `<toy-box>`,
  185 KB); `toybox-all.iife.js` holds every element (292 KB, down from 1.3 MB). Breaking for a
  page that used the dice tray, background, drawing layer or pages from `toybox.iife.js`: load
  `toybox-all.iife.js` instead (or as well).
- Fixed: a saved drawing layer or pages entry that fails its check now shows "could not be
  read; autosave is off" and keeps autosave off, instead of failing silently.

## 0.2.0 (2026-10-02)

Four new elements, each loaded from its own chunk the first time a page uses it.

- `<dice-tray>`: a floating dice tray (draggable, minimizable, closable, resizable from a
  corner handle down to 280 × 420, remembered per page by `id`). Die buttons build a pool
  ("2d6 + 1d8 + 1d20 + 2") rolled as one log entry with each die type summed; dN adds a die of
  2 to 1000 sides; the notation box takes `2d6+1d8+3`, `4d6kh3`, `3d13`. 2D dice by default,
  3D (dice-box) loaded on the first switch, falling back to 2D for dice it has no model for.
  `tray.roll(notation, { label, bands })`, a `roll` event, band sets (`wod` built in,
  `registerBands`), and `data-roll` links for trays with `roll-links`.
- `<toy-background>`: ten animated React Bits backgrounds fixed behind the page, with their
  controls (`controls="full|compact|none"`, `effects="…"`): the name button, on/off,
  "Background reacts to the mouse", Color mode (also middle-click on bare background) and a
  72-colour wheel. Content marked `data-solid` is not background.
- `<draw-layer for="#selector">`: a scribble layer over any element, with pen, highlighter,
  eraser, colours, sizes, undo, redo and clear; Show scribbles (screen) and Print scribbles
  (print) are separate; saved in the browser per page.
- `<toy-pages>`: notes and drawing pages (pictures pasted, dropped or added; copy out as PNG),
  reordered and removed, saved in the browser and printed one per sheet.
- `saveFile()` and `openFile(file)`: one JSON file of every element's pages, scribbles and,
  with `save-log`, the tray's log. `editImage(element)`: an image editor for any image box.
- Every element takes its colours from `--toybox-paper`, `--toybox-ink`, `--toybox-soft`,
  `--toybox-faint`, `--toybox-accent`, `--toybox-card` and `--toybox-font` when the page sets
  them. The 3D dice need `dist/dice-box/` (built by `build.sh`, in the release zip).
- The classic script `toybox.iife.js` now holds every element too (1.3 MB; see `SIZES.md`).

## 0.1.0 (2026-10-02)

First release as a library.

- `<toy-drawer>` (attributes `toys`, `theme`, `panel`) and `<toy-box>` (attributes `toy`,
  `theme`), from `dist/toybox.js` (ES module) or `dist/toybox.iife.js` (classic script).
- Sixteen toys; each also importable alone as `@rpbostick/toybox/toys/<id>`.
- Toys follow `prefers-reduced-motion` and pause while the tab is hidden or they are off
  screen.
- Files the toys load (the twisty cube and music box pages, their source zips, the licence
  file) resolve relative to the script, so the library works from any host or sub-path.
- A toy object's `create()` gives another instance, so a page can show the same toy in
  several places.
- Toybox's own code, including the five toys written here, is MIT.
