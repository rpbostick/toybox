// Maps a fixed-size toy world onto a canvas of any size, centred and letterboxed, so a toy's
// physics never changes when the panel is resized.

export function fitView(surface, worldWidth, worldHeight) {
  const scale = Math.min(surface.width / worldWidth, surface.height / worldHeight);
  const offsetX = (surface.width - worldWidth * scale) / 2;
  const offsetY = (surface.height - worldHeight * scale) / 2;
  return {
    scale,
    toWorld: (x, y) => ({ x: (x - offsetX) / scale, y: (y - offsetY) / scale }),
    /** Sets the canvas transform so drawing happens in world units. */
    apply(g) {
      g.setTransform(surface.ratio * scale, 0, 0, surface.ratio * scale, surface.ratio * offsetX, surface.ratio * offsetY);
    },
  };
}

export function clear(surface, colour) {
  const { g } = surface;
  g.setTransform(surface.ratio, 0, 0, surface.ratio, 0, 0);
  g.fillStyle = colour;
  g.fillRect(0, 0, surface.width, surface.height);
}
