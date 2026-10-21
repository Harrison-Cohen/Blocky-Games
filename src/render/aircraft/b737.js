// The Boeing 737-800, built out of primitives like the F-22 is: smooth, lofted, glossy.
//
// Body axes are the physics': +x LEFT, +y up, +z nose, origin at the centre of mass,
// so the root takes the physics' position and quaternion with no conversion. What the
// renderer moves is in `parts`, and `update(s)` (called each frame with the interpolated
// physics state) moves it: the ailerons, the elevators, the rudder, the flaps (which slide
// aft and turn down, three of them to a wing, as the flap lever says), the slats, the
// spoilers, the fan, the gear (which retracts and compresses and steers).
//
// A 737 reads as one by the engines (slung forward under the wing, flat at the bottom, a
// big fan face), the winglets, the swept wing set low on a round fuselage, the tall swept
// fin and the little flat nose. The livery (data/loadouts.js, set in the Hangar) is
// fictional: a body colour, a cheat line, a tail colour, belly and engine bands, a logo
// on the fin and a registration number.

import * as THREE from 'three';
import { Loft } from '../../game/CarBuilder.js';
import { glossy, unlit } from '../Materials.js';
import { normalizeLivery, paintHex } from '../../data/loadouts.js';
import { mesh, slab, fin, mirror, lighten, DIGITS, DIGIT_BARS } from '../AircraftBuilder.js';

const WHITE = 0xe9ecef;
const WING_GREY = 0xc7ccd2;
const ENGINE_GREY = 0xb4bbc4;
const DARK = 0x39414b;
const BLACK = 0x1d2127;
const GLASS = 0x1b2b3b;
const TYRE = 0x16191d;
const HUB = 0xb8bec6;

const rad = (d) => (d * Math.PI) / 180;
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

// The fuselage: a round tube, 3.76 m across, a rounded nose and a tail cone that sweeps up.
// Rear first, as Loft wants. The centre line is 0.13 m above the centre of mass.
const FUSELAGE = [
  { z: -21.9, y0: 0.55, y1: 1.05, hw: 0.25, xc: 0, top: 1 },
  { z: -20.5, y0: -0.1, y1: 1.4, hw: 0.62, xc: 0, top: 1 },
  { z: -18.0, y0: -0.85, y1: 1.7, hw: 1.15, xc: 0, top: 1 },
  { z: -14.0, y0: -1.45, y1: 1.95, hw: 1.62, xc: 0, top: 1 },
  { z: -10.0, y0: -1.75, y1: 2.01, hw: 1.88, xc: 0, top: 1 },
  { z: 10.5, y0: -1.75, y1: 2.01, hw: 1.88, xc: 0, top: 1 },
  { z: 13.5, y0: -1.7, y1: 1.97, hw: 1.84, xc: 0, top: 1 },
  { z: 15.5, y0: -1.45, y1: 1.78, hw: 1.58, xc: 0, top: 1 },
  { z: 16.9, y0: -1.0, y1: 1.4, hw: 1.05, xc: 0, top: 1 },
  { z: 17.57, y0: -0.4, y1: 0.7, hw: 0.4, xc: 0, top: 1 },
];
const FUS_N = 2.2;

// The wing, left side, in a frame at the root (x outboard from there, z along the aircraft):
// the leading edge, the trailing edge (a kink, as a 737's has), and the places the panels sit.
const ROOT_X = 1.8, SEMI = 15.1, WING_Y = -1.3, DIHEDRAL = rad(5);
const zLE = (x) => 2.2 - (7.8 / SEMI) * x;
const zTE = (x) => (x < 4.6 ? -5.4 - (0.6 / 4.6) * x : -6.0 - (1.4 / (SEMI - 4.6)) * (x - 4.6));

// A point on the fuselage's skin at z, at height `py` (-1 bottom to 1 top of the section, in
// the section's own terms), pushed `grow` metres out; returns [x, y, nx, ny] with the outward
// normal. The superellipse Loft draws.
const SKIN = new Loft(FUSELAGE, FUS_N, 8);
function skin(z, py, grow = 0) {
  const s = SKIN.at(z);
  const b = (s.y1 - s.y0) / 2, yc = (s.y0 + s.y1) / 2;
  const t = Math.pow(Math.max(0, 1 - Math.pow(Math.abs(py), FUS_N)), 1 / FUS_N);
  const x = s.hw * t, y = yc + py * b;
  // The normal of |x/a|^n + |y/b|^n = 1 is (x^(n-1)/a^n, y^(n-1)/b^n).
  const nx = Math.pow(Math.max(t, 1e-6), FUS_N - 1) / s.hw, ny = Math.sign(py) * Math.pow(Math.abs(py), FUS_N - 1) / b;
  const l = Math.hypot(nx, ny) || 1;
  return [x + (nx / l) * grow, y + (ny / l) * grow, nx / l, ny / l];
}

// A band round the side of the fuselage, one side: from z0 to z1 at heights py0 to py1, as
// a strip of quads standing `grow` proud of the skin. No texture: it is geometry.
function band(z0, z1, py0, py1, side, grow = 0.012, step = 0.7) {
  const pos = [], idx = [];
  const n = Math.max(1, Math.ceil(Math.abs(z1 - z0) / step));
  for (let i = 0; i <= n; i++) {
    const z = z0 + ((z1 - z0) * i) / n;
    for (const py of [py0, py1]) {
      const [x, y] = skin(z, py, grow);
      pos.push(side * x, y, z);
    }
  }
  for (let i = 0; i < n; i++) {
    const a = i * 2;
    // Wound so the quad faces outward on either side.
    if (side > 0) idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    else idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// A row of passenger windows down one side: each a small quad lying flat on the skin.
function windows(z0, z1, py, side, pitch = 0.51, w = 0.3, h = 0.38) {
  const pos = [], idx = [];
  const count = Math.floor((z1 - z0) / pitch);
  for (let i = 0; i <= count; i++) {
    const z = z1 - i * pitch;
    const [x, y, nx, ny] = skin(z, py, 0.014);
    // The tangent across the window, up the skin; the other is along the aircraft.
    const tx = -ny, ty = nx;
    const base = pos.length / 3;
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      pos.push(side * (x + tx * (h / 2) * b), y + ty * (h / 2) * b, z + (w / 2) * a);
    }
    if (side > 0) idx.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
    else idx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// A panel hung on a hinge line: a group at the start of the line, an axis along it that points
// toward the left on both wings (so the same turn lowers the trailing edge on both), and the
// slab, given in the wing's frame, moved so the hinge is the group's origin.
function panel(parent, plan, from, to, side, thickness, bevel, mat, own) {
  const a = [side * from[0], from[1]];
  const g = new THREE.Group();
  g.position.set(a[0], 0, a[1]);
  const dx = to[0] - from[0], dz = to[1] - from[1];
  const axis = side === 1 ? new THREE.Vector3(dx, 0, dz).normalize() : new THREE.Vector3(dx, 0, -dz).normalize();
  const flip = (pts) => (side === 1 ? pts : mirror(pts));
  const rel = flip(plan).map(([x, z]) => [x - a[0], z - a[1]]);
  const m = mesh(own(slab(rel, thickness, bevel)), mat);
  g.add(m);
  parent.add(g);
  return { group: g, axis, side, rest: new THREE.Vector3(a[0], 0, a[1]) };
}

export function buildB737(def, livery = null) {
  const L = normalizeLivery(livery, def.id);
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const owned = [];
  const own = (g) => { owned.push(g); return g; };

  const stock = L.body === 'stock';
  const bodyHex = stock ? WHITE : paintHex(L.body);
  const accentHex = paintHex(L.accent);
  const hull = glossy(bodyHex, { shininess: 80, specular: 0x6a717a });
  const hullLight = glossy(lighten(bodyHex, 0.08), { shininess: 80, specular: 0x6a717a });
  const wingMat = glossy(stock ? WING_GREY : lighten(bodyHex, 0.12), { shininess: 60, specular: 0x4d535c });
  const wingLight = glossy(stock ? lighten(WING_GREY, 0.1) : lighten(bodyHex, 0.2), { shininess: 60, specular: 0x4d535c });
  const accent = glossy(accentHex, { shininess: 70, specular: 0x4a4e56 });
  const engineMat = glossy(stock ? ENGINE_GREY : lighten(bodyHex, 0.05), { shininess: 70, specular: 0x555b64 });
  const dark = glossy(DARK, { shininess: 60 });
  const black = glossy(BLACK, { shininess: 40 });
  const glass = glossy(GLASS, { shininess: 140, specular: 0xffffff });
  const tyreMat = glossy(TYRE, { shininess: 14, specular: 0x222222 });
  const hubMat = glossy(HUB, { shininess: 90 });
  const cheat = L.pattern === 'cheatline' || L.pattern === 'full';
  const tailPaint = L.pattern === 'tail' || L.pattern === 'full';
  const belly = L.pattern === 'belly';
  const rings = L.pattern === 'engines' || L.pattern === 'full';
  const finMat = tailPaint ? accent : hull;
  const finLight = tailPaint ? glossy(lighten(accentHex, 0.12), { shininess: 70, specular: 0x4a4e56 }) : hullLight;

  // --- fuselage ------------------------------------------------------------
  const fuselage = new Loft(FUSELAGE, FUS_N, 40);
  body.add(mesh(own(fuselage.geometry()), hull));
  // The belly: a darker underside, as an airliner's wear line, and the belly band livery.
  if (belly) {
    for (const side of [1, -1]) body.add(mesh(own(band(-17, 13.5, -0.98, -0.3, side, 0.012, 0.9)), accent));
  }
  // The cheat line: a stripe along the windows, tapering to the tail.
  if (cheat) {
    for (const side of [1, -1]) body.add(mesh(own(band(-18, 15.2, 0.18, 0.4, side, 0.012, 0.8)), accent));
  }
  // The windscreen and the passenger windows.
  for (const [x, ry] of [[-0.42, 0.34], [0.42, -0.34], [0, 0]]) {
    // One face only, turned outward: seen from the flight deck it is not there, so the
    // cockpit camera looks through the windscreen and not at the back of it.
    const pane = mesh(own(new THREE.PlaneGeometry(0.62, 0.62).rotateX(-Math.PI / 2)), glass);
    pane.castShadow = false;
    const [, y] = skin(15.55, 0.93, 0.0);
    pane.position.set(x, y + 0.02, 15.75);
    // Raked back: the front edge low, as the nose falls away ahead of it.
    pane.rotation.set(rad(17), ry * 0.5, 0);
    body.add(pane);
  }
  for (const side of [1, -1]) {
    const w = mesh(own(windows(-11.8, 12.4, 0.36, side)), glass);
    w.castShadow = false;
    body.add(w);
    const cw = mesh(own(windows(14.6, 15.4, 0.36, side, 0.5, 0.42, 0.34)), glass);
    cw.castShadow = false;
    body.add(cw);
  }
  // The registration, on the rear fuselage, readable from outside each side.
  if (L.number != null) {
    const text = String(L.number), n = text.length, pitch = Math.min(0.62, 3.6 / n), k = Math.min(0.4 / 1.8, pitch * 0.82);
    for (const side of [1, -1]) {
      for (let i = 0; i < n; i++) {
        const u0 = (i - n / 2) * pitch + (pitch - k) / 2;
        for (const key of DIGITS[text[i]] || '') {
          const [su, sv, sw, sh] = DIGIT_BARS[key];
          const bar = mesh(own(new THREE.BoxGeometry(0.03, sh * k * 1.6, sw * k * 1.6)), accentHex === bodyHex ? dark : accent);
          bar.castShadow = false;
          const z = -13.2 - side * (u0 + su * k * 1.6);
          const [x] = skin(z, 0.5, 0.016);
          bar.position.set(side * x, 0.13 + 0.95 + (sv - 0.9) * k * 1.6, z);
          body.add(bar);
        }
      }
    }
  }

  // --- wings, with winglets, slats, flaps, ailerons and spoilers ---------------------------
  const wingMeshes = [];
  const wings = [];
  const flapPanels = [], slatPanels = [], spoilerPanels = [], ailerons = [];
  const LE = [[0, zLE(0)], [SEMI, zLE(SEMI)]];
  const planOuter = [[0, zLE(0)], [SEMI, zLE(SEMI)], [SEMI, zTE(SEMI)], [4.6, zTE(4.6)], [0, zTE(0)]];
  for (const side of [1, -1]) {
    const g = new THREE.Group();
    g.position.set(side * ROOT_X, WING_Y, 0);
    g.rotation.z = side * DIHEDRAL;
    body.add(g);
    wings.push(g);
    const flip = (pts) => (side === 1 ? pts : mirror(pts));
    wingMeshes.push(mesh(own(slab(flip(planOuter), 0.3, 0.07)), wingMat));
    g.add(wingMeshes[wingMeshes.length - 1]);

    // The trailing-edge panels: inboard and outboard flap, and the aileron, each hinged on a
    // line 1.4 m ahead of the trailing edge (the flaps) or 1 m (the aileron).
    const hz = (x, c) => zTE(x) + c;
    const flap = (x0, x1) => {
      const plan = [[x0, hz(x0, 1.45)], [x1, hz(x1, 1.45)], [x1, zTE(x1)], [x0, zTE(x0)]];
      const p = panel(g, plan, [x0, hz(x0, 1.45)], [x1, hz(x1, 1.45)], side, 0.12, 0.035, wingLight, own);
      p.kind = 'flap';
      flapPanels.push(p);
    };
    flap(2.6, 7.6);
    flap(8.0, 12.8);
    {
      const x0 = 13.2, x1 = 14.9;
      const plan = [[x0, hz(x0, 1.0)], [x1, hz(x1, 1.0)], [x1, zTE(x1)], [x0, zTE(x0)]];
      const p = panel(g, plan, [x0, hz(x0, 1.0)], [x1, hz(x1, 1.0)], side, 0.1, 0.03, wingLight, own);
      p.kind = 'aileron';
      p.side = side;
      ailerons.push(p);
    }
    // Spoilers: four on each wing, lying on the top of the wing ahead of the flaps, hinged at
    // their front edge, rising as the airbrake comes out.
    for (const [x0, x1] of [[3.6, 6.4], [6.6, 9.4], [9.6, 12.2], [12.4, 14.4]]) {
      const c0 = 2.55, c1 = 1.55;
      const plan = [[x0, hz(x0, c0)], [x1, hz(x1, c0)], [x1, hz(x1, c1)], [x0, hz(x0, c1)]];
      const p = panel(g, plan, [x0, hz(x0, c0)], [x1, hz(x1, c0)], side, 0.06, 0.02, wingMat, own);
      p.group.position.y += 0.17;
      p.kind = 'spoiler';
      spoilerPanels.push(p);
    }
    // Slats along the leading edge, out of the wing as the flaps go down.
    for (const [x0, x1] of [[3.0, 8.8], [9.1, 14.6]]) {
      const plan = [[x0, zLE(x0)], [x1, zLE(x1)], [x1, zLE(x1) - 0.5], [x0, zLE(x0) - 0.5]];
      const p = panel(g, plan, [x0, zLE(x0)], [x1, zLE(x1)], side, 0.08, 0.025, wingLight, own);
      p.kind = 'slat';
      slatPanels.push(p);
    }

    // The winglet: a blended upturned tip, swept, standing a little outboard of the wing's tip.
    const wl = new THREE.Group();
    wl.position.set(side * (SEMI - 0.05), 0.05, 0);
    wl.rotation.z = -side * rad(14);
    wl.add(mesh(own(fin([[zLE(SEMI) + 0.5, 0], [zTE(SEMI) + 0.2, 0], [zTE(SEMI) - 0.35, 2.35], [zTE(SEMI) + 1.1, 2.35]], 0.07, 0.025)), tailPaint ? accent : wingMat));
    g.add(wl);
    // The tip lights: red on the left, green on the right.
    const lamp = new THREE.Mesh(own(new THREE.BoxGeometry(0.1, 0.1, 0.22)), unlit(side > 0 ? 0xff3a2a : 0x2aff5a));
    lamp.position.set(side * (SEMI + 0.02), 0.07, zLE(SEMI) - 0.4);
    g.add(lamp);
  }

  // --- engines ---------------------------------------------------------------------------------------
  // CFM56 nacelles, slung forward of the wing, flat on the bottom, a big fan face and a hub.
  const NACELLE = [
    { z: -2.2, y0: -0.3, y1: 0.3, hw: 0.28, xc: 0, top: 1 },
    { z: -1.5, y0: -0.5, y1: 0.52, hw: 0.48, xc: 0, top: 1 },
    { z: 0.0, y0: -0.72, y1: 0.8, hw: 0.74, xc: 0, top: 1 },
    { z: 1.6, y0: -0.76, y1: 0.86, hw: 0.83, xc: 0, top: 1 },
    { z: 2.9, y0: -0.73, y1: 0.86, hw: 0.82, xc: 0, top: 1 },
    { z: 3.4, y0: -0.68, y1: 0.8, hw: 0.77, xc: 0, top: 1 },
  ];
  const fans = [];
  for (const e of def.engines) {
    const g = new THREE.Group();
    g.position.set(e.x, e.y, 0);
    const nacelle = new Loft(NACELLE, 2.4, 32);
    g.add(mesh(own(nacelle.geometry()), engineMat));
    // Engine rings of the livery: bands round the nacelle at the lip and the cowl.
    if (rings) {
      for (const [z0, z1] of [[2.95, 3.4], [-0.1, 0.4]]) {
        const band3 = new Loft([{ ...nacelle.at(z0), z: z0 }, { ...nacelle.at(z1), z: z1 }].map((q) => ({ ...q, hw: q.hw + 0.014, y0: q.y0 - 0.014, y1: q.y1 + 0.014, xc: 0, top: 1 })), 2.4, 32);
        const m = mesh(own(band3.geometry()), accent);
        m.castShadow = false;
        g.add(m);
      }
    }
    // The inlet: a dark ring and the fan face with its blades and hub, turning with the engine.
    const inlet = new THREE.Mesh(own(new THREE.CircleGeometry(0.7, 28)), black);
    inlet.position.set(0, 0.04, 3.39);
    g.add(inlet);
    const fan = new THREE.Group();
    fan.position.set(0, 0.04, 3.4);
    const bladeGeo = own(new THREE.BoxGeometry(0.07, 0.62, 0.015));
    for (let i = 0; i < 14; i++) {
      const b = new THREE.Mesh(bladeGeo, i % 2 ? dark : hubMat);
      b.position.set(0, 0, 0);
      const holder = new THREE.Group();
      holder.rotation.z = (i / 14) * Math.PI * 2;
      b.position.y = 0.36;
      b.rotation.z = 0.25;
      holder.add(b);
      fan.add(holder);
    }
    const hub = new THREE.Mesh(own(new THREE.ConeGeometry(0.2, 0.34, 20)), hubMat);
    hub.rotation.x = Math.PI / 2;
    hub.position.z = 0.1;
    fan.add(hub);
    g.add(fan);
    fans.push(fan);
    body.add(g);
    // The pylon that holds it to the wing.
    const pylon = mesh(own(new THREE.BoxGeometry(0.34, 0.45, 2.4)), wingMat);
    pylon.position.set(e.x, e.y + 0.9, 0.9);
    body.add(pylon);
  }

  // --- tail ---------------------------------------------------------------------------------------------------------
  // The tailplane (the elevators are panels hinged at 68% of the chord) and the fin and rudder.
  const elevators = [];
  for (const side of [1, -1]) {
    const g = new THREE.Group();
    g.position.set(side * 0.9, 1.0, 0);
    body.add(g);
    const flip = (pts) => (side === 1 ? pts : mirror(pts));
    const plan = [[0, -16.0], [6.7, -19.5], [6.7, -20.15], [0, -18.9]];
    g.add(mesh(own(slab(flip(plan), 0.16, 0.04)), tailPaint ? accent : wingMat));
    const e = panel(g, [[0, -18.9], [6.7, -20.15], [6.7, -21.0], [0, -20.4]], [0, -18.9], [6.7, -20.15], side, 0.11, 0.03, wingLight, own);
    e.kind = 'elevator';
    elevators.push(e);
  }

  const FIN = { le: [-13.1, -18.7], te: [-19.5, -21.2], tip: 8.9, root: 1.7 };
  const hz0 = FIN.le[0] + 0.66 * (FIN.te[0] - FIN.le[0]), hz1 = FIN.le[1] + 0.66 * (FIN.te[1] - FIN.le[1]);
  const finG = new THREE.Group();
  finG.position.set(0, FIN.root, 0);
  body.add(finG);
  finG.add(mesh(own(fin([[FIN.le[0], 0], [hz0, 0], [hz1, FIN.tip], [FIN.le[1], FIN.tip]], 0.22, 0.05)), finMat));
  const rudG = new THREE.Group();
  rudG.position.set(0, 0, hz0);
  rudG.add(mesh(own(fin([[hz0, 0], [FIN.te[0], 0], [FIN.te[1], FIN.tip - 0.1], [hz1, FIN.tip]].map(([z, y]) => [z - hz0, y]), 0.16, 0.04)), finLight));
  finG.add(rudG);
  const rudderAxis = new THREE.Vector3(0, FIN.tip, hz1 - hz0).normalize();
  // The dorsal fairing, ahead of the fin.
  const dorsal = mesh(own(fin([[-9.5, 0], [-13.1, 0], [-13.1, 1.15]].map(([z, y]) => [z, y]), 0.1, 0.03)), hull);
  dorsal.position.y = FIN.root - 0.05;
  body.add(dorsal);
  // The logo on the fin, both sides, in the accent (or the body colour on a painted fin).
  if (L.insignia !== 'none') {
    const logoMat = tailPaint ? (stock ? hull : glossy(WHITE, { shininess: 60 })) : accent;
    const zc = -16.4, yc = 5.2;
    const flat = (pts) => fin(pts, 0.012, 0.004);
    const shapes = {
      ring: () => {
        const ringG = own(new THREE.TorusGeometry(1.05, 0.2, 8, 28));
        ringG.rotateY(Math.PI / 2);
        const disc = own(new THREE.CylinderGeometry(0.42, 0.42, 0.02, 20));
        disc.rotateZ(Math.PI / 2);
        return [ringG, disc];
      },
      wave: () => [-0.8, 0, 0.8].map((dy, i) => own(flat([[-1.5, dy - 0.1 + 0.1 * (i - 1)], [-0.5, dy + 0.18], [0.5, dy - 0.18], [1.5, dy + 0.1], [1.5, dy - 0.12], [0.5, dy - 0.45], [-0.5, dy - 0.07], [-1.5, dy - 0.32]]))),
      star: () => {
        const pts = [];
        for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 + Math.PI / 2, r = i % 2 ? 0.55 : 1.25; pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
        return [own(flat(pts))];
      },
      bars: () => [-0.7, 0, 0.7].map((dy) => own(flat([[-1.4, dy - 0.2], [1.4, dy - 0.2], [1.4, dy + 0.2], [-1.4, dy + 0.2]]))),
    }[L.insignia];
    for (const side of [1, -1]) {
      for (const geo of shapes()) {
        const m = mesh(geo, logoMat);
        m.castShadow = false;
        m.position.set(side * 0.12, FIN.root + yc, zc);
        body.add(m);
      }
    }
  }

  // --- landing gear -------------------------------------------------------------------------------------------------------------
  // Twin wheels on the nose, twin wheels either side of each main strut (Boeing: 0.41 m and
  // 0.86 m apart). The strut shortens as it compresses, and the whole leg lifts into the body.
  const gear = [];
  const tyreNose = own(new THREE.CylinderGeometry(0.343, 0.343, 0.2, 22));
  tyreNose.rotateZ(Math.PI / 2);
  const tyreMain = own(new THREE.CylinderGeometry(0.565, 0.565, 0.42, 26));
  tyreMain.rotateZ(Math.PI / 2);
  const hubNose = own(new THREE.CylinderGeometry(0.19, 0.19, 0.22, 14));
  hubNose.rotateZ(Math.PI / 2);
  const hubMain = own(new THREE.CylinderGeometry(0.3, 0.3, 0.44, 16));
  hubMain.rotateZ(Math.PI / 2);
  const strutGeo = own(new THREE.CylinderGeometry(0.1, 0.13, 1, 12));
  for (const w of def.gear.wheels) {
    const isNose = !!w.steer;
    const r = isNose ? 0.343 : 0.565;
    const bellyY = isNose ? -1.4 : -1.55;
    const g = new THREE.Group();
    g.position.set(w.pos[0], bellyY, w.pos[2]);
    const strut = mesh(strutGeo, hubMat);
    g.add(strut);
    const wheel = new THREE.Group();
    for (const dx of isNose ? [-0.205, 0.205] : [-0.43, 0.43]) {
      const t = new THREE.Group();
      t.position.x = dx;
      t.add(mesh(isNose ? tyreNose : tyreMain, tyreMat));
      t.add(mesh(isNose ? hubNose : hubMain, hubMat));
      wheel.add(t);
    }
    g.add(wheel);
    // A torque link and a brace, so the leg is not a bare pole.
    if (!isNose) {
      const brace = mesh(own(new THREE.BoxGeometry(0.1, 0.1, 0.9)), dark);
      brace.position.set(0, -0.4, 0.45);
      g.add(brace);
    }
    body.add(g);
    gear.push({ group: g, strut, wheel, y0: w.pos[1] + r, belly: bellyY, name: w.name, steer: !!w.steer, radius: r });
  }

  // --- movement ------------------------------------------------------------------------------------------------------------------------------
  const detentDeg = (pos) => {
    const d = def.flaps.detents;
    const i = Math.min(d.length - 1, Math.floor(pos)), j = Math.min(d.length - 1, i + 1), f = pos - i;
    return d[i].deg + (d[j].deg - d[i].deg) * f;
  };
  const turn = (p, angle) => p.group.quaternion.setFromAxisAngle(p.axis, angle);

  function update(s, physics, dt) {
    const sf = s.surfaces;
    // The ailerons: a positive deflection on the left wing is lift up on that side, trailing
    // edge down; the right wing's gain has the opposite sign.
    ailerons.forEach((p) => turn(p, -(p.side === 1 ? sf[0] : -sf[1]) * 2.2));
    // The elevators: pull is trailing edges up, which is a negative deflection.
    elevators.forEach((p) => turn(p, sf[2] * 1.9));
    // The rudder, about its slanted hinge.
    rudG.quaternion.setFromAxisAngle(rudderAxis, sf[4] * 1.5);
    // The flaps: slide aft a little and turn down by the detent's angle.
    const deg = detentDeg(s.flaps);
    const slide = clamp(deg / 30, 0, 1);
    flapPanels.forEach((p) => {
      turn(p, -rad(deg) * 0.95);
      p.group.position.set(p.rest.x, p.rest.y, p.rest.z - 0.55 * slide);
    });
    // The slats come out for any flap setting.
    const sl = clamp(s.flaps, 0, 1);
    slatPanels.forEach((p) => {
      turn(p, rad(22) * sl);
      p.group.position.set(p.rest.x, p.rest.y - 0.07 * sl, p.rest.z + 0.34 * sl);
    });
    // The spoilers rise with the airbrake, hinged on their front edge.
    spoilerPanels.forEach((p) => turn(p, rad(52) * s.airbrake));
    // The fans turn with the engines.
    const spin = 0.4 + 3.2 * s.spool;
    fans.forEach((f, i) => { f.rotation.z += dt * spin * 6 * (i ? -1 : 1); });
    // The gear: lifted into the body as it retracts, the strut shortening as it compresses, the
    // wheels turning, the nose wheel steering.
    const gd = s.gear;
    for (let i = 0; i < gear.length; i++) {
      const part = gear[i];
      part.group.visible = gd > 0.03;
      if (!part.group.visible) continue;
      const comp = i < s.compression.length ? s.compression[i] : 0;
      const centreY = part.y0 + comp + (1 - gd) * 1.8;
      const len = Math.max(0.1, part.belly - centreY);
      part.strut.scale.set(1, len, 1);
      part.strut.position.y = -len / 2;
      part.wheel.position.y = centreY - part.belly;
      part.wheel.rotation.x = physics.gear.spin[i] || 0;
      if (part.steer) part.group.rotation.y = s.steer;
    }
  }

  return {
    root,
    body,
    parts: { gear, flapPanels, slatPanels, spoilerPanels, ailerons, elevators, rudder: rudG, fans, wings },
    update,
    dispose() { for (const g of owned) g.dispose(); },
  };
}
