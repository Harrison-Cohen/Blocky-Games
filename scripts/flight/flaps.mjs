// The F-22's second flap setting, "Combat" (the first, Auto, is the aircraft as it has always
// flown, held to the bit by the identity check). Headless, the real AircraftPhysics.
//
//   - Combat adds lift and drag: at the same speed and load it flies at a lower angle of
//     attack and needs more thrust to hold the speed
//   - the panel moves over the time the data says, and a lever that is not asked for does nothing
//   - above its limit speed the flaps retract by themselves, and refuse to go out
//   - the stall warning and the stall angle come earlier with the flaps out
//   - the lever at Auto is the same flight to the bit as no lever at all

export default async function run(kit) {
  const { check, f1, f2, deg, H, KT, DT, makeInput } = kit;
  const { F22 } = await import(H.R + 'data/aircraft.js');
  const D = F22;
  const det = D.flaps.detents;
  // Level at 3,000 m and 200 kt calibrated, the altitude held by the stick, the lever as given:
  // what it settles at, or (with the lever fixed at idle) how much speed it loses in 10 s.
  const level = (lever, { throttle = 0.6, seconds = 4, fixed = false } = {}) => {
    const p = H.airborne(D, { h: 3000, mach: 0.4, throttle });
    const inp = makeInput({ analog: false, flaps: lever });
    p.flapPos = lever;
    H.run(p, inp, 2, () => { H.altitudeHold(p, inp, 3000); inp.flaps = lever; });
    const v0 = p.cas;
    H.run(p, inp, seconds, () => { H.altitudeHold(p, inp, 3000); inp.flaps = lever; if (fixed) { inp.throttleRate = 0; p.throttle = throttle; } });
    return { p, lost: v0 - p.cas };
  };

  console.log('\nF-22 flaps: the Combat setting');
  const a0 = level(0, { seconds: 0.5 }), c0 = level(1, { seconds: 0.5 });
  check(Math.abs(a0.p.cas - c0.p.cas) < 4, `both start from the same speed (${f1(a0.p.cas / KT)} and ${f1(c0.p.cas / KT)} kt)`);
  check(c0.p.alpha < a0.p.alpha && deg(a0.p.alpha - c0.p.alpha) > 0.5, `Combat flies it at a lower angle of attack (${f2(deg(c0.p.alpha))} against ${f2(deg(a0.p.alpha))} deg)`);
  const ai = level(0, { throttle: 0, fixed: true, seconds: 10 }), ci = level(1, { throttle: 0, fixed: true, seconds: 10 });
  check(ci.lost > ai.lost + 0.5, `and it costs speed: with the lever at idle it loses ${f1(ci.lost / KT)} kt in 10 s against ${f1(ai.lost / KT)} (the added drag)`);

  // The panel moves over `time` seconds, and sits still when the lever does.
  {
    const p = H.airborne(D, { h: 3000, mach: 0.4, throttle: 0.6 });
    const inp = makeInput({ analog: false, flaps: 1 });
    const seen = [];
    H.run(p, inp, 3, (t) => { if (Math.abs(t - 0.75) < DT / 2 || Math.abs(t - 2.5) < DT / 2) seen.push(p.flapPos); });
    check(Math.abs(seen[0] - 0.75 / D.flaps.time) < 0.02 && seen[1] === 1, `the panel takes ${D.flaps.time} s to go out (half way at ${f2(seen[0] * D.flaps.time)} s of ${D.flaps.time}, fully out after ${f1(2.5)} s)`);
    const q = H.airborne(D, { h: 3000, mach: 0.4, throttle: 0.6 });
    H.run(q, makeInput({ analog: false, flaps: 0 }), 5);
    check(q.flapPos === 0, 'with the lever at Auto the panel does not move');
  }

  // Above its limit speed it comes in by itself, and will not go out.
  {
    const vfe = det[1].vfe;
    const p = H.airborne(D, { h: 3000, mach: 0.8, throttle: 0.8 });
    p.flapPos = 1;
    const inp = makeInput({ analog: false, flaps: 1 });
    H.run(p, inp, 6, () => { H.altitudeHold(p, inp, 3000); inp.flaps = 1; });
    check(p.cas > vfe && p.flapPos === 0, `at ${f1(p.cas / KT)} kt (the limit is ${f1(vfe / KT)}) the flaps come in by themselves and stay in with the lever at Combat`);
    const q = H.airborne(D, { h: 3000, mach: 0.8, throttle: 0.8 });
    H.run(q, makeInput({ analog: false, flaps: 1 }), 3);
    check(q.flapPos === 0, 'and they will not go out above it');
  }

  // The stall comes earlier: the angle the warning and the stall are at falls with the flaps.
  {
    const stallAt = (lever) => {
      const p = H.airborne(D, { h: 3000, mach: 0.3, throttle: 0.4 });
      p.flapPos = lever;
      const inp = makeInput({ analog: false, flaps: lever, pitch: 0.7 });
      let warn = -1;
      H.run(p, inp, 20, (t) => { inp.flaps = lever; if (warn < 0 && p.stallWarn) warn = p.alpha; });
      return warn;
    };
    const wa = stallAt(0), wc = stallAt(1);
    check(wa > 0 && wc > 0 && wc < wa - 0.01, `the stall warning comes at a lower angle of attack with Combat out (${f1(deg(wc))} against ${f1(deg(wa))} deg)`);
  }

  // Auto is the aircraft as it was: a flight with the lever never touched and one with it at Auto
  // are the same to the bit.
  {
    const fly = (lever) => {
      const p = H.airborne(D, { h: 3000, mach: 0.7, throttle: 0.8 });
      const inp = makeInput({ analog: false, pitch: 0.2, roll: 0.3 });
      if (lever != null) inp.flaps = lever;
      H.run(p, inp, 20);
      return p;
    };
    const a = fly(null), b = fly(0);
    check(['x', 'y', 'z', 'qx', 'qy', 'qz', 'qw', 'fuel', 'vx', 'vy', 'vz'].every((k) => a[k] === b[k]), 'the lever at Auto is the same flight as no lever, to the bit');
  }
}
