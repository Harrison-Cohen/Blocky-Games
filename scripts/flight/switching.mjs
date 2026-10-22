// Flying more than one aircraft, headless: what each one keeps in the Hangar, where it is
// put when it is chosen, what its card says against what the physics does, and the 737's
// mesh under every livery.
//
//   - the registry: every aircraft has a Hangar list, a livery list, a mesh, an air start
//   - paint is per aircraft: a pattern that is the F-22's means nothing on the 737
//   - four records under four keys for each aircraft, a bad one costs only itself, saving one
//     aircraft never writes another's keys
//   - the card's mass is the physics' mass
//   - an airport that cannot take the aircraft is never chosen, and the nearest that can is
//   - the 737 builds under every livery, wears the paint it was given, keeps every moving
//     part, and the parts move with the aircraft

export default async function run(kit) {
  const { check, f2, H, DT, makeInput, AircraftPhysics } = kit;
  const L = await import(H.R + 'data/loadouts.js');
  const Store = await import(H.R + 'core/HangarStore.js');
  const { AIRCRAFT, F22, B737 } = await import(H.R + 'data/aircraft.js');
  const { Aircraft } = await import(H.R + 'flight/Aircraft.js');
  const { buildB737 } = await import(H.R + 'render/aircraft/b737.js');
  const { FlightPlaces } = await import(H.R + 'core/FlightPlaces.js');
  const { World } = await import(H.R + 'world/World.js');
  const { HANGAR } = await import(H.R + 'data/tuning.js');
  const T = await import('../lib/track-hash.mjs');

  console.log('\nSwitching aircraft');

  // --- the registry --------------------------------------------------------------------------
  {
    let ok = true;
    const why = [];
    const ids = new Set();
    for (const d of AIRCRAFT) {
      if (ids.has(d.id)) { ok = false; why.push(`${d.id} twice`); }
      ids.add(d.id);
      const o = L.HANGAR_OPTIONS[d.id], v = L.LIVERY_OPTIONS[d.id];
      if (!o || !v) { ok = false; why.push(`${d.id}: no Hangar or livery list`); continue; }
      const dl = L.defaultLoadout(d.id);
      if (L.payloadMass(d, dl) !== d.payload) { ok = false; why.push(`${d.id}: the default load is ${L.payloadMass(d, dl)} kg, not ${d.payload}`); }
      if (!L.isStockTune(d.id, L.defaultTune(d.id))) { ok = false; why.push(`${d.id}: the default tuning is not stock`); }
      if (JSON.stringify(L.normalizeLivery(null, d.id)) !== JSON.stringify(L.defaultLivery(d.id))) { ok = false; why.push(`${d.id}: no livery normalises to its default`); }
      if (!['delta', 'airliner', 'rotor'].includes(d.mapIcon)) { ok = false; why.push(`${d.id}: map icon ${d.mapIcon}`); }
      if (!d.airStart || !(d.airStart.speed > 0) || d.airStart.flaps == null) { ok = false; why.push(`${d.id}: no air start`); }
      if (!['fighter', 'airliner', 'helicopter'].includes(d.role)) { ok = false; why.push(`${d.id}: role ${d.role}`); }
      const a = new Aircraft(d, L.defaultLivery(d.id));
      if (!a.root || !a.parts || a.root.children.length === 0) { ok = false; why.push(`${d.id}: no mesh`); }
      a.dispose();
    }
    check(ok && AIRCRAFT.length >= 2, `all ${AIRCRAFT.length} aircraft (${AIRCRAFT.map((d) => d.id).join(', ')}) have a Hangar list, a livery list, a mesh and an air start, and their default load, tuning and paint are the ones they were fitted with${why.length ? ': ' + why.join('; ') : ''}`);
  }

  // --- paint is per aircraft -----------------------------------------------------------------
  {
    const f = L.normalizeLivery({ pattern: 'cheatline', insignia: 'ring', body: 'sky' }, 'f22');
    const b = L.normalizeLivery({ pattern: 'split', insignia: 'roundel', body: 'sky' }, 'b737');
    const own = L.normalizeLivery({ pattern: 'belly', insignia: 'star', accent: 'ember', number: 12 }, 'b737');
    check(f.pattern === 'plain' && f.insignia === 'none' && f.body === 'sky' && b.pattern === L.defaultLivery('b737').pattern && b.insignia === L.defaultLivery('b737').insignia && b.body === 'sky' &&
      own.pattern === 'belly' && own.insignia === 'star' && own.accent === 'ember' && own.number === 12,
      `a pattern or an insignia that belongs to the other aircraft falls back to this one's default (the F-22's cheat line is ${f.pattern}, the 737's split is ${b.pattern}), the colours that are shared are kept, its own are kept`);
    check(L.normalizeLivery(undefined).pattern === 'plain' && L.defaultLivery('f22').body === 'stock' && L.defaultLivery('b737').body === 'stock',
      'with no aircraft named the F-22\'s lists are used, as they always were; the stock body colour is each aircraft\'s own');
  }

  // --- storage -------------------------------------------------------------------------------
  {
    const store = new Map();
    globalThis.window = { localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => { store.set(k, String(v)); }, removeItem: (k) => { store.delete(k); } } };
    const fs = L.normalizeSetup('f22', { livery: { body: 'ember', pattern: 'tips', number: 7 }, loadout: { medium: 4 }, tune: { power: 1.1 }, damage: { wings: 0.5 } });
    const bs = L.normalizeSetup('b737', { livery: { body: 'teal', accent: 'acid', pattern: 'belly', insignia: 'wave', number: 737 }, loadout: { passengers: 80, cargo: 1000 }, tune: { power: 0.9 }, damage: { engines: 0.4 } });
    Store.saveSetup('f22', fs);
    const afterF = JSON.stringify([...store]);
    Store.saveSetup('b737', bs);
    const keys = [...store.keys()].map((k) => k.replace('racing-game.v1.', '')).sort();
    const want = [...Store.PARTS.map((p) => `flight.${p}.f22`), ...Store.PARTS.map((p) => `flight.${p}.b737`)].sort();
    check(JSON.stringify(keys) === JSON.stringify(want), `two aircraft, eight records, one per key: ${keys.join(', ')}`);
    check(JSON.stringify([...store].filter(([k]) => k.endsWith('.f22'))) === JSON.stringify(JSON.parse(afterF).filter(([k]) => k.endsWith('.f22'))), 'saving the 737 wrote nothing to the F-22\'s records');
    check(JSON.stringify(Store.loadSetup('f22')) === JSON.stringify(fs) && JSON.stringify(Store.loadSetup('b737')) === JSON.stringify(bs), 'and each reads back as it was saved');
    const before = JSON.stringify(Store.loadSetup('f22'));
    store.set('racing-game.v1.flight.livery.b737', '{not json');
    store.set('racing-game.v1.flight.loadout.b737', JSON.stringify({ passengers: 9999, cargo: -5 }));
    const back = Store.loadSetup('b737');
    check(JSON.stringify(back.livery) === JSON.stringify(L.defaultLivery('b737')) && back.loadout.passengers === 162 && back.loadout.cargo === 0 && back.tune.power === 0.9 && back.damage.engineL === 0.4 && back.damage.engineR === 0.4 && JSON.stringify(Store.loadSetup('f22')) === before,
      'a corrupt livery record and an out of range loadout cost the 737 only themselves, its tuning and damage are kept, and the F-22 is untouched');
    store.clear();
    check(JSON.stringify(Store.loadSetup('b737')) === JSON.stringify(L.normalizeSetup('b737', {})) && Store.loadSetup('b737').loadout.passengers === 120 && Store.loadSetup('b737').loadout.cargo === 2500,
      'a 737 that was never saved is the 737 as fitted (120 passengers, 2,500 kg of cargo)');
    delete globalThis.window;
  }

  // --- the card's mass is the physics' mass --------------------------------------------------
  {
    let worst = 0;
    const rows = [];
    for (const d of [F22, B737]) {
      const loads = d === F22 ? [{}, { medium: 0, short: 0, rounds: 0, flares: 0 }] : [{}, { passengers: 0, cargo: 0 }, { passengers: 162, cargo: 8000 }];
      for (const part of loads) {
        const loadout = L.normalizeLoadout(d.id, part);
        const payload = L.payloadMass(d, loadout);
        const card = d.emptyMass + payload + d.fuelCapacity * HANGAR.startFuel;
        const p = new AircraftPhysics(d);
        p.setup({ payload });
        p.reset({ x: 0, y: 1.75 + (d === B737 ? 1.8 : 0), z: 0, fuel: HANGAR.startFuel, gear: 1, throttle: 0 });
        p.step(DT, makeInput({ gearDown: true, brake: 1 }), H.field);
        worst = Math.max(worst, Math.abs(p.mass - card));
        if (rows.length < 5) rows.push(`${d.id} ${Math.round(card)} kg`);
      }
    }
    check(worst < 0.5, `the mass on the Hangar's card is the mass the physics flies at, for the default, an empty and a full load (${rows.join(', ')}; the worst difference ${worst.toFixed(3)} kg)`);
    // The card warns above the maximum takeoff mass and above the maximum zero fuel mass.
    const full = L.payloadMass(B737, L.normalizeLoadout('b737', { passengers: 162, cargo: 8000 }));
    const zfm = B737.emptyMass + full, fitted = B737.emptyMass + B737.payload;
    check(zfm > B737.maxZeroFuelMass && fitted < B737.maxZeroFuelMass && B737.emptyMass + full + B737.fuelCapacity > B737.maxTakeoffMass,
      `a full cabin and hold is over the maximum zero fuel mass (${Math.round(zfm)} against ${B737.maxZeroFuelMass} kg: the card says so), and the aircraft as fitted is under it (${Math.round(fitted)} kg)`);
  }

  // --- where an aircraft is put --------------------------------------------------------------
  {
    const world = new World(await T.loadTrackData());
    const AP = world.airports;
    const ok = (def, ap, mode = 'apron') => new FlightPlaces(world, def).eligible(ap, mode).ok;
    let allOk = true, nearer = 0, none = 0, moved = 0;
    for (const def of [F22, B737]) {
      const places = new FlightPlaces(world, def);
      for (const ap of AP.list) {
        const pick = places.nearestEligible(ap.px, ap.pz);
        if (!pick) { none++; allOk = false; continue; }
        if (!places.eligible(pick, 'apron').ok) allOk = false;
        let best = Infinity;
        for (const o of AP.list) if (places.eligible(o, 'apron').ok) best = Math.min(best, Math.hypot(o.px - ap.px, o.pz - ap.pz));
        if (Math.abs(Math.hypot(pick.px - ap.px, pick.pz - ap.pz) - best) > 1e-6) { allOk = false; nearer++; }
        if (!places.eligible(ap, 'apron').ok) { moved++; if (pick === ap) allOk = false; }
      }
    }
    check(allOk, `from any airport, the nearest one that can take the aircraft is found, and it can (${moved} starts at a place that cannot take it are moved, none to a place that cannot, ${nearer} not the nearest, ${none} with nowhere)`);
    const strips = AP.list.filter((a) => !a.isHeliport && a.length < 1500);
    const p737 = new FlightPlaces(world, B737);
    const away = strips.map((s) => p737.nearestEligible(s.px, s.pz));
    check(strips.length > 0 && away.every((a) => a && a.length >= 1500 && !a.isHeliport) && ok(F22, strips[0]) && !ok(B737, strips[0]),
      `a 737 sent from an airstrip goes to a runway of 1,500 m or more (${strips.length} strips tried), where the F-22 would have stayed`);
    const nothing = new FlightPlaces(world, { ...B737, ground: { ...B737.ground, minRunway: 1e6 } });
    check(nothing.nearestEligible(0, 0) === null, 'and where no airport can take it, there is no answer rather than a wrong one');
  }

  // --- the 737's mesh ------------------------------------------------------------------------
  {
    const colours = (root) => { const s = new Set(); root.traverse((o) => { if (o.isMesh && o.material && o.material.color) s.add(o.material.color.getHex()); }); return s; };
    const V = L.LIVERY_OPTIONS.b737;
    const SKY = 0x38a9e8, ACID = 0xf5c518;
    let built = 0, bad = '';
    const t0 = performance.now();
    for (const pat of V.patterns) for (const ins of V.insignia) for (const number of [null, 0, 7, 4012]) {
      const b = buildB737(B737, { body: 'sky', accent: 'acid', pattern: pat.id, insignia: ins.id, number });
      const c = colours(b.root);
      const marked = pat.id !== 'plain' || ins.id !== 'none' || number != null;
      const P = b.parts;
      if (b.body.children[0].material.color.getHex() !== SKY || !c.has(SKY)) bad = `${pat.id}/${ins.id}/${number}: the fuselage is not the body colour`;
      else if (marked !== c.has(ACID)) bad = `${pat.id}/${ins.id}/${number}: the accent is ${c.has(ACID) ? 'there' : 'missing'}`;
      else if (P.gear.length !== B737.gear.wheels.length || P.flapPanels.length !== 4 || P.slatPanels.length !== 4 || P.spoilerPanels.length !== 8 || P.ailerons.length !== 2 || P.elevators.length !== 2 || P.fans.length !== 2 || !P.rudder) bad = `${pat.id}/${ins.id}/${number}: a moving part is missing`;
      b.dispose();
      built++;
      if (bad) break;
    }
    const ms = (performance.now() - t0) / built;
    check(!bad && built === V.patterns.length * V.insignia.length * 4, `all ${built} combinations of pattern, insignia and tail number build for the 737 (${ms.toFixed(0)} ms each), wear the paint they were given (the fuselage is the body colour, the accent only when something uses it), and keep every moving part${bad ? ': ' + bad : ''}`);

    // The stock paint is its own white, and the default livery has an airline's stripes.
    const stock = colours(buildB737(B737, null).root);
    check(stock.has(0xe9ecef) && stock.has(SKY) && !stock.has(0x6e7782), 'the default 737 is white with the sky blue stripes, not the F-22\'s grey');

    // The parts move: flaps, spoilers, gear, the fan.
    const a = new Aircraft(B737, null);
    const rot = (g) => g.group.quaternion.clone();
    const drive = (over) => { const s = a.physics.interpolate(1, a.render); Object.assign(s, over); a.built.update(s, a.physics, 0.1); };
    a.physics.reset({ x: 0, y: 500, z: 0, speed: 100, fuel: 0.5, gear: 1, throttle: 0.5 });
    a.physics.step(DT, makeInput({ gearDown: true }), H.field);
    drive({ flaps: 0, airbrake: 0, gear: 1 });
    const f0 = a.parts.flapPanels.map(rot), s0 = a.parts.spoilerPanels.map(rot), z0 = a.parts.flapPanels.map((p) => p.group.position.z);
    drive({ flaps: 3, airbrake: 1, gear: 1 });
    const flapsMoved = a.parts.flapPanels.every((p, i) => p.group.quaternion.angleTo(f0[i]) > 0.3 && p.group.position.z < z0[i] - 0.3);
    const spoilersMoved = a.parts.spoilerPanels.every((p, i) => p.group.quaternion.angleTo(s0[i]) > 0.5);
    drive({ flaps: 3, airbrake: 0, gear: 0 });
    const gearAway = a.parts.gear.every((g) => !g.group.visible);
    drive({ gear: 1 });
    const gearOut = a.parts.gear.every((g) => g.group.visible);
    const spin0 = a.parts.fans[0].rotation.z;
    drive({ spool: 0.8 });
    const fanTurns = Math.abs(a.parts.fans[0].rotation.z - spin0) > 0.1;
    check(flapsMoved && spoilersMoved && gearAway && gearOut && fanTurns,
      `the 737's flaps slide aft and turn down (${flapsMoved}), its spoilers rise (${spoilersMoved}), the gear goes into the body and comes out (${gearAway}, ${gearOut}) and the fans turn (${fanTurns})`);
    // The flaps follow the detents: 5, 15, 30 are each further down than the last.
    const angle = (flaps) => { drive({ flaps, airbrake: 0, gear: 1 }); return a.parts.flapPanels[0].group.quaternion.angleTo(f0[0]); };
    const up = angle(0), d5 = angle(1), d15 = angle(2), d30 = angle(3);
    check(up < 0.01 && d5 > up && d15 > d5 && d30 > d15, `the flap panels turn further at each detent (up ${f2(up)}, 5: ${f2(d5)}, 15: ${f2(d15)}, 30: ${f2(d30)} rad)`);
    a.dispose();
  }
}
