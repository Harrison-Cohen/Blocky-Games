// ============================================================================
// AIDriver
// ----------------------------------------------------------------------------
// Produces the same input struct the keyboard produces, and nothing else. It
// never touches the car's position, velocity or yaw: an AI car is a
// VehiclePhysics with a different thing holding the controls, so it is subject
// to exactly the grip, the weight transfer and the surfaces the player is.
// If the AI can do it, you can do it.
//
// Steering is pure pursuit toward a point on the racing line, with the
// lookahead growing with speed. Throttle and brake come from the difference
// between the speed the car is doing and the speed the profile says it should
// be doing shortly ahead.
//
// Two things stop it looking like a machine following a rail:
//
//   Every driver has a style -- how close to the tyre's peak they run, how
//   early they release the brakes, how far off the line they habitually sit,
//   how quickly they move their hands. Those feed the speed profile as well as
//   the controls, so two drivers take genuinely different lines and speeds
//   rather than the same one at different volumes.
//
//   The aim point drifts. A slow, deterministic wander of a few tens of
//   centimetres, which fades out where the road is turning, because a driver is
//   untidy on a straight and precise at an apex. It is seeded per driver and
//   advanced on the fixed clock, so it is repeatable and identical at any
//   frame rate.
//
// update() is called from inside the fixed physics step, never from the frame
// callback -- the same rule the player's input smoothing follows, and for the
// same reason.
// ============================================================================

import { AI } from '../data/tuning.js';
import { SpeedProfile } from './SpeedProfile.js';

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

// A driver's habits. Everything here is allowed to differ between opponents and
// none of it may reach the car's stat block.
export const DEFAULT_STYLE = {
  name: 'Pace car',
  gripUse: AI.gripUse,       // fraction of the tyre's peak they are willing to use
  brakeMargin: AI.brakeMargin, // how hard they are prepared to brake, relative
  lineBias: 0,               // metres they habitually sit off the racing line
  wander: 0.35,              // metres of drift around their aim point
  wanderRate: 0.55,          // radians/second of that drift
  phase: 0,                  // so two drivers do not wander in unison
  reaction: AI.steerRate,    // units/second of steering travel
};

export class AIDriver {
  constructor(track, line, chassis, style = {}) {
    this.track = track;
    this.line = line;
    this.chassis = chassis;
    this.style = { ...DEFAULT_STYLE, ...style };
    this.profile = new SpeedProfile(track, line, chassis, this.style);

    // Reused, because this runs 120 times a second per car.
    this.input = {
      throttle: 0, brake: 0, steer: 0, handbrake: 0,
      steerIsAnalog: true, pedalsAreAnalog: true,
    };
    this._aim = { x: 0, z: 0, index: 0 };
    this._steer = 0;
    this._throttle = 0;
    this._brake = 0;
    this._clock = 0;
    this.targetSpeed = 0;
    this.sample = 0;
  }

  reset() {
    this._steer = 0;
    this._throttle = 0;
    this._brake = 0;
    this._clock = 0;
  }

  update(dt, p) {
    const t = this.track;
    const line = this.line;
    const st = this.style;
    this._clock += dt;

    const i = t.nearestIndex(p.x, p.z, p.y);
    this.sample = i;
    const speed = p.speed;

    // --- where to aim ------------------------------------------------------
    // Look ahead by the speed being PLANNED for, not the speed being carried:
    // arriving too hot should not also make the driver look further past the
    // corner they are already failing to make. And cap it against the radius,
    // because a lookahead that spans most of a corner has the driver aiming at
    // a point across the apex instead of at it.
    const planned = Math.min(speed, this.profile.v[i]);
    const k = Math.abs(line.curvature[i]);
    const byRadius = k > 1e-4 ? AI.lookRadius / k : Infinity;
    const look = clamp(AI.lookMin + planned * AI.lookGain,
      AI.lookFloor, Math.min(AI.lookMax, byRadius));
    const aim = line.ahead(i, look, this._aim);

    // Habitual offset plus the wander, faded out where the road is turning.
    const tidy = 1 - Math.min(1, Math.abs(line.curvature[aim.index]) * AI.tidyAtCorners);
    const drift =
      Math.sin(this._clock * st.wanderRate + st.phase) * 0.62 +
      Math.sin(this._clock * st.wanderRate * 1.73 + st.phase * 2.1) * 0.38;
    let bias = st.lineBias + drift * st.wander * tidy;
    // Never aim outside the road, however untidy the driver is.
    const room = line.limit[aim.index] - Math.abs(line.offset[aim.index]);
    bias = clamp(bias, -room, room);
    const ax = aim.x + t.lx[aim.index] * bias;
    const az = aim.z + t.lz[aim.index] * bias;

    // --- steering ----------------------------------------------------------
    const sy = Math.sin(p.yaw), cy = Math.cos(p.yaw);
    const dx = ax - p.x, dz = az - p.z;
    const fwd = dx * sy + dz * cy;
    // +x is the car's LEFT, and the physics steer channel is pre-flip, so a
    // positive steer turns left. A target to the left is a positive lateral.
    const lat = dx * cy - dz * sy;
    const want = Math.atan2(lat, Math.max(fwd, 1));

    // Damped against EXCESS yaw, not against yaw.
    //
    // A corner needs yaw: to hold a line of curvature k at speed v the car has
    // to be rotating at v*k, all the way round. Damping the raw yaw rate
    // therefore fights the corner exactly when the car is doing what it was
    // told, which reads as understeer and put the AI a metre wide on the
    // outside of every bend. Damping the DIFFERENCE keeps the part that stops
    // the heavy cars weaving and drops the part that stopped them turning.
    const needYaw = speed * line.curvature[i];
    const damp = (p.yawRate - needYaw) * AI.steerDamp * Math.min(1, speed / 15);

    // Cross-track error. Pure pursuit aims at a point ahead and will happily
    // settle parallel to the line a metre off it: aiming at where the line goes
    // says nothing about being ON it. This is the term that closes that gap.
    const carLat = (p.x - t.px[i]) * t.lx[i] + (p.z - t.pz[i]) * t.lz[i];
    const cross = carLat - (line.offset[i] + bias);   // + means left of the line
    const pull = clamp(cross * AI.crossGain, -AI.crossMax, AI.crossMax);

    const target = clamp(want * AI.steerGain - damp - pull, -1, 1);
    // Hands move at a finite speed. This is also what stops a keyboard-style
    // step change in lock from unsettling the car on turn-in.
    const move = st.reaction * dt;
    this._steer += clamp(target - this._steer, -move, move);

    // --- pedals ------------------------------------------------------------
    // The profile's backward pass already put the braking point where it
    // belongs, so the driver only needs enough lookahead to cover its own
    // reaction rather than to work the braking zone out again.
    let goal = this.profile.lookahead(i, AI.brakeLookMin + speed * AI.brakeLookTime);

    // Off the road, stop racing and go back to the line.
    if (!p.onTrack) goal = Math.min(goal, AI.recoverSpeed);
    this.targetSpeed = goal;

    const err = speed - goal;
    let throttle = err < -AI.deadband ? Math.min(1, -err * AI.throttleGain) : 0;
    const brake = err > AI.deadband ? Math.min(1, err * AI.brakeGain) : 0;

    // Back out of the throttle as the rear starts to go. Pure pursuit at full
    // throttle spins the loose-rear cars on corner exit and no amount of extra
    // lookahead fixes it -- by the time the line is wrong the car is already
    // sideways. This is the same thing a driver's right foot does.
    const slide = Math.min(1, Math.abs(p.slipRear) / AI.slipBudget);
    throttle *= 1 - AI.slipLift * slide * slide;

    const pedal = AI.pedalRate * dt;
    this._throttle += clamp(throttle - this._throttle, -pedal, pedal);
    this._brake += clamp(brake - this._brake, -pedal, pedal);

    const out = this.input;
    out.steer = this._steer;
    out.throttle = clamp(this._throttle, 0, 1);
    out.brake = clamp(this._brake, 0, 1);
    out.handbrake = 0;
    return out;
  }
}
