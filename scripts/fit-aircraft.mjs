// Refits an aircraft's performance tables to its published figures, as
// fit-specs.mjs does for the cars. Run it after a change to the aerodynamics,
// the engines or the mass, then paste the tables it prints into
// src/data/aircraft.js.
//
//   node scripts/fit-aircraft.mjs [id]
//
// What it moves, two numbers, both multipliers on the tables already in the
// data: the wave drag above Mach 1.1, which sets the supercruise Mach (the dry
// engines are the same whatever it does), and then the afterburner's ram
// recovery above Mach 1.2, which sets the top speed. What it matches:
//   supercruise       level flight on military power at 40,000 ft
//   top speed         level flight in full afterburner at 40,000 ft
// It also reports, but does not fit, how long Mach 0.9 to 1.5 takes in
// afterburner at 30,000 ft: nobody publishes it, so it is a sanity check on
// the shape of the tables (a fighter does it in well under two minutes).

const H = await import('./lib/flight-harness.mjs');
const { AIRCRAFT, getAircraft } = await import(H.R + 'data/aircraft.js');

const def0 = getAircraft(process.argv[2] || AIRCRAFT[0].id);
const fg = def0.figures;
const FT = H.FT;

const apply = (x) => {
  const d = structuredClone(def0);
  d.waveCd = d.waveCd.map(([m, c]) => [m, m >= 1.1 ? c * x[0] : c]);
  for (const e of d.engines) {
    e.machAb = e.machAb.map(([m, f]) => [m, m >= 1.2 ? 1 + (f - 1) * x[1] : f]);
  }
  return d;
};
const supercruise = (x) => H.levelMach(apply(x), 40000 * FT, false, 1.9).mach;
const topSpeed = (x) => H.levelMach(apply(x), 40000 * FT, true, 2.0).mach;

// A secant search for the multiplier at index k that brings f(x) to target.
function solve(f, x, k, target, tol) {
  let a = x[k], b = x[k] * 1.1;
  const at = (v) => { const y = x.slice(); y[k] = v; return f(y); };
  let fa = at(a) - target, fb = at(b) - target;
  for (let it = 0; it < 12 && Math.abs(fb) > tol; it++) {
    const c = Math.max(0.1, b - fb * (b - a) / (fb - fa || 1e-9));
    a = b; fa = fb; b = c; fb = at(b) - target;
  }
  const y = x.slice(); y[k] = b;
  return y;
}

let x = [1, 1];
x = solve(supercruise, x, 0, fg.supercruiseMach.target, 0.004);
console.log(`wave drag x${x[0].toFixed(3)} -> supercruise Mach ${supercruise(x).toFixed(3)} (target ${fg.supercruiseMach.target})`);
x = solve(topSpeed, x, 1, fg.topMach.target, 0.004);
console.log(`afterburner ram x${x[1].toFixed(3)} -> top Mach ${topSpeed(x).toFixed(3)} (target ${fg.topMach.target})`);

const d = apply(x);
const fmt = (t) => '[' + t.map(([m, v]) => `[${m}, ${+v.toFixed(4)}]`).join(', ') + ']';
console.log('\nPaste into src/data/aircraft.js:');
console.log('  waveCd:', fmt(d.waveCd) + ',');
console.log('  machAb:', fmt(d.engines[0].machAb) + ',   (both engines)');
const at = H.accelTime(d, 30000 * FT, 0.9, 1.5, 300);
console.log(`\nMach 0.9 to 1.5 in afterburner at 30,000 ft: ${at < 0 ? 'never' : at.toFixed(1) + ' s'}`);
