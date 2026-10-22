// One lifting surface: a wing half, a stabilator, a fin.
//
// The idea is SimpleWings': each surface has a lift curve and a drag curve
// against angle of attack, and the stall comes out of the shape of the data
// rather than out of a rule. Per step the airframe hands each surface the
// velocity it is moving through the air at (the body's velocity plus the
// rotation term), and it answers with a force. The airframe applies that force
// at the surface's position, so the torque is geometry, not a coefficient.
//
// Headless: plain numbers, no allocation in force().
//
// Surface frame, in body axes (+x LEFT, +y up, +z nose):
//   chord   unit vector along the chord, pointing forward
//   normal  unit vector the lift acts along at a positive angle of attack
//   span    chord x normal -- the flow along it is ignored, so a wing in a
//           sideslip loses lift the way a swept wing does
// Angle of attack is positive when the air meets the underside, i.e. when the
// surface is moving along -normal relative to its chord.

// A lookup table in degrees, kept in radians. Piecewise linear, held level
// past either end. `at` allocates nothing.
export class Curve {
  constructor(points) {
    const n = points.length;
    this.x = new Float64Array(n);
    this.y = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      this.x[i] = (points[i][0] * Math.PI) / 180;
      this.y[i] = points[i][1];
    }
    this.n = n;
  }

  at(a) {
    const x = this.x, y = this.y, n = this.n;
    if (a <= x[0]) return y[0];
    for (let i = 1; i < n; i++) {
      if (a <= x[i]) {
        const t = (a - x[i - 1]) / (x[i] - x[i - 1]);
        return y[i - 1] + (y[i] - y[i - 1]) * t;
      }
    }
    return y[n - 1];
  }
}

// A table against Mach number (not angle). Same lookup, no degree conversion.
export class MachTable {
  constructor(points) {
    const n = points.length;
    this.x = new Float64Array(n);
    this.y = new Float64Array(n);
    for (let i = 0; i < n; i++) { this.x[i] = points[i][0]; this.y[i] = points[i][1]; }
    this.n = n;
  }

  at(m) {
    const x = this.x, y = this.y, n = this.n;
    if (m <= x[0]) return y[0];
    for (let i = 1; i < n; i++) {
      if (m <= x[i]) {
        const t = (m - x[i - 1]) / (x[i] - x[i - 1]);
        return y[i - 1] + (y[i] - y[i - 1]) * t;
      }
    }
    return y[n - 1];
  }
}

const FULL_STALL_DEG = 38;      // induced drag is fully replaced by the plate term here
const MIN_AIRSPEED = 0.5;       // m/s; below this a surface makes no force

export class Wing {
  // def: { name, area, pos:[x,y,z], chord:[x,y,z], normal:[x,y,z], induced,
  //        curve: { lift: Curve, drag: Curve, stall: radians },
  //        control: { pitch, roll, yaw } -- radians of effective angle of attack
  //        at full command, which already includes how much of the surface moves }
  constructor(def, curves) {
    this.name = def.name;
    this.area = def.area;
    this.px = def.pos[0]; this.py = def.pos[1]; this.pz = def.pos[2];
    this.fx = def.chord[0]; this.fy = def.chord[1]; this.fz = def.chord[2];
    this.nx = def.normal[0]; this.ny = def.normal[1]; this.nz = def.normal[2];
    // span = chord x normal
    this.sx = this.fy * this.nz - this.fz * this.ny;
    this.sy = this.fz * this.nx - this.fx * this.nz;
    this.sz = this.fx * this.ny - this.fy * this.nx;
    this.induced = def.induced;
    this.lift = curves[def.curve].lift;
    this.drag = curves[def.curve].drag;
    this.stall = curves[def.curve].stall;
    this.flap = def.flap || 0;     // 1 if the surface carries the scheduled flaps
    // Set by the airframe each step: the flaps' gain on the lift curve (and the
    // spoilers' loss of it) and the drag they add, as a coefficient on this surface's
    // area. 1 and 0 are the surface as the curves have it.
    this.liftScale = 1;
    this.cdAdd = 0;
    const c = def.control || {};
    this.cPitch = c.pitch || 0;
    this.cRoll = c.roll || 0;
    this.cYaw = c.yaw || 0;
    // Written each step, read by the renderer and the HUD.
    this.alpha = 0;     // effective angle of attack, radians
    this.cl = 0;
    this.deflection = 0; // control deflection in effective-alpha radians
  }

  // w is the surface's velocity through the air in body axes. delta is the
  // control deflection in radians. liftMach scales the lift curve for
  // compressibility. The force goes into out.fx/fy/fz.
  force(wx, wy, wz, rho, liftMach, delta, out) {
    // Remove the spanwise flow.
    const ws = wx * this.sx + wy * this.sy + wz * this.sz;
    const px = wx - ws * this.sx;
    const py = wy - ws * this.sy;
    const pz = wz - ws * this.sz;
    const vp2 = px * px + py * py + pz * pz;
    this.deflection = delta;
    if (vp2 < MIN_AIRSPEED * MIN_AIRSPEED) {
      out.fx = 0; out.fy = 0; out.fz = 0;
      this.alpha = delta; this.cl = 0;
      return;
    }
    const vp = Math.sqrt(vp2);
    const cosA = (px * this.fx + py * this.fy + pz * this.fz) / vp;
    const sinA = -(px * this.nx + py * this.ny + pz * this.nz) / vp;
    const geo = Math.atan2(sinA, cosA);
    let eff = geo + delta;
    // Keep the effective angle in (-pi, pi] so the symmetric lookup holds.
    if (eff > Math.PI) eff -= Math.PI * 2; else if (eff < -Math.PI) eff += Math.PI * 2;
    const sign = eff < 0 ? -1 : 1;
    const a = eff < 0 ? -eff : eff;

    const cl = sign * this.lift.at(a) * liftMach * this.liftScale;
    // Induced drag grows with lift squared and gives way to the flat plate
    // term once the surface is well past the stall.
    const fade = a < this.stall ? 1 : a > (FULL_STALL_DEG * Math.PI) / 180 ? 0
      : 1 - (a - this.stall) / ((FULL_STALL_DEG * Math.PI) / 180 - this.stall);
    const cd = this.drag.at(a) + this.induced * cl * cl * fade + this.cdAdd;
    this.alpha = eff;
    this.cl = cl;

    const q = 0.5 * rho * vp2 * this.area;
    const l = q * cl, d = q * cd;
    // lift along (sinA f + cosA n), drag along (-cosA f + sinA n)
    out.fx = l * (sinA * this.fx + cosA * this.nx) + d * (-cosA * this.fx + sinA * this.nx);
    out.fy = l * (sinA * this.fy + cosA * this.ny) + d * (-cosA * this.fy + sinA * this.ny);
    out.fz = l * (sinA * this.fz + cosA * this.nz) + d * (-cosA * this.fz + sinA * this.nz);
  }
}
