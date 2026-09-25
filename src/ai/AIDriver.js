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
//
// In a race it is also handed the other cars, and does three more things:
//
//   Passing. A car close ahead in the lane it wants is a car to get round: it
//   picks the side with room, moves across into a lane beside it, and comes
//   back to the line once it is clear. With no room either side it follows,
//   at a distance that grows with speed.
//
//   Side by side, it keeps its side. Two cars alongside each other each hold
//   their own half of the road rather than leaning on one another.
//
//   Mistakes, at the difficulty's rate: at a braking point it may brake too
//   late and overshoot, run wide of the apex, or lift early. Each one is a
//   change to what it is aiming at or how hard it presses, so the car makes
//   the mistake through the same physics and recovers from it the same way --
//   no stutter and no snapping back to the line. They come from a seeded
//   generator on the fixed clock, so a race replays the same way every time.
//
// With no other cars, no mistakes and no catch-up, every one of those terms is
// exactly zero and the driver is the time-trial driver, number for number.
// ============================================================================

import { AI } from '../data/tuning.js';
import { SpeedProfile } from './SpeedProfile.js';

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

// Small, fast, seeded. The driver must never touch Math.random: a race that
// plays out differently every time cannot be debugged or checked.
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

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
  mistakeRate: 0,            // chance per corner of a mistake; set by difficulty
  seed: 1,                   // for the mistakes, so each driver makes their own
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

    // Racing. Extra target speed a race may hand a trailing car (catch-up),
    // the lateral offset for passing and its smoothed value, and the mistake
    // currently being made, if any.
    this.boost = 1;
    this._pass = 0;
    this._passLane = 0;
    this._passHold = 0;
    this._rand = mulberry32(this.style.seed);
    this._mistake = { late: 0, wide: 0, wideSign: 0, lift: 0 };
    this._lastSample = -1;
    this._entries = this._findBrakingPoints();
  }

  reset() {
    this._steer = 0;
    this._throttle = 0;
    this._brake = 0;
    this._clock = 0;
    this._pass = 0;
    this._passHold = 0;
    this._mistake.late = 0; this._mistake.wide = 0; this._mistake.lift = 0;
    this._lastSample = -1;
    this._rand = mulberry32(this.style.seed);
  }

  // At the start of a race: keep to this lateral position, the car's grid
  // slot, for AI.startHold seconds before joining the line.
  holdLane(lateral) {
    this._passLane = lateral;
    this._passHold = AI.startHold;
    this._pass = 0;
  }

  // Where each braking zone starts: the samples where the speed the profile
  // wants a little way ahead is well below the speed it wants here. A mistake
  // is rolled for each one the car drives past.
  _findBrakingPoints() {
    const v = this.profile.v, n = v.length, line = this.line;
    const flags = new Uint8Array(n);
    const ahead = Math.max(1, Math.round(25 / (line.length / n)));
    let was = false;
    for (let i = 0; i < n; i++) {
      const braking = v[(i + ahead) % n] < v[i] - 3;
      if (braking && !was) flags[i] = 1;
      was = braking;
    }
    return flags;
  }

  _rollMistakes(dt, i) {
    const m = this._mistake;
    m.late = Math.max(0, m.late - dt);
    m.wide = Math.max(0, m.wide - dt);
    m.lift = Math.max(0, m.lift - dt);
    const n = this._entries.length;
    if (this._lastSample >= 0 && i !== this._lastSample) {
      // Walk the samples passed since last step, normally one or none.
      let k = this._lastSample;
      for (let guard = 0; guard < 12 && k !== i; guard++) {
        k = (k + 1) % n;
        if (this._entries[k] && this._rand() < this.style.mistakeRate) this._pickMistake(k);
      }
    }
    this._lastSample = i;
  }

  _pickMistake(k) {
    const m = this._mistake;
    const r = this._rand();
    if (r < 0.4) {
      m.late = AI.mistakeTime;                    // brakes too late and overshoots
    } else if (r < 0.75) {
      // Runs wide of the apex: out toward the outside of the corner ahead.
      const line = this.line, n = line.count;
      let k2 = 0;
      for (let s = 0; s < 40; s++) {
        const c = line.curvature[(k + s) % n];
        if (Math.abs(c) > Math.abs(k2)) k2 = c;
      }
      m.wide = AI.mistakeTime * 1.5;
      m.wideSign = -Math.sign(k2 || 1);
    } else {
      m.lift = AI.mistakeTime * 0.5;             // lifts early
    }
  }

  // Look at the other cars and decide whether to pass, where, or to follow.
  // Returns the speed to hold behind a car there is no room to pass, or
  // Infinity. Leaves the lane it wants in this._passLane / this._passHold, and
  // the push needed to keep off a car alongside in this._push.
  _readTraffic(dt, traffic, self, i, speed, laneHere) {
    const t = this.track, n = t.count;
    const me = traffic[self];
    const reach = AI.awareBase + speed * AI.awareTime;
    let block = null, blockAlong = Infinity;
    let push = 0;
    let liftTo = Infinity;
    for (let k = 0; k < traffic.length; k++) {
      if (k === self) continue;
      const o = traffic[k];
      if (Math.abs(o.y - me.y) > 3) continue;         // on the flyover or under it
      let d = o.i - i;
      if (d > n / 2) d -= n; else if (d < -n / 2) d += n;
      const along = d * t.ds;
      const need = me.halfWid + o.halfWid + AI.passGap;
      const dl = me.lat - o.lat;
      const lengths = me.halfLen + o.halfLen;
      // Alongside, or about to be: hold this side of the road. Starting a few
      // metres early is what stops two cars converging on the same apex.
      if (Math.abs(along) < lengths + 3 && Math.abs(dl) < need) {
        const side = dl > 0 || (dl === 0 && self < k) ? 1 : -1;
        push += side * (need - Math.abs(dl));
        // No room on my side for two abreast, and they are even slightly
        // ahead: concede the corner rather than squeeze it.
        const edge = t.halfWidth[i] - AI.passEdge - me.halfWid;
        if (along > 0 && Math.abs(o.lat + side * need) > edge) {
          liftTo = Math.min(liftTo, o.speed * 0.97);
        }
      }
      // In my path right now, wherever I am heading: never close on it faster
      // than I could brake to the speed it will be doing -- which, into a
      // corner, is the speed the corner needs, not the speed it has now. Applies
      // while passing too, until I am actually clear of it sideways.
      if (along > 0 && along < reach && Math.abs(o.lat - me.lat) < me.halfWid + o.halfWid + 0.4) {
        const theirs = Math.min(o.speed, this.profile.lookahead(o.i, 25));
        const gap = Math.max(0, along - lengths - AI.followGap * 0.5 - speed * AI.followTime * 0.5);
        const safe = Math.sqrt(theirs * theirs + 2 * AI.followDecel * gap);
        if (safe < liftTo) liftTo = safe;
      }
      if (along > 0 && along < reach && along < blockAlong && Math.abs(o.lat - laneHere) < need) {
        block = o;
        blockAlong = along;
      }
    }
    this._push = push;
    if (block) {
      const need = me.halfWid + block.halfWid + AI.passGap;
      const edge = t.halfWidth[i] - AI.passEdge - me.halfWid;
      const left = block.lat + need, right = block.lat - need;
      const clear = (lane) => {
        for (let k = 0; k < traffic.length; k++) {
          const o = traffic[k];
          if (k === self || o === block || Math.abs(o.y - me.y) > 3) continue;
          let d = o.i - i;
          if (d > n / 2) d -= n; else if (d < -n / 2) d += n;
          const along = d * t.ds;
          if (along > -(me.halfLen + o.halfLen) && along < reach &&
              Math.abs(o.lat - lane) < me.halfWid + o.halfWid + AI.passGap) return false;
        }
        return true;
      };
      const okL = left <= edge && clear(left);
      const okR = right >= -edge && clear(right);
      if (okL || okR) {
        let lane;
        if (okL && okR) {
          // Already committed to a side of this car: keep to it. Otherwise
          // take whichever is the shorter move.
          if (this._passHold > 0) lane = this._passLane >= block.lat ? left : right;
          else lane = Math.abs(left - me.lat) <= Math.abs(right - me.lat) ? left : right;
        } else {
          lane = okL ? left : right;
        }
        this._passLane = lane;
        this._passHold = AI.passHold;
      } else {
        const safe = me.halfLen + block.halfLen + AI.followGap + speed * AI.followTime;
        if (blockAlong < safe * 2) {
          liftTo = Math.min(liftTo, Math.max(0, block.speed + (blockAlong - safe) * 0.5));
        }
      }
    }
    if (this._passHold > 0) this._passHold -= dt;
    return liftTo;
  }

  // traffic / self: in a race, every car's state this step and which of them
  // is this one. Omitted in time trial.
  update(dt, p, traffic = null, self = -1) {
    const t = this.track;
    const line = this.line;
    const st = this.style;
    this._clock += dt;

    const i = t.nearestIndex(p.x, p.z, p.y);
    this.sample = i;
    const speed = p.speed;
    if (st.mistakeRate > 0) this._rollMistakes(dt, i);

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

    // Racing: a lane to pass in, room kept from a car alongside, and a missed
    // apex. All of it is zero in time trial, and then bias is untouched.
    let liftTo = Infinity;
    let passTarget = 0;
    if (traffic) {
      const laneHere = line.offset[i] + bias + this._pass;
      liftTo = this._readTraffic(dt, traffic, self, i, speed, laneHere);
      if (this._passHold > 0) passTarget = this._passLane - line.offset[aim.index] - bias;
      passTarget += this._push;
    }
    const m = this._mistake;
    if (m.wide > 0) {
      const total = AI.mistakeTime * 1.5;
      passTarget += m.wideSign * AI.mistakeWide * Math.sin(Math.PI * (1 - m.wide / total));
    }
    if (passTarget !== 0 || this._pass !== 0) {
      const step = AI.passRate * dt;
      this._pass += clamp(passTarget - this._pass, -step, step);
      // The lane may sit either side of the line, so the limit is the road's
      // edge, not the symmetric room the wander is held to -- and it is the
      // same edge the lane was chosen inside (AI.passEdge plus the car's own
      // half width), or the line itself where the line runs wider. Held only
      // to the line's limit, a car passing on the outside of Copper Flats'
      // long left-hander aimed a metre from the edge and ran the exit on the
      // kerb.
      const off = line.offset[aim.index];
      const edge = t.halfWidth[aim.index] - AI.passEdge - this.chassis.bodyWidth / 2;
      const lim = Math.min(line.limit[aim.index], Math.max(edge, Math.abs(off)));
      bias = clamp(bias + this._pass, -lim - off, lim - off);
    }
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

    // Racing: an overshoot, catch-up, and following a car with no room to pass.
    if (m.late > 0) goal *= 1 + AI.mistakeLate;
    if (this.boost !== 1) goal *= this.boost;
    if (liftTo < goal) goal = liftTo;

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
    if (m.lift > 0) throttle = Math.min(throttle, AI.mistakeLift);

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
