// A car's straight-line figures, measured through the real physics on flat,
// endless tarmac: 0-60 mph, the quarter mile and its trap speed, and the top
// speed. `npm run specs` holds every chassis to its figures with this, and the
// garage runs it on a tuned gearbox to show what the tune does. Pure physics,
// no DOM: a whole run to top speed is a few milliseconds.

import { VehiclePhysics } from './VehiclePhysics.js';
import { SIM } from '../data/tuning.js';

const dt = 1 / SIM.hz;
const MPH = 2.236936;
const SIXTY = 60 / MPH;
const QUARTER = 402.336;

// Flat tarmac that goes on for ever.
export const FLAT = {
  sample: () => ({ height: 0, normal: { x: 0, y: 1, z: 0 }, surface: 'tarmac', onTrack: true }),
  bounds: () => ({ lateral: 0, limit: 1e9, inwardX: 0, inwardZ: 0, onTrack: true }),
};

export const drive = (throttle, brake, steer) =>
  ({ throttle, brake, steer, handbrake: 0, steerIsAnalog: true, pedalsAreAnalog: true });

// Standing still on its springs, pointing down +z.
export function parked(chassis) {
  const p = new VehiclePhysics(chassis);
  p.reset(0, chassis.suspensionRest, 0, 0);
  for (let i = 0; i < SIM.hz; i++) p.step(dt, drive(0, 0, 0), FLAT);
  return p;
}

// A standing start at full throttle, in automatic, held until the speed stops
// rising. Times are interpolated inside the step that crossed, so they are not
// quantised to the physics step.
export function straightLine(chassis) {
  const p = parked(chassis);
  const z0 = p.z;
  let t = 0, prevV = p.vLong, prevD = 0;
  let zeroToSixty = null, quarterMile = null, trap = null, top = 0, mark = 0, markT = 0;
  for (let k = 0; k < SIM.hz * 900; k++) {
    p.step(dt, drive(1, 0, 0), FLAT);
    t += dt;
    const v = p.vLong, d = p.z - z0;
    if (zeroToSixty === null && v >= SIXTY) {
      zeroToSixty = t - dt * (v - SIXTY) / Math.max(1e-9, v - prevV);
    }
    if (quarterMile === null && d >= QUARTER) {
      quarterMile = t - dt * (d - QUARTER) / Math.max(1e-9, d - prevD);
      trap = v;
    }
    top = Math.max(top, v);
    // Top speed: less than a tenth of a mph gained in the last ten seconds.
    if (t - markT >= 10) {
      if (quarterMile !== null && (v - mark) * MPH < 0.1) break;
      mark = v; markT = t;
    }
    prevV = v; prevD = d;
  }
  return { zeroToSixty, quarterMile, trapMph: trap === null ? null : trap * MPH, topSpeedMph: top * MPH };
}
