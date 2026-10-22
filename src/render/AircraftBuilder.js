// Builds an aircraft out of primitives. No external assets, ever.
//
// Smooth, like the cars: lofted fuselage and intake panels (the same Loft the
// real cars' bodies are swept with), thin extruded slabs with a bevel for wings,
// tails and fins, round wheels, all in glossy() so a highlight runs down the
// bodywork. The world around it is the flat-shaded part; the aircraft is not.
//
// Body axes are the physics': +x LEFT, +y up, +z nose, origin at the centre of
// mass. The root is that origin, so the renderer sets its position and its
// quaternion straight from the physics with no conversion.
//
// What the renderer animates is returned in `parts`: the stabilators, the
// rudders and the wing flaperons (each a real panel hinged at its leading edge,
// so a control moves the way a control surface does, and nothing else does),
// the nozzles (flat, two-dimensional, which tilt for thrust vectoring) and their
// flat burner plumes, and
// the landing gear (which retracts and compresses).
//
// The livery (data/loadouts.js, set in the Hangar) is paint, a pattern, a tail
// number and an insignia. Paint is a colour on the body's materials; the rest are
// thin slabs of the accent colour laid on the surfaces a little proud of them
// (never on a moving panel, which would leave them behind). The default livery is
// exactly the grey the aircraft has always been.

import * as THREE from 'three';
import { Loft } from '../game/CarBuilder.js';
import { glossy, unlit, ownLamp } from './Materials.js';
import { normalizeLivery, paintHex } from '../data/loadouts.js';

const GREY = 0x6e7782;
const GREY_DARK = 0x4c545e;
const BLACK = 0x23282f;
const GLASS = 0x1c2c3d;

// A glossy mesh that casts and receives shadows.
export function mesh(geo, mat) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// A flat slab from a planform, thin in y, with a rounded edge. points are
// [x, z] pairs in the plane of the slab; the slab is centred on y = 0.
export function slab(points, thickness, bevel) {
  const shape = new THREE.Shape();
  points.forEach(([x, z], i) => (i ? shape.lineTo(x, -z) : shape.moveTo(x, -z)));
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 1,
  });
  // The shape lies in x-y with z as the extrusion: stand it flat.
  g.rotateX(-Math.PI / 2);
  g.translate(0, -thickness / 2, 0);
  g.computeVertexNormals();
  return g;
}

// A slab standing on its edge: points are [z, y] pairs, thin in x.
export function fin(points, thickness, bevel) {
  const shape = new THREE.Shape();
  points.forEach(([z, y], i) => (i ? shape.lineTo(-z, y) : shape.moveTo(-z, y)));
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 1,
  });
  g.rotateY(Math.PI / 2);
  g.translate(-thickness / 2, 0, 0);
  g.computeVertexNormals();
  return g;
}

export const mirror = (points) => points.map(([a, b]) => [-a, b]);

// A point on the segment a-b at fraction t.
export const lerp2 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

// Seven segment digits for the tail number, as the car's roundel and the runway's
// designator have (no textures anywhere): which of a (top), b (upper right),
// c (lower right), d (bottom), e (lower left), f (upper left), g (middle) are lit.
export const DIGITS = {
  0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg',
};
// [across, up, width, height] in a cell one wide and 1.8 tall.
export const DIGIT_BARS = {
  a: [0.50, 1.72, 0.72, 0.16], b: [0.86, 1.30, 0.16, 0.68], c: [0.86, 0.42, 0.16, 0.68],
  d: [0.50, 0.08, 0.72, 0.16], e: [0.14, 0.42, 0.16, 0.68], f: [0.14, 1.30, 0.16, 0.68],
  g: [0.50, 0.86, 0.72, 0.16],
};

// A colour lightened toward white, for the lighter panels of a repainted body.
export const lighten = (hex, k) => {
  const c = new THREE.Color(hex);
  return c.lerp(new THREE.Color(0xffffff), k).getHex();
};

// The canopy's sections (the bubble over the cockpit), shared with the Cockpit view's frame
// (render/aircraft/cockpits.js), whose arches follow them.
export const CANOPY_STATIONS = [
  { z: 0.7, y0: 0.66, y1: 0.9, hw: 0.3, xc: 0, top: 0.8 },
  { z: 1.8, y0: 0.62, y1: 1.5, hw: 0.66, xc: 0, top: 0.55 },
  { z: 3.1, y0: 0.6, y1: 1.4, hw: 0.62, xc: 0, top: 0.55 },
  { z: 4.5, y0: 0.56, y1: 0.98, hw: 0.4, xc: 0, top: 0.65 },
  { z: 5.1, y0: 0.54, y1: 0.76, hw: 0.16, xc: 0, top: 0.8 },
];

// An intake's sections, front first, outboard positive (mirrored per side): z, the centre
// of the section across (cx) and up (cy), its half width and height, the shear that leans the
// top edge outboard (metres of lean per metre of half height), and the rake that sweeps the
// front ring's upper and outer edges back (metres).
const INTAKE = [
  { z: 3.4, cx: 1.26, cy: -0.43, hw: 0.4, hh: 0.44, shear: 0.14, rake: 0.6 },
  { z: 2.7, cx: 1.3, cy: -0.45, hw: 0.44, hh: 0.48, shear: 0.12, rake: 0 },
  { z: 1.0, cx: 1.42, cy: -0.48, hw: 0.52, hh: 0.5, shear: 0.08, rake: 0 },
  { z: -1.2, cx: 1.5, cy: -0.5, hw: 0.56, hh: 0.5, shear: 0, rake: 0 },
];
const INTAKE_N = 5; // how square the section is (2 is an ellipse)
const INTAKE_SEG = 28;

// The point of section s at angle a round it: `out` is 0 at its inboard edge to 1 at its outboard
// edge, `up` 0 at the bottom to 1 at the top.
function intakePoint(s, a, side) {
  const c = Math.cos(a), sn = Math.sin(a);
  const px = Math.sign(c) * Math.pow(Math.abs(c), 2 / INTAKE_N);
  const py = Math.sign(sn) * Math.pow(Math.abs(sn), 2 / INTAKE_N);
  const up = (py + 1) / 2, out = (px + 1) / 2;
  return [side * (s.cx + px * s.hw + s.shear * py * s.hh), s.cy + py * s.hh, s.z - s.rake * (0.75 * up + 0.25 * out)];
}

function intakeDuct(side, sections) {
  const pos = [], idx = [];
  for (const s of sections) {
    for (let k = 0; k < INTAKE_SEG; k++) pos.push(...intakePoint(s, (k / INTAKE_SEG) * Math.PI * 2, side));
  }
  for (let r = 0; r < sections.length - 1; r++) {
    for (let k = 0; k < INTAKE_SEG; k++) {
      const a = r * INTAKE_SEG + k, b = r * INTAKE_SEG + ((k + 1) % INTAKE_SEG), c = a + INTAKE_SEG, d = b + INTAKE_SEG;
      if (side > 0) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c);
    }
  }
  // The rear end, closed: a fan on vertices of its own.
  const last = sections[sections.length - 1], base = pos.length / 3;
  pos.push(side * last.cx, last.cy, last.z);
  for (let k = 0; k < INTAKE_SEG; k++) pos.push(...intakePoint(last, (k / INTAKE_SEG) * Math.PI * 2, side));
  for (let k = 0; k < INTAKE_SEG; k++) {
    const a = base + 1 + k, b = base + 1 + ((k + 1) % INTAKE_SEG);
    if (side > 0) idx.push(base, a, b); else idx.push(base, b, a);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// The throat: the section's shape, filled, `depth` metres behind the mouth, looking forward.
function intakeThroat(side, s, depth) {
  const pos = [side * s.cx, s.cy, s.z - depth - 0.3 * s.rake], idx = [];
  for (let k = 0; k < INTAKE_SEG; k++) {
    const p = intakePoint({ ...s, rake: 0 }, (k / INTAKE_SEG) * Math.PI * 2, side);
    pos.push(p[0] * 0.97, p[1], s.z - depth - 0.3 * s.rake);
  }
  for (let k = 0; k < INTAKE_SEG; k++) {
    const a = 1 + k, b = 1 + ((k + 1) % INTAKE_SEG);
    if (side > 0) idx.push(0, a, b); else idx.push(0, b, a);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function buildAircraft(def, livery = null) {
  const L = normalizeLivery(livery);
  const root = new THREE.Group();
  const body = new THREE.Group();
  const damageGroups = { wingL: [], wingR: [], tail: [] };
  root.add(body);
  const owned = [];
  const own = (g) => { owned.push(g); return g; };
  const lamps = [];

  const stockBody = L.body === 'stock';
  const bodyHex = paintHex(L.body), accentHex = paintHex(L.accent);
  const hull = glossy(stockBody ? GREY : bodyHex, { shininess: 70, specular: 0x5a626c });
  const hullLight = glossy(stockBody ? 0x7d8794 : lighten(bodyHex, 0.14), { shininess: 70, specular: 0x5a626c });
  const accent = glossy(accentHex, { shininess: 60, specular: 0x4a4e56 });
  const accentLight = glossy(lighten(accentHex, 0.14), { shininess: 60, specular: 0x4a4e56 });
  // The split livery paints the whole left side (+x) in the accent.
  const split = L.pattern === 'split';
  const sideHull = (side) => (split && side === 1 ? accent : hull);
  const sideLight = (side) => (split && side === 1 ? accentLight : hullLight);
  // A decal: a thin slab of the accent laid on a surface, a little thicker than the
  // surface it sits on so it stands proud of it on both faces.
  const decal = (parent, plan, thickness, bevel, x = 0, y = 0, z = 0) => {
    const m = mesh(own(slab(plan, thickness, bevel)), accent);
    m.castShadow = false;
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };
  const dark = glossy(GREY_DARK, { shininess: 60 });
  const black = glossy(BLACK, { shininess: 40 });
  const glass = glossy(GLASS, { shininess: 140, specular: 0xffffff, transparent: true, opacity: 0.82 });

  // --- fuselage -----------------------------------------------------------
  // Rear first, as Loft wants. Wide and deep through the middle where the
  // engines and intakes are, a long chined taper to a rounded nose.
  const fuselage = new Loft([
    { z: -9.7, y0: -0.16, y1: 0.18, hw: 0.18, xc: 0, top: 0.8 },
    { z: -7.6, y0: -0.58, y1: 0.48, hw: 1.48, xc: 0, top: 0.58 },
    { z: -4.0, y0: -0.88, y1: 0.62, hw: 1.85, xc: 0, top: 0.48 },
    { z: 0.2, y0: -1.0, y1: 0.76, hw: 1.72, xc: 0, top: 0.48 },
    { z: 3.0, y0: -0.8, y1: 0.69, hw: 1.08, xc: 0, top: 0.42 },
    { z: 5.2, y0: -0.55, y1: 0.6, hw: 0.72, xc: 0, top: 0.5 },
    { z: 7.0, y0: -0.34, y1: 0.38, hw: 0.46, xc: 0, top: 0.52 },
    { z: 8.1, y0: -0.24, y1: 0.3, hw: 0.28, xc: 0, top: 0.9 },
    { z: 8.6, y0: -0.1, y1: 0.14, hw: 0.1, xc: 0, top: 1 },
  ], 3, 36);
  const cockpitShell=mesh(own(fuselage.geometry()),hull);
  body.add(cockpitShell);
  // Reference-led C revision: broad flat chines blend the forebody into the wing,
  // with two engine shoulders instead of a single rounded aft fuselage. These are
  // skin geometry only. Engine definitions, collision and lifting surfaces stay data.
  const shoulderShells=[];
  for(const side of [1,-1]){
    const shoulder=new Loft([
      {z:-8.2,y0:-.45,y1:.32,hw:.72,xc:side*1.08,top:.48},
      {z:-6.2,y0:-.72,y1:.65,hw:.84,xc:side*1.12,top:.72},
      {z:-3.3,y0:-.81,y1:.72,hw:.87,xc:side*1.18,top:.72},
      {z:-.2,y0:-.78,y1:.65,hw:.71,xc:side*1.16,top:.7},
      {z:1.4,y0:-.65,y1:.47,hw:.48,xc:side*1.12,top:.7},
      {z:2.7,y0:-.3,y1:.42,hw:.02,xc:side*.9,top:.65},
    ],5,28);
    const m=mesh(own(shoulder.geometry()),sideHull(side));body.add(m);shoulderShells.push(m);
    const chine=[[side*.35,7.0],[side*.78,5.0],[side*1.84,2.7],[side*2.14,-.4],[side*2.6,-1.0],[side*1.5,-3.0],[side*.7,1.0]];
    const blend=mesh(own(slab(chine,.24,.025)),sideHull(side));blend.position.y=.16;body.add(blend);shoulderShells.push(blend);
  }


  // Intakes: on each side of the forebody, under the wing's root, with a mouth that is a
  // parallelogram (the top edge leaning outboard) and a lip swept back along its top and outer
  // edges, the cheek the colour of the hull and the throat black. Modelled on photographs of the
  // aircraft from above and ahead: the duct starts under the rear of the canopy and swells into
  // the fuselage's side, it is not a separate pod.
  for (const side of [1, -1]) {
    body.add(mesh(own(intakeDuct(side, INTAKE)), sideHull(side)));
    body.add(mesh(own(intakeThroat(side, INTAKE[0], 0.5)), black));
  }

  // --- canopy -------------------------------------------------------------
  const canopy = new Loft(CANOPY_STATIONS, 2.6, 24);
  body.add(mesh(own(canopy.geometry()), glass));

  // The spine pattern: a narrow stripe of the accent standing a little proud of
  // the fuselage's top, aft of the canopy and forward of it.
  if (L.pattern === 'spine') {
    const stripe = (stations) => new Loft(stations.map((q) => ({ z: q.z, y0: q.y1 - 0.14, y1: q.y1 + 0.03, hw: Math.max(0.05, q.hw * 0.14), xc: 0, top: 1 })), 3, 12);
    const stations = fuselage.st;
    for (const part of [stations.slice(0, 4), stations.slice(5)]) {
      const m = mesh(own(stripe(part).geometry()), accent);
      m.castShadow = false;
      body.add(m);
    }
  }

  // The insignia, on the upper surface of each wing about two thirds of the way
  // out: invented marks, a few centimetres thick, flat on the wing.
  if (L.insignia !== 'none') {
    const sheet = (plan, mat, y) => {
      const m = mesh(own(slab(plan, 0.01, 0.004)), mat);
      m.castShadow = false;
      m.position.y = y;
      return m;
    };
    const disc = (r, mat, y) => {
      const m = mesh(own(new THREE.CylinderGeometry(r, r, 0.012, 28)), mat);
      m.castShadow = false;
      m.position.y = y;
      return m;
    };
    const mark = {
      roundel: () => [disc(0.85, accent, 0.146), disc(0.6, hull, 0.152), disc(0.3, accent, 0.158)],
      diamond: () => [sheet([[0, 1.1], [0.85, 0], [0, -1.1], [-0.85, 0]], accent, 0.146), sheet([[0, 0.6], [0.4, 0], [0, -0.6], [-0.4, 0]], hull, 0.152)],
      chevron: () => [sheet([[-0.95, -0.7], [0, 0.7], [0.95, -0.7], [0.95, -1.1], [0, 0.0], [-0.95, -1.1]], accent, 0.146)],
      bars: () => [-0.55, 0, 0.55].map((z) => sheet([[-0.85, z + 0.12], [0.85, z + 0.12], [0.85, z - 0.12], [-0.85, z - 0.12]], accent, 0.146)),
    }[L.insignia];
    for (const side of [1, -1]) {
      const g = new THREE.Group();
      g.position.set(side * 4.3, 0, -2.76);
      for (const m of mark()) g.add(m);
      body.add(g);
      damageGroups[side === 1 ? 'wingL' : 'wingR'].push(g);
    }
  }

  // --- wings --------------------------------------------------------------
  // Leading edge swept 45 degrees, the trailing edge forward a little; the
  // roots are buried in the fuselage. The trailing edge carries the
  // flaperons: an inboard and an outboard panel, hinged at 78% of the chord, so
  // roll and the scheduled flaps are visible on the wing.
  const rootLE = [1.5, 1.3], tipLE = [6.78, -3.25], tipTE = [6.78, -4.35], rootTE = [1.5, -6.2];
  const HINGE = 0.78;
  const hingeRoot = lerp2(rootLE, rootTE, HINGE);
  const hingeTip = lerp2(tipLE, tipTE, HINGE);
  const hingeMid = lerp2(hingeRoot, hingeTip, 0.5);
  const teMid = lerp2(rootTE, tipTE, 0.5);
  const fixedPlan = [rootLE, tipLE, hingeTip, hingeRoot];
  const inboardPlan = [hingeRoot, hingeMid, teMid, rootTE];
  const outboardPlan = [hingeMid, hingeTip, tipTE, teMid];
  const wingFlaps = [];
  for (const side of [1, -1]) {
    const start = body.children.length;
    const flip = (pts) => (side === 1 ? pts : mirror(pts));
    body.add(mesh(own(slab(flip(fixedPlan), 0.14, 0.05)), sideHull(side)));
    // Each flap is a group at the start of its hinge line, turning about the
    // hinge. The axis runs toward the left on both wings, so the same turn
    // lowers the trailing edge on both.
    const panel = (plan, from, to) => {
      const a = [side * from[0], from[1]];
      const g = new THREE.Group();
      g.position.set(a[0], 0, a[1]);
      const dx = to[0] - from[0], dz = to[1] - from[1];
      // from and to are given for the left wing, running outboard. On the right
      // wing the hinge runs the other way, inboard, to point to the left too.
      const axis = side === 1 ? new THREE.Vector3(dx, 0, dz).normalize() : new THREE.Vector3(dx, 0, -dz).normalize();
      const rel2 = flip(plan).map(([x, z]) => [x - a[0], z - a[1]]);
      g.add(mesh(own(slab(rel2, 0.12, 0.04)), sideLight(side)));
      body.add(g);
      return { group: g, axis, side };
    };
    wingFlaps.push({
      side,
      inboard: panel(inboardPlan, hingeRoot, hingeMid),
      outboard: panel(outboardPlan, hingeMid, hingeTip),
    });

    // Patterns on the fixed part of the wing, between the leading edge and the
    // hinge. A band is the strip of it between two stations along the span.
    const strip = (t0, t1) => [lerp2(rootLE, tipLE, t0), lerp2(rootLE, tipLE, t1), lerp2(hingeRoot, hingeTip, t1), lerp2(hingeRoot, hingeTip, t0)];
    if (L.pattern === 'tips') decal(body, flip(strip(0.74, 1)), 0.16, 0.06);
    if (L.pattern === 'bands') {
      decal(body, flip(strip(0.34, 0.44)), 0.16, 0.06);
      decal(body, flip(strip(0.56, 0.66)), 0.16, 0.06);
    }
    damageGroups[side === 1 ? 'wingL' : 'wingR'].push(...body.children.slice(start));
  }

  // --- stabilators --------------------------------------------------------
  // All-moving tailplanes, each on its own pivot at z = -7, so a pull tips both
  // trailing edges up and a roll tips them against each other.
  const stabPlan = [[1.0, -6.0], [4.4, -8.0], [4.4, -9.1], [1.0, -8.9]];
  const pivotZ = -7.0;
  const rel = (pts) => pts.map(([x, z]) => [x, z - pivotZ]);
  const tailStart = body.children.length;
  const stabL = new THREE.Group();
  stabL.position.set(0, 0.02, pivotZ);
  stabL.add(mesh(own(slab(rel(stabPlan), 0.11, 0.04)), sideHull(1)));
  body.add(stabL);
  const stabR = new THREE.Group();
  stabR.position.set(0, 0.02, pivotZ);
  stabR.add(mesh(own(slab(rel(mirror(stabPlan)), 0.11, 0.04)), hull));
  body.add(stabR);
  // The tips pattern puts the accent on the tailplane's outer end too; they are
  // groups that turn, so the decal is inside them and turns with the panel.
  if (L.pattern === 'tips') {
    const outer = (pts) => [lerp2(pts[0], pts[1], 0.62), pts[1], pts[2], lerp2(pts[3], pts[2], 0.62)];
    decal(stabL, rel(outer(stabPlan)), 0.13, 0.05);
    decal(stabR, rel(outer(mirror(stabPlan))), 0.13, 0.05);
  }

  // --- fins and rudders ---------------------------------------------------
  // A fixed fin and a rudder hinged behind it. The fin stays put; only the
  // rudder moves, on the slanted hinge line, as a rudder does. (The first
  // version turned the whole canted fin about its own axis, which swung it
  // in and out.)
  const TIP = 2.9;
  const cant = (27 * Math.PI) / 180;
  const finLE = [-5.4, -8.0], finTE = [-9.2, -9.5];            // [root, tip] z of each edge
  const hz0 = finLE[0] + 0.6 * (finTE[0] - finLE[0]);          // hinge at 60% of the chord
  const hz1 = finLE[1] + 0.6 * (finTE[1] - finLE[1]);
  const finFixed = [[finLE[0], 0], [hz0, 0], [hz1, TIP], [finLE[1], TIP]];
  const rudderPlan = [[hz0, 0], [finTE[0], 0], [finTE[1], TIP - 0.15], [hz1, TIP]];
  const rudders = [];
  for (const side of [1, -1]) {
    const g = new THREE.Group();
    g.position.set(side * 1.48, 0.5, 0);
    g.rotation.z = -side * cant;
    g.add(mesh(own(fin(finFixed, 0.1, 0.035)), sideHull(side)));
    // The rudder: a group at the foot of the hinge line, turning about it.
    const r = new THREE.Group();
    r.position.set(0, 0, hz0);
    r.add(mesh(own(fin(rudderPlan.map(([z, y]) => [z - hz0, y]), 0.09, 0.03)), sideLight(side)));
    g.add(r);
    // The pattern at the tip of the fixed fin, and the tail number on its flank.
    if (L.pattern === 'tips') {
      const at = (y) => [finFixed[0][0] + (finFixed[3][0] - finFixed[0][0]) * (y / TIP), finFixed[1][0] + (finFixed[2][0] - finFixed[1][0]) * (y / TIP)];
      const [le, hg] = at(2.0);
      const f = mesh(own(fin([[le, 2.0], [hg, 2.0], [finFixed[2][0], TIP], [finFixed[3][0], TIP]], 0.13, 0.05)), accent);
      f.castShadow = false;
      g.add(f);
    }
    if (L.number != null) {
      const text = String(L.number);
      const n = text.length;
      // Where the fixed fin is wide enough at the height of the digits: 1.45 m
      // across, centred behind the leading edge. The digits shrink as they multiply.
      const span = 1.45, pitch = Math.min(0.5, span / n), k = Math.min(0.6 / 1.8, pitch * 0.82);
      const x = side * 0.1;
      for (let i = 0; i < n; i++) {
        // The writing runs nose to tail on the left flank and tail to nose on the
        // right, as seen from outside it (the same as the car's number).
        const u0 = (i - n / 2) * pitch + (pitch - k) / 2;
        for (const key of DIGITS[text[i]] || '') {
          const [su, sv, sw, sh] = DIGIT_BARS[key];
          const bar = mesh(own(new THREE.BoxGeometry(0.03, sh * k, sw * k)), accent);
          bar.castShadow = false;
          bar.position.set(x, 0.95 + (sv - 0.9) * k, -7.35 - side * (u0 + su * k));
          g.add(bar);
        }
      }
    }
    body.add(g);
    // The hinge points up and aft; a positive turn about it swings the
    // trailing edge to the right (-x), which is what a right rudder does.
    rudders.push({ group: r, axis: new THREE.Vector3(0, TIP, hz1 - hz0).normalize() });
  }

  damageGroups.tail.push(...body.children.slice(tailStart));

  // --- nozzles ------------------------------------------------------------
  // The F-22's are two-dimensional: a rectangular duct, wide and shallow, closed
  // top and bottom by flat flaps that tilt together to vector the thrust, with
  // a saw-toothed trailing edge. So the plume that comes out of one is flat as
  // well -- a wide ribbon with shock diamonds in it -- not the round cone of an
  // F-16. Each nozzle pivots at the engine position. The hot throat is dark at
  // idle and glows as the engine spools up.
  const NW = 1.62, NH = 0.58, NL = 1.9;               // exit width, height, length
  const nozzles = [];
  // A flap: a flat slab with a toothed trailing edge, lying in x-z.
  const teeth = (w, l, n) => {
    const pts = [[-w / 2, 0], [w / 2, 0], [w / 2, -l]];
    const step = w / n;
    for (let i = 0; i < n; i++) {
      const xr = w / 2 - i * step;
      pts.push([xr - step / 2, -l - 0.28], [xr - step, -l]);
    }
    return pts;
  };
  const flapGeo = own(slab(teeth(NW, NL - 0.3, 6), 0.07, 0.025));
  // The cheeks, standing: z then y, thin in x.
  const cheekGeo = own(fin([[0, -NH / 2 - 0.03], [-(NL - 0.1), -NH / 2 - 0.03], [-(NL - 0.1), NH / 2 + 0.03], [0, NH / 2 + 0.03]], 0.09, 0.025));
  const innerGeo = own(new THREE.BoxGeometry(NW - 0.3, NH - 0.12, 0.1));
  // The plume: sections from the exit (z = 0) to a point (z = -1), each a
  // rounded rectangle. Wide and thin at the exit, swelling a little, pinching
  // to a point. Scaled along z by the renderer for the burner's length.
  const plume = (w, h, bulge, n = 4) => {
    const SEG = 18, RING = 24;
    const pos = [], idx = [];
    for (let i = 0; i <= SEG; i++) {
      const t = i / SEG;
      // a sharp pinch at the tip, a swell near the exit
      const prof = i === SEG ? 0 : Math.pow(1 - t, 0.75) * (1 + bulge * Math.sin(Math.PI * Math.min(1, t * 1.6)));
      for (let r = 0; r < RING; r++) {
        const a = (r / RING) * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a);
        const px = Math.sign(c) * Math.pow(Math.abs(c), 2 / n), py = Math.sign(sn) * Math.pow(Math.abs(sn), 2 / n);
        pos.push(px * (w / 2) * prof, py * (h / 2) * prof, -t);
      }
    }
    for (let i = 0; i < SEG; i++) for (let r = 0; r < RING; r++) {
      const a0 = i * RING + r, a1 = i * RING + ((r + 1) % RING), b0 = (i + 1) * RING + r, b1 = (i + 1) * RING + ((r + 1) % RING);
      idx.push(a0, a1, b0, a1, b1, b0);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    return g;
  };
  const flameGeo = own(plume(NW - 0.2, NH - 0.1, 0.18));
  const coreGeo = own(plume((NW - 0.2) * 0.55, (NH - 0.1) * 0.5, 0.1));
  // Shock diamonds: a row of flattened double pyramids down the plume's axis.
  const diamondGeo = (() => {
    const pos = [], idx = [];
    const count = 5;
    for (let d = 0; d < count; d++) {
      const zc = -(0.12 + d * 0.17), len = 0.1 - d * 0.008, wid = (NW - 0.5) * (0.5 - d * 0.07), hgt = (NH - 0.2) * (0.5 - d * 0.07);
      const base = pos.length / 3;
      pos.push(0, 0, zc + len, 0, 0, zc - len, wid / 2, 0, zc, -wid / 2, 0, zc, 0, hgt / 2, zc, 0, -hgt / 2, zc);
      for (const [a, b, c] of [[0, 2, 4], [0, 4, 3], [0, 3, 5], [0, 5, 2], [1, 4, 2], [1, 3, 4], [1, 5, 3], [1, 2, 5]]) idx.push(base + a, base + b, base + c);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    return own(g);
  })();
  const flameMat = unlit(0xff8a2a, { transparent: true, opacity: 0.55, glow: 3.2 });
  const coreMat = unlit(0xfff0c8, { transparent: true, opacity: 0.8, glow: 4 });
  const diamondMat = unlit(0xffffff, { transparent: true, opacity: 0.9, glow: 5 });
  for (const m of [flameMat, coreMat, diamondMat]) m.side = THREE.DoubleSide;
  for (const e of def.engines) {
    const g = new THREE.Group();
    g.position.set(e.x, e.y, e.z);
    // The duct: the upper and lower flaps, a little divergent, and the cheeks.
    const upper = mesh(flapGeo, dark);
    upper.position.set(0, NH / 2 + 0.035, -0.05);
    upper.rotation.x = 0.05;
    g.add(upper);
    const lower = mesh(flapGeo, dark);
    lower.position.set(0, -NH / 2 - 0.035, -0.05);
    lower.rotation.x = -0.05;
    g.add(lower);
    for (const sx of [1, -1]) {
      const cheek = mesh(cheekGeo, hull);
      cheek.position.set(sx * (NW / 2 + 0.045), 0, -0.05);
      g.add(cheek);
    }
    // Its own material, so each throat glows by its own engine.
    const hotMat = ownLamp(0x24282e);
    lamps.push(hotMat);
    const hot = new THREE.Mesh(innerGeo, hotMat);
    hot.position.z = -0.7;       // deep in the nozzle, so its walls frame the glow
    g.add(hot);
    const flame = new THREE.Mesh(flameGeo, flameMat);
    flame.position.z = -1.85;
    flame.visible = false;
    g.add(flame);
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.position.z = -1.85;
    core.visible = false;
    g.add(core);
    const diamonds = new THREE.Mesh(diamondGeo, diamondMat);
    diamonds.position.z = -1.85;
    diamonds.visible = false;
    g.add(diamonds);
    body.add(g);
    nozzles.push({ group: g, flame, core, diamonds, hotMat });
  }

  // --- landing gear -------------------------------------------------------
  // Hung from the belly, each leg a strut and a wheel; the renderer shortens
  // the strut as it compresses and lifts the lot into the body on retraction.
  const gear = [];
  const tyreGeo = own(new THREE.CylinderGeometry(0.42, 0.42, 0.26, 20));
  tyreGeo.rotateZ(Math.PI / 2);
  const hubGeo = own(new THREE.CylinderGeometry(0.22, 0.22, 0.3, 14));
  hubGeo.rotateZ(Math.PI / 2);
  const strutGeo = own(new THREE.CylinderGeometry(0.07, 0.09, 1, 10));
  const tyreMat = glossy(0x16191d, { shininess: 14, specular: 0x222222 });
  const hubMat = glossy(0xb8bec6, { shininess: 90 });
  const belly = -0.85;
  for (const w of def.gear.wheels) {
    const g = new THREE.Group();
    g.position.set(w.pos[0], belly, w.pos[2]);
    const strut = mesh(strutGeo, hubMat);
    g.add(strut);
    const wheel = new THREE.Group();
    wheel.add(mesh(tyreGeo, tyreMat));
    wheel.add(mesh(hubGeo, hubMat));
    g.add(wheel);
    body.add(g);
    // y0 is the wheel's centre with the strut fully extended, in body axes.
    gear.push({ group: g, strut, wheel, y0: w.pos[1] + 0.42, belly, name: w.name });
  }

  return {
    root,
    body,
    damageGroups,
    cockpitShell: [cockpitShell, ...shoulderShells],
    parts: { stabL, stabR, rudders, wingFlaps, nozzles, gear },
    dispose() {
      for (const g of owned) g.dispose();
      for (const m of lamps) m.dispose();
    },
  };
}
