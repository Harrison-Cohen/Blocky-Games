// The inside of each cockpit, drawn in the Cockpit camera view (render/FlightCamera.js, CAM.COCKPIT)
// by a second pass with its own near plane (render/PostFX.js, OverlayPass): the walls and window
// openings, the instrument panel, the seats, the stick or the yokes, the throttle levers. Plain
// geometry, no textures. Physical displays use bounded vector batches and shared telemetry.
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
import { skin } from './b737.js';
import { NOSE_JOIN, buildNoseGeometry } from './b737Nose.js';
import { createInstrumentSet } from './FlightInstruments.js';

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

// Cockpit shell materials carry a little self illumination, freed with the interior.
function inside(list,hex,shininess=22,glow=.55,twoSided=false){
  const m=glossy(hex,{shininess}).clone();m.emissive.setHex(hex).multiplyScalar(glow);
  if(twoSided)m.side=THREE.DoubleSide;list.push(m);return m;
}

// ---------------------------------------------------------------------------------------------
// The Boeing 737-800 flight deck.

// Measurements, in body axes. The floor is a little under the passenger floor's height; the eye is
// at the level of the window sills' middle, so the horizon sits where it does through a real one.
const FLOOR = -0.3;
const BULK = NOSE_JOIN;   // the flight deck door's bulkhead
const FRONT = 15.6;   // the nose bulkhead
const INSET = 0.07;   // rear bulkhead's inset from the cabin skin

// The rear bulkhead closes on the same circular cabin tube as the exterior.
const floorPy = (z) => {
  const y0 = skin(z, 0)[1], y1 = skin(z, 1)[1];
  return (FLOOR - y0) / (y1 - y0);
};

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
  const pos = [-1.7, FLOOR, BULK, 1.7, FLOOR, BULK,
    -1.35, FLOOR, 14.35, 1.35, FLOOR, 14.35,
    -0.9, FLOOR, FRONT, 0.9, FLOOR, FRONT];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex([0, 1, 2, 1, 3, 2, 2, 3, 4, 3, 5, 4]);
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
  wallMat.side = THREE.BackSide;
  const darkMat = inside(mats, 0x2a2e33, 28, 0.7);
  const panelMat = inside(mats, 0x474d54, 22, 0.7);
  const lightMat = inside(mats, 0x7d858d, 30, 0.6);
  const seatMat = inside(mats, 0x3b4a60, 10, 0.7);
  const trimMat = inside(mats, 0xd6d8da, 40, 0.6);
  const floorMat = inside(mats, 0x50555b, 12, 0.7, true);
  const cyan = unlit(0x35c8ff);
  const green = unlit(0x37e27a);
  const amber = unlit(0xffb43a);
  const white = unlit(0xeaf2f6);
  const red = unlit(0xff4a3a);

  // Draw only the back faces of the exact exterior shell: offsetting each pane's
  // edges along different normals opens cracks at the windscreen/roof junction.
  const shell = buildNoseGeometry();
  for (const key of ['lower', 'deck', 'frames']) {
    const m = new THREE.Mesh(shell[key], wallMat);
    m.name = `b737-interior-${key}`;
    group.add(m);
  }
  shell.glass.dispose(); // Outside glass faces outward; no opaque pane over the pilot's view.
  group.add(new THREE.Mesh(deckCap(BULK), panelMat));
  group.add(new THREE.Mesh(deckFloor(), floorMat));
  // The door in the rear bulkhead, and its handle.
  box(group, 0.62, 1.7, 0.03, 0, 0.55, BULK + 0.03, lightMat);
  box(group, 0.04, 0.1, 0.05, -0.2, 0.55, BULK + 0.06, trimMat);

  // The overhead panel, above and ahead of the two seats, with rows of switches and lights.
  const ceil = 1.86;
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
  dash.position.set(0, 0.4, 14.86);
  dash.rotation.x = 0.15;
  group.add(dash);
  box(dash, 2.1, 0.64, 0.14, 0, 0, 0, darkMat).name='b737-main-panel';
  // Working flight/engine displays and the lower systems unit face the seated pilot.
  const mcp=new THREE.Group();mcp.position.set(0,.758,15.003);group.add(mcp);
  const lower=new THREE.Group();lower.position.set(0,.12,14.64);lower.rotation.x=.35;group.add(lower);
  box(lower,.57,.30,.04,0,0,.027,darkMat);
  const instruments=createInstrumentSet(def,{dash,mcp,lower});
  // The gear lever, its knob a wheel, on the first officer's side of the stack.
  const gearLever = new THREE.Group();
  gearLever.position.set(-0.36, -0.22, -0.075);
  dash.add(gearLever);
  box(gearLever, 0.02, 0.02, 0.1, 0, 0, -0.05, lightMat);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), white);
  knob.position.set(0, 0, -0.105);
  gearLever.add(knob);
  // Under the panel, the block that closes the front of the deck.
  box(group, 2.05, 0.5, 0.45, 0, -0.1, 15.06, darkMat).name='b737-lower-bulkhead';
  // The glareshield with the autopilot panel on it.
  box(group, 2.0, 0.045, 0.40, 0, 0.695, 15.00, darkMat).name='b737-glareshield';
  box(group, 1.24, 0.09, 0.06, 0, 0.758, 15.04, panelMat).name='b737-mode-control-housing';

  // The pedestal between the seats, with the throttles, the speed brake and the flap lever.
  const pedestal=new THREE.Group();pedestal.position.z=-.32;group.add(pedestal);
  box(pedestal, 0.36, 0.36, 0.70, 0, -0.12, 14.4, panelMat);
  box(pedestal, 0.34, 0.012, 0.68, 0, 0.066, 14.4, lightMat);
  const levers = [];
  const lever = (x, z, len, mat, tip) => {
    const g = new THREE.Group();
    g.position.set(x, 0.07, z);
    pedestal.add(g);
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
  for (let k = 0; k < 6; k++) box(pedestal, 0.05, 0.012, 0.05, -0.09 + (k % 3) * 0.09, 0.075, 14.66 + Math.floor(k / 3) * 0.08, k % 2 ? amber : cyan);

  // Two yokes, a column and a wheel each; the wheel turns with the roll and the column comes
  // back with the pull.
  const yokes = [];
  for (const sx of [0.55, -0.55]) {
    const g = new THREE.Group();
    g.position.set(sx, 0.18, 14.72);
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
    group, instruments,
    update(s, physics) {
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
  const cyan = unlit(0x35c8ff);
  const green = unlit(0x37e27a);
  const amber = unlit(0xffb43a);
  const white = unlit(0xeaf2f6);
  const hudGlass = unlit(0x66ff99,{transparent:true,opacity:.07});

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
  // Glass, frame and symbology share one plane, with a clear border on every side.
  const hudMount=new THREE.Group();hudMount.position.set(0,1.33,3.5);hudMount.rotation.x=.3;group.add(hudMount);
  const hud = new THREE.Mesh(new THREE.PlaneGeometry(.34,.26), hudGlass);
  hud.name='f22-hud-glass';hud.position.z=.005;hud.rotation.y=Math.PI;hudMount.add(hud);
  for (const sx of [1, -1]) box(hudMount,.012,.272,.012,sx*.176,0,.005,frame);
  for (const sy of [1, -1]) box(hudMount,.364,.012,.012,0,sy*.136,.005,frame);

  // The panel face, tilted up toward the pilot, with three big screens over two small ones.
  const panel = new THREE.Group();
  panel.position.set(0, 0.88, 3.5);
  panel.rotation.x = 0.3;
  group.add(panel);
  box(panel, 0.98, 0.65, 0.06, 0, 0, 0.03, dark);
  const instruments=createInstrumentSet(def,{panel,hud:hudMount});
  // The side consoles' tops, with switches, and the throttles on the left.
  for (const sx of [1, -1]) {
    box(group, 0.15, 0.05, 1.3, sx * 0.42, 0.74, 2.95, dark, [0.0, 0, sx * -0.12]);
    for (let k = 0; k < 7; k++) box(group, 0.03, 0.012, 0.03, sx * 0.42, 0.775, 2.45 + k * 0.17, k % 2 ? amber : light);
  }
  const throttles = [];
  for (const dx of [0.04, -0.04]) {
    const g = new THREE.Group();
    g.position.set(0.42 + dx, 0.76, 2.95);
    group.add(g);
    box(g, 0.025, 0.14, 0.03, 0, 0.07, 0, dark);
    box(g, 0.04, 0.04, 0.07, 0, 0.145, 0.0, light);
    throttles.push(g);
  }

  // The F-22 side-stick leaves the central display unobstructed.
  const stick = new THREE.Group();
  stick.position.set(-0.42, 0.58, 3.0);
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
    group, instruments,
    update(s, physics) {
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
  const panel=new THREE.Group();panel.position.set(eye[0],eye[1]-.45,eye[2]+.44);group.add(panel);
  const instruments=createInstrumentSet({...def,instrumentProfile:'generic'},{panel});
  finish(group);
  return { group, instruments, update() {}, dispose() { disposeAll(group); } };
}

const BUILDERS = { b737: b737Interior, f22: f22Interior };
export function buildInterior(def) {
  const b = BUILDERS[def.model] || placeholder;
  return b(def);
}
