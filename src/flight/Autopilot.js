// The autopilot: altitude hold, heading hold and speed hold.
//
// It is a pilot, not a mode of the physics. Every fixed step it reads the aircraft's
// state and writes the same stick, throttle and flap inputs a player does into a
// command object the physics then flies, so it is frame-rate invariant and
// deterministic (it runs on the physics clock, in the step, not the frame) and it can
// never do what the aircraft could not. Headless: plain numbers, no allocation in
// step().
//
//   altitude   the altitude error asks for a vertical speed (limited), and the stick
//              is the error in vertical speed. The airframe's auto-trim takes the
//              steady stick out, as it does for a pilot.
//   heading    the heading error asks for a bank (limited), and the roll stick is the
//              error in bank.
//   speed      a cascade on the throttle lever: the speed error asks for an acceleration
//              (limited), and the lever is moved at a rate in proportion to the acceleration
//              that is missing. The lever is the integrator, so there is nothing to wind up and
//              the lever settles wherever the acceleration is what was asked for (nought, at
//              the speed), whatever the drag.
//
// While it is on, the pitch and roll sticks and the throttle keys do not fly the
// aircraft: they move the three targets (the physical Up and Down arrows the
// altitude, Left and Right the heading, W and S the speed). The rudder, brakes, gear,
// flaps and spoilers stay the pilot's. It lets go by itself on the ground, in a stall
// and in a wreck.

import { FLIGHT_DAMAGE as D, AUTOPILOT } from '../data/tuning.js';

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const wrapPi = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };

// The most acceleration (m/s2) the speed loop will believe it is measuring: well above anything
// a fighter does.
const ACC_LIMIT = 25;

// The fields of a physics input that pass through untouched.
const PASS = ['yaw', 'analog', 'throttleKick', 'ab', 'brake', 'gearDown', 'airbrake', 'flaps', 'cannon'];

export class Autopilot {
  constructor(def) {
    this.cfg = Object.assign({}, AUTOPILOT.default, AUTOPILOT[def.id] || null);
    this.on = false;
    this.mode = 'Off';
    // Which of the three holds are working. All of them, as the player has it; a test
    // can take one away to measure what the others do on their own.
    this.altHold = true; this.hdgHold = true; this.spdHold = true;
    this.alt = 0;        // m
    this.hdg = 0;        // rad, compass
    this.spd = 0;        // m/s calibrated
    this.vsCmd = 0;      // the vertical speed it is asking for, for the readout
    this.bankCmd = 0;
    this.accCmd = 0;     // the acceleration the speed loop is asking for, m/s2, for the readout
    this.acc = 0;        // the acceleration it measures (calibrated speed, filtered), m/s2
    this._cas = 0;
    this._primed = false;   // the speed has been read once since it took over
    this.rollTrim = 0;
    this.vsInt = 0;      // the vertical speed the altitude loop has built up to close a small error
    this.why = '';       // why it let go, for the HUD
    this._att = { pitch: 0, bank: 0, heading: 0 };
  }

  // Captures where the aircraft is as the targets, and takes over.
  engage(p) {
    const a = p.attitude();
    this.alt = p.y;
    this.hdg = a.heading;
    this.spd = p.cas;
    this.acc = 0;
    this._cas = p.cas;
    this._primed = false;
    this.rollTrim = 0;
    this.vsInt = 0;
    this.on = true;
    this.mode = 'Hold';
    this.why = '';
  }

  disengage(why = '') {
    this.on = false;
    this.mode = 'Off';
    this.why = why;
  }

  followRoute(route) {
    if (!this.on || !route?.usable) return false;
    this.route = route; this.mode = 'Route'; return true;
  }

  // One physics step. `input` is what the pilot did, `cmd` is what the aircraft is
  // flown with (the same shape as `input`): with the autopilot off it is a copy.
  step(dt, p, input, cmd) {
    cmd.pitch = input.pitch; cmd.roll = input.roll; cmd.throttleRate = input.throttleRate;
    for (let i = 0; i < PASS.length; i++) cmd[PASS[i]] = input[PASS[i]];
    if (!this.on) return false;
    if (p.crashed) { this.disengage('crash'); return false; }
    if (p.onGround || p.gear.weightOnWheels > 0.02) { this.disengage('on the ground'); return false; }
    if (p.stalled) { this.disengage('stall'); return false; }
    const C = this.cfg;
    const a = p.attitude();

    // The targets, moved by the keys while they are held.
    this.alt += (input.apAlt || 0) * C.altRate * dt;
    if (this.mode === 'Route') {
      if (this.route?.usable) this.hdg = this.route.heading;
      else { this.mode = 'Hold'; this.hdg = this.route?.heading ?? a.heading; this.message = this.route?.complete ? 'Route complete: Hold on final heading' : 'Route unavailable: Hold'; }
    } else this.hdg += (input.apHdg || 0) * C.hdgRate * dt;
    this.spd = clamp(this.spd + (input.apSpd || 0) * C.spdRate * dt, C.spdMin, C.spdMax);
    this.alt = clamp(this.alt, C.altMin, C.altMax);
    if (this.hdg < 0) this.hdg += Math.PI * 2; else if (this.hdg >= Math.PI * 2) this.hdg -= Math.PI * 2;

    // Altitude: the error asks for a vertical speed, the stick is the error in it.
    // The integral is what closes the last few metres: the airframe's auto-trim ignores a
    // stick under a few percent, so a small error would otherwise sit there for ever.
    if (this.altHold) {
      const altErr = this.alt - p.y;
      // Only near the target: far from it the integral would wind up on the climb and carry
      // the aircraft through the target; there it bleeds away.
      if (altErr > -C.intBand && altErr < C.intBand) this.vsInt = clamp(this.vsInt + C.kAltI * altErr * dt, -C.vsInt, C.vsInt);
      else this.vsInt -= this.vsInt * Math.min(1, C.intLeak * dt);
      const vs = clamp(altErr * C.kAlt + this.vsInt, -C.vsMax, C.vsMax);
      this.vsCmd = vs;
      cmd.pitch = clamp((vs - p.vy) * C.kVs, -C.pitchMax, C.pitchMax);
    }

    // Heading: the error asks for a bank, the stick is the error in it. The bank is
    // eased off as the aircraft nears the heading so it rolls out on it.
    if (this.hdgHold) {
      this.bankCmd = clamp(wrapPi(this.hdg - a.heading) * C.kHdg, -C.bankMax, C.bankMax);
      // A damaged wing needs sustained opposite stick. Integrate actual bank error,
      // like a pilot trimming it out, bounded by the same physical controls.
      const asymmetric = p.damage.get('wingL') !== p.damage.get('wingR');
      if (asymmetric) {
        const error = this.bankCmd - a.bank;
        const raw = error * C.kBank + this.rollTrim;
        if (Math.abs(raw) < C.rollMax || raw * error < 0) this.rollTrim = clamp(this.rollTrim + error * D.apRollTrimRate * dt, -D.apRollTrimLimit, D.apRollTrimLimit);
      } else this.rollTrim = 0;
      cmd.roll = clamp((this.bankCmd - a.bank) * C.kBank + this.rollTrim, -C.rollMax, C.rollMax);
    }

    // Speed: the error asks for an acceleration, and the lever moves at a rate in proportion
    // to the acceleration still missing. The measured acceleration is the calibrated speed's
    // rate of change, smoothed.
    // (The first reading only sets the baseline, and nothing above a believable acceleration
    // is let through: a speed that jumps between steps is a new aircraft, not a push.)
    if (this._primed) {
      const raw = clamp((p.cas - this._cas) / dt, -ACC_LIMIT, ACC_LIMIT);
      this.acc += (raw - this.acc) * (1 - Math.exp(-dt / C.accTau));
    } else this._primed = true;
    this._cas = p.cas;
    if (this.spdHold) {
      this.accCmd = clamp((this.spd - p.cas) * C.kSpd, -C.aMax, C.aMax);
      cmd.throttleRate = clamp((this.accCmd - this.acc) * C.kSpdA, -1, 1);
    }
    return true;
  }
}
