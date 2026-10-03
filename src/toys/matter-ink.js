// Draws matter.js bodies in the sheet's ink style (instead of Matter.Render's debug look).

export function traceBody(g, body) {
  const parts = body.parts.length > 1 ? body.parts.slice(1) : [body];
  g.beginPath();
  for (const part of parts) {
    if (part.circleRadius) {
      g.moveTo(part.position.x + part.circleRadius, part.position.y);
      g.arc(part.position.x, part.position.y, part.circleRadius, 0, Math.PI * 2);
    } else {
      const [first, ...rest] = part.vertices;
      g.moveTo(first.x, first.y);
      for (const vertex of rest) g.lineTo(vertex.x, vertex.y);
      g.closePath();
    }
  }
}

export function drawBody(g, body, { fill, stroke, lineWidth = 1.5 }) {
  traceBody(g, body);
  if (fill) {
    g.fillStyle = fill;
    g.fill();
  }
  if (stroke) {
    g.strokeStyle = stroke;
    g.lineWidth = lineWidth;
    g.lineJoin = 'round';
    g.stroke();
  }
}
