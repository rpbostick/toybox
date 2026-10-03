# A React Bits background in `<toy-background>`

How a site that already uses React adds a [React Bits](https://reactbits.dev) background to
Toybox's `<toy-background>`, next to the library's own six. Toybox ships no React Bits code:
the component is installed into the site's own source, and the site hands it to the element
with `registerBackground`.

## Licence

React Bits is MIT + Commons Clause. Using a component as part of your website or product is
fine; redistributing the components themselves (alone, in a bundle such as a component
library, or as a port) is not. That is why Toybox does not contain them and why this example
installs one into the site instead. Read the licence on reactbits.dev before you ship.

## Steps

1. Install React and the library in the site (`package.json` here lists them):

   ```sh
   npm install @rpbostick/toybox react react-dom
   npm install --save-dev vite @vitejs/plugin-react
   ```

2. Add the component to the site's source the way reactbits.dev describes on its page (pick
   JavaScript + CSS there; the page shows the exact `npx jsrepo add …` or `npx shadcn add …`
   command for the current version). With jsrepo it looks like:

   ```sh
   npx jsrepo add https://reactbits.dev/default/Backgrounds/Aurora
   ```

   or copy `Aurora.jsx` and `Aurora.css` from the component's page by hand. This example
   expects them at `components/Aurora/` next to `aurora-background.jsx`. Aurora draws with ogl,
   which the install adds as a dependency of the site.

3. Register it (`aurora-background.jsx`):

   ```js
   import { registerBackground } from '@rpbostick/toybox';
   registerBackground('react-bits-aurora', {
     name: 'Aurora (React Bits)',
     mount(el, api) {
       // render the component into el; return { setColors, pointer, pause, resume, destroy }
     },
   });
   ```

   `mount` gets the element to draw in (inside the background's shadow root, so the
   component's CSS is added there too) and `api` = `{ colors, theme, reducedMotion }`.
   `setColors(colors)` hears the colour wheel's colours as they change, `pointer({ x, y })` the
   pointer during a drag that started on bare background and its coast after a fling (`null`
   once when that ends; `api.motion` in `mount` has the rest of the drag dynamics),
   `pause()` and `resume()` when the
   background goes out of sight or the system asks for reduced motion, and `destroy()` when
   another background is picked or the element leaves.

4. Serve the site (`npm run dev`). The bundled copy of Toybox looks for its other files
   (dice-box, the framed toy pages, the licences) at the path given to `setAssetBase`; copy
   the package's `dist/` there.

A `<toy-background>` without `effects="…"` takes a registered background into its cycle at
once. To name it in `effects`, set the attribute after registering (an unknown name in
`effects` is an error, so a typo fails at once). Registering from any copy of Toybox on the
page (a bundle, the module from a script tag, `window.Toybox.registerBackground` from
`toybox-all.iife.js`) reaches every `<toy-background>`.
