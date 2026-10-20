// The AI cars lapping every track area.
//
// They are scenery with life, not a race: a few cars a track, each a recorded
// lap (see AmbientLap.js) replayed while you are far away and driven by the real
// VehiclePhysics and AIDriver when you come near. Which chassis and which paint
// come from the opponents list, by the track's own hash, so the same cars drive
// the same track on every launch.
//
// A track's cars cost something to set up (its racing line 50 ms, each lap 20-45
// ms), so they are made only when the camera first gets within a few kilometres,
// by a job the Streamer spreads over frames.
//
// Time here is the integer count of fixed physics steps (`n`): every car is at
// step n of its own lap, and a live one has stepped exactly n times.

import { RacingLine } from '../ai/RacingLine.js';
import { OPEN_WORLD } from '../data/tuning.js';
import { getChassis } from '../data/cars.js';
import { OPPONENTS } from '../data/opponents.js';
import { AmbientCar } from './AmbientLap.js';

const _w = { x: 0, z: 0 };

export class AmbientCars {
  constructor(world, cfg = OPEN_WORLD) {
    this.world = world;
    this.cfg = cfg;
    this.n = 0;                       // fixed steps taken
    this.byArea = new Map();          // area id -> { area, line, cars, status }
    this.liveCount = 0;
  }

  state(area) {
    let s = this.byArea.get(area.id);
    if (!s) { s = { area, line: null, cars: [], status: 'none' }; this.byArea.set(area.id, s); }
    return s;
  }

  // The cars that drive an area, as data: which opponent and which slot of the lap.
  roster(area) {
    const out = [];
    for (let k = 0; k < this.cfg.cars; k++) {
      const spec = OPPONENTS[(area.hash + k * 3) % OPPONENTS.length];
      out.push({ spec, chassis: getChassis(spec.chassis), slot: k });
    }
    return out;
  }

  // The job that makes an area's cars, for the Streamer.
  jobFor(area) {
    const s = this.state(area);
    if (s.status !== 'none') return null;
    s.status = 'building';
    const gen = this._setup(s);
    return { name: `cars:${area.id}`, priority: 10, step: () => gen.next().done };
  }

  *_setup(s) {
    const area = s.area;
    s.line = new RacingLine(area.track);
    yield;
    const slots = this.cfg.cars;
    for (const r of this.roster(area)) {
      const car = new AmbientCar(area.track, s.line, r.chassis, { name: r.spec.name, ...r.spec.style },
        r.slot, slots, this.cfg.keyEvery);
      car.spec = r.spec;
      car.area = area;
      for (const _ of car.record(700)) yield;
      if (car.ready) s.cars.push(car);
    }
    s.status = 'ready';
  }

  // One fixed physics step. Live cars take it; replayed ones need nothing.
  fixedStep() {
    this.n++;
    for (const s of this.byArea.values()) {
      if (s.status !== 'ready') continue;
      for (const car of s.cars) car.step();
    }
  }

  // Once a frame, with the camera's absolute position: put every car where it
  // is at step n, handing between replay and live by distance.
  update(camX, camZ) {
    const c = this.cfg;
    const near2 = c.liveRadius * c.liveRadius;
    const far2 = near2 * c.liveHysteresis * c.liveHysteresis;
    let live = 0;
    for (const s of this.byArea.values()) {
      if (s.status !== 'ready') continue;
      for (const car of s.cars) {
        if (!car.live) car.puppet(this.n);
        s.area.toWorld(car.physics.x, car.physics.z, _w);
        const dx = _w.x - camX, dz = _w.z - camZ;
        const d2 = dx * dx + dz * dz;
        if (car.live) {
          if (d2 > far2) car.goReplay();
        } else if (d2 < near2) {
          car.goLive(this.n);
        }
        if (car.live) live++;
      }
    }
    this.liveCount = live;
  }
}
