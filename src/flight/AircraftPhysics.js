// ============================================================================
// AircraftPhysics
// ----------------------------------------------------------------------------
// A rigid body flown by lift, drag, thrust and gravity. Pure state and plain
// numbers: no Three.js, no DOM, no allocation in step(). Testable in Node.
//
// Frame: the same as the car bodies. Body axes +x LEFT, +y up, +z nose. The
// world has +y up, north +z, east -x. Orientation is a unit quaternion
// (body -> world) and the angular velocity is in body axes, all right-handed:
//   +wx is nose DOWN, +wy is nose LEFT, +wz is roll RIGHT (right wing down).
// There are no Euler angles in the model, which is how the pitch-sign bug in
// the car's history cannot happen here. Pitch, bank and heading come out of
// attitude() below, once, for the HUD and the camera.
//
// One step, in order:
//   1. air: density, speed of sound, airspeed in body axes, Mach, dynamic pressure
//   2. controls: ramp the stick, then the aids, then the surface deflections
//   3. forces: every lifting surface, body drag, the engines (with vectoring),
//      the landing gear and the hull against the ground
//   4. integrate (semi-implicit): rates, then orientation, then velocity, then position
//   5. bookkeeping: fuel, afterburner tank, engine state, load factor
// ============================================================================

import { SIM, FLIGHT, FLIGHT_OVERRIDES } from '../data/tuning.js';
import { atmosphere, createAtmosphere, calibratedAirspeed } from './Atmosphere.js';
import { Wing, Curve, MachTable } from './Wing.js';
import { Engine } from './Engine.js';
import { Gear } from './Gear.js';
import { createStructureHit } from '../world/AirportCollisions.js';
import { Damage } from './Damage.js';
import { FLIGHT_DAMAGE as D } from '../data/tuning.js';

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// Rotation matrix (body -> world), row major, from a unit quaternion.
function quatToMatrix(qx, qy, qz, qw, r) {
  const xx = qx * qx, yy = qy * qy, zz = qz * qz;
  const xy = qx * qy, xz = qx * qz, yz = qy * qz;
  const wx = qw * qx, wy = qw * qy, wz = qw * qz;
  r[0] = 1 - 2 * (yy + zz); r[1] = 2 * (xy - wz);     r[2] = 2 * (xz + wy);
  r[3] = 2 * (xy + wz);     r[4] = 1 - 2 * (xx + zz); r[5] = 2 * (yz - wx);
  r[6] = 2 * (xz - wy);     r[7] = 2 * (yz + wx);     r[8] = 1 - 2 * (xx + yy);
}

// Pitch (+ nose up), bank (+ right wing down) and compass heading (clockwise
// from north, 0..2pi), radians. The only place these signs are decided.
export function attitude(r, out) {
  const fx = r[2], fy = r[5], fz = r[8];       // nose, world axes
  out.pitch = Math.asin(clamp(fy, -1, 1));
  let h = Math.atan2(-fx, fz);
  if (h < 0) h += Math.PI * 2;
  out.heading = h;
  out.bank = Math.atan2(r[3], r[4]);           // left.y over up.y
  return out;
}

export function createAttitude() { return { pitch: 0, bank: 0, heading: 0 }; }

export function createRenderState() {
  return { x: 0, y: 0, z: 0, qx: 0, qy: 0, qz: 0, qw: 1,
    nozzle: 0, abLevel: 0, spool: 0, gear: 1, airbrake: 0, flaps: 0, steer: 0, wheelSpin: 0,
    surfaces: new Float64Array(8), compression: new Float64Array(4) };
}

// A quaternion from compass heading, pitch and bank. The inverse of attitude().
export function quatFromAttitude(heading, pitch, bank, out) {
  const hy = -heading / 2, hp = -pitch / 2, hr = bank / 2;
  // yaw about +y, then pitch about body x, then roll about body z
  const ay = Math.sin(hy), aw = Math.cos(hy);
  const bx = Math.sin(hp), bw = Math.cos(hp);
  const cz = Math.sin(hr), cw = Math.cos(hr);
  // (0, ay, 0, aw) * (bx, 0, 0, bw)
  let w = aw * bw;
  let x = aw * bx;
  let y = ay * bw;
  let z = -ay * bx;
  // ... * (0, 0, cz, cw)
  const w2 = w * cw - z * cz;
  const x2 = x * cw + y * cz;
  const y2 = y * cw - x * cz;
  const z2 = z * cw + w * cz;
  out.qw = w2; out.qx = x2; out.qy = y2; out.qz = z2;
  return out;
}

export class AircraftPhysics {
  constructor(def) {
    this.def = def;
    // How this aircraft feels: FLIGHT, with its own values (FLIGHT_OVERRIDES, if it has
    // any) laid over it. Read through the prototype, so an aircraft with none (the
    // F-22) reads FLIGHT itself, and a test that changes FLIGHT still reaches it.
    this.F = Object.assign(Object.create(FLIGHT), FLIGHT_OVERRIDES[def.id] || null);
    const curves = {};
    for (const [name, c] of Object.entries(def.curves)) {
      curves[name] = { lift: new Curve(c.lift), drag: new Curve(c.drag), stall: (c.stall * Math.PI) / 180 };
    }
    this.surfaces = def.surfaces.map((s) => new Wing(s, curves));
    this.liftMach = new MachTable(def.liftMach);
    this.waveCdA = new MachTable(def.waveCd);
    this.engines = def.engines.map((e) => new Engine({ ...e,
      spoolUp: e.spoolUp * this.F.engineSpoolUpScale,
      abUp: e.abUp * this.F.engineAbUpScale,
    }));
    this.gear = new Gear(def.gear.wheels, def.gear.hull, this.F);
    this.damage = new Damage(def);
    this.stallAlpha = (def.stallAlpha * Math.PI) / 180;
    // The flap detents (data/aircraft.js, `flaps`): per detent the flaps' shift of the
    // wings' zero-lift angle (rad), gain on their lift, drag (a coefficient on the wing
    // area) and the speed (m/s calibrated) they must not be out above. An aircraft with
    // none has one detent of nothing, which is exactly no flaps.
    const fl = def.flaps || { detents: [{ alpha: 0, gain: 0, cd: 0, vfe: Infinity }], time: 1 };
    this.flapDetents = fl.detents.length;
    this.flapAlphaD = Float64Array.from(fl.detents, (x) => x.alpha || 0);
    this.flapGainD = Float64Array.from(fl.detents, (x) => x.gain || 0);
    this.flapCdD = Float64Array.from(fl.detents, (x) => x.cd || 0);
    this.flapVfeD = Float64Array.from(fl.detents, (x) => (x.vfe == null ? Infinity : x.vfe));
    this.flapRate = (this.flapDetents - 1) / (fl.time || 1);       // detents a second
    this.flapAutoRetract = !!fl.autoRetract;
    // The spoilers' loss of the wings' lift at full extension, and whether the
    // afterburner exists at all (a turbofan's `ab` is its `dry`).
    this.liftDump = def.airbrakeLiftDump || 0;                    // on the ground: the wheels carrying weight
    this.liftDumpAir = def.airbrakeLiftDumpAir ?? this.liftDump;  // in the air
    this.hasAb = def.engines.some((e) => e.ab > e.dry);
    // Ground effect: within a wingspan of the ground the wings lift more (the air under them
    // is held), by `gain` at the ground, falling off as the square of how high the wings
    // are over `height`. An airliner's flare is cushioned by it; a fighter's is not modelled.
    const ge = def.groundEffect || null;
    this.geGain = ge ? ge.gain : 0;
    this.geHeight = ge ? ge.height : 1;
    this.geWing = ge ? ge.wingY : 0;
    // The tail skid point, for the tail strike protection: how far below the
    // centre of mass it sits when level, and how far behind.
    const skid = def.gear.hull.find((h) => h.skid);
    this.tailDrop = skid ? -skid.pos[1] : 0;
    this.tailArm = skid ? -skid.pos[2] : 0;
    // What the Hangar sets (data/loadouts.js): the mass carried and the three tune
    // scales. 1 and the data's own payload are the aircraft as fitted.
    this.payload = def.payload;
    this.tune = { power: 1, response: 1, assist: 1 };

    this.atm = createAtmosphere();
    this.r = new Float64Array(9);
    this.prevR = new Float64Array(9);
    this.structureHit = createStructureHit();
    this.structureVolumes = def.damage.flatMap((part, i) => (part.hits || []).map((h) => ({ x: h[0], y: h[1], z: h[2], radius: h[3], part: i, gear: part.kind === 'gear' })));
    this.defl = new Float64Array(this.surfaces.length);
    this._acc = { fx: 0, fy: 0, fz: 0, tx: 0, ty: 0, tz: 0 };
    this._wout = { fx: 0, fy: 0, fz: 0 };
    this._att = createAttitude();
    this._q = { qx: 0, qy: 0, qz: 0, qw: 1 };

    this.reset({});
  }

  // The Hangar's setup: { payload (kg), tune: { power, response, assist } }. Kept
  // across a reset; anything left out stays as it is.
  setup(s = {}) {
    if (s.payload != null) this.payload = s.payload;
    if (s.tune) Object.assign(this.tune, s.tune);
    if (s.damage) this.damage.load(s.damage);
    this._damageModifiers();
    for (const e of this.engines) e.power = this.tune.power;
    this.mass = this.def.emptyMass + this.payload + this.fuel;
  }

  // Apply health to reusable force components, including immediately after repair/reset.
  _damageModifiers() {
    const damage = this.damage;
    for (let i = 0; i < this.engines.length; i++) this.engines[i].health = damage.health[damage.enginePart[i]] ?? 1;
    this.gear.health = damage.health[damage.gear];
  }

  // Put the aircraft down. opts: { x, y, z, heading, pitch, bank, speed,
  // fuel (0..1 of the tank), onGround, throttle, gear }.
  reset(opts = {}) {
    const d = this.def;
    this.x = opts.x ?? 0; this.y = opts.y ?? 0; this.z = opts.z ?? 0;
    quatFromAttitude(opts.heading ?? 0, opts.pitch ?? 0, opts.bank ?? 0, this._q);
    this.qx = this._q.qx; this.qy = this._q.qy; this.qz = this._q.qz; this.qw = this._q.qw;
    quatToMatrix(this.qx, this.qy, this.qz, this.qw, this.r);
    const speed = opts.speed ?? 0;
    // Velocity along the nose.
    this.vx = this.r[2] * speed; this.vy = this.r[5] * speed; this.vz = this.r[8] * speed;
    this.wx = 0; this.wy = 0; this.wz = 0;
    this.fuel = (opts.fuel ?? 0.6) * d.fuelCapacity;
    this.mass = d.emptyMass + this.payload + this.fuel;

    // Pilot's controls, as the physics holds them.
    this.pitchCmd = 0; this.rollCmd = 0; this.yawCmd = 0;
    this.throttle = opts.throttle ?? (speed > 0 ? 0.8 : 0);
    this.trim = 0;
    this.pathRate = 0;
    this.abFuel = 1;
    this.abLocked = false;
    this.abWanted = false;
    this.gearDown = opts.gear ?? (speed > 0 ? 0 : 1);
    this.airbrake = 0;
    // The flaps, in detents (0 is up, or the F-22's scheduled flaps) and the three
    // things they do right now, read from the table at flapPos each step.
    this.flapPos = opts.flaps ?? 0;
    this.flapA = 0; this.flapG = 0; this.flapC = 0;
    this.nozzle = 0;
    this.defl.fill(0);
    for (const e of this.engines) e.reset(this.throttle);
    this.gear.reset();
    this.damage.resetContacts();
    this._damageModifiers();

    // Readouts.
    this.alpha = 0; this.beta = 0;
    this.tas = speed; this.cas = speed; this.mach = 0; this.qdyn = 0;
    this.nz = 1;
    this.nzRate = 0;
    this.gPullCap = 1; this.gPushCap = 1;
    this.agl = 0;
    this.parked = false;
    this.brake = 0;                // the wheel brake as applied: the pilot's and the taxi governor's
    this.altitude = this.y;
    this.climb = 0;
    this.thrustTotal = 0;
    this.stallWarn = false;
    this.stalled = false;
    this.onGround = false;
    this.crashed = false;
    this.crashReason = '';
    this.fuelFlow = 0;
    this.ax = 0; this.ay = 0; this.az = 0;

    this.snapshot();
  }

  snapshot() {
    this.prevR.set(this.r);
    this.prevX = this.x; this.prevY = this.y; this.prevZ = this.z;
    this.prevQx = this.qx; this.prevQy = this.qy; this.prevQz = this.qz; this.prevQw = this.qw;
  }

  get speed() { return Math.sqrt(this.vx * this.vx + this.vy * this.vy + this.vz * this.vz); }

  // What the game reads of the engines, whatever kind of aircraft: the mean spool
  // (0 idle to 1 full) and the mean afterburner level.
  get spool() {
    let s = 0;
    for (let i = 0; i < this.engines.length; i++) s += this.engines[i].n;
    return s / this.engines.length;
  }

  get abLevel() {
    let s = 0;
    for (let i = 0; i < this.engines.length; i++) s += this.engines[i].abLevel;
    return s / this.engines.length;
  }

  attitude() { return attitude(this.r, this._att); }

  // input: { pitch, roll, yaw (-1..1; pitch + is pull, roll + is right, yaw +
  // is right), analog, throttleRate (-1..1), throttleKick, ab, brake,
  // gearDown, airbrake }
  step(dt, input, ground) {
    this.snapshot();
    // A wreck stays where it fell. The skin's contact is stiff enough that
    // driving on through it at 200 m/s throws the numbers out of range, and
    // there is nothing to fly: the crash flow (milestone 5) takes over.
    if (!this.crashed && this.damage.health[this.damage.fuselage] === 0) { this.crashed = true; this.crashReason = 'lost its fuselage'; }
    if (this.crashed) {
      this.vx = 0; this.vy = 0; this.vz = 0;
      this.wx = 0; this.wy = 0; this.wz = 0;
      for (const e of this.engines) e.update(dt, 0, false, 1, 0, false);
      return;
    }
    const d = this.def;
    const F = this.F;
    const r = this.r;
    this._damageModifiers();
    const gearBefore = this.gearDown;

    // --- 1. the air ------------------------------------------------------
    const atm = atmosphere(this.y, this.atm);
    // Velocity through the air in body axes: the aircraft's own less the wind's (a
    // constant, OPEN_WORLD.wind, or none: a ground that has no wind is calm).
    const windX = ground.windX || 0, windZ = ground.windZ || 0;
    const vbx = r[0] * (this.vx - windX) + r[3] * this.vy + r[6] * (this.vz - windZ);
    const vby = r[1] * (this.vx - windX) + r[4] * this.vy + r[7] * (this.vz - windZ);
    const vbz = r[2] * (this.vx - windX) + r[5] * this.vy + r[8] * (this.vz - windZ);
    const v2 = vbx * vbx + vby * vby + vbz * vbz;
    const tas = Math.sqrt(v2);
    const mach = tas / atm.a;
    const qdyn = 0.5 * atm.rho * v2;
    this.tas = tas; this.mach = mach; this.qdyn = qdyn;
    this.cas = calibratedAirspeed(tas, atm.p, atm.a);
    this.alpha = tas > 1 ? Math.atan2(-vby, vbz) : 0;
    this.beta = tas > 1 ? Math.atan2(vbx, vbz) : 0;
    this.altitude = this.y;
    this.climb = this.vy;

    // --- 2. controls -----------------------------------------------------
    // The stick: digital keys ramp on the fixed clock, analog passes through.
    const analog = !!input.analog;
    this.pitchCmd = ramp(this.pitchCmd, input.pitch, analog, dt, F.pitchAttack, F.pitchRelease);
    this.rollCmd = ramp(this.rollCmd, input.roll, analog, dt, F.stickAttack, F.stickRelease);
    this.yawCmd = ramp(this.yawCmd, input.yaw, analog, dt, F.yawAttack, F.yawRelease);

    // The flaps move toward the lever's detent at the flap rate, and what they do is read
    // from the table between the two detents either side of where they are. An aircraft
    // whose flaps may be blown back (the fighter's combat setting) lets them up when it
    // goes too fast; an airliner's lever refuses to go out too fast (FlightGame) and does
    // not have them pulled in for it.
    {
      const last = this.flapDetents - 1;
      let want = input.flaps | 0;
      if (want > last) want = last; else if (want < 0) want = 0;
      if (this.flapAutoRetract) while (want > 0 && this.cas > this.flapVfeD[want]) want--;
      const step = this.flapRate * dt;
      const diff = want - this.flapPos;
      this.flapPos = diff > step ? this.flapPos + step : diff < -step ? this.flapPos - step : want;
      let i = Math.floor(this.flapPos);
      if (i > last) i = last;
      const j = i < last ? i + 1 : last, f = this.flapPos - i;
      this.flapA = this.flapAlphaD[i] + (this.flapAlphaD[j] - this.flapAlphaD[i]) * f;
      this.flapG = this.flapGainD[i] + (this.flapGainD[j] - this.flapGainD[i]) * f;
      this.flapC = this.flapCdD[i] + (this.flapCdD[j] - this.flapCdD[i]) * f;
    }

    // The throttle is a lever: held keys and the stick move it, the wheel kicks it.
    this.throttle = clamp(this.throttle + input.throttleRate * F.throttleRate * dt + input.throttleKick, 0, 1);
    input.throttleKick = 0;

    const onGround = this.gear.onGround;
    const grounded = onGround || this.gear.hullHit > 0;
    const att = attitude(r, this._att);
    this.agl = this.y - ground.sample(this.x, this.z, this.y).height;

    // Authority fades with dynamic pressure so the aircraft stays tame fast.
    // It schedules the stick and the damping. It does not schedule the trim:
    // the deflection that balances the airframe is geometry (the wings sit at
    // an incidence, so the tail has to be set against it), and is the same at
    // any speed. Faded with the stick, it ran out at Mach 1 and the aircraft
    // pitched up on its own.
    const fade = clamp(F.qFadeRef / (qdyn + 1), F.qFadeMin, 1);

    // The Hangar's control response scales the stick and the damping together, so
    // the aircraft is quicker or slower to answer with the same character. The aids
    // and the load limits below still act after it.
    const R = this.tune.response;
    let pitch = this.pitchCmd * R;
    let roll = this.rollCmd * R;
    let yaw = this.yawCmd * R;

    // Damping: the feel. Always on; set a gain to 0 to remove it.
    // The pitch damping is faded less than the stick (see dampFadePow): the
    // airframe's own stiffness grows with dynamic pressure, so damping that
    // stays put as the stick fades is, against it, weak at speed.
    pitch += -F.dampPitch * R * Math.pow(fade, F.dampFadePow - 1) * (-this.wx);   // pitch-up rate is -wx
    roll += -F.dampRoll * R * this.wz;           // roll-right rate is wz
    yaw += F.dampYaw * R * this.wy;              // yaw-right rate is -wy

    // The aids.
    // The flaps lift the wings' zero-lift angle, so the aircraft stalls at that much less
    // angle at the fuselage.
    const stallAlpha = this.stallAlpha - this.flapA;
    this.stalled = this.alpha > stallAlpha;
    this.stallWarn = !onGround && this.alpha > stallAlpha * F.warnAlpha && tas > 20;
    // The Hangar's flight assist scales the self levelling and the auto trim. The
    // softening, the load limits, the sideslip limiter and the tail guard are
    // safety, not assist, and are not touched by it.
    const A = this.tune.assist;
    if (F.aids) {
      // Angle-of-attack softening: pull fades out as the stall nears and the
      // nose is pushed down past it, so it mushes rather than snapping.
      const soft = smooth(stallAlpha * F.softAlpha, stallAlpha, this.alpha);
      if (pitch > 0) pitch *= 1 - soft;
      pitch -= F.softPush * soft;
      // The sideslip limiter: the rudder fades as the sideslip it makes grows.
      if (yaw * this.beta > 0) {
        yaw *= 1 - (1 - F.betaFloor) * smooth(F.betaLimit * 0.5, F.betaLimit, Math.abs(this.beta));
      }
      // The load limits: pull fades as the aircraft nears its structural g,
      // looking a little ahead along the load factor's rate; push fades the
      // same way toward the negative limit.
      // The load limits are a safety net, not the thing that sets the pull: the
      // stick's own authority settles a full pull at about 8.5 g and a full push
      // at about -2 (see dampPitch and pushAuthority), under both limits. Each
      // limit is a cap on the stick that INTEGRATES: it is cut at gCutRate per g
      // over the limit per second (looking gLead seconds ahead along the load
      // factor's rate) and given back at gRelease a second once under. A limit that
      // is a proportional fade of the stick with the load (the first versions) is
      // a feedback loop with a gain of five and the airframe's short period in it,
      // and it limit-cycled: the stabilators chattered two or three times a second
      // and the load swung by four g. An integrator with its crossover well under
      // the short period settles instead.
      const aheadNz = this.nz + this.nzRate * F.gLead;
      const overPull = aheadNz - d.gLimit, overPush = (d.gLimitNeg ?? -3) - aheadNz;
      this.gPullCap = clamp(this.gPullCap + (overPull > 0 ? -F.gCutRate * overPull : F.gRelease) * dt, 0, 1);
      this.gPushCap = clamp(this.gPushCap + (overPush > 0 ? -F.gCutRate * overPush : F.gRelease) * dt, 0, 1);
      if (pitch > 0) pitch *= this.gPullCap;
      else if (pitch < 0) pitch *= F.pushAuthority * this.gPushCap;

      // Tail strike protection. With the centre of mass `agl` over the ground, the
      // tail (tailArm behind it and tailDrop below it) is clear while sin(pitch)
      // stays under (agl - tailDrop - margin) / tailArm: the pull fades out as the
      // nose, looked at a little ahead, nears that, and is pushed back past it.
      if (this.tailArm > 0 && this.agl < F.tailGuardHeight) {
        const maxPitch = Math.asin(clamp((this.agl - this.tailDrop - F.tailMargin) / this.tailArm, 0, 1));
        const ahead = att.pitch - this.wx * F.tailLead;
        if (pitch > 0) pitch *= 1 - smooth(maxPitch - F.tailBand, maxPitch, ahead);
        pitch -= smooth(maxPitch, maxPitch + F.tailBand, ahead);
      }

      // Auto-trim: with the stick centred the trim integrates until the
      // flight path stops curving, so a speed change does not pitch the
      // aircraft. It holds any climb short of nearly vertical, and a shallow
      // dive only: in a steep dive it keeps the trim it has and stops
      // integrating, and the airframe's own stability does the recovering.
      const gamma = tas > 1 ? Math.asin(clamp(this.vy / tas, -1, 1)) : 0;
      const shallow = gamma < F.trimMaxClimb && gamma > -F.trimMaxPath;
      const flying = tas > F.trimMinSpeed && !grounded && !this.stalled;
      // The integrator's rate follows the fade, so the loop gain (the surface's
      // force grows with q, the rate falls with it) stays what it was.
      if (flying && shallow) {
        if (Math.abs(this.pitchCmd) < 0.03) {
          this.trim = clamp(this.trim - F.trimRate * A * fade * this.pathRate * dt, -F.trimLimit, F.trimLimit);
        } else if (Math.abs(this.pathRate) < F.trimSteady) {
          // Back pressure holding the path steady: trim it off.
          this.trim = clamp(this.trim + F.trimHold * A * fade * this.pitchCmd * dt, -F.trimLimit, F.trimLimit);
        }
      } else if (flying) {
        // Steep: it stops integrating but keeps the trim it found. Relaxing to
        // zero here (the first version) let the aircraft go: zero is not the
        // balanced setting at speed, so past a twenty degree climb the nose
        // kept coming up on its own, all the way to vertical.
      } else if (!grounded) {
        this.trim *= Math.exp(-dt / F.trimRelax);
      }

      // Roll self-levelling when the stick is centred, gently.
      if (flying && Math.abs(this.rollCmd) < 0.03 && Math.abs(att.pitch) < F.levelMaxPitch) {
        roll += clamp(-F.levelStrength * A * att.bank, -F.levelLimit * A, F.levelLimit * A);
      }
    }

    pitch = clamp(pitch, -1, 1);
    roll = clamp(roll, -1, 1);
    yaw = clamp(yaw, -1, 1);
    // The surfaces' pitch command: the scheduled stick plus the whole trim.
    const pitchOut = clamp(fade * pitch + (F.aids ? this.trim : 0), -1, 1);

    // --- 3. forces -------------------------------------------------------
    const acc = this._acc;
    acc.fx = 0; acc.fy = 0; acc.fz = 0; acc.tx = 0; acc.ty = 0; acc.tz = 0;
    const out = this._wout;
    const liftMach = this.liftMach.at(mach);
    const actK = 1 - Math.exp(-dt / F.actuatorTau);
    // The flight computer drops the flaperons and leading edges with the gear
    // down, and takes them up above flapUp (m/s of calibrated airspeed).
    // The flap lever's setting (this.flapA) is added to it, and with the flaps' gain on the
    // lift and the spoilers' dump of it, the wings that carry flaps get their lift scale
    // and the drag the flaps add (Wing.liftScale, Wing.cdAdd).
    const flapAlpha = d.flapAlpha * this.gearDown * clamp((F.flapUp - this.cas) / F.flapUpBand, 0, 1) + this.flapA;
    // Ground effect, for the aircraft that has it: a gain on the wings' lift that is the most
    // at the ground and nothing a `geHeight` up. The height is the wings': the centre of mass's
    // (agl) plus where the wings are against it (geWing, negative when they are below it).
    let geLift = 0;
    if (this.geGain > 0) {
      const k = 1 - (this.agl + this.geWing) / this.geHeight;
      if (k > 0) geLift = this.geGain * k * k;
    }
    // Spoilers: on the ground they dump most of the wing's lift so the brakes bite; in the air they
    // are a speed brake (mostly drag, a little lift lost), or the aircraft would drop out of the
    // sky instead of slowing. The two blend with the weight on the wheels.
    const dump = this.liftDumpAir + (this.liftDump - this.liftDumpAir) * clamp(this.gear.weightOnWheels / F.autoSpoilerWow, 0, 1);
    const wingLift = (1 + this.flapG) * (1 - dump * this.airbrake) * (1 + geLift);
    const surfaces = this.surfaces;
    for (let i = 0; i < surfaces.length; i++) {
      const s = surfaces[i];
      const part = this.damage.surfacePart[i];
      const health = this.damage.health[part] ?? 1;
      const wing = part >= 0 && this.damage.parts[part].kind === 'wing';
      s.liftScale = (s.flap ? wingLift : 1) * (wing ? (health === 0 ? 0 : 1 - (1 - health) * D.wingLiftLoss) : 1);
      s.cdAdd = (s.flap ? this.flapC : 0) + (wing ? (1 - health) * D.wingDrag : 0);
      const target = (s.cPitch * pitchOut + fade * (s.cRoll * roll + s.cYaw * yaw)) * (wing ? 1 : health) + s.flap * flapAlpha;
      this.defl[i] += (target - this.defl[i]) * actK;
      // Velocity of the surface through the air: v + w x r.
      const wx = vbx + (this.wy * s.pz - this.wz * s.py);
      const wy = vby + (this.wz * s.px - this.wx * s.pz);
      const wz = vbz + (this.wx * s.py - this.wy * s.px);
      s.force(wx, wy, wz, atm.rho, liftMach, this.defl[i], out);
      // A broken-off lifting part no longer supplies passive lift or drag either.
      if (health === 0) { out.fx = 0; out.fy = 0; out.fz = 0; }
      acc.fx += out.fx; acc.fy += out.fy; acc.fz += out.fz;
      acc.tx += s.py * out.fz - s.pz * out.fy;
      acc.ty += s.pz * out.fx - s.px * out.fz;
      acc.tz += s.px * out.fy - s.py * out.fx;
    }

    // Body drag: the fuselage, the wave drag that rises through Mach 1, the
    // gear and the airbrake. It acts against the airflow at the centre of mass.
    // The lever cannot raise the wheels while they carry the aircraft.
    const gearWant = input.gearDown || (F.gearLock && this.gear.weightOnWheels > F.gearLockWow);
    this.gearDown += clamp((gearWant ? 1 : 0) - this.gearDown, -dt / F.gearTime, dt / F.gearTime);
    // The spoilers: the pilot's, or an airliner's ground spoilers, which come out by
    // themselves with the weight on the wheels and the lever at idle (FLIGHT.autoSpoilers).
    const spoil = input.airbrake || (F.autoSpoilers && this.gear.weightOnWheels > F.autoSpoilerWow && this.throttle < F.autoSpoilerLever);
    this.airbrake += clamp((spoil ? 1 : 0) - this.airbrake, -dt / F.airbrakeTime, dt / F.airbrakeTime);
    if (tas > 0.5) {
      const cda = d.bodyCdA + d.refArea * this.waveCdA.at(mach) +
        d.gearCdA * this.gearDown + d.airbrakeCdA * this.airbrake;
      const k = -qdyn * cda / tas;
      acc.fx += k * vbx; acc.fy += k * vby; acc.fz += k * vbz;
    }

    // Engines, with thrust vectoring. The nozzle deflects with the pilot's
    // pull and its authority fades as the surfaces take over.
    const wantAb = !!input.ab && this.hasAb;
    this.abWanted = wantAb;
    const abOn = wantAb && !this.abLocked && this.abFuel > 0;
    const fuelOk = this.fuel > 0;
    const tvAuth = clamp(1 - qdyn / F.tvQ, 0, 1);
    this.nozzle = d.tvMax * tvAuth * pitch * this.damage.health[this.damage.tail];
    const sinN = Math.sin(this.nozzle), cosN = Math.cos(this.nozzle);
    let thrustTotal = 0, flow = 0, abMean = 0;
    for (let i = 0; i < this.engines.length; i++) {
      const e = this.engines[i];
      e.update(dt, abOn ? 1 : this.throttle, abOn, atm.sigma, mach, fuelOk);
      thrustTotal += e.thrust;
      flow += e.fuelFlow;
      abMean += e.abLevel;
      // Pull deflects the thrust downward at the tail, pitching the nose up.
      const fy = -e.thrust * sinN, fz = e.thrust * cosN;
      acc.fy += fy; acc.fz += fz;
      acc.tx += e.y * fz - e.z * fy;
      acc.ty += e.z * 0 - e.x * fz;
      acc.tz += e.x * fy - e.y * 0;
    }
    abMean /= this.engines.length;
    this.thrustTotal = thrustTotal;
    this.fuelFlow = flow * F.fuelBurn;

    // The taxi governor (FLIGHT.taxiLeverMax): on its wheels at a low lever the lever
    // asks for a speed and the brakes hold the aircraft to it. The pilot's own
    // brake is added to it, never taken from it.
    let brake = input.brake || 0;
    const gspd2 = this.vx * this.vx + this.vz * this.vz;
    if (F.groundAssist && this.gear.weightOnWheels > 0.5 && !abOn && this.throttle <= F.taxiLeverMax &&
        gspd2 < F.taxiSpeedMax * F.taxiSpeedMax) {
      const over = Math.sqrt(gspd2) - F.taxiSpeedPerLever * this.throttle;
      if (over > 0) brake = Math.max(brake, Math.min(F.taxiBrakeMax, over * F.taxiBrakeGain));
    }
    this.brake = brake;

    // Landing gear and the hull, against the ground. The nose wheel is steered by
    // the ramped pedal, so a tapped key is not a snap to full lock.
    this.gear.apply(this, ground, dt, this.yawCmd, brake, this.gearDown, this.mass, acc);

    // --- 4. integrate ----------------------------------------------------
    const m = this.mass;
    const Ix = m * d.gyration[0], Iy = m * d.gyration[1], Iz = m * d.gyration[2];
    // Euler's equations for a body with a diagonal inertia.
    const wdx = (acc.tx + (Iy - Iz) * this.wy * this.wz) / Ix;
    const wdy = (acc.ty + (Iz - Ix) * this.wz * this.wx) / Iy;
    const wdz = (acc.tz + (Ix - Iy) * this.wx * this.wy) / Iz;
    this.wx += wdx * dt; this.wy += wdy * dt; this.wz += wdz * dt;

    // Orientation: q' = q + 0.5 dt q (0, w), then renormalise.
    const h = 0.5 * dt;
    const qx = this.qx, qy = this.qy, qz = this.qz, qw = this.qw;
    const ex = qx + h * (qw * this.wx + qy * this.wz - qz * this.wy);
    const ey = qy + h * (qw * this.wy + qz * this.wx - qx * this.wz);
    const ez = qz + h * (qw * this.wz + qx * this.wy - qy * this.wx);
    const ew = qw + h * (-qx * this.wx - qy * this.wy - qz * this.wz);
    const inv = 1 / Math.sqrt(ex * ex + ey * ey + ez * ez + ew * ew);
    this.qx = ex * inv; this.qy = ey * inv; this.qz = ez * inv; this.qw = ew * inv;

    // Linear: the force in world axes (the matrix from before the rotation),
    // plus gravity.
    const ax = (r[0] * acc.fx + r[1] * acc.fy + r[2] * acc.fz) / m;
    const ay = (r[3] * acc.fx + r[4] * acc.fy + r[5] * acc.fz) / m - SIM.gravity;
    const az = (r[6] * acc.fx + r[7] * acc.fy + r[8] * acc.fz) / m;
    this.ax = ax; this.ay = ay; this.az = az;
    this.vx += ax * dt; this.vy += ay * dt; this.vz += az * dt;

    // The parking hold: on its wheels, the throttle at idle and hardly moving, the
    // aircraft stays put. Idle thrust beats the tyres' rolling resistance, so left
    // to the physics it creeps off and keeps accelerating; a real one would be
    // standing on its brakes. Static friction, in effect: it lets go the moment
    // the throttle comes up. It is done before the position moves, so not even a
    // step's worth of the creep gets through.
    // Standing on the brakes holds it too, up to a run-up (parkBrakeThrottle).
    this.parked = this.gear.weightOnWheels > 0.5 && !abOn &&
      this.vx * this.vx + this.vz * this.vz < F.parkSpeed * F.parkSpeed &&
      (this.throttle < F.parkThrottle || (brake > F.parkBrake && this.throttle < F.parkBrakeThrottle));
    if (this.parked) { this.vx = 0; this.vz = 0; this.wy = 0; }

    this.x += this.vx * dt; this.y += this.vy * dt; this.z += this.vz * dt;
    quatToMatrix(this.qx, this.qy, this.qz, this.qw, r);

    // Load factor: the specific force along the aircraft's up axis, in g, and
    // how fast it is changing (filtered: the limiter looks ahead along it).
    const nzNow = acc.fy / (m * SIM.gravity);
    this.nzRate += ((nzNow - this.nz) / dt - this.nzRate) * (1 - Math.exp(-dt / 0.05));
    this.nz = nzNow;

    // Flight path rate, for the trim: how fast the velocity vector is turning
    // in the vertical plane, from the acceleration just worked out.
    const sp = Math.sqrt(this.vx * this.vx + this.vy * this.vy + this.vz * this.vz);
    if (sp > 20) {
      const ux = this.vx / sp, uy = this.vy / sp, uz = this.vz / sp;
      const along = ax * ux + ay * uy + az * uz;
      const perpY = ay - along * uy;
      const cosG = Math.sqrt(Math.max(1e-4, 1 - uy * uy));
      const rate = perpY / sp / cosG;
      this.pathRate += (rate - this.pathRate) * (1 - Math.exp(-dt / F.trimFilter));
    } else {
      this.pathRate = 0;
    }

    // --- 5. bookkeeping --------------------------------------------------
    this.fuel = Math.max(0, this.fuel - this.fuelFlow * dt);
    this.mass = d.emptyMass + this.payload + this.fuel;
    if (abOn) {
      this.abFuel = Math.max(0, this.abFuel - (abMean * dt) / F.abDuration);
      if (this.abFuel <= 0) this.abLocked = true;
    } else {
      this.abFuel = Math.min(1, this.abFuel + dt / F.abRefill);
      if (this.abLocked && this.abFuel >= F.abRelight) this.abLocked = false;
    }

    this.onGround = this.gear.onGround;
    if (ground.collisions) {
      const hit = ground.collisions.sweep(this, dt, this.structureHit);
      if (hit.hit) {
        // Stop just before contact. Pose interpolation also stops a rotating wing at impact.
        const fraction = Math.max(0, hit.t - D.contactSkin / Math.max(D.contactSkin, this.speed * dt));
        this.x = this.prevX + (this.x - this.prevX) * fraction;
        this.y = this.prevY + (this.y - this.prevY) * fraction;
        this.z = this.prevZ + (this.z - this.prevZ) * fraction;
        const sign = this.prevQx * this.qx + this.prevQy * this.qy + this.prevQz * this.qz + this.prevQw * this.qw < 0 ? -1 : 1;
        this.qx = this.prevQx + (this.qx * sign - this.prevQx) * fraction;
        this.qy = this.prevQy + (this.qy * sign - this.prevQy) * fraction;
        this.qz = this.prevQz + (this.qz * sign - this.prevQz) * fraction;
        this.qw = this.prevQw + (this.qw * sign - this.prevQw) * fraction;
        const inverse = 1 / Math.hypot(this.qx, this.qy, this.qz, this.qw);
        this.qx *= inverse; this.qy *= inverse; this.qz *= inverse; this.qw *= inverse;
        quatToMatrix(this.qx, this.qy, this.qz, this.qw, this.r);
        this.damage.lose(hit.part, Math.max(0, hit.closing - D.objectDamageOnset) * D.objectDamageRate);
        if (hit.closing > D.objectCrashSpeed) {
          this.crashed = true; this.crashReason = 'hit an airport building';
          this.damage.set('fuselage', 0);
        }
        this.vx = 0; this.vy = 0; this.vz = 0;
        this.wx = 0; this.wy = 0; this.wz = 0;
      }
    }
    this.damage.limits(dt, this, gearBefore);
    const reason = this.crashed ? '' : this.damage.crashReason(this.gear, F);
    if (reason) {
      this.crashed = true; this.crashReason = reason;
      this.damage.set('fuselage', 0);
    } else if (!this.crashed) {
      this.damage.contacts(dt, this.gear, F);
      if (this.damage.health[this.damage.fuselage] === 0) {
        this.crashed = true; this.crashReason = 'lost its fuselage';
      }
    }
    if (!(this.x === this.x) || !(this.vx === this.vx) || !(this.qw === this.qw)) {
      this.crashed = true; this.crashReason = 'lost control';
    }
  }

  // Interpolated render state; alpha is the fraction between the last two steps.
  interpolate(alpha, out) {
    out.x = this.prevX + (this.x - this.prevX) * alpha;
    out.y = this.prevY + (this.y - this.prevY) * alpha;
    out.z = this.prevZ + (this.z - this.prevZ) * alpha;
    // Normalised lerp of the quaternion, taking the short way round.
    let dot = this.prevQx * this.qx + this.prevQy * this.qy + this.prevQz * this.qz + this.prevQw * this.qw;
    const s = dot < 0 ? -1 : 1;
    let x = this.prevQx + (s * this.qx - this.prevQx) * alpha;
    let y = this.prevQy + (s * this.qy - this.prevQy) * alpha;
    let z = this.prevQz + (s * this.qz - this.prevQz) * alpha;
    let w = this.prevQw + (s * this.qw - this.prevQw) * alpha;
    const inv = 1 / Math.sqrt(x * x + y * y + z * z + w * w);
    out.qx = x * inv; out.qy = y * inv; out.qz = z * inv; out.qw = w * inv;
    out.nozzle = this.nozzle;
    let ab = 0;
    for (let i = 0; i < this.engines.length; i++) ab += this.engines[i].abLevel;
    out.abLevel = ab / this.engines.length;
    let sp = 0;
    for (let i = 0; i < this.engines.length; i++) sp += this.engines[i].n;
    out.spool = sp / this.engines.length;
    out.gear = this.gearDown;
    out.airbrake = this.airbrake;
    out.flaps = this.flapPos;
    out.steer = this.gear.steerAngle;
    out.wheelSpin = this.gear.spin[0];
    for (let i = 0; i < this.defl.length && i < 8; i++) out.surfaces[i] = this.defl[i];
    for (let i = 0; i < this.gear.compression.length && i < 4; i++) out.compression[i] = this.gear.compression[i];
    return out;
  }
}

// The stick keys ramp toward the target at the attack rate going out and the
// release rate coming back, in physics time.
function ramp(cur, target, analog, dt, attack = FLIGHT.stickAttack, release = FLIGHT.stickRelease) {
  if (analog) return target;
  const out = Math.abs(target) > Math.abs(cur) || target * cur < 0;
  const rate = (out ? attack : release) * dt;
  const diff = target - cur;
  if (diff > rate) return cur + rate;
  if (diff < -rate) return cur - rate;
  return target;
}
