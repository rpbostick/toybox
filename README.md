# Toybox

Sixteen desk toys for any web page — a Newton's cradle, bubble wrap, a lava lamp, a zen sand
garden and more — plus a dice tray, animated backgrounds, a drawing layer and note pages, as
custom elements added with one script tag. No framework on the page.

```html
<script type="module" src="https://example.com/toybox/toybox.js"></script>

<toy-drawer></toy-drawer>
<toy-box toy="newtons-cradle"></toy-box>
<dice-tray id="dice" roll-links></dice-tray>
<toy-background></toy-background>
<draw-layer for="#card"></draw-layer>
<toy-pages></toy-pages>
```

`toybox.js` itself is small (about 33 KB); each element's code loads from a chunk next to it
the first time the page uses that element, and each toy's when it opens. Only the toys you can
see run: they pause while the tab is hidden or they are scrolled off screen, and under
`prefers-reduced-motion` they open paused (a still first frame; Play starts them).
`dist/index.html` (built by `bash build.sh`, see Development) is a demo page with all of
them together and copy-paste snippets.

## Installing

### A script tag

Build `dist/` (`npm ci`, then `bash build.sh`; it is not in git) or unzip a release zip
(below), serve that folder anywhere (your own site, a sub-path, another host) and load one of
its three builds:

```html
<!-- ES module: loads each element's and toy's code only when it is used -->
<script type="module" src="https://example.com/toybox/toybox.js"></script>

<!-- classic script, the toys only: <toy-drawer> and <toy-box> with every toy -->
<script src="https://example.com/toybox/toybox.iife.js"></script>

<!-- classic script, everything: every toy and element in one file -->
<script src="https://example.com/toybox/toybox-all.iife.js"></script>
```

| File | Holds | Minified | Gzipped | Use it when |
|---|---|---:|---:|---|
| `toybox.js` (+ `chunks/`, `toys/`) | every element; each element's and toy's code is a chunk loaded on first use | 32.7 KB to start; 349.3 KB in all | 10.4 KB to start; 134.6 KB in all | the page can load ES modules: it downloads only what it shows |
| `toybox.iife.js` | `<toy-drawer>`, `<toy-box>` and the sixteen toys | 197.2 KB | 65.2 KB | a page without modules that only wants the toys |
| `toybox-all.iife.js` | every element and toy | 340.9 KB | 115.7 KB | a page without modules that wants the dice tray, background, drawing layer or pages |

The 3D dice (`dice-box/`, about 3.2 MB) are never inside these files; they load from next to
the script the first time 3D dice are switched on. `SIZES.md` has the numbers for every chunk,
written by the build.

Loading two of them is safe: each element is defined once, and `window.Toybox` gathers the
functions of both classic scripts (so `toybox.iife.js` and `toybox-all.iife.js` together are
the same as `toybox-all.iife.js`). Everything the script loads —
the chunks, the twisty cube and music box pages, dice-box for the 3D dice, the source zips,
the licence file — is found next to the script, from its own URL, so nothing needs
configuring for a sub-path or another host. `SIZES.md` lists the base script and every chunk.
When the script is on another origin than the page, that server must send
`Access-Control-Allow-Origin` for the ES modules (browsers fetch module scripts with CORS);
the classic script does not need it.

To vendor a copy, download `toybox-<version>.zip` from a release (made by
`scripts/release.sh`, below) and unzip it into your site; it holds `dist/` with the framed
pages already built.

### npm

```sh
npm install @rpbostick/toybox     # not published yet
```

```js
import '@rpbostick/toybox';                                   // defines <toy-drawer> and <toy-box>
import cradle from '@rpbostick/toybox/toys/newtons-cradle';   // one toy, see "The toy interface"
```

| Export | File |
|---|---|
| `@rpbostick/toybox` | `dist/toybox.js`: defines the elements; exports `defineElements`, `setAssetBase`, `assetUrl`, `CATALOG`, `defineToy`, `PALETTES`, `editImage`, `saveFile`, `openFile`, `onSaveFile`, `onOpenFile`, `registerBands`, `registerBackground` |
| `@rpbostick/toybox/toybox.iife.js` | `dist/toybox.iife.js`: the toys' classic script; sets `window.Toybox` (`setAssetBase`, `defineToyElements`, `CATALOG`, `defineToy`) |
| `@rpbostick/toybox/toybox-all.iife.js` | `dist/toybox-all.iife.js`: the whole library as a classic script; sets `window.Toybox` (the module's functions and `defineToyElements`) |
| `@rpbostick/toybox/toys/<id>` | `dist/toys/<id>.js`: one toy's module (default export) |

A bundler that copies the library's code into its own output cannot know where `dist/` ends
up. Serve `dist/` (or at least `dist/twisty/`, `dist/music-box/`, `dist/dice-box/` and
`dist/THIRD_PARTY_LICENSES.txt`) somewhere and tell the library where:

```js
import { setAssetBase } from '@rpbostick/toybox';
setAssetBase('https://example.com/toybox/');
```

Importing the package without a DOM (server-side rendering, a test runner) defines no
elements; the exports still work.

## Elements

### `<toy-drawer>`

A drawer of toy cards. Under the cards, "Credits and licences" lists each toy's source and
licence.

With `panel="inline"` (the default), opening a card shows the toy in a panel under the cards
with Pause, Reset and Close; one toy is open at a time, and opening another closes the first.
Escape closes it too.

With `panel="floating"`, the drawer is a window: it opens at the lower left, is dragged by its
title bar, resized from its corner, minimized to its bar and restored, and closed to a "Toys"
button where the element is. Opening a card opens that toy in a window of its own beside the
drawer (its name, Pause, Reset, minimize, close), each new window 32 px further on so they do
not stack exactly; several toys can be open side by side. A toy has one window at a time:
opening it again brings its window to the front, as does a press in a window. Every window is
kept on screen, and the drawer window and each toy's window (open or not, place, size,
minimized) are remembered per browser and page (under the element's `id`). The windows are
labelled non-modal dialogs: Tab reaches each title bar, the arrow keys move the window whose
title bar has focus (Shift for bigger steps), and Escape closes the window it is pressed in.

A toy in a window runs while its window is on screen and not minimized, and the tab is shown.
At most `max-running` toys run at once across the page's floating drawers (the smallest value
among them applies): those used last. The others pause with a "Paused, click to resume"
overlay; a click there, or anywhere in the window, makes it the one used last.

| Attribute | Values | Default |
|---|---|---|
| `toys` | comma-separated toy ids: which toys, in which order | all, in catalogue order |
| `theme` | `light`, `dark`, `auto` (follows the system) | `auto` |
| `panel` | `inline` (one toy in a panel under the cards), `floating` (the drawer and each toy in windows of their own) | `inline` |
| `max-running` | with `panel="floating"`: how many toys run at once, a whole number from 1 | `4` |

An unknown toy id or attribute value throws an error naming the allowed ones.

```html
<toy-drawer id="toys" toys="bubble-wrap,fidget-spinner,pin-art" panel="floating" theme="dark"></toy-drawer>
<script type="module">
  const drawer = document.querySelector('#toys');
  drawer.open('bubble-wrap');
  drawer.open('fidget-spinner'); // two toys side by side
</script>
```

Script: `drawer.open(id)` (a promise), `drawer.close()` (floating: every toy window;
`drawer.close(id)` one), `drawer.state` (`{ id, running, pausedByUser }` of the open toy, or
floating, of the toy window used last), `drawer.windows` (floating: the open toy windows, used
last first, as `{ id, running, pausedByUser, minimized, capped }`; `capped` means the running
cap paused it), `drawer.windowState` (floating: the drawer window's `{ x, y, w, h, open,
minimized }`), `drawer.toys` (the catalogue entries shown). A `toy-change` event (bubbles,
`detail` is the state) fires whenever a toy opens, closes, pauses or resumes.

### `<toy-box>`

One toy, embedded at the element's size (320 × 360 px unless the page sizes it), with a small
bar holding its name, Pause and Reset. Several boxes can show the same toy.

| Attribute | Values | Default |
|---|---|---|
| `toy` | a toy id (required) | — |
| `theme` | `light`, `dark`, `auto` | `auto` |

```html
<toy-box toy="lava-lamp" theme="dark" style="width: 260px; height: 420px"></toy-box>
```

Script: `box.state`, `box.loaded` (a promise settled when the toy has mounted), and the same
`toy-change` event. Changing `toy` swaps the toy.

### `<dice-tray>`

A floating dice tray: the results log (with times) above the roller, the die buttons d4 to
d100, dN and a modifier below, a notation box, and a settings popup (⚙: 3D dice, quick roll,
colours, pip style, sound, throw strength and size). It opens at the lower right (or left),
is dragged by its title bar, minimized, closed (a small launcher brings it back) and resized
from the handle in its lower-right corner (CSS `resize` too), no smaller than 280 × 420 px;
the log and roller reflow. Its place, size and state are remembered per page, under the
element's `id`; the settings per browser.

Clicking die buttons builds a pool shown above them ("2d6 + 1d8 + 1d20 + 2"); Roll rolls it
together into one log entry listing every die, each die type's sum and the total; Clear
empties it. dN opens a field for a die of 2 to 1000 sides. The notation box takes the same
and more: `2d6+1d8+3`, `4d6kh3` (keep highest), `d7`, `3d13`. The notation, Toybox's own:

| Notation | Means |
|---|---|
| `NdX`, `dX` | N dice (1 if left out) of X sides, X from 2 to 1000 |
| `d%`, `d100` | a percentile die, 1 to 100 (thrown in 3D as a tens and a ones d10) |
| `+`, `-` | join dice and whole numbers: `2d6+1d8+3`, `1d20-1` |
| `kh3` (or `k3`), `kl1` | keep the 3 highest, the 1 lowest: `4d6kh3`, `2d20kl1` |
| `dl1` (or `d1`), `dh1` | drop the 1 lowest, the 1 highest: `4d6dl1` |

Spaces and capitals do not matter; a roll holds at most 100 dice. Anything else (exploding,
rerolls, brackets, multiplication) is refused with a message saying what was not understood.
The 2D roller draws a generic
die with its number for sizes other than d4–d20; the 3D roller (dice-box, loaded from
`dice-box/` the first time 3D is switched on) throws such rolls in 2D.

| Attribute | Values | Default |
|---|---|---|
| `id` | the name its window (and, with `save-log`, its log in a saved file) is kept under | `dice-tray` |
| `side` | `right`, `left`: the lower corner it opens in | `right` |
| `roll-links` | present: clicks on `data-roll` elements roll into it (below) | off |
| `save-log` | present: Save file includes the log | off |
| `theme` | `light`, `dark`, `auto` | `auto` |

```html
<dice-tray id="dice" roll-links></dice-tray>
<button data-roll="2d6+2" data-roll-label="STR" data-roll-bands="wod">STR +2</button>
```

Script: `tray.roll("2d6+2", { label: "STR", bands: "wod" })` logs the roll and resolves to the
result `{ notation, label, total, dice, terms, groups, band, entry }`: `dice` lists every die
(`{ sides, value, face, dropped }`), `terms` each term's signed subtotal (`{ text: '4d6kh3',
sign, subtotal }`), `groups` each die size's kept sum. It rejects, and says why in the log, for
notation it cannot roll. A `roll` event (bubbles; `detail` is the result) fires
for every roll, from the buttons too. `tray.open()`, `tray.close()`, `tray.log()`,
`tray.clearLog()`.

With `roll-links`, a click on any element carrying `data-roll="…"` (and optionally
`data-roll-label`, `data-roll-bands`, `data-roll-tray="#id"`) rolls into the tray it names,
else the tray it is inside, else the first tray on the page with `roll-links`. The element is
the page's own: make it a `<button>` so it can be reached by keyboard.

Result bands read a total in words. `wod` is built in (World of Dungeons, 2d6 + attribute:
6 or less a miss, 7–9 a partial success, 10+ a success, 12+ a critical success); a page adds
its own before or after the tray loads:

```js
import { registerBands } from 'https://example.com/toybox/toybox.js';
registerBands('pbta', (total) => total >= 10 ? { key: 'hit', label: 'Strong hit' }
  : total >= 7 ? { key: 'weak', label: 'Weak hit' } : { key: 'miss', label: 'Miss' });
```

### `<toy-background>`

An animated background fixed behind the page (`position: fixed`, `z-index: -1`, no pointer
events), with its controls where the element sits: a button named after the background
(pressing it shows the next), Background (on/off), "Background reacts to the mouse", Color
mode, and a 72-colour wheel that picks the colour. In color mode the mouse wheel over bare
background steps through the 72 colours; a middle-click on bare background turns color mode on
or off (the box follows), and Esc turns it off. The six backgrounds are Toybox's own, in plain
WebGL or Canvas 2D: Line Waves, Aurora, Soap Film, Plasma, Starfield and Grid Ripples; a page
adds its own with `registerBackground` (below). Each draws in the wheel's colours, pauses while
out of sight, and under reduced motion shows a still frame. The choice, on/off and mouse
setting are remembered per browser; under reduced motion it starts off.

The background reacts only to a drag: hovering does nothing, and bare background shows a grab
cursor. A left-button press (or a touch) on bare background grabs it; while held, the
background follows the pointer wherever it goes, the cursor is `grabbing` everywhere and no
text is selected. Release or the pointer leaving the window lets go: a fling coasts on,
slowing, then the background settles (a cancel by the browser or the window losing focus
settles at once). A press on content never starts a drag (so a touch there still scrolls the page; a
touch drag on bare background does not). With "Background reacts to the mouse" off there is
no grab cursor and no drag. The cursor rules are a `<style data-toybox-background>` the element
adds to the page's `<head>`, on the classes `toybox-background-grab` and
`toybox-background-dragging` of `<html>`.

"Bare background" is anything not marked `data-solid`, not a dialog or form control, and not
a Toybox element: mark the page's content containers with `data-solid` so the background does
not react under them. The element must not be inside a transformed or filtered container
(those make `position: fixed` relative to them).

| Attribute | Values | Default |
|---|---|---|
| `effects` | comma-separated: which backgrounds the button cycles, in order (`lines`, `aurora`, `film`, `plasma`, `stars`, `ripples`, and any registered) | all, registered ones included |
| `controls` | `full`; `compact` (name and on/off); `none` (drive it from script) | `full` |
| `theme` | `light`, `dark`, `auto` | `auto` |
| `ripple` | `on`, `off`: the local stretch and swirl under a drag | `on` |
| `sheet` | `on`, `off`: the field following a drag like a sheet on water and gliding on after release | `on` |
| `spin` | `on`, `off`: the pattern as the inside of a ball that a drag turns and a fling spins | `on` |
| `momentum` | `on`, `off`: the pointer coasting on after a fling | `on` |

**Drag dynamics.** A drag moves the background the way figurewright's hero moves: the
modules of [reactbits-kit](https://github.com/rpbostick/reactbits-kit) v0.3.0 (MIT; our own
code, no React Bits code), at their tuning. The sheet follows 30% of the drag, at most 12% of
the window's shorter side, and glides on 3 to 9 s after release without springing back; the
ripple and swirl are at the hero's doubled strength; the ball turns at 0.1 of the pointer.
Which background uses what:

| Background | Coasting pointer | Ripple field | Sheet | Spin |
|---|---|---|---|---|
| Line Waves (`lines`) | yes | yes | yes | yes |
| Grid Ripples (`ripples`) | yes | yes | yes (shift) | yes |
| Aurora, Soap Film, Plasma (`aurora`, `film`, `plasma`) | yes | — | yes (shift and twist of the pattern) | — |
| Starfield (`stars`) | yes | — | yes (the sky shifts and turns) | — |

Under reduced motion none of them moves: no coast, ripple, glide or spin.

```html
<toy-background effects="lines,aurora,stars" controls="compact"></toy-background>
<main data-solid>…</main>
```

Content inside the element goes in a slot after its controls. Script: `bg.state()` (a promise
of `{ background, on, interactive, colorMode, color, stop }`), `bg.set({ background, on,
interactive, colorMode })`, and a `background-change` event. The background draws on
`--toybox-paper` when the page sets it, so it meets the page's own colour.

#### A page's own backgrounds: `registerBackground`

```js
import { registerBackground } from 'https://example.com/toybox/toybox.js';
// or window.Toybox.registerBackground with toybox-all.iife.js

registerBackground('my-glow', {
  name: 'Glow',                 // what the name button shows
  wash: 0.2,                    // optional: the page colour over it, 0–1, or { light, dark }
  mount(el, api) {              // el: a div filling the layer; api: { colors, theme, reducedMotion, motion }
    const canvas = document.createElement('canvas');
    el.append(canvas);
    // … draw with api.colors …
    return {
      setColors(colors) {},     // the wheel's colours changed: { theme, hex: [3 × '#rrggbb'], rgb: [3 × [r, g, b] 0–1] }
      pointer(point) {},        // { x, y } in client pixels during a drag and its coast; null once when it ends
      pause() {}, resume() {},  // out of sight, or reduced motion (show a still frame)
      destroy() { canvas.remove(); },
    };
  },
});
```

`id` is lower-case letters, digits and dashes; `name` and `mount` are required; `destroy` is
required on the definition or on what `mount` returns, the other methods are optional.
`wash` is how strongly the page colour lies over the background, from 0 (not at all) to 1
(only the page colour), one number for both themes or `{ light: 0.2, dark: 0.3 }` (the
default when it is left out).
`pointer` follows the same drag-only rule as the built-in backgrounds: it hears `{ x, y }` from
a press on bare background until release, wherever the pointer goes, then once a frame while a
fling coasts on (unless `momentum="off"` or reduced motion), then `null` once, and nothing
while the pointer only hovers or "Background reacts to the mouse" is off.

`api.motion` is the drag dynamics the built-in backgrounds read, for a background that wants
them too. Read it once a frame (each call advances it to `at`, `performance.now()` when left
out); lengths are client pixels:

| Member | Gives |
|---|---|
| `pointer(at?)` | the dragged or coasting pointer `{ x, y }`, or `null` |
| `sheet(at?)` | `{ x, y, centerX, centerY, angle, moving, weightAt({ x, y }) }`: the shift at the dragged point, which `weightAt` scales (1 there, less further off), and a twist in radians; all 0 with `sheet="off"` |
| `ripple(grid, at?)` | the ripple field's offsets `{ x, y }` (Float64Arrays) for a grid of columns of `{ x, y, wave: { x, y } }` points, or `null` at rest or with `ripple="off"` |
| `displace(grid, at?)` | the ripple and the sheet together for such a grid, as Line Waves draws them |
| `spin(at?)` | the ball's turn `{ x, y, yaw, pitch, period, moving }`; 0 with `spin="off"` |
| `sample(grid, at?)` | where each grid point reads the pattern on the turning ball `{ x, y }`, or `null` with `spin="off"` |
| `held`, `stroke`, `options`, `reducedMotion` | the held point (no coast), a count of presses, `{ ripple, sheet, spin, momentum }` from the attributes, and reduced motion |

A
background that throws while mounting is logged to the console and the page colour stays. A
`<toy-background>` without `effects` takes a newly registered background into its cycle at
once; to name it in `effects`, set the attribute after registering. Registering through any
copy of Toybox on the page reaches every `<toy-background>`.

**React Bits on your own site.** React Bits' backgrounds can be used this way on a site that
has React: install the component into the site's own source as reactbits.dev describes
(`npx jsrepo add …` or copying the component), render it into `el` in `mount`, and re-render
with `colors.hex` in `setColors`. `examples/react-bits-background/` is a worked example with
Aurora. React Bits is MIT + Commons Clause: fine as part of a website or product, but the
components may not be redistributed as components (alone, in a library, or ported), which is
why Toybox contains none of them and the example installs one into the site instead.

### `<draw-layer>`

A scribble layer over any element: `for` names it. A small Draw button sits in a corner of
the window (while on, the pointer draws instead of reaching the element) and opens the tool
bar: pen, highlighter, eraser, colours, Eyedropper, recent colours, size, Undo, Redo (also
Ctrl+Z, Ctrl+Shift+Z), Clear, and two separate boxes: Show scribbles (on screen) and Print
scribbles (in print). Strokes are kept in units of the element's width, so they scale with it;
they are saved in the browser (IndexedDB) per page under the layer's `id` (or its `for`).

The button's "⋯" menu puts it in any corner of the window; its grip (⠿, on its outer edge)
drags it anywhere, by mouse, pen or touch, always fully on screen and 16 px clear of the
window's edges; Reset position in the same menu puts a dragged button back in its corner. The
tool bar opens toward the middle of the window from wherever the button is. The corner and
the dragged place are remembered per browser and page (`localStorage`), and a corner picked in
the menu wins over `corner`.

| Attribute | Values | Default |
|---|---|---|
| `for` | a selector: the element drawn over | (required) |
| `id` | the name the strokes are kept under | the `for` selector |
| `corner` | `bottom-left`, `bottom-right`, `top-left`, `top-right`: where the Draw button sits | `bottom-left` |
| `toggles-scope` | `layer`: Show and Print scribbles remembered per layer; `browser`: one choice for every layer on every page | `layer` |
| `theme` | `light`, `dark`, `auto` | `auto` |

**Eyedropper and recent colours** (in `<draw-layer>`, `<toy-pages>` and the image editor
alike). The Eyedropper button picks a colour and makes it the pen's (the highlighter's while
the highlighter is in hand); the tool in hand stays the same. Where the browser has the
EyeDropper API (Chrome, Edge and other Chromium browsers) its own picker opens and can pick
from anywhere on screen, and its Esc cancels. Elsewhere (Firefox, Safari) the cursor becomes a
crosshair over the drawing, the next click picks there instead of drawing, and Esc cancels.
That pick is worked out from Toybox's own data and the page under it, top down until opaque:
the strokes (the exact pen colour; a highlighter at its opacity over what is under it), the
pictures on a drawing page or in the image editor (their pixel), then the element under the
layer: an `<img>` or `<canvas>` gives its pixel, any other element its background colour,
and a page with no background colour at all reads as white. It cannot pick text or border
colours, CSS background images or gradients, `<video>`, SVG content of the page, an `<img>`
from another origin served without CORS (its background colour is used instead), or a WebGL
canvas made without `preserveDrawingBuffer`; nor anything outside the drawing.
Beside the colours is a row of the last 8 colours drawn with or picked, newest first, shared
by every tool bar and remembered per browser (`localStorage`, `toybox.draw.recent-colors`);
each is a button, so Tab and Enter or Space reach and use it.

```html
<draw-layer id="card-ink" for="#card"></draw-layer>
<div id="card">…</div>
```

The layer is an overlay added inside the target (a static target is given
`position: relative` while the layer is there). Script: `layer.strokes()`, `layer.clear()`,
`layer.setDraw(on)`, and an `ink-change` event.

### `<toy-pages>`

Extra pages after the page's own content: Add notes page (ruled, with a title), Add drawing
page (pens; pictures pasted with Ctrl+V, dropped, or added from a file, moved and scaled with
the Move picture tool; Copy as PNG), Move up, Move down, Remove. Pages are saved in the
browser (IndexedDB) per page and print one per sheet, after everything before them (put the
element at the end of the page). Its bar also has Save file, Open file and Print.

| Attribute | Values | Default |
|---|---|---|
| `id` | the name the pages are kept under | `pages` |
| `size` | `letter`, `a4`: the pages' shape | `letter` |
| `buttons` | `all`; `none` hides Save file, Open file and Print, for a page with its own | `all` |
| `theme` | `light`, `dark`, `auto` | `auto` |

Script: `pages.addPage('notes' | 'drawing')` (resolves to the new page's id),
`pages.removePage(id)`, `pages.movePage(id, ±1)`, `pages.pages()`, and a `pages-change` event.

### Saving to a file, and the image editor

```js
import { saveFile, openFile, editImage } from 'https://example.com/toybox/toybox.js';
await saveFile();                     // downloads <page title>.json
await openFile(input.files[0]);       // loads it back into the page's elements
const result = await editImage(document.querySelector('#portrait'), { notch: 8 });
```

`saveFile()` writes one JSON file (`"format": "toybox-file"`) holding every `<toy-pages>`'s
pages (pictures inside, as data URLs), every `<draw-layer>`'s strokes, and the log of every
`<dice-tray save-log>`, each under its `id`. `openFile()` checks the whole file against the
page first and changes nothing if any part has no element here or does not check out.
`<toy-pages>`' Save file and Open file buttons call the same.

A page can keep its own fields in the same file (a character sheet's entries, say):

```js
import { onSaveFile, onOpenFile } from 'https://example.com/toybox/toybox.js';
// or window.Toybox.onSaveFile / onOpenFile with toybox-all.iife.js
onSaveFile(() => ({ character: readSheet() }));          // may also return a promise
onOpenFile((extra, { page }) => fillSheet(extra.character));
```

What every `onSaveFile` hook returns goes into the file's `"extra"` object (two hooks saving
the same field, or a hook returning something other than an object, fail the save). After a
file has loaded into the elements, each `onOpenFile` hook gets that object (`{}` for a file
without one) and the page the file was saved from. Both return a function that removes the
hook.

`editImage(element, { notch, state, theme })` opens a full-window editor whose frame has the
element's shape (with `notch`-pixel notched corners if asked): paste, drop or add pictures,
move and scale them under the frame, draw over them; Done renders the frame into the element
(an `<img>`'s `src`, or any other element's background image) and resolves to
`{ src, images, strokes }`; Cancel resolves to `null`. Reopening the same element keeps its
pictures and strokes; pass `state` (an earlier result) to reopen it after a reload.

### Styling

Every element draws in a shadow root. Size them with CSS on the element; restyle the parts
with `::part()`: `<toy-drawer>` has `drawer`, `cards`, `card`, `panel`, `panel-bar`,
`credits`, and when floating `window` (the drawer's window), `window-bar` (any window's title
bar), `toy-window`, `resize-handle`, `launcher`; `<toy-box>` has `box`, `bar`; `<dice-tray>` has `tray`, `bar`, `log`, `stage`,
`pool`, `buttons`, `resize-handle`, `launcher`, `settings`; `<toy-background>` has `layer`,
`controls`; `<draw-layer>` has `dock` (the Draw button and what it opens), `toolbar`; `<toy-pages>` has `bar`, `pages`, `toolbar`.

```css
toy-drawer::part(panel) { border-radius: 0; }
```

To match the page's own look, set any of these custom properties on the page (or on one
element); they win over the built-in light and dark palettes:

```css
:root {
  --toybox-paper: #fdf8ee;  /* backgrounds, and what <toy-background> draws on */
  --toybox-ink: #222;       /* text and pen */
  --toybox-soft: #888;      /* borders, hints */
  --toybox-faint: #e8e0d0;  /* rules, quiet fills */
  --toybox-accent: #b5523b; /* pressed buttons, highlights */
  --toybox-card: #fffaf0;   /* panels and the tray */
  --toybox-font: Georgia, serif;
}
```

### Toy ids

| Id | Toy | Licence |
|---|---|---|
| `oil-and-water` | Oil and water (WebGL fluid) | MIT |
| `ripple-tank` | Ripple tank (WebGL) | MIT |
| `kaleidoscope` | Kaleidoscope | MIT |
| `newtons-cradle` | Newton's cradle | MIT |
| `drip-timer` | Drip timer | MIT |
| `stacking-blocks` | Stacking blocks | MIT |
| `pendulums` | Pendulums | Unlicense AND MIT |
| `string` | String and cloth | MIT |
| `spirograph` | Spirograph | MIT |
| `twisty-cube` | Twisty cube (own page) | MPL-2.0 OR GPL-3.0-or-later |
| `music-box` | Music box (own page) | GPL-3.0 |
| `lava-lamp` | Lava lamp | MIT |
| `pin-art` | Pin art | MIT |
| `bubble-wrap` | Bubble wrap | MIT |
| `fidget-spinner` | Fidget spinner | MIT |
| `zen-garden` | Zen sand garden | MIT |

The twisty cube and the music box run on their own pages (`dist/twisty/`,
`dist/music-box/`) in an `<iframe>`, so their copyleft code never mixes with the page's; the
element talks to them only by `postMessage`, and links their source zips under the frame.

## The toy interface

Every toy module default-exports the same object, made by `defineToy` in `src/runtime.js`:

```js
{
  id, name, licence,
  mount(element, { theme: 'light' | 'dark', reducedMotion }),  // draws into element
  pause(), resume(), reset(), destroy(),
  running, mounted,
  create(),          // another, unmounted instance of the same toy
}
```

One object mounts in one place at a time; the elements call `create()` for each toy they
show. To use a toy without the elements:

```js
import cradle from '@rpbostick/toybox/toys/newtons-cradle';
const toy = cradle.create();
toy.mount(document.querySelector('#somewhere'), { theme: 'light', reducedMotion: false });
// … later
toy.destroy();
```

The element needs a size, and the toys expect the elements' stylesheet for their canvas and
control bar (`.toy-canvas`, `.toy-controls`; see `src/elements/styles.js`).

### Adding a toy

1. Write `src/toys/<id>.js`:

   ```js
   import { toyMeta } from '../catalog.js';
   import { defineToy } from '../runtime.js';

   export default defineToy(toyMeta('my-toy'), (ctx) => {
     const surface = ctx.canvas();            // fills the element, follows its size
     ctx.drag(surface.canvas, { down({ x, y }) { /* … */ } });
     ctx.controls([{ label: 'Shake', onClick: () => { /* … */ } }]);
     ctx.onFrame((dt) => { /* step by dt seconds, then draw with surface.g */ });
     return { reset() { /* … */ } };
   });
   ```

   Everything the toy starts goes through `ctx` (`listen`, `timeout`, `add`, `canvas`,
   `audio`, `onFrame`), so `destroy()` releases it all. Colours come from `ctx.palette`
   (light or dark).
2. Add its entry to `CATALOG` in `src/catalog.js` (`id`, `name`, `licence`, `credit`,
   `source` when adapted, `load`), and a 48 × 48 line drawing to `src/previews.js`.
3. Code adapted from another project: its licence text goes in `src/licences/` and an entry in
   `ADAPTED` in `scripts/licences.mjs`; an npm package it bundles is picked up by the build.
4. `node --test` checks the new toy releases everything it starts; `bash build.sh` builds
   `dist/toys/<id>.js`.

### Adding an element

An element is a class factory in `src/elements/` taking the shared base
(`src/elements/base.js`: shadow root, theme, reduced motion, visibility) and one line in
`ELEMENTS` in `src/elements/registry.js`. An element with much code keeps it in a chunk: its
class extends `lazyElementBase` (`src/elements/lazy.js`) and its registry line names a
`load: () => import('…')` whose module exports `mount(host, wrapper)`.

## Licences

- Toybox's own code — the elements, runtime, build, and the five toys written here (lava
  lamp, pin art, bubble wrap, fidget spinner, zen sand garden) — is MIT (`LICENSE`).
- Toys adapted from other projects keep their licences (MIT and the Unlicense); matter.js is
  MIT.
- The dice notation is Toybox's own; dice-box (MIT) draws the 3D dice, and its files in
  `dist/dice-box/` carry parts of Babylon.js (Apache-2.0) and ammo.js, a port of Bullet (both
  Zlib).
- The six backgrounds are Toybox's own (MIT); the shader ones use David Hoskins' "Hash without
  Sine" (MIT), credited in `src/background/effects/shader.js` and the licence file. Their drag
  dynamics are the modules of reactbits-kit (MIT, our own code), bundled into the background
  chunk. No React Bits code is in the library (see `registerBackground` for using React Bits on
  your own site).
- The drawing elements use perfect-freehand (MIT) and idb-keyval (Apache-2.0).
- The twisty cube page bundles cubing.js (MPL-2.0 or GPL-3.0-or-later) and three.js (MIT);
  the music box page is ToneMatrix Redux (GPL-3.0) with Tone.js and clipboard.js (MIT). Each
  page carries its licences and a `source.zip` with the corresponding source.
- `dist/THIRD_PARTY_LICENSES.txt` has every licence text, generated from what the build
  actually bundled; `dist/twisty/LICENSES.txt` and `dist/music-box/LICENSES.txt` cover each
  page.

Keep those files with the library when you copy it.

## Updating

From npm: `npm install @rpbostick/toybox@latest`. A vendored copy: replace the folder with
the new release zip's contents. `CHANGELOG.md` lists what changed; versions follow semantic
versioning.

Making a release: bump `version` in `package.json`, add its section to `CHANGELOG.md`, then

```sh
npm ci
bash scripts/release.sh      # builds, then writes release/toybox-<version>.zip
```

## Development

```sh
npm ci
bash build.sh                # dist/, the framed pages and their source zips, SIZES.md
node --test                  # unit tests; the Firefox run below is one of them when Firefox is installed
node e2e/serve.mjs           # serves dist/ at http://127.0.0.1:8797/toys/v1/index.html
node e2e/drive.mjs http://127.0.0.1:8797/toys/v1/index.html out/ [--dark] [--reduced-motion]
```

`build.sh` fetches ToneMatrix Redux and cubing.js into the git-ignored `vendor/` and copies
dice-box's files from `node_modules`. `dist/` is a build product and not in git: the same
commit and lock file build the same files (esbuild and the reactbits-kit commit are pinned).
The tests that read `dist/` skip, saying so, until it is built. Development notes on each toy
and element are in `NOTES.md`; sizes in `SIZES.md`.

### What `bash build.sh` writes

Into `dist/`, from a clean checkout after `npm ci`:

- `toybox.js`, `toybox.iife.js`, `toybox-all.iife.js`
- `toys/<id>.js` for every toy, and `chunks/`
- `index.html` (the demo page, from `src/demo/index.html`)
- `THIRD_PARTY_LICENSES.txt`, `LICENSE`, `bundled-packages.json`
- `dice-box/` (the 3D dice)
- `twisty/index.html`, `twisty/app/`, `twisty/LICENSES.txt`, `twisty/SOURCE.md`, `twisty/source.zip`
- `music-box/index.html`, `music-box/app/`, `music-box/LICENSES.txt`, `music-box/SOURCE.md`, `music-box/source.zip`

`TOYBOX_FRESH_BUILD=1 node --test tests/fresh-build.test.js` clones the working tree into a
temporary folder, runs `npm ci` and `bash build.sh` there, and checks it writes each of these
(it fetches from npm and GitHub, so the plain `node --test` skips it).
