// A React Bits background on a site that uses Toybox. The component is installed into the
// site's own source (see README.md); this file only hands it to <toy-background> through
// registerBackground. Built with the site's bundler (Vite here, for the `?raw` CSS import).
import { createRoot } from 'react-dom/client';
import { registerBackground, setAssetBase } from '@rpbostick/toybox';
// Installed into the site by `npx jsrepo add …` (or copied from reactbits.dev); not part of Toybox.
import Aurora from './components/Aurora/Aurora';
import auroraCss from './components/Aurora/Aurora.css?raw';

// The bundled copy of Toybox looks for its files (toy pages, dice-box, licences) here.
setAssetBase('/toybox/');

registerBackground('react-bits-aurora', {
  name: 'Aurora (React Bits)',
  mount(el, api) {
    // <toy-background> draws in a shadow root, where the page's stylesheets do not reach, so the
    // component's own CSS goes in beside it.
    const style = document.createElement('style');
    style.textContent = auroraCss;
    const holder = document.createElement('div');
    holder.style.cssText = 'width: 100%; height: 100%;';
    el.append(style, holder);
    const root = createRoot(holder);
    let colors = api.colors;
    let speed = api.reducedMotion ? 0 : 0.6;
    const render = () => root.render(<Aurora colorStops={colors.hex} amplitude={1} blend={0.5} speed={speed} />);
    render();
    return {
      // The colour wheel's colours: { theme, hex: [three '#rrggbb'], rgb: [three [r, g, b] in 0–1] }.
      setColors(next) {
        colors = next;
        render();
      },
      // Aurora does not follow the pointer. A component that listens for mousemove on its
      // canvas (Iridescence, Liquid Chrome, …) can be handed it like this.
      pointer(point) {
        const canvas = holder.querySelector('canvas');
        if (!canvas) return;
        if (point) canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: point.x, clientY: point.y, bubbles: true }));
        else canvas.dispatchEvent(new MouseEvent('mouseleave'));
      },
      // Out of sight or under reduced motion: Aurora has no pause, so its speed goes to 0.
      pause() {
        speed = 0;
        render();
      },
      resume() {
        speed = 0.6;
        render();
      },
      destroy() {
        root.unmount();
        style.remove();
        holder.remove();
      },
    };
  },
});
