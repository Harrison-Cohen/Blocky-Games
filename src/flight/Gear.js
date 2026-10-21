// Landing gear contact, and the hull's contact with the ground.
//
// Milestone 1 carries only the contact core, so the F-22 can sit on the field,
// roll down the runway and lift off: a spring and a damper per wheel against
// the ground query, the same pattern as VehiclePhysics' suspension, with
// rolling resistance, a wheel brake and nose wheel steering. Retraction limits,
// damage and the hangar zone come with milestone 3 and 5.
//
// Headless: plain numbers, no allocation in apply(). The ground is the
// contract every ground in the game implements:
//
//   sample(x, z, y) -> { height, normal: {x,y,z}, surface }
//
// Body axes: +x LEFT, +y up, +z nose. Positions are relative to the centre of
// mass; the wheel points are where each tyre touches with the strut fully
// extended.

import { FLIGHT } from '../data/tuning.js';

// Hull points are the places the airframe can strike the ground when the gear
// is up or the aircraft is inverted: nose, tail, wing tips, fin tips, belly. A
// point marked `skid` (the tail) is one an aircraft can scrape on a hard
// rotation and fly on from: it is reported apart (skidHit, skidImpact), so the
// crash rules can be kinder to it than to a wing tip.
const HULL_K = 3.0e6;     // N/m, a stiff skin
const HULL_C = 3.5e5;     // N s/m

export class Gear {
  // wheels: [{ name, pos:[x,y,z], k, c, travel, steer, brake }]
  // hull:   [{ name, pos:[x,y,z] }]
  constructor(wheels, hull, F = FLIGHT) {
    // The feel block this airframe flies with: FLIGHT with the aircraft's own values
    // laid over it (AircraftPhysics.F).
    this.F = F;
    this.wheels = wheels.map((w) => ({
      name: w.name,
      x: w.pos[0], y: w.pos[1], z: w.pos[2],
      k: w.k, c: w.c, travel: w.travel,
      steer: !!w.steer, brake: !!w.brake,
    }));
    this.hull = hull.map((h) => ({ name: h.name, x: h.pos[0], y: h.pos[1], z: h.pos[2], skid: !!h.skid }));
    const n = this.wheels.length;
    // The nose wheel's distance ahead of the mains: what a steering lock turns on.
    const steered = this.wheels.find((w) => w.steer), mains = this.wheels.filter((w) => !w.steer);
    this.wheelbase = steered && mains.length ? steered.z - mains.reduce((s, w) => s + w.z, 0) / mains.length : 5;
    this.compression = new Float64Array(n);  // m, for the renderer
    this.load = new Float64Array(n);         // N
    this.rpm = new Float64Array(n);          // wheel spin, rad/s
    this.spin = new Float64Array(n);         // wheel angle, rad
    this.steerAngle = 0;                     // rad, nose wheel
    this.onGround = false;                   // any wheel loaded
    this.weightOnWheels = 0;                 // fraction of weight the wheels carry
    this.hullHit = 0;                        // deepest hull penetration this step, m
    this.hullImpact = 0;                     // fastest hull strike this step, m/s into the ground
    this.skidHit = 0;                        // the same two for the skid points (the tail)
    this.skidImpact = 0;
    this.touchdownSink = 0;                  // sink rate at the first wheel contact of a landing, m/s
    this._wasOn = false;
    this._out = { f: 0 };
  }

  reset() {
    this.compression.fill(0);
    this.load.fill(0);
    this.rpm.fill(0);
    this.steerAngle = 0;
    this.onGround = false;
    this._wasOn = false;
    this.touchdownSink = 0;
  }

  // Apply the contact forces of one step to `body` (an AircraftPhysics: x, y,
  // z, vx, vy, vz, wx, wy, wz, r[9] for body->world), adding to the body
  // force and torque accumulators in body axes. Returns nothing.
  //
  //   steer  -1..1, positive steers the nose wheel to the pilot's right
  //   brake  0..1
  //   down   how far the gear is down, 0..1; the wheels only touch at 1
  apply(body, ground, dt, steer, brake, down, mass, acc) {
    const F = this.F;
    const r = body.r;
    const wheels = this.wheels;
    let total = 0;
    this.hullHit = 0;
    this.hullImpact = 0;
    this.skidHit = 0;
    this.skidImpact = 0;

    // Nose wheel steering fades with speed so it cannot throw the nose at 100 kt.
    // The assist also turns it at a rate, not at once, and limits the lock to the
    // side force the tyres can give (atan of the lateral acceleration times the
    // wheelbase over speed squared).
    const speed = Math.sqrt(body.vx * body.vx + body.vz * body.vz);
    const fade = 1 / (1 + (speed / F.noseSteerSpeed) * (speed / F.noseSteerSpeed));
    let lock = F.noseSteerMax * fade;
    if (F.groundAssist) {
      const lat = Math.atan((F.noseSteerLatG * 9.81 * this.wheelbase) / Math.max(speed * speed, 1e-3));
      if (lat < lock) lock = lat;
      const want = -steer * lock, rate = F.noseSteerRate * dt;
      const d = want - this.steerAngle;
      this.steerAngle += d > rate ? rate : d < -rate ? -rate : d;
    } else {
      this.steerAngle = -steer * lock;
    }
    const sinS = Math.sin(this.steerAngle), cosS = Math.cos(this.steerAngle);

    if (down >= 0.99) {
      for (let i = 0; i < wheels.length; i++) {
        const w = wheels[i];
        // Attach point in world axes.
        const rx = r[0] * w.x + r[1] * w.y + r[2] * w.z;
        const ry = r[3] * w.x + r[4] * w.y + r[5] * w.z;
        const rz = r[6] * w.x + r[7] * w.y + r[8] * w.z;
        const wx = body.x + rx, wy = body.y + ry, wz = body.z + rz;
        const g = ground.sample(wx, wz, wy);
        const pen = g.height - wy;
        if (pen <= 0) { this.compression[i] = 0; this.load[i] = 0; continue; }

        // Velocity of the point, world axes: v + R (w x r_body).
        const ox = body.wy * w.z - body.wz * w.y;
        const oy = body.wz * w.x - body.wx * w.z;
        const oz = body.wx * w.y - body.wy * w.x;
        const vx = body.vx + r[0] * ox + r[1] * oy + r[2] * oz;
        const vy = body.vy + r[3] * ox + r[4] * oy + r[5] * oz;
        const vz = body.vz + r[6] * ox + r[7] * oy + r[8] * oz;
        const n = g.normal;
        const vn = vx * n.x + vy * n.y + vz * n.z;

        const comp = pen < w.travel ? pen : w.travel;
        const rate = -vn;
        let nForce = w.k * comp + (rate > 0 ? w.c : w.c * 0.5) * rate;
        // Bottomed out: the stop is hard, and the airframe takes it.
        if (pen > w.travel) nForce += HULL_K * (pen - w.travel);
        if (nForce < 0) nForce = 0;
        this.compression[i] = comp;
        this.load[i] = nForce;
        total += nForce;
        if (!this._wasOn && rate > this.touchdownSink) this.touchdownSink = rate;

        // Wheel plane in world axes: forward and left, flattened onto the ground.
        let fbx = w.steer ? sinS : 0, fbz = w.steer ? cosS : 1;
        let fwx = r[0] * fbx + r[2] * fbz;
        let fwy = r[3] * fbx + r[5] * fbz;
        let fwz = r[6] * fbx + r[8] * fbz;
        const fn = fwx * n.x + fwy * n.y + fwz * n.z;
        fwx -= fn * n.x; fwy -= fn * n.y; fwz -= fn * n.z;
        const fl = Math.sqrt(fwx * fwx + fwy * fwy + fwz * fwz) || 1;
        fwx /= fl; fwy /= fl; fwz /= fl;
        // left = n x forward
        const lwx = n.y * fwz - n.z * fwy;
        const lwy = n.z * fwx - n.x * fwz;
        const lwz = n.x * fwy - n.y * fwx;

        const vLong = vx * fwx + vy * fwy + vz * fwz;
        const vLat = vx * lwx + vy * lwy + vz * lwz;
        const s = F.surfaces[g.surface] || F.surfaces.grass;
        const vs = F.slipSpeed;
        const brk = w.brake ? brake * F.brakeFriction : 0;
        const fLat = -s.lateral * nForce * vLat / (Math.abs(vLat) + vs);
        const fLong = -(s.rolling + brk) * nForce * vLong / (Math.abs(vLong) + vs);

        // Force on the aircraft, world axes, then into body axes.
        const Fx = nForce * n.x + fLat * lwx + fLong * fwx;
        const Fy = nForce * n.y + fLat * lwy + fLong * fwy;
        const Fz = nForce * n.z + fLat * lwz + fLong * fwz;
        const bx = r[0] * Fx + r[3] * Fy + r[6] * Fz;
        const by = r[1] * Fx + r[4] * Fy + r[7] * Fz;
        const bz = r[2] * Fx + r[5] * Fy + r[8] * Fz;
        acc.fx += bx; acc.fy += by; acc.fz += bz;
        acc.tx += w.y * bz - w.z * by;
        acc.ty += w.z * bx - w.x * bz;
        acc.tz += w.x * by - w.y * bx;

        // Wheel spin for the renderer: rolls with the ground speed.
        this.rpm[i] = vLong / F.wheelRadius;
      }
    } else {
      this.compression.fill(0);
      this.load.fill(0);
    }

    // Hull points: only strike when the skin touches.
    const hull = this.hull;
    for (let i = 0; i < hull.length; i++) {
      const h = hull[i];
      const rx = r[0] * h.x + r[1] * h.y + r[2] * h.z;
      const ry = r[3] * h.x + r[4] * h.y + r[5] * h.z;
      const rz = r[6] * h.x + r[7] * h.y + r[8] * h.z;
      const hx = body.x + rx, hy = body.y + ry, hz = body.z + rz;
      const g = ground.sample(hx, hz, hy);
      const pen = g.height - hy;
      if (pen <= 0) continue;
      const ox = body.wy * h.z - body.wz * h.y;
      const oy = body.wz * h.x - body.wx * h.z;
      const oz = body.wx * h.y - body.wy * h.x;
      const vx = body.vx + r[0] * ox + r[1] * oy + r[2] * oz;
      const vy = body.vy + r[3] * ox + r[4] * oy + r[5] * oz;
      const vz = body.vz + r[6] * ox + r[7] * oy + r[8] * oz;
      const n = g.normal;
      const vn = vx * n.x + vy * n.y + vz * n.z;
      if (h.skid) {
        if (pen > this.skidHit) this.skidHit = pen;
        if (-vn > this.skidImpact) this.skidImpact = -vn;
      } else {
        if (pen > this.hullHit) this.hullHit = pen;
        if (-vn > this.hullImpact) this.hullImpact = -vn;
      }
      let nForce = HULL_K * pen + (vn < 0 ? HULL_C * -vn : 0);
      if (nForce < 0) nForce = 0;
      // Scraping: sliding friction against the skin.
      const vt = Math.sqrt(Math.max(0, vx * vx + vy * vy + vz * vz - vn * vn));
      const fr = F.hullFriction * nForce / (vt + F.slipSpeed);
      const Fx = nForce * n.x - fr * (vx - vn * n.x);
      const Fy = nForce * n.y - fr * (vy - vn * n.y);
      const Fz = nForce * n.z - fr * (vz - vn * n.z);
      const bx = r[0] * Fx + r[3] * Fy + r[6] * Fz;
      const by = r[1] * Fx + r[4] * Fy + r[7] * Fz;
      const bz = r[2] * Fx + r[5] * Fy + r[8] * Fz;
      acc.fx += bx; acc.fy += by; acc.fz += bz;
      acc.tx += h.y * bz - h.z * by;
      acc.ty += h.z * bx - h.x * bz;
      acc.tz += h.x * by - h.y * bx;
    }

    this.onGround = total > 0;
    this.weightOnWheels = mass > 0 ? total / (mass * 9.81) : 0;
    if (this.onGround && !this._wasOn) { /* first contact: touchdownSink holds the worst rate */ }
    if (!this.onGround && this._wasOn) this.touchdownSink = 0;
    this._wasOn = this.onGround;

    for (let i = 0; i < wheels.length; i++) this.spin[i] += this.rpm[i] * dt;
  }
}
