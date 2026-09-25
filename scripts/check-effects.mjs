// Milestone 8, headless: the ghost records and replays exactly, the gearbox
// never hunts, the wheel effects stay on the road and inside their pools, and
// the ghost car never touches a material a solid car is using.
//
//   npm run fx

import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';

const SRC = fileURLToPath(new URL('../src/', import.meta.url));
const { VehiclePhysics } = await import(SRC + 'game/VehiclePhysics.js');
const { Track } = await import(SRC + 'game/Track.js');
const { RacingLine } = await import(SRC + 'ai/RacingLine.js');
const { AIDriver } = await import(SRC + 'ai/AIDriver.js');
const { LapTimer } = await import(SRC + 'game/LapTimer.js');
const { GhostRecorder, encodeGhost, decodeGhost } = await import(SRC + 'game/Ghost.js');
const { Gearbox } = await import(SRC + 'game/Gearbox.js');
const { Effects } = await import(SRC + 'render/Effects.js');
const { GhostCar } = await import(SRC + 'render/GhostCar.js');
const { glossy } = await import(SRC + 'render/Materials.js');
const { CHASSIS } = await import(SRC + 'data/cars.js');
const { normalizeCar, carAppearance } = await import(SRC + 'data/customization.js');
const { SIM, GHOST, EFFECTS, GRIP } = await import(SRC + 'data/tuning.js');

const dir = SRC + 'data/tracks/';
const trackData = [];
for (const f of readdirSync(dir)) {
  if (!f.endsWith('.js') || f === 'index.js') continue;
  trackData.push((await import(dir + f)).default);
}
trackData.sort((a, b) => (a.order ?? 99) - (b.order ?? 99));

const dt = 1 / SIM.hz;
let failures = 0;
const check = (ok, label, detail = '') => {
  if (!ok) failures++;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${detail ? '   ' + detail : ''}`);
};

// --- the ghost ---------------------------------------------------------------
// The AI drives one timed lap from the grid with the real LapTimer, and the
// recorder rides along exactly as it does in the game.
function recordLap(track, line, chassis, prepare) {
  const p = new VehiclePhysics(chassis);
  const driver = new AIDriver(track, line, chassis, { name: 'ghost check' });
  const timer = new LapTimer(track, chassis.id);
  if (prepare) prepare(timer);
  const rec = new GhostRecorder();
  const sp = track.spawn();
  p.reset(sp.x, track.sample(sp.x, sp.z, sp.y).height + chassis.suspensionRest, sp.z, sp.yaw);
  let ghost = null;
  const truth = [];
  for (let k = 0; k < SIM.hz * 400 && timer.laps.length < 1; k++) {
    p.step(dt, driver.update(dt, p), track);
    timer.step(dt, p);
    const g = rec.step(timer, p, dt);
    if (g) ghost = g;
    if (timer.running && timer.laps.length === 0) truth.push(timer.clock - timer.lapStart, p.x, p.y, p.z);
  }
  return { ghost, lap: timer.laps[0], truth };
}

console.log('Ghost: recorded on the physics clock, replayed on the lap clock');
const pose = {};
for (const data of trackData) {
  const track = new Track(data);
  const line = new RacingLine(track);
  const { ghost, lap, truth } = recordLap(track, line, CHASSIS[0]);
  if (!lap) { check(false, `${data.name}: the AI finished a lap`); continue; }
  check(!!ghost, `${data.name}: a first clean lap is a record, and leaves a ghost`);
  if (!ghost) continue;
  const expect = Math.floor(lap.time * ghost.hz) + 1;
  check(ghost.time === lap.time && ghost.count >= expect && ghost.count <= expect + 1,
    `${data.name}: ${ghost.count} samples at ${ghost.hz} Hz for a ${lap.time.toFixed(3)} s lap, ending on the line`);
  // Replayed at the lap time of every physics step, the ghost must be where
  // the car was, to within interpolation between 30 Hz samples.
  let worst = 0;
  for (let i = 0; i < truth.length; i += 4) {
    if (!ghost.poseAt(truth[i], pose)) { worst = Infinity; break; }
    worst = Math.max(worst, Math.hypot(pose.x - truth[i + 1], pose.y - truth[i + 2], pose.z - truth[i + 3]));
  }
  check(worst < 0.03, `${data.name}: replay sits on the recorded car`, `worst ${(worst * 100).toFixed(2)} cm`);
  // Round trip through what localStorage holds.
  const json = JSON.stringify(encodeGhost(ghost));
  const back = decodeGhost(JSON.parse(json));
  let posErr = 0, angErr = 0;
  if (back) {
    for (let i = 0; i < ghost.frames.length; i++) {
      const e = Math.abs(back.frames[i] - ghost.frames[i]);
      if (i % 6 < 3) posErr = Math.max(posErr, e); else angErr = Math.max(angErr, e);
    }
  }
  check(!!back && back.count === ghost.count && back.time === ghost.time && posErr < 0.006 && angErr < 2e-4,
    `${data.name}: survives storage`, `${(json.length / 1024).toFixed(0)} KB, ${(posErr * 1000).toFixed(1)} mm, ${angErr.toExponential(1)} rad`);
}

{
  const track = new Track(trackData[0]);
  const line = new RacingLine(track);
  const assisted = recordLap(track, line, CHASSIS[0], (t) => t.setAssisted(true));
  check(assisted.lap && !assisted.ghost, 'an invalid lap never leaves a ghost', assisted.lap ? assisted.lap.reason : 'no lap');
  const slow = recordLap(track, line, CHASSIS[0], (t) => { t.best = 1; });
  check(slow.lap && slow.lap.valid && !slow.ghost, 'a clean lap slower than the record never replaces its ghost');
  const junk = [null, 7, {}, { format: 1 }, { format: 1, hz: 30, time: 10, count: 3, d: [1, 2] },
    { format: 1, hz: 30, time: 10, count: 2, d: [0, 0, 0, 0, 0, 0.5, 0, 0, 0, 0, 0, 0] },
    { format: 1, hz: 30, time: -4, count: 2, d: new Array(12).fill(0) }];
  check(junk.every((j) => decodeGhost(j) === null), 'anything that is not a ghost decodes to no ghost');
}

// --- the gearbox -------------------------------------------------------------
console.log('\nGearbox: heard and read, never felt');
const flat = {
  sample: () => ({ height: 0, normal: { x: 0, y: 1, z: 0 }, surface: 'tarmac', onTrack: true }),
  bounds: () => ({ lateral: 0, limit: 1e9, inwardX: 0, inwardZ: 0, onTrack: true }),
};
const drive = (throttle, brake) => ({ throttle, brake, steer: 0, handbrake: 0, steerIsAnalog: true, pedalsAreAnalog: true });
for (const chassis of CHASSIS) {
  const p = new VehiclePhysics(chassis);
  p.reset(0, chassis.suspensionRest, 0, 0);
  const gb = new Gearbox(chassis);
  const v = gb.voice;
  let ups = 0, downsAccel = 0, upsBraking = 0, lo = Infinity, hi = 0, top = 1;
  let gear = gb.gear;
  // Rendered at 60 Hz over a 120 Hz physics clock, as in the game.
  for (let f = 0; f < 60 * 40; f++) {
    p.step(dt, drive(1, 0), flat); p.step(dt, drive(1, 0), flat);
    gb.update(1 / 60, p.vLong, 1);
    if (gb.gear > gear) ups++; else if (gb.gear < gear) downsAccel++;
    gear = gb.gear; top = Math.max(top, gear);
    if (f > 30) { lo = Math.min(lo, gb.rpm); hi = Math.max(hi, gb.rpm); }
  }
  for (let f = 0; f < 60 * 30 && p.speed > 0.05; f++) {
    p.step(dt, drive(0, 1), flat); p.step(dt, drive(0, 1), flat);
    gb.update(1 / 60, Math.max(0, p.vLong), 0);
    if (gb.gear > gear) upsBraking++;
    gear = gb.gear;
  }
  for (let f = 0; f < 30; f++) gb.update(1 / 60, 0, 0);
  const ok = top >= v.gears - 1 && downsAccel === 0 && upsBraking === 0
    && lo >= v.idle - 1 && hi <= v.redline + 1 && gb.gear === 1 && gb.label === 'N';
  check(ok, `${chassis.name.padEnd(13)} up through ${top} of ${v.gears} gears, ${ups} changes, `
    + `${downsAccel} down under power, ${upsBraking} up under braking, `
    + `${Math.round(lo)}-${Math.round(hi)} rpm of ${v.idle}-${v.redline}, ends in ${gb.label}`);
}

// --- the manual gearbox --------------------------------------------------------
// The player's own gear, through the real physics. Shifting at the automatic's
// own points must drive exactly the automatic's car -- manual is a way to
// drive, not a faster car -- and every other choice has to cost something.
console.log('\nManual gearbox: felt when chosen, never quicker than the automatic');
{
  const { AUDIO } = await import(SRC + 'data/tuning.js');
  const { gearTop, voiceFor } = await import(SRC + 'game/Gearbox.js');
  // gearFor(p) is the gear for this step, or null for automatic.
  const run = (chassis, seconds, gearFor, brake = 0) => {
    const p = new VehiclePhysics(chassis);
    p.reset(0, chassis.suspensionRest, 0, 0);
    const input = drive(brake ? 0 : 1, brake);
    for (let k = 0; k < seconds * SIM.hz; k++) {
      const g = gearFor(p);
      input.manual = g !== null;
      input.gear = g ?? 1;
      p.step(dt, input, flat);
    }
    return p;
  };
  const mph = (ms) => (ms * 2.236936).toFixed(0);
  for (const chassis of CHASSIS) {
    const v = voiceFor(chassis.id);
    const auto = run(chassis, 20, () => null);
    let gear = 1;
    const shifted = run(chassis, 20, (p) => {
      while (gear < v.gears && p.vLong / chassis.topSpeed / gearTop(v, gear) > AUDIO.shiftUp) gear++;
      return gear;
    });
    const same = shifted.vLong === auto.vLong && shifted.z === auto.z;
    const cap = gearTop(v, 1) * chassis.topSpeed;
    const held = run(chassis, 14, () => 1);
    // Over the first second only: after that the quick cars are already on
    // first gear's limiter, and any gear that is still pulling gains on it.
    const firstGo = run(chassis, 1, () => 1);
    const topGo = run(chassis, 1, () => v.gears);
    const idle = run(chassis, 5, () => 0);
    const back = run(chassis, 3, () => 1, 1);
    const backN = run(chassis, 3, () => 0, 1);
    // A single-speed car's first gear is its top gear, so only a car with
    // more than one can pull away harder in first.
    const single = v.gears === 1;
    check(same && held.vLong <= cap + 0.05 && held.vLong > cap * 0.9
      && (single || topGo.vLong < firstGo.vLong * 0.8) && idle.speed < 0.05
      && back.vLong < -1 && Math.abs(backN.vLong) < 0.05,
      `${chassis.name.padEnd(13)} shifted at the redline ${same ? 'is' : 'is NOT'} the automatic (${gear} of ${v.gears}), `
      + `first runs out at ${mph(held.vLong)} of ${mph(cap)} mph, `
      + (single ? 'one gear, '
        : `top gear pulls away at ${Math.round((100 * topGo.vLong) / firstGo.vLong)}% of first, `)
      + `neutral ${idle.speed.toFixed(2)} m/s, reverse ${back.vLong.toFixed(1)} in gear and ${backN.vLong.toFixed(2)} in neutral`);
  }
  // The readout agrees with the drive: held in first it sits on the limiter,
  // and neutral revs freely up to it.
  const gb = new Gearbox(CHASSIS[0]);
  gb.setManual(true);
  const p = run(CHASSIS[0], 14, () => 1);
  for (let f = 0; f < 120; f++) gb.update(1 / 60, p.vLong, 1);
  const pinned = gb.limiting && gb.label === '1';
  gb.neutral();
  for (let f = 0; f < 120; f++) gb.update(1 / 60, 0, 1);
  check(pinned && gb.limiting && gb.label === 'N' && gb.rpm <= gb.voice.redline + 1,
    'the rev counter sits on the limiter where the drive cuts, and neutral revs up to it');
}

// --- the gearbox tune ------------------------------------------------------------
// The garage's gearbox tune, per chassis. A tune the same as stock must be the
// chassis itself, so nothing any other check measures can move; anything that
// is not a tune comes back stock; and every part of a tune is felt, in the
// direction the garage says, through the real physics.
console.log('\nGearbox tune: stock is the car itself, and every setting is felt');
{
  const { stockTune, normalizeTune, isStockTune, tunedChassis } = await import(SRC + 'game/Gearbox.js');
  const { straightLine } = await import(SRC + 'game/Performance.js');
  const { GEARBOX } = await import(SRC + 'data/tuning.js');
  const junk = [null, 7, 'short', {}, { finalDrive: 'short', tops: 'long', shiftUp: NaN }, { tops: [0.5] }];
  for (const chassis of CHASSIS) {
    const id = chassis.id, st = stockTune(id);
    const same = tunedChassis(chassis, st) === chassis
      && junk.every((j) => isStockTune(id, normalizeTune(id, j)));
    const base = straightLine(chassis);
    const run = (t) => straightLine(tunedChassis(chassis, { ...st, ...t }));
    // Shorter: at least as quick off the line, and out of revs sooner.
    const short = run({ finalDrive: GEARBOX.finalDriveMax });
    const long = run({ finalDrive: GEARBOX.finalDriveMin });
    let ok = same && short.topSpeedMph < base.topSpeedMph - 5 && long.topSpeedMph > base.topSpeedMph + 5
      && short.zeroToSixty <= base.zeroToSixty + 0.01 && long.zeroToSixty >= base.zeroToSixty - 0.01;
    let extra = '';
    if (st.tops.length > 1) {
      // Changing up early drops the revs out of the band; a short top gear
      // runs out on its limiter.
      const early = run({ shiftUp: GEARBOX.shiftPointMin });
      const tops = st.tops.slice();
      tops[tops.length - 1] = 0.8;
      const shortTop = run({ tops });
      ok = ok && early.quarterMile > base.quarterMile + 0.05 && shortTop.topSpeedMph < base.topSpeedMph - 5;
      extra = `, early shifts +${(early.quarterMile - base.quarterMile).toFixed(2)} s over the quarter, `
        + `a short top gear tops out at ${shortTop.topSpeedMph.toFixed(0)}`;
    }
    check(ok, `${chassis.name.padEnd(13)} ${same ? 'stock is the chassis' : 'stock is NOT the chassis'}, `
      + `final drive ${short.topSpeedMph.toFixed(0)}-${long.topSpeedMph.toFixed(0)} mph and `
      + `${short.zeroToSixty.toFixed(2)}-${long.zeroToSixty.toFixed(2)} s to 60${extra}`);
  }
  // A tuned car in automatic changes gear in the physics: never down under
  // power, never up under braking, and the rev counter shows the same gear.
  const c = tunedChassis(CHASSIS[0], { ...stockTune(CHASSIS[0].id), shiftUp: 0.8, finalDrive: 1.1 });
  const p = new VehiclePhysics(c);
  p.reset(0, c.suspensionRest, 0, 0);
  const gb = new Gearbox(c);
  let gear = p.autoGear, ups = 0, downs = 0, upsBraking = 0, agree = true;
  for (let f = 0; f < 60 * 40; f++) {
    p.step(dt, drive(1, 0), flat); p.step(dt, drive(1, 0), flat);
    gb.update(1 / 60, p.vLong, 1, true, p.autoGear);
    if (p.autoGear > gear) ups++; else if (p.autoGear < gear) downs++;
    gear = p.autoGear;
    if (gb.gear !== p.autoGear) agree = false;
  }
  const topGear = gear;
  for (let f = 0; f < 60 * 30 && p.speed > 0.05; f++) {
    p.step(dt, drive(0, 1), flat); p.step(dt, drive(0, 1), flat);
    if (p.autoGear > gear) upsBraking++;
    gear = p.autoGear;
  }
  check(topGear === c.gearing.gears && downs === 0 && upsBraking === 0 && agree && gear === 1,
    `a tuned automatic changes up through ${topGear} of ${c.gearing.gears} gears in the physics, `
    + `${downs} down under power, ${upsBraking} up under braking, readout ${agree ? 'in step' : 'OUT of step'}, stops in ${gear}`);
  const again = (() => {
    const q = new VehiclePhysics(c);
    q.reset(0, c.suspensionRest, 0, 0);
    for (let k = 0; k < SIM.hz * 20; k++) q.step(dt, drive(1, 0), flat);
    return q.z;
  })();
  const once = (() => {
    const q = new VehiclePhysics(c);
    q.reset(0, c.suspensionRest, 0, 0);
    for (let k = 0; k < SIM.hz * 20; k++) q.step(dt, drive(1, 0), flat);
    return q.z;
  })();
  check(again === once, 'a tuned car drives the same run the same way twice');
}

// --- effects -----------------------------------------------------------------
console.log('\nEffects: on the road, inside their pools, and gone when they are done');
const scene = new THREE.Scene();
const fx = new Effects(scene);
const chassis = CHASSIS[0];
const fake = {
  physics: {
    speed: 30, vLong: 30, vLat: 0, slipRear: 0, slipFront: 0, throttle: 1, handbrakeBlend: 0,
    cornerX: [0.81, -0.81, 0.81, -0.81], cornerZ: [1.02, 1.02, -1.53, -1.53],
    wheelGrounded: [true, true, true, true], wheelSurface: ['tarmac', 'tarmac', 'tarmac', 'tarmac'],
  },
  render: { x: 0, y: 0, z: 0, yaw: 0 },
  chassis,
};
for (const data of trackData) {
  const track = new Track(data);
  fx.setTrack(track);
  const q = fake.physics, r = fake.render;
  // A full lap in a permanent slide, weaving from one edge of the road to the
  // other so the marks cross the banking, at 60 frames a second.
  let dustSeen = 0, marksOnLoose = 0;
  const step = Math.max(1, Math.round(0.5 / track.ds));
  for (let i = 0, f = 0; i < track.count; i += step, f++) {
    const lat = Math.sin(f * 0.05) * (track.halfWidth[i] - 1.2);
    r.x = track.px[i] + track.lx[i] * lat;
    r.z = track.pz[i] + track.lz[i] * lat;
    r.yaw = Math.atan2(track.tx[i], track.tz[i]);
    r.y = track.sample(r.x, r.z, track.py[i]).height + 0.5;
    const s = Math.sin(r.yaw), c = Math.cos(r.yaw);
    for (let w = 0; w < 4; w++) {
      const wx = r.x + q.cornerX[w] * c + q.cornerZ[w] * s;
      const wz = r.z - q.cornerX[w] * s + q.cornerZ[w] * c;
      q.wheelSurface[w] = track.sample(wx, wz, r.y).surface;
    }
    q.slipRear = GRIP.peakSlipAngle * 1.8;
    const before = fx.skids.count;
    const alive = fx.particles.alive;
    fx.update([fake], 1 / 60);
    if (q.wheelSurface[2] !== 'tarmac' && q.wheelSurface[3] !== 'tarmac') {
      if (fx.particles.alive > alive) dustSeen++;
      if (fx.skids.count > before) marksOnLoose++;
    }
  }
  let worst = 0;
  const sk = fx.skids;
  for (let k = 0; k < sk.count; k++) {
    for (let v = 0; v < 4; v++) {
      const o = k * 12 + v * 3;
      const x = sk.pos[o], y = sk.pos[o + 1], z = sk.pos[o + 2];
      worst = Math.max(worst, Math.abs(y - track.sample(x, z, y).height));
    }
  }
  check(sk.count > 0 && worst < 0.06, `${data.name}: ${sk.count} skid segments, all on the road surface`,
    `worst ${(worst * 100).toFixed(1)} cm off it`);
  if (track.surface.includes('gravel')) {
    check(dustSeen > 0 && marksOnLoose === 0, `${data.name}: gravel throws dust and takes no skid marks`,
      `${dustSeen} frames of dust, ${marksOnLoose} marks`);
  }
  check(fx.particles.alive <= fx.particles.max && sk.count <= sk.max, `${data.name}: pools stay inside their limits`,
    `${fx.particles.alive}/${fx.particles.max} particles, ${sk.count}/${sk.max} segments`);
}
// Nothing new for longer than a mark lives: every particle gone, every mark faded.
for (let f = 0; f < Math.ceil((EFFECTS.skidLife + EFFECTS.skidFade + 2) * 10); f++) fx.update([], 0.1);
check(fx.particles.alive === 0 && fx.skids.count === 0, 'left alone, the smoke clears and the marks fade away');

// Launch smoke follows the drive, not the pedal. Rolling slowly in neutral
// with the throttle pinned only revs the engine and must leave the tyres
// clean; a real standing start must still light them up.
{
  const track = new Track(trackData[0]);
  fx.setTrack(track);
  const roll = (gear, from) => {
    const chassis = CHASSIS[0];
    const p = new VehiclePhysics(chassis);
    const sp = track.spawn();
    p.reset(sp.x, track.sample(sp.x, sp.z, sp.y).height + chassis.suspensionRest, sp.z, sp.yaw);
    p.vLong = from;
    const car = { physics: p, render: { x: 0, y: 0, z: 0, yaw: 0 }, chassis };
    const input = { ...drive(1, 0), manual: gear !== null, gear: gear ?? 1 };
    fx.particles.clear();
    fx.skids.clear();
    let most = 0;
    for (let f = 0; f < 60; f++) {
      p.step(dt, input, track); p.step(dt, input, track);
      Object.assign(car.render, { x: p.x, y: p.y, z: p.z, yaw: p.yaw });
      fx.update([car], 1 / 60);
      most = Math.max(most, fx.particles.alive);
    }
    return { most, marks: fx.skids.count };
  };
  const neutral = roll(0, 5);
  const launch = roll(null, 0);
  check(neutral.most === 0 && neutral.marks === 0 && launch.most > 0 && launch.marks > 0,
    'revving in neutral leaves the tyres clean, and a real launch still smokes',
    `neutral ${neutral.most} particles ${neutral.marks} marks, launch ${launch.most} particles ${launch.marks} marks`);
}

// --- graphics levels ---------------------------------------------------------
// A level is overrides on GRAPHICS and WORLD. A misspelt key would silently
// add a setting nothing reads, so every key must already exist; and Ultra,
// which names nothing, must put back exactly what tuning.js declares.
console.log('\nGraphics levels');
{
  const { GRAPHICS, WORLD, GRAPHICS_LEVELS, DEFAULT_GRAPHICS_LEVEL } = await import(SRC + 'data/tuning.js');
  const { setGraphicsLevel } = await import(SRC + 'render/GraphicsLevel.js');
  const declared = JSON.stringify({ GRAPHICS, WORLD });
  const unknown = [];
  for (const l of GRAPHICS_LEVELS) {
    for (const k of Object.keys(l.graphics || {})) if (!(k in GRAPHICS)) unknown.push(`${l.id}.graphics.${k}`);
    for (const k of Object.keys(l.world || {})) if (!(k in WORLD)) unknown.push(`${l.id}.world.${k}`);
  }
  check(unknown.length === 0, 'every level names only settings that exist', unknown.join(', '));
  const applied = GRAPHICS_LEVELS.every((l) => setGraphicsLevel(l.id) === l.id
    && Object.entries(l.graphics || {}).every(([k, v]) => GRAPHICS[k] === v)
    && Object.entries(l.world || {}).every(([k, v]) => WORLD[k] === v));
  check(applied, `${GRAPHICS_LEVELS.map((l) => l.name).join(', ')}: each applies its own values`);
  setGraphicsLevel('low');
  setGraphicsLevel('ultra');
  check(JSON.stringify({ GRAPHICS, WORLD }) === declared, 'back to Ultra puts back exactly what tuning.js declares');
  check(setGraphicsLevel('nonsense') === DEFAULT_GRAPHICS_LEVEL, 'an unknown saved level falls back to the default');
  setGraphicsLevel(DEFAULT_GRAPHICS_LEVEL);
}

// --- the ghost car -----------------------------------------------------------
console.log('\nGhost car');
{
  const solid = glossy(carAppearance(normalizeCar({ chassis: 'porsche-911' })).primary, { shininess: 70, specular: 0x4a4a52 });
  const gc = new GhostCar(scene);
  const fakeLap = { poseAt: (t, out) => { Object.assign(out, { x: 0, y: 1, z: 0, yaw: 0, pitch: 0, roll: 0 }); return true; } };
  gc.set(fakeLap, CHASSIS[0], carAppearance(normalizeCar({ chassis: 'porsche-911' })));
  let meshes = 0, bad = 0;
  gc.root.traverse((n) => {
    if (!n.isMesh) return;
    meshes++;
    for (const m of [].concat(n.material)) if (!m.transparent || !(m.opacity < 1) || n.castShadow) bad++;
  });
  gc.update(fakeLap, 1, { x: 50, z: 0 });
  check(meshes > 0 && bad === 0, `every one of its ${meshes} meshes is translucent and casts no shadow`);
  check(!solid.transparent && solid.opacity === 1, 'the solid cars\' shared paint is untouched');
  check(gc.visible && gc.root.visible, 'it shows while there is a lap to replay');
  gc.update(null, 1, { x: 0, z: 0 });
  check(!gc.visible && !gc.root.visible, 'and hides when there is not');
  gc.clear();
}

console.log(failures === 0
  ? '\nPASS: the ghost replays exactly, the gearbox never hunts, and the effects stay on the road.'
  : `\nFAIL: ${failures} effects check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
