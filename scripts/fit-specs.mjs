// Fits each real car's physics numbers to the figures `npm run specs` holds
// it to: the real car's, scaled by STREET in tuning.js (gameSpecs() in
// cars.js). Run it after changing STREET, a chassis's geometry, or anything
// global in tuning.js that moves the cars, and copy what it prints into
// cars.js:
//
//   node scripts/fit-specs.mjs [chassis-id ...]
//
// It fits steerRate to the turning circle, gripFront and gripRear to the
// skidpad -- keeping their ratio, which is the car's balance -- and power,
// launchSpeed and topSpeed to the 0-60, quarter mile and top speed, trying a
// few powerFalloff shapes. It is slow: a minute or more per car, and several
// for a car that needs a sweep.

import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('../src/', import.meta.url));
const { measure, TOLERANCE } = await import('./check-specs.mjs');
const { CHASSIS, gameSpecs, realTopSpeed } = await import(SRC + 'data/cars.js');

function solve3(A, b) {
  const det = (m) => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1])
    - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0])
    + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const D = det(A);
  if (Math.abs(D) < 1e-12) return [0, 0, 0];
  return [0, 1, 2].map((j) => det(A.map((row, i) => row.map((v, k) => (k === j ? b[i] : v)))) / D);
}

// The three straight-line figures, each in units of its tolerance.
function resid(c, want) {
  const m = measure(c);
  if (m.zeroToSixty == null || m.quarterMile == null) return [99, 99, 99];
  return [(m.zeroToSixty - want.zeroToSixty) / TOLERANCE.zeroToSixty,
    (m.quarterMile - want.quarterMile) / TOLERANCE.quarterMile,
    (m.topSpeedMph - want.topSpeedMph) / TOLERANCE.topSpeedMph];
}
const err = (r) => r.reduce((a, v) => a + v * v, 0);

// Gauss-Newton on [ln power, launchSpeed, ln topSpeed].
function accel(c, want) {
  const vt = realTopSpeed(c);
  const lo = [Math.log(1000), 4, Math.log(vt)], hi = [Math.log(40000), 45, Math.log(vt * 3)];
  const clampX = (v) => v.map((x, j) => Math.max(lo[j], Math.min(hi[j], x)));
  let x = clampX([Math.log(c.power), c.launchSpeed ?? 14, Math.log(Math.max(c.topSpeed, vt * 1.05))]);
  const apply = (v) => { c.power = Math.exp(v[0]); c.launchSpeed = v[1]; c.topSpeed = Math.exp(v[2]); };
  for (let it = 0; it < 14; it++) {
    apply(x);
    const r = resid(c, want);
    if (r.every((v) => Math.abs(v) < 0.1)) break;
    const h = [0.02, 0.5, 0.01];
    const cols = h.map((hj, j) => {
      const xp = x.slice(); xp[j] += hj; apply(xp);
      return resid(c, want).map((v, i) => (v - r[i]) / hj);
    });
    const A = [0, 1, 2].map((i) => [0, 1, 2].map((j) => cols[j][i]));
    const dx = solve3(A, r.map((v) => -v));
    const lim = [0.2, 6, 0.15];
    // Backtrack if the full step makes it worse.
    let step = 1, next = x;
    for (let tries = 0; tries < 5; tries++) {
      const cand = clampX(x.map((v, j) => v + step * Math.max(-lim[j], Math.min(lim[j], dx[j]))));
      apply(cand);
      if (err(resid(c, want)) < err(r)) { next = cand; break; }
      step *= 0.5;
    }
    if (next === x) break;
    x = next;
  }
  apply(x);
  return err(resid(c, want));
}

// Slower and surer, for where Gauss-Newton stalls: a sweep of launchSpeed,
// with power bisected onto the 0-60 and topSpeed onto the top speed.
function sweep(c, want) {
  const bisect = (f, lo, hi, target, rising) => {
    for (let i = 0; i < 13; i++) {
      const mid = (lo + hi) / 2;
      if ((f(mid) < target) === rising) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  };
  let best = null;
  for (let ls = 4; ls <= 44; ls += 3) {
    const k = { ...c, launchSpeed: ls };
    for (let i = 0; i < 3; i++) {
      k.power = bisect((p) => { k.power = p; return measure(k).zeroToSixty ?? 99; }, 1000, 40000, want.zeroToSixty, false);
      k.topSpeed = bisect((v) => { k.topSpeed = v; return measure(k).topSpeedMph; }, 30, 300, want.topSpeedMph, true);
    }
    const e = err(resid(k, want));
    if (!best || e < best.e) best = { e, k };
  }
  return best;
}

function fit(base) {
  const want = gameSpecs(base);
  const margin = base.gripRear / base.gripFront;
  const off = base.trackWidth / 2 + base.wheelRadius * 0.39;
  let best = null;
  // A high falloff holds the pull late, which a car asked for much more
  // acceleration than its top speed implies needs.
  const shapes = [...new Set([base.powerFalloff, undefined, 1.8, 3.0, 1.4, 4.0, 5.0, 6.0])];
  for (const n of shapes) {
    const c = { ...base, powerFalloff: n };
    let e = 0;
    for (let outer = 0; outer < 4; outer++) {
      for (let i = 0; i < 3; i++) {
        const m = measure(c);
        const ratio = (m.turningCircle / 2 - off) / (want.turningCircle / 2 - off);
        c.steerRate = Math.asin(Math.min(0.99, Math.sin(c.steerRate) * ratio));
      }
      for (let i = 0; i < 4; i++) {
        const m = measure(c);
        c.gripFront *= want.skidpadG / m.skidpadG;
        c.gripRear = c.gripFront * margin;
      }
      e = accel(c, want);
    }
    if (e > 1) {
      const s = sweep(c, want);
      if (s.e < e) { Object.assign(c, s.k); e = s.e; }
    }
    if (!best || e < best.e) best = { e, c };
    if (e < 1) break; // inside tolerance on this shape: keep it
  }
  return best.c;
}

const round = (v, q) => Math.round(v / q) * q;
const pick = process.argv.slice(2);
for (const base of CHASSIS) {
  if (base.specs.measured || (pick.length && !pick.includes(base.id))) continue;
  const c = fit({ ...base });
  c.power = round(c.power, 10);
  c.launchSpeed = +c.launchSpeed.toFixed(1);
  c.topSpeed = round(c.topSpeed, 0.5);
  c.gripFront = +c.gripFront.toFixed(3);
  c.gripRear = +(c.gripFront * base.gripRear / base.gripFront).toFixed(3);
  c.steerRate = +c.steerRate.toFixed(3);
  const m = measure(c), want = gameSpecs(c);
  console.log(`\n${c.id}: topSpeed ${c.topSpeed}, power ${c.power}, launchSpeed ${c.launchSpeed}, `
    + `powerFalloff ${c.powerFalloff ?? '(global)'}, gripFront ${c.gripFront}, gripRear ${c.gripRear}, steerRate ${c.steerRate}`);
  console.log(`   0-60 ${m.zeroToSixty.toFixed(2)} (${want.zeroToSixty.toFixed(2)})  quarter ${m.quarterMile.toFixed(2)} (${want.quarterMile.toFixed(2)})`
    + `  top ${m.topSpeedMph.toFixed(1)} (${want.topSpeedMph})  skidpad ${m.skidpadG.toFixed(3)} (${want.skidpadG.toFixed(3)})`
    + `  turning ${m.turningCircle.toFixed(2)} (${want.turningCircle})`);
}
