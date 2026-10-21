// A jet engine: thrust from the throttle, the altitude and the Mach number,
// with the spool lag a real one has and an afterburner on top.
//
// Headless: plain numbers, no allocation in update().
//
//   thrust = dry * spool-fraction * density^kd * machDry(M)
//          + (ab - dry) * afterburner-level * density^ka * machAb(M)
//
// The Mach tables carry ram recovery: a fighter engine makes more thrust at
// Mach 1.5 than the same engine at Mach 0.5, which is what makes supercruise
// possible at all. They are fitted (scripts/fit-aircraft.mjs) so the aircraft
// meets its published top speed and supercruise Mach.
//
// The afterburner's tank is the aircraft's, not the engine's, so it lives in
// AircraftPhysics. The engine only says how much afterburner it is making.

import { MachTable } from './Wing.js';

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

export class Engine {
  // def: { x, y, z (the nozzle, body axes), dry, ab (N, sea level static),
  //        idle (fraction of dry at idle), kDry, kAb (density exponents),
  //        machDry, machAb (tables), spoolUp, spoolDown, abUp, abDown (s),
  //        sfcDry, sfcAb (kg per N per s) }
  constructor(def) {
    this.x = def.x; this.y = def.y; this.z = def.z;
    this.dry = def.dry;
    this.ab = def.ab;
    this.idle = def.idle;
    this.kDry = def.kDry;
    this.kAb = def.kAb;
    this.machDry = new MachTable(def.machDry);
    this.machAb = new MachTable(def.machAb);
    this.spoolUp = def.spoolUp;
    this.spoolDown = def.spoolDown;
    this.abUp = def.abUp;
    this.abDown = def.abDown;
    this.sfcDry = def.sfcDry;
    this.sfcAb = def.sfcAb;
    // The Hangar's tuning: a scale on thrust and fuel flow, 1 as fitted. Set from
    // outside and kept across a reset.
    this.power = 1;

    this.reset();
  }

  reset(n = 0) {
    this.n = n;           // spool, 0 idle .. 1 military power
    this.abLevel = 0;     // 0..1
    this.thrust = 0;      // N, along the engine axis before any vectoring
    this.fuelFlow = 0;    // kg/s
    this.health = 1;      // damage multiplier, 0..1 (milestone 5)
    this.running = true;
  }

  // throttle 0..1 is the lever, wantAb whether the afterburner is selected.
  // sigma is the density ratio, mach the Mach number. fuelOk is false when
  // the tank is empty.
  update(dt, throttle, wantAb, sigma, mach, fuelOk) {
    const lit = this.running && fuelOk;
    const target = lit ? clamp01(throttle) : 0;
    const tau = target > this.n ? this.spoolUp : this.spoolDown;
    this.n += (target - this.n) * (1 - Math.exp(-dt / tau));
    if (!lit) this.n *= Math.exp(-dt / this.spoolDown);

    // The afterburner needs the engine at military power to light.
    const abTarget = lit && wantAb && this.n > 0.93 ? 1 : 0;
    const abTau = abTarget > this.abLevel ? this.abUp : this.abDown;
    this.abLevel += (abTarget - this.abLevel) * (1 - Math.exp(-dt / abTau));

    const spoolFrac = this.idle + (1 - this.idle) * this.n;
    const dryPart = this.dry * spoolFrac * Math.pow(sigma, this.kDry) * this.machDry.at(mach);
    const abPart = (this.ab - this.dry) * this.abLevel * Math.pow(sigma, this.kAb) * this.machAb.at(mach);
    const t = (dryPart + abPart) * this.health * this.power;
    this.thrust = lit || this.n > 0.02 ? t : 0;
    this.fuelFlow = lit ? (this.sfcDry * dryPart + this.sfcAb * abPart) * this.power : 0;
    return this.thrust;
  }
}
