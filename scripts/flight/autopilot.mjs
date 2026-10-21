// The autopilot, headless, on both fixed-wing aircraft: the real AircraftPhysics flown by
// src/flight/Autopilot.js, which is a pilot (it writes the same stick and lever a player does).
//
//   - altitude: a step up and a step down settle on the target, without hunting
//   - heading: a turn onto a new heading rolls out on it, inside the bank limit
//   - speed: the lever finds the speed asked for and holds it
//   - the three at once, and each hold alone (a hold can be taken away)
//   - the target keys move the targets at the rate the tuning says
//   - it lets go by itself on the ground, in a stall and in a wreck
//   - the same flight at 60 Hz as at 120 Hz is identical (it runs on the physics clock)

export default async function run(kit) {
  const { check, f1, f2, deg, H, KT, DT, makeInput } = kit;
  const A = await import('../lib/airliner-harness.mjs');
  const { F22, B737 } = await import(H.R + 'data/aircraft.js');
  const { AUTOPILOT } = await import(H.R + 'data/tuning.js');

  // Each aircraft in the state a pilot would engage it in: height, speed, load.
  const SETUPS = [
    { def: F22, label: 'F-22', h: 3000, casKt: 300, throttle: 0.7, speedStep: 40 },
    { def: B737, label: '737', h: 3000, casKt: 230, throttle: 0.6, speedStep: -30, payload: A.payloadFor(B737, 62000, 0.5) },
  ];

  // Flies `seconds`, sampling once a second; `go(ap, p, t)` sets the targets at t = 0.
  const fly = (s, seconds, holds, go, onStep) => {
    const rows = [];
    const r = A.flyAP(s.def, { h: s.h, casKt: s.casKt, fuel: 0.5, payload: s.payload, throttle: s.throttle }, seconds, {
      holds, tuned: true,
      onStep: (t, p, ap, inp) => {
        if (t < DT / 2) go(ap, p);
        if (onStep) onStep(t, p, ap, inp);
        if (Math.abs(t % 1) < DT / 2 || Math.abs((t % 1) - 1) < DT / 2) {
          const a = p.attitude();
          rows.push({ t: Math.round(t), y: p.y, vy: p.vy, hdg: a.heading, bank: a.bank, cas: p.cas / KT, pitch: a.pitch, nz: p.nz });
        }
      },
    });
    return { ...r, rows };
  };
  const wrap = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };

  console.log('\nThe autopilot');
  for (const s of SETUPS) {
    const C = Object.assign({}, AUTOPILOT.default, AUTOPILOT[s.def.id]);

    // Altitude: 300 m up, then 300 m down.
    for (const step of [300, -300]) {
      let target = 0;
      const r = fly(s, 150, { alt: true, hdg: true, spd: true }, (ap) => { ap.alt += step; target = ap.alt; });
      const tail = r.rows.filter((x) => x.t >= 110);
      const err = Math.max(...tail.map((x) => Math.abs(x.y - target)));
      const wobble = Math.max(...tail.map((x) => x.y)) - Math.min(...tail.map((x) => x.y));
      const over = step > 0 ? Math.max(...r.rows.map((x) => x.y)) - target : target - Math.min(...r.rows.map((x) => x.y));
      const vs = Math.max(...tail.map((x) => Math.abs(x.vy)));
      const nz = [Math.min(...r.rows.map((x) => x.nz)), Math.max(...r.rows.map((x) => x.nz))];
      check(err < 4 && wobble < 4 && over < 0.04 * Math.abs(step) && vs < 0.5 && nz[0] > (s.def === F22 ? -0.3 : 0.6) && nz[1] < (s.def === F22 ? 3.2 : 1.35) && !r.p.crashed && !r.p.stalled,
        `${s.label}: a ${step > 0 ? 'climb' : 'descent'} of ${Math.abs(step)} m settles inside ${f1(err)} m, ${f1(over)} m of overshoot, ${f2(vs)} m/s of vertical speed left, ${f1(wobble)} m of wobble in the last 40 s, load factor ${f2(nz[0])} to ${f2(nz[1])}`);
    }

    // Heading: 60 degrees right, then 90 left.
    for (const turn of [60, -90]) {
      let aim = 0, y0 = 0;
      const r = fly(s, 150, { alt: true, hdg: true, spd: true }, (ap, p) => { ap.hdg = (ap.hdg + (turn * Math.PI) / 180 + Math.PI * 2) % (Math.PI * 2); aim = ap.hdg; y0 = ap.alt; });
      const tail = r.rows.filter((x) => x.t >= 120);
      const err = Math.max(...tail.map((x) => Math.abs(deg(wrap(x.hdg - aim)))));
      const bank = Math.max(...r.rows.map((x) => Math.abs(x.bank)));
      const lost = Math.max(...r.rows.map((x) => Math.abs(x.y - y0)));
      const bankEnd = Math.max(...tail.map((x) => Math.abs(x.bank)));
      check(err < 1.5 && bank <= C.bankMax * 1.12 && bankEnd < 0.03 && lost < 60 && !r.p.stalled,
        `${s.label}: a turn of ${turn} degrees rolls out on the heading (${f2(err)} deg off after 120 s), the bank never past ${f1(deg(bank))} of ${f1(deg(C.bankMax))} deg, wings level at the end (${f2(deg(bankEnd))} deg), ${f1(lost)} m of height moved`);
    }

    // Speed: the lever finds a speed and holds it.
    {
      const aim = s.casKt + s.speedStep;
      let y0 = 0;
      const r = fly(s, 200, { alt: true, hdg: true, spd: true }, (ap) => { ap.spd = aim * KT; y0 = ap.alt; });
      const tail = r.rows.filter((x) => x.t >= 150);
      const err = Math.max(...tail.map((x) => Math.abs(x.cas - aim)));
      const heightErr = Math.max(...r.rows.map((x) => Math.abs(x.y - y0)));
      const over = s.speedStep > 0 ? Math.max(...r.rows.map((x) => x.cas)) - aim : aim - Math.min(...r.rows.map((x) => x.cas));
      check(err < 1 && over < 3 && heightErr < 12 && !r.p.stalled, `${s.label}: ${s.casKt} to ${aim} kt calibrated is held inside ${f1(err)} kt after 150 s (${f1(over)} kt of overshoot on the way), the altitude kept inside ${f1(heightErr)} m throughout`);
    }

    // Each hold on its own: the others are the pilot's.
    {
      let y0 = 0, h0 = 0;
      const r = fly(s, 60, { alt: true, hdg: false, spd: false }, (ap) => { y0 = ap.alt; }, (t, p, ap, inp) => { inp.roll = 0; });
      const dy = Math.max(...r.rows.map((x) => Math.abs(x.y - y0)));
      check(dy < 8, `${s.label}: with only the altitude held it holds the altitude (${f1(dy)} m)`);
      const r2 = fly(s, 60, { alt: false, hdg: true, spd: false }, (ap) => { h0 = ap.hdg; });
      const dh = Math.max(...r2.rows.map((x) => Math.abs(deg(wrap(x.hdg - h0)))));
      check(dh < 2, `${s.label}: with only the heading held it holds the heading (${f2(dh)} deg)`);
    }

    // The target keys: held for two seconds each, they move the targets at the tuned rates.
    {
      let alt0 = 0, hdg0 = 0, spd0 = 0, alt1 = 0, hdg1 = 0, spd1 = 0;
      const r = fly(s, 4, { alt: true, hdg: true, spd: true }, () => {}, (t, p, ap, inp) => {
        if (t < DT / 2) { alt0 = ap.alt; hdg0 = ap.hdg; spd0 = ap.spd; }
        inp.apAlt = t < 2 ? 1 : 0; inp.apHdg = t < 2 ? 1 : 0; inp.apSpd = t < 2 ? 1 : 0;
        if (Math.abs(t - 2) < DT / 2) { alt1 = ap.alt; hdg1 = ap.hdg; spd1 = ap.spd; }
      });
      const okA = Math.abs(alt1 - alt0 - 2 * C.altRate) < 0.5, okH = Math.abs(wrap(hdg1 - hdg0) - 2 * C.hdgRate) < 0.01, okS = Math.abs(spd1 - spd0 - 2 * C.spdRate) < 0.2;
      check(okA && okH && okS, `${s.label}: held for two seconds the target keys move the altitude ${f1(alt1 - alt0)} m (${2 * C.altRate}), the heading ${f1(deg(wrap(hdg1 - hdg0)))} deg (${f1(deg(2 * C.hdgRate))}) and the speed ${f1((spd1 - spd0) / KT)} kt (${f1((2 * C.spdRate) / KT)})`);
    }

    // It lets go by itself: in a stall, on the ground, in a wreck. And says why.
    {
      const mk = () => {
        const { p, inp } = A.inAir(s.def, { h: s.h, casKt: s.casKt, payload: s.payload, throttle: s.throttle });
        const ap = new A.Autopilot(s.def), cmd = makeInput({ analog: false });
        H.run(p, inp, 2);
        ap.engage(p);
        return { p, inp, ap, cmd };
      };
      let m = mk(); m.p.stalled = true; m.ap.step(DT, m.p, m.inp, m.cmd);
      const stall = !m.ap.on && m.ap.why === 'stall';
      m = mk(); m.p.onGround = true; m.ap.step(DT, m.p, m.inp, m.cmd);
      const ground = !m.ap.on && m.ap.why === 'on the ground';
      m = mk(); m.p.crashed = true; m.ap.step(DT, m.p, m.inp, m.cmd);
      const wreck = !m.ap.on && m.ap.why === 'crash';
      // And while off, the pilot's own stick passes straight through.
      m = mk(); m.ap.disengage(); m.inp.pitch = 0.3; m.inp.roll = -0.2; m.ap.step(DT, m.p, m.inp, m.cmd);
      const pass = m.cmd.pitch === 0.3 && m.cmd.roll === -0.2;
      check(stall && ground && wreck && pass, `${s.label}: it lets go in a stall (${stall}), on the ground (${ground}) and in a wreck (${wreck}), and the stick passes straight through when it is off (${pass})`);
    }
  }

  // It runs on the physics clock: the same engagement at 120 Hz and at 60 Hz (the step is the
  // fixed one either way; the game calls it from the fixed loop) is a pure function of the state.
  {
    const s = SETUPS[1];
    const once = () => fly(s, 40, { alt: true, hdg: true, spd: true }, (ap) => { ap.alt += 100; ap.hdg += 0.3; ap.spd -= 5; }).p;
    const a = once(), b = once();
    check(a.x === b.x && a.y === b.y && a.z === b.z && a.qw === b.qw && a.fuel === b.fuel, 'the same autopilot flight twice is identical to the bit');
  }
}
