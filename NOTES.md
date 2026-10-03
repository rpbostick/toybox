# Toybox: development notes

How the library is built and what each toy does and does not do yet. Using it is in
`README.md`. Open the demo page `dist/index.html` from a web server (module scripts do not
load from `file://` in Firefox): `node e2e/serve.mjs` serves `dist/` under a sub-path at
`http://127.0.0.1:8797/toys/v1/index.html`.

## How it is built

- **One interface.** Every toy module default-exports
  `{ id, name, licence, mount(el, { theme, reducedMotion }), pause(), resume(), reset(), destroy(), create() }`,
  made by `defineToy` in `src/runtime.js`; `create()` gives another, unmounted instance, and
  the elements mount one per place they show a toy. A toy only writes a setup function; the runtime
  owns the animation frame, and every listener, timer, resize observer, audio context and
  DOM node goes through it, so `destroy()` can release all of them. `tests/toys.test.js`
  checks that for every toy in a fake DOM (`tests/fake-dom.js`): after mount, frames,
  pointer input, pause, resume, reset and destroy, no frame, listener, timer, observer, audio
  context or element is left. Breaking the runtime on purpose (not removing listeners, not
  cancelling the frame on pause) makes those tests fail.
- **The elements.** `src/toybox.js` (built to `dist/toybox.js`), `src/toybox-iife.js`
  (`dist/toybox.iife.js`) and `src/toybox-all-iife.js` (`dist/toybox-all.iife.js`) set the
  asset base from their own URL (`src/assets.js`) and define the elements listed in
  `src/elements/registry.js` (the toys-only classic script: `src/elements/toy-elements.js`, so
  its bundle holds none of the other elements' chunks). `src/elements/base.js` is the shared
  base: an open shadow root, the `theme` attribute, `prefers-reduced-motion`, and being out
  of sight (tab hidden, or an IntersectionObserver on the element or, for the drawer, its
  panel). `tests/elements.test.js` runs them in happy-dom with DOM-only test toys (happy-dom
  has no canvas).
- **The drawer** (`src/drawer.js`, used by both `<toy-drawer>` and `<toy-box>`) opens one
  toy at a time: opening another destroys the open one first, and an open that loses a race
  with another open or a close mounts nothing. It pauses the toy while it is out of sight
  and resumes it after, unless the user had paused it; a toy that loads while out of sight
  starts paused. Under `prefers-reduced-motion` toys open paused (a still first frame; Play
  starts them). A theme change (attribute, or the system's under `theme="auto"`) re-mounts
  the open toy in the new theme, which resets it.
- **The panel** of `panel="floating"` is 440 × 520 px at the lower left, leaving the toy
  about 440 px wide and 400 to 440 px tall depending on its control bar; the title bar drags
  it and the corner handle resizes it up to 96 % of the window's width and 94 % of its
  height. `panel="inline"` is full width and 520 px tall, resizable in height. Canvases refit
  to their box (checked in Firefox).
- **Asset base.** The framed pages, their source zips and the licence file are resolved with
  `assetUrl()` against the directory of the script that loaded (`import.meta.url` for the
  modules, `document.currentScript` for the classic script); each `dist/toys/<id>.js` sets
  it too, from its parent directory. `tests/subpath.test.js` imports the built modules over
  HTTP from a server under a sub-path (through Node module hooks, `tests/http-hooks.mjs`) and
  loads the classic script in happy-dom from another origin.
- **Framed toys.** The twisty cube (cubing.js, MPL-2.0 or GPL-3.0-or-later) and the music
  box (ToneMatrix Redux, GPL-3.0) run on their own pages, `dist/twisty/` and
  `dist/music-box/`, in an `<iframe>`. The drawer and those pages share no code or objects;
  they talk only by `postMessage` (`{ toy, type }`: the page sends `ready` to its parent on
  any origin, the drawer sends `pause`, `resume`, `reset`, `scramble` to the frame's origin,
  which is the script's and may differ from the embedding page's; commands wait for `ready`;
  messages from any other window are ignored). The twisty page takes the theme as
  `?theme=`. `tests/licences.test.js` checks the library's built files contain no GPL or MPL
  package and no cubing.js, three.js or ToneMatrix code, and that both modules import only
  our framing code.
- **Libraries.** matter.js 0.20.0 (MIT) for the cradle, the drip timer and the blocks;
  cubing.js on its own page. Build tools: esbuild (MIT), and sass (MIT, Dart Sass) only to
  compile ToneMatrix Redux's `style.scss`, which is what its own gulp build uses.
  Matter.Mouse and Matter.Render are not used: Mouse binds listeners it cannot remove and
  Render draws a debug look, so `matter-hand.js` grabs bodies with pointer events and a
  constraint, and `matter-ink.js` draws them in ink.
- **Build.** `bash build.sh` (after `npm ci`) bundles everything, fetches ToneMatrix Redux
  at a pinned commit and cubing.js at the tag of its npm version into the git-ignored
  `vendor/` (cubing.js as a bare clone, so `node --test` does not collect its test scripts),
  zips each framed page's corresponding source next to it, writes
  `dist/THIRD_PARTY_LICENSES.txt` from the bundles' esbuild metafiles plus `src/licences/`,
  and writes `SIZES.md`. Running it twice writes the same files. esbuild is pinned to an exact
  version and reactbits-kit to a commit in the lock file, so the same commit builds the same
  chunk names anywhere.
  `bash scripts/release.sh` builds and zips `dist/` into `release/toybox-<version>.zip`.
- **Not in git: `dist/`.** All of it is the build's output (the demo page is copied from
  `src/demo/index.html`, the framed pages from `src/twisty/` and `src/music-box/`), so a
  checkout runs `npm ci` and `bash build.sh` before opening the demo page. The tests that read
  `dist/` skip, saying so, until it is built (`tests/dist-built.js`).
  `TOYBOX_FRESH_BUILD=1 node --test tests/fresh-build.test.js` builds a fresh clone in a
  temporary folder and checks it writes the files the README lists, and the same chunk names
  twice.
- **Browser run.** `node e2e/drive.mjs <url> <dir> [--dark] [--reduced-motion]` opens the
  demo page in headless Firefox and every toy in its drawer, plays with each through real
  pointer input (mouse, and touch for several toys), screenshots it, and checks Pause,
  Close, panel resize, reduced motion, the embeds pausing off screen, dragging the floating
  window and a clean console. `tests/e2e.test.js` runs it (light) from a sub-path when
  Firefox is installed and the framed pages are built.

- **The elements with chunks.** `<dice-tray>`, `<toy-background>`, `<draw-layer>` and
  `<toy-pages>` are small classes in `toybox.js` (`src/elements/`, on `lazy.js`); connecting
  one imports its implementation (`src/dice/tray.js`, `src/background/background.js`,
  `src/draw/layer.js`, `src/draw/pages.js`), which esbuild splits into `dist/chunks/` and the
  browser resolves relative to the importing file, so they load from wherever `toybox.js` is
  served. `defineElements({ loaders })` replaces a chunk in the tests (the background's view,
  which needs WebGL). `editImage`, `saveFile` and `openFile` (`src/page-api.js`) load
  their chunks the same way. `tests/subpath.test.js` imports every chunk over HTTP from under
  a sub-path.
- **Dice.** `src/dice/notation.js` parses notation into a plan of dice terms (any 2 to 1000
  sides, one keep or drop each) and constants, rolls a plan from a `[0, 1)` source (2D), and
  totals the faces a roller reports, so the 2D roller and the 3D one (dice-box) add up the same
  way; a d100 is thrown in 3D as a tens and a ones d10. The syntax supported is the part of
  rpg-dice-roller's the tray needs; the parser is ours, about 4 KB minified, in the tray's chunk (the
  earlier rpg-dice-roller with mathjs was 698 KB). Its tests roll with a seeded source
  (mulberry32) to check keep/drop and that each face of a d7 comes up about 1/7 of the time.
  dice-box finds its container with `document.querySelector`,
  so the 3D stage is a light-DOM child of the element shown through a slot. The World of
  Dungeons sheet links and sheet position of the character-sheet version are not in the
  library: a page does the same with `data-roll` and its own layout.
- **Background.** Six backgrounds written here (`src/background/effects/`): four fragment
  shaders in plain WebGL 1 (`shader.js`: one full-screen triangle, drawn at half resolution for
  the soft ones) and two in Canvas 2D. `view.js` mounts the chosen one into the element's
  shadow root and tells it the colours (from `looks.js`, three per background), the pointer
  (only during a drag that started on bare background, wherever it then goes, then the
  coasting pointer once a frame after a fling, and `null` once when it ends; `input.js`
  through the `pointerFeed` in `view.js`), pause and resume (out of sight, reduced motion),
  and destroy. The drag dynamics are `motion.js`, one per view, on reactbits-kit's modules
  (`momentum`, `pointerFeed`, `rippleField`, `clothFollow`, `sphereSpin`; imported from
  `@rpbostick/reactbits-kit/modules/*` and bundled into the background chunk): every
  background reads them as `api.motion` once a frame, and each built-in lists the ones it
  uses in its `dynamics` (`tests/background-dynamics.test.js` checks a frame reads exactly
  those). Grid Ripples, a shader, uploads the ripple field's offsets as a small byte texture
  each frame it moves; the other shaders shift and twist their sampling coordinates with the
  sheet (`sheetFrag()` in `shader.js`). A page's own backgrounds come through `registerBackground`
  (`backgrounds.js`), whose list lives on the global object so every copy of the library on a
  page shares it. A background that throws while mounting is logged and the layer is marked
  `data-failed`; the page colour and wash stay. No React Bits code is in `src/` or `dist/`
  (`tests/licences.test.js` searches for it).
- **Drawing.** A `<draw-layer>`'s overlay is a `div` with its own shadow root appended to the
  target, an svg 1000 units across whose height follows the target's aspect ratio. Strokes,
  pages and pictures are checked on every read (`src/draw/savefile.js`) and kept in IndexedDB
  through idb-keyval (`src/draw/store.js`); autosave stays off when a saved copy cannot be
  read, so it is not overwritten. The eyedropper (`src/draw/tools.js`) uses the EyeDropper API
  where there is one; elsewhere `src/draw/eyedropper.js` works out the colour under a click
  from the strokes' own data, the pictures' pixels and the hit-test stack under the layer (see
  the README for what it can and cannot sample). Only the second path was run here (Firefox);
  the EyeDropper API path is tested with a stub, not in Chromium. The recent colours
  (`src/draw/recent.js`) are a display preference in `localStorage`.
- **Browser run, elements.** `e2e/drive.mjs` also drives the demo's elements with real
  pointer input: the pool and its roll, dN, the resize handle dragged smaller and past the
  minimum, a `data-roll` button, 3D dice loading dice-box from `dice-box/` and a d7 falling
  back to 2D, the background's name button and middle-click color mode on bare and on solid
  background, the background following only a drag from bare background (a probe background
  registered through the page's copy of Toybox: nothing on hover, every move of a drag that
  starts on bare background and goes over content, `null` on release, nothing for a drag from
  content or with "reacts to the mouse" off, the grab and grabbing cursors), each of the six
  backgrounds drawing (with a screenshot and the pointer dragged on bare background), a stroke
  on the card and the eyedropper picking its colour back, Show scribbles, the Draw button put
  in the upper right from its menu and drawn with there, dragged by its grip past the window's
  edge (it stops 16 px in) and reset, notes and drawing pages, Move up, the image
  editor on the portrait, and that every chunk came from `chunks/` under the sub-path.

Not tried anywhere: a real phone or tablet (touch was only BiDi-simulated touch pointers in
desktop Firefox), Chrome or Safari, and any sound by ear (headless Firefox has no output; the
audio code runs without errors). Frame rate and CPU or GPU cost were not measured. For the
elements, not tried: pasting or dropping a real picture (the browser run adds none; the unit
test places one), Copy as PNG to the clipboard, printing to paper or PDF (only the print
rules are checked), the mouse wheel in color mode, the backgrounds' cost on a weak GPU, and
a React Bits background through `registerBackground` (`examples/react-bits-background/` was
not built or run here).

## The toys

Sizes are in `SIZES.md`. "Ready" means good enough to ship as it is.

### 1. Oil and water — adapted, WebGL Fluid Simulation (MIT)
- **Adapted:** `src/toys/fluid-sim.js` keeps the simulation and shaders (bloom and sunrays
  included) inside a factory; dropped dat.gui, the promo popup, analytics, screenshot
  capture and the checkerboard; the dithering PNG is replaced by generated noise; pointer
  events for any number of pointers. Colour presets (oil and water, rainbow, lava, sea) and
  a Splash button. Simulation 128, dye 512 (the original's mobile setting).
- **Works:** stirring with mouse and touch, splash, presets, pause, resize, cleanup (the GL
  context is released on close).
- **Doesn't:** the tank is always dark: the dye is additive light, so it cannot sit on the
  paper colour. Needs WebGL with half-float render targets; without them the toy says so.
- **Ready:** yes, after a look at cost on a weak GPU.

### 2. Ripple tank — adapted, jquery.ripples (MIT)
- **Adapted:** the three shaders and float-texture setup, without jQuery (no plugin wrapper,
  CSS background lookup or window resize binding). The pool floor (water gradient, light
  bands, pebbles) is painted on a canvas, so there is no image file. Pointer events; a Rain
  button.
- **Works:** drops on press, small ripples on move, rain, pause, resize.
- **Doesn't:** needs `OES_texture_float` render targets (WebGL 1); a browser without them
  gets a message instead (no such device was tried).
- **Ready:** yes.

### 3. Kaleidoscope — adapted, kazuhikoarase/kaleidoscope (MIT)
- **Adapted:** the bead chamber and triangle mirror tiling, unchanged in logic; beads are
  drawn shapes instead of PNGs; sized to the panel instead of the window; pointer events
  instead of mouse and touch handlers; the mouse wheel spins it too.
- **Works:** turning by drag and wheel, the slow spin after letting go, pause.
- **Doesn't:** no controls (nothing to set); the tube is black in both themes.
- **Ready:** yes.

### 4. Newton's cradle — adapted, matter.js example (MIT)
- **Adapted:** the example's cradle (inertia Infinity, restitution 1, no friction), five
  balls, drawn in ink in a frame; our pointer grab instead of MouseConstraint.
- **Works:** pull a ball and let go, the first ball starts pulled back.
- **Doesn't:** a ball can be pulled outside the drawn frame and past the edge of the panel.
- **Ready:** yes.

### 5. Drip timer — adapted, Galton board (MIT) on matter.js
- **Adapted:** the bead and peg physics settings; the board is closed into an hourglass: a
  reservoir and funnel, a neck, a triangle of pegs between walls that follow it, and bins.
  160 beads start in the reservoir; Flip (or a tap) turns the board over, rotating gravity
  with the view, and the beads run back through the pegs.
- **Works:** dripping through the neck, the bell-ish pile in the bins, flipping.
- **Doesn't:** the flow through the neck is not tuned and how long a full run takes was not
  measured; beads queue at the neck. A bead squeezed through a wall during a flip is put
  back in the middle, which can be seen. There is no set timer length.
- **Ready:** no; needs tuning of neck width and bead count.

### 6. Stacking blocks — adapted, matter.js stack and pyramid examples (MIT)
- **Adapted:** `Composites.pyramid` and `Composites.stack` builds (pyramid, tower, wall) in
  walls; drag blocks with the pointer, Throw a ball, Reset rebuilds.
- **Works:** stacking, knocking down, rebuilding.
- **Ready:** yes.

### 7. Pendulums — adapted, skeeto's double pendulum (Unlicense) and codebox's magnetic pendulum (MIT)
- **Adapted:** double pendulum: the RK4 equations, tail history and the Canvas 2D renderer
  (the WebGL renderer is dropped); the keyboard-only controls became Add, Clone and Remove
  buttons, and either bob can be dragged. Magnetic pendulum: the force model and presets,
  with plain arrays instead of the vector helper and smaller substeps for stability; drag
  the weight to throw it; the trace is drawn from above.
- **Works:** both modes, switching between them, clones drifting apart.
- **Doesn't:** the magnetic view is plain (dots and a trace, no sense of height); there are
  no sliders for gravity or magnet strength.
- **Ready:** the double pendulum yes; the magnetic one needs a better drawing.

### 8. String and cloth — adapted, verlet-js (MIT)
- **Adapted:** `src/toys/verlet.js` ports the particle, distance and pin constraints and the
  cloth builder, with pointer events (several pointers at once) instead of mouse handlers
  and a collision pass against round pegs. Cat's cradle: a loop of string around two hands
  of three fingers; pull the string, let go near a finger to hook it there, tap a hooked
  point to free it, drag a palm to move a hand. Cloth: the verlet-js cloth example.
- **Works:** pulling, hooking onto fingers, moving hands, the cloth.
- **Doesn't:** the string has no collision with itself, so it passes through itself and real
  string figures (which depend on strings crossing over each other) cannot be made; it
  tangles into loose shapes instead.
- **Ready:** cloth yes; cat's cradle no, it needs string-on-string contact.

### 9. Spirograph — adapted, anvaka/circles (MIT)
- **Adapted:** the nested-circle model and randomiser; no query-state. Sliders for the first
  gear's size and pen hole and for speed, pen colours, a gears overlay, Random and Clear;
  the drawing is on its own layer; dragging turns the gears by hand.
- **Works:** all of the above.
- **Doesn't:** only the first gear has sliders.
- **Ready:** yes.

### 10. Twisty cube — cubing.js `<twisty-player>` (MPL-2.0 or GPL-3.0-or-later), own page
- **Adapted:** none of cubing.js; `src/twisty/main.js` makes a 3×3×3 player and listens for
  the drawer's messages. Scramble is a random-move scramble (25 turns, never the same axis
  twice in a row), not cubing.js's random-state scrambler, which needs its search worker.
- **Works:** drag to turn the cube, Scramble, Reset, opened in the frame or alone.
- **Doesn't:** large: 967 KB minified on disk (247 KB gzipped for the page). Pause has
  nothing to stop when no move is animating.
- **Ready:** yes as a framed page; whether it is worth its size is the open question.

### 11. Music box — ToneMatrix Redux (GPL-3.0), own page
- **Adapted:** built from upstream as its gulpfile does (concatenate `lib/` and `src/`,
  minify, compile the SCSS), with esbuild and sass. Our page around it drops analytics,
  favicons, the web font and the share box, fits the canvas to the frame, and starts
  ToneMatrix only after a click on Start, so no sound plays before one. The page links its
  licence and `source.zip` (upstream at the pinned commit, our page and bridge, the build
  scripts); the drawer links the zip under the frame.
- **Works:** Start and placing notes (browser run). The drawer posts pause, resume and reset
  once the page is ready (unit test); the page's handling of them was not checked by ear.
- **Doesn't:** always black (its own look); the share-a-song link is hidden.
- **Ready:** yes as a framed page, with its source zip.

### 12. Lava lamp — written here
- Canvas 2D metaballs: seven blobs heated at the base and cooled at the cap rise and sink;
  the field is computed at 64 × 132 and scaled up into a glass outline with a glow. Four
  colour presets; touching the glass warms the wax under the pointer.
- **Doesn't:** the seven blobs merge where they meet but never split into new blobs as wax
  does; edges are soft rather than glossy.
- **Ready:** yes.

### 13. Pin art — written here
- A 36 × 36 grid of pins pushed out under the pointer (several pointers at once), by a stamp
  (hand, die, heart) or by an image dropped on the box (sampled by darkness); they settle
  back slowly.
- **Doesn't:** image drop was not tried in the browser run (only the stamps and pressing
  were). Pins only move straight out; there is no real depth or lighting.
- **Ready:** yes, after trying the drop.

### 14. Bubble wrap — written here
- 60 bubbles; press one to pop it with a generated pop (filtered noise burst, Web Audio, no
  files), Sound on/off; a new sheet inflates after all are popped.
- **Doesn't:** sound not heard by ear here; drag-popping is deliberately off (one press, one
  pop).
- **Ready:** yes.

### 15. Fidget spinner — written here
- Flick it round; momentum with bearing friction and air drag; motion-blur ghosts at speed;
  a triangle-wave hum whose pitch and volume follow the speed (Web Audio), Hum on/off; four
  styles (classic, star, dice, double).
- **Doesn't:** sound not heard by ear here.
- **Ready:** yes.

### 16. Zen sand garden — written here
- Rake grooves with the pointer (fine rake, wide rake, stick), grooves keep their ridges lit
  from the top left; drag stones, Add stone, Smooth to start over.
- **Doesn't:** grooves are drawn per pointer step, so a fast stroke shows straight pieces;
  dragging a stone was not exercised in the browser run; raking does not part around stones.
- **Ready:** yes, with smoother strokes as a follow-up.
