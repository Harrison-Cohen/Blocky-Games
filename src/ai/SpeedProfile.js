// ============================================================================
// SpeedProfile
// ----------------------------------------------------------------------------
// The speed the AI is trying to be doing at every point of the racing line.
// Three passes over the lap:
//
//   1. Cornering limit, from the line's own curvature and the grip the car has
//      there -- including the banking, the downforce and the surface.
//   2. A backward pass that walks braking zones back from each corner until the
//      car could have arrived at that speed.
//   3. A forward pass that walks acceleration out of each corner, so the target
//      is something the engine and the driven tyres can actually deliver.
//
// Both passes use the friction circle rather than a flat number: a car already
// using most of its grip to turn cannot also brake at full force, which is
// exactly why a corner entry is a compromise and why the profile has to know
// about it rather than being handed a constant.
//
// Gradient is in here too. Pine Ridge climbs 63 m and comes back down, and a
// braking zone on a 10% descent is a third longer than the same one on the
// flat. A profile that ignores it sends the car straight on at the bottom.
//
// One profile per driver, because each driver gets its own grip confidence and
// braking margin -- that is most of what makes two AI cars look like two
// drivers rather than one car rendered twice.
// ============================================================================

import { AI, DRAG, ENGINE, GRIP, SIM } from '../data/tuning.js';
import { speedGripLoad } from '../game/VehiclePhysics.js';

// What an axle can actually deliver once roll has taken its cut.
//
// Tyre grip is sublinear in load, so an axle loaded unevenly grips less than
// the same axle loaded evenly -- that is GRIP.rollGripLoss, and it is the whole
// reason a tall car is worse in a corner here rather than merely looking worse.
// A profile that ignores it is optimistic by a little for the low cars and by a
// quarter for the tall ones, and a quarter is the difference between an apex
// and a trip through the gravel. Measured before this was in: the Boxhauler and
// the Bighead ploughed off Copper Flats' fast sweeper with the front tyres
// pinned at their peak slip angle, chasing a target speed nothing could hold.
//
// The catch is that the answer depends on itself -- how much load moves across
// the car depends on how hard it is cornering, which depends on the grip it
// has. Lateral transfer on an axle is 2*a*h/(g*trackWidth) of that axle's own
// load, and peak lateral acceleration is mu*g, so a few damped iterations land
// on the fixed point.
function rollLimited(mu0, c) {
  const shape = (2 * c.centerOfMassHeight) / c.trackWidth;
  let mu = mu0;
  for (let k = 0; k < 12; k++) {
    const ratio = Math.min(1, mu * shape);
    const target = mu0 * (1 - GRIP.rollGripLoss * ratio * ratio);
    mu += (target - mu) * 0.5;
  }
  return mu;
}

export class SpeedProfile {
  // `style` carries the per-driver numbers: gripUse (how close to the tyre's
  // peak this driver runs) and brakeMargin (how early they get off the brakes).
  constructor(track, line, chassis, style = {}) {
    const n = line.count;
    this.count = n;
    this.line = line;
    this.v = new Float64Array(n);
    this.grade = new Float32Array(n);

    const gripUse = style.gripUse ?? AI.gripUse;
    const brakeUse = (style.brakeMargin ?? AI.brakeMargin) * gripUse;
    const c = chassis;
    const g = SIM.gravity;
    const m = c.mass;

    // Grip coefficient the driver believes is available at each sample. Front
    // axle, because the front is what decides a car's cornering limit here --
    // every chassis carries more rear grip than front by design.
    const mu = new Float64Array(n);
    const dragMult = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const surface = track.surface[i];
      const sMult = (GRIP.surface[surface] ?? 1) * (surface === 'tarmac' ? 1 : c.offroadGrip);
      mu[i] = rollLimited(c.gripFront * GRIP.mechanicalGrip * sMult, c) * gripUse;
      dragMult[i] = DRAG.surfaceDrag[surface] ?? 1;
    }

    // Gradient along the line, as a rise per metre travelled. Positive is uphill.
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      this.grade[i] = line.ds[i] > 1e-6 ? (line.y[j] - line.y[i]) / line.ds[i] : 0;
    }

    // --- 1. cornering limit -------------------------------------------------
    for (let i = 0; i < n; i++) {
      const k = Math.abs(line.curvature[i]);
      if (k < 1e-5) { this.v[i] = c.topSpeed; continue; }
      const R = 1 / k;
      // Banking: on a banked corner some of the normal force points at the
      // centre of the turn, so the tyres do not have to supply all of it.
      // Positive banking raises the LEFT edge, which helps a RIGHT hand corner,
      // and curvature is positive turning left -- so a bank helps when the two
      // have opposite signs.
      const tanB = Math.tan(track.banking[i]) * -Math.sign(line.curvature[i]);
      const denom = Math.max(0.2, 1 - mu[i] * tanB);
      const A = (mu[i] + tanB) / denom;

      // Downforce loads the tyres in proportion to v^2, so it appears on both
      // sides of the balance and has to be solved for rather than added on.
      //   m v^2 / R  <=  (m g + D v^2) A
      // The chassis's aero plus the speed grip every car gets, both in v^2.
      const D = (c.downforce ?? 0) + speedGripLoad(c, 1);
      const lhs = m / R - D * A;
      this.v[i] = lhs <= 1e-6
        ? c.topSpeed                       // downforce alone holds it at any speed
        : Math.min(c.topSpeed, Math.sqrt((m * g * A) / lhs));
    }

    // --- 2. braking, walked backwards --------------------------------------
    // Two laps of it, because the circuit is a loop: a braking zone that starts
    // before the start line has to be able to reach round.
    for (let pass = 0; pass < 2; pass++) {
      for (let step = n; step > 0; step--) {
        const i = (step - 1) % n;
        const j = step % n;
        const vj = this.v[j];
        const a = this._longAvail(i, mu[i] * brakeUse, vj, m, g, c);
        // Uphill helps you slow down, downhill does not.
        const decel = Math.max(0.5, a + g * this.grade[i]);
        const cap = Math.sqrt(vj * vj + 2 * decel * line.ds[i]);
        if (cap < this.v[i]) this.v[i] = cap;
      }
    }

    // --- 3. acceleration, walked forwards ----------------------------------
    for (let pass = 0; pass < 2; pass++) {
      for (let step = 0; step < n; step++) {
        const i = step % n;
        const j = (step + 1) % n;
        const vi = this.v[i];
        // What the engine can push at this speed.
        const frac = Math.min(1, vi / c.topSpeed);
        const powerFactor = Math.max(0, 1 - Math.pow(frac, c.powerFalloff ?? ENGINE.powerFalloff));
        const engine = c.power * ENGINE.powerScale * powerFactor;
        // What the driven tyres can take, given what they are already doing
        // laterally. The straight-line allowance is not used here: a profile
        // that assumes it would plan for a launch out of every corner.
        const tyre = this._longAvail(i, mu[i] * ENGINE.tractionLimit, vi, m, g, c) * m;
        const force = Math.min(engine, tyre);
        const drag = DRAG.coefficient * vi * vi
          + DRAG.rollingResistance * m * g * dragMult[i];
        const accel = (force - drag) / m - g * this.grade[i];
        const cap = Math.sqrt(Math.max(0, vi * vi + 2 * accel * line.ds[i]));
        if (cap < this.v[j]) this.v[j] = cap;
      }
    }

    // A uniform scale on the whole plan, corners and straights alike. 1 in
    // time trial. A race uses it to slow a fast car down evenly rather than by
    // making it timid only in the corners -- see RACE.minGrip.
    const scale = style.speedScale ?? 1;
    if (scale !== 1) for (let i = 0; i < n; i++) this.v[i] *= scale;
  }

  // Longitudinal acceleration available at sample i once the cornering force
  // at speed v has been taken out of the friction circle, in m/s^2.
  _longAvail(i, muUse, v, m, g, c) {
    const load = m * g + (c.downforce ?? 0) * v * v + speedGripLoad(c, v);
    const total = (muUse * load) / m;                       // total available, m/s^2
    const lateral = Math.abs(this.line.curvature[i]) * v * v; // being used to turn
    const left = total * total - lateral * lateral;
    // Never zero: a car committed entirely to cornering can still shed speed by
    // scrubbing, and a profile that says otherwise produces a braking point an
    // infinite distance back.
    return Math.max(total * AI.longFloor, left > 0 ? Math.sqrt(left) : 0);
  }

  // The lap this profile would drive if every target were met exactly, in
  // seconds. A race uses it to tune each opponent to a lap time rather than to
  // a raw grip number, so that a Wedge One and a Haul 4x4 driven by drivers of
  // the same standard are in the same race.
  lapTime() {
    let t = 0;
    for (let i = 0; i < this.count; i++) t += this.line.ds[i] / Math.max(1, this.v[i]);
    return t;
  }

  // The lowest target over the next `distance` metres of line. This is what the
  // driver actually reads: braking has to start from the slowest thing coming,
  // not from the speed directly under the wheels.
  lookahead(i, distance) {
    const line = this.line;
    let best = this.v[i];
    let left = distance;
    let k = i;
    for (let step = 0; step < this.count && left > 0; step++) {
      k = (k + 1) % this.count;
      if (this.v[k] < best) best = this.v[k];
      left -= line.ds[k];
    }
    return best;
  }
}
