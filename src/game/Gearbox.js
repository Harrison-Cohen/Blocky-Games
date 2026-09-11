// The gearbox the engine note and the rev counter read, and in manual mode the
// one the player's car drives through.
//
// In automatic -- the default, and all the AI ever uses -- the physics has no
// gears: engine force falls away smoothly with speed, which is what keeps the
// handling easy to tune. The Gearbox class derives a believable gear and rpm
// from road speed and throttle, at render time, and feeds nothing back.
//
// In manual the player picks the gear, and the physics asks manualDrive() how
// much of that same force the gear lets through: all of it in the right gear,
// less while the engine is lugging, none on the limiter or in neutral. The
// ratios are the automatic's own, so a player who shifts at the redline drives
// exactly the automatic's car and can never beat it.

import { AUDIO, GEARBOX } from '../data/tuning.js';

export function voiceFor(chassisId) {
  return (AUDIO.voices && AUDIO.voices[chassisId]) || AUDIO.defaultVoice;
}

// Top of gear k (from 1) as a fraction of the chassis's top speed. Spaced
// geometrically, so every upshift drops the revs by the same ratio.
export function gearTop(voice, k) {
  const n = voice.gears, f1 = AUDIO.firstGearTop;
  return n <= 1 ? 1 : f1 * Math.pow(1 / f1, (k - 1) / (n - 1));
}

function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

// Manual mode, called from inside the physics step: the fraction of the drive
// force that `gear` (0 is neutral) lets through at `frac` of the chassis's top
// speed. A pure function of its arguments that allocates nothing, so it runs
// on the fixed clock like everything else there.
export function manualDrive(voice, gear, frac) {
  if (!(gear >= 1)) return 0;
  const top = gearTop(voice, Math.min(gear, voice.gears));
  const rev = frac / top; // fraction of the redline
  // Off the line the clutch slips and a gear pulls in proportion to its ratio:
  // all of it in first, about a quarter in top.
  const lug = Math.pow(gearTop(voice, 1) / top, GEARBOX.lugExponent);
  // Written so that inside the band it is exactly 1, not 1 give or take a
  // rounding error: in the right gear the car must be the automatic's car.
  const pull = 1 - (1 - lug) * (1 - smoothstep(0, GEARBOX.pullBand, rev));
  // Top gear has no limiter. It runs out where the car does, at its top
  // speed, which the automatic's car nearly reaches; a limiter there would
  // cost manual a few mph the automatic keeps.
  if (gear >= voice.gears) return pull;
  return pull * (1 - smoothstep(GEARBOX.limiter, 1, rev));
}

export class Gearbox {
  constructor(chassis = null) {
    this.gear = 1;
    this.rpm = 0;
    this.shift = 0;   // seconds left of the dip after a change
    this.label = 'N';
    // Manual mode. `selected` is the player's gear, 0 for neutral; the game
    // hands it to the physics as input. Ignored in automatic.
    this.manual = false;
    this.selected = 1;
    this.limiting = false; // at the rev limiter
    this.cut = false;      // in the dip of a limiter bounce, for the sound
    this._bounce = 0;
    if (chassis) this.setChassis(chassis);
  }

  setChassis(chassis) {
    this.chassis = chassis;
    this.voice = voiceFor(chassis.id);
    this.gear = 1;
    this.selected = 1;
    this.rpm = this.voice.idle;
    this.shift = 0;
    this.label = 'N';
  }

  gearTop(k) {
    return gearTop(this.voice, k);
  }

  rpmAt(k, frac) {
    return (this.voice.redline * frac) / this.gearTop(k);
  }

  // Manual takes over in whatever gear the automatic was holding, so flicking
  // the switch mid-corner does nothing to the car by itself.
  setManual(on) {
    this.manual = !!on;
    this.selected = Math.min(this.voice.gears, Math.max(1, this.gear));
  }

  // Sequential: up from neutral is first, down from first is neutral.
  shiftUp() {
    if (this.selected >= this.voice.gears) return false;
    this.selected++;
    this.shift = AUDIO.shiftTime;
    return true;
  }

  shiftDown() {
    if (this.selected <= 0) return false;
    this.selected--;
    this.shift = AUDIO.shiftTime * 0.6;
    return true;
  }

  neutral() {
    if (this.selected === 0) return;
    this.selected = 0;
    this.shift = AUDIO.shiftTime * 0.6;
  }

  // A car put back on the road, or on a grid, starts in first.
  resetGear() {
    this.selected = 1;
    this.gear = 1;
  }

  // speed: forward speed, m/s, negative when reversing. load: throttle, or
  // the brake pedal when it is driving the car backwards. forceAuto: someone
  // else is driving (auto drive, the cool-down lap) and the physics is in
  // automatic whatever the player chose, so the readout must be too.
  update(dt, speed, load, forceAuto = false) {
    if (this.manual && !forceAuto) { this._updateManual(dt, speed, load); return; }
    this.limiting = false;
    this.cut = false;
    const v = this.voice;
    const frac = Math.abs(speed) / Math.max(1, this.chassis.topSpeed);
    const reverse = speed < -0.5;
    if (reverse) {
      this.gear = 1;
    } else {
      while (this.gear < v.gears && this.rpmAt(this.gear, frac) > v.redline * AUDIO.shiftUp) {
        this.gear++;
        this.shift = AUDIO.shiftTime;
      }
      while (this.gear > 1 && this.rpmAt(this.gear - 1, frac) < v.redline * AUDIO.shiftDown) {
        this.gear--;
        this.shift = AUDIO.shiftTime * 0.6;
      }
    }

    let target = Math.max(v.idle, this.rpmAt(this.gear, frac));
    // Off the line the clutch is slipping: the revs are the throttle's, not
    // the road's, until first gear has caught up with them.
    if (this.gear === 1 && !reverse) {
      const slip = Math.max(0, 1 - frac / (this.gearTop(1) * AUDIO.clutchCatch));
      target = Math.max(target, v.idle + (v.redline * AUDIO.launchRpm - v.idle) * load * slip);
    }
    target = Math.min(target, v.redline);
    this.rpm += (target - this.rpm) * (1 - Math.exp(-AUDIO.rpmRate * dt));
    this.shift = Math.max(0, this.shift - dt);
    this.label = reverse ? 'R' : (Math.abs(speed) < 0.5 && load < 0.05 ? 'N' : String(this.gear));
    // Manual, but someone else is driving: keep the player's gear in step, so
    // taking the wheel back does not leave the car in first at 100 mph.
    if (this.manual) this.selected = this.gear;
  }

  // The player's gear, and the revs it gives. Reversing is still the brake
  // pedal's job in any gear but neutral, and reads as first going backwards.
  _updateManual(dt, speed, load) {
    const v = this.voice;
    const frac = Math.abs(speed) / Math.max(1, this.chassis.topSpeed);
    const reverse = speed < -0.5;
    const g = this.selected;
    let target;
    if (g === 0) {
      // Neutral: nothing holds the engine, so the throttle alone sets the revs.
      target = v.idle + (v.redline - v.idle) * load;
    } else {
      const k = reverse ? 1 : g;
      target = Math.max(v.idle, this.rpmAt(k, frac));
      const slip = Math.max(0, 1 - frac / (this.gearTop(k) * AUDIO.clutchCatch));
      target = Math.max(target, v.idle + (v.redline * AUDIO.launchRpm - v.idle) * load * slip);
    }
    // Where the physics cuts the drive: short of the redline in every gear
    // but top, which has no limiter.
    this.limiting = target >= v.redline * (g >= v.gears ? 1 : GEARBOX.limiter);
    target = Math.min(target, v.redline);
    // Held on the limiter with the throttle down, the revs bounce off it.
    this._bounce = (this._bounce + GEARBOX.limiterHz * dt) % 1;
    this.cut = this.limiting && load > 0.05 && this._bounce < 0.5;
    if (this.cut) target -= v.redline * GEARBOX.limiterDip;
    this.rpm += (target - this.rpm) * (1 - Math.exp(-AUDIO.rpmRate * dt));
    this.shift = Math.max(0, this.shift - dt);
    // The automatic picks up from here if manual is switched off.
    this.gear = Math.max(1, g);
    this.label = g === 0 ? 'N' : reverse ? 'R' : String(g);
  }
}
