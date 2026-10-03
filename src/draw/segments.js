// The eraser's geometry: whether its move between two pointer positions crosses or touches a
// stroke's polyline. Segments are {x1, y1, x2, y2} in the layer's units.

/**
 * Whether two segments cross, from their parameters along each segment. Deliberate:
 * parametric, not "the crossing point's x and y lie between each segment's ends", which fails by
 * rounding for an exactly vertical or horizontal eraser move (a straight drag down across a
 * stroke erased nothing in drauu 1.0.0, which tests that way).
 */
export function segmentsCross(a, b) {
  const denom = (a.x2 - a.x1) * (b.y2 - b.y1) - (a.y2 - a.y1) * (b.x2 - b.x1);
  if (denom === 0) return false;
  const t = ((b.x1 - a.x1) * (b.y2 - b.y1) - (b.y1 - a.y1) * (b.x2 - b.x1)) / denom;
  const u = ((b.x1 - a.x1) * (a.y2 - a.y1) - (b.y1 - a.y1) * (a.x2 - a.x1)) / denom;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

export function pointToSegment(px, py, s) {
  const dx = s.x2 - s.x1;
  const dy = s.y2 - s.y1;
  const length2 = dx * dx + dy * dy;
  const t = length2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - s.x1) * dx + (py - s.y1) * dy) / length2));
  return Math.hypot(px - (s.x1 + t * dx), py - (s.y1 + t * dy));
}

/** Closest distance between two segments: zero when they cross, else the nearest end-to-segment distance. */
export function segmentDistance(a, b) {
  if (segmentsCross(a, b)) return 0;
  return Math.min(pointToSegment(a.x1, a.y1, b), pointToSegment(a.x2, a.y2, b),
    pointToSegment(b.x1, b.y1, a), pointToSegment(b.x2, b.y2, a));
}
