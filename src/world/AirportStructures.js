// Shared visible boxes and solid boxes, in airport u/v coordinates, y above its base.
// Geometry proportions preserve the existing buildings; hangars now have an open doorway.
export function structureBoxes(s) {
  const boxes = [];
  const box = (u, v, w, d, h, material = 'wall', y = 0) => boxes.push({ u, v, w, d, h, y, material });
  if (s.kind === 'hangar') {
    const t = Math.max(0.4, s.w * 0.02), front = s.v - s.d / 2;
    const doorW = s.w * 0.82, doorH = s.h * 0.72, jamb = (s.w - doorW) / 2;
    box(s.u - s.w / 2 + t / 2, s.v, t, s.d, s.h);
    box(s.u + s.w / 2 - t / 2, s.v, t, s.d, s.h);
    box(s.u, s.v + s.d / 2 - t / 2, s.w, t, s.h);
    box(s.u - (s.w + doorW) / 4, front + t / 2, jamb, t, doorH);
    box(s.u + (s.w + doorW) / 4, front + t / 2, jamb, t, doorH);
    box(s.u, front + t / 2, doorW, t, s.h - doorH, 'wall', doorH);
    box(s.u, s.v, s.w + 1.2, s.d + 1.2, 1, 'roof', s.h);
    box(s.u, s.v, s.w * (s.shelter ? 0.6 : 0.5), s.d * 0.62, 1.8, 'roof', s.h + 1);
    box(s.u, front - 0.12, s.w, 0.26, 1.1, 'accent', Math.min(s.h - 1.4, doorH + 0.9));
  } else if (s.kind === 'tower') {
    const h = s.h, cw = s.w * 2.3, cd = s.d * 2.3, cy = h * 0.8;
    box(s.u, s.v, s.w * 1.8, s.d * 1.8, h * 0.18);
    box(s.u, s.v, s.w, s.d, h * 0.82);
    box(s.u, s.v, cw * 1.04, cd * 1.04, 0.7, 'roof', cy - 0.7);
    box(s.u, s.v, cw, cd, h * 0.12, 'glass', cy);
    box(s.u, s.v, cw * 1.12, cd * 1.12, 0.8, 'roof', cy + h * 0.12);
    box(s.u, s.v, 0.4, 0.4, 5, 'pole', cy + h * 0.12 + 0.8);
  } else if (s.kind === 'terminal') {
    box(s.u, s.v, s.w, s.d, s.h);
    box(s.u, s.v - s.d / 2 - 0.1, s.w * 0.96, 0.3, s.h * 0.45, 'glass', s.h * 0.3);
    box(s.u, s.v, s.w + 6, s.d + 8, 1.2, 'roof', s.h);
  }
  return boxes;
}
