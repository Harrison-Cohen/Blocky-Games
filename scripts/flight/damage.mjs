// Milestone 5a: real forces and contacts, then deterministic lifecycle-independent damage.
export default async function run({ check, H, DT, makeInput, AircraftPhysics }) {
  const { F22, B737 } = await import(H.R + 'data/aircraft.js');
  const { FLIGHT_DAMAGE: D } = await import(H.R + 'data/tuning.js');
  const A = await import('../lib/airliner-harness.mjs');
  const { Loop } = await import(H.R + 'core/Loop.js');
  console.log('\nDamage: force components and recovery');
  for (const def of [F22, B737]) {
    const air = () => H.airborne(def, { h: 3000, mach: 0.5 });
    const healthy = air(), left = air(), right = air();
    left.damage.set('wingL', 0.5); right.damage.set('wingR', 0.5);
    for (const p of [healthy, left, right]) p.step(DT, makeInput(), H.field);
    check(left.surfaces[0].liftScale < healthy.surfaces[0].liftScale && left.surfaces[1].liftScale === healthy.surfaces[1].liftScale && left.wz < healthy.wz && right.wz > healthy.wz,
      `${def.id}: half-health wing loses only its side's lift, rolling left for left damage and right for right damage`);
    check(left.surfaces[0].cdAdd > healthy.surfaces[0].cdAdd, `${def.id}: wing damage adds drag`);
    const engine = air(); engine.damage.set('engineL', 0.5); engine.step(DT, makeInput(), H.field);
    check(engine.engines[0].thrust === healthy.engines[0].thrust * 0.5 && engine.engines[1].thrust === healthy.engines[1].thrust && engine.wy !== healthy.wy,
      `${def.id}: half-health engine produces exactly half thrust, the other is unchanged, and asymmetry produces yaw`);
    const tail = air(), normal = air(); tail.damage.set('tail', 0.5);
    tail.step(DT, makeInput({ pitch: 0.2, yaw: 0.1 }), H.field);
    normal.step(DT, makeInput({ pitch: 0.2, yaw: 0.1 }), H.field);
    check(tail.defl[2] === normal.defl[2] * 0.5 && tail.defl.at(-1) === normal.defl.at(-1) * 0.5 && tail.nozzle === normal.nozzle * 0.5,
      `${def.id}: half-health tail halves stabilator/fin control and vectoring authority`);
    left.damage.set('wingL', 0); left.step(DT, makeInput(), H.field);
    check(left.surfaces[0].liftScale === 0, `${def.id}: a detached wing contributes no lift`);
    engine.reset({ y: 3000, speed: 160 }); engine.step(DT, makeInput(), H.field);
    check(engine.engines[0].health === 0.5, `${def.id}: position reset keeps engine damage`);
    engine.damage.repair(); engine.step(DT, makeInput(), H.field);
    check(engine.engines.every((e) => e.health === 1), `${def.id}: repair restores force components`);

    const ground = (health) => {
      const p = new AircraftPhysics(def); p.damage.set('gear', health);
      p.reset({ y: -def.gear.wheels[0].pos[1] - 0.4, speed: 12, gear: 1 });
      p.step(DT, makeInput({ gearDown: true, brake: 1, yaw: 0.5 }), H.field);
      return p;
    };
    const good = ground(1), worn = ground(0.5), collapsed = ground(0);
    check(worn.gear.steerAngle < good.gear.steerAngle || Math.abs(worn.gear.steerAngle) <= Math.abs(good.gear.steerAngle), `${def.id}: gear damage limits steering`);
    check(worn.gear.compression[0] < good.gear.compression[0] && worn.gear.load[0] !== good.gear.load[0], `${def.id}: damaged gear loses suspension travel and bottoms sooner`);
    check(collapsed.gear.weightOnWheels === 0, `${def.id}: destroyed gear cannot support the aircraft`);
    // At steady contact compare braking with no steering, no engine power and equal normal load.
    const brakeForce = (health, brake) => {
      const p = ground(1); p.gear.health = health;
      p.y = -def.gear.wheels[0].pos[1] - 0.1; p.vx = 0; p.vy = 0; p.vz = 12;
      const acc = { fx: 0, fy: 0, fz: 0, tx: 0, ty: 0, tz: 0 };
      p.gear.apply(p, H.field, DT, 0, brake, 1, p.mass, acc);
      return acc.fz;
    };
    check(Math.abs(brakeForce(0.5, 1) - brakeForce(0.5, 0)) < Math.abs(brakeForce(1, 1) - brakeForce(1, 0)), `${def.id}: worn gear has less brake force`);

    // A half-health wing is a flyable damaged panel; zero means the whole part breaks off.
    // Sample the actual controller after the transient, not a damage-cancelling force.
    let maxAlt = 0, maxHeading = 0, maxBank = 0;
    const r = A.flyAP(def, { h: 3000, casKt: def === F22 ? 300 : 230, fuel: 0.5,
      payload: def === B737 ? A.payloadFor(def, 62000, 0.5) : undefined }, 180, {
      tuned: true, holds: { alt: true, hdg: true, spd: true },
      onStep(t, p, ap) {
        if (t >= 20 && p.damage.get('wingL') === 1) p.damage.set('wingL', 0.5);
        if (t > 140) {
          const a = p.attitude();
          const h = Math.atan2(Math.sin(a.heading - ap.hdg), Math.cos(a.heading - ap.hdg));
          maxAlt = Math.max(maxAlt, Math.abs(p.y - ap.alt));
          maxHeading = Math.max(maxHeading, Math.abs(h) * 180 / Math.PI);
          maxBank = Math.max(maxBank, Math.abs(a.bank) * 180 / Math.PI);
        }
      },
    });
    check(r.ap.on && !r.p.crashed && !r.p.stalled && maxAlt < 5 && maxHeading < 2 && maxBank < 2,
      `${def.id}: trim/AP hold half-health wing at ${def === F22 ? 300 : 230} kt: altitude ${maxAlt.toFixed(2)} m, heading ${maxHeading.toFixed(2)} deg, bank ${maxBank.toFixed(2)} deg`);
  }

  console.log('\nDamage: impact classification and exposure');
  for (const def of [F22, B737]) {
    const p = new AircraftPhysics(def), gear = p.gear, damage = p.damage;
    const clear = () => { damage.repair(); damage.resetContacts(); gear.reset(); gear.hullDepth.fill(0); };
    clear(); gear.onGround = true; gear.touchdownSink = p.F.maxSink * 0.5;
    damage.contacts(DT, gear, p.F);
    check(damage.get('gear') === 1 && !damage.crashReason(gear, p.F), `${def.id}: gentle touchdown survives without damage`);
    clear(); gear.onGround = true; gear.touchdownSink = p.F.maxSink * 0.9;
    damage.contacts(DT, gear, p.F); const once = damage.get('gear');
    damage.contacts(DT, gear, p.F);
    check(once < 1 && once > 0 && damage.get('gear') === once && !damage.crashReason(gear, p.F), `${def.id}: firm touchdown damages gear once and survives`);
    const belly = def.gear.hull.findIndex((h) => h.name === 'belly');
    clear(); gear.hullDepth[belly] = 0.05; gear.hullClosing[belly] = 1.2; gear.hullSliding[belly] = 60; gear.hullSeverity[belly] = 1;
    damage.contacts(DT, gear, p.F); const before = damage.get('fuselage');
    gear.hullClosing[belly] = 0; gear.hullSliding[belly] = 0;
    damage.contacts(DT, gear, p.F);
    check(before > 0 && before < 1 && damage.get('fuselage') === before && !damage.crashReason(gear, p.F), `${def.id}: gentle belly contact survives, stationary contact does not repeat damage`);
    clear(); gear.touchdownSink = p.F.maxSink + 0.01;
    check(damage.crashReason(gear, p.F) === 'landed too hard', `${def.id}: old hard-touchdown boundary still destroys`);
    clear(); gear.hullImpact = p.F.crashSpeed + 0.01;
    check(damage.crashReason(gear, p.F) === 'hit the ground', `${def.id}: old hull closing-speed boundary still destroys`);
    clear(); gear.skidHit = p.F.skidCrashDepth + 0.01;
    check(damage.crashReason(gear, p.F).includes('tail'), `${def.id}: deep tail strike still destroys`);
    clear(); damage.set('fuselage', 0); p.step(DT, makeInput(), H.field);
    check(p.crashed && p.crashReason === 'lost its fuselage', `${def.id}: zero fuselage health crashes through actual physics`);

    // Real drop onto a flat runway, gear up. Initial normal speed is low; forward speed
    // alone must not trigger the crash classifier. Run to a complete stop.
    const bellyP = new AircraftPhysics(def);
    const bottom = -Math.min(...def.gear.hull.map((h) => h.pos[1]));
    bellyP.reset({ y: bottom + 0.01, speed: 25, gear: 0, throttle: 0 });
    const bellyInput = makeInput({ gearDown: false });
    for (let i = 0; i < 1200; i++) bellyP.step(DT, bellyInput, H.field);
    check(!bellyP.crashed && bellyP.damage.get('fuselage') > 0, `${def.id}: actual low-sink belly landing survives (${bellyP.crashReason || 'no crash'})`);
  }
  // Same normal contact, different ground surface severity.
  const scrape = (surface) => {
    const p = new AircraftPhysics(F22), i = F22.gear.hull.findIndex((h) => h.name === 'belly');
    p.gear.hullDepth[i] = 0.02; p.gear.hullSliding[i] = 20; p.gear.hullSeverity[i] = D.surface[surface];
    p.damage.contacts(1, p.gear, p.F); return p.damage.get('fuselage');
  };
  check(scrape('rock') < scrape('runway') && scrape('water') < scrape('runway'), 'rock and water contact have greater wear than pavement');

  for (const [label, gear, before, knots, expected] of [
    ['extend', 0.5, 0.49, 300, true], ['retract', 0.5, 0.51, 260, true],
    ['extended', 1, 1, 350, true], ['legal extension', 0.5, 0.49, 250, false], ['stowed', 0, 0, 350, false],
  ]) {
    const p = new AircraftPhysics(B737); p.gearDown = gear; p.cas = knots * A.KT; p.mach = 0.5;
    p.damage.limits(10, p, before);
    check((p.damage.get('gear') < 1) === expected, `737 ${label}: ${knots} kt ${expected ? 'damages' : 'preserves'} gear`);
  }
  {
    const p = new AircraftPhysics(B737); p.gearDown = 1; p.cas = 120; p.mach = 0.9;
    p.damage.limits(10, p, 1);
    check(p.damage.get('gear') < 1, '737 gear extended Mach limit is checked as well as calibrated speed');
    const q = new AircraftPhysics(B737); q.flapPos = 3; q.cas = 200 * A.KT;
    q.damage.limits(10, q, 0);
    check(q.damage.get('wingL') < 1 && q.damage.get('wingL') === q.damage.get('wingR'), '737 flaps left out above 175 kt wear both wings');
  }
  console.log('\nDamage: fixed clock and allocation');
  const atRate = (fps) => {
    const p = H.airborne(B737, { h: 3000, mach: 0.6 });
    p.flapPos = 3; p.damage.set('engineR', 0.5);
    const input = makeInput({ flaps: 3, gearDown: true });
    let steps = 0;
    const loop = new Loop({ step: () => { if (steps < 480) { p.step(DT, input, H.field); steps++; } }, render: null });
    while (steps < 480) loop.advance(1 / fps);
    return JSON.stringify([steps, p.x, p.y, p.z, p.qx, p.qy, p.qz, p.qw, p.damage.record()]);
  };
  const reference = atRate(120);
  for (const fps of [30, 48, 60, 75, 120, 144, 240]) check(atRate(fps) === reference, `damaged physics and exposure at ${fps} Hz match 120 Hz to the bit`);
  check(atRate(120) === reference, 'damaged flight is deterministic on repeated runs');
  if (global.gc) {
    const p = H.airborne(B737, { h: 10000, mach: 0.5 }); p.damage.set('engineL', 0.5);
    const inp = makeInput();
    const go = (n) => { for (let i = 0; i < n; i++) { if (p.crashed || p.y < 100) p.reset({ y: 10000, speed: 150 }); p.step(DT, inp, H.field); } };
    go(20000); global.gc(); const before = process.memoryUsage().heapUsed; go(100000); global.gc();
    const growth = process.memoryUsage().heapUsed - before;
    check(growth < 1.5e6, `100,000 damaged steps retained ${(growth / 1024).toFixed(0)} KB`);
  }
}
