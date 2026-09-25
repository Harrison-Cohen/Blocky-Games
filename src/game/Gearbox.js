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
//
// A gearbox tuned in the garage (a `tune`, kept per chassis) changes the car
// itself: tunedChassis() hands the physics a copy of the chassis with the
// final drive folded into its power and top speed, and its own ratios and
// shift point in `gearing`. A tuned car drives through its gears in automatic
// too -- the physics changes gear with autoGear(), on the fixed clock -- so
// the shift point and the ratios are felt whichever way it is driven. A stock
// tune gives back the chassis itself, untouched.

import { AUDIO, GEARBOX } from '../data/tuning.js';

export function voiceFor(chassisId) {
  return (AUDIO.voices && AUDIO.voices[chassisId]) || AUDIO.defaultVoice;
}

// Top of gear k (from 1) as a fraction of the chassis's top speed. Spaced
// geometrically, so every upshift drops the revs by the same ratio -- unless
// the voice is a tuned one, which carries its own.
export function gearTop(voice, k) {
  if (voice.tops) return voice.tops[k - 1];
  const n = voice.gears, f1 = voice.firstGearTop ?? AUDIO.firstGearTop;
  return n <= 1 ? 1 : f1 * Math.pow(1 / f1, (k - 1) / (n - 1));
}

// The automatic's choice of gear at `frac` of the top speed, from `gear`:
// up past the shift point, down once the gear below would sit under the
// change-down point. Shared by the physics (a tuned car) and the readout.
export function autoGear(voice, gear, frac) {
  const up = voice.shiftUp ?? AUDIO.shiftUp, down = voice.shiftDown ?? AUDIO.shiftDown;
  while (gear < voice.gears && frac / gearTop(voice, gear) > up) gear++;
  while (gear > 1 && frac / gearTop(voice, gear - 1) < down) gear--;
  return gear;
}

// --- the tune ----------------------------------------------------------------
// { finalDrive, tops, shiftUp }: the final drive as a multiple of stock, where
// each gear runs out as a fraction of the (tuned) top speed, and the
// automatic's shift point as a fraction of the redline. Ranges in GEARBOX.

export function stockTune(chassisId) {
  const v = voiceFor(chassisId);
  const tops = [];
  for (let k = 1; k <= v.gears; k++) tops.push(gearTop(v, k));
  return { finalDrive: 1, tops, shiftUp: AUDIO.shiftUp };
}

// Each gear at least gearGap above the one below, first no shorter than
// firstGearMin, top no taller than 1. A one-speed car's gear is its top.
function fitTops(tops) {
  const n = tops.length, G = GEARBOX;
  const out = [];
  for (let i = 0; i < n; i++) {
    const lo = i === 0 ? G.firstGearMin : out[i - 1] + G.gearGap;
    const hi = 1 - (n - 1 - i) * G.gearGap;
    out.push(n === 1 ? 1 : Math.min(hi, Math.max(lo, tops[i])));
  }
  return out;
}

// A tune from storage or the garage, held to what the gearbox can do. Anything
// that is not one comes back stock.
export function normalizeTune(chassisId, raw) {
  const base = stockTune(chassisId);
  if (!raw || typeof raw !== 'object') return base;
  const G = GEARBOX;
  const num = (v, lo, hi, d) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
  const tops = Array.isArray(raw.tops) && raw.tops.length === base.tops.length
    && raw.tops.every((t) => typeof t === 'number' && Number.isFinite(t))
    ? fitTops(raw.tops) : base.tops;
  return {
    finalDrive: num(raw.finalDrive, G.finalDriveMin, G.finalDriveMax, 1),
    tops,
    shiftUp: num(raw.shiftUp, G.shiftPointMin, G.shiftPointMax, AUDIO.shiftUp),
  };
}

// Stock to within the rounding of stepping away and back again.
export function isStockTune(chassisId, tune) {
  const base = stockTune(chassisId);
  const near = (a, b) => Math.abs(a - b) < 1e-6;
  return !tune || (near(tune.finalDrive, 1) && near(tune.shiftUp, base.shiftUp)
    && tune.tops.length === base.tops.length && tune.tops.every((t, i) => near(t, base.tops[i])));
}

// The chassis the physics drives with this tune: the final drive in its power
// and top speed (see GEARBOX.finalDriveMin), the ratios and the shift point
// in `gearing`. A stock tune is the chassis itself, so an untuned car is
// exactly the car cars.js describes, and the checks' car.
export function tunedChassis(chassis, tune) {
  if (isStockTune(chassis.id, tune)) return chassis;
  const t = normalizeTune(chassis.id, tune);
  const fd = t.finalDrive;
  return {
    ...chassis,
    power: chassis.power * fd,
    topSpeed: chassis.topSpeed / fd,
    gearing: {
      ...voiceFor(chassis.id),
      stock: voiceFor(chassis.id),
      tops: t.tops,
      shiftUp: t.shiftUp,
      // Changes down move with the shift point, so a low one cannot hunt.
      shiftDown: AUDIO.shiftDown * t.shiftUp / AUDIO.shiftUp,
    },
  };
}

function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

// The engine's power at `rev` of the redline, as a share of its peak, for a
// tuned gearbox: see GEARBOX.powerPeak. Below pullBand the lug above takes
// over, so the curve is held flat there.
function enginePower(rev) {
  const d = Math.min(1, Math.max(GEARBOX.pullBand, rev)) - GEARBOX.powerPeak;
  return 1 - GEARBOX.powerDrop * d * d;
}

// Manual mode, and a tuned gearbox in either mode, called from inside the
// physics step: the fraction of the drive force that `gear` (0 is neutral)
// lets through at `frac` of the chassis's top speed. A pure function of its
// arguments that allocates nothing, so it runs on the fixed clock like
// everything else there.
export function manualDrive(voice, gear, frac) {
  if (!(gear >= 1)) return 0;
  const top = gearTop(voice, Math.min(gear, voice.gears));
  const rev = frac / top; // fraction of the redline
  // Off the line the clutch slips and a gear pulls in proportion to its ratio:
  // all of it in first, about a quarter in top.
  const lug = Math.pow(gearTop(voice, 1) / top, GEARBOX.lugExponent);
  // Written so that inside the band it is exactly 1, not 1 give or take a
  // rounding error: in the right gear the car must be the automatic's car.
  let pull = 1 - (1 - lug) * (1 - smoothstep(0, GEARBOX.pullBand, rev));
  // A tuned gearbox is measured against the stock one it replaces (`stock`,
  // from tunedChassis): the engine's power at these revs, over its power at
  // the revs the stock automatic would be turning at this speed. Gears that
  // keep the engine nearer its peak pull harder than stock, a shift point
  // that drops it out of the band pulls less, and a tune the same as stock
  // is exactly stock.
  if (voice.stock) {
    const s = voice.stock;
    pull *= enginePower(rev) / enginePower(frac / gearTop(s, autoGear(s, 1, frac)));
  }
  // Top gear has no limiter. It runs out where the car does, at its top
  // speed, which the automatic's car nearly reaches; a limiter there would
  // cost manual a few mph the automatic keeps. A tuned top gear shorter
  // than that runs out on its limiter, like any other.
  if (gear >= voice.gears && (!voice.tops || top >= 1 - 1e-6)) return pull;
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
    this.voice = chassis.gearing || voiceFor(chassis.id);
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
  // gear: the gear the physics is in, for a tuned car in automatic, which
  // drives through its gears and so decides them itself. 0 otherwise.
  update(dt, speed, load, forceAuto = false, gear = 0) {
    if (this.manual && !forceAuto) { this._updateManual(dt, speed, load); return; }
    this.limiting = false;
    this.cut = false;
    const v = this.voice;
    const frac = Math.abs(speed) / Math.max(1, this.chassis.topSpeed);
    const reverse = speed < -0.5;
    if (reverse) {
      this.gear = 1;
    } else {
      const next = gear || autoGear(v, this.gear, frac);
      if (next > this.gear) this.shift = AUDIO.shiftTime;
      else if (next < this.gear) this.shift = AUDIO.shiftTime * 0.6;
      this.gear = next;
    }

    let target = Math.max(v.idle, this.rpmAt(this.gear, frac));
    // Off the line the clutch is slipping: the revs are the throttle's, not
    // the road's, until first gear has caught up with them.
    // An electric car has no clutch: its motor turns with the wheels.
    if (this.gear === 1 && !reverse && !v.electric) {
      const slip = Math.max(0, 1 - frac / (this.gearTop(1) * AUDIO.clutchCatch));
      target = Math.max(target, v.idle + (v.redline * AUDIO.launchRpm - v.idle) * load * slip);
    }
    target = Math.min(target, v.redline);
    this.rpm += (target - this.rpm) * (1 - Math.exp(-AUDIO.rpmRate * dt));
    this.shift = Math.max(0, this.shift - dt);
    const fwd = v.electric ? 'D' : String(this.gear);
    this.label = reverse ? 'R' : (Math.abs(speed) < 0.5 && load < 0.05 ? 'N' : fwd);
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
      // An electric motor in neutral is simply not driven.
      target = v.electric ? v.idle : v.idle + (v.redline - v.idle) * load;
    } else {
      const k = reverse ? 1 : g;
      target = Math.max(v.idle, this.rpmAt(k, frac));
      const slip = v.electric ? 0 : Math.max(0, 1 - frac / (this.gearTop(k) * AUDIO.clutchCatch));
      target = Math.max(target, v.idle + (v.redline * AUDIO.launchRpm - v.idle) * load * slip);
    }
    // Where the physics cuts the drive: short of the redline in every gear
    // but top, which has no limiter -- unless a tune has made it shorter.
    const open = g >= v.gears && (!v.tops || v.tops[v.gears - 1] >= 1 - 1e-6);
    this.limiting = target >= v.redline * (open ? 1 : GEARBOX.limiter);
    target = Math.min(target, v.redline);
    // Held on the limiter with the throttle down, the revs bounce off it.
    this._bounce = (this._bounce + GEARBOX.limiterHz * dt) % 1;
    this.cut = this.limiting && load > 0.05 && this._bounce < 0.5;
    if (this.cut) target -= v.redline * GEARBOX.limiterDip;
    this.rpm += (target - this.rpm) * (1 - Math.exp(-AUDIO.rpmRate * dt));
    this.shift = Math.max(0, this.shift - dt);
    // The automatic picks up from here if manual is switched off.
    this.gear = Math.max(1, g);
    this.label = g === 0 ? 'N' : reverse ? 'R' : v.electric ? 'D' : String(g);
  }
}
