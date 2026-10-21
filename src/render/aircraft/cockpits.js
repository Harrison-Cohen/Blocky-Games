// The inside of each cockpit, drawn in the Cockpit camera view (render/FlightCamera.js, CAM.COCKPIT)
// by a second pass with its own near plane (render/PostFX.js, OverlayPass): the walls and window
// openings, the instrument panel, the seats, the stick or the yokes, the throttle levers. Plain
// geometry, no textures, smooth shaded like the aircraft: the screens are blocks of colour that glow.
//
// A builder returns { group, update(s, physics, dt), dispose() }. The group is added to the
// aircraft's root, in body axes (+x left, +y up, +z nose, origin at the centre of mass), and lives
// on layer 1 only, so the ordinary camera never draws it. `update` moves what moves: the stick
// and the yokes follow the pilot's inputs, the throttle levers the lever, the artificial horizon
// the aircraft's attitude. The hull is drawn single sided (a back face is culled), so from inside
// it is not there: what stops the view is what is built here, and a window is a hole in it.

import * as THREE from 'three';
import { glossy, unlit } from '../Materials.js';
import { Loft } from '../../game/CarBuilder.js';
import { CANOPY_STATIONS } from '../AircraftBuilder.js';
import { skin, COCKPIT_GLASS } from './b737.js';

// Shorthand used by both builders.
export function box(parent, w, h, d, x, y, z, mat, rot) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  if (rot) m.rotation.set(rot[0] || 0, rot[1] || 0, rot[2] || 0);
  parent.add(m);
  return m;
}

// Everything in a cockpit is for the second pass only: layer 1, and no shadows.
export function finish(group) {
  group.traverse((o) => {
    o.layers.set(1);
    o.castShadow = false;
    o.receiveShadow = false;
  });
  group.visible = false;
}

export function disposeAll(group) {
  group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
}

export { glossy, unlit };

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// A cockpit is lit from inside as well as by the sun: the hemisphere light would paint a roof
// the colour of the ground, so a surface here carries part of its own colour as a glow, and the
// sun's highlight stays. Their own materials (the shared ones are the hull's), freed with the
// interior.
function inside(list, hex, shininess = 22, glow = 0.55, twoSided = false) {
  const m = glossy(hex, { shininess }).clone();
  m.emissive.setHex(hex).multiplyScalar(glow);
  if (twoSided) m.side = THREE.DoubleSide;
  list.push(m);
  return m;
}

// The attitude from the interpolated quaternion: the world's up in body axes (ux across, uy up,
// uz along the nose), and the pitch and the angle of the horizon on a screen the pilot looks at.
// Body axes have +x LEFT, so on the pilot's screen the sky lies toward (-ux, uy).
const UP = { ux: 0, uy: 1, uz: 0, pitch: 0 };
function attitude(s) {
  const { qx, qy, qz, qw } = s;
  UP.ux = 2 * (qx * qy + qw * qz);
  UP.uy = 1 - 2 * (qx * qx + qz * qz);
  UP.uz = 2 * (qy * qz - qw * qx);
  UP.pitch = Math.asin(clamp(UP.uz, -1, 1));
  return UP;
}

// A horizon: a sky polygon and a ground polygon in a square window of half size `h`, cut by the
// line the aircraft's attitude gives, written into two fixed meshes each frame (five vertices
// each, the spare ones repeated, so nothing is allocated and nothing is clipped by the renderer).
const SQ = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
const poly = [];
function clipHalf(nx, ny, d, keepAbove, h, out) {
  // Sutherland-Hodgman of the square against the half plane p.n >= d (or <= d).
  out.length = 0;
  for (let i = 0; i < 4; i++) {
    const a = SQ[i], b = SQ[(i + 1) % 4];
    const ax = a[0] * h, ay = a[1] * h, bx = b[0] * h, by = b[1] * h;
    const da = (ax * nx + ay * ny - d) * (keepAbove ? 1 : -1);
    const db = (bx * nx + by * ny - d) * (keepAbove ? 1 : -1);
    if (da >= 0) out.push(ax, ay);
    if ((da >= 0) !== (db >= 0)) {
      const t = da / (da - db);
      out.push(ax + (bx - ax) * t, ay + (by - ay) * t);
    }
  }
  return out;
}
function writeFan(geo, pts) {
  const pos = geo.attributes.position.array;
  const n = pts.length / 2;
  for (let k = 0; k < 5; k++) {
    const i = n ? Math.min(k, n - 1) : 0;
    pos[k * 3] = n ? pts[i * 2] : 0;
    pos[k * 3 + 1] = n ? pts[i * 2 + 1] : 0;
    pos[k * 3 + 2] = 0;
  }
  geo.attributes.position.needsUpdate = true;
}
function fanGeometry() {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(15), 3));
  g.setIndex([0, 1, 2, 0, 2, 3, 0, 3, 4]);
  return g;
}
// A horizon of half size h, as a group (turned to face -z, with local +x the pilot's right) and an
// update from the attitude.
function horizon(h, skyHex, groundHex, lineHex) {
  const group = new THREE.Group();
  group.rotation.y = Math.PI;
  const skyGeo = fanGeometry(), groundGeo = fanGeometry();
  for (const g of [skyGeo, groundGeo]) g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), h * 2);
  const sky = new THREE.Mesh(skyGeo, unlit(skyHex));
  const ground = new THREE.Mesh(groundGeo, unlit(groundHex));
  const line = new THREE.Mesh(new THREE.PlaneGeometry(h * 1.7, h * 0.03), unlit(lineHex));
  line.position.z = -0.0005;
  group.add(sky, ground, line);
  sky.frustumCulled = ground.frustumCulled = false;
  const k = (h / 0.4); // metres of screen per radian of pitch
  return {
    group,
    set(a) {
      const n = Math.hypot(a.ux, a.uy) || 1;
      const nx = -a.ux / n, ny = a.uy / n;
      const d = clamp(-a.pitch * k, -h * 0.98, h * 0.98);
      writeFan(skyGeo, clipHalf(nx, ny, d, true, h, poly));
      writeFan(groundGeo, clipHalf(nx, ny, d, false, h, poly));
      // The horizon line itself: along the cut, d from the centre.
      line.position.set(nx * d, ny * d, -0.0005);
      line.rotation.z = Math.atan2(nx, -ny);
    },
  };
}

// ---------------------------------------------------------------------------------------------
// The Boeing 737-800 flight deck.

// Measurements, in body axes. The floor is a little under the passenger floor's height; the eye is
// at the level of the window sills' middle, so the horizon sits where it does through a real one.
const FLOOR = -0.3;
const BULK = 12.95;   // the flight deck door's bulkhead
const FRONT = 16.9;   // the nose bulkhead
const INSET = 0.07;   // how far inside the outer skin the walls stand

// The breakpoints of a grid between a and b: every window edge, and between them a uniform step
// wherever there is none near.
function breaks(a, b, step, edges) {
  const v = [a, b];
  for (const e of edges) if (e > a + 1e-4 && e < b - 1e-4) v.push(e);
  const base = v.slice();
  for (let x = a + step; x < b - step * 0.4; x += step) {
    if (base.every((e) => Math.abs(e - x) > step * 0.45)) v.push(x);
  }
  return v.sort((p, q) => p - q);
}

// The height across the section at which the floor is, at z.
const floorPy = (z) => {
  const y0 = skin(z, 0)[1], y1 = skin(z, 1)[1];
  return (FLOOR - y0) / (y1 - y0);
};

// The inside of the fuselage between the bulkheads, both sides, as a grid of quads standing
// INSET inside the skin, with a hole wherever there is a window.
function deckShell(holes) {
  const zs = breaks(BULK, FRONT, 0.4, holes.flatMap((h) => [h[0], h[1]]));
  // The lower wall below the sills, then the upper wall, with the windows' edges in it.
  const ps = [-9, -0.1, 0, ...breaks(0.05, 1, 0.15, holes.flatMap((h) => [h[2], h[3]])).slice(0)];
  const pos = [], idx = [];
  const cols = ps.length;
  for (const side of [1, -1]) {
    const base = pos.length / 3;
    for (let i = 0; i < zs.length; i++) {
      for (let j = 0; j < cols; j++) {
        const py = j === 0 ? floorPy(zs[i]) : ps[j];
        const [x, y] = skin(zs[i], py, -INSET);
        pos.push(side * x, y, zs[i]);
      }
    }
    for (let i = 0; i < zs.length - 1; i++) {
      for (let j = 0; j < cols - 1; j++) {
        const zc = (zs[i] + zs[i + 1]) / 2, pc = (ps[j] + ps[j + 1]) / 2;
        if (j > 0 && holes.some((h) => zc > h[0] && zc < h[1] && pc > h[2] && pc < h[3])) continue;
        const a = base + i * cols + j, b = a + 1, c = a + cols, d = c + 1;
        idx.push(a, b, c, b, d, c);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// A flat closing wall across the fuselage at z, from the floor up round the crown.
function deckCap(z) {
  const pf = floorPy(z);
  const pts = [];
  for (let k = 0; k <= 10; k++) {
    const [x, y] = skin(z, pf + ((1 - pf) * k) / 10, -INSET);
    pts.push([x, y]);
  }
  for (let k = 9; k >= 0; k--) {
    const [x, y] = skin(z, pf + ((1 - pf) * k) / 10, -INSET);
    pts.push([-x, y]);
  }
  const pos = [0, 0, z], idx = [];
  let cy = 0;
  for (const p of pts) cy += p[1];
  pos[1] = cy / pts.length;
  for (const p of pts) pos.push(p[0], p[1], z);
  for (let i = 0; i < pts.length; i++) idx.push(0, 1 + i, 1 + ((i + 1) % pts.length));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function deckFloor() {
  const zs = [BULK, (BULK + FRONT) / 2, FRONT];
  const pos = [], idx = [];
  for (const z of zs) {
    const x = skin(z, floorPy(z), -INSET)[0];
    pos.push(-x, FLOOR, z, x, FLOOR, z);
  }
  for (let i = 0; i < zs.length - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function b737Interior(def) {
  const eye = (def.cockpitView && def.cockpitView.eye) || def.cockpitEye;
  const group = new THREE.Group();
  // The walls and the floor are seen from inside, a face this way or that: their own materials,
  // two sided (the shared ones are one sided and used by the hull).
  const mats = [];
  const wallMat = inside(mats, 0x8e949b, 14, 0.6, true);
  const darkMat = inside(mats, 0x2a2e33, 28, 0.7);
  const panelMat = inside(mats, 0x474d54, 22, 0.7);
  const lightMat = inside(mats, 0x7d858d, 30, 0.6);
  const seatMat = inside(mats, 0x3b4a60, 10, 0.7);
  const trimMat = inside(mats, 0xd6d8da, 40, 0.6);
  const floorMat = inside(mats, 0x50555b, 12, 0.7, true);
  const screenDark = unlit(0x0a1721);
  const cyan = unlit(0x35c8ff);
  const green = unlit(0x37e27a);
  const amber = unlit(0xffb43a);
  const white = unlit(0xeaf2f6);
  const red = unlit(0xff4a3a);

  // The walls: the grid with the windows left open, the roof's two halves meeting on the crown.
  // They are one mesh, and the roof is the lighter half of it by the same material; a single
  // grey is enough, the screens and the glare are what read.
  const shellMesh = new THREE.Mesh(deckShell(COCKPIT_GLASS), wallMat);
  group.add(shellMesh);
  for (const z of [BULK, FRONT]) group.add(new THREE.Mesh(deckCap(z), z === BULK ? panelMat : darkMat));
  group.add(new THREE.Mesh(deckFloor(), floorMat));
  // The door in the rear bulkhead, and its handle.
  box(group, 0.62, 1.7, 0.03, 0, 0.55, BULK + 0.03, lightMat);
  box(group, 0.04, 0.1, 0.05, -0.2, 0.55, BULK + 0.06, trimMat);

  // The overhead panel, above and ahead of the two seats, with rows of switches and lights.
  const ceil = skin(13.9, 1, -INSET)[1];
  box(group, 1.0, 0.05, 1.05, 0, ceil - 0.05, 13.95, panelMat, [0.02, 0, 0]);
  const lampMats = [cyan, amber, green, white, red];
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 9; c++) {
      const m = lampMats[(r * 5 + c * 3) % lampMats.length];
      box(group, 0.045, 0.012, 0.045, -0.4 + c * 0.1, ceil - 0.078, 13.5 + r * 0.17, (r + c) % 3 === 0 ? m : lightMat);
    }
  }

  // The instrument panel: a block, a face with six screens, the glareshield over it.
  const dash = new THREE.Group();
  dash.position.set(0, 0.4, 15.18);
  dash.rotation.x = -0.18;
  group.add(dash);
  box(dash, 2.1, 0.64, 0.14, 0, 0, 0, darkMat);
  const screen = (x, y, w, h, mat = screenDark) => {
    box(dash, w + 0.022, h + 0.022, 0.01, x, y, -0.073, lightMat);
    return box(dash, w, h, 0.004, x, y, -0.0782, mat);
  };
  const DU = 0.205;
  // Captain's displays, outboard first, the centre pair, and the first officer's.
  const horizons = [];
  for (const sx of [0.55, -0.55]) {
    screen(sx, 0.04, DU, DU, screenDark);
    const hz = horizon(DU / 2 * 0.94, 0x2a7fd8, 0x8c5a2c, 0xffffff);
    hz.group.position.set(sx, 0.04, -0.0815);
    dash.add(hz.group);
    horizons.push(hz);
    // The aircraft symbol over it, and a roll arc's marks.
    box(dash, 0.05, 0.008, 0.002, sx - 0.034, 0.04, -0.0835, amber);
    box(dash, 0.05, 0.008, 0.002, sx + 0.034, 0.04, -0.0835, amber);
    box(dash, 0.012, 0.012, 0.002, sx, 0.04, -0.0835, amber);
    // The speed and altitude tapes, either side.
    for (const tx of [-1, 1]) box(dash, 0.03, DU * 0.9, 0.002, sx + tx * (DU / 2 - 0.014), 0.04, -0.0825, darkMat);
  }
  for (const sx of [0.3, -0.3]) {
    screen(sx, 0.04, DU, DU, screenDark);
    const arc = new THREE.Mesh(new THREE.RingGeometry(0.07, 0.076, 40, 1, Math.PI * 0.18, Math.PI * 0.64), green);
    arc.position.set(sx, 0.02, -0.0815);
    arc.rotation.y = Math.PI;
    dash.add(arc);
    box(dash, 0.012, 0.03, 0.002, sx, 0.02, -0.0825, white);
    box(dash, 0.007, 0.07, 0.002, sx, 0.058, -0.0825, cyan);
  }
  // The centre stack: engine gauges above, a systems page below.
  screen(0, 0.115, DU, 0.17, screenDark);
  screen(0, -0.095, DU, 0.17, screenDark);
  for (const gx of [-0.045, 0.045]) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.03, 0.034, 28), green);
    ring.position.set(gx, 0.125, -0.0815);
    ring.rotation.y = Math.PI;
    dash.add(ring);
    box(dash, 0.004, 0.03, 0.002, gx, 0.135, -0.0825, white, [0, 0, 0.7]);
  }
  for (let k = 0; k < 5; k++) box(dash, 0.14 - k * 0.012, 0.007, 0.002, 0, -0.04 - k * 0.032, -0.0825, k % 2 ? cyan : green);
  // The gear lever, its knob a wheel, on the first officer's side of the stack.
  const gearLever = new THREE.Group();
  gearLever.position.set(-0.2, -0.22, -0.075);
  dash.add(gearLever);
  box(gearLever, 0.02, 0.02, 0.1, 0, 0, -0.05, lightMat);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), white);
  knob.position.set(0, 0, -0.105);
  gearLever.add(knob);
  // Under the panel, the block that closes the front of the deck.
  box(group, 2.05, 0.5, 0.45, 0, -0.1, 15.38, darkMat);
  // The glareshield with the autopilot panel on it.
  box(group, 2.0, 0.045, 0.6, 0, 0.695, 15.42, darkMat);
  box(group, 0.86, 0.06, 0.1, 0, 0.735, 15.38, panelMat);
  for (let k = 0; k < 14; k++) box(group, 0.03, 0.012, 0.03, -0.36 + k * 0.055, 0.77, 15.36, k % 4 === 0 ? green : trimMat);

  // The pedestal between the seats, with the throttles, the speed brake and the flap lever.
  box(group, 0.36, 0.36, 1.0, 0, -0.12, 14.55, panelMat);
  box(group, 0.34, 0.012, 0.92, 0, 0.066, 14.55, lightMat);
  const levers = [];
  const lever = (x, z, len, mat, tip) => {
    const g = new THREE.Group();
    g.position.set(x, 0.07, z);
    group.add(g);
    box(g, 0.035, len, 0.04, 0, len / 2, 0, darkMat);
    box(g, 0.05, 0.035, 0.07, 0, len + 0.015, 0.01, tip || mat);
    return g;
  };
  const throttleL = lever(0.055, 14.4, 0.17, lightMat, trimMat);
  const throttleR = lever(-0.055, 14.4, 0.17, lightMat, trimMat);
  const speedbrake = lever(0.145, 14.2, 0.14, lightMat, green);
  const flapLever = lever(-0.145, 14.6, 0.13, lightMat, white);
  levers.push(throttleL, throttleR, speedbrake, flapLever);
  // The trim wheels' slots, a few switches, the radios.
  for (let k = 0; k < 6; k++) box(group, 0.05, 0.012, 0.05, -0.09 + (k % 3) * 0.09, 0.075, 14.85 + Math.floor(k / 3) * 0.08, k % 2 ? amber : cyan);

  // Two yokes, a column and a wheel each; the wheel turns with the roll and the column comes
  // back with the pull.
  const yokes = [];
  for (const sx of [0.55, -0.55]) {
    const g = new THREE.Group();
    g.position.set(sx, 0.46, 14.72);
    group.add(g);
    box(g, 0.05, 0.05, 0.46, 0, -0.02, 0.23, darkMat);
    const wheel = new THREE.Group();
    g.add(wheel);
    box(wheel, 0.07, 0.07, 0.04, 0, 0, 0, darkMat);
    box(wheel, 0.34, 0.03, 0.03, 0, -0.1, 0, darkMat);
    box(wheel, 0.34, 0.03, 0.03, 0, 0.1, 0, darkMat);
    box(wheel, 0.03, 0.23, 0.03, 0.17, 0, 0, darkMat);
    box(wheel, 0.03, 0.23, 0.03, -0.17, 0, 0, darkMat);
    box(wheel, 0.025, 0.2, 0.03, 0, 0, 0, darkMat);
    yokes.push({ g, wheel, z0: g.position.z });
  }

  // The seats, behind each pilot: a pan, a back, a headrest.
  for (const sx of [0.55, -0.55]) {
    box(group, 0.5, 0.1, 0.52, sx, -0.1, 13.72, seatMat);
    box(group, 0.5, 0.66, 0.12, sx, 0.26, 13.46, seatMat, [-0.12, 0, 0]);
    box(group, 0.32, 0.2, 0.1, sx, 0.74, 13.4, seatMat, [-0.12, 0, 0]);
    box(group, 0.07, 0.12, 0.5, sx + 0.29, 0.12, 13.72, darkMat);
    box(group, 0.07, 0.12, 0.5, sx - 0.29, 0.12, 13.72, darkMat);
  }
  // The rudder pedals, either side, on the floor.
  for (const sx of [0.55, -0.55]) for (const px of [-0.1, 0.1]) box(group, 0.1, 0.16, 0.03, sx + px, -0.19, 15.0, lightMat, [-0.4, 0, 0]);

  finish(group);
  return {
    group,
    update(s, physics) {
      const a = attitude(s);
      for (const h of horizons) h.set(a);
      const pc = physics.pitchCmd || 0, rc = physics.rollCmd || 0;
      for (const y of yokes) {
        y.g.position.z = y.z0 - 0.08 * pc;
        y.wheel.rotation.z = rc * 1.1;
      }
      const t = physics.throttle || 0;
      throttleL.rotation.x = throttleR.rotation.x = -0.5 + t * 1.0;
      speedbrake.rotation.x = 0.3 - (s.airbrake || 0) * 0.9;
      flapLever.rotation.x = 0.35 - (s.flaps || 0) * 0.26;
      gearLever.rotation.x = (1 - (s.gear || 0)) * 0.6;
    },
    dispose() { disposeAll(group); for (const m of mats) m.dispose(); },
  };
}

// ---------------------------------------------------------------------------------------------
// The F-22's cockpit: a tub, two side consoles, a coaming with the head-up display on it and the
// panel below, an ejection seat, the stick, the left-hand throttles, and the canopy's arches.

function f22Interior(def) {
  const group = new THREE.Group();
  const mats = [];
  const grey = inside(mats, 0x5a6169, 14, 0.7, true);
  const dark = inside(mats, 0x2a2e33, 24, 0.7);
  const light = inside(mats, 0x8a929c, 28, 0.6);
  const seatMat = inside(mats, 0x454c56, 10, 0.7);
  const yellow = inside(mats, 0xe8b923, 30, 0.6);
  const frame = inside(mats, 0x3a404a, 40, 0.7);
  const screenDark = unlit(0x0a1721);
  const cyan = unlit(0x35c8ff);
  const green = unlit(0x37e27a);
  const amber = unlit(0xffb43a);
  const white = unlit(0xeaf2f6);
  const hudGlass = new THREE.MeshBasicMaterial({ color: 0x66ff99, transparent: true, opacity: 0.07, depthWrite: false, side: THREE.DoubleSide });

  // The tub: a floor, the walls that rise to the canopy's sill, the sill rails.
  box(group, 1.0, 0.05, 2.5, 0, 0.5, 2.9, grey);
  for (const sx of [1, -1]) {
    box(group, 0.07, 0.4, 2.4, sx * 0.5, 0.7, 2.95, grey);
    box(group, 0.06, 0.07, 3.4, sx * 0.575, 0.88, 2.9, frame);
  }

  // The canopy's arches: a rear bow behind the seat, the windscreen bow ahead of the display.
  const canopy = new Loft(CANOPY_STATIONS, 2.6, 24);
  const p = [0, 0];
  for (const z of [1.78, 3.62]) {
    const s = canopy.at(z);
    const pts = [];
    for (let k = 0; k <= 16; k++) {
      canopy.point(s, 0.12 + (0.76 * k) / 16, -0.02, p);
      pts.push(new THREE.Vector3(p[0], p[1], z));
    }
    const arch = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 32, 0.022, 6, false), frame);
    group.add(arch);
  }
  // The centre rib along the crown, behind the pilot only.
  const crown = [];
  for (let z = 1.78; z <= 2.5; z += 0.12) {
    const s = canopy.at(z);
    canopy.point(s, 0.5, -0.02, p);
    crown.push(new THREE.Vector3(0, p[1], z));
  }
  group.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(crown), 12, 0.018, 6, false), frame));

  // The dash: a block under the display, a thin glare strip over the panel's top edge, the
  // head-up display standing on it (a housing, and the glass the symbols are drawn on).
  box(group, 1.0, 0.6, 0.5, 0, 0.88, 3.98, dark);
  box(group, 0.86, 0.025, 0.3, 0, 1.14, 3.72, dark);
  box(group, 0.3, 0.05, 0.2, 0, 1.17, 3.6, dark);
  box(group, 0.2, 0.012, 0.1, 0, 1.2, 3.6, light);
  const hud = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.19), hudGlass);
  hud.position.set(0, 1.31, 3.5);
  hud.rotation.x = 0.3;
  group.add(hud);
  for (const sx of [1, -1]) box(group, 0.012, 0.19, 0.012, sx * 0.13, 1.31, 3.5, frame, [0.3, 0, 0]);
  box(group, 0.27, 0.012, 0.012, 0, 1.405, 3.51, frame, [0.3, 0, 0]);
  box(group, 0.27, 0.012, 0.012, 0, 1.215, 3.49, frame, [0.3, 0, 0]);

  // The panel face, tilted up toward the pilot, with three big screens over two small ones.
  const panel = new THREE.Group();
  panel.position.set(0, 0.88, 3.5);
  panel.rotation.x = 0.3;
  group.add(panel);
  box(panel, 0.98, 0.5, 0.06, 0, 0, 0.03, dark);
  const horizons = [];
  const scr = (x, y, w, h) => {
    box(panel, w + 0.02, h + 0.02, 0.01, x, y, -0.003, light);
    return box(panel, w, h, 0.004, x, y, -0.0075, screenDark);
  };
  for (const sx of [0.31, 0, -0.31]) scr(sx, 0.07, 0.25, 0.25);
  for (const sx of [0.16, -0.16]) scr(sx, -0.14, 0.15, 0.12);
  const hz = horizon(0.115, 0x2a7fd8, 0x8c5a2c, 0xffffff);
  hz.group.position.set(0, 0.07, -0.0105);
  panel.add(hz.group);
  horizons.push(hz);
  box(panel, 0.07, 0.008, 0.002, 0, 0.07, -0.012, amber);
  box(panel, 0.012, 0.016, 0.002, 0, 0.07, -0.012, amber);
  for (const sx of [0.31, -0.31]) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.07, 0.076, 36, 1, 0.3, Math.PI * 1.4), green);
    ring.position.set(sx, 0.07, -0.0105);
    ring.rotation.y = Math.PI;
    panel.add(ring);
    box(panel, 0.012, 0.012, 0.002, sx, 0.07, -0.012, cyan);
  }
  for (let k = 0; k < 4; k++) box(panel, 0.1 - k * 0.012, 0.006, 0.002, 0.16, -0.12 - k * 0.012, -0.0105, k % 2 ? cyan : white);

  // The side consoles' tops, with switches, and the throttles on the left.
  for (const sx of [1, -1]) {
    box(group, 0.15, 0.05, 1.3, sx * 0.42, 0.88, 2.95, dark, [0.0, 0, sx * -0.12]);
    for (let k = 0; k < 7; k++) box(group, 0.03, 0.012, 0.03, sx * 0.42, 0.915, 2.45 + k * 0.17, k % 2 ? amber : light);
  }
  const throttles = [];
  for (const dx of [0.04, -0.04]) {
    const g = new THREE.Group();
    g.position.set(0.42 + dx, 0.9, 2.95);
    group.add(g);
    box(g, 0.025, 0.14, 0.03, 0, 0.07, 0, dark);
    box(g, 0.04, 0.04, 0.07, 0, 0.145, 0.0, light);
    throttles.push(g);
  }

  // The stick: a short column between the knees, a grip on it that tilts with the inputs.
  const stick = new THREE.Group();
  stick.position.set(0, 0.52, 3.18);
  group.add(stick);
  box(stick, 0.03, 0.34, 0.03, 0, 0.17, 0, dark);
  box(stick, 0.05, 0.12, 0.06, 0, 0.38, 0, dark, [-0.15, 0, 0]);
  box(stick, 0.015, 0.02, 0.02, 0, 0.42, 0.03, amber);

  // The ejection seat: a back, a headbox, the pull handle, the side rails.
  box(group, 0.5, 0.78, 0.1, 0, 1.0, 2.42, seatMat, [-0.1, 0, 0]);
  box(group, 0.34, 0.24, 0.12, 0, 1.46, 2.37, seatMat, [-0.1, 0, 0]);
  box(group, 0.5, 0.08, 0.46, 0, 0.62, 2.7, seatMat);
  box(group, 0.2, 0.025, 0.04, 0, 1.6, 2.36, yellow);
  for (const sx of [1, -1]) box(group, 0.04, 0.5, 0.05, sx * 0.27, 1.1, 2.42, frame);

  finish(group);
  return {
    group,
    update(s, physics) {
      const a = attitude(s);
      for (const h of horizons) h.set(a);
      const pc = physics.pitchCmd || 0, rc = physics.rollCmd || 0;
      stick.rotation.x = -pc * 0.3;
      stick.rotation.z = rc * 0.35;
      const t = physics.throttle || 0;
      for (const g of throttles) g.rotation.x = -0.55 + t * 1.0;
    },
    dispose() { disposeAll(group); for (const m of mats) m.dispose(); },
  };
}

// A placeholder panel for an aircraft without a cockpit of its own.
function placeholder(def) {
  const group = new THREE.Group();
  const dark = glossy(0x1d2127, { shininess: 30 });
  const eye = (def.cockpitView && def.cockpitView.eye) || def.cockpitEye;
  box(group, 1.6, 0.5, 0.5, eye[0], eye[1] - 0.45, eye[2] + 0.7, dark);
  finish(group);
  return { group, update() {}, dispose() { disposeAll(group); } };
}

const BUILDERS = { b737: b737Interior, f22: f22Interior };
export function buildInterior(def) {
  const b = BUILDERS[def.model] || placeholder;
  return b(def);
}
