// Moves a position: fixed box by dragging its handle (a title bar). Presses on the handle's
// buttons are left alone. The box stays at least partly on screen; its size is CSS resize.

const KEEP_VISIBLE = 48; // px of the box that stay inside the window

export function makeDraggable({ handle, box, win }) {
  let start = null; // { pointerId, x, y, left, top }

  const down = (event) => {
    if (event.button > 0 || event.target.closest('button, a, select, input')) return;
    const rect = box.getBoundingClientRect();
    start = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, left: rect.left, top: rect.top };
    handle.setPointerCapture(event.pointerId);
    event.preventDefault();
  };
  const move = (event) => {
    if (!start || event.pointerId !== start.pointerId) return;
    const rect = box.getBoundingClientRect();
    const left = clamp(start.left + event.clientX - start.x, KEEP_VISIBLE - rect.width, win.innerWidth - KEEP_VISIBLE);
    const top = clamp(start.top + event.clientY - start.y, 0, win.innerHeight - KEEP_VISIBLE);
    Object.assign(box.style, { left: `${left}px`, top: `${top}px`, bottom: 'auto' });
  };
  const up = (event) => {
    if (start && event.pointerId === start.pointerId) start = null;
  };

  const events = [['pointerdown', down], ['pointermove', move], ['pointerup', up], ['pointercancel', up]];
  for (const [type, handler] of events) handle.addEventListener(type, handler);
  return () => {
    for (const [type, handler] of events) handle.removeEventListener(type, handler);
    for (const property of ['left', 'top', 'bottom']) box.style.removeProperty(property);
  };
}

function clamp(value, low, high) {
  return Math.min(Math.max(value, low), Math.max(low, high));
}
