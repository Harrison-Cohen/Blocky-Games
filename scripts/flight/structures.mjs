// Analytic airport solids and swept contacts, independent of renderer/player/origin.
export default async function run({ check, H, DT, makeInput, AircraftPhysics }) {
  const { AirportCollisions, createStructureHit } = await import(H.R + 'world/AirportCollisions.js');
  const { structureBoxes } = await import(H.R + 'world/AirportStructures.js');
  const { F22 } = await import(H.R + 'data/aircraft.js');
  console.log('\nAirport buildings: swept contacts');
  const terminal = { kind: 'terminal', u: 0, v: 0, w: 10, d: 10, h: 10 };
  const hangar = { ...terminal, kind: 'hangar' };
  const identity = new Float64Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);
  const airport = (shape, heading = 0) => ({ x: 0, z: 0, base: 0, px: 0, pz: 0, radius: 100,
    sin: Math.sin(heading), cos: Math.cos(heading), layout: { structures: [shape] } });
  const pointBody = (ap, from, to, radius = 0.1) => {
    const world = (u, v) => [v * ap.cos - u * ap.sin, u * ap.cos + v * ap.sin];
    const a = world(from[0], from[1]), b = world(to[0], to[1]);
    return { prevX: a[0], prevY: from[2], prevZ: a[1], x: b[0], y: to[2], z: b[1],
      r: identity, prevR: identity, def: { length: 20 }, gearDown: 1,
      damage: { health: [1] }, structureVolumes: [{ x: 0, y: 0, z: 0, radius, part: 0 }] };
  };
  for (const heading of [0, 0.7, 2.4]) {
    const ap = airport(terminal, heading), collision = new AirportCollisions({ list: [ap] });
    const hit = collision.sweep(pointBody(ap, [-20, 0, 5], [20, 0, 5]), DT, createStructureHit());
    check(hit.hit && hit.t > 0 && hit.t < 1 && hit.closing > 100, `heading ${heading}: high-speed crossing cannot tunnel through a terminal`);
    const camera=collision.cameraFraction(-20,5,0,20,5,0,1.5);
    const above=collision.cameraFraction(-20,30,0,20,30,0,1.5);
    check(camera>0 && camera<1 && above===1, `heading ${heading}: camera stops before a building, clear sky remains unchanged`);
    const roof = collision.sweep(pointBody(ap, [0, 0, 20], [0, 0, 3]), DT, createStructureHit());
    check(roof.hit && roof.ny > 0, `heading ${heading}: roof contact has an upward normal`);
    const miss = collision.sweep(pointBody(ap, [-20, 20, 5], [20, 20, 5]), DT, createStructureHit());
    check(!miss.hit, `heading ${heading}: passing beside the building stays clear`);
  }
  {
    const ap = airport(hangar), collision = new AirportCollisions({ list: [ap] });
    const open = collision.sweep(pointBody(ap, [0, -10, 3], [0, 0, 3]), DT, createStructureHit());
    const wall = collision.sweep(pointBody(ap, [4.8, -10, 3], [4.8, 0, 3]), DT, createStructureHit());
    const back = collision.sweep(pointBody(ap, [0, 0, 3], [0, 10, 3]), DT, createStructureHit());
    check(!open.hit && wall.hit && back.hit, 'hangar doorway is open, side jamb and back wall are solid');
    check(structureBoxes(hangar).every((b) => b.w > 0 && b.d > 0 && b.h > 0), 'shared visible/collision boxes have positive dimensions');
  }
  const ap = airport(terminal);
  const ground = Object.create(H.field); ground.collisions = new AirportCollisions({ list: [ap] });
  for (const speed of [3, 160, 700]) {
    const p = new AircraftPhysics(F22);
    p.reset({ x: 0, y: 1.75, z: -14, speed, gear: 1, throttle: 0 });
    let hit = false;
    const inp = makeInput({ gearDown: true });
    for (let i = 0; i < 600 && !hit; i++) { p.step(DT, inp, ground); hit = p.structureHit.hit; }
    check(hit && (speed === 3 ? !p.crashed && p.damage.get('fuselage') < 1 : p.crashed && p.crashReason === 'hit an airport building'), `${speed} m/s real aircraft: ${speed === 3 ? 'survives with local damage' : 'crashes with the building reason'}`);
    check(p.z < -5, `${speed} m/s: aircraft stops outside the building`);
    if (speed === 3) {
      const health = p.damage.get('fuselage');
      for (let i = 0; i < 120; i++) p.step(DT, inp, ground);
      check(p.damage.get('fuselage') === health, 'resting against a wall does not repeatedly charge impact damage');
    }
  }
  const { Loop } = await import(H.R + 'core/Loop.js');
  const runAt = (fps) => {
    const p = new AircraftPhysics(F22); p.reset({ y: 1.75, z: -14, speed: 3, gear: 1 });
    const input = makeInput({ gearDown: true }); let n = 0;
    const loop = new Loop({ step: () => { if(n < 480) { p.step(DT, input, ground); n++; } }, render: null });
    while(n < 480) loop.advance(1 / fps);
    return JSON.stringify([p.x,p.y,p.z,p.qx,p.qy,p.qz,p.qw,p.damage.record(),p.crashed]);
  };
  const reference = runAt(120);
  for(const fps of [30,60,144]) check(runAt(fps)===reference, `airport wall collision at ${fps} Hz matches the 120 Hz result to the bit`);

  // A point at the wing tip catches a narrow structure the fuselage misses.
  {
    const ap = airport({ ...terminal, u: 0, v: 6.5, w: 1, d: 1 });
    const collision = new AirportCollisions({ list: [ap] });
    const p = new AircraftPhysics(F22); p.reset({ x: 0, y: 3, z: -10, speed: 0 });
    p.snapshot(); p.z = 10;
    const hit = collision.sweep(p, DT, createStructureHit());
    check(hit.hit && p.damage.parts[hit.part].id === 'wingL', 'swept wing volume hits a thin structure when the fuselage misses');
  }
}
