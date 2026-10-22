// The aircraft model, headless: the real AircraftPhysics, Wing, Engine, Gear and
// Atmosphere against the test field, with no browser and no renderer.
//
//   - the atmosphere matches the standard tables, and the airspeed it reads is right
//   - the signs are right: pull is nose up, roll right is right wing down, yaw
//     right is the nose to the right, and attitude() inverts quatFromAttitude()
//   - it trims: the stick centred, the path holds, at three points in the envelope
//   - it stalls softly, warns first, and recovers; the aids' master switch matters
//   - it meets its published figures (aircraft.js says where each came from)
//   - thrust vectoring gives low-speed pitch authority and fades out when fast
//   - the g limiter holds
//   - on the ground it sits, takes off, lands and rolls out; a hard hit is a crash
//   - the same flight at seven frame rates comes out identical to the bit
//   - step() allocates nothing
//
//   npm run flight

const H = await import('./lib/flight-harness.mjs');
const { F22, AIRCRAFT } = await import(H.R + 'data/aircraft.js');
const { atmosphere, createAtmosphere, calibratedAirspeed, equivalentAirspeed, ISA } = await import(H.R + 'flight/Atmosphere.js');
const { quatFromAttitude } = await import(H.R + 'flight/AircraftPhysics.js');
const Units = await import(H.R + 'flight/Units.js');
const { Loop } = await import(H.R + 'core/Loop.js');
const { FLIGHT } = H;
const { AircraftPhysics, makeInput, field, DT, FT, KT } = H;

let failed = false;
const check = (ok, msg) => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${msg}`);
  if (!ok) failed = true;
};
const near = (a, b, tol) => Math.abs(a - b) <= tol * Math.max(1e-12, Math.abs(b));
const f1 = (v) => v.toFixed(1);
const f2 = (v) => v.toFixed(2);
const f3 = (v) => v.toFixed(3);
const deg = (r) => (r * 180) / Math.PI;

// --- the atmosphere -----------------------------------------------------------
console.log('\nThe standard atmosphere');
{
  const atm = createAtmosphere();
  // ISA tables, altitude in metres (geopotential): temperature K and pressure
  // Pa. Density and the speed of sound follow from the gas law, so the check
  // is that the model's pressure and temperature profile agree with the tables
  // and that the rest follows from them.
  const table = [
    [0, 288.15, 101325],
    [5000, 255.65, 54019.9],
    [10000, 223.15, 26436.3],
    [11000, 216.65, 22632.1],
    [15000, 216.65, 12044.6],
    [20000, 216.65, 5474.89],
    [25000, 221.65, 2511.0],
  ];
  for (const [h, T, p] of table) {
    atmosphere(h, atm);
    const rho = p / (ISA.R * T), a = Math.sqrt(ISA.gamma * ISA.R * T);
    const ok = near(atm.T, T, 0.001) && near(atm.p, p, 0.001) && near(atm.rho, rho, 0.001) && near(atm.a, a, 0.001);
    check(ok, `${String(h).padStart(5)} m  T ${f2(atm.T)}  p ${atm.p.toFixed(0)}  rho ${atm.rho.toFixed(4)}  a ${f2(atm.a)}`);
  }
  // Airspeed: at sea level the indicated speed is the true speed; high up it is
  // the equivalent speed to within compressibility; and it is continuous
  // through Mach 1.
  atmosphere(0, atm);
  check(near(calibratedAirspeed(200, atm.p, atm.a), 200, 0.002), 'calibrated airspeed is true airspeed at sea level');
  atmosphere(11000, atm);
  const tas = 0.5 * atm.a;
  const cas = calibratedAirspeed(tas, atm.p, atm.a);
  const eas = equivalentAirspeed(tas, atm.rho);
  check(Math.abs(cas - eas) / eas < 0.04, `at 11 km, Mach 0.5: calibrated ${f1(cas / KT)} kt, equivalent ${f1(eas / KT)} kt`);
  const lo = calibratedAirspeed(0.999 * atm.a, atm.p, atm.a), hi = calibratedAirspeed(1.001 * atm.a, atm.p, atm.a);
  check(Math.abs(hi - lo) / lo < 0.02, `calibrated airspeed is continuous through Mach 1 (${f1(lo / KT)} to ${f1(hi / KT)} kt)`);
  check(near(Units.toKnots(Units.KT), 1, 1e-9) && near(Units.toFeet(Units.FT), 1, 1e-9), 'knots and feet convert');
}

// --- the signs ------------------------------------------------------------------
console.log('\nSigns: the stick does what it says');
{
  const flown = (over) => {
    const p = H.airborne(F22, { h: 3000, mach: 0.55, fuel: 0.5, throttle: 0.8 });
    const inp = makeInput(over);
    H.run(p, inp, 0.6);
    return { att: p.attitude(), p };
  };
  const base = flown({}).att;
  const pull = flown({ pitch: 1 }), push = flown({ pitch: -1 });
  check(pull.att.pitch - base.pitch > 0.2 && pull.p.nz > 2, `pull: nose up ${f1(deg(pull.att.pitch - base.pitch))} deg, ${f2(pull.p.nz)} g`);
  check(push.att.pitch - base.pitch < -0.12 && push.p.nz < 0, `push: nose down ${f1(deg(push.att.pitch - base.pitch))} deg, ${f2(push.p.nz)} g`);
  const right = flown({ roll: 1 }), left = flown({ roll: -1 });
  check(right.att.bank > 0.5, `roll right: bank ${f1(deg(right.att.bank))} deg`);
  check(left.att.bank < -0.5, `roll left: bank ${f1(deg(left.att.bank))} deg`);
  const yawR = flown({ yaw: 1 }), yawL = flown({ yaw: -1 });
  check(yawR.att.heading > 0.05 && yawR.att.heading < Math.PI, `yaw right: heading ${f1(deg(yawR.att.heading))} deg`);
  check(yawL.att.heading > Math.PI && yawL.att.heading < Math.PI * 2 - 0.05, `yaw left: heading ${f1(deg(yawL.att.heading))} deg`);

  // attitude() inverts quatFromAttitude().
  let worst = 0;
  const q = { qx: 0, qy: 0, qz: 0, qw: 1 };
  const probe = new AircraftPhysics(F22);
  for (let i = 0; i < 400; i++) {
    const h = (i * 0.754) % (Math.PI * 2), pt = (((i * 0.37) % 2) - 1) * 1.4, b = (((i * 0.61) % 2) - 1) * 3.0;
    quatFromAttitude(h, pt, b, q);
    probe.reset({ heading: h, pitch: pt, bank: b });
    const a = probe.attitude();
    const dh = Math.abs(((a.heading - h + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
    worst = Math.max(worst, dh, Math.abs(a.pitch - pt), Math.abs(a.bank - b));
  }
  check(worst < 1e-9, `attitude() inverts quatFromAttitude() (worst error ${worst.toExponential(1)})`);

  // The orientation stays a rotation after a long, violent flight.
  const p = H.airborne(F22, { h: 4000, mach: 0.6 });
  const inp = makeInput({ pitch: 1, roll: 1, yaw: 0.3 });
  H.run(p, inp, 60);
  const n = Math.hypot(p.qx, p.qy, p.qz, p.qw);
  check(Math.abs(n - 1) < 1e-12, `quaternion stays unit length through 60 s of pull and roll (${n.toFixed(14)})`);
}

// --- trim -----------------------------------------------------------------------
console.log('\nTrim: stick centred, the flight path holds');
{
  const points = [['250 kt at 10,000 ft', 10000 * FT, 250 * KT, false], ['Mach 0.9 at 30,000 ft', 30000 * FT, 0.9, true], ['Mach 1.6 at 40,000 ft', 40000 * FT, 1.6, true]];
  for (const [label, h, spd, isMach] of points) {
    const p = H.airborne(F22, { h, mach: isMach ? spd : 0.5, fuel: 0.5, throttle: 0.8 });
    if (!isMach) p.reset({ x: 0, y: h, z: 0, heading: 0, pitch: 0.03, speed: spd / Math.sqrt(p.atm.sigma), fuel: 0.5, throttle: 0.8, gear: 0 });
    const inp = makeInput();
    const target = isMach ? spd * p.atm.a : p.tas;
    const gamma = () => Math.asin(Math.max(-1, Math.min(1, p.vy / p.tas)));
    let released = false, tRel = 0, g0 = 0, v0 = 0, maxBank = 0;
    H.run(p, inp, 150, (t) => {
      inp.throttleRate = Math.max(-1, Math.min(1, (target - p.tas) * 0.05));
      if (!released) {
        H.altitudeHold(p, inp, h, 1);
        if (t > 30 && Math.abs(p.vy) < 1 && Math.abs(p.y - h) < 60) { released = true; tRel = t; }
      } else {
        inp.pitch = 0;
        maxBank = Math.max(maxBank, Math.abs(p.attitude().bank));
        if (g0 === 0 && t > tRel + 5) { g0 = gamma(); v0 = p.tas; }
      }
    });
    // What auto-trim promises is that the path does not wander once the stick
    // is let go: the climb or descent angle at the end is the one it had after
    // the stick came off, give or take a phugoid.
    const dg = deg(gamma() - g0), dv = (p.tas - v0) / KT;
    check(released && Math.abs(dg) < 3 && Math.abs(dv) < 40 && maxBank < 0.05,
      `${label.padEnd(22)} released ${released ? 'yes' : 'NO '}  path ${dg >= 0 ? '+' : ''}${f1(dg)} deg, speed ${dv >= 0 ? '+' : ''}${f1(dv)} kt, bank ${f1(deg(maxBank))} deg over 25 s`);
  }
}

// --- going fast: no nose-up on its own, and a pitch key that does something -----
console.log('\nGoing fast: the nose stays where the path is');
{
  // Settled with the stick centred, then the throttle opened wide or cut. The
  // climb angle must not wander off by more than a few degrees: the first
  // version of the trim faded with dynamic pressure along with the stick, ran
  // out of authority near Mach 1, and the aircraft climbed on its own to the
  // vertical.
  const cases = [['Mach 0.8 low down into afterburner', 300, 0.8, true], ['Mach 0.9 at 3,000 m into afterburner', 3000, 0.9, true],
    ['Mach 1.2 at 10,000 m into afterburner', 10000, 1.2, true], ['Mach 1.6 at 3,000 m, throttle cut', 3000, 1.6, false]];
  const gam = (p) => deg(Math.asin(Math.max(-1, Math.min(1, p.vy / p.tas))));
  for (const [label, h, mach, ab] of cases) {
    const p = H.airborne(F22, { h, mach, fuel: 0.5, throttle: 0.8 });
    const inp = makeInput({ analog: false });
    H.run(p, inp, 8, () => H.altitudeHold(p, inp, h));
    inp.pitch = 0;
    H.run(p, inp, 20);              // the trim finds its balance with the stick centred
    const g0 = gam(p);
    inp.ab = ab;
    if (!ab) p.throttle = 0.3;
    let worst = 0;
    H.run(p, inp, 25, () => { p.abFuel = 1; worst = Math.max(worst, Math.abs(gam(p) - g0)); });
    check(worst < 8 && !p.crashed, `${label}: the stick centred, the climb angle moves ${f1(worst)} deg from where it was (under 8) in 25 s`);
  }

  // A pitch key tapped for a fifth of a second moves the nose, at any speed.
  const tap = (h, mach) => {
    const p = H.airborne(F22, { h, mach, fuel: 0.5, throttle: 0.9 });
    const inp = makeInput({ analog: false });
    H.run(p, inp, 12, () => H.altitudeHold(p, inp, h));
    inp.pitch = 0; H.run(p, inp, 3);
    let peak = 0;
    H.run(p, inp, 1.5, (t) => { inp.pitch = t < 0.2 ? 1 : 0; peak = Math.max(peak, -p.wx); });
    return deg(peak);
  };
  for (const [h, mach] of [[3000, 0.5], [3000, 0.9], [3000, 1.4]]) {
    const r = tap(h, mach);
    check(r > 12, `a 0.2 s tap on the pitch key at Mach ${mach} gives ${f1(r)} deg/s of pitch rate (over 12)`);
  }

  // An F-22 pulls hard: a full pull is seven g inside half a second, from the
  // slow end to the fast, and the limiter holds it at the airframe's nine.
  for (const [h, mach] of [[3000, 0.5], [3000, 0.9], [3000, 1.4], [9000, 0.9]]) {
    const p = H.airborne(F22, { h, mach, fuel: 0.5, throttle: 0.9 });
    const inp = makeInput({ analog: false });
    H.run(p, inp, 12, () => H.altitudeHold(p, inp, h));
    inp.pitch = 0; H.run(p, inp, 3);
    let to7 = -1, peak = 0;
    H.run(p, inp, 4, (t) => {
      inp.pitch = 1;
      if (to7 < 0 && p.nz >= 7) to7 = t;
      peak = Math.max(peak, p.nz);
    });
    check(to7 > 0 && to7 < 0.6 && peak < 9.6 && !p.crashed, `a full pull at Mach ${mach}, ${h} m: 7 g in ${to7 > 0 ? f2(to7) : 'never'} s, peak ${f1(peak)} g (inside 0.6 s, under 9.6)`);
  }

  // Pushing over is firm but does not hurl the nose: it stays inside the negative
  // limit, and when the stick is let go the nose does not spring back much.
  for (const [h, mach, hold] of [[3000, 0.6, 1], [3000, 0.9, 1], [3000, 0.9, 3]]) {
    const p = H.airborne(F22, { h, mach, fuel: 0.5, throttle: 0.9 });
    const inp = makeInput({ analog: false });
    H.run(p, inp, 12, () => H.altitudeHold(p, inp, h));
    inp.pitch = 0; H.run(p, inp, 3);
    let low = 9, atRelease = 0;
    H.run(p, inp, hold + 4, (t) => {
      inp.pitch = t < hold ? -1 : 0;
      low = Math.min(low, p.nz);
      if (Math.abs(t - hold) < H.DT / 2) atRelease = deg(p.attitude().pitch);
    });
    const spring = deg(p.attitude().pitch) - atRelease;
    check(low > -4.2 && spring < 8 && !p.crashed, `a ${hold} s push at Mach ${mach}: lowest ${f1(low)} g (over -4.2: a full push settles near -2.4 and the airframe overshoots a little), the nose then comes back up ${f1(spring)} deg (under 8)`);
  }
}

// --- stall and recovery ----------------------------------------------------------
console.log('\nStall: warns first, softens, recovers');
function stallFlight(aids, recover) {
  FLIGHT.aids = aids;
  const p = H.airborne(F22, { h: 3000, mach: 0.5, fuel: 0.5, throttle: 0 });
  const inp = makeInput({ pitch: 1 });
  let warnAt = -1, stallAt = -1, recoverAt = -1, peakAfter = 0, started = -1;
  H.run(p, inp, recover ? 100 : 40, (t) => {
    if (warnAt < 0 && p.stallWarn) warnAt = t;
    if (stallAt < 0 && p.stalled) stallAt = t;
    if (stallAt >= 0) peakAfter = Math.max(peakAfter, Math.abs(p.alpha));
    if (!recover) return;
    if (stallAt >= 0 && started < 0) { started = t; inp.pitch = 0; p.throttle = 1; }
    if (started >= 0) {
      if (recoverAt < 0 && p.alpha < p.stallAlpha * 0.7 && p.alpha > -p.stallAlpha) recoverAt = t - started;
      // Once the wing is flying again, a pilot pulls out of the dive.
      if (recoverAt >= 0) H.altitudeHold(p, inp, 2500);
      else inp.pitch = 0;
    }
  });
  const out = { warnAt, stallAt, recoverAt, peakAfter, alt: p.y, cas: p.cas, crashed: p.crashed };
  FLIGHT.aids = true;
  return out;
}
{
  const rec = stallFlight(true, true);
  check(rec.stallAt > 0 && rec.warnAt > 0 && rec.warnAt < rec.stallAt, `the warning (${f1(rec.warnAt)} s) comes before the stall (${f1(rec.stallAt)} s)`);
  check(rec.recoverAt >= 0 && rec.recoverAt < 12, `centring the stick and adding power brings the angle of attack back in ${f1(rec.recoverAt)} s`);
  check(rec.alt > 800 && rec.cas > 150 * KT && !rec.crashed, `and the pilot pulls out and is flying: ${rec.alt.toFixed(0)} m, ${f1(rec.cas / KT)} kt calibrated`);
  // Hold the pull through the stall and watch what the airframe does.
  const on = stallFlight(true, false), off = stallFlight(false, false);
  check(on.peakAfter < off.peakAfter - deg(1) * 0 - 0.1 && on.peakAfter < Math.PI / 2,
    `the aids' master switch matters: held through the stall the nose is pushed down (peak angle of attack ${f1(deg(on.peakAfter))} deg with, ${f1(deg(off.peakAfter))} deg without)`);
}

// --- published figures --------------------------------------------------------------
console.log('\nPublished figures (sources are in aircraft.js)');
{
  const fg = F22.figures;
  check(near(F22.length, fg.length.value, fg.length.tol), `length ${F22.length} m`);
  check(near(F22.span, fg.span.value, fg.span.tol), `span ${F22.span} m`);
  check(near(F22.surfaces.filter((s) => s.curve === 'wing').reduce((a, s) => a + s.area, 0), fg.refArea.value, fg.refArea.tol) && near(F22.refArea, fg.refArea.value, fg.refArea.tol), `wing area ${F22.refArea} m2`);
  check(near(F22.emptyMass, fg.emptyMass.value, fg.emptyMass.tol) && near(F22.maxTakeoffMass, fg.maxTakeoffMass.value, fg.maxTakeoffMass.tol) && near(F22.fuelCapacity, fg.fuelCapacity.value, fg.fuelCapacity.tol),
    `mass ${F22.emptyMass} empty, ${F22.maxTakeoffMass} max takeoff, ${F22.fuelCapacity} fuel kg`);
  const ab = F22.engines.reduce((a, e) => a + e.ab, 0), dry = F22.engines.reduce((a, e) => a + e.dry, 0);
  check(near(ab, fg.thrustAb.value, fg.thrustAb.tol), `thrust with afterburner ${f1(ab / 1000)} kN (two engines, 156 kN each)`);
  check(near(dry, fg.thrustDry.value, fg.thrustDry.tol), `dry thrust ${f1(dry / 1000)} kN (an unofficial figure)`);
  check(F22.gLimit === fg.gLimit.value, `load limit +${F22.gLimit} g`);
  // Thrust to weight at about half fuel.
  const mid = F22.emptyMass + F22.payload + F22.fuelCapacity * 0.5;
  const tw = ab / (mid * ISA.g0);
  check(near(tw, fg.thrustToWeightAb.target, fg.thrustToWeightAb.tol), `thrust to weight with afterburner ${f2(tw)} at ${mid.toFixed(0)} kg`);

  // Flown: the level speed it settles at, from above, so the transonic drag
  // peak cannot trap it below.
  const level = (h, ab, m0, secs = 480) => {
    const p = H.airborne(F22, { h, mach: m0, fuel: 0.5, throttle: 1 });
    const inp = makeInput({ ab });
    H.run(p, inp, secs, () => { H.altitudeHold(p, inp, h); p.abFuel = 1; });
    return p;
  };
  const top = level(40000 * FT, true, 2.0);
  check(top.mach >= fg.topMach.floor && near(top.mach, fg.topMach.target, fg.topMach.tol / fg.topMach.target),
    `full afterburner at 40,000 ft settles at Mach ${f2(top.mach)} (floor ${fg.topMach.floor}, fitted to ${fg.topMach.target})`);
  const sc = level(40000 * FT, false, 1.9);
  check(sc.mach >= fg.supercruiseMach.floor && near(sc.mach, fg.supercruiseMach.target, fg.supercruiseMach.tol / fg.supercruiseMach.target),
    `military power at 40,000 ft settles at Mach ${f2(sc.mach)}: supercruise (floor ${fg.supercruiseMach.floor}, fitted to ${fg.supercruiseMach.target})`);
  const ceil = level(fg.ceiling.floor * FT, true, 1.5, 300);
  check(ceil.mach > 1.0 && Math.abs(ceil.y - fg.ceiling.floor * FT) < 300, `holds ${fg.ceiling.floor} ft in afterburner at Mach ${f2(ceil.mach)}`);

  // It can get there: through the transonic drag peak in afterburner.
  {
    const p = H.airborne(F22, { h: 30000 * FT, mach: 0.9, fuel: 0.5, throttle: 1 });
    const inp = makeInput({ ab: true });
    let t15 = -1;
    H.run(p, inp, 150, (t) => { H.altitudeHold(p, inp, 30000 * FT); p.abFuel = 1; if (t15 < 0 && p.mach >= 1.5) t15 = t; });
    check(t15 > 0 && t15 < 100, `accelerates Mach 0.9 to 1.5 in afterburner at 30,000 ft in ${f1(t15)} s`);
  }
}

// --- thrust vectoring ----------------------------------------------------------------
console.log('\nThrust vectoring');
{
  const pitchRate = (def, h, mach) => {
    const p = H.airborne(def, { h, mach, fuel: 0.5, throttle: 1 });
    const inp = makeInput({ pitch: 1 });
    let peak = 0;
    H.run(p, inp, 1.2, () => { peak = Math.max(peak, -p.wx); });
    return { peak, nozzle: p.nozzle };
  };
  const noTv = structuredClone(F22); noTv.tvMax = 0;
  const slowOn = pitchRate(F22, 6000, 0.2), slowOff = pitchRate(noTv, 6000, 0.2);
  check(slowOn.peak > slowOff.peak * 1.2, `at 100 kt the nozzles add pitch rate: ${f2(slowOn.peak)} rad/s with, ${f2(slowOff.peak)} without`);
  const fastOn = pitchRate(F22, 500, 0.95);
  check(Math.abs(fastOn.nozzle) < F22.tvMax * 0.05, `at Mach 0.95 low down the nozzle has faded out (${f1(deg(fastOn.nozzle))} of ${f1(deg(F22.tvMax))} deg)`);
}

// --- the g limiter --------------------------------------------------------------------
console.log('\nLoad limit');
{
  // Trimmed and level, then the stick snapped to full in one step (a pad): the
  // load rises to its plateau and stays there, under the limit, with nothing
  // left ringing.
  const p = H.airborne(F22, { h: 2000, mach: 0.9, fuel: 0.5, throttle: 1 });
  const inp = makeInput({ analog: true });
  H.run(p, inp, 12, () => H.altitudeHold(p, inp, 2000)); inp.pitch = 0; H.run(p, inp, 3);
  let peak = 0, lo = 99, hi = 0;
  H.run(p, inp, 3, (t) => { inp.pitch = 1; peak = Math.max(peak, p.nz); if (t > 1.2) { lo = Math.min(lo, p.nz); hi = Math.max(hi, p.nz); } });
  check(peak > 7 && peak <= F22.gLimit + 0.6, `a full pull at Mach 0.9 peaks at ${f2(peak)} g (limit ${F22.gLimit})`);
  check(hi - lo < 0.6, `and holds it: the load stays within ${f2(hi - lo)} g from 1.2 s on (under 0.6)`);
  // And the stabilators do not flutter while it is held, in a turn, at speed:
  // what is left of their deflection once its slow drift is taken out.
  const flutter = (h, mach, sign) => {
    const q = H.airborne(F22, { h, mach, fuel: 0.5, throttle: 1 });
    const qi = makeInput({ analog: false });
    H.run(q, qi, 12, () => H.altitudeHold(q, qi, h)); qi.pitch = 0; H.run(q, qi, 3);
    const hold = () => { qi.roll = Math.max(-1, Math.min(1, (1.05 - q.attitude().bank) * 1.5)); };
    H.run(q, qi, 2.5, () => { hold(); qi.pitch = 0; });
    const d = [];
    H.run(q, qi, 5, () => { hold(); qi.pitch = sign; d.push((q.defl[2] + q.defl[3]) / 2); });
    let worst = 0;
    const W = 36, start = Math.round(1.2 / H.DT);
    for (let i = start; i < d.length - W; i++) {
      let m = 0;
      for (let k = -W; k <= W; k++) m += d[i + k];
      worst = Math.max(worst, Math.abs(d[i] - m / (2 * W + 1)));
    }
    return worst;
  };
  for (const [h, mach] of [[1000, 1.2], [3000, 1.0], [300, 0.9], [8000, 1.5], [3000, 0.6]]) {
    const pull = flutter(h, mach, 1), push = flutter(h, mach, -1);
    check(pull < 0.04 && push < 0.04, `held pull and push in a 60 degree turn at Mach ${mach}, ${h} m: the stabilators flutter ${f3(pull)} and ${f3(push)} rad (under 0.04; they swung 0.2-0.35 when the limiter chased the load)`);
  }
}

// --- the aids and the handling ---------------------------------------------------
console.log('\nTurning: a bank stays where you put it');
{
  const bankAfter = (strength) => {
    const saved = FLIGHT.levelStrength;
    FLIGHT.levelStrength = strength;
    const p = H.airborne(F22, { h: 4000, mach: 0.6, fuel: 0.5, throttle: 0.8 });
    p.reset({ x: 0, y: 4000, z: 0, heading: 0, pitch: 0.03, bank: 0.5, speed: 0.6 * p.atm.a, fuel: 0.5, throttle: 0.8, gear: 0 });
    const inp = makeInput();
    H.run(p, inp, 12);
    FLIGHT.levelStrength = saved;
    return Math.abs(p.attitude().bank);
  };
  const held = bankAfter(FLIGHT.levelStrength);
  check(held > 0.5 - 0.14, `released at 29 deg of bank, with the aids as shipped, it is ${f1(deg(held))} deg after 12 s (it must not level itself)`);
  const levelled = bankAfter(0.9);
  check(levelled < 0.15, `the roll self-levelling knob still works: ${f1(deg(levelled))} deg after 12 s at levelStrength 0.9`);

  // A turn the way a keyboard pilot flies it: roll in, let go, hold a pull.
  for (const [h, cas] of [[3000, 200], [3000, 300], [6000, 350]]) {
    const { p, inp } = H.trimmedFlight(F22, h, cas);
    let bank0 = null, released = false, tRel = 0, maxBank = 0;
    H.run(p, inp, 9, (t) => {
      const a = p.attitude();
      if (!released) { inp.roll = 1; if (a.bank > 0.9) { released = true; tRel = t; inp.roll = 0; } }
      else if (t > tRel + 1.0) {
        // The roll takes a moment to stop; the bank is where it has stopped.
        if (bank0 === null) bank0 = a.bank;
        maxBank = Math.max(maxBank, Math.abs(a.bank - bank0));
      }
      inp.pitch = released ? 0.3 : 0;
    });
    check(released && maxBank < 0.25, `${cas} kt: rolled in, let go, and the bank then stays within ${f1(deg(maxBank))} deg of where it stopped for 6 s`);
  }
}

console.log('\nHandling: what the controls do');
{
  const D = 180 / Math.PI;
  const cases = [[3000, 150], [3000, 300], [3000, 500]];
  for (const [h, cas] of cases) {
    const rate = {};
    {
      const { p, inp } = H.trimmedFlight(F22, h, cas);
      let pk = 0;
      H.run(p, inp, 2.5, () => { inp.roll = 1; pk = Math.max(pk, p.wz * D); });
      rate.roll = pk;
    }
    {
      const { p, inp } = H.trimmedFlight(F22, h, cas);
      let pk = 0;
      H.run(p, inp, 2.5, () => { inp.pitch = 1; pk = Math.max(pk, -p.wx * D); });
      rate.pitch = pk;
    }
    {
      const { p, inp } = H.trimmedFlight(F22, h, cas);
      let r4 = 0, pk = 0, beta = 0, back = 0;
      H.run(p, inp, 3, (t) => {
        inp.yaw = 1;
        const r = -p.wy * D;
        if (Math.abs(t - 0.4) < 0.0042) r4 = r;
        pk = Math.max(pk, r); back = Math.min(back, r);
        beta = Math.max(beta, Math.abs(p.beta * D));
      });
      rate.yaw4 = r4; rate.yawPeak = pk; rate.beta = beta; rate.back = back;
    }
    const need = cas < 200 ? 12 : 15;
    check(rate.roll > 70 && rate.roll < 165, `${cas} kt  roll rate ${rate.roll.toFixed(0)} deg/s (70 to 165)`);
    check(rate.pitch > 15 && rate.pitch < 70, `${cas} kt  pitch rate ${rate.pitch.toFixed(0)} deg/s (15 to 70)`);
    check(rate.yaw4 > need && rate.beta < 22 && rate.back > -0.5 * rate.yawPeak,
      `${cas} kt  rudder: ${rate.yaw4.toFixed(0)} deg/s after 0.4 s (over ${need}), sideslip ${rate.beta.toFixed(0)} deg (under 22), swings back ${rate.back.toFixed(0)} deg/s`);
  }
}

console.log('\nStall: a keyboard pilot who stalls, and then recovers');
{
  const trial = (seed, flail) => {
    let s = seed >>> 0;
    const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    const p = H.airborne(F22, { h: 3000, mach: 0.5, fuel: 0.5, throttle: 0.4 + rnd() * 0.6 });
    const inp = makeInput({ analog: false });
    let minY = 1e9, pulling = false, until = 0, rollKey = 0, yawKey = 0;
    H.run(p, inp, 70, (t) => {
      const a = p.attitude();
      minY = Math.min(minY, p.y);
      if (t < 14) { inp.pitch = 1; return; }
      if (flail && t < 17) {
        if (t > until) { until = t + 0.4 + rnd() * 0.5; rollKey = Math.round(rnd() * 2 - 1); yawKey = Math.round(rnd() * 2 - 1); }
        inp.roll = rollKey; inp.yaw = yawKey; inp.pitch = rnd() < 0.5 ? 1 : -1;
        return;
      }
      inp.roll = 0; inp.yaw = 0;
      if (a.pitch < -0.12 && p.cas > 120 * KT) pulling = true;
      if (pulling && a.pitch > -0.03) pulling = false;
      inp.pitch = pulling ? 1 : 0;
    });
    return { minY, crashed: p.crashed };
  };
  for (const [name, flail] of [['holding the pull, then centring the stick', false], ['fighting it with roll and rudder for three seconds', true]]) {
    let worst = 1e9, bad = 0;
    for (let k = 1; k <= 8; k++) {
      const r = trial(k * 7919, flail);
      worst = Math.min(worst, r.minY);
      if (r.crashed || r.minY < 800) bad++;
    }
    check(bad === 0, `${name}: 8 of 8 recovered, lowest ${worst.toFixed(0)} m of the 3000 m it started from`);
  }
}

// --- the ground -----------------------------------------------------------------------
console.log('\nThe ground');
{
  const inp = makeInput({ gearDown: true, analog: true });
  const p = new AircraftPhysics(F22);
  p.reset({ x: 0, y: 1.9, z: 80, heading: 0, fuel: 0.6, gear: 1 });
  H.run(p, inp, 8);
  const a = p.attitude();
  check(Math.abs(p.vy) < 0.01 && p.y > 1.45 && p.y < 1.7 && Math.abs(p.nz - 1) < 0.02 && Math.abs(deg(a.pitch)) < 1.5 && !p.crashed,
    `rests on its gear: height ${f2(p.y)} m, ${f2(p.nz)} g, pitch ${f1(deg(a.pitch))} deg`);

  // Takeoff in full afterburner.
  const t = new AircraftPhysics(F22);
  t.reset({ x: 0, y: 1.9, z: 80, heading: 0, fuel: 0.6, gear: 1, throttle: 1 });
  const ti = makeInput({ gearDown: true, ab: true });
  let liftoff = -1, liftSpeed = 0, rollDist = 0, tailStrike = false, lifted = false;
  H.run(t, ti, 40, (time) => {
    const cas = t.cas / KT;
    ti.pitch = cas > 125 && t.y < 60 ? Math.max(0, Math.min(0.5, ((lifted ? 0.17 : 0.14) - t.attitude().pitch) * 4)) : 0;
    ti.yaw = Math.max(-1, Math.min(1, -t.x * 0.05 - t.vx * 0.3));
    if (t.gear.hullHit > 0 || t.gear.skidHit > 0) tailStrike = true;
    if (liftoff < 0 && !t.onGround && t.y > 3) { liftoff = time; liftSpeed = cas; rollDist = t.z - 80; lifted = true; }
    if (t.y > 60) ti.gearDown = false;
  });
  check(liftoff > 0 && liftSpeed > 110 && liftSpeed < 200 && rollDist < 1000 && !tailStrike && !t.crashed,
    `takes off in afterburner: lifts off at ${f1(liftSpeed)} kt after ${rollDist.toFixed(0)} m, no tail strike`);
  check(t.y > 500, `and climbs away (${t.y.toFixed(0)} m after 40 s, ${f1(t.cas / KT)} kt)`);

  // Idle: it stands where it is put. The engines' idle thrust is more than the
  // tyres' rolling resistance, and used to carry it off down the runway; with the
  // throttle up to taxi it must still go.
  {
    const q = new AircraftPhysics(F22);
    q.reset({ x: 0, y: 1.9, z: 80, heading: 0, fuel: 0.6, gear: 1, throttle: 0 });
    H.run(q, makeInput({ gearDown: true }), 90);
    check(Math.abs(q.z - 80) < 0.1 && q.speed < 0.05, `parked at idle for 90 s it has moved ${f2(q.z - 80)} m and is doing ${f2(q.speed)} m/s`);
    const g = new AircraftPhysics(F22);
    g.reset({ x: 0, y: 1.9, z: 80, heading: 0, fuel: 0.6, gear: 1, throttle: 0.25 });
    H.run(g, makeInput({ gearDown: true }), 10);
    check(g.speed > 5, `and with the throttle up to a quarter it taxis: ${f1(g.speed)} m/s after 10 s`);
  }

  // The tail. A rotation as hard as the stick can make it does not put the tail
  // on the runway: the flight computer holds the nose short of it. A tail that
  // does touch (a high flare) is pushed off, not a crash.
  for (const rotateKt of [60, 100, 140]) {
    const r = new AircraftPhysics(F22);
    r.reset({ x: 0, y: 1.9, z: 80, heading: 0, fuel: 0.6, gear: 1, throttle: 1 });
    const ri = makeInput({ gearDown: true, ab: true, analog: false });
    let scraped = false, maxPitch = 0, off = -1;
    H.run(r, ri, 14, (time) => {
      ri.pitch = r.cas / KT > rotateKt ? 1 : 0;
      ri.yaw = Math.max(-1, Math.min(1, -r.x * 0.05 - r.vx * 0.3));
      if (r.gear.skidHit > 0 || r.gear.hullHit > 0) scraped = true;
      if (r.onGround) maxPitch = Math.max(maxPitch, deg(r.attitude().pitch));
      if (off < 0 && !r.onGround && r.y > 3) off = time;
    });
    check(!scraped && !r.crashed && off > 0, `full back stick from ${rotateKt} kt: the nose stops at ${f1(maxPitch)} deg on the runway, no tail strike, airborne at ${off > 0 ? f1(off) : 'never'} s`);
  }
  {
    const d = new AircraftPhysics(F22);
    d.reset({ x: 0, y: 3.2, z: 400, heading: 0, pitch: 0.3, speed: 75, fuel: 0.4, throttle: 0, gear: 1 });
    d.vy = -3; d.vx = 0;
    const di = makeInput({ gearDown: true });
    let skid = 0, maxPitch = 0;
    H.run(d, di, 8, () => {
      di.yaw = Math.max(-1, Math.min(1, -d.x * 0.05 - d.vx * 0.3));
      skid = Math.max(skid, d.gear.skidImpact); maxPitch = Math.max(maxPitch, deg(d.attitude().pitch));
    });
    check(skid > 0.5 && !d.crashed && Math.abs(deg(d.attitude().pitch)) < 3, `a flare 17 deg nose up scrapes the tail at ${f1(skid)} m/s and is pushed off it: not a crash, level again at the end`);
  }

  // Drop tests: level, gear down, 78 m/s forward, a given sink rate.
  const drop = (sink) => {
    const d = new AircraftPhysics(F22);
    d.reset({ x: 0, y: 1.85, z: 400, heading: 0, pitch: 0.06, speed: 78, fuel: 0.5, throttle: 0, gear: 1 });
    d.vy = -sink; d.vx = 0;
    const di = makeInput({ gearDown: true });
    let peakNz = 0, bottomed = false;
    H.run(d, di, 6, () => {
      peakNz = Math.max(peakNz, d.nz);
      for (let i = 0; i < 3; i++) if (d.gear.compression[i] >= d.gear.wheels[i].travel - 1e-6) bottomed = true;
      di.yaw = Math.max(-1, Math.min(1, -d.x * 0.05 - d.vx * 0.3));
    });
    return { peakNz, bottomed, crashed: d.crashed, reason: d.crashReason, sink: d.gear.touchdownSink };
  };
  const soft = drop(2.5), hard = drop(7);
  check(!soft.crashed && soft.peakNz < 3.6 && !soft.bottomed, `a 2.5 m/s touchdown is fine: ${f2(soft.peakNz)} g, struts do not bottom`);
  check(hard.crashed, `a 7 m/s touchdown is a crash (${hard.reason || 'none'})`);

  // A crash leaves a wreck, not numbers out of range.
  {
    const c = H.airborne(F22, { h: 1500, mach: 0.8, fuel: 0.5, throttle: 1 });
    const ci = makeInput({ pitch: -1 });
    H.run(c, ci, 25, () => { ci.pitch = -1; });
    const finite = [c.x, c.y, c.z, c.vx, c.vy, c.vz, c.wx, c.wy, c.wz, c.qw].every(Number.isFinite);
    check(c.crashed && finite && c.speed === 0, `diving into the ground at Mach 0.8 is a crash (${c.crashReason}) and leaves a still wreck with finite numbers`);
  }

  // Roll out with the wheel brake.
  const r = new AircraftPhysics(F22);
  r.reset({ x: 0, y: 1.6, z: 200, heading: 0, speed: 70, fuel: 0.4, throttle: 0, gear: 1 });
  const ri = makeInput({ gearDown: true, brake: 1 });
  let stopAt = -1;
  H.run(r, ri, 40, (time) => {
    ri.yaw = Math.max(-1, Math.min(1, -r.x * 0.05 - r.vx * 0.3));
    if (stopAt < 0 && r.speed < 0.5) stopAt = time;
  });
  check(stopAt > 0 && r.z - 200 < 1800 && Math.abs(r.x) < 20 && !r.crashed, `rolls out and stops on the runway: ${stopAt > 0 ? f1(stopAt) : 'never'} s, ${(r.z - 200).toFixed(0)} m, ${f1(Math.abs(r.x))} m off the line`);
}

// --- ground handling -------------------------------------------------------------------
console.log('\nGround handling');
{
  const F = FLIGHT;
  const rest = (over = {}) => {
    const q = new AircraftPhysics(F22);
    q.reset({ x: 0, y: 1.75, z: 0, heading: 0, fuel: 0.6, gear: 1, throttle: 0, ...over });
    H.run(q, makeInput({ gearDown: true }), 3);
    return q;
  };
  const gs = (q) => Math.hypot(q.vx, q.vz);
  check(F.groundAssist === true, 'the ground assists are on as shipped (FLIGHT.groundAssist)');

  // The taxi governor: a lever is a speed. Held, it settles and stays settled.
  {
    const rows = [];
    let okAll = true;
    for (const lever of [0.06, 0.1, 0.2, 0.3]) {
      const q = rest(); q.throttle = lever;
      const inp = makeInput({ gearDown: true });
      H.run(q, inp, 20);
      const v20 = gs(q);
      H.run(q, inp, 20);
      const v40 = gs(q), want = F.taxiSpeedPerLever * lever;
      rows.push(`lever ${lever}: ${f1(v20)} then ${f1(v40)} m/s (asks ${f1(want)})`);
      if (!(v40 > want * 0.9 && v40 < want * 1.35 + 0.5 && Math.abs(v40 - v20) < 0.3)) okAll = false;
    }
    check(okAll, `a lever holds a steady taxi speed: ${rows.join('; ')}`);
  }
  // Lever to nothing at 10 m/s: it stops, and stays stopped.
  {
    const q = rest({ heading: 0 }); q.vz = 10; q.throttle = 0;
    const inp = makeInput({ gearDown: true });
    let t = -1;
    const z0 = q.z;
    H.run(q, inp, 20, (time) => { if (t < 0 && gs(q) < 0.05) t = time; });
    const z1 = q.z;
    H.run(q, inp, 60);
    check(t > 0 && t < 6 && z1 - z0 < 30 && Math.abs(q.z - z1) < 0.05, `lever to nothing at 10 m/s: stopped in ${t > 0 ? f1(t) : 'never'} s over ${f1(z1 - z0)} m, and 60 s later it has moved ${f3(Math.abs(q.z - z1))} m`);
  }
  // The governor is for taxiing: a takeoff roll and a landing roll are the pilot's.
  {
    const roll = (assist) => {
      const saved = F.groundAssist; F.groundAssist = assist;
      const q = new AircraftPhysics(F22);
      q.reset({ x: 0, y: 1.9, z: 80, heading: 0, fuel: 0.6, gear: 1, throttle: 1 });
      const inp = makeInput({ gearDown: true, ab: true });
      let lift = -1, speed = 0, lifted = false;
      H.run(q, inp, 20, (time) => {
        const cas = q.cas / KT;
        inp.pitch = cas > 125 && q.y < 60 ? Math.max(0, Math.min(0.5, ((lifted ? 0.17 : 0.14) - q.attitude().pitch) * 4)) : 0;
        if (lift < 0 && !q.onGround && q.y > 3) { lift = time; speed = cas; lifted = true; }
      });
      F.groundAssist = saved;
      return { lift, speed, z: q.z };
    };
    const on = roll(true), off = roll(false);
    check(Math.abs(on.lift - off.lift) < 0.15 && Math.abs(on.speed - off.speed) < 2, `a takeoff is the same with the assists on and off: lift off at ${f1(on.lift)} s and ${f1(on.speed)} kt against ${f1(off.lift)} s and ${f1(off.speed)} kt`);
  }

  // The nose wheel: it turns at a rate, and its lock is limited by the side force.
  {
    const turn = (speed, lever) => {
      const q = rest(); q.throttle = lever;
      const inp = makeInput({ gearDown: true, analog: false });
      H.run(q, inp, 60, () => { if (gs(q) >= speed) q.throttle = lever; });
      // hold the speed on the governor, then a full pedal from the keys
      inp.yaw = 1;
      const h0 = q.attitude().heading;
      let maxBank = 0, tip = 0, maxLat = 0, steerRate = 0, prevSteer = q.gear.steerAngle, t90 = -1, lock = 0;
      H.run(q, inp, 6, (time) => {
        const a = q.attitude();
        maxBank = Math.max(maxBank, Math.abs(a.bank));
        tip = Math.max(tip, q.gear.hullHit);
        steerRate = Math.max(steerRate, Math.abs(q.gear.steerAngle - prevSteer) / DT);
        prevSteer = q.gear.steerAngle;
        lock = Math.max(lock, Math.abs(q.gear.steerAngle));
        if (t90 < 0 && Math.abs(q.gear.steerAngle) > 0.9 * Math.min(F.noseSteerMax, 1e9) * 0.9) t90 = time;
      });
      let dh = q.attitude().heading - h0; while (dh < -Math.PI) dh += 2 * Math.PI; while (dh > Math.PI) dh -= 2 * Math.PI;
      const rate = Math.abs(dh) / 6;
      return { v: gs(q), radius: gs(q) / rate, maxBank, tip, steerRate, lock, rate };
    };
    const slow = turn(5, 0.125), mid = turn(8, 0.2);
    check(slow.radius > 7 && slow.radius < 14 && mid.radius < 26 && slow.maxBank < deg(0.08) && mid.maxBank < deg(0.08) && slow.tip === 0 && mid.tip === 0,
      `a full pedal turns the aircraft round in ${f1(slow.radius)} m at ${f1(slow.v)} m/s and ${f1(mid.radius)} m at ${f1(mid.v)} m/s, banking ${f1(deg(slow.maxBank))} and ${f1(deg(mid.maxBank))} deg`);
    check(slow.steerRate <= F.noseSteerRate * 1.05 && mid.steerRate <= F.noseSteerRate * 1.05, `the nose wheel never turns faster than ${F.noseSteerRate} rad/s (${f2(Math.max(slow.steerRate, mid.steerRate))}): a tapped key is not a snap to full lock`);
    // At 25 and 30 m/s a full pedal asked for 2 to 3 g, and scraped a wing tip.
    const fast = (v0) => {
      const q = rest(); q.vz = v0; q.throttle = 0.3;
      const inp = makeInput({ gearDown: true, analog: false, yaw: 1 });
      let bank = 0, tip = 0, minLoad = 1e9;
      H.run(q, inp, 3, () => { bank = Math.max(bank, Math.abs(q.attitude().bank)); tip = Math.max(tip, q.gear.hullHit); minLoad = Math.min(minLoad, ...q.gear.load); });
      return { bank, tip, minLoad };
    };
    const f25 = fast(25);
    check(f25.tip === 0 && deg(f25.bank) < 8 && f25.minLoad > 1000, `full pedal at 25 m/s: ${f1(deg(f25.bank))} deg of bank, no wing tip scrape, every wheel loaded (${f1(f25.minLoad / 1000)} kN at the least)`);
  }

  // Standing on the brakes holds the aircraft against a run-up, and lets go when released.
  {
    const q = rest(); q.throttle = 0.5;
    const inp = makeInput({ gearDown: true, brake: 1 });
    H.run(q, inp, 15);
    const held = q.z;
    inp.brake = 0;
    H.run(q, inp, 10);
    check(Math.abs(held) < 0.05 && gs(q) > 5, `a lever at half held on the brakes for 15 s moves ${f2(Math.abs(held))} m; released, it is doing ${f1(gs(q))} m/s 10 s later`);
  }
  // The gear lever cannot raise the wheels while they carry the aircraft.
  {
    const q = rest();
    H.run(q, makeInput({ gearDown: false }), 8);
    check(q.gearDown > 0.99 && !q.crashed && q.y > 1.4, `the gear lever up on the ground changes nothing: gear ${f2(q.gearDown)}, still ${f2(q.y)} m up`);
    const a = H.airborne(F22, { h: 600, mach: 0.5, fuel: 0.4, throttle: 0.7 });
    a.gearDown = 1;
    H.run(a, makeInput({ gearDown: false }), 8);
    check(a.gearDown < 0.1, `and in the air it goes up (${f2(a.gearDown)} after 8 s)`);
  }
}

// --- airports in the world -------------------------------------------------------------------
console.log('\nAirports in the world');
{
  const T = await import('./lib/track-hash.mjs');
  const { World } = await import(H.R + 'world/World.js');
  const world = new World(await T.loadTrackData());
  const AP = world.airports;
  const loc = { u: 0, v: 0 };

  // A takeoff in afterburner from runways at other places and other headings.
  const rows = [];
  let allOff = true;
  for (const id of ['fort-falcon', 'pinecrest', 'strip-copper-flats', 'strip-pine-ridge']) {
    const ap = AP.byId.get(id), sp = AP.start(ap, 'runway', {});
    const q = new AircraftPhysics(F22);
    q.reset({ x: sp.x, y: sp.y + 1.75, z: sp.z, heading: sp.heading, fuel: 0.6, gear: 1, throttle: 1 });
    const inp = makeInput({ gearDown: true, ab: true });
    const pilot = H.takeoffPilot(ap);
    let maxOff = 0;
    H.runOn(world, q, inp, 40, (time) => { pilot.step(q, inp, time); ap.toLocal(q.x, q.z, loc); if (q.onGround) maxOff = Math.max(maxOff, Math.abs(loc.v)); });
    const ok = pilot.liftoff > 0 && pilot.liftSpeed > 110 && pilot.liftSpeed < 200 && pilot.roll < ap.length - 300 && !pilot.tailStrike && !q.crashed && maxOff < 4 && q.y - ap.base > 500;
    if (!ok) allOff = false;
    rows.push(`${id} (${ap.length} m, heading ${f1(deg(ap.heading))}): off at ${f1(pilot.liftSpeed)} kt after ${pilot.roll.toFixed(0)} m, ${f1(maxOff)} m off the line`);
  }
  check(allOff, `takes off in afterburner, no tail strike, on the line and climbing: ${rows.join('; ')}`);

  // A landing: a 3 degree approach, gear down, a flare, the brakes, a stop on the runway.
  {
    const rows2 = [];
    let allOk = true;
    for (const id of ['pinecrest', 'redwater', 'cold-harbor']) {
      const ap = AP.byId.get(id);
      const aim = 300, dist = 5000, glide = 3, w = { x: 0, z: 0 };
      ap.toWorld(-dist, 0, w);
      const h0 = (aim + dist) * Math.tan((glide * Math.PI) / 180);
      const q = new AircraftPhysics(F22);
      q.reset({ x: w.x, y: ap.base + 1.75 + h0, z: w.z, heading: ap.heading, pitch: 0.09, speed: 80, fuel: 0.4, gear: 1, throttle: 0.3 });
      const inp = makeInput({ gearDown: true });
      const pilot = H.landingPilot(ap, { aim });
      H.runOn(world, q, inp, 150, (time) => pilot.step(q, inp, time));
      const ok = pilot.touched && pilot.tdU > 100 && pilot.tdU < 900 && pilot.tdSink < 3 && pilot.stopped && pilot.stopU < ap.length - 20 && pilot.maxOff < 4 && !q.crashed;
      if (!ok) allOk = false;
      rows2.push(`${id}: down at ${pilot.tdU.toFixed(0)} m at ${f1(pilot.tdSink)} m/s, stopped at ${pilot.stopU.toFixed(0)} of ${ap.length} m, ${f1(pilot.maxOff)} m off the line${q.crashed ? ', CRASHED: ' + q.crashReason : ''}`);
    }
    check(allOk, `lands at placed airports from a 3 degree approach and stops on the runway: ${rows2.join('; ')}`);
  }

  // Taxiing: from the first stand, across the apron, along the taxiway, up an exit and
  // onto the runway, the wheels on pavement the whole way.
  {
    const rows3 = [];
    let allOk = true;
    for (const id of ['meridian-intl', 'pinecrest', 'fort-falcon', 'strip-copper-flats', 'skyline-heliport']) {
      const ap = AP.byId.get(id), sp = AP.start(ap, 'apron', {});
      const q = new AircraftPhysics(F22);
      q.reset({ x: sp.x, y: sp.y + 1.75, z: sp.z, heading: sp.heading, fuel: 0.6, gear: 1, throttle: 0 });
      const inp = makeInput({ gearDown: true, analog: false });
      // First: it rests where it is put, on its stand, for 20 s.
      H.runOn(world, q, inp, 20);
      const creep = Math.hypot(q.x - sp.x, q.z - sp.z);
      const route = H.standToRunway(ap);
      const pilot = H.taxiPilot(ap, route, { reach: 4 });
      let t = 0;
      for (let k = 0; k < 120 * 240 && !pilot.done && !q.crashed; k++) { pilot.step(q, inp, world); q.step(DT, inp, world); t = k * DT; }
      ap.toLocal(q.x, q.z, loc);
      const ok = pilot.done && pilot.off === 0 && pilot.maxSpeed < 8 && creep < 0.05 && !q.crashed && Math.abs(loc.v) < 6;
      if (!ok) allOk = false;
      rows3.push(`${id} ${t.toFixed(0)} s${pilot.off ? `, ${pilot.off} steps off the pavement` : ''}`);
    }
    check(allOk, `taxis from the apron stand to the runway on pavement all the way, and sits still on its stand first: ${rows3.join('; ')}`);
  }

  // The hangar bay: taxi into it and stop; the world finds it, and the aircraft stays.
  {
    const ap = AP.byId.get('pinecrest'), L = ap.layout, z0 = L.zones[0];
    const sp = AP.start(ap, 'hangar', {});
    const q = new AircraftPhysics(F22);
    q.reset({ x: sp.x, y: sp.y + 1.75, z: sp.z, heading: sp.heading, fuel: 0.6, gear: 1, throttle: 0 });
    const inp = makeInput({ gearDown: true, analog: false });
    const route = H.roundedRoute([[sp.u0 ?? (z0.u0 + z0.u1) / 2, z0.v0 - 16], [(z0.u0 + z0.u1) / 2, (z0.v0 + z0.v1) / 2 + 2]], 9);
    const pilot = H.taxiPilot(ap, route, { reach: 3, speed: 3, slow: 3 });
    for (let k = 0; k < 120 * 60 && !pilot.done && !q.crashed; k++) { pilot.step(q, inp, world); q.step(DT, inp, world); }
    inp.throttleRate = -1;
    H.runOn(world, q, inp, 8);
    const zone = AP.zoneAt(q.x, q.z);
    check(pilot.done && zone === z0 && gs0(q) < 0.05 && !q.crashed, `taxis into a hangar bay and stops in it (the world says it is in the bay: ${zone === z0}, doing ${f2(gs0(q))} m/s)`);
  }
}
function gs0(q) { return Math.hypot(q.vx, q.vz); }

// The places: starts, explicit bay availability and airport arrival.
console.log('\nPlaces');
{
  const T = await import('./lib/track-hash.mjs');
  const { World } = await import(H.R + 'world/World.js');
  const { FlightPlaces } = await import(H.R + 'core/FlightPlaces.js');
  const { HANGAR } = await import(H.R + 'data/tuning.js');
  const world = new World(await T.loadTrackData());
  const places = new FlightPlaces(world, F22);
  const AP = world.airports;
  const heli = AP.byId.get('skyline-heliport'), strip = AP.byId.get('strip-copper-flats'), major = AP.major;
  check(places.eligible(major, 'apron').ok && places.eligible(major, 'runway').ok && places.eligible(strip, 'runway').ok &&
    !places.eligible(heli, 'apron').ok && !places.eligible(heli, 'runway').ok && places.eligible(heli, 'air').ok,
    'the fighter can start on the apron and the runway of any airport with a runway; a heliport is airborne only');
  check(places.last === major && places.list.length === AP.list.length && places.list[0] === major, 'free flight starts at the major airport until another is used, and the list has them all, the big ones first');

  const q = new AircraftPhysics(F22);
  const put = (ap, mode) => { const p = places.pose(ap, mode); q.reset({ x: p.x, y: p.y + 1.6, z: p.z, heading: p.heading, fuel: 0.6, gear: 1, throttle: 0 }); places.rearm(); };
  const inp = makeInput({ gearDown: true });
  const settle = () => H.runOn(world, q, inp, 3);

  // Reset/teleport is outside the painted bay, within deliberate entry reach.
  put(major, 'hangar'); settle();
  const z0 = major.layout.zones[0], w = { x: 0, z: 0 };
  for (let k = 0; k < 120 * 6; k++) { q.step(DT, inp, world); places.update(DT, q); }
  check(AP.zoneAt(q.x,q.z) === null && places.availableHangar(q) === z0,
    'Hangar teleport remains outside the painted bay and offers explicit entry');
  // Stopping offers the same bay continuously, without a dwell/rearm latch.
  major.toWorld((z0.u0 + z0.u1) / 2, (z0.v0 + z0.v1) / 2, w);
  q.reset({ x: w.x, y: major.base + 1.6, z: w.z, heading: major.heading - Math.PI / 2, fuel: 0.6, gear: 1, throttle: 0 });
  settle();
  let available = true;
  for (let k = 0; k < 120 * 8; k++) { q.step(DT, inp, world); available &&= places.update(DT,q) === z0; }
  places.rearm();
  check(available && places.availableHangar(q) === z0,
    'stopped Hangar entry remains available on repeat visits without leaving the bay');
  // A rolling aircraft has no entry prompt.
  put(major, 'hangar'); settle();
  for (let k = 0; k < 120; k++) { q.step(DT, inp, world); places.update(DT, q); }
  let again = 0;
  major.toWorld((z0.u0 + z0.u1) / 2, (z0.v0 + z0.v1) / 2, w);
  q.reset({ x: w.x, y: major.base + 1.6, z: w.z, heading: major.heading, fuel: 0.6, gear: 1, throttle: 0.1 });
  q.vx = -Math.sin(major.heading) * 3; q.vz = Math.cos(major.heading) * 3;
  const passInp = makeInput({ gearDown: true });
  for (let k = 0; k < 120 * 2; k++) { passInp.throttleRate = 0; q.step(DT, passInp, world); if (places.update(DT, q)) again++; }
  check(again === 0, 'rolling through a bay does not offer Hangar entry');

  // Landed: sitting stopped on an airport makes it the last one used.
  const red = AP.byId.get('redwater');
  put(red, 'apron'); settle();
  for (let k = 0; k < 120 * (HANGAR.landedAfter + 1); k++) { q.step(DT, inp, world); places.update(DT, q); }
  check(places.last === red, `sitting stopped on an airport for ${HANGAR.landedAfter} s makes it the one free flight starts at (${places.last.name})`);
  check(places.where(q).startsWith('Redwater Airport'), `and the HUD can say where it is: "${places.where(q)}"`);
}

// --- the sound barrier -----------------------------------------------------------------
// The Hangar: what it stores, what it changes, and what it must never change.
console.log('\nThe Hangar');
{
  const L = await import(H.R + 'data/loadouts.js');
  const Store = await import(H.R + 'core/HangarStore.js');
  const { buildAircraft } = await import(H.R + 'render/AircraftBuilder.js');
  const { Aircraft } = await import(H.R + 'flight/Aircraft.js');
  const { HANGAR } = await import(H.R + 'data/tuning.js');
  const T = await import('./lib/track-hash.mjs');
  const { World } = await import(H.R + 'world/World.js');
  const world = new World(await T.loadTrackData());
  const major = world.airports.major;

  // The defaults are the aircraft as fitted.
  const dl = L.defaultLoadout('f22');
  check(L.payloadMass(F22, dl) === F22.payload && L.isStockTune('f22', L.defaultTune('f22')),
    `the default loadout weighs exactly the payload the aircraft was fitted with (${F22.payload} kg), and the default tuning is all 1`);
  const empty = { medium: 0, short: 0, rounds: 0, flares: 0 };
  const lighter = F22.payload - L.payloadMass(F22, empty);
  check(near(lighter, 6 * 152 + 2 * 86 + 480 * 0.25 + 60 * 0.2, 1e-9) && L.payloadMass(F22, empty) > 0,
    `an empty loadout is ${f1(lighter)} kg lighter and still carries the pilot (${f1(L.payloadMass(F22, empty))} kg)`);

  // Whatever was stored, what comes out is safe.
  const junk = [null, undefined, 'x', 42, [], { livery: 7, loadout: 'a', tune: [], damage: null }];
  const stock = L.normalizeSetup('f22', {});
  let allStock = true;
  for (const j of junk) if (JSON.stringify(L.normalizeSetup('f22', j)) !== JSON.stringify(stock)) allStock = false;
  check(allStock, 'garbage in the store (null, a string, a number, an array, the wrong shapes) becomes the defaults');
  const bent = L.normalizeSetup('f22', {
    livery: { body: 'nope', accent: 'sky', pattern: 5, number: 123456, insignia: 'x' },
    loadout: { medium: 99, short: -3, rounds: NaN, flares: '7' },
    tune: { power: 9, response: -1, assist: null },
    damage: { wings: 7, tail: -2, engines: 'x' },
  });
  check(bent.livery.body === 'stock' && bent.livery.accent === 'sky' && bent.livery.pattern === 'plain' && bent.livery.number === 9999 && bent.livery.insignia === 'none' &&
    bent.loadout.medium === 6 && bent.loadout.short === 0 && bent.loadout.rounds === 480 && bent.loadout.flares === 60 &&
    bent.tune.power === HANGAR.tune.power.max && bent.tune.response === HANGAR.tune.response.min && bent.tune.assist === 1 &&
    bent.damage.wingL === 1 && bent.damage.wingR === 1 && bent.damage.tail === 0 && bent.damage.engineL === 1 && bent.damage.engineR === 1 && Object.keys(bent.damage).length === 7,
    'out of range and unknown values are clamped or dropped one by one, and a good value beside a bad one is kept');
  const odd = L.normalizeLoadout('f22', { rounds: 333, medium: 2.6 });
  check(odd.rounds % 20 === 0 && Number.isInteger(odd.medium), `a loadout is snapped to what the Hangar steps by (333 rounds is ${odd.rounds}, 2.6 missiles is ${odd.medium})`);

  // The four records live under four keys, and a bad one costs only itself.
  {
    const store = new Map();
    globalThis.window = { localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => { store.set(k, String(v)); }, removeItem: (k) => { store.delete(k); } } };
    const setup = L.normalizeSetup('f22', { livery: { body: 'sky', pattern: 'tips', number: 7 }, loadout: { medium: 4 }, tune: { power: 1.1 }, damage: { wings: 0.5 } });
    Store.saveSetup('f22', setup);
    const keys = [...store.keys()].sort();
    const want = Store.PARTS.map((p) => `racing-game.v1.flight.${p}.f22`).sort();
    check(JSON.stringify(keys) === JSON.stringify(want), `a save writes four records, one per key: ${keys.map((k) => k.replace('racing-game.v1.', '')).join(', ')}`);
    check(JSON.stringify(Store.loadSetup('f22')) === JSON.stringify(setup), 'and they read back as they were saved');
    const before = JSON.stringify([...store].filter(([k]) => !k.includes('.livery.')));
    Store.saveSetup('f22', { ...setup, livery: L.normalizeLivery({ body: 'ember', number: 1 }) }, ['livery']);
    check(JSON.stringify([...store].filter(([k]) => !k.includes('.livery.'))) === before, 'repainting writes the livery and nothing else: the loadout, tuning and damage records are untouched');
    store.set('racing-game.v1.flight.tune.f22', '{not json');
    const back = Store.loadSetup('f22');
    check(back.livery.body === 'ember' && back.loadout.medium === 4 && back.tune.power === 1 && back.damage.wingL === 0.5 && back.damage.wingR === 0.5, 'a corrupt record falls back to its own defaults and costs nothing else');
    delete globalThis.window;
  }

  // The defaults change nothing: a takeoff with setup() called at its defaults is the
  // same takeoff to the bit as one that never heard of the Hangar.
  const takeoff = (setup, seconds = 40, ab = true) => {
    const sp = world.airports.start(major, 'runway', {});
    const q = new AircraftPhysics(F22);
    if (setup) q.setup(setup);
    q.reset({ x: sp.x, y: sp.y + 1.75, z: sp.z, heading: sp.heading, fuel: 0.6, gear: 1, throttle: 1 });
    const inp = makeInput({ gearDown: true, ab });
    const pilot = H.takeoffPilot(major);
    H.runOn(world, q, inp, seconds, (time) => pilot.step(q, inp, time));
    return { q, pilot };
  };
  const plain = takeoff(null), dflt = takeoff({ payload: L.payloadMass(F22, dl), tune: L.defaultTune('f22') });
  check(['x', 'y', 'z', 'vx', 'vy', 'vz', 'qx', 'qy', 'qz', 'qw', 'fuel', 'mass'].every((k) => plain.q[k] === dflt.q[k]),
    'a takeoff with the Hangar set to its defaults is identical to the bit to one that never touched it');

  // What it does change.
  const light = takeoff({ payload: L.payloadMass(F22, empty) });
  check(light.q.mass < plain.q.mass - 1000 && light.pilot.roll < plain.pilot.roll, `an empty loadout is lighter on the runway (${f1(plain.q.mass - light.q.mass)} kg) and lifts off sooner (${plain.pilot.roll.toFixed(0)} m to ${light.pilot.roll.toFixed(0)} m)`);
  const strong = takeoff({ tune: { power: 1.2 } }), weak = takeoff({ tune: { power: 0.8 } });
  check(strong.pilot.roll < plain.pilot.roll && plain.pilot.roll < weak.pilot.roll, `engine power moves the takeoff roll the right way (120%: ${strong.pilot.roll.toFixed(0)} m, 100%: ${plain.pilot.roll.toFixed(0)} m, 80%: ${weak.pilot.roll.toFixed(0)} m)`);
  const thrustAt = (power) => {
    const q = new AircraftPhysics(F22);
    q.setup({ tune: { power } });
    q.reset({ x: 0, y: 1.75, z: 0, fuel: 0.6, gear: 1, throttle: 1 });
    q.step(DT, makeInput({ gearDown: true, brake: 1 }), H.field);      // at rest, so the same air for each
    return q.thrustTotal;
  };
  check(near(thrustAt(1.2) / thrustAt(1), 1.2, 1e-9) && near(thrustAt(0.8) / thrustAt(1), 0.8, 1e-9), 'thrust is scaled by exactly the power setting');
  const extreme = takeoff({ payload: L.payloadMass(F22, { medium: 6, short: 2, rounds: 480, flares: 60 }), tune: { power: 0.8, response: 0.7, assist: 0.2 } });
  check(extreme.pilot.liftoff > 0 && !extreme.q.crashed && extreme.pilot.roll < major.length - 300, `at the weakest tuning it still takes off (${extreme.pilot.roll.toFixed(0)} m)`);

  // Control response and flight assist, in the air.
  const bankAfter = (tune) => {
    const q = H.airborne(F22, { h: 3000, mach: 0.6 });
    q.setup({ tune });
    const inp = makeInput({ roll: 0.6 });
    H.run(q, inp, 1.0);
    const peak = Math.abs(q.attitude().bank);
    inp.roll = 0;
    H.run(q, inp, 6);
    return { peak, left: Math.abs(q.attitude().bank) };
  };
  const quick = bankAfter({ response: 1.3 }), norm = bankAfter({ response: 1 }), slow = bankAfter({ response: 0.7 });
  check(quick.peak > norm.peak && norm.peak > slow.peak, `control response scales how far a second of roll gets (130%: ${f1(deg(quick.peak))} deg, 100%: ${f1(deg(norm.peak))}, 70%: ${f1(deg(slow.peak))})`);
  // Flight assist is the auto trim: put the afterburner in with the stick centred and
  // the path angle drifts as the speed builds, a lot with the assist low and little
  // with it high.
  const drift = (assist) => {
    const q = H.airborne(F22, { h: 3000, mach: 0.5, throttle: 0.6 });
    q.setup({ tune: { assist } });
    const inp = makeInput({ ab: true });
    H.run(q, inp, 2);
    const g0 = Math.asin(q.vy / q.tas);
    H.run(q, inp, 12);
    return deg(Math.asin(q.vy / q.tas) - g0);
  };
  const d1 = drift(1.5), d2 = drift(1), d3 = drift(0.2);
  check(d1 < d2 && d2 < d3 && d3 > 2 * d2, `flight assist scales the auto trim: with the stick centred and the afterburner in, the path drifts ${f1(d1)} deg at 150%, ${f1(d2)} at 100% and ${f1(d3)} at 20%`);

  // The livery is paint: it never reaches the physics, and the default is the grey it
  // has always been.
  const colours = (root) => { const s = new Set(); root.traverse((o) => { if (o.isMesh && o.material && o.material.color) s.add(o.material.color.getHex()); }); return s; };
  const d0 = buildAircraft(F22);
  const stockSet = colours(d0.root);
  check(stockSet.has(0x6e7782) && stockSet.has(0x7d8794) && !stockSet.has(0x2c3238), 'the default livery is the grey the aircraft has always been, and draws no accent');
  d0.dispose();
  let count = 0, built = 0;
  d0.root.traverse((o) => { if (o.isMesh) count++; });
  for (const pat of L.LIVERY_PATTERNS) for (const ins of L.LIVERY_INSIGNIA) for (const number of [null, 0, 7, 4012]) {
    const b = buildAircraft(F22, { body: 'sky', accent: 'acid', pattern: pat.id, insignia: ins.id, number });
    const c = colours(b.root);
    if (!c.has(0x38a9e8) || c.has(0x6e7782) || (pat.id !== 'plain' || ins.id !== 'none' || number != null) !== c.has(0xf5c518)) throw new Error(`livery ${pat.id}/${ins.id}/${number}: wrong paint`);
    if (b.parts.gear.length !== 3 || b.parts.nozzles.length !== 2 || b.parts.wingFlaps.length !== 2 || b.parts.rudders.length !== 2) throw new Error('a livery lost a moving part');
    b.dispose();
    built++;
  }
  check(built === L.LIVERY_PATTERNS.length * L.LIVERY_INSIGNIA.length * 4, `all ${built} combinations of pattern, insignia and tail number build, wear the paint they were given, and keep every moving part`);
  const a1 = new Aircraft(F22), a2 = new Aircraft(F22, { body: 'ember', accent: 'ink', pattern: 'split', number: 22, insignia: 'diamond' });
  a2.setLivery({ body: 'teal', pattern: 'spine' });
  const flyIt = (a) => { const inp = makeInput({ pitch: 0.1, roll: 0.2, ab: true }); a.physics.reset({ x: 0, y: 3000, z: 0, speed: 200, fuel: 0.5, throttle: 1, gear: 0 }); H.run(a.physics, inp, 8); return a.physics; };
  const f1p = flyIt(a1), f2p = flyIt(a2);
  check(['x', 'y', 'z', 'qx', 'qw', 'fuel'].every((k) => f1p[k] === f2p[k]), 'two liveries (one of them repainted) fly the same flight to the bit: paint never reaches the physics');
  a1.dispose(); a2.dispose();
}

console.log('\nThe sound barrier');
{
  const THREE = await import('three');
  const { ShockWave } = await import(H.R + 'render/ShockWave.js');
  const { SHOCK } = await import(H.R + 'data/tuning.js');
  const dt = 1 / 60;
  const make = () => { const root = new THREE.Group(); return { root, sw: new ShockWave(root, 8.4) }; };
  const ringsUp = (sw) => sw.rings.filter((r) => r.visible).length;

  // Accelerating through Mach 1 fires it once; the rings are there, then gone; the
  // sleeve is on only near the line.
  {
    const { sw } = make();
    let fires = 0, firedAt = -1, sleeveFar = false, sleeveNear = false, peakRings = 0;
    for (let i = 0; i < 60 * 12; i++) {
      const mach = 0.8 + 0.4 * (i / (60 * 12));
      if (sw.update(dt, mach, true, false)) { fires++; firedAt = mach; }
      if (mach < 1 - SHOCK.coneBand - 0.01 || mach > 1 + SHOCK.coneBand + 0.01) sleeveFar = sleeveFar || sw.cone.visible;
      if (Math.abs(mach - 1) < 0.01) sleeveNear = sleeveNear || sw.cone.visible;
      peakRings = Math.max(peakRings, ringsUp(sw));
    }
    check(fires === 1 && Math.abs(firedAt - SHOCK.mach) < 0.01, `going up through Mach 1 it fires once, at Mach ${f2(firedAt)}`);
    check(peakRings === SHOCK.rings && ringsUp(sw) === 0, `the ${peakRings} rings show, then are gone (${ringsUp(sw)} left 4 s later)`);
    check(sleeveNear && !sleeveFar, 'the vapour sleeve shows on the line and not away from it');
  }
  // Hovering on the line does not stutter; it needs to fall back under the rearm number.
  {
    const { sw } = make();
    let fires = 0;
    for (let i = 0; i < 60 * 6; i++) { if (sw.update(dt, 0.9, true, false)) fires++; }
    for (let i = 0; i < 60 * 10; i++) { if (sw.update(dt, 1.0 + 0.02 * Math.sin(i / 7), true, false)) fires++; }
    check(fires === 1, `wavering about Mach 1 fires once, not ${fires} times`);
    for (let i = 0; i < 60; i++) sw.update(dt, 0.9, true, false);
    let again = 0;
    for (let i = 0; i < 60; i++) if (sw.update(dt, 1.05, true, false)) again++;
    check(again === 1, 'and it fires again after the aircraft has fallen back under it');
  }
  // Not on the ground, not when it starts supersonic, not in a wreck.
  {
    const { sw } = make();
    let fires = 0;
    for (let i = 0; i < 120; i++) if (sw.update(dt, 1.4, true, false)) fires++;
    check(fires === 0, 'an aircraft that starts above Mach 1 does not boom');
    const g = make().sw;
    for (let i = 0; i < 60; i++) g.update(dt, 0.9, false, false);
    let onGround = 0;
    for (let i = 0; i < 60; i++) if (g.update(dt, 1.1, false, false)) onGround++;
    check(onGround === 0, 'nothing fires on the ground, or in a wreck');
  }
}

// --- frame rate and determinism -------------------------------------------------------
console.log('\nFrame rate invariance and determinism');
{
  const TOTAL = 120 * 30;
  const scripted = (n) => {
    const t = n / 120;
    const i = makeInput({ gearDown: t < 14, ab: t < 22 });
    i.analog = false;                                  // keys: the ramp is part of what is tested
    i.pitch = t > 7 && t < 8.5 ? 1 : t > 16 && t < 17 ? -0.6 : t > 20 && t < 22 ? 0.7 : 0;
    i.roll = t > 11 && t < 12.5 ? 1 : t > 24 && t < 26 ? -1 : 0;
    i.yaw = t > 9 && t < 9.5 ? 0.5 : 0;
    i.throttleRate = t > 26 ? -0.5 : 0;
    i.brake = 0;
    return i;
  };
  const runAt = (fps, jitter, seed) => {
    const p = new AircraftPhysics(F22);
    p.reset({ x: 0, y: 1.9, z: 80, heading: 0.1, fuel: 0.6, gear: 1, throttle: 1 });
    let n = 0;
    const loop = new Loop({ step: (d) => { if (n < TOTAL) { p.step(d, scripted(n), field); n++; } }, render: null });
    let s = seed >>> 0;
    const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    const frame = 1 / fps;
    let guard = 0;
    while (n < TOTAL && guard++ < 200000) loop.advance(jitter ? frame * (0.55 + rnd() * 0.9) : frame);
    return p;
  };
  const ref = runAt(120, false, 1);
  console.log(`  reference: 120 Hz, ${TOTAL} steps, x=${ref.x.toFixed(6)} y=${ref.y.toFixed(6)} z=${ref.z.toFixed(6)} cas=${f1(ref.cas / KT)} kt`);
  for (const [fps, j, label] of [[60, false, '60 Hz'], [144, false, '144 Hz'], [30, false, '30 Hz'], [240, false, '240 Hz'], [75, false, '75 Hz'], [60, true, '60 Hz + jitter'], [45, true, '45 Hz + jitter']]) {
    const p = runAt(fps, j, 7);
    const same = p.x === ref.x && p.y === ref.y && p.z === ref.z && p.vx === ref.vx && p.vy === ref.vy && p.vz === ref.vz &&
      p.qx === ref.qx && p.qy === ref.qy && p.qz === ref.qz && p.qw === ref.qw && p.fuel === ref.fuel;
    check(same, `${label.padEnd(16)} ${same ? 'identical to the bit' : 'DIFFERS'}`);
  }
  const again = runAt(120, false, 1);
  check(again.x === ref.x && again.qw === ref.qw, 'the same flight twice is identical');
}

// --- no allocation in step() -----------------------------------------------------------
console.log('\nAllocation');
{
  const p = H.airborne(F22, { h: 3000, mach: 0.7 });
  const inp = makeInput({ pitch: 0.2, roll: 0.3, ab: true });
  const go = (n) => { for (let i = 0; i < n; i++) { inp.pitch = Math.sin(i * 0.01) * 0.4; p.step(DT, inp, field); p.abFuel = 1; } };
  go(20000);
  if (global.gc) {
    global.gc();
    const before = process.memoryUsage().heapUsed;
    go(300000);
    global.gc();
    const grown = process.memoryUsage().heapUsed - before;
    check(grown < 1.5e6, `300,000 steps grew the heap by ${(grown / 1024).toFixed(0)} KB`);
  } else {
    console.log('  skip  (run with node --expose-gc, which npm run flight does)');
  }
}

// --- milestone 4: the three aircraft ---------------------------------------------------
// Each module is scripts/flight/<name>.mjs and exports a default async function that
// takes the kit below and reports through its check().
{
  const kit = { check, near, f1, f2, f3, deg, H, FT, KT, DT, makeInput, AircraftPhysics, field };
  for (const name of ['identity', 'b737', 'autopilot', 'switching', 'flaps', 'damage', 'damage-store', 'structures', 'respawn', 'damage-visuals', 'input', 'cockpit', 'hangar-flow', 'instruments', 'cockpit-feedback', 'navigation']) await (await import(`./flight/${name}.mjs`)).default(kit);
}

console.log(failed ? '\nFLIGHT CHECK FAILED' : '\nFLIGHT CHECK PASSED');
process.exit(failed ? 1 : 0);
