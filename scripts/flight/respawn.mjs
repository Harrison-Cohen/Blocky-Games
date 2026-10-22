// Airport selection and pose generation use the same guards as the real respawn callback.
export default async function run({ check, H }) {
  const { World } = await import(H.R + 'world/World.js');
  const { FlightPlaces } = await import(H.R + 'core/FlightPlaces.js');
  const { F22, B737 } = await import(H.R + 'data/aircraft.js');
  const world = new World([]);
  console.log('\nRespawn destinations');
  for (const def of [F22, B737]) {
    const places = new FlightPlaces(world, def);
    check(places.respawnPose('missing-airport') === null, `${def.id}: unknown airport is rejected`);
    let valid = 0, rejected = 0, exact = true;
    for (const airport of places.list) {
      const pose = places.respawnPose(airport.id);
      if (!places.eligible(airport, 'hangar').ok) { rejected++; exact &&= pose === null; }
      else {
        valid++;
        const actual = { ...pose }, expected = world.airports.start(airport, 'hangar', {});
        exact &&= actual.x === expected.x && actual.y === expected.y && actual.z === expected.z && actual.heading === expected.heading && actual.mode === 'hangar' && actual.airport === airport;
      }
    }
    check(exact && valid > 0 && rejected > 0, `${def.id}: ${valid} compatible airports use the exact hangar pose, ${rejected} incompatible airports are rejected`);
    const near = places.nearestEligible(0, 0, 'hangar');
    check(near && places.respawnPose(near.id) !== null && near.length >= (def.ground.minRunway || 0), `${def.id}: nearest default passes runway eligibility`);
  }
}
