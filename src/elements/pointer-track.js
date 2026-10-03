// Follows one pointer (mouse, pen or touch) from a press on `handle` until it is released, for
// the floating windows' title bars and resize handles (window.js) and the Draw button's grip. Presses on a control
// inside the handle are left to the control.

/**
 * start() runs on the press and returns what move() is given back; move(dx, dy, started) runs
 * for every movement with the distance from the press; end() runs on release or cancel.
 * Listening stops for good when `signal` aborts.
 */
export function trackPointer(handle, { signal, start, move, end }) {
  handle.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || event.target.closest('button, input, select')) return;
    event.preventDefault();
    const started = start();
    const x0 = event.clientX;
    const y0 = event.clientY;
    handle.setPointerCapture(event.pointerId);
    const onMove = (moved) => move(moved.clientX - x0, moved.clientY - y0, started);
    const onUp = () => {
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onUp);
      handle.removeEventListener('pointercancel', onUp);
      end();
    };
    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onUp);
    handle.addEventListener('pointercancel', onUp);
  }, { signal });
}
