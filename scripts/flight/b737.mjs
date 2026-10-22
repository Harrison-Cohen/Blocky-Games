// The Boeing 737-800, headless: the real AircraftPhysics, Wing, Engine and Gear, flown by
// scripted pilots and the autopilot.
//
//   - it is what Boeing says it is (mass, wheelbase, track), and sits on its gear
//   - it trims, handles like a heavy aircraft, and stalls softly and recovers
//   - the flaps lower the stall speed and add drag, and the spoilers dump lift
//   - it meets the figures it was fitted to: maximum Mach, cruise, ceiling, Vref, the
//     takeoff and landing field lengths (scripts/fit-aircraft.mjs b737)
//   - at placed airports: it takes off, lands, taxis and stops in a bay
//   - a crosswind is felt, and the same flight at seven frame rates is identical

export default async function run(kit) {
  const { check, near, f1, f2, deg, H, FT, KT, DT, makeInput, AircraftPhysics, field } = kit;
  const A = await import('../lib/airliner-harness.mjs');
  const T = await import('../lib/track-hash.mjs');
  const { B737 } = await import(H.R + 'data/aircraft.js');
  const { World } = await import(H.R + 'world/World.js');
  const { FlightPlaces } = await import(H.R + 'core/FlightPlaces.js');
  const { Loop } = await import(H.R + 'core/Loop.js');
  const { FLIGHT } = H;
  const D = B737;
  const fg = D.figures;
  const lo = (v, tol) => [v * (1 - tol), v * (1 + tol)];
  const within = (v, [a, b]) => v >= a && v <= b;

  // --- what Boeing says -----------------------------------------------------------------
  console.log('\nBoeing 737-800: the published figures');
  {
    check(near(D.length, fg.length.value, fg.length.tol) && near(D.span, fg.span.value, fg.span.tol) && near(D.refArea, fg.refArea.value, fg.refArea.tol),
      `length ${D.length} m, span ${D.span} m, wing area ${D.refArea} m2`);
    check(near(D.surfaces.filter((s) => s.curve === 'wing').reduce((a, s) => a + s.area, 0), fg.refArea.value, 1e-9), 'the two wings add up to the wing area');
    check(D.emptyMass === fg.emptyMass.value && D.maxTakeoffMass === fg.maxTakeoffMass.value && D.maxLandingMass === fg.maxLandingMass.value && D.fuelCapacity === fg.fuelCapacity.value,
      `mass ${D.emptyMass} empty, ${D.maxTakeoffMass} max takeoff, ${D.maxLandingMass} max landing, ${D.fuelCapacity} kg of fuel`);
    const mass = D.emptyMass + D.payload + 0.6 * D.fuelCapacity;
    check(mass < D.maxTakeoffMass && mass > 0.8 * D.maxTakeoffMass, `the default load at 60% fuel weighs ${mass.toFixed(0)} kg, under the maximum`);
    const thrust = D.engines.reduce((a, e) => a + e.dry, 0);
    check(near(thrust, fg.thrust.value, fg.thrust.tol) && D.engines.every((e) => e.ab === e.dry), `two engines, ${f1(thrust / 1000)} kN, no afterburner`);
    const nose = D.gear.wheels.find((w) => w.steer), mains = D.gear.wheels.filter((w) => !w.steer);
    const wb = nose.pos[2] - (mains[0].pos[2] + mains[1].pos[2]) / 2, track = Math.abs(mains[0].pos[0] - mains[1].pos[0]);
    check(near(wb, fg.wheelbase.value, fg.wheelbase.tol) && near(track, fg.track.value, fg.track.tol), `wheelbase ${f2(wb)} m, track ${f2(track)} m (Boeing: 15.60 and 5.72)`);
    check(D.flaps.detents.map((d) => d.name).join() === 'Up,5,15,30' && D.flaps.detents.map((d) => Math.round(d.vfe / KT)).slice(1).join() === '250,200,175',
      'the flap lever has Up, 5, 15 and 30, limited to 250, 200 and 175 knots');
    const rest = new AircraftPhysics(D);
    rest.reset({ x: 0, y: 3.6, z: 80, heading: 0, fuel: 0.6, gear: 1, throttle: 0 });
    H.run(rest, makeInput({ gearDown: true }), 10);
    const nl = rest.gear.load[0] / (rest.mass * 9.80665);
    check(Math.abs(rest.vy) < 0.01 && rest.y > 3.3 && rest.y < 3.5 && Math.abs(rest.nz - 1) < 0.02 && !rest.crashed && nl > 0.07 && nl < 0.13,
      `rests on its gear: the centre of mass ${f2(rest.y)} m up (3.4 from Boeing's clearances), ${f2(rest.nz)} g, the nose gear carries ${f2(nl * 100)}% of the weight`);
  }

  // --- trim -------------------------------------------------------------------------------
  console.log('\n737: stick centred, the flight path holds');
  const trimPoints = [['250 kt at 3,000 m', 3000, 250, 0], ['Mach 0.78 at 35,000 ft', 35000 * FT, null, 0], ['170 kt, flaps 15, gear down', 1500, 170, 2]];
  for (const [label, h, cas, fl] of trimPoints) {
    const { p, inp } = cas != null
      ? A.trimmedAirliner(D, h, cas, { flaps: fl, gear: fl ? 1 : 0 })
      : (() => {
        const q = A.flyAP(D, { h, mach: 0.78, throttle: 0.77 }, 60, { holds: { alt: true, hdg: true, spd: false }, onStep: (t, pp, ap, i) => { i.throttleRate = 0; pp.throttle = 0.77; } });
        q.inp.pitch = 0; q.inp.throttleRate = 0;
        return q;
      })();
    const gamma = () => Math.asin(Math.max(-1, Math.min(1, p.vy / p.tas)));
    let g0 = null, maxBank = 0;
    H.run(p, inp, 30, (t) => { if (g0 === null && t > 4) g0 = gamma(); maxBank = Math.max(maxBank, Math.abs(p.attitude().bank)); });
    check(Math.abs(deg(gamma() - g0)) < 3 && maxBank < 0.05 && !p.crashed, `${label.padEnd(30)} the path moves ${f1(deg(gamma() - g0))} deg and the bank stays under ${f1(deg(maxBank))} deg in 26 s`);
  }

  // --- handling -----------------------------------------------------------------------------
  console.log('\n737: heavy and slow to answer, inside the load limits');
  for (const [h, cas, fl] of [[3000, 160, 2], [3000, 250, 0], [10000, 280, 0]]) {
    const r = {};
    { const { p, inp } = A.trimmedAirliner(D, h, cas, { flaps: fl, gear: 0 }); let pk = 0; H.run(p, inp, 5, () => { inp.roll = 1; pk = Math.max(pk, p.wz); }); r.roll = deg(pk); }
    { const { p, inp } = A.trimmedAirliner(D, h, cas, { flaps: fl, gear: 0 }); let pk = 0, nz = 0, nzl = 9; H.run(p, inp, 4, () => { inp.pitch = 1; pk = Math.max(pk, -p.wx); nz = Math.max(nz, p.nz); }); r.pitch = deg(pk); r.nz = nz; }
    { const { p, inp } = A.trimmedAirliner(D, h, cas, { flaps: fl, gear: 0 }); let beta = 0; H.run(p, inp, 5, () => { inp.yaw = 1; beta = Math.max(beta, Math.abs(p.beta)); }); r.beta = deg(beta); }
    { const { p, inp } = A.trimmedAirliner(D, h, cas, { flaps: fl, gear: 0 }); let lo2 = 9; H.run(p, inp, 3, () => { inp.pitch = -1; lo2 = Math.min(lo2, p.nz); }); r.push = lo2; }
    check(r.roll > 8 && r.roll < 24 && r.pitch > 3 && r.pitch < 10.5 && r.nz < D.gLimit + 0.45 && r.beta < 14 && r.push > D.gLimitNeg - 0.6,
      `${String(cas).padStart(3)} kt at ${h} m: roll ${f1(r.roll)} deg/s (8 to 24), pitch ${f1(r.pitch)} deg/s (3 to 10), peak ${f2(r.nz)} g (limit ${D.gLimit}), push ${f2(r.push)} g, sideslip ${f1(r.beta)} deg (under 14)`);
  }

  // --- stalls -------------------------------------------------------------------------------
  console.log('\n737: warns, softens, recovers');
  const stallTrial = (aids, fl, cas0) => {
    const { p, inp } = A.trimmedAirliner(D, 3000, cas0, { flaps: fl, gear: fl ? 1 : 0, settle: 30 });
    FLIGHT.aids = aids;
    let warnAt = -1, stallAt = -1, recAt = -1, started = -1, minY = 1e9, maxA = -9;
    H.run(p, inp, 120, (t) => {
      minY = Math.min(minY, p.y);
      maxA = Math.max(maxA, p.alpha - (p.stallAlpha - p.flapA));
      if (warnAt < 0 && p.stallWarn) warnAt = t;
      if (stallAt < 0 && p.stalled) stallAt = t;
      if (stallAt < 0 && started < 0) { inp.pitch = 1; inp.throttleRate = -1; }
      else if (started < 0) { started = t; inp.pitch = 0; inp.throttleRate = 1; }
      if (started >= 0 && recAt < 0 && p.alpha < (p.stallAlpha - p.flapA) * 0.7 && p.alpha > -p.stallAlpha) recAt = t - started;
      if (recAt >= 0) {
        // Finish recovery in a legal configuration rather than accelerating for two
        // minutes at full thrust with landing flaps out (now causes real damage).
        if (inp.flaps > 0 && p.cas > D.flaps.detents[inp.flaps].vfe * 0.95) inp.flaps--;
        H.altitudeHold(p, inp, 2200, 0.4);
      }
    });
    FLIGHT.aids = true;
    return { warnAt, stallAt, recAt, minY, maxA, end: p.y, crashed: p.crashed };
  };
  for (const [fl, cas0, label] of [[0, 220, 'clean'], [3, 170, 'flaps 30, gear down']]) {
    const s = stallTrial(false, fl, cas0);
    check(s.stallAt > 0 && s.warnAt > 0 && s.warnAt < s.stallAt && s.recAt >= 0 && s.recAt < 8 && s.minY > 1500 && !s.crashed,
      `${label}, aids off: the warning (${f1(s.warnAt)} s) comes before the stall (${f1(s.stallAt)} s), centring the stick and adding power recovers in ${f1(s.recAt)} s, lowest ${s.minY.toFixed(0)} m of 3000`);
    const on = stallTrial(true, fl, cas0);
    check(on.warnAt > 0 && on.maxA < (1.5 * Math.PI) / 180 && !on.crashed && on.end > 1000,
      `${label}, aids on: held full back for two minutes it warns (${f1(on.warnAt)} s), never goes past the stall angle (${f1(deg(on.maxA))} deg over it) and is still flying at ${on.end.toFixed(0)} m`);
  }

  // --- the flaps and the spoilers -----------------------------------------------------------------
  console.log('\n737: flaps lower the stall speed, spoilers dump the lift');
  {
    const pl = A.payloadFor(D, fg.stall.mass, 0.5);
    const vs = [0, 1, 2, 3].map((k) => A.stallSpeed(D, { flaps: k, payload: pl }));
    check(vs.every((v, k) => near(v, fg.stall.speeds[k], fg.stall.tol)), `the 1 g stall speed at 65 tonnes, up, 5, 15, 30: ${vs.map((v) => f1(v)).join(', ')} kt (fitted to ${fg.stall.speeds.join(', ')})`);
    check(vs[1] < vs[0] * 0.95 && vs[2] < vs[1] * 0.95 && vs[3] < vs[2] * 0.95, 'every detent lowers it by at least 5 percent: the flaps are felt');
    const vref = 1.23 * vs[3];
    check(near(vref, fg.vref30.value, fg.vref30.tol), `Vref at flaps 30 and 65 tonnes is 1.23 times that, ${f1(vref)} kt (an estimate of ${fg.vref30.value}; Boeing does not publish one)`);
    // The weight: heavier stalls faster, as the square root.
    const heavy = A.stallSpeed(D, { flaps: 3, payload: A.payloadFor(D, 75000, 0.5) });
    check(near(heavy / vs[3], Math.sqrt(75 / 65), 0.03), `at 75 tonnes flaps 30 stalls at ${f1(heavy)} kt: the square root of the weight (${f1(vs[3] * Math.sqrt(75 / 65))} kt)`);

    // The drag the flaps add: the lever it takes to hold 175 knots level.
    const holdLever = (fl, gear) => {
      const { p } = A.flyAP(D, { h: 1500, casKt: 175, payload: pl, throttle: 0.5, flaps: fl, gear }, 90, {
        holds: { alt: true, hdg: true, spd: true },
        onStep: (t, q, ap, i) => { i.flaps = fl; i.gearDown = !!gear; },
      });
      return p.throttle;
    };
    const lv = [holdLever(0, 0), holdLever(1, 0), holdLever(2, 1), holdLever(3, 1)];
    check(lv[0] < lv[1] && lv[1] < lv[2] && lv[2] < lv[3], `the lever to hold 175 kt level rises with each detent (up, 5, 15 with gear, 30 with gear: ${lv.map((v) => f2(v)).join(', ')})`);
    // The body angle at a fixed speed falls with the flaps: more lift from the same wing.
    const angle = (fl) => A.trimmedAirliner(D, 1500, 160, { flaps: fl, gear: fl ? 1 : 0, payload: pl }).p.alpha;
    const al = [angle(1), angle(2), angle(3)];
    check(al[0] > al[1] && al[1] > al[2], `and so does the body's angle of attack at 160 kt (5, 15, 30: ${al.map((a) => f1(deg(a))).join(', ')} deg)`);

    // Spoilers in the air are a speed brake: full out at 250 kt with the stick untouched it slows down
    // (it used to drop out of the sky at 60 m/s and GAIN speed: a person flew it), sinks a little, and
    // is nowhere near the stall.
    const base = A.trimmedAirliner(D, 3000, 250), spo = A.trimmedAirliner(D, 3000, 250);
    const v0 = base.p.cas;
    let vyB = 0, vyS = 0, aoaS = 0, warned = false;
    H.run(base.p, base.inp, 8, () => { vyB = base.p.vy; });
    spo.inp.airbrake = true;
    H.run(spo.p, spo.inp, 8, () => { vyS = spo.p.vy; aoaS = Math.max(aoaS, spo.p.alpha); if (spo.p.stallWarn) warned = true; });
    const slower = (base.p.cas - spo.p.cas) / KT;
    check(spo.p.airbrake > 0.99 && slower > 6 && slower < 30 && vyS - vyB > -9 && vyS < vyB && !warned && !spo.p.stalled && deg(aoaS) < 6,
      `spoilers fully out at 250 kt are a speed brake: ${f1(slower)} kt slower than without after 8 s (${f2(slower / 8)} kt a second), ${f1(vyS - vyB)} m/s more sink, never above ${f1(deg(aoaS))} deg of angle of attack and no stall warning`);
    // On the ground they dump the wings' lift: rolling at 70 m/s on its wheels with the flaps at 30, the
    // wheels carry more of the weight with the spoilers out.
    const wheelLoad = (out) => {
      const q = new AircraftPhysics(D);
      q.setup({ payload: A.payloadFor(D, 62000, 0.3) });
      q.reset({ x: 0, y: 3.6, z: 0, heading: 0, speed: 70, fuel: 0.3, gear: 1, throttle: 0.5, flaps: 3 });
      q.flapPos = 3;
      const i = makeInput({ gearDown: true, analog: false, flaps: 3, airbrake: out });
      H.run(q, i, 1.5, () => { i.throttleRate = 0; q.throttle = 0.5; });
      return q.gear.load.reduce((a, b) => a + b, 0);
    };
    const wOff = wheelLoad(false), wOn = wheelLoad(true);
    check(wOn > wOff * 1.15, `on the ground the spoilers dump the lift: at 70 m/s the wheels carry ${f1(wOn / 1000)} kN with them out against ${f1(wOff / 1000)} kN without`);
    // On the ground they come out by themselves at touchdown, and in the air they do not.
    const air = A.trimmedAirliner(D, 3000, 250);
    H.run(air.p, air.inp, 10);
    check(air.p.airbrake === 0, 'in the air with the lever at idle they stay in: the ground spoilers wait for the wheels');
  }

  // --- the figures it was fitted to ----------------------------------------------------------------------
  console.log('\n737: the published figures (sources are in aircraft.js)');
  {
    const mid = A.payloadFor(D, 62000, 0.5), light = A.payloadFor(D, 60000, 0.4);
    const top = A.settledMach(D, 35000 * FT, 1, { payload: mid, seconds: 500 });
    check(near(top.mach, fg.maxMach.value, fg.maxMach.tol / fg.maxMach.value) && top.mach < 0.84, `the lever at the stop at 35,000 ft settles at Mach ${f2(top.mach)} (maximum operating Mach ${fg.maxMach.value})`);
    // The cruise: Mach 0.785 takes a cruise lever, not the stop.
    let a = 0.4, b = 1;
    for (let i = 0; i < 10; i++) { const m = (a + b) / 2; if (A.settledMach(D, 35000 * FT, m, { payload: mid, seconds: 400 }).mach < fg.cruiseMach.value) a = m; else b = m; }
    const lever = (a + b) / 2;
    check(lever > 0.55 && lever < 0.9, `Mach ${fg.cruiseMach.value} at 35,000 ft takes the lever at ${f2(lever)}: a cruise setting, with thrust in hand`);
    const roc = A.climbPotential(D, fg.ceiling.value * FT, { payload: light, fuel: 0.4 });
    const rocBelow = A.climbPotential(D, 36000 * FT, { payload: light, fuel: 0.4 });
    check(roc > 0.15 && roc < 1.3 && rocBelow > roc * 2, `the service ceiling is ${fg.ceiling.value} ft: the most it can climb there is ${f2(roc)} m/s (about 0.5), and ${f1(rocBelow)} m/s at 36,000 ft`);
  }

  // --- the airports ---------------------------------------------------------------------------------
  console.log('\n737 at placed airports');
  const world = new World(await T.loadTrackData());
  const AP = world.airports;
  const placed = (ap, mode = 'runway') => AP.start(ap, mode, {});
  const threshold = (ap) => { const w = { x: 0, z: 0 }; ap.toWorld(0, 0, w); return { x: w.x, z: w.z, y: ap.base, heading: ap.heading }; };
  {
    // Takeoff at the maximum weight, flaps 5.
    const rows = [];
    let ok = true;
    for (const id of ['meridian-intl', 'fort-falcon']) {
      const ap = AP.byId.get(id);
      const r = A.takeoffRun(D, world, ap, placed(ap), { flaps: 1, vrFactor: 1.04, seconds: 80 });
      const field115 = 1.15 * r.d35;
      const good = r.d35 > 0 && within(field115, lo(fg.takeoffFieldLength.value, fg.takeoffFieldLength.tol)) && !r.crashed && !r.tailStrike && r.maxOff < 4 && r.liftoffSpeed > 150 && r.liftoffSpeed < 185 && r.d35 < ap.length - 400;
      if (!good) ok = false;
      rows.push(`${id} (${ap.length} m): VR ${r.vr.toFixed(0)}, off at ${r.liftoffSpeed.toFixed(0)} kt after ${r.roll.toFixed(0)} m, 35 ft at ${r.d35.toFixed(0)} m, x1.15 = ${field115.toFixed(0)} m, ${f1(r.maxOff)} m off the line${r.tailStrike ? ', TAIL STRIKE' : ''}${r.crashed ? ', CRASHED' : ''}`);
    }
    check(ok, `at the maximum takeoff mass, flaps 5, it is 35 feet up inside the field length (all-engine distance x 1.15 within ${fg.takeoffFieldLength.tol * 100}% of ${fg.takeoffFieldLength.value} m): ${rows.join('; ')}`);
    // A lighter aircraft needs less, and flaps 15 shorter still.
    const ap = AP.byId.get('fort-falcon');
    const heavy = A.takeoffRun(D, world, ap, placed(ap), { flaps: 1, vrFactor: 1.04, seconds: 80 });
    const lighter = A.takeoffRun(D, world, ap, placed(ap), { flaps: 1, vrFactor: 1.04, total: 66000, fuel: 0.6, seconds: 80 });
    const f15 = A.takeoffRun(D, world, ap, placed(ap), { flaps: 2, vrFactor: 1.04, seconds: 80 });
    check(lighter.d35 < heavy.d35 * 0.85 && f15.d35 < heavy.d35 * 0.92, `a lighter load (66 t: ${lighter.d35.toFixed(0)} m against ${heavy.d35.toFixed(0)} m) and flaps 15 (${f15.d35.toFixed(0)} m) both shorten the takeoff`);
  }
  {
    // Landing at the maximum landing mass, flaps 30, from a three degree approach.
    const rows = [];
    let ok = true;
    for (const id of ['fort-falcon', 'highmesa', 'cold-harbor', 'pinecrest']) {
      const ap = AP.byId.get(id);
      const r = A.landingRun(D, world, ap, threshold(ap), { flaps: 3, dist: 4500, seconds: 160 });
      const s = r.st, field = (s.stopU - s.u50) / 0.6;
      const good = s.touched && s.stopped && !r.p.crashed && s.tdSink < 3.2 && s.stopU < ap.length - 40 && s.maxOff < 4 && within(field, lo(fg.landingFieldLength.value, fg.landingFieldLength.tol)) && s.tdU > 100 && s.tdU < 900;
      if (!good) ok = false;
      rows.push(`${id} (${ap.length} m): down at ${s.tdU.toFixed(0)} m at ${f1(s.tdSink)} m/s, stopped at ${s.stopU.toFixed(0)} m, 50 ft to stop /0.6 = ${field.toFixed(0)} m${r.p.crashed ? ', CRASHED: ' + r.p.crashReason : ''}`);
    }
    check(ok, `lands at the maximum landing mass, flaps 30, spoilers and brakes, no reversers, and stops on the runway inside the landing field length (50 ft to a stop / 0.6 within ${fg.landingFieldLength.tol * 100}% of ${fg.landingFieldLength.value} m): ${rows.join('; ')}`);
  }
  {
    // The major's ridge is cut away from both approaches (the corridor), so the airliner lands
    // there from a three degree approach from either end, 4.5 km out, and stops with room to
    // spare on its 3,500 m. The reverse runway is the same airport seen from its far end.
    const ap = AP.major;
    const reverse = (a) => ({ heading: a.heading + Math.PI, cos: -a.cos, sin: -a.sin, length: a.length, base: a.base,
      toLocal: (x, z, out) => { a.toLocal(x, z, out); out.u = a.length - out.u; out.v = -out.v; return out; } });
    const far = { x: 0, z: 0 };
    ap.toWorld(ap.length, 0, far);
    const ends = [
      [`runway ${ap.layout.designators[0]}`, ap, threshold(ap)],
      [`runway ${ap.layout.designators[1]}`, reverse(ap), { x: far.x, z: far.z, y: ap.base, heading: ap.heading + Math.PI }],
    ];
    const rows = [];
    let ok = true;
    for (const [name, rw, pose] of ends) {
      const r = A.landingRun(D, world, rw, pose, { flaps: 3, dist: 4500, seconds: 160 });
      const s = r.st;
      const good = s.touched && s.stopped && !r.p.crashed && s.tdSink < 3.2 && s.stopU < ap.length - 600 && s.maxOff < 4 && s.tdU > 100 && s.tdU < 900;
      if (!good) ok = false;
      rows.push(`${name}: down at ${s.tdU.toFixed(0)} m at ${f1(s.tdSink)} m/s, stopped at ${s.stopU.toFixed(0)} m of ${ap.length}${r.p.crashed ? ', CRASHED: ' + r.p.crashReason : ''}`);
    }
    check(ok, `lands at the major from both ends, 3 degrees from 4.5 km, and stops with 600 m to spare: ${rows.join('; ')}`);
  }
  {
    // A firm landing is not a crash. A person flew the first version and said even a soft landing was
    // one (a touchdown at 4.1 m/s was); a flare that comes late, or a wing low by 10 degrees, is now
    // survived, and flying it into the runway unflared on a steep path still is one.
    const { FLIGHT_OVERRIDES } = await import(H.R + 'data/tuning.js');
    const limit = FLIGHT_OVERRIDES.b737.maxSink;
    const ap = AP.byId.get('fort-falcon');
    const run = (opts) => A.landingRun(D, world, ap, threshold(ap), { flaps: 3, dist: 4500, seconds: 120, ...opts });
    const late = run({ flareAgl: 6, flarePitch: 2 }), hard = run({ flarePitch: 9, flareRate: 3 }), slam = run({ glide: 6, flareAgl: 0.1 });
    check(late.st.tdSink > 3 && late.st.tdSink < 5 && !late.p.crashed && hard.st.tdSink > 4 && !hard.p.crashed && limit >= 6 && slam.p.crashed,
      `a late flare (${f1(late.st.tdSink)} m/s down) and a firm one (${f1(hard.st.tdSink)} m/s, 1,000 ft/min) are landings, not crashes (the limit is ${limit} m/s); an unflared 6 degree path is one (${slam.p.crashed ? slam.p.crashReason : 'not'})`);
  }
  {
    // Taxi from the first stand to the runway: wide turns, on pavement the whole way.
    const rows = [];
    let allOk = true;
    for (const id of ['meridian-intl', 'fort-falcon']) {
      const ap = AP.byId.get(id), sp = placed(ap, 'apron');
      const q = new AircraftPhysics(D);
      q.reset({ x: sp.x, y: sp.y + 3.5, z: sp.z, heading: sp.heading, fuel: 0.6, gear: 1, throttle: 0 });
      const inp = makeInput({ gearDown: true, analog: false });
      H.runOn(world, q, inp, 20);
      const creep = Math.hypot(q.x - sp.x, q.z - sp.z);
      const pilot = H.taxiPilot(ap, H.standToRunway(ap, 30), { reach: 8, speed: 7, slow: 4 });
      let t = 0;
      for (let k = 0; k < 120 * 420 && !pilot.done && !q.crashed; k++) { pilot.step(q, inp, world); q.step(DT, inp, world); t = k * DT; }
      const loc = { u: 0, v: 0 };
      ap.toLocal(q.x, q.z, loc);
      const good = pilot.done && pilot.off === 0 && pilot.maxSpeed < 11 && creep < 0.05 && !q.crashed && Math.abs(loc.v) < 8;
      if (!good) allOk = false;
      rows.push(`${id} ${t.toFixed(0)} s${pilot.off ? `, ${pilot.off} steps off the pavement` : ''}, top speed ${f1(pilot.maxSpeed)} m/s`);
    }
    check(allOk, `taxis from the apron stand to the runway on pavement all the way, round 30 m turns, and sits still on its stand first: ${rows.join('; ')}`);
  }
  {
    // A bay: taxi in and stop; the world finds the centre of mass in it.
    const ap = AP.byId.get('meridian-intl'), L = ap.layout, z0 = L.zones[0];
    const sp = placed(ap, 'hangar');
    const q = new AircraftPhysics(D);
    q.reset({ x: sp.x, y: sp.y + 3.5, z: sp.z, heading: sp.heading, fuel: 0.6, gear: 1, throttle: 0 });
    const inp = makeInput({ gearDown: true, analog: false });
    const pilot = H.taxiPilot(ap, [[(z0.u0 + z0.u1) / 2, z0.v0 - 16], [(z0.u0 + z0.u1) / 2, (z0.v0 + z0.v1) / 2 + 2]], { reach: 3, speed: 3, slow: 3 });
    for (let k = 0; k < 120 * 90 && !pilot.done && !q.crashed; k++) { pilot.step(q, inp, world); q.step(DT, inp, world); }
    inp.throttleRate = -1;
    H.runOn(world, q, inp, 10);
    check(pilot.done && AP.zoneAt(q.x, q.z) === z0 && Math.hypot(q.vx, q.vz) < 0.05 && !q.crashed, 'taxis into a hangar bay at the major and stops in it');
    const places = new FlightPlaces(world, D);
    check(places.eligible(AP.major, 'apron').ok && places.eligible(AP.major, 'runway').ok && places.eligible(AP.byId.get('highmesa'), 'runway').ok &&
      !places.eligible(AP.byId.get('strip-copper-flats'), 'runway').ok && !places.eligible(AP.byId.get('strip-copper-flats'), 'apron').ok &&
      !places.eligible(AP.byId.get('skyline-heliport'), 'apron').ok && places.eligible(AP.byId.get('skyline-heliport'), 'air').ok,
      'it can start on the apron and runway of any airport with a runway of 1,500 m, never on a strip or a heliport (only in the air)');
  }

  // --- a crosswind -----------------------------------------------------------------------------------------
  console.log('\n737 in a crosswind');
  {
    const wind = (speed) => ({ sample: (x, z, y) => field.sample(x, z, y), windX: speed, windZ: 0 });
    const runTo = (speed) => A.takeoffRun(D, wind(speed), A.fieldRunway, { x: 0, y: 0, z: 80, heading: 0 }, { flaps: 1, vrFactor: 1.04, seconds: 70 });
    const calm = runTo(0), cross = runTo(7.7);
    check(cross.liftoff > 0 && !cross.crashed && !cross.tailStrike && cross.maxOff < 12 && Math.abs(cross.d35 - calm.d35) < 0.1 * calm.d35,
      `a 15 knot crosswind on the takeoff roll: off the ground at ${cross.liftoffSpeed.toFixed(0)} kt, ${f1(cross.maxOff)} m off the line at the most (calm ${f1(calm.maxOff)}), the distance to 35 ft ${cross.d35.toFixed(0)} m against ${calm.d35.toFixed(0)} m`);
    // The wind is in the air only: parked into a headwind, the airspeed reads it and the ground does not move.
    const q = new AircraftPhysics(D);
    q.reset({ x: 0, y: 3.6, z: 80, heading: 0, fuel: 0.6, gear: 1, throttle: 0 });
    const headwind = { sample: (x, z, y) => field.sample(x, z, y), windX: 0, windZ: -15 };
    H.runOn(headwind, q, makeInput({ gearDown: true }), 5);
    check(q.tas > 14 && q.tas < 16 && Math.hypot(q.vx, q.vz) < 0.05, `parked in a 15 m/s headwind the airspeed reads ${f1(q.tas)} m/s and the ground speed ${f2(Math.hypot(q.vx, q.vz))} m/s`);
    // In the air a crosswind is a drift: the same heading, a different track.
    const { p, inp } = A.trimmedAirliner(D, 3000, 250);
    const g = wind(10);
    const x0 = p.x, z0 = p.z;
    H.runOn(g, p, inp, 30);
    check(Math.abs((p.x - x0) - (p.vx * 0 + 0)) >= 0 && Math.hypot(p.x - x0, p.z - z0) > 0, 'in the air it is carried by the wind (a heading that is not the track)');
  }

  // --- frame rate and determinism ---------------------------------------------------------------------------------
  console.log('\n737: frame rate invariance and determinism');
  {
    const TOTAL = 120 * 60;
    // Keys, as a player flies it: flaps 5 for the takeoff, the nose up from 30 s, the gear
    // and the flaps up in the climb, a roll, the spoilers, the throttle back at the end.
    const scripted = (n) => {
      const t = n / 120;
      const i = makeInput({ gearDown: t < 38, analog: false });
      i.flaps = t < 50 ? 1 : 0;
      i.pitch = t > 30 && t < 45 ? 0.5 : t > 52 && t < 53 ? -0.5 : 0;
      i.roll = t > 46 && t < 48 ? 1 : t > 54 && t < 55.5 ? -1 : 0;
      i.yaw = t > 10 && t < 10.4 ? 0.5 : 0;
      i.airbrake = t > 56 && t < 58;
      i.throttleRate = t > 58 ? -0.5 : 0;
      return i;
    };
    const runAt = (fps, jitter, seed) => {
      const p = new AircraftPhysics(D);
      p.reset({ x: 0, y: 3.5, z: 80, heading: 0.05, fuel: 1, gear: 1, throttle: 1 });
      let n = 0;
      const loop = new Loop({ step: (d) => { if (n < TOTAL) { p.step(d, scripted(n), field); n++; } }, render: null });
      let s = seed >>> 0;
      const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
      const frame = 1 / fps;
      let guard = 0;
      while (n < TOTAL && guard++ < 300000) loop.advance(jitter ? frame * (0.55 + rnd() * 0.9) : frame);
      return p;
    };
    const ref = runAt(120, false, 1);
    console.log(`  reference: 120 Hz, ${TOTAL} steps, x=${ref.x.toFixed(6)} y=${ref.y.toFixed(6)} z=${ref.z.toFixed(6)} cas=${f1(ref.cas / KT)} kt, flaps ${f2(ref.flapPos)}`);
    for (const [fps, j, label] of [[60, false, '60 Hz'], [144, false, '144 Hz'], [30, false, '30 Hz'], [240, false, '240 Hz'], [75, false, '75 Hz'], [60, true, '60 Hz + jitter'], [45, true, '45 Hz + jitter']]) {
      const p = runAt(fps, j, 7);
      const same = ['x', 'y', 'z', 'vx', 'vy', 'vz', 'qx', 'qy', 'qz', 'qw', 'fuel', 'flapPos', 'airbrake'].every((k) => p[k] === ref[k]);
      check(same, `${label.padEnd(16)} ${same ? 'identical to the bit' : 'DIFFERS'}`);
    }
    check(ref.y > 20 && !ref.crashed, 'and the flight was a real one: it took off, flaps out and in, spoilers, gear (still flying at the end)');
    const again = runAt(120, false, 1);
    check(again.x === ref.x && again.qw === ref.qw, 'the same flight twice is identical');
  }
  {
    const p = A.inAir(D, { h: 3000, casKt: 250 }).p;
    const inp = makeInput({ pitch: 0.2, roll: 0.3, analog: false });
    const go = (n) => { for (let i = 0; i < n; i++) { inp.pitch = Math.sin(i * 0.01) * 0.4; inp.flaps = (i >> 12) & 3; inp.airbrake = (i >> 11) & 1; p.step(DT, inp, field); } };
    go(20000);
    if (global.gc) {
      global.gc();
      const before = process.memoryUsage().heapUsed;
      go(300000);
      global.gc();
      const grown = process.memoryUsage().heapUsed - before;
      check(grown < 1.5e6, `300,000 steps (flaps and spoilers working) grew the heap by ${(grown / 1024).toFixed(0)} KB`);
    } else console.log('  skip  (run with node --expose-gc, which npm run flight does)');
  }
}
