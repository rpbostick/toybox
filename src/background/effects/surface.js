// What every built-in background shares: a canvas that fills the layer at a capped pixel ratio,
// a frame loop whose clock stops while paused (and that draws one frame on demand while paused,
// so a colour change still shows under reduced motion), and a pointer that eases in and out
// instead of jumping when it enters or leaves bare background.

/** A canvas appended to `el`; fit() sizes it to the element and says whether the size changed. */
export function makeCanvas(el, { scale = 1, maxRatio = 2 } = {}) {
  const doc = el.ownerDocument;
  const win = doc.defaultView;
  const canvas = doc.createElement('canvas');
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  el.append(canvas);
  const surface = {
    canvas,
    ratio: 1,
    fit() {
      surface.ratio = Math.min(win.devicePixelRatio || 1, maxRatio) * scale;
      const width = Math.max(1, Math.round(el.clientWidth * surface.ratio));
      const height = Math.max(1, Math.round(el.clientHeight * surface.ratio));
      if (canvas.width === width && canvas.height === height) return false;
      canvas.width = width;
      canvas.height = height;
      return true;
    },
  };
  surface.fit();
  return surface;
}

/**
 * draw(seconds) once per animation frame while running. The clock starts at `start` seconds (so
 * the first, still frame is not the pattern's symmetric start) and counts only running time,
 * with a long gap (a background tab) counted as 0.1 s.
 */
export function frameLoop(win, draw, start = 30) {
  let frame = null;
  let last = null;
  let seconds = start;
  const tick = (now) => {
    if (last !== null) seconds += Math.min(100, Math.max(0, now - last)) / 1000;
    last = now;
    draw(seconds);
    frame = win.requestAnimationFrame(tick);
  };
  return {
    resume() {
      if (frame !== null) return;
      last = null;
      frame = win.requestAnimationFrame(tick);
    },
    pause() {
      if (frame === null) return;
      win.cancelAnimationFrame(frame);
      frame = null;
    },
    /** Draws now when paused; a running loop draws on its next frame anyway. */
    redraw() {
      if (frame === null) draw(seconds);
    },
  };
}

/** The pointer in the element's pixels, eased: `on` goes 0 → 1 over about a quarter second. */
export function easedPointer(el) {
  const state = { x: 0, y: 0, on: 0, targetX: 0, targetY: 0, inside: false };
  return {
    state,
    set(point) {
      if (!point) {
        state.inside = false;
        return;
      }
      const box = el.getBoundingClientRect();
      state.targetX = point.x - box.left;
      state.targetY = point.y - box.top;
      if (!state.inside && state.on < 0.01) {
        state.x = state.targetX;
        state.y = state.targetY;
      }
      state.inside = true;
    },
    step() {
      state.x += (state.targetX - state.x) * 0.15;
      state.y += (state.targetY - state.y) * 0.15;
      state.on += ((state.inside ? 1 : 0) - state.on) * 0.08;
      return state;
    },
  };
}
