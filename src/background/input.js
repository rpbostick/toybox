// The background's pointer rules: which press toggles the color mode, what counts as bare
// background, and when the effect hears the pointer: only from a drag that started on bare
// background (and, through motion.js, its coast after a fling).

const LEFT_BUTTON = 0;
const MIDDLE_BUTTON = 1;

// What sits on top of the background: the page marks every container of its content with
// data-solid, so a new part of the page is covered by marking its container. Toybox's own
// elements, dialogs and form controls count wherever they are, so a control outside a marked
// container still keeps its own pointer and wheel behaviour. Events from inside an element's
// shadow root reach here retargeted to the element itself, which is on this list.
const TOYBOX_TAGS = "toy-drawer, toy-box, dice-tray, toy-background, draw-layer, toy-pages";
const SOLID = `[data-solid], ${TOYBOX_TAGS}, dialog, [role=dialog], button, input, select, textarea, label, a, [contenteditable]`;

// Classes on <html>: grab while the pointer hovers bare background, grabbing during a drag.
const GRAB_CLASS = "toybox-background-grab";
const DRAGGING_CLASS = "toybox-background-dragging";
// Light-DOM rules, since the cursor and text selection belong to the page, not the element's
// shadow root. During a drag every element shows grabbing and nothing selects.
const CURSOR_CSS = `html.${GRAB_CLASS} { cursor: grab; }
html.${DRAGGING_CLASS}, html.${DRAGGING_CLASS} * { cursor: grabbing !important; user-select: none !important; -webkit-user-select: none !important; }`;

// A middle press flips between the wheel stepping colors and the wheel scrolling the page; other
// buttons leave the state alone.
function activeAfterPress(active, button) {
  return button === MIDDLE_BUTTON ? !active : active;
}

// A left-button press (a touch or pen contact reports button 0 too) on bare background.
function startsDrag(button, onBareBackground) {
  return button === LEFT_BUTTON && onBareBackground;
}

// The one test of "is the pointer over bare background?", for presses, hovering and the wheel
// alike. The backdrop layer takes no pointer events, so over bare background the element is the
// page's own html, body or an unmarked wrapper.
function isBareBackground(element) {
  if (!element || typeof element.closest !== "function") return false;
  return element.closest(SOLID) === null;
}

/**
 * Tells `sink` about a drag that started on bare background, and nothing else: sink.grab(x, y) at
 * the press, sink.move(x, y) for every move of that pointer wherever it goes, then once either
 * sink.release() (the button let go, or the pointer leaving the window: a fling that may coast
 * on) or sink.cancel() (the browser took the pointer, the window lost the focus, the interaction
 * was turned off: no coast). Hover tells it nothing.
 */
function createDragFeed(sink) {
  let drag = null;
  let enabled = true;
  function finish(how) {
    if (!drag) return;
    drag = null;
    sink[how]();
  }
  const cancel = () => finish("cancel");
  const ours = (pointerId) => drag !== null && drag.pointerId === pointerId;
  return {
    /** A press; true when it started a drag. */
    press(pointerId, x, y, button, bare) {
      if (!enabled || drag || !startsDrag(button, bare)) return false;
      drag = { pointerId };
      sink.grab(x, y);
      return true;
    },
    move(pointerId, x, y) {
      if (ours(pointerId)) sink.move(x, y);
    },
    release(pointerId) {
      if (ours(pointerId)) finish("release");
    },
    /** The browser took this pointer over (pointercancel): it was not flung. */
    cancelPointer(pointerId) {
      if (ours(pointerId)) cancel();
    },
    /** The pointer left the window mid-drag: a release, so a fling off the edge coasts on. */
    leave: () => finish("release"),
    /** Ends any drag without a coast. */
    cancel,
    setEnabled(on) {
      enabled = on;
      if (!on) cancel();
    },
    get enabled() { return enabled; },
    get dragging() { return drag !== null; },
  };
}

export { activeAfterPress, startsDrag, isBareBackground, createDragFeed, LEFT_BUTTON, MIDDLE_BUTTON, SOLID, GRAB_CLASS, DRAGGING_CLASS, CURSOR_CSS };
