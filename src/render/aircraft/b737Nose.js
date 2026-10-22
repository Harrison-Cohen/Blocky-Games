// The 737-800's lower nose and upper flight deck share their sill/brow rails.
// Three planar panes per side, open in the shell, replace glass painted on a cone.
// Body axes: +x left, +y up, +z forward. Photo references are in the revision plan.
import * as THREE from 'three';

export const NOSE_JOIN = 12.6;
// Rear to front. B: belly centre, E: widest cheek, S: window sill, T: brow,
// C: roof centre. The sloping windshield's top is behind its bottom.
const RAILS = [
  { b: [0, -1.75, 12.6], e: [1.88, 0.13, 12.6], s: [1.815, 0.70, 12.6], t: [1.47, 1.35, 12.6], c: [0, 2.01, 12.6] },
  { b: [0, -1.72, 13.25], e: [1.84, 0.08, 13.25], s: [1.77, 0.68, 13.25], t: [1.36, 1.35, 13.25], c: [0, 2.00, 13.25] },
  { b: [0, -1.56, 14.35], e: [1.67, -0.02, 14.35], s: [1.49, 0.54, 14.35], t: [1.25, 1.33, 13.95], c: [0, 1.94, 13.95] },
  { b: [0, -1.31, 15.55], e: [1.33, -0.12, 15.55], s: [1.02, 0.59, 15.55], t: [1.03, 1.30, 14.75], c: [0, 1.72, 14.75] },
  { b: [0, -1.08, 16.15], e: [1.02, -0.15, 16.15], s: [0, 0.72, 16.15], t: [0, 1.28, 15.30], c: [0, 1.28, 15.30] },
  { b: [0, -0.68, 16.95], e: [0.62, -0.08, 16.95], s: [0, 0.43, 16.95] },
  { b: [0, -0.22, 17.43], e: [0.24, 0.08, 17.43], s: [0, 0.29, 17.43] },
  { b: [0, 0.07, 17.57], e: [0, 0.14, 17.57], s: [0, 0.21, 17.57] },
];
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const bilerp = (a, b, c, d, u, v) => mix(mix(a, b, u), mix(c, d, u), v);

function buffer() { return { pos: [], idx: [] }; }
function quad(out, a, b, c, d, side) {
  const n = out.pos.length / 3;
  for (const p of [a, b, c, d]) out.pos.push(side * p[0], p[1], p[2]);
  if (side > 0) out.idx.push(n, n + 2, n + 1, n + 1, n + 2, n + 3);
  else out.idx.push(n, n + 1, n + 2, n + 1, n + 3, n + 2);
}
function geometry(out) {
  const g = new THREE.BufferGeometry();
  const positions = [], remap = [], seen = new Map();
  for (let i = 0; i < out.pos.length; i += 3) {
    const key = out.pos.slice(i, i + 3).map((v) => Math.round(v * 1e7)).join(',');
    if (!seen.has(key)) { seen.set(key, positions.length / 3); positions.push(...out.pos.slice(i, i + 3)); }
    remap.push(seen.get(key));
  }
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex(out.idx.map((i) => remap[i]));
  // Welded normals across adjacent panels, without merging the glass and frames.
  g.computeVertexNormals();
  return g;
}

// Subdivided curved rails below the windows and across the roof. Match the tube's
// superellipse at the join; the upper pane belt remains straight, like real glass.
function lowerPoint(r, t) {
  if (t < 0.5) {
    const a = t * Math.PI, e = 2 / 2.2;
    return [r.e[0] * Math.pow(Math.sin(a), e), r.e[1] + (r.b[1] - r.e[1]) * Math.pow(Math.cos(a), e), r.b[2]];
  }
  const u = (t - 0.5) * 2;
  // The sill is narrower than the cheek; a quadratic keeps the shoulder rounded.
  return [r.e[0] + (r.s[0] - r.e[0]) * u * u, r.e[1] + (r.s[1] - r.e[1]) * u, r.s[2]];
}
function roofPoint(r, t) {
  const a = t * Math.PI / 2, e = 2 / 2.2;
  return [r.t[0] * Math.pow(Math.cos(a), e), r.t[1] + (r.c[1] - r.t[1]) * Math.pow(Math.sin(a), e), r.t[2]];
}

// The interior uses these same surfaces with inward-facing materials.
export function buildNoseGeometry() {
  const lower = buffer(), deck = buffer(), glass = buffer(), frames = buffer();
  for (const side of [1, -1]) for (let i = 0; i < RAILS.length - 1; i++) {
    const a = RAILS[i], b = RAILS[i + 1];
    for (let j = 0; j < 20; j++) {
      const t0 = j / 20, t1 = (j + 1) / 20;
      quad(lower, lowerPoint(a, t0), lowerPoint(b, t0), lowerPoint(a, t1), lowerPoint(b, t1), side);
    }
    if (!b.t) continue;
    for (let j = 0; j < 10; j++) {
      const t0 = j / 10, t1 = (j + 1) / 10;
      quad(deck, roofPoint(a, t0), roofPoint(b, t0), roofPoint(a, t1), roofPoint(b, t1), side);
    }
    const at = (u, v) => bilerp(a.s, b.s, a.t, b.t, u, v);
    const rect = (out, u0, u1, v0, v1) => quad(out, at(u0, v0), at(u1, v0), at(u0, v1), at(u1, v1), side);
    if (i === 0) { rect(deck, 0, 1, 0, 1); continue; }
    // White structure around a narrow dark seal. Shared vertices define both the
    // external windscreen and the interior opening. Last pane meets a centre post.
    const u0 = 0.045, u1 = i === 3 ? 0.975 : 0.955, v0 = 0.075, v1 = 0.94;
    rect(deck, 0, u0, 0, 1); rect(deck, u1, 1, 0, 1);
    rect(deck, u0, u1, 0, v0); rect(deck, u0, u1, v1, 1);
    rect(frames, u0, u0 + 0.012, v0, v1); rect(frames, u1 - 0.012, u1, v0, v1);
    rect(frames, u0 + 0.012, u1 - 0.012, v0, v0 + 0.014);
    rect(frames, u0 + 0.012, u1 - 0.012, v1 - 0.014, v1);
    rect(glass, u0 + 0.012, u1 - 0.012, v0 + 0.014, v1 - 0.014);
  }
  return { lower: geometry(lower), deck: geometry(deck), glass: geometry(glass), frames: geometry(frames) };
}
