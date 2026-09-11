// Builds a car out of primitives. No external assets, ever.
//
// Everything is boxes and low-segment cylinders with hard edges, so the cars
// read as toys under a hard sun. Each chassis has a `profile` that changes the
// silhouette, because "four cars" is meaningless if they are four recolors.
//
// The car root sits at the suspension MOUNT PLANE, which is where
// VehiclePhysics puts its origin. Wheels hang below it by
// (restLength - compression) and are moved every frame by Vehicle.js, so the
// body visibly floats on its springs.
//
// Milestone 4 extends `config` with liveries, spoilers, roof items and
// roundels. Nothing added there may touch handling.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { flat, unlit, glossy, ownLamp } from '../render/Materials.js';
import { SIM, SUSPENSION } from '../data/tuning.js';
import { contrastTo } from '../data/customization.js';

// Where the bodywork sits relative to the car root, in metres (negative: the
// body hangs below the mount plane). The root is the suspension MOUNT PLANE,
// which is itself 0.23 m to 0.44 m above the road depending on chassis and how
// far the springs have squashed under the car's own weight. Treating that plane
// as the floor and adding a fixed 6 cm gap left every car hovering, most
// obviously the open-wheeler, whose whole body is only 0.72 m tall. So measure
// down from the mount plane instead: work out where it actually rests, and drop
// the bodywork to the ride height the chassis asks for.
//
// The chase camera derives the cockpit eye point from this too, so it stays
// inside the bodywork on every chassis. One definition, both users.
// How far the suspension mount plane sits above the road with the car resting
// on its own springs. This is where the car root lives, so it is also what the
// garage turntable needs in order to stand a car on the ground.
export function mountHeight(chassis) {
  const staticSquash = (chassis.mass * SIM.gravity) / (4 * SUSPENSION.springRate);
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
    let list = this.byMaterial.get(material);
    if (!list) { list = []; this.byMaterial.set(material, list); }
    list.push(g);
    return g;
  }

  // Like add(), but with the edge radius named outright instead of capped at
  // MAX_BEVEL. That cap exists so a body panel stays a panel; it is wrong for
  // the one part in this game that is supposed to read as ROUND rather than
  // merely un-sharp, which is a head.
  addRound(w, h, d, material, x, y, z, radius) {
    const g = roundedBox(w, h, d, radius);
    g.translate(x, y, z);
    let list = this.byMaterial.get(material);
    if (!list) { list = []; this.byMaterial.set(material, list); }
    list.push(g);
    return g;
  }

  // An already positioned geometry, for the few parts that are not boxes.
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
    let list = this.byMaterial.get(material);
    if (!list) { list = []; this.byMaterial.set(material, list); }
    list.push(g);
    return g;
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

// Wheel styles. Every one is the same two meshes -- everything dark, and
// everything light -- so a wheel costs two draw calls whatever it looks like.
// The light rim always PROTRUDES past the sidewall: a rim tucked inside the
// tyre is sealed in and never drawn, which is how these rendered as plain
// black discs for a whole milestone.
const WHEEL_LOOKS = {
  blocky:    { segs: 10, rim: 0.60, hub: 0.26, dish: 0.56, gaps: 0,  tread: 0 },
  fivespoke: { segs: 28, rim: 0.66, hub: 0.24, dish: 0.56, gaps: 5,  tread: 0 },
  deepdish:  { segs: 28, rim: 0.78, hub: 0.20, dish: 0.72, gaps: 8,  tread: 0 },
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
// Two shapes are passed in from the profile that built the car:
//
//   `skin`  the painted panels, as { hw, y0, y1, z0, z1 } boxes. Livery is
//           drawn as thin slabs laid on these rather than by recolouring the
//           bodywork, so a livery is a few extra boxes and never a rebuild.
//   `mount` where a spoiler, a roof item, a mirror and a roundel bolt on. Each
//           profile knows its own roof line; nothing here guesses at one, which
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
  // The bodywork is WIDER than the track on every closed-wheel car here, which
  // is normal -- real cars are too -- but a plain box has no wheel wells, so
  // the tyres sat inside the bodywork. Cutting a full-length sill fixed the
  // straight-ahead case and not the steered one: a front wheel turned to full
  // lock sweeps far wider than its own width, because the tyre's RADIUS starts
  // pointing sideways. At 35 degrees of lock a 0.33 m wheel reaches 0.30 m from
  // the hub instead of 0.13 m, which is why the wheels still cut into the car
  // as soon as it turned.
  //
  // So the body gets real wheel wells: full width everywhere except a scallop
  // at each axle, sized to the wheel's whole swept envelope at full lock.
  const halfTrack = chassis.trackWidth * 0.5;
  const wheelWidth = chassis.wheelRadius * (chassis.profile === 'truck' ? 0.95 : 0.78);
  // The rim face and hub cap stand proud of the tyre, so the wheel is wider
  // than its tread. Clearance is measured against the widest part of it.
  const wheelHalfW = wheelWidth * 0.66;
  const wheelInner = halfTrack - wheelHalfW;
  const wheelOuter = halfTrack + wheelHalfW;

  // Swept half-extents of a wheel turned to full lock, across and along the car.
  const lock = chassis.steerRate;
  const sweptX = wheelHalfW * Math.cos(lock) + chassis.wheelRadius * Math.sin(lock);
  const sweptZ = chassis.wheelRadius * Math.cos(lock) + wheelHalfW * Math.sin(lock);

  const frontWellHalfW = Math.min(W * 0.5, halfTrack - sweptX - 0.035);
  const rearWellHalfW = Math.min(W * 0.5, wheelInner - 0.035);
  const frontWellZ = sweptZ + 0.06;
  const rearWellZ = chassis.wheelRadius + 0.06;

  // Wheel centre relative to the car root, then a little above it.
  const wheelY = chassis.wheelRadius - chassis.rideHeight + lift;
  const archY = wheelY + chassis.wheelRadius * 0.30;

  const aFront = chassis.wheelbase * (1 - chassis.weightDistribution);
  const bRear = chassis.wheelbase * chassis.weightDistribution;

  // The painted panels, for livery, and the places cosmetic parts bolt on.
  // Each profile fills these in: only the profile knows where its own roof
  // line is, and a shared guess is how parts end up floating.
  const skin = [];
  const mount = { roof: null, spoiler: null, flank: null, mirror: null };

  // Lower bodywork. Full width above the arch line, and below it full width
  // too except for the two wells.
  const lowerBody = (top, len, mat, zc = 0) => {
    skin.push({ hw: W * 0.5, y0: lift, y1: top, z0: zc - len * 0.5, z1: zc + len * 0.5 });
    if (top > archY + 0.01) {
      parts.add(W, top - archY, len, mat, 0, (archY + top) * 0.5, zc);
    }
    const h = archY - lift;
    if (h <= 0.01) return;
    const y = (lift + archY) * 0.5;
    const z0 = zc - len * 0.5, z1 = zc + len * 0.5;
    // [from, to, half width], running from the tail forward.
    const spans = [
      [z0, -bRear - rearWellZ, W * 0.5],
      [-bRear - rearWellZ, -bRear + rearWellZ, rearWellHalfW],
      [-bRear + rearWellZ, aFront - frontWellZ, W * 0.5],
      [aFront - frontWellZ, aFront + frontWellZ, frontWellHalfW],
      [aFront + frontWellZ, z1, W * 0.5],
    ];
    for (const [from, to, halfW] of spans) {
      const lo = Math.max(from, z0), hi = Math.min(to, z1);
      if (hi - lo < 0.02) continue;
      parts.add(halfW * 2, h, hi - lo, mat, 0, y, (lo + hi) * 0.5);
    }
  };


  // Where the light lenses sit. Defaults to the corners of the declared body
  // box, which is right for anything with full-length bodywork, and is
  // overridden by any profile that does not fill that box. The open-wheeler
  // did not, and hung its tail lights 0.66 m behind the last piece of
  // bodywork -- two red bars floating in the air behind a car that stopped at
  // the rear axle.
  const lights = {
    head: { x: W * 0.30, w: W * 0.22, h: H * 0.10, y: lift + H * 0.26, z: L * 0.5 },
    tail: { x: W * 0.30, w: W * 0.22, h: H * 0.09, y: lift + H * 0.26, z: -L * 0.5 },
  };

  // Bodywork is smooth and glossy; the world around it stays flat-shaded.
  const primary = glossy(c.primary, { shininess: 70, specular: 0x4a4a52 });
  const secondary = glossy(c.secondary, { shininess: 40, specular: 0x33333a });
  const glass = glossy(0x22303f, { shininess: 130, specular: 0x8fa4b8 });

  switch (chassis.profile) {
    case 'openwheel': {
      // Narrow tub, exposed wheels, low nose, sidepods, an engine cover running
      // back over the gearbox, and a rear wing carried on a pylon.
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
      break;
    }
    case 'face': {
      // A head, on four wheels. There is no cabin, no bonnet and no glass, so
      // this profile shares almost nothing with the other four: a dark plinth
      // carrying the wheels, and one very large rounded box sitting on it with
      // a face on the front.
      const neckTop = archY + H * 0.05;
      lowerBody(neckTop, L * 0.86, secondary);

      const headHW = W * 0.48;
      const headY0 = neckTop - 0.02;   // overlaps the plinth rather than resting on it
      const headY1 = lift + H;
      const headZ0 = -L * 0.42, headZ1 = L * 0.42;
      const headCY = (headY0 + headY1) * 0.5;
      const skull = Math.min(W, H) * 0.17;
      parts.addRound(headHW * 2, headY1 - headY0, headZ1 - headZ0, primary,
        0, headCY, 0, skull);

      // The face. Everything here overhangs the front of the skull, because a
      // feature flush with it is a feature sealed inside it. The skull's corner
      // radius eats the outer part of each face, so nothing sits further out
      // than headHW - skull or higher than half the height minus the same.
      const eyeY = headCY + H * 0.10;
      const eyeX = W * 0.21;
      for (const sx of [1, -1]) {
        // Brow
        parts.add(W * 0.23, H * 0.055, L * 0.03, secondary,
          sx * eyeX, eyeY + H * 0.095, headZ1 - 0.02);
        // Pupil, standing proud of the lens that becomes the eye below.
        parts.add(W * 0.05, H * 0.045, 0.075, secondary,
          sx * eyeX, eyeY, headZ1 + 0.030);
        // Ear
        parts.add(0.14, H * 0.20, L * 0.12, primary,
          sx * (headHW + 0.05), headCY + H * 0.02, -L * 0.22);
      }
      // Nose: a bridge and a tip, the tip standing further out.
      parts.add(W * 0.11, H * 0.19, 0.16, primary, 0, headCY + H * 0.015, headZ1 - 0.03);
      parts.add(W * 0.14, H * 0.08, 0.24, primary, 0, headCY - H * 0.075, headZ1 - 0.02);
      // Mouth and jaw. Both stay inside |dy| < half the head minus the corner
      // radius: any lower and they are sitting on the curve of the skull rather
      // than on its face, which reads as a part that has slipped.
      parts.add(W * 0.38, H * 0.06, 0.10, secondary, 0, headCY - H * 0.160, headZ1 - 0.02);
      parts.add(W * 0.46, H * 0.09, 0.10, primary, 0, headCY - H * 0.255, headZ1 - 0.03);
      // A flat top, half sunk into the crown, which is also what a roof item
      // stands on.
      parts.add(headHW * 1.5, H * 0.06, L * 0.50, secondary, 0, headY1, 0);

      // The eyes ARE the headlights, and the lamps at the back of the skull are
      // the tail lights. Both land half sunk into a real surface, so the parts
      // check reads them the same way it reads every other car's.
      lights.head.x = eyeX;
      lights.head.w = W * 0.14;
      lights.head.h = H * 0.085;
      lights.head.y = eyeY;
      lights.head.z = headZ1;
      lights.tail.x = W * 0.24;
      lights.tail.w = W * 0.16;
      lights.tail.h = H * 0.06;
      lights.tail.y = headCY - H * 0.14;
      lights.tail.z = headZ0;

      // The livery panel deliberately STOPS short of the face. A quarter-panel
      // or a checker slab laid over the front would swallow the eyes and the
      // nose, and a head with its face painted over is not a livery, it is a
      // bug that happens to be symmetrical.
      skin.push({ hw: headHW, y0: headY0, y1: headY1, z0: headZ0, z1: L * 0.10 });
      mount.roof = { hw: headHW * 0.75, y: headY1 + H * 0.030, z0: -L * 0.25, z1: L * 0.25 };
      // A spoiler bolts to the back of the CROWN, not to the back face: the
      // uprights need something under them to stand on.
      mount.spoiler = { hw: headHW * 0.9, y: headY1, z: headZ0 + L * 0.06 };
      mount.flank = { hw: headHW, y: headCY - H * 0.02, z: L * 0.06, r: H * 0.16 };
      mount.mirror = null; // a head has no mirrors
      break;
    }
    case 'truck': {
      // Tall slab body, cab forward, bed at the back, roll bar.
      const bedH = H * 0.42;
      const cabH = H * 0.5;
      lowerBody(lift + bedH, L, primary);
      parts.add(W * 0.94, cabH, L * 0.42, primary, 0, lift + bedH + cabH * 0.5, L * 0.16);
      // Wider than the cab, or the glass is sealed inside it and this truck
      // has no windows at all -- which is exactly what it had.
      parts.add(W * 0.94 + 0.10, cabH * 0.5, L * 0.34, glass, 0, lift + bedH + cabH * 0.62, L * 0.18);
      // Open bed walls
      parts.add(W * 0.96, H * 0.2, L * 0.04, secondary, 0, lift + bedH + H * 0.1, -L * 0.47);
      parts.add(W * 0.06, H * 0.2, L * 0.4, secondary, W * 0.47, lift + bedH + H * 0.1, -L * 0.26);
      parts.add(W * 0.06, H * 0.2, L * 0.4, secondary, -W * 0.47, lift + bedH + H * 0.1, -L * 0.26);
      // Roll bar, on two uprights standing on the bed floor. On its own the
      // bar hung 0.24 m above the cab with nothing holding it up.
      const barY = lift + bedH + cabH + H * 0.16;
      parts.add(W * 0.8, H * 0.06, L * 0.05, secondary, 0, barY, -L * 0.10);
      for (const sx of [1, -1]) {
        const legH = barY - (lift + bedH);
        parts.add(H * 0.05, legH, L * 0.05, secondary,
          sx * W * 0.38, lift + bedH + legH * 0.5, -L * 0.10);
      }
      // Bull bar
      parts.add(W * 0.9, H * 0.14, L * 0.05, secondary, 0, lift + bedH * 0.7, L * 0.51);
      lights.head.y = lift + H * 0.3;
      lights.tail.y = lift + H * 0.3;
      // Onto the FRONT of the bull bar. Left on the body box they sat wholly
      // inside it, so this truck has never had visible headlights.
      lights.head.z = L * 0.535;

      skin.push({ hw: W * 0.47, y0: lift + bedH, y1: lift + bedH + cabH, z0: -L * 0.05, z1: L * 0.37 });
      mount.roof = { hw: W * 0.47, y: lift + bedH + cabH, z0: -L * 0.05, z1: L * 0.37 };
      mount.spoiler = { hw: W * 0.48, y: lift + bedH + H * 0.2, z: -L * 0.47 };
      mount.flank = { hw: W * 0.5, y: lift + bedH * 0.55, z: -L * 0.02, r: H * 0.16 };
      mount.mirror = { hw: W * 0.47, y: lift + bedH + cabH * 0.55, z: L * 0.32 };
      break;
    }
    case 'muscle': {
      // Long flat hood, low glasshouse set well back, ducktail.
      const lowH = H * 0.56;
      const cabH = H * 0.44;
      lowerBody(lift + lowH, L, primary);
      parts.add(W * 0.84, cabH, L * 0.34, primary, 0, lift + lowH + cabH * 0.5, -L * 0.12);
      // Wider than the cabin, and by more than the bevel radius. See the hatch.
      parts.add(W * 0.84 + 0.10, cabH * 0.56, L * 0.28, glass, 0, lift + lowH + cabH * 0.6, -L * 0.115);
      // Hood scoop
      parts.add(W * 0.3, H * 0.1, L * 0.18, secondary, 0, lift + lowH + H * 0.04, L * 0.22);
      // Ducktail, sunk into the deck rather than hovering 6 mm over it.
      parts.add(W * 0.92, H * 0.09, L * 0.09, secondary, 0, lift + lowH + H * 0.035, -L * 0.46);

      skin.push({ hw: W * 0.42, y0: lift + lowH, y1: lift + lowH + cabH, z0: -L * 0.29, z1: L * 0.05 });
      mount.roof = { hw: W * 0.42, y: lift + lowH + cabH, z0: -L * 0.29, z1: L * 0.05 };
      mount.spoiler = { hw: W * 0.46, y: lift + lowH + H * 0.08, z: -L * 0.46 };
      mount.flank = { hw: W * 0.5, y: lift + lowH * 0.52, z: -L * 0.02, r: H * 0.18 };
      mount.mirror = { hw: W * 0.42, y: lift + lowH + cabH * 0.40, z: L * 0.02 };
      break;
    }
    default: {
      // hatch: short nose, upright cabin, tall glass.
      const lowH = H * 0.5;
      const cabH = H * 0.5;
      lowerBody(lift + lowH, L, primary);
      parts.add(W * 0.88, cabH, L * 0.52, primary, 0, lift + lowH + cabH * 0.5, -L * 0.06);
      // Wider than the cabin, so the glasshouse is actually visible. The step
      // has to beat the 55 mm bevel radius on the cabin's own edges, or the
      // glass disappears into the rounding -- which is what a 2 percent step
      // did, leaving these cars with no windows at all.
      parts.add(W * 0.88 + 0.10, cabH * 0.6, L * 0.46, glass, 0, lift + lowH + cabH * 0.58, -L * 0.055);
      // Roof lip
      parts.add(W * 0.8, H * 0.06, L * 0.07, secondary, 0, lift + lowH + cabH + H * 0.02, -L * 0.29);

      skin.push({ hw: W * 0.44, y0: lift + lowH, y1: lift + lowH + cabH, z0: -L * 0.32, z1: L * 0.20 });
      mount.roof = { hw: W * 0.44, y: lift + lowH + cabH, z0: -L * 0.32, z1: L * 0.20 };
      mount.spoiler = { hw: W * 0.46, y: lift + lowH, z: -L * 0.46 };
      mount.flank = { hw: W * 0.5, y: lift + lowH * 0.56, z: -L * 0.02, r: H * 0.18 };
      mount.mirror = { hw: W * 0.44, y: lift + lowH + cabH * 0.42, z: L * 0.15 };
      break;
    }
  }

  // Wheel arches. A flare sitting OVER the tyre, reaching just past its outer
  // face -- not a slab alongside it, which is what used to bury the wheel.
  const a = aFront;
  const b = bRear;
  if (chassis.profile !== 'openwheel') {
    const flareW = wheelOuter + 0.04 - W * 0.5;
    if (flareW > 0.02) {
      for (const [sx, sz] of [[-1, a], [1, a], [-1, -b], [1, -b]]) {
        // Sat 0.21 * radius high, the flare's underside lands exactly on the
        // arch line. A hair lower and its bottom centimetre cut into the top
        // of the tyre, which is the same fault as the wheel wells, smaller.
        parts.add(flareW, chassis.wheelRadius * 0.42, chassis.wheelRadius * 2.3, secondary,
          sx * (W * 0.5 + flareW * 0.5), archY + chassis.wheelRadius * 0.21, sz);
      }
    }
  }

  // Mirrors: small, square, no fillets -- on stalks off the bodywork. Placed
  // at a flat fraction of the body width they hung 6 to 17 cm clear of the
  // car, which is a lot of daylight for something you look at every lap.
  if (mount.mirror) {
    const m = mount.mirror;
    for (const sx of [1, -1]) {
      parts.add(0.10, 0.035, 0.035, secondary, sx * (m.hw + 0.045), m.y, m.z);
      parts.add(0.055, 0.13, 0.10, secondary, sx * (m.hw + 0.1175), m.y + 0.02, m.z);
    }
  }

  // Cosmetics last, so they sit on top of finished bodywork.
  addLivery(parts, c.livery, secondary, skin, L, W);
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
  // The tail lamps get their own material so this car's brake lights can come
  // on without lighting up everybody else's. Everything else shares.
  const brakeLight = ownLamp(BRAKE_LIGHT.rest);
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
    [halfTrack, a], [-halfTrack, a], [halfTrack, -b], [-halfTrack, -b],
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

  return { root, body, wheels, brakeLight, headlamp };
}
