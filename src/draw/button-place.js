// Where <draw-layer>'s Draw button sits: in one of the window's corners, or where it was dragged
// (spot, its top left corner in CSS pixels), always fully on screen and MARGIN clear of the
// window's edges, and the way its tool bar opens: toward the middle of the window.
// viewport is { width, height }; head is the button's own { width, height }.

export const CORNERS = ['bottom-left', 'bottom-right', 'top-left', 'top-right'];
export const DEFAULT_CORNER = 'bottom-left';
export const MARGIN = 16;

export function checkCorner(corner, where) {
  if (!CORNERS.includes(corner)) throw new Error(`${where}: corner "${corner}" is not one of ${CORNERS.join(', ')}`);
  return corner;
}

// A window narrower than the button and both margins keeps the button MARGIN in from the left
// (or top), so its start is what stays in sight.
const within = (value, low, high) => Math.max(low, Math.min(value, high));

export function keepOnScreen(spot, viewport, head) {
  return {
    x: within(spot.x, MARGIN, viewport.width - head.width - MARGIN),
    y: within(spot.y, MARGIN, viewport.height - head.height - MARGIN),
  };
}

export function cornerSpot(corner, viewport, head) {
  const [vertical, horizontal] = checkCorner(corner, 'cornerSpot').split('-');
  return keepOnScreen({
    x: horizontal === 'left' ? MARGIN : viewport.width - head.width - MARGIN,
    y: vertical === 'top' ? MARGIN : viewport.height - head.height - MARGIN,
  }, viewport, head);
}

/**
 * The CSS that pins the button: the side it opens away from is the side it is pinned to, so
 * the button stays put while the tool bar grows toward the middle. place is { corner, spot }
 * with spot null for "in the corner".
 */
export function anchors(place, viewport, head) {
  const spot = place.spot ? keepOnScreen(place.spot, viewport, head) : cornerSpot(place.corner, viewport, head);
  const right = spot.x + head.width / 2 > viewport.width / 2;
  const down = spot.y + head.height / 2 <= viewport.height / 2;
  return {
    open: { x: right ? 'left' : 'right', y: down ? 'down' : 'up' },
    css: {
      left: right ? 'auto' : `${spot.x}px`,
      right: right ? `${viewport.width - spot.x - head.width}px` : 'auto',
      top: down ? `${spot.y}px` : 'auto',
      bottom: down ? 'auto' : `${viewport.height - spot.y - head.height}px`,
    },
  };
}

/**
 * The remembered place, or null when there is none or it is not one this library wrote (the
 * caller then uses the element's corner): a layout preference, so a stale entry is not an error.
 */
export function parsePlace(text) {
  if (typeof text !== 'string') return null;
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (!value || typeof value !== 'object' || !CORNERS.includes(value.corner)) return null;
  if (value.spot === null) return { corner: value.corner, spot: null };
  const { spot } = value;
  const ok = spot && typeof spot === 'object' && [spot.x, spot.y].every(Number.isFinite);
  return ok ? { corner: value.corner, spot: { x: spot.x, y: spot.y } } : null;
}

export const serializePlace = (place) => JSON.stringify({ corner: place.corner, spot: place.spot && { x: place.spot.x, y: place.spot.y } });
