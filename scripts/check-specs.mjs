// The real cars, measured.
//
// Five of the chassis are modelled on real cars, and cars.js carries each
// one's published figures in `specs`; the game scales them by STREET in
// tuning.js (gameSpecs() in cars.js). This drives every chassis through the
// real physics on flat, endless tarmac -- a standing start held to top speed,
// a constant-speed skidpad at full lock, and a crawl at full lock -- and holds
// what it measures to those scaled figures:
//
//   0-60 mph        within 0.15 s
//   quarter mile    within 0.3 s
//   top speed       within 3 mph
//   skidpad         within 0.03 g, at 47 mph
//   turning circle  within 0.3 m, kerb to kerb
//
// The open-wheeler is not a real car; its specs are what it measures, so this
// still catches a tuning change that moves it.
//
//   npm run specs
//
// measure() is exported, so scripts/fit-specs.mjs can tune a chassis with the
// same numbers.

import { fileURLToPath, pathToFileURL } from 'node:url';

const SRC = fileURLToPath(new URL('../src/', import.meta.url));
const { CHASSIS, gameSpecs } = await import(SRC + 'data/cars.js');
const { SIM } = await import(SRC + 'data/tuning.js');
// The standing start is shared with the garage, which measures a tuned
// gearbox the same way.
const { FLAT, drive, parked, straightLine } = await import(SRC + 'game/Performance.js');

const dt = 1 / SIM.hz;
const G = 9.81;

export const TOLERANCE = {
  zeroToSixty: 0.15, quarterMile: 0.3, topSpeedMph: 3, skidpadG: 0.03, turningCircle: 0.3,
};

// Held at a constant speed with the steering at full lock, which is how a
// keyboard corners: the steering limit keeps the front at its peak, so this is
// the most the car will pull. 21 m/s is a 300 ft skidpad at about 1 g.
function skidpad(chassis, speed = 21) {
  const p = parked(chassis);
  let sum = 0, n = 0, slip = 0;
  for (let k = 0; k < SIM.hz * 24; k++) {
    const t = k * dt;
    const err = speed - p.vLong;
    const throttle = Math.max(0, Math.min(1, 0.2 + err * 0.6));
    const brake = err < -0.5 ? Math.min(1, -err * 0.4) : 0;
    const steer = t < 10 ? 0 : -Math.min(1, (t - 10) / 2);
    p.step(dt, drive(brake > 0 ? 0 : throttle, brake, steer), FLAT);
    if (t > 18) {
      sum += Math.abs(p.speed * p.yawRate);
      n++;
      slip = Math.max(slip, Math.abs(Math.atan2(p.vLat, Math.abs(p.vLong))));
    }
  }
  return { skidpadG: sum / n / G, skidpadSlip: slip };
}

// A crawl at full lock. Kerb to kerb is the circle the OUTSIDE of the outer
// front tyre draws.
function turningCircle(chassis) {
  const p = parked(chassis);
  const edge = chassis.wheelRadius * 0.39; // half the tyre's width
  const pts = [];
  for (let k = 0; k < SIM.hz * 60; k++) {
    const err = 1.5 - p.speed;
    // No floor on the throttle: 2% of a strong car's launch force is enough to
    // push it past the crawl speed and widen the circle.
    const throttle = Math.max(0, Math.min(1, err * 0.5));
    p.step(dt, drive(throttle, 0, -1), FLAT); // full right lock
    if (k >= SIM.hz * 20 && k % 6 === 0) {
      // Turning right the outside front is the left one, and +x is the left.
      const s = Math.sin(p.yaw), c = Math.cos(p.yaw);
      const lx = p.cornerX[0] + edge, lz = p.cornerZ[0];
      pts.push(p.x + lx * c + lz * s, p.z - lx * s + lz * c);
    }
  }
  let best = 0;
  for (let i = 0; i < pts.length; i += 2) {
    for (let j = i + 2; j < pts.length; j += 2) {
      best = Math.max(best, Math.hypot(pts[i] - pts[j], pts[i + 1] - pts[j + 1]));
    }
  }
  return best;
}

export function measure(chassis) {
  return { ...straightLine(chassis), ...skidpad(chassis), turningCircle: turningCircle(chassis) };
}

const LABELS = {
  zeroToSixty: ['0-60 mph', (v) => `${v.toFixed(2)} s`],
  quarterMile: ['quarter mile', (v) => `${v.toFixed(2)} s`],
  topSpeedMph: ['top speed', (v) => `${v.toFixed(0)} mph`],
  skidpadG: ['skidpad', (v) => `${v.toFixed(2)} g`],
  turningCircle: ['turning circle', (v) => `${v.toFixed(1)} m`],
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let failures = 0;
  for (const c of CHASSIS) {
    const m = measure(c);
    console.log(`\n${c.name}${c.specs && c.specs.model !== c.name ? `  (${c.specs.model})` : ''}`);
    const game = gameSpecs(c);
    for (const [k, [label, fmt]] of Object.entries(LABELS)) {
      const want = game[k];
      if (want == null) continue;
      const got = m[k];
      const ok = got != null && Math.abs(got - want) <= TOLERANCE[k];
      if (!ok) failures++;
      const real = c.specs[k] !== want ? `   (real car ${fmt(c.specs[k])})` : '';
      console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label.padEnd(15)} ${(got == null ? 'never' : fmt(got)).padStart(9)}   want ${fmt(want)}${real}`);
    }
    console.log(`        trap speed      ${m.trapMph == null ? '-' : m.trapMph.toFixed(0) + ' mph'}`
      + `   skidpad sideslip ${(m.skidpadSlip * 180 / Math.PI).toFixed(1)} deg`);
  }
  console.log(failures === 0
    ? '\nPASS: every car does what its specs say.'
    : `\nFAIL: ${failures} figure(s) off the car's specs.`);
  process.exit(failures === 0 ? 0 : 1);
}
