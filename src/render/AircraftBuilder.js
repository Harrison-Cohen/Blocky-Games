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

import * as THREE from 'three';
import { Loft } from '../game/CarBuilder.js';
import { glossy, unlit, ownLamp } from './Materials.js';

const GREY = 0x6e7782;
const GREY_DARK = 0x4c545e;
const BLACK = 0x23282f;
const GLASS = 0x1c2c3d;

// A glossy mesh that casts and receives shadows.
function mesh(geo, mat) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// A flat slab from a planform, thin in y, with a rounded edge. points are
// [x, z] pairs in the plane of the slab; the slab is centred on y = 0.
function slab(points, thickness, bevel) {
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
function fin(points, thickness, bevel) {
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

const mirror = (points) => points.map(([a, b]) => [-a, b]);

// A point on the segment a-b at fraction t.
const lerp2 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

export function buildAircraft(def) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const owned = [];
  const own = (g) => { owned.push(g); return g; };
  const lamps = [];

  const hull = glossy(GREY, { shininess: 70, specular: 0x5a626c });
  const hullLight = glossy(0x7d8794, { shininess: 70, specular: 0x5a626c });
  const dark = glossy(GREY_DARK, { shininess: 60 });
  const black = glossy(BLACK, { shininess: 40 });
  const glass = glossy(GLASS, { shininess: 140, specular: 0xffffff, transparent: true, opacity: 0.82 });

  // --- fuselage -----------------------------------------------------------
  // Rear first, as Loft wants. Wide and deep through the middle where the
  // engines and intakes are, a long chined taper to a rounded nose.
  const fuselage = new Loft([
    { z: -9.7, y0: -0.45, y1: 0.6, hw: 0.9, xc: 0, top: 0.8 },
    { z: -7.6, y0: -0.78, y1: 0.78, hw: 1.38, xc: 0, top: 0.7 },
    { z: -4.0, y0: -1.0, y1: 0.9, hw: 1.7, xc: 0, top: 0.62 },
    { z: 0.2, y0: -1.04, y1: 0.95, hw: 1.78, xc: 0, top: 0.6 },
    { z: 3.0, y0: -0.88, y1: 0.86, hw: 1.34, xc: 0, top: 0.62 },
    { z: 5.2, y0: -0.58, y1: 0.66, hw: 0.84, xc: 0, top: 0.7 },
    { z: 7.0, y0: -0.38, y1: 0.46, hw: 0.5, xc: 0, top: 0.8 },
    { z: 8.1, y0: -0.24, y1: 0.3, hw: 0.28, xc: 0, top: 0.9 },
    { z: 8.6, y0: -0.1, y1: 0.14, hw: 0.1, xc: 0, top: 1 },
  ], 3, 36);
  body.add(mesh(own(fuselage.geometry()), hull));

  // Intakes: a squared duct under each wing root, mirrored.
  for (const side of [1, -1]) {
    const duct = new Loft([
      { z: -0.9, y0: -0.98, y1: 0.0, hw: 0.56, xc: side * 1.5, top: 1 },
      { z: 1.4, y0: -1.02, y1: 0.06, hw: 0.62, xc: side * 1.54, top: 1 },
      { z: 3.6, y0: -0.84, y1: -0.04, hw: 0.44, xc: side * 1.22, top: 1 },
    ], 4.5, 24);
    body.add(mesh(own(duct.geometry()), dark));
    // The dark mouth of the intake.
    const mouth = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 0.86), black);
    own(mouth.geometry);
    mouth.position.set(side * 1.22, -0.45, 3.65);
    mouth.rotation.y = Math.PI;
    body.add(mouth);
  }

  // --- canopy -------------------------------------------------------------
  const canopy = new Loft([
    { z: 0.7, y0: 0.66, y1: 0.9, hw: 0.3, xc: 0, top: 0.8 },
    { z: 1.8, y0: 0.62, y1: 1.5, hw: 0.66, xc: 0, top: 0.55 },
    { z: 3.1, y0: 0.6, y1: 1.4, hw: 0.62, xc: 0, top: 0.55 },
    { z: 4.5, y0: 0.56, y1: 0.98, hw: 0.4, xc: 0, top: 0.65 },
    { z: 5.1, y0: 0.54, y1: 0.76, hw: 0.16, xc: 0, top: 0.8 },
  ], 2.6, 24);
  body.add(mesh(own(canopy.geometry()), glass));

  // --- wings --------------------------------------------------------------
  // Leading edge swept 45 degrees, the trailing edge forward a little; the
  // roots are buried in the fuselage. The trailing edge carries the
  // flaperons: an inboard and an outboard panel, hinged at 78% of the chord, so
  // roll and the scheduled flaps are visible on the wing.
  const rootLE = [1.3, 2.9], tipLE = [6.78, -2.9], tipTE = [6.78, -4.3], rootTE = [1.3, -6.4];
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
    const flip = (pts) => (side === 1 ? pts : mirror(pts));
    body.add(mesh(own(slab(flip(fixedPlan), 0.14, 0.05)), hull));
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
      g.add(mesh(own(slab(rel2, 0.12, 0.04)), hullLight));
      body.add(g);
      return { group: g, axis, side };
    };
    wingFlaps.push({
      side,
      inboard: panel(inboardPlan, hingeRoot, hingeMid),
      outboard: panel(outboardPlan, hingeMid, hingeTip),
    });
  }

  // --- stabilators --------------------------------------------------------
  // All-moving tailplanes, each on its own pivot at z = -7, so a pull tips both
  // trailing edges up and a roll tips them against each other.
  const stabPlan = [[0.9, -5.2], [4.5, -8.0], [4.5, -9.1], [0.9, -8.9]];
  const pivotZ = -7.0;
  const rel = (pts) => pts.map(([x, z]) => [x, z - pivotZ]);
  const stabL = new THREE.Group();
  stabL.position.set(0, 0.02, pivotZ);
  stabL.add(mesh(own(slab(rel(stabPlan), 0.11, 0.04)), hull));
  body.add(stabL);
  const stabR = new THREE.Group();
  stabR.position.set(0, 0.02, pivotZ);
  stabR.add(mesh(own(slab(rel(mirror(stabPlan)), 0.11, 0.04)), hull));
  body.add(stabR);

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
    g.position.set(side * 1.1, 0.5, 0);
    g.rotation.z = -side * cant;
    g.add(mesh(own(fin(finFixed, 0.1, 0.035)), hull));
    // The rudder: a group at the foot of the hinge line, turning about it.
    const r = new THREE.Group();
    r.position.set(0, 0, hz0);
    r.add(mesh(own(fin(rudderPlan.map(([z, y]) => [z - hz0, y]), 0.09, 0.03)), hullLight));
    g.add(r);
    body.add(g);
    // The hinge points up and aft; a positive turn about it swings the
    // trailing edge to the right (-x), which is what a right rudder does.
    rudders.push({ group: r, axis: new THREE.Vector3(0, TIP, hz1 - hz0).normalize() });
  }

  // --- nozzles ------------------------------------------------------------
  // The F-22's are two-dimensional: a rectangular duct, wide and shallow, closed
  // top and bottom by flat flaps that tilt together to vector the thrust, with
  // a saw-toothed trailing edge. So the plume that comes out of one is flat as
  // well -- a wide ribbon with shock diamonds in it -- not the round cone of an
  // F-16. Each nozzle pivots at the engine position. The hot throat is dark at
  // idle and glows as the engine spools up.
  const NW = 1.5, NH = 0.64, NL = 1.9;               // exit width, height, length
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
    parts: { stabL, stabR, rudders, wingFlaps, nozzles, gear },
    dispose() {
      for (const g of owned) g.dispose();
      for (const m of lamps) m.dispose();
    },
  };
}
