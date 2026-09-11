// Car bodywork geometry, headless.
//
// Cars are built from ~16 boxes each, positioned by hand from ratios of the
// chassis dimensions, and two things go wrong that nobody notices while
// reading the code:
//
//   A part hangs in mid air, because the bodywork it was meant to sit on does
//   not reach that far. The open-wheeler's tail lights floated 0.66 m behind
//   the back of the car for three milestones.
//
//   A part is sealed INSIDE another one, so it is never drawn at all. The
//   wheel rims spent a milestone invisible inside the tyres, and the truck's
//   headlights were entirely inside its own bull bar.
//
// Both are invisible in a diff and obvious on screen, which is the worst
// combination, so they get a test. Milestone 4 bolts spoilers and roof items
// onto these bodies, which is exactly where this class of bug multiplies.
//
//   npm run parts

import * as THREE from 'three';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('../src/', import.meta.url));

// The parts are merged into one mesh per material before buildCar returns, so
// there is nothing left to inspect afterwards. Record each box as it is placed
// instead: every part is translated into position exactly once, and the first
// mesh to be parented marks the end of the bodywork and the start of the
// wheels, which are built in their own local frames.
const boxes = [];
let bodyDone = false;
const translate = THREE.BufferGeometry.prototype.translate;
THREE.BufferGeometry.prototype.translate = function (x, y, z) {
  const r = translate.call(this, x, y, z);
  if (!bodyDone) { this.computeBoundingBox(); boxes.push(this.boundingBox.clone()); }
  return r;
};
const add = THREE.Object3D.prototype.add;
THREE.Object3D.prototype.add = function (o) {
  if (o && o.isMesh) bodyDone = true;
  return add.apply(this, arguments);
};

const { buildCar, LENS_DEPTH } = await import(SRC + 'game/CarBuilder.js');
const { CHASSIS } = await import(SRC + 'data/cars.js');
const { SIM, SUSPENSION } = await import(SRC + 'data/tuning.js');
const { LIVERIES, SPOILERS, ROOF_ITEMS, WHEEL_STYLES, carAppearance, DEFAULT_CAR } =
  await import(SRC + 'data/customization.js');

// Parts that share a face are joined, so contact is tested with a 2 mm
// tolerance rather than by demanding overlapping volume.
const TOUCH = 0.002;

const vol = (b) => Math.max(0, b.max.x - b.min.x) *
                   Math.max(0, b.max.y - b.min.y) *
                   Math.max(0, b.max.z - b.min.z);

const overlap = (a, b) => vol(new THREE.Box3(
  new THREE.Vector3(Math.max(a.min.x, b.min.x), Math.max(a.min.y, b.min.y), Math.max(a.min.z, b.min.z)),
  new THREE.Vector3(Math.min(a.max.x, b.max.x), Math.min(a.max.y, b.max.y), Math.min(a.max.z, b.max.z))));

// Fraction of `box` covered by the UNION of `others`, sampled. A max over
// single boxes is not enough: a lens can straddle two panels and be perfectly
// well carried by the pair of them.
const grow = (b, m) => new THREE.Box3(
  new THREE.Vector3(b.min.x - m, b.min.y - m, b.min.z - m),
  new THREE.Vector3(b.max.x + m, b.max.y + m, b.max.z + m));

function covered(box, others) {
  const N = 14;
  let inside = 0;
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) for (let k = 0; k < N; k++) {
    const x = box.min.x + (box.max.x - box.min.x) * (i + 0.5) / N;
    const y = box.min.y + (box.max.y - box.min.y) * (j + 0.5) / N;
    const z = box.min.z + (box.max.z - box.min.z) * (k + 0.5) / N;
    for (const o of others) {
      if (x >= o.min.x && x <= o.max.x && y >= o.min.y && y <= o.max.y &&
          z >= o.min.z && z <= o.max.z) { inside++; break; }
    }
  }
  return inside / (N * N * N);
}

let failures = 0;
const check = (ok, label, detail = '') => {
  if (!ok) failures++;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${detail ? '   ' + detail : ''}`);
};

// Every livery against every spoiler against every roof item, plus the
// numbers that light the most segments at two and four digits, and zero,
// which draws a roundel now rather than meaning "none". Cosmetics are the part
// of this that a player changes, so they are the part most likely to end up
// hanging in space.
const configs = [];
for (const livery of LIVERIES) {
  for (const spoiler of SPOILERS) {
    for (const roofItem of ROOF_ITEMS) {
      for (const number of [8, 88, 8888, 0]) {
        configs.push({ ...DEFAULT_CAR, livery: livery.id, spoiler: spoiler.id,
          roofItem: roofItem.id, number });
      }
    }
  }
}

for (const chassis of CHASSIS) {
  boxes.length = 0;
  bodyDone = false;
  buildCar(chassis);

  console.log(`\n${chassis.name}   ${boxes.length} parts`);

  // The four light lenses are the last things added. If that ever stops being
  // true this test would quietly measure the wrong boxes, so prove it.
  const lamps = boxes.slice(-4);
  const shell = boxes.slice(0, -4);
  const gotLamps = boxes.length >= 10 &&
    lamps.every((l) => Math.abs((l.max.z - l.min.z) - LENS_DEPTH) < 1e-6);
  check(gotLamps, 'the four light lenses were found', `${boxes.length} parts recorded`);
  if (!gotLamps) continue;

  // A lens is half sunk into the bodywork and half proud of it. Near zero it
  // is hanging in the air; near one it is sealed inside and never drawn.
  const names = ['head L', 'head R', 'tail L', 'tail R'];
  lamps.forEach((l, i) => {
    const frac = covered(l, shell);
    check(frac > 0.30 && frac < 0.80, `${names[i]} sits on bodywork`,
      `${(frac * 100).toFixed(0)}% sunk` + (frac >= 0.80 ? ' -- buried' : frac <= 0.30 ? ' -- floating' : ''));
  });

  // Nothing may hang in space, and nothing may be sealed inside a single
  // other part -- a fully enclosed box is never drawn, so it is pure cost.
  const floating = [];
  const hidden = [];
  boxes.forEach((box, i) => {
    let touches = false;
    let swallowed = false;
    boxes.forEach((other, j) => {
      if (i === j) return;
      if (grow(other, TOUCH).intersectsBox(box)) touches = true;
      if (grow(other, 1e-4).containsBox(box)) swallowed = true;
    });
    if (!touches) floating.push(i);
    if (swallowed) hidden.push(i);
  });
  check(floating.length === 0, 'every part touches the rest of the car',
    floating.length ? `parts ${floating.join(', ')} float` : '');
  check(hidden.length === 0, 'no part is sealed inside another',
    hidden.length ? `parts ${hidden.join(', ')} never drawn` : '');

  // No bodywork inside a tyre, including a front tyre turned to full lock,
  // where the wheel sweeps much wider than its own width. Bodywork ABOVE the
  // arch line is meant to sit over the tyre -- that is what an arch is -- so
  // only the part of the wheel below that line is off limits.
  const halfTrack = chassis.trackWidth * 0.5;
  const wheelWidth = chassis.wheelRadius * (chassis.profile === 'truck' ? 0.95 : 0.78);
  const wheelHalfW = wheelWidth * 0.66;
  const lock = chassis.steerRate;
  const sweptX = wheelHalfW * Math.cos(lock) + chassis.wheelRadius * Math.sin(lock);
  const sweptZ = chassis.wheelRadius * Math.cos(lock) + wheelHalfW * Math.sin(lock);
  const squash = (chassis.mass * SIM.gravity) / (4 * SUSPENSION.springRate);
  const wheelY = chassis.wheelRadius - (chassis.suspensionRest - squash);
  const archY = wheelY + chassis.wheelRadius * 0.30;
  const a = chassis.wheelbase * (1 - chassis.weightDistribution);
  const b = chassis.wheelbase * chassis.weightDistribution;

  let worst = 0;
  for (const sx of [1, -1]) {
    for (const [z, ex, ez] of [[a, sweptX, sweptZ], [-b, wheelHalfW, chassis.wheelRadius]]) {
      const tyre = new THREE.Box3(
        new THREE.Vector3(sx * halfTrack - ex, wheelY - chassis.wheelRadius, z - ez),
        new THREE.Vector3(sx * halfTrack + ex, Math.min(wheelY + chassis.wheelRadius, archY), z + ez));
      for (const s of shell) worst = Math.max(worst, overlap(s, tyre));
    }
  }
  check(worst < 1e-6, 'no bodywork inside a tyre at full lock', `${worst.toFixed(5)} m3`);

  // Now the whole cosmetic matrix. Only the structural checks run here: the
  // lens seating cannot change, because no cosmetic option moves a lamp.
  // Bodywork indices are stable -- cosmetics are appended after the shell and
  // before the lamps -- and the shell was already proven visible above. A
  // livery panel is MEANT to cover the panel it is painted on, so only the
  // cosmetic parts are asked not to be hidden.
  const shellCount = boxes.length - 4;
  const broken = [];
  for (const car of configs) {
    boxes.length = 0;
    bodyDone = false;
    buildCar(chassis, carAppearance(car));
    const bad = [];
    boxes.forEach((box, i) => {
      let touches = false;
      let swallowed = false;
      boxes.forEach((other, j) => {
        if (i === j) return;
        if (grow(other, TOUCH).intersectsBox(box)) touches = true;
        if (grow(other, 1e-4).containsBox(box)) swallowed = true;
      });
      if (!touches) bad.push(`${i} floats`);
      if (swallowed && i >= shellCount) bad.push(`${i} hidden`);
    });
    if (bad.length) {
      broken.push(`${car.livery}/${car.spoiler}/${car.roofItem}/#${car.number}: ${bad.join(', ')}`);
    }
  }
  check(broken.length === 0, `all ${configs.length} cosmetic combinations hold together`,
    broken.slice(0, 3).join('  |  '));

  // Wheels are their own meshes rather than merged bodywork, so they are
  // checked by building each style and asking that it produced geometry.
  for (const style of WHEEL_STYLES) {
    const built = buildCar(chassis, carAppearance({ ...DEFAULT_CAR, wheelStyle: style.id }));
    let tris = 0;
    built.wheels[0].traverse((o) => {
      if (o.isMesh) tris += o.geometry.index ? o.geometry.index.count / 3 : o.geometry.attributes.position.count / 3;
    });
    check(built.wheels.length === 4 && tris > 100, `wheel style "${style.id}" builds`, `${tris} triangles`);
  }
}

// --- on a hill --------------------------------------------------------------
// The bodywork is drawn from the model's pitch and roll, and each wheel from
// its corner's spring. A slip in either is invisible on the flat and obvious
// on a hill, and there were two: the body tipped nose-DOWN into every climb,
// because the model's nose-up pitch reached three.js unnegated, and the wheels
// sank into the uphill side of the road because their height ignored the
// body's tilt. The car looked as though it was driving through the hill.
//
// So park every chassis on Pine Ridge's steepest climb and steepest descent,
// let it settle on its springs, and ask that all four tyres are on the road
// and the body leans the same way the road does.
{
  const { Vehicle } = await import(SRC + 'game/Vehicle.js');
  const { Track } = await import(SRC + 'game/Track.js');
  const track = new Track((await import(SRC + 'data/tracks/pine-ridge.js')).default);
  let up = 0, down = 0, gu = 0, gd = 0;
  for (let i = 0; i < track.count; i++) {
    const j = (i + 6) % track.count;
    const gr = (track.py[j] - track.py[i]) / (6 * track.ds);
    if (gr > gu) { gu = gr; up = i; }
    if (gr < gd) { gd = gr; down = i; }
  }
  const idle = { throttle: 0, brake: 0, steer: 0, handbrake: 0, steerIsAnalog: true, pedalsAreAnalog: true };
  const p = new THREE.Vector3();
  console.log('\nParked on a hill');
  for (const chassis of CHASSIS) {
    for (const [label, i, grade] of [['climb', up, gu], ['descent', down, gd]]) {
      const v = new Vehicle(chassis);
      const sp = track.spawnAt(i);
      v.physics.reset(sp.x, track.sample(sp.x, sp.z, sp.y).height + v.physics.restLength, sp.z, sp.yaw);
      for (let s = 0; s < SIM.hz * 2; s++) v.step(1 / SIM.hz, idle, track);
      v.updateVisual(1, 1 / 60);
      v.root.updateMatrixWorld(true);
      const gaps = v.wheels.map((w) => {
        w.getWorldPosition(p);
        return p.y - chassis.wheelRadius - track.sample(p.x, p.z, p.y).height;
      });
      const worst = Math.max(...gaps.map(Math.abs));
      const half = chassis.bodyLength / 2;
      const noseY = v.body.localToWorld(p.set(0, 0, half)).y;
      const tailY = v.body.localToWorld(p.set(0, 0, -half)).y;
      const lean = (noseY - tailY) / (2 * half);
      const withHill = Math.sign(lean) === Math.sign(grade) && Math.abs(lean) > Math.abs(grade) * 0.5;
      check(worst < 0.02 && withHill,
        `${chassis.name.padEnd(13)} on the steepest ${label.padEnd(7)} (${(grade * 100).toFixed(0)}%)`,
        `tyres within ${(worst * 100).toFixed(1)} cm of the road, body leans ${(lean * 100).toFixed(1)}%`);
    }
  }
}

console.log(failures === 0
  ? '\nPASS: every part sits on the car, and the car sits on the road.'
  : `\nFAIL: ${failures} bodywork check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
