// Builds a car out of primitives. No external assets, ever.
//
// Two kinds of body are built here. The open-wheeler is bevelled boxes and
// low-segment cylinders, a toy under a hard sun. The five cars modelled on
// real ones are LOFTED: smooth panels swept through cross-sections taken
// along the car, from each car's real side profile and plan -- see SHAPES --
// so a 911 has a 911's roofline and an Enzo its nose. They are still made in
// code from nothing but numbers.
//
// The car root sits at the suspension MOUNT PLANE, which is where
// VehiclePhysics puts its origin. Wheels hang below it by
// (restLength - compression) and are moved every frame by Vehicle.js, so the
// body visibly floats on its springs.
//
// `config` carries the cosmetics: liveries, spoilers, roof items and roundels.
// Nothing there may touch handling.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { unlit, glossy, ownLamp } from '../render/Materials.js';
import { SIM } from '../data/tuning.js';
import { springRate } from './VehiclePhysics.js';
import { contrastTo } from '../data/customization.js';
import { bodyCenter } from '../data/cars.js';

// Where the bodywork sits relative to the car root, in metres (negative: the
// body hangs below the mount plane). The root is the suspension MOUNT PLANE,
// which is itself 0.2 m to 0.3 m above the road depending on chassis and how
// far the springs have squashed under the car's own weight. So measure down
// from the mount plane: work out where it actually rests, and drop the
// bodywork to the ride height the chassis asks for.
//
// How far the suspension mount plane sits above the road with the car resting
// on its own springs. This is where the car root lives, so it is also what the
// garage turntable needs in order to stand a car on the ground.
export function mountHeight(chassis) {
  const staticSquash = (chassis.mass * SIM.gravity) / (4 * springRate(chassis));
  return chassis.suspensionRest - staticSquash;
}

export function bodyLift(chassis) {
  return chassis.rideHeight - mountHeight(chassis);
}

const WHEEL_SEGMENTS = 28; // round enough to read as a tyre at any speed
const BODY_SEGMENTS = 6;   // subdivision per box axis, feeds the edge rounding
const MAX_BEVEL = 0.055;   // metres of edge radius on bodywork

// How deep a light lens is. Half of it sits inside the bodywork and half
// stands proud, so this is also how far a lens sticks out. Exported because
// check-parts.mjs identifies the lenses by it.
export const LENS_DEPTH = 0.06;

// Tail lamp colours, and how fast they move between them. Not in tuning.js
// because none of it touches how the car drives -- this is the same kind of
// constant as LENS_DEPTH above. The attack is near instant, as a real brake
// light is; the release is slower, so trail braking on a keyboard reads as a
// lamp going out rather than as a strobe.
export const BRAKE_LIGHT = {
  rest: 0x9e1f16,
  lit: 0xff5540,
  attack: 26, // 1/seconds
  release: 9,
};

// A box with rounded edges and smooth normals.
//
// Take a subdivided cube and push every vertex onto the surface of a rounded
// box: clamp the vertex into the inner box, then step out along the direction
// from the clamped point by the bevel radius. Points on a flat face do not move
// and keep their face normal; points near an edge or corner sweep a quarter
// sphere. The normal is the step direction itself, which is exact and, unlike
// computeVertexNormals, stays continuous across BoxGeometry's duplicated seam
// vertices -- so the bevels read as smooth instead of showing a crease.
function roundedBox(w, h, d, bevel) {
  const r = Math.min(bevel, w * 0.5, h * 0.5, d * 0.5) * 0.999;
  const g = new THREE.BoxGeometry(w, h, d, BODY_SEGMENTS, BODY_SEGMENTS, BODY_SEGMENTS);
  const pos = g.attributes.position;
  const nrm = g.attributes.normal;
  const ix = w * 0.5 - r, iy = h * 0.5 - r, iz = d * 0.5 - r;
  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i), vy = pos.getY(i), vz = pos.getZ(i);
    const qx = Math.min(ix, Math.max(-ix, vx));
    const qy = Math.min(iy, Math.max(-iy, vy));
    const qz = Math.min(iz, Math.max(-iz, vz));
    let nx = vx - qx, ny = vy - qy, nz = vz - qz;
    const len = Math.hypot(nx, ny, nz);
    if (len > 1e-9) { nx /= len; ny /= len; nz /= len; } else { ny = 1; }
    pos.setXYZ(i, qx + nx * r, qy + ny * r, qz + nz * r);
    nrm.setXYZ(i, nx, ny, nz);
  }
  pos.needsUpdate = true;
  nrm.needsUpdate = true;
  return g;
}

export const DEFAULT_CONFIG = {
  primary: 0xff7a1a,
  secondary: 0x1a2740,
  wheel: 0x14161c,
  hub: 0xedede7,
  headlight: 0xfff2d0,
  livery: 'none',
  wheelStyle: 'fivespoke',
  spoiler: 'none',
  roofItem: 'none',
  number: null,       // null draws no roundel; 0 is a number like any other
};

// How far a livery panel or a roundel stands off the bodywork it is painted
// on. Big enough that nothing z-fights, small enough to read as paint.
const SKIN = 0.012;

// Parts are collected as loose geometry and merged into ONE mesh per material
// at the end. Built as individual meshes a car costs about 40 draw calls, and a
// six car field then costs more than the entire rest of the scene; merged it is
// around a dozen. The wheels stay separate because they move and spin on their
// own.
class PartSet {
  constructor() { this.byMaterial = new Map(); }

  // Bevel scales with the smallest dimension, so a thin wing or a light lens
  // keeps its shape instead of being rounded away to nothing.
  add(w, h, d, material, x, y, z, ry = 0) {
    const bevel = Math.min(MAX_BEVEL, Math.min(w, h, d) * 0.3);
    const g = roundedBox(w, h, d, bevel);
    if (ry) g.rotateY(ry);
    g.translate(x, y, z);
    return this.push(g, material);
  }

  // An already positioned geometry, for the parts that are not boxes.
  push(geometry, material) {
    let list = this.byMaterial.get(material);
    if (!list) { list = []; this.byMaterial.set(material, list); }
    list.push(geometry);
    return geometry;
  }

  // A plain box, no subdivision and no bevel: 12 triangles instead of 432.
  // Right for anything whose edges are already too small to round -- livery
  // panels, roundels, light bar lenses -- and wrong for bodywork, which is
  // smooth-shaded and needs the rounding to catch a highlight.
  addFlat(w, h, d, material, x, y, z, ry = 0) {
    const g = new THREE.BoxGeometry(w, h, d);
    if (ry) g.rotateY(ry);
    g.translate(x, y, z);
    return this.push(g, material);
  }

  build(target) {
    for (const [material, geos] of this.byMaterial) {
      const merged = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
      if (geos.length > 1) geos.forEach((g) => g.dispose());
      const mesh = new THREE.Mesh(merged, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      target.add(mesh);
    }
  }
}

// ---------------------------------------------------------------------------
// Lofted panels.
//
// A Loft is a smooth panel swept through cross-sections along z. Each section
// is a superellipse -- |x/a|^n + |y/b|^n = 1, where n = 2 is an ellipse and a
// higher n is squarer -- centred on xc, running from y0 up to y1, hw across at
// its widest and narrowing toward the top by `top`, the tumblehome: its top is
// `top` times as wide as its bottom. Between two sections everything is a
// straight line, and sections are close enough that it reads as one smooth
// panel.
//
// Positions are written straight into the geometry and never translated, and
// `contains` answers the same shape exactly, which is what the parts check
// uses to judge a lens or a mirror against a curved surface.
// ---------------------------------------------------------------------------

class Loft {
  constructor(stations, n = 4, seg = 40) {
    this.st = stations; // sorted by z, rear first
    this.n = n;
    this.seg = seg;
    this.z0 = stations[0].z;
    this.z1 = stations[stations.length - 1].z;
  }

  // The section at z, interpolated, or null past either end.
  at(z) {
    const st = this.st;
    if (z < this.z0 || z > this.z1) return null;
    let lo = 0, hi = st.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (st[mid].z <= z) lo = mid; else hi = mid;
    }
    const a = st[lo], b = st[hi];
    const t = b.z > a.z ? (z - a.z) / (b.z - a.z) : 0;
    const mix = (k) => a[k] + (b[k] - a[k]) * t;
    return { y0: mix('y0'), y1: mix('y1'), hw: mix('hw'), xc: mix('xc'), top: mix('top') };
  }

  // Half width of section s at height py (-1 at the bottom, 1 at the top).
  static reach(s, py) {
    const u = (py + 1) / 2;
    return s.hw * (1 - (1 - s.top) * u * u);
  }

  contains(x, y, z) {
    const s = this.at(z);
    if (!s) return false;
    const b = (s.y1 - s.y0) / 2;
    if (b <= 1e-5) return false;
    const py = (y - (s.y0 + s.y1) / 2) / b;
    if (py <= -1 || py >= 1) return false;
    const px = (x - s.xc) / Loft.reach(s, py);
    return Math.pow(Math.abs(px), this.n) + Math.pow(Math.abs(py), this.n) < 1;
  }

  // A point round section s at t, from the bottom centre round through +x
  // (0 to 1), pushed `grow` metres outward.
  point(s, t, grow, out) {
    const ang = t * Math.PI * 2 - Math.PI / 2;
    const c = Math.cos(ang), sn = Math.sin(ang), e = 2 / this.n;
    const px = Math.sign(c) * Math.pow(Math.abs(c), e);
    const py = Math.sign(sn) * Math.pow(Math.abs(sn), e);
    out[0] = s.xc + px * (Loft.reach(s, py) + grow);
    out[1] = (s.y0 + s.y1) / 2 + py * ((s.y1 - s.y0) / 2 + grow);
    return out;
  }

  // The panel as a mesh. For a skin laid over it, `grow` pushes it outward and
  // `keep(x, y, z)` limits it to part of the surface; a skin has no end caps.
  geometry(grow = 0, keep = null) {
    const { st, seg } = this;
    const pos = [], idx = [], on = [];
    const p = [0, 0];
    for (const s of st) {
      for (let k = 0; k < seg; k++) {
        this.point(s, k / seg, grow, p);
        pos.push(p[0], p[1], s.z);
        on.push(!keep || keep(p[0], p[1], s.z));
      }
    }
    for (let r = 0; r < st.length - 1; r++) {
      for (let k = 0; k < seg; k++) {
        const a = r * seg + k, b = r * seg + ((k + 1) % seg), c = a + seg, d = b + seg;
        if (on[a] && on[b] && on[c] && on[d]) idx.push(a, b, c, b, d, c);
      }
    }
    if (!keep) {
      // End caps, on vertices of their own so the edge stays crisp.
      for (const [r, front] of [[0, false], [st.length - 1, true]]) {
        const s = st[r];
        const base = pos.length / 3;
        pos.push(s.xc, (s.y0 + s.y1) / 2, s.z);
        for (let k = 0; k < seg; k++) {
          const v = (r * seg + k) * 3;
          pos.push(pos[v], pos[v + 1], s.z);
        }
        for (let k = 0; k < seg; k++) {
          const i = base + 1 + k, j = base + 1 + ((k + 1) % seg);
          if (front) idx.push(base, i, j); else idx.push(base, j, i);
        }
      }
    }
    return meshFrom(pos, idx);
  }
}

// A BufferGeometry from raw arrays, with the uv the boxes carry, so that it
// merges with them into one mesh per material.
function meshFrom(pos, idx) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((pos.length / 3) * 2), 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// Piecewise linear through [[u, v], ...], held level past either end. A bare
// number is a constant.
function curve(k, u) {
  if (typeof k === 'number') return k;
  if (u <= k[0][0]) return k[0][1];
  for (let i = 1; i < k.length; i++) {
    if (u <= k[i][0]) {
      const [u0, v0] = k[i - 1], [u1, v1] = k[i];
      return v0 + (v1 - v0) * ((u - u0) / (u1 - u0 || 1));
    }
  }
  return k[k.length - 1][1];
}

// ---------------------------------------------------------------------------
// The real cars' shapes.
//
// Along the car, `u` runs from the rear bumper (0) to the front bumper (1).
// Heights are metres above the ground and widths are HALF widths, in metres,
// taken from each car's published dimensions and its profile; the physics
// chassis in cars.js carries the matching length, width, height, wheelbase
// and overhangs, so the wheels land in the arches.
//
//   hull     the body up to the waist: bumpers, wings, doors, bonnet, deck
//   fenders  wings standing proud of the bonnet, one each side (xc, mirrored)
//   extras   anything else lofted: bulges, domes, buttresses
//   cabin    the glasshouse, in glass; `roof` lays a painted panel over it
//   lights   where the lamps sit; the lens goes on whatever surface is there
//   mounts   where a roundel, a mirror, a roof item and a spoiler go
//   eye      where the driver's eye is, for the cockpit camera
//   details  grilles, intakes, exhausts and trim, placed on the surface
//
// Wheel openings are not drawn: every panel that reaches over a wheel has its
// underside lifted clear of the tyre -- steered to full lock at the front --
// automatically, so the arches always fit the wheels the physics has.
// ---------------------------------------------------------------------------

const SHAPES = {
  'porsche-911': {
    hull: {
      n: 4.5,
      top: [[0, 0.58], [0.015, 0.84], [0.05, 0.93], [0.13, 0.965], [0.22, 0.95], [0.32, 0.925],
        [0.46, 0.915], [0.62, 0.895], [0.70, 0.84], [0.79, 0.775], [0.89, 0.71], [0.955, 0.61],
        [0.985, 0.52], [1, 0.42]],
      bottom: [[0, 0.30], [0.035, 0.17], [0.12, 0.12], [0.90, 0.115], [0.97, 0.14], [1, 0.24]],
      width: [[0, 0.80], [0.04, 0.885], [0.13, 0.926], [0.25, 0.926], [0.34, 0.905], [0.46, 0.88],
        [0.60, 0.875], [0.76, 0.89], [0.88, 0.87], [0.96, 0.79], [1, 0.66]],
      // The rear haunches are wide at the wheel and narrow at the lid.
      tumble: [[0, 0.74], [0.2, 0.78], [0.35, 0.88], [0.6, 0.9], [0.8, 0.86], [1, 0.8]],
    },
    // The front wings stand above the bonnet, headlamps on their noses.
    // Each starts as nothing at the scuttle and swells out of the body, so
    // there is no end face to see.
    fenders: [{
      xc: 0.64, from: 0.60, to: 0.992, n: 4, tumble: 0.75, bottom: 0.45,
      top: [[0.60, 0.74], [0.66, 0.80], [0.72, 0.84], [0.79, 0.815], [0.88, 0.79], [0.94, 0.74],
        [0.975, 0.66], [0.992, 0.52]],
      width: [[0.60, 0.03], [0.68, 0.22], [0.74, 0.27], [0.90, 0.27], [0.992, 0.20]],
    }],
    // The fastback runs in one line from the windscreen down to the lid.
    cabin: {
      from: 0.155, to: 0.635, n: 4, tumble: 0.78, bottom: 0.84,
      top: [[0.155, 0.955], [0.21, 1.05], [0.29, 1.17], [0.37, 1.255], [0.45, 1.30], [0.51, 1.295],
        [0.555, 1.23], [0.60, 1.08], [0.635, 0.90]],
      width: [[0.155, 0.60], [0.28, 0.70], [0.45, 0.72], [0.60, 0.72], [0.635, 0.70]],
    },
    roof: { from: 0.30, to: 0.55 },
    eye: { u: 0.44, h: 1.10 },
    lights: {
      head: { x: 0.64, h: 0.71, w: 0.18, hh: 0.17 }, // near round, as a 911's are
      // Two lenses meeting in the middle make the full-width light bar.
      tail: { x: 0.385, h: 0.80, w: 0.77, hh: 0.045 },
    },
    mounts: {
      flank: { u: 0.47, h: 0.55, r: 0.17 },
      mirror: { u: 0.605, h: 0.93, mat: 'primary' },
      roof: [0.33, 0.52],
      spoiler: 0.06,
    },
    details: ({ m, onFront, onRear, onTop }) => {
      // Three intakes across the front bumper.
      onFront(0.46, 0.10, 0.03, m.grille, 0, 0.27, 0.83);
      onFront(0.30, 0.12, 0.03, m.grille, 0.58, 0.29, 0.83);
      // The black diffuser and the two exhaust tips.
      onRear(1.10, 0.10, 0.03, m.grille, 0, 0.31, 0.83);
      onRear(0.15, 0.07, 0.08, m.chrome, 0.27, 0.30, 0.5);
      // The engine lid's grille, its slats running across the car.
      for (let i = 0; i < 5; i++) onTop(0, 0.07 + i * 0.015, 0.60, 0.010, 0.02, m.grille, 0.6);
    },
  },

  'mustang-gt': {
    hull: {
      n: 5,
      top: [[0, 0.60], [0.012, 0.93], [0.045, 1.015], [0.10, 1.0], [0.18, 0.995], [0.30, 0.99],
        [0.45, 0.985], [0.605, 0.975], [0.70, 0.955], [0.80, 0.93], [0.90, 0.89], [0.955, 0.85],
        [0.985, 0.79], [1, 0.66]],
      bottom: [[0, 0.32], [0.04, 0.18], [0.12, 0.15], [0.90, 0.14], [0.97, 0.17], [1, 0.26]],
      width: [[0, 0.84], [0.04, 0.92], [0.14, 0.958], [0.28, 0.958], [0.42, 0.935], [0.60, 0.93],
        [0.80, 0.945], [0.92, 0.905], [0.98, 0.83], [1, 0.76]],
      tumble: [[0, 0.8], [0.2, 0.82], [0.4, 0.9], [0.6, 0.9], [0.85, 0.86], [1, 0.84]],
    },
    // The raised power bulge down the middle of the bonnet.
    extras: [{
      xc: 0, from: 0.62, to: 0.935, n: 3, tumble: 0.8, bottom: 0.86,
      top: [[0.62, 0.99], [0.70, 1.0], [0.85, 0.955], [0.935, 0.905]],
      width: [[0.62, 0.30], [0.75, 0.36], [0.935, 0.30]],
    }],
    cabin: {
      from: 0.13, to: 0.61, n: 4, tumble: 0.78, bottom: 0.93,
      top: [[0.13, 0.99], [0.19, 1.09], [0.27, 1.23], [0.35, 1.34], [0.43, 1.40], [0.49, 1.395],
        [0.535, 1.31], [0.575, 1.16], [0.61, 0.975]],
      width: [[0.13, 0.60], [0.28, 0.72], [0.45, 0.745], [0.60, 0.73]],
    },
    roof: { from: 0.31, to: 0.52 },
    eye: { u: 0.45, h: 1.17 },
    lights: {
      head: { x: 0.66, h: 0.73, w: 0.30, hh: 0.08 },
      // The outer bar of each tri-bar set; the inner two are details.
      tail: { x: 0.66, h: 0.82, w: 0.07, hh: 0.20 },
    },
    mounts: {
      flank: { u: 0.47, h: 0.58, r: 0.18 },
      mirror: { u: 0.60, h: 1.0, mat: 'primary' },
      roof: [0.33, 0.50],
      spoiler: 0.045,
    },
    details: ({ m, onFront, onRear, onTop, skirts }) => {
      // The grille between the headlamps, the pony on it, the intake under it.
      onFront(1.00, 0.24, 0.03, m.grille, 0, 0.56, 0.83);
      onFront(0.16, 0.06, 0.03, m.chrome, 0, 0.56, 0.5);
      onFront(1.20, 0.10, 0.03, m.grille, 0, 0.30, 0.83);
      // Heat extractors either side of the bulge.
      onTop(0.25, 0.77, 0.12, 0.22, 0.02, m.grille, 0.6);
      // The inner two bars of each tri-bar tail lamp, and the black panel between.
      for (const x of [0.555, 0.45]) onRear(0.07, 0.20, LENS_DEPTH, m.tail, x, 0.82, 0.5);
      onRear(0.62, 0.15, 0.03, m.trim, 0, 0.83, 0.83);
      // Diffuser and four exhaust tips.
      onRear(1.16, 0.10, 0.03, m.grille, 0, 0.31, 0.83);
      for (const x of [0.36, 0.48]) onRear(0.10, 0.07, 0.08, m.chrome, x, 0.30, 0.5);
      skirts(m.secondary);
    },
  },

  'chevelle-ss': {
    hull: {
      n: 7, // slab sided: 1969 was a box with its corners rounded off
      top: [[0, 0.56], [0.01, 0.93], [0.04, 0.985], [0.12, 0.99], [0.21, 0.985], [0.28, 1.0],
        [0.34, 0.985], [0.42, 0.955], [0.60, 0.965], [0.66, 0.975], [0.80, 0.97], [0.93, 0.955],
        [0.985, 0.94], [1, 0.87]],
      bottom: [[0, 0.33], [0.03, 0.24], [0.10, 0.20], [0.90, 0.19], [0.975, 0.23], [1, 0.30]],
      width: [[0, 0.93], [0.04, 0.955], [0.22, 0.965], [0.42, 0.952], [0.70, 0.96], [0.95, 0.96], [1, 0.935]],
      tumble: [[0, 0.9], [0.3, 0.9], [0.5, 0.93], [1, 0.92]],
    },
    extras: [
      // The SS twin bonnet domes.
      {
        xc: 0.26, mirror: true, from: 0.655, to: 0.935, n: 4, tumble: 0.8, bottom: 0.90, width: 0.10,
        top: [[0.655, 0.99], [0.72, 1.0], [0.90, 0.985], [0.935, 0.965]],
      },
      // The flying-buttress sail panels either side of the sunken rear window.
      {
        xc: 0.625, mirror: true, from: 0.20, to: 0.345, n: 4, tumble: 0.9, bottom: 0.92, width: 0.12,
        top: [[0.20, 0.99], [0.26, 1.13], [0.32, 1.27], [0.345, 1.30]],
      },
    ],
    cabin: {
      from: 0.23, to: 0.625, n: 5, tumble: 0.80, bottom: 0.92,
      top: [[0.23, 0.99], [0.28, 1.15], [0.33, 1.28], [0.37, 1.335], [0.49, 1.34], [0.535, 1.30],
        [0.58, 1.14], [0.625, 0.965]],
      width: [[0.23, 0.70], [0.34, 0.755], [0.50, 0.76], [0.62, 0.75]],
    },
    roof: { from: 0.34, to: 0.535 },
    eye: { u: 0.44, h: 1.12 },
    lights: {
      // The outer pair of the four round headlamps.
      head: { x: 0.71, h: 0.68, w: 0.17, hh: 0.17 },
      // Set into the rear bumper; details moves them onto it.
      tail: { x: 0.60, h: 0.43, w: 0.36, hh: 0.055 },
    },
    mounts: {
      flank: { u: 0.46, h: 0.62, r: 0.18 },
      mirror: { u: 0.605, h: 1.00, mat: 'chrome' },
      roof: [0.37, 0.52],
      spoiler: 0.05,
    },
    details: ({ m, parts, lights, onFront, surfFront, surfRear, Y, skirts }) => {
      // The grille, recessed, with a bright bar under it and the SS badge.
      onFront(1.62, 0.27, 0.03, m.grille, 0, 0.67, 0.83);
      onFront(1.62, 0.028, 0.03, m.chrome, 0, 0.545, 0.55);
      onFront(0.12, 0.045, 0.03, m.badge, 0, 0.67, 0.55);
      // The inner pair of the four headlamps.
      onFront(0.17, 0.17, LENS_DEPTH, m.lens, 0.50, 0.68, 0.5);
      // Chrome bumpers, standing clear of the body front and back.
      parts.add(1.90, 0.12, 0.10, m.chrome, 0, Y(0.40), surfFront(0, 0.40) + 0.03);
      const rear = surfRear(0, 0.43) - 0.03;
      parts.add(1.90, 0.13, 0.10, m.chrome, 0, Y(0.43), rear);
      // The tail lamps sit IN the rear bumper, as they did on a '69.
      lights.tail.z = rear - 0.05;
      // Bright rocker moulding between the wheels.
      skirts(m.chrome, 0.24, 0.035, 0.03);
    },
  },

  'ferrari-enzo': {
    hull: {
      n: 4,
      top: [[0, 0.60], [0.015, 0.86], [0.045, 0.945], [0.10, 0.93], [0.20, 0.915], [0.30, 0.88],
        [0.40, 0.83], [0.52, 0.76], [0.64, 0.66], [0.74, 0.60], [0.84, 0.54], [0.93, 0.46],
        [0.975, 0.40], [1, 0.33]],
      bottom: [[0, 0.28], [0.04, 0.12], [0.90, 0.10], [0.97, 0.12], [1, 0.16]],
      // Narrow between the front wheels: the Formula One nose, with the wings
      // as separate pods either side of it.
      width: [[0, 0.86], [0.05, 0.97], [0.16, 1.017], [0.30, 1.0], [0.44, 0.96], [0.56, 0.90],
        [0.62, 0.78], [0.655, 0.46], [0.85, 0.44], [0.95, 0.38], [1, 0.30]],
      tumble: [[0, 0.72], [0.2, 0.74], [0.4, 0.82], [0.6, 0.85], [1, 0.8]],
    },
    fenders: [
      // The front wing pods, swelling out of the doors into their own noses.
      {
        xc: 0.765, from: 0.52, to: 0.995, n: 4, tumble: 0.7,
        top: [[0.52, 0.58], [0.60, 0.74], [0.66, 0.80], [0.76, 0.79], [0.86, 0.745], [0.93, 0.66],
          [0.975, 0.54], [0.995, 0.42]],
        bottom: [[0.52, 0.42], [0.995, 0.22]],
        width: [[0.52, 0.03], [0.62, 0.22], [0.66, 0.255], [0.90, 0.24], [0.995, 0.16]],
      },
      // The rear haunches over the rear wheels, running forward into the doors.
      {
        xc: 0.79, from: 0.02, to: 0.46, n: 4, tumble: 0.7, bottom: 0.35,
        top: [[0.02, 0.80], [0.07, 0.92], [0.18, 0.975], [0.30, 0.935], [0.40, 0.84], [0.46, 0.68]],
        width: [[0.02, 0.17], [0.1, 0.225], [0.3, 0.225], [0.40, 0.17], [0.46, 0.03]],
      },
    ],
    // The canopy: a bubble sitting on the tub.
    cabin: {
      from: 0.30, to: 0.705, n: 3.4, tumble: 0.7,
      top: [[0.30, 0.86], [0.35, 0.99], [0.42, 1.10], [0.50, 1.147], [0.565, 1.12], [0.62, 1.0],
        [0.67, 0.84], [0.705, 0.70]],
      bottom: [[0.30, 0.80], [0.52, 0.70], [0.64, 0.60], [0.705, 0.55]],
      width: [[0.30, 0.52], [0.42, 0.66], [0.56, 0.67], [0.66, 0.62], [0.705, 0.55]],
    },
    roof: { from: 0.44, to: 0.575 },
    eye: { u: 0.52, h: 0.96 },
    lights: {
      head: { x: 0.77, h: 0.60, w: 0.18, hh: 0.07 },
      // The outer pair of the four round tail lamps.
      tail: { x: 0.64, h: 0.80, w: 0.12, hh: 0.12 },
    },
    mounts: {
      // Low on the door, where the side is upright, between the intake and
      // where the wing pod starts.
      flank: { u: 0.485, h: 0.44, r: 0.16 },
      mirror: { u: 0.63, h: 0.90, mat: 'primary' },
      roof: [0.46, 0.56],
      spoiler: 0.05,
    },
    details: ({ m, onFront, onRear, onSide, onTop, skirts }) => {
      // A splitter under the nose and the two nostrils in it.
      onFront(0.90, 0.04, 0.10, m.grille, 0, 0.17, 0.6);
      onTop(0.16, 0.925, 0.12, 0.16, 0.02, m.grille, 0.6);
      // The big intakes behind the doors.
      onSide(0.405, 0.50, 0.34, 0.26, 0.04, m.grille, 0.8);
      // The inner pair of tail lamps, the mesh across the tail and the exhausts in it.
      onRear(0.12, 0.12, LENS_DEPTH, m.tail, 0.42, 0.80, 0.5);
      onRear(1.40, 0.20, 0.03, m.grille, 0, 0.60, 0.83);
      onRear(0.14, 0.09, 0.08, m.chrome, 0.10, 0.52, 0.5);
      skirts(m.secondary);
    },
  },

  'lamborghini-huracan': {
    hull: {
      n: 3.6, // a wedge, and a creased one: the lowest exponent here
      // The bonnet runs the full width, just clear of the tyres' crowns, with
      // the wings rising only a little above it.
      top: [[0, 0.62], [0.015, 0.87], [0.045, 0.935], [0.12, 0.935], [0.22, 0.92], [0.34, 0.88],
        [0.46, 0.83], [0.56, 0.80], [0.64, 0.79], [0.72, 0.775], [0.77, 0.767], [0.82, 0.745],
        [0.90, 0.67], [0.96, 0.54], [1, 0.38]],
      bottom: [[0, 0.28], [0.04, 0.12], [0.90, 0.10], [0.97, 0.12], [1, 0.15]],
      width: [[0, 0.87], [0.05, 0.94], [0.15, 0.966], [0.30, 0.966], [0.44, 0.935], [0.62, 0.93],
        [0.76, 0.955], [0.90, 0.92], [0.97, 0.83], [1, 0.70]],
      tumble: [[0, 0.74], [0.2, 0.76], [0.4, 0.84], [0.6, 0.86], [0.9, 0.84], [1, 0.8]],
    },
    fenders: [{
      xc: 0.70, from: 0.56, to: 0.99, n: 3.6, tumble: 0.72,
      top: [[0.56, 0.70], [0.64, 0.78], [0.70, 0.795], [0.78, 0.79], [0.87, 0.73], [0.94, 0.62], [0.99, 0.46]],
      bottom: [[0.56, 0.45], [0.99, 0.22]],
      width: [[0.56, 0.03], [0.64, 0.20], [0.70, 0.265], [0.92, 0.255], [0.99, 0.18]],
    }],
    // One arc from the windscreen to the tail, glass over the engine.
    cabin: {
      from: 0.15, to: 0.665, n: 3.4, tumble: 0.7,
      top: [[0.15, 0.92], [0.22, 1.01], [0.30, 1.08], [0.40, 1.14], [0.49, 1.165], [0.55, 1.14],
        [0.60, 1.05], [0.635, 0.93], [0.665, 0.77]],
      bottom: [[0.15, 0.85], [0.40, 0.80], [0.56, 0.74], [0.665, 0.66]],
      width: [[0.15, 0.50], [0.28, 0.63], [0.45, 0.68], [0.60, 0.66], [0.665, 0.60]],
    },
    roof: { from: 0.40, to: 0.56 },
    eye: { u: 0.50, h: 0.98 },
    lights: {
      head: { x: 0.66, h: 0.59, w: 0.30, hh: 0.055 },
      tail: { x: 0.63, h: 0.83, w: 0.40, hh: 0.05 },
    },
    mounts: {
      flank: { u: 0.47, h: 0.50, r: 0.16 },
      mirror: { u: 0.61, h: 0.88, mat: 'primary' },
      roof: [0.42, 0.55],
      spoiler: 0.05,
    },
    details: ({ m, onFront, onRear, onSide, onTop, skirts }) => {
      // Intakes at the front corners and across the middle.
      onFront(0.32, 0.12, 0.03, m.grille, 0.60, 0.30, 0.83);
      onFront(0.62, 0.08, 0.03, m.grille, 0, 0.24, 0.83);
      // The side intakes ahead of the rear wheels.
      onSide(0.335, 0.56, 0.36, 0.22, 0.04, m.grille, 0.8);
      // Louvres over the engine.
      for (let i = 0; i < 6; i++) onTop(0, 0.17 + i * 0.024, 0.56, 0.012, 0.02, m.grille, 0.6);
      // The mesh across the tail and the two high exhausts in it.
      onRear(1.30, 0.26, 0.03, m.grille, 0, 0.66, 0.83);
      onRear(0.16, 0.08, 0.08, m.chrome, 0.13, 0.64, 0.5);
      skirts(m.secondary);
    },
  },

  // The second-generation Roadster, from the 2017 prototype: a smooth, low
  // 2+2 with a long curved bonnet, no grille, slim lamps and a light bar
  // across the tail. Tesla has not published its dimensions; cars.js carries
  // estimates.
  'tesla-roadster': {
    hull: {
      n: 3.6,
      top: [[0, 0.62], [0.02, 0.84], [0.06, 0.905], [0.14, 0.92], [0.24, 0.90], [0.36, 0.86],
        [0.50, 0.84], [0.60, 0.815], [0.68, 0.80], [0.76, 0.80], [0.82, 0.785], [0.88, 0.74],
        [0.94, 0.64], [0.975, 0.54], [1, 0.40]],
      bottom: [[0, 0.30], [0.04, 0.13], [0.90, 0.11], [0.97, 0.13], [1, 0.17]],
      width: [[0, 0.84], [0.05, 0.95], [0.16, 0.99], [0.28, 0.985], [0.44, 0.945], [0.60, 0.94],
        [0.74, 0.965], [0.86, 0.95], [0.94, 0.87], [0.985, 0.74], [1, 0.62]],
      tumble: [[0, 0.74], [0.2, 0.76], [0.4, 0.84], [0.6, 0.86], [0.9, 0.84], [1, 0.8]],
    },
    fenders: [
      // Front wings rising a little over the wheels, lamps on their noses.
      {
        xc: 0.70, from: 0.58, to: 0.99, n: 3.8, tumble: 0.72,
        top: [[0.58, 0.74], [0.66, 0.82], [0.74, 0.85], [0.82, 0.845], [0.90, 0.78], [0.95, 0.67], [0.99, 0.50]],
        bottom: [[0.58, 0.46], [0.99, 0.24]],
        width: [[0.58, 0.03], [0.65, 0.20], [0.72, 0.27], [0.90, 0.26], [0.99, 0.18]],
      },
      // Broad rear haunches, running forward into the doors.
      {
        xc: 0.78, from: 0.02, to: 0.46, n: 4, tumble: 0.7, bottom: 0.35,
        top: [[0.02, 0.80], [0.08, 0.93], [0.186, 0.975], [0.30, 0.94], [0.40, 0.85], [0.46, 0.70]],
        width: [[0.02, 0.16], [0.10, 0.215], [0.30, 0.215], [0.40, 0.16], [0.46, 0.03]],
      },
    ],
    // One arc from the windscreen down to a short tail; the roof is glass.
    cabin: {
      from: 0.14, to: 0.64, n: 3.4, tumble: 0.7,
      top: [[0.14, 0.90], [0.20, 0.99], [0.28, 1.07], [0.38, 1.13], [0.46, 1.15], [0.53, 1.13],
        [0.58, 1.05], [0.615, 0.93], [0.64, 0.81]],
      bottom: [[0.14, 0.86], [0.40, 0.83], [0.56, 0.80], [0.64, 0.76]],
      width: [[0.14, 0.52], [0.26, 0.64], [0.45, 0.69], [0.58, 0.67], [0.64, 0.60]],
    },
    roof: { from: 0.33, to: 0.54 },
    eye: { u: 0.47, h: 0.99 },
    lights: {
      head: { x: 0.68, h: 0.64, w: 0.26, hh: 0.045 }, // slim, swept into the wings
      // Two lenses meeting in the middle: the light bar across the tail.
      tail: { x: 0.40, h: 0.85, w: 0.80, hh: 0.035 },
    },
    mounts: {
      flank: { u: 0.47, h: 0.50, r: 0.16 },
      mirror: { u: 0.61, h: 0.89, mat: 'primary' },
      roof: [0.36, 0.52],
      spoiler: 0.05,
    },
    details: ({ m, onFront, onRear, onSide, skirts }) => {
      // No grille: nothing at the nose needs air but a slot under it and the
      // two corner intakes.
      onFront(0.80, 0.06, 0.03, m.grille, 0, 0.25, 0.83);
      onFront(0.22, 0.10, 0.03, m.grille, 0.62, 0.28, 0.83);
      // A small intake ahead of each rear wheel, and the diffuser. No exhausts.
      onSide(0.33, 0.52, 0.30, 0.14, 0.04, m.grille, 0.8);
      onRear(1.30, 0.12, 0.03, m.grille, 0, 0.30, 0.83);
      skirts(m.secondary);
    },
  },
};

// The cockpit camera's eye point for a car, relative to its root, or null for
// a car without a lofted shape (the camera then works it out from the body box).
export function cockpitEye(chassis) {
  const shape = SHAPES[chassis.id];
  if (!shape) return null;
  const ground = bodyLift(chassis) - chassis.rideHeight;
  return {
    y: ground + shape.eye.h,
    z: bodyCenter(chassis) + (shape.eye.u - 0.5) * chassis.bodyLength,
  };
}

// Wheel styles. Every one is the same two meshes -- everything dark, and
// everything light -- so a wheel costs two draw calls whatever it looks like.
// The light rim always PROTRUDES past the sidewall: a rim tucked inside the
// tyre is sealed in and never drawn, which is how these rendered as plain
// black discs for a whole milestone.
const WHEEL_LOOKS = {
  blocky:    { segs: 10, rim: 0.60, hub: 0.26, dish: 0.56, gaps: 0,  tread: 0 },
  fivespoke: { segs: WHEEL_SEGMENTS, rim: 0.66, hub: 0.24, dish: 0.56, gaps: 5,  tread: 0 },
  deepdish:  { segs: WHEEL_SEGMENTS, rim: 0.78, hub: 0.20, dish: 0.72, gaps: 8,  tread: 0 },
  knobby:    { segs: 18, rim: 0.55, hub: 0.26, dish: 0.52, gaps: 5,  tread: 12 },
};

function buildWheel(radius, width, config) {
  const look = WHEEL_LOOKS[config.wheelStyle] ?? WHEEL_LOOKS.fivespoke;
  const g = new THREE.Group();

  const dark = glossy(config.wheel, { shininess: 14, specular: 0x24242a });
  const light = glossy(config.hub, { shininess: 95, specular: 0x9a9aa4 });

  const halfW = width * 0.5;
  const rimR = radius * look.rim;
  const hubR = radius * look.hub;
  const rimHalf = width * look.dish;   // past the sidewall, so the face shows
  const gapHalf = rimHalf + width * 0.04;

  // A tyre, not a cylinder: a flat tread band with the sidewalls drawn in.
  const tyre = [
    new THREE.CylinderGeometry(radius, radius, width * 0.70, look.segs),
    new THREE.CylinderGeometry(radius * 0.90, radius, width * 0.15, look.segs),
    new THREE.CylinderGeometry(radius, radius * 0.90, width * 0.15, look.segs),
  ];
  tyre[1].translate(0, halfW - width * 0.075, 0);
  tyre[2].translate(0, -halfW + width * 0.075, 0);

  // Knobby: blocks standing proud of the tread, in two staggered rows.
  for (let i = 0; i < look.tread; i++) {
    for (const row of [1, -1]) {
      const block = new THREE.BoxGeometry(radius * 0.16, width * 0.30, radius * 0.14);
      block.translate(0, row * width * 0.20, radius * 1.01);
      block.rotateY(((i + (row > 0 ? 0 : 0.5)) / look.tread) * Math.PI * 2);
      tyre.push(block);
    }
  }

  // Spoke gaps: dark bars laid across each rim face. N bars leave N spokes,
  // and what reads as a spoke is the light metal showing between them.
  for (let i = 0; i < look.gaps; i++) {
    for (const side of [1, -1]) {
      const bar = new THREE.BoxGeometry(rimR - hubR * 0.6, width * 0.06, radius * 0.16);
      bar.translate(hubR * 0.6 + (rimR - hubR * 0.6) * 0.5, 0, 0);
      bar.rotateY((i / look.gaps) * Math.PI * 2);
      bar.translate(0, side * gapHalf, 0);
      tyre.push(bar);
    }
  }

  const tyreGeo = mergeGeometries(tyre, false);
  tyre.forEach((x) => x.dispose());
  tyreGeo.rotateZ(Math.PI / 2);
  const tyreMesh = new THREE.Mesh(tyreGeo, dark);
  tyreMesh.castShadow = true;
  g.add(tyreMesh);

  const rim = [
    new THREE.CylinderGeometry(rimR, rimR, rimHalf * 2, look.segs),
    new THREE.CylinderGeometry(hubR, hubR, gapHalf * 2 + width * 0.10, look.segs),
  ];
  const rimGeo = mergeGeometries(rim, false);
  rim.forEach((x) => x.dispose());
  rimGeo.rotateZ(Math.PI / 2);
  g.add(new THREE.Mesh(rimGeo, light));

  // Both parts live in this group, so Vehicle.js spins them together.
  return g;
}


// ---------------------------------------------------------------------------
// Cosmetics. None of this touches handling -- chassis is the only thing that
// changes how a car drives, so everything below is geometry and colour.
//
// Two shapes are passed in from the body that built the car:
//
//   `skin`  the painted panels, for livery. On the open-wheeler they are
//           { hw, y0, y1, z0, z1 } boxes and livery is thin slabs laid on them;
//           on a lofted car they are the painted Lofts themselves and livery is
//           a skin grown over the curved surface -- see addLoftLivery.
//   `mount` where a spoiler, a roof item, a mirror and a roundel bolt on. Each
//           body knows its own roof line; nothing here guesses at one, which
//           is how parts end up floating.
// ---------------------------------------------------------------------------

function addLivery(parts, id, mat, skin, L, W) {
  if (id === 'none' || !skin.length) return;

  // Panels overlap -- an open-wheeler's nose runs back inside its tub -- and a
  // slab drawn on the smaller of two overlapping panels can end up entirely
  // inside the larger one, where it is never drawn and costs triangles for
  // nothing. Where that happens the bigger panel's own slab already covers the
  // area in the same colour, so the small one is simply dropped.
  const buried = (hw, y0, y1, z0, z1, self) => skin.some((o) => o !== self &&
    hw <= o.hw + SKIN && y0 >= o.y0 - SKIN && y1 <= o.y1 + SKIN &&
    z0 >= o.z0 - SKIN && z1 <= o.z1 + SKIN);

  // A slab wrapping a panel between two z planes: the panel's own width and
  // height plus the skin thickness, so it reads as paint over the shape
  // instead of a box bolted to it.
  // A cut that lands on the panel's own end is pushed past it, or the two
  // rear faces are coplanar and the tail of the car shimmers.
  const past = (v, edge, sign) => (Math.abs(v - edge) < 1e-6 ? v + sign * SKIN : v);

  const shell = (b, from, to, y0 = b.y0, y1 = b.y1) => {
    let lo = Math.max(b.z0, from), hi = Math.min(b.z1, to);
    if (hi - lo < 0.02 || y1 - y0 < 0.01) return;
    if (buried(b.hw + SKIN, y0 - SKIN * 0.5, y1 + SKIN * 0.5, lo, hi, b)) return;
    lo = past(lo, b.z0, -1);
    hi = past(hi, b.z1, 1);
    parts.addFlat((b.hw + SKIN) * 2, (y1 - y0) + SKIN, hi - lo, mat,
      0, (y0 + y1) * 0.5, (lo + hi) * 0.5);
  };

  for (const b of skin) {
    switch (id) {
      case 'stripes': {
        // Two stripes over the top, centred, in the classic pair.
        const half = W * 0.042;
        if (b.hw < W * 0.075 + half) break;
        if (buried(W * 0.075 + half, b.y1 - SKIN, b.y1 + SKIN, b.z0, b.z1, b)) break;
        for (const sx of [1, -1]) {
          parts.addFlat(half * 2, SKIN * 2, b.z1 - b.z0 + SKIN * 2, mat,
            sx * W * 0.075, b.y1, (b.z0 + b.z1) * 0.5);
        }
        break;
      }
      case 'split':
        shell(b, -Infinity, 0);
        break;
      case 'quarters':
        shell(b, -Infinity, -L * 0.16);
        shell(b, L * 0.28, Infinity);
        break;
      case 'checker': {
        // Eight slices along the car, alternating top and bottom half, which
        // is a real two row checker rather than a set of bands.
        const N = 8;
        const mid = (b.y0 + b.y1) * 0.5;
        for (let i = 0; i < N; i++) {
          const from = -L * 0.5 + (L * i) / N;
          const to = -L * 0.5 + (L * (i + 1)) / N;
          if (i % 2 === 0) shell(b, from, to, mid, b.y1);
          else shell(b, from, to, b.y0, mid);
        }
        break;
      }
      default:
        break;
    }
  }
}

// Livery on a lofted car: paint laid over the curved panels rather than slabs
// bolted onto boxes. `painted` are the Lofts wearing the primary colour,
// `zc` the middle of the body along z, `topAt(x, z)` the highest painted
// surface there.
function addLoftLivery(parts, id, mat, painted, L, W, zc, topAt) {
  if (id === 'none' || !painted.length) return;
  if (id === 'stripes') {
    // Two stripes nose to tail, following the painted surface over the
    // bonnet, roof and deck -- and under the glass, where they cannot be seen.
    const half = W * 0.042;
    for (const sx of [1, -1]) {
      const x0 = sx > 0 ? W * 0.075 - half : -W * 0.075 - half;
      const x1 = x0 + half * 2;
      const pos = [], idx = [];
      let prev = -1;
      for (let z = zc - L * 0.5; z <= zc + L * 0.5 + 1e-6; z += 0.04) {
        const ya = topAt(x0, z), yb = topAt(x1, z);
        if (ya === null || yb === null) { prev = -1; continue; }
        const base = pos.length / 3;
        pos.push(x0, ya + SKIN, z, x1, yb + SKIN, z);
        if (prev >= 0) idx.push(prev, base, prev + 1, prev + 1, base, base + 1);
        prev = base;
      }
      if (idx.length) parts.push(meshFrom(pos, idx), mat);
    }
    return;
  }
  const z0 = zc - L * 0.5;
  for (const loft of painted) {
    let keep;
    if (id === 'split') keep = (x, y, z) => z < zc;
    else if (id === 'quarters') keep = (x, y, z) => z < zc - L * 0.16 || z > zc + L * 0.28;
    else if (id === 'checker') {
      keep = (x, y, z) => {
        const i = Math.floor(((z - z0) / L) * 8);
        const s = loft.at(z);
        if (!s) return false;
        const mid = (s.y0 + s.y1) * 0.5;
        return i % 2 === 0 ? y >= mid : y < mid;
      };
    } else return;
    const g = loft.geometry(SKIN, keep);
    if (g.index.count) parts.push(g, mat);
  }
}

function addSpoiler(parts, id, mat, m, L, H) {
  if (id === 'none' || !m) return;
  const hw = m.hw;
  switch (id) {
    case 'lip':
      parts.addFlat(hw * 1.94, H * 0.045, L * 0.05, mat, 0, m.y + H * 0.012, m.z + L * 0.018);
      break;
    case 'ducktail':
      parts.addFlat(hw * 1.94, H * 0.05, L * 0.09, mat, 0, m.y + H * 0.012, m.z + L * 0.040);
      parts.addFlat(hw * 1.90, H * 0.10, L * 0.035, mat, 0, m.y + H * 0.070, m.z + L * 0.010);
      break;
    case 'wing': {
      // Two uprights and a blade with endplates, sitting clear of the body.
      const top = m.y + H * 0.26;
      for (const sx of [1, -1]) {
        parts.addFlat(H * 0.05, H * 0.28, L * 0.045, mat,
          sx * hw * 0.68, m.y + H * 0.13, m.z + L * 0.03);
        parts.addFlat(H * 0.045, H * 0.16, L * 0.10, mat,
          sx * (hw * 0.98 - H * 0.022), top - H * 0.045, m.z + L * 0.03);
      }
      parts.addFlat(hw * 1.96, H * 0.05, L * 0.10, mat, 0, top, m.z + L * 0.03);
      break;
    }
    default:
      break;
  }
}

function addRoofItem(parts, id, mats, m, chassis, H) {
  if (id === 'none' || !m) return;
  const { body: mat, lens, trim } = mats;
  const hw = m.hw;
  const len = m.z1 - m.z0;
  switch (id) {
    case 'lightbar': {
      const z = m.z0 + len * 0.72;
      parts.addFlat(hw * 1.7, H * 0.05, len * 0.11, mat, 0, m.y + H * 0.035, z);
      for (let i = -1.5; i <= 1.5; i++) {
        parts.addFlat(hw * 0.30, H * 0.045, len * 0.09, lens,
          i * hw * 0.42, m.y + H * 0.045, z);
      }
      break;
    }
    case 'box':
      // Bevelled, because at this size the rounding reads.
      parts.add(hw * 1.5, H * 0.17, len * 0.62, mat, 0, m.y + H * 0.075, m.z0 + len * 0.45);
      break;
    case 'spare': {
      // A wheel laid flat: tyre band plus a hub disc, axis vertical.
      const r = Math.min(chassis.wheelRadius, hw * 0.85);
      const t = r * 0.62;
      const tyre = new THREE.CylinderGeometry(r, r, t, 20);
      tyre.translate(0, m.y + t * 0.42, m.z0 + len * 0.42);
      parts.push(tyre, mat);
      const hub = new THREE.CylinderGeometry(r * 0.42, r * 0.42, t * 1.15, 16);
      hub.translate(0, m.y + t * 0.42, m.z0 + len * 0.42);
      parts.push(hub, trim);
      break;
    }
    default:
      break;
  }
}

// Digits are built out of seven segment bars, because there are no textures
// anywhere in this game and a number has to come from somewhere. Blocky bars
// happen to be exactly right for the art direction.
const SEVEN_SEGMENT = {
  '0': 'abcdef', '1': 'bc', '2': 'abged', '3': 'abgcd', '4': 'fgbc',
  '5': 'afgcd', '6': 'afgecd', '7': 'abc', '8': 'abcdefg', '9': 'abcfgd',
};

// [across, up, width, height] in a cell one wide and 1.8 tall.
const SEGMENTS = {
  a: [0.50, 1.72, 0.72, 0.16],
  b: [0.86, 1.30, 0.16, 0.68],
  c: [0.86, 0.42, 0.16, 0.68],
  d: [0.50, 0.08, 0.72, 0.16],
  e: [0.14, 0.42, 0.16, 0.68],
  f: [0.14, 1.30, 0.16, 0.68],
  g: [0.50, 0.86, 0.72, 0.16],
};

function addRoundel(parts, number, disc, ink, m, H) {
  if (number == null || !m) return;
  const text = String(Math.round(number));
  const r = m.r;

  for (const side of [1, -1]) {
    const x = side * (m.hw + SKIN);
    const face = new THREE.CylinderGeometry(r, r, SKIN * 2, 22);
    face.rotateZ(Math.PI / 2);
    face.translate(x, m.y, m.z);
    parts.push(face, disc);

    // Numbers read nose to tail on both flanks, so the writing direction
    // flips with the side. Getting this wrong mirrors the number on one side
    // of the car and nobody notices until they see a photo of it.
    const dir = -side;
    // The cell is 1 across by 1.8 up, so one scale covers both axes. Sized so
    // the digits' corners stay inside the disc: for two digits the block is
    // 1.22r by 1.05r, whose corner sits at 0.81r. Longer numbers shrink until
    // their block's corner sits at 0.82r.
    const n = text.length;
    const k = n === 1 ? (r * 1.35) / 1.8
      : n === 2 ? (r * 1.05) / 1.8
      : (r * 0.82) / Math.hypot(n / 2, 0.9);
    const totalW = k * text.length;

    for (let i = 0; i < text.length; i++) {
      const segs = SEVEN_SEGMENT[text[i]];
      if (!segs) continue;
      const u0 = -totalW * 0.5 + k * i;
      for (const key of segs) {
        const [su, sv, sw, sh] = SEGMENTS[key];
        // Thin in x, because the roundel is painted on a flank: the segment's
        // width runs along z and its height along y.
        parts.addFlat(SKIN * 2, sh * k, sw * k, ink,
          x + side * SKIN, m.y + (sv - 0.9) * k, m.z + dir * (u0 + su * k));
      }
    }
  }
}

// ---------------------------------------------------------------------------
// A lofted car's body: the panels, the wheel openings in them, the lamps,
// the mounts and the details, all from its SHAPES entry.
// ---------------------------------------------------------------------------
function buildLoftedBody(parts, chassis, shape, env) {
  const { L, W, H, lift, mats, lights, mount } = env;
  const R = chassis.wheelRadius;
  const ground = lift - chassis.rideHeight;
  const zc = bodyCenter(chassis);
  const Z = (u) => zc + (u - 0.5) * L;
  const Y = (h) => ground + h;
  const U = (z) => (z - zc) / L + 0.5;

  // --- wheel openings ---------------------------------------------------------
  // Over each axle every panel that reaches the wheel gets its underside lifted
  // clear of it: round over the tyre with 5 cm to spare, and flat across at
  // the arch line for as far as a front wheel sweeps at full lock, which is
  // the part a steered tyre would otherwise cut through.
  const halfTrack = chassis.trackWidth * 0.5;
  const wheelY = Y(R);
  const axles = [
    { z: env.aFront, xLo: halfTrack - env.sweptX, xHi: halfTrack + env.sweptX, shoulder: env.sweptZ + 0.04 },
    { z: -env.bRear, xLo: env.wheelInner, xHi: env.wheelOuter, shoulder: R + 0.02 },
  ];
  const archR = R + 0.05;
  const archUnder = (z, xLo, xHi) => {
    let y = -Infinity;
    for (const a of axles) {
      if (xHi < a.xLo - 0.02 || xLo > a.xHi + 0.02) continue;
      const dz = Math.abs(z - a.z);
      if (dz < archR) y = Math.max(y, wheelY + Math.sqrt(archR * archR - dz * dz));
      if (dz <= a.shoulder) y = Math.max(y, env.archY + 0.012);
    }
    return y;
  };
  // Stations at the arches' own edges and round their curve, as well as
  // evenly along the panel, so the openings are drawn exactly.
  const archU = [];
  for (const a of axles) {
    const ua = U(a.z);
    for (const dz of [a.shoulder, a.shoulder + 0.002]) archU.push(ua - dz / L, ua + dz / L);
    for (let i = 0; i <= 10; i++) {
      const dz = archR * Math.sin((i / 10) * Math.PI * 0.5);
      archU.push(ua - dz / L, ua + dz / L);
    }
  }

  const makeLoft = (p, side = 1) => {
    const N = p.stations ?? Math.max(16, Math.round((p.to - p.from) * 72));
    const us = [];
    for (let i = 0; i <= N; i++) us.push(p.from + ((p.to - p.from) * i) / N);
    if (p.arches !== false) for (const u of archU) if (u > p.from && u < p.to) us.push(u);
    us.sort((a, b) => a - b);
    const st = [];
    for (const u of us) {
      if (st.length && u - st[st.length - 1].u < 1e-5) continue;
      const z = Z(u);
      const hw = curve(p.width, u);
      const xc = side * curve(p.xc ?? 0, u);
      let y0 = Y(curve(p.bottom, u));
      const y1 = Y(curve(p.top, u));
      if (p.arches !== false) {
        const arch = archUnder(z, Math.max(0, Math.abs(xc) - hw), Math.abs(xc) + hw);
        if (arch > y0) y0 = arch;
      }
      // A panel whose top is under the arch's crown is a sliver there, not a
      // hole: it still ends at its own top line.
      if (y0 > y1 - 0.015) y0 = y1 - 0.015;
      st.push({ u, z, y0, y1, hw, xc, top: curve(p.tumble ?? 1, u) });
    }
    return new Loft(st, p.n ?? 4, p.seg ?? 40);
  };

  const hull = makeLoft({ ...shape.hull, from: 0, to: 1, seg: 48 });
  const painted = [hull];
  for (const f of shape.fenders ?? []) painted.push(makeLoft(f, 1), makeLoft(f, -1));
  for (const e of shape.extras ?? []) {
    painted.push(makeLoft({ ...e, arches: e.arches ?? false }, 1));
    if (e.mirror) painted.push(makeLoft({ ...e, arches: e.arches ?? false }, -1));
  }
  const cabin = makeLoft({ ...shape.cabin, arches: false });

  // The roof: a painted panel laid over the top of the glass, a little proud
  // of it and inset from its edges, so the glass reads as windows all round.
  const rs = [];
  for (let i = 0; i <= 24; i++) {
    const u = shape.roof.from + ((shape.roof.to - shape.roof.from) * i) / 24;
    const s = cabin.at(Z(u));
    rs.push({ u, z: Z(u), y0: s.y1 - 0.05, y1: s.y1 + 0.014, hw: s.hw * s.top * 0.97, xc: 0, top: 0.85 });
  }
  const roof = new Loft(rs, 4, 32);
  painted.push(roof);

  for (const l of painted) parts.push(l.geometry(), mats.primary);
  parts.push(cabin.geometry(), mats.glass);

  // --- finding the surface ----------------------------------------------------
  const solids = [...painted, cabin];
  const inside = (x, y, z) => {
    for (const l of solids) if (l.contains(x, y, z)) return true;
    return false;
  };
  // March from `from` toward `to` in centimetre steps until `probe` is true,
  // then close in on the crossing. Null if it never is.
  const march = (from, to, probe) => {
    const dir = Math.sign(to - from), n = Math.ceil(Math.abs(to - from) / 0.01);
    let prev = from;
    for (let i = 1; i <= n; i++) {
      const v = from + dir * i * 0.01;
      if (probe(v)) {
        let a = prev, b = v;
        for (let j = 0; j < 7; j++) {
          const mid = (a + b) / 2;
          if (probe(mid)) b = mid; else a = mid;
        }
        return b;
      }
      prev = v;
    }
    return null;
  };
  const surfFront = (x, h) => march(Z(1) + 0.05, Z(0), (z) => inside(x, Y(h), z)) ?? Z(1);
  const surfRear = (x, h) => march(Z(0) - 0.05, Z(1), (z) => inside(x, Y(h), z)) ?? Z(0);
  const surfSide = (u, h) => march(W * 0.5 + 0.1, 0, (x) => inside(x, Y(h), Z(u))) ?? W * 0.5;
  const surfTop = (x, u) => march(Y(H + 0.2), Y(0), (y) => inside(x, y, Z(u))) ?? Y(H);
  const paintTop = (x, z) => march(Y(H + 0.2), Y(0), (y) => painted.some((l) => l.contains(x, y, z)));

  // Boxes set into the surface, `sink` of their depth inside it: a lamp is
  // half in, a grille or an intake is nearly flush. A nonzero x is a pair.
  const pairs = (x) => (x ? [x, -x] : [0]);
  const onFront = (w, hh, d, mat, x, h, sink = 0.5) => {
    for (const px of pairs(x)) parts.add(w, hh, d, mat, px, Y(h), surfFront(px, h) + d * (0.5 - sink));
  };
  const onRear = (w, hh, d, mat, x, h, sink = 0.5) => {
    for (const px of pairs(x)) parts.add(w, hh, d, mat, px, Y(h), surfRear(px, h) - d * (0.5 - sink));
  };
  const onSide = (u, h, len, hh, t, mat, sink = 0.5) => {
    const x = surfSide(u, h) + t * (0.5 - sink);
    for (const sx of [1, -1]) parts.add(t, hh, len, mat, sx * x, Y(h), Z(u));
  };
  const onTop = (x, u, w, d, t, mat, sink = 0.5) => {
    for (const px of pairs(x)) parts.add(w, t, d, mat, px, surfTop(px, u) + t * (0.5 - sink), Z(u));
  };
  // Sills between the wheels, clear of both arches.
  const skirts = (mat, h = 0.17, hh = 0.07, t = 0.05) => {
    const from = -env.bRear + R + 0.10, to = env.aFront - env.sweptZ - 0.10;
    const n = 4, len = (to - from) / n;
    for (let i = 0; i < n; i++) onSide(U(from + (i + 0.5) * len), h, len + 0.01, hh, t, mat, 0.6);
  };

  // --- lamps, mounts and details ---------------------------------------------
  const lamp = (spec, front) => ({
    x: spec.x, w: spec.w, h: spec.hh, y: Y(spec.h),
    z: front ? surfFront(spec.x, spec.h) : surfRear(spec.x, spec.h),
  });
  lights.head = lamp(shape.lights.head, true);
  lights.tail = lamp(shape.lights.tail, false);

  const mm = shape.mounts;
  mount.flank = { hw: surfSide(mm.flank.u, mm.flank.h), y: Y(mm.flank.h), z: Z(mm.flank.u), r: mm.flank.r };
  mount.mirror = {
    hw: surfSide(mm.mirror.u, mm.mirror.h) - 0.012, y: Y(mm.mirror.h), z: Z(mm.mirror.u),
    mat: mats[mm.mirror.mat] ?? mats.secondary,
  };
  const [r0, r1] = mm.roof;
  const roofMid = roof.at(Z((r0 + r1) / 2));
  // A little below the roof's crown, so anything bolted on sits into it.
  mount.roof = { hw: roofMid.hw * 0.85, y: surfTop(0, (r0 + r1) / 2) - 0.02, z0: Z(r0), z1: Z(r1) };
  const deck = hull.at(Z(mm.spoiler));
  mount.spoiler = { hw: Loft.reach(deck, 0.8) * 0.95, y: surfTop(0, mm.spoiler) - 0.005, z: Z(mm.spoiler) };

  shape.details({
    parts, lights, m: mats, Y, Z, U,
    onFront, onRear, onSide, onTop, skirts, surfFront, surfRear, surfSide, surfTop,
  });

  return { painted, solids, zc, paintTop };
}

export function buildCar(chassis, config = {}) {
  const c = { ...DEFAULT_CONFIG, ...config };
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const parts = new PartSet();

  const L = chassis.bodyLength;
  const W = chassis.bodyWidth;
  const H = chassis.bodyHeight;
  const lift = bodyLift(chassis);

  // Wheel clearance.
  //
  // A front wheel turned to full lock sweeps far wider than its own width,
  // because the tyre's RADIUS starts pointing sideways: at 35 degrees of lock a
  // 0.33 m wheel reaches 0.30 m from the hub instead of 0.13 m. The bodywork
  // is kept out of that whole swept envelope, not just out of the wheel.
  const halfTrack = chassis.trackWidth * 0.5;
  const wheelWidth = chassis.wheelRadius * 0.78;
  // The rim face and hub cap stand proud of the tyre, so the wheel is wider
  // than its tread. Clearance is measured against the widest part of it.
  const wheelHalfW = wheelWidth * 0.66;
  const wheelInner = halfTrack - wheelHalfW;
  const wheelOuter = halfTrack + wheelHalfW;

  // Swept half-extents of a wheel turned to full lock, across and along the car.
  const lock = chassis.steerRate;
  const sweptX = wheelHalfW * Math.cos(lock) + chassis.wheelRadius * Math.sin(lock);
  const sweptZ = chassis.wheelRadius * Math.cos(lock) + wheelHalfW * Math.sin(lock);

  // Wheel centre relative to the car root, then a little above it: the arch
  // line, below which no bodywork may reach over a tyre.
  const wheelY = chassis.wheelRadius - chassis.rideHeight + lift;
  const archY = wheelY + chassis.wheelRadius * 0.30;

  const aFront = chassis.wheelbase * (1 - chassis.weightDistribution);
  const bRear = chassis.wheelbase * chassis.weightDistribution;

  // The painted panels, for livery, and the places cosmetic parts bolt on.
  // Each body fills these in: only the body knows where its own roof line is,
  // and a shared guess is how parts end up floating.
  const skin = [];
  const mount = { roof: null, spoiler: null, flank: null, mirror: null };

  // Where the light lenses sit. Each body sets these; they default to the
  // corners of the declared body box.
  const lights = {
    head: { x: W * 0.30, w: W * 0.22, h: H * 0.10, y: lift + H * 0.26, z: L * 0.5 },
    tail: { x: W * 0.30, w: W * 0.22, h: H * 0.09, y: lift + H * 0.26, z: -L * 0.5 },
  };

  // Bodywork is smooth and glossy; the world around it stays flat-shaded.
  const primary = glossy(c.primary, { shininess: 70, specular: 0x4a4a52 });
  const secondary = glossy(c.secondary, { shininess: 40, specular: 0x33333a });
  const glass = glossy(0x22303f, { shininess: 130, specular: 0x8fa4b8 });
  // The tail lamps get their own material so this car's brake lights can come
  // on without lighting up everybody else's. Everything else shares.
  const brakeLight = ownLamp(BRAKE_LIGHT.rest);

  const shape = SHAPES[chassis.id];
  let lofted = null;
  if (shape) {
    const mats = {
      primary, secondary, glass,
      trim: glossy(0x111214, { shininess: 50, specular: 0x33333a }),
      chrome: glossy(0xd8dce0, { shininess: 140, specular: 0xffffff }),
      grille: glossy(0x17181b, { shininess: 10, specular: 0x1c1c20 }),
      badge: glossy(0xc41e1e, { shininess: 60, specular: 0x444444 }),
      lens: unlit(c.headlight),
      tail: brakeLight,
    };
    lofted = buildLoftedBody(parts, chassis, shape, {
      L, W, H, lift, mats, lights, mount,
      aFront, bRear, sweptX, sweptZ, wheelInner, wheelOuter, archY,
    });
  } else {
    // The open-wheeler: narrow tub, exposed wheels, low nose, sidepods, an
    // engine cover running back over the gearbox, and a rear wing carried on
    // a pylon.
    //
    // The back half is the part that matters. This body used to be a tub
    // that stopped 0.24 m behind the rear axle with a slab of a wing hanging
    // over it, so from directly behind the car looked sawn off and the tail
    // lights had nothing to sit on. Everything from the sidepods back is
    // there to give the car a tail.
    //
    // Nothing here may reach the tyres: the rear wheels' inner faces are at
    // `wheelInner` and the front wheels sweep to `sweptX` at full lock.
    const tubH = H * 0.62;
    parts.add(W * 0.72, tubH, L * 0.62, primary, 0, lift + tubH * 0.5, -L * 0.04);
    // Nose cone
    parts.add(W * 0.42, tubH * 0.55, L * 0.34, primary, 0, lift + tubH * 0.32, L * 0.40);
    // Front wing
    parts.add(W * 1.02, H * 0.09, L * 0.11, secondary, 0, lift + H * 0.07, L * 0.53);
    // Sidepods, stopping short of the front tyres and drawing in toward the
    // rear ones.
    // Both must stand proud of the tub's own half width (0.36 W). Drawn any
    // narrower the taper is sealed inside the tub and never rendered.
    for (const sx of [1, -1]) {
      parts.add(W * 0.20, H * 0.34, L * 0.34, primary, sx * W * 0.32, lift + H * 0.20, L * 0.06);
      parts.add(W * 0.17, H * 0.26, L * 0.20, primary, sx * W * 0.31, lift + H * 0.19, -L * 0.16);
    }
    // Airbox behind the driver
    parts.add(W * 0.34, H * 0.5, L * 0.14, secondary, 0, lift + tubH + H * 0.22, -L * 0.16);
    // Engine cover, tapering back from the airbox to the gearbox.
    parts.add(W * 0.30, H * 0.40, L * 0.30, primary, 0, lift + tubH * 0.86, -L * 0.25);
    parts.add(W * 0.20, H * 0.26, L * 0.15, primary, 0, lift + tubH * 0.70, -L * 0.40);
    // Diffuser: the actual back of the car, and what the tail lights sit on.
    parts.add(W * 0.80, H * 0.22, L * 0.18, secondary, 0, lift + H * 0.11, -L * 0.42);
    // Rear wing: a wing, on endplates at its tips, on a pylon off the
    // gearbox. The old one was a 0.74 m slab sitting just above the tyres.
    const wingY = lift + H * 1.20;
    const wingHalf = W * 0.49;
    parts.add(wingHalf * 2, H * 0.075, L * 0.11, secondary, 0, wingY, -L * 0.47);
    for (const sx of [1, -1]) {
      parts.add(H * 0.05, H * 0.50, L * 0.11, secondary,
        sx * (wingHalf - H * 0.025), wingY - H * 0.20, -L * 0.47);
    }
    parts.add(W * 0.06, H * 0.62, L * 0.09, secondary, 0, wingY - H * 0.34, -L * 0.45);
    // Cockpit opening
    parts.add(W * 0.4, H * 0.16, L * 0.2, glass, 0, lift + tubH * 0.92, L * 0.02);
    // Lights go on the nose tip and the back of the diffuser, not on thin
    // air -- and ON those faces, half proud, not sunk behind them. A lens
    // buried inside bodywork is never drawn, which is how the rims spent a
    // milestone invisible inside the tyres.
    lights.head.x = W * 0.11; lights.head.w = W * 0.12;
    lights.head.y = lift + tubH * 0.32; lights.head.z = L * 0.57;
    lights.tail.x = W * 0.28; lights.tail.w = W * 0.20;
    lights.tail.y = lift + H * 0.11; lights.tail.z = -L * 0.51;

    skin.push({ hw: W * 0.36, y0: lift, y1: lift + tubH, z0: -L * 0.35, z1: L * 0.27 });
    skin.push({ hw: W * 0.21, y0: lift + tubH * 0.045, y1: lift + tubH * 0.595,
      z0: L * 0.23, z1: L * 0.57 });
    skin.push({ hw: W * 0.15, y0: lift + tubH * 0.86 - H * 0.20, y1: lift + tubH * 0.86 + H * 0.20,
      z0: -L * 0.40, z1: -L * 0.10 });
    // No roof, so roof items go on the airbox, and the spoiler becomes a
    // second element on the rear wing rather than a wing behind a wing.
    mount.roof = { hw: W * 0.17, y: lift + tubH + H * 0.47, z0: -L * 0.23, z1: -L * 0.09 };
    mount.spoiler = { hw: W * 0.49, y: wingY + H * 0.0375, z: -L * 0.47 };
    mount.flank = { hw: W * 0.42, y: lift + H * 0.20, z: L * 0.06, r: H * 0.16 };
  }

  // Mirrors: small, square, no fillets -- on stalks off the bodywork. Placed
  // at a flat fraction of the body width they hung 6 to 17 cm clear of the
  // car, which is a lot of daylight for something you look at every lap.
  if (mount.mirror) {
    const m = mount.mirror;
    const mat = m.mat ?? secondary;
    for (const sx of [1, -1]) {
      parts.add(0.10, 0.035, 0.035, mat, sx * (m.hw + 0.045), m.y, m.z);
      parts.add(0.055, 0.13, 0.10, mat, sx * (m.hw + 0.1175), m.y + 0.02, m.z);
    }
  }

  // Cosmetics last, so they sit on top of finished bodywork.
  if (lofted) addLoftLivery(parts, c.livery, secondary, lofted.painted, L, W, lofted.zc, lofted.paintTop);
  else addLivery(parts, c.livery, secondary, skin, L, W);
  addSpoiler(parts, c.spoiler, secondary, mount.spoiler, L, H);
  addRoofItem(parts, c.roofItem, {
    body: secondary,
    lens: unlit(c.headlight),
    trim: glossy(c.hub, { shininess: 95, specular: 0x9a9aa4 }),
  }, mount.roof, chassis, H);
  if (c.number != null) {
    const discHex = contrastTo(c.primary);
    addRoundel(parts, c.number,
      glossy(discHex, { shininess: 30, specular: 0x2e2e36 }),
      glossy(contrastTo(discHex), { shininess: 30, specular: 0x2e2e36 }),
      mount.flank, H);
  }

  // Headlights and tail lights. Unlit so they stay bright at any sun angle.
  for (const [lamp, mat] of [[lights.head, unlit(c.headlight)], [lights.tail, brakeLight]]) {
    parts.add(lamp.w, lamp.h, LENS_DEPTH, mat, lamp.x, lamp.y, lamp.z);
    parts.add(lamp.w, lamp.h, LENS_DEPTH, mat, -lamp.x, lamp.y, lamp.z);
  }

  // Merge every body part down to one mesh per material.
  parts.build(body);

  // Wheels. Kept on the ROOT, not the body, so suspension travel moves them
  // independently of the bodywork. Width was worked out with the arch geometry.
  const wheels = [];
  // Same order as VehiclePhysics: [FL, FR, RL, RR]. +x is the car's left.
  const offsets = [
    [halfTrack, aFront], [-halfTrack, aFront], [halfTrack, -bRear], [-halfTrack, -bRear],
  ];
  for (const [x, z] of offsets) {
    const w = buildWheel(chassis.wheelRadius, wheelWidth, c);
    w.position.set(x, 0, z);
    root.add(w);
    wheels.push(w);
  }

  // Where the headlight beam starts, for night tracks: centred between the two
  // lenses, just proud of them so the bumper does not shadow its own beam.
  const headlamp = { y: lights.head.y, z: lights.head.z + LENS_DEPTH + 0.15 };

  // The curved panels as inside tests, in the body's own frame, for
  // check-parts.mjs: boxes it can read for itself, these it cannot.
  const volumes = lofted ? lofted.solids.map((l) => (x, y, z) => l.contains(x, y, z)) : [];

  return { root, body, wheels, brakeLight, headlamp, volumes };
}
