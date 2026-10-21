// The refit of the Boeing 737-800 (scripts/fit-aircraft.mjs b737): what it moves and what
// it matches.
//
//   wave drag      a multiplier on the drag rise above Mach 0.78, which sets the Mach
//                  the aircraft settles at in level flight at 35,000 ft with the lever at
//                  the stop (0.82, the published maximum operating Mach)
//   thrust lapse   the engines' density exponent, which sets how much climb is left at
//                  41,000 ft (the service ceiling is where it falls to 0.5 m/s)
//   flap gains     each detent's gain on the wings' lift, which sets the 1 g stall speed
//                  at that setting (flaps 30 is Vref over 1.23)
// It also reports, but does not fit, the cruise lever, the takeoff and the landing.

const A = await import('./airliner-harness.mjs');
const H = await import('./flight-harness.mjs');
const FT = H.FT;

function solve(f, x0, target, tol, lo = 0.05, hi = 20) {
  let a = x0, b = x0 * 1.06, fa = f(a) - target, fb = f(b) - target;
  for (let it = 0; it < 14 && Math.abs(fb) > tol; it++) {
    const c = Math.min(hi, Math.max(lo, b - fb * (b - a) / ((fb - fa) || 1e-9)));
    a = b; fa = fb; b = c; fb = f(b) - target;
  }
  return b;
}

export default async function fit(def0) {
  const fg = def0.figures;
  const mid = A.payloadFor(def0, 62000, 0.5);
  const light = A.payloadFor(def0, 60000, 0.4);
  const d = structuredClone(def0);
  const waveAbove = d.waveCd.map(([m, c]) => [m, c]);
  const setWave = (x) => { d.waveCd = waveAbove.map(([m, c]) => [m, m >= 0.78 ? c * x : c]); };
  const maxMach = () => A.settledMach(d, 35000 * FT, 1, { payload: mid, seconds: 500 }).mach;
  const ceilingClimb = () => A.climbPotential(d, fg.ceiling.value * FT, { payload: light, fuel: 0.4 });

  let wave = 1, lapse = d.engines[0].kDry;
  for (let pass = 0; pass < 2; pass++) {
    wave = solve((x) => { setWave(x); return maxMach(); }, wave, fg.maxMach.value, 0.0015);
    setWave(wave);
    lapse = solve((k) => { for (const e of d.engines) e.kDry = k; return ceilingClimb(); }, lapse, 0.5, 0.03, 0.5, 1.2);
    for (const e of d.engines) e.kDry = lapse;
  }
  setWave(wave);
  console.log(`wave drag x${wave.toFixed(3)} -> level Mach at 35,000 ft with the lever at the stop ${maxMach().toFixed(3)} (target ${fg.maxMach.value})`);
  console.log(`thrust lapse kDry ${lapse.toFixed(3)} -> climb at ${fg.ceiling.value} ft ${ceilingClimb().toFixed(2)} m/s (target 0.5)`);

  const gains = d.flaps.detents.map((x) => x.gain);
  for (let k = 1; k < d.flaps.detents.length; k++) {
    const want = fg.stall.speeds[k];
    gains[k] = solve((g) => { d.flaps.detents[k].gain = g; return A.stallSpeed(d, { flaps: k, payload: A.payloadFor(d, 65000, 0.5) }); }, Math.max(0.05, gains[k]), want, 0.15, 0.02, 4);
    d.flaps.detents[k].gain = gains[k];
  }
  const vs = d.flaps.detents.map((_, k) => A.stallSpeed(d, { flaps: k, payload: A.payloadFor(d, 65000, 0.5) }));
  console.log(`flap gains ${gains.map((g) => g.toFixed(3)).join(', ')} -> stall speeds at 65 t ${vs.map((v) => v.toFixed(1)).join(', ')} kt (targets ${fg.stall.speeds.join(', ')})`);

  const fmt = (t) => '[' + t.map(([m, v]) => `[${m}, ${+v.toFixed(5)}]`).join(', ') + ']';
  console.log('\nPaste into src/data/aircraft.js (B737):');
  console.log('  waveCd:', fmt(d.waveCd) + ',');
  console.log(`  the engines' kDry: ${+lapse.toFixed(3)} (CFM56, both)`);
  console.log('  the flap gains:', d.flaps.detents.map((x) => `${x.name}: ${+x.gain.toFixed(3)}`).join(', '));

  // What it does with that, for reference.
  const cruise = (lever) => A.settledMach(d, 35000 * FT, lever, { payload: mid, seconds: 400 }).mach;
  let lo = 0.4, hi = 1;
  for (let i = 0; i < 12; i++) { const m = (lo + hi) / 2; if (cruise(m) < fg.cruiseMach.value) lo = m; else hi = m; }
  console.log(`\ncruise Mach ${fg.cruiseMach.value} at 35,000 ft needs the lever at ${((lo + hi) / 2).toFixed(2)}`);
  const to = A.takeoffRun(d, H.field, A.fieldRunway, { x: 0, y: 0, z: 80, heading: 0 }, { flaps: 1, vrFactor: 1.04 });
  console.log(`takeoff at ${to.mass.toFixed(0)} kg, flaps 5: VR ${to.vr.toFixed(0)} kt, lift off ${to.liftoffSpeed.toFixed(0)} kt after ${to.roll.toFixed(0)} m, 35 ft at ${to.d35.toFixed(0)} m; field length (x1.15) ${(1.15 * to.d35).toFixed(0)} m (published ${fg.takeoffFieldLength.value})`);
  const ld = A.landingRun(d, H.field, A.fieldRunway, { x: 0, y: 0, z: 0, heading: 0 }, { flaps: 3 });
  const s = ld.st;
  console.log(`landing at ${ld.mass.toFixed(0)} kg, flaps 30: Vref ${ld.vref.toFixed(0)} kt, 50 ft to stop ${(s.stopU - s.u50).toFixed(0)} m; field length (/0.6) ${((s.stopU - s.u50) / 0.6).toFixed(0)} m (published ${fg.landingFieldLength.value})`);
}
