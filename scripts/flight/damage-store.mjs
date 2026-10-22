// Damage records are isolated per aircraft and from paint/load/tuning.
export default async function run({ check, H, DT, makeInput, AircraftPhysics }) {
  const L = await import(H.R + 'data/loadouts.js');
  const Store = await import(H.R + 'core/HangarStore.js');
  const { F22, B737 } = await import(H.R + 'data/aircraft.js');
  console.log('\nDamage: persistence, migration and repair');
  const savedWindow = globalThis.window;
  const records = new Map();
  globalThis.window = { localStorage: {
    getItem: (k) => records.get(k) ?? null,
    setItem: (k, v) => records.set(k, v),
    removeItem: (k) => records.delete(k),
  } };
  try {
    for (const def of [F22, B737]) {
      const health = L.normalizeDamage(def.id, { wings: 0.4, wingL: 0.7, engines: 0.6, engineR: 0.2, tail: -1, gear: 8 });
      check(health.wingL === 0.7 && health.wingR === 0.4 && health.engineL === 0.6 && health.engineR === 0.2 && health.tail === 0 && health.gear === 1 && health.fuselage === 1 && Object.keys(health).length === 7,
        `${def.id}: grouped legacy health migrates, explicit sides win, bad values clamp and missing parts default`);
      const bad = L.normalizeDamage(def.id, { wings: 0.4, wingL: 'bad', engineL: Infinity, engineR: null, fuselage: NaN });
      check(bad.wingL === 1 && bad.wingR === 0.4 && bad.engineL === 1 && bad.engineR === 1 && bad.fuselage === 1, `${def.id}: a corrupt child costs only itself`);
      const setup = L.normalizeSetup(def.id, { livery: { body: 'ember' }, damage: health });
      Store.saveSetup(def.id, setup);
      const p = new AircraftPhysics(def); p.setup({ damage: Store.loadSetup(def.id).damage });
      p.reset({ y: 3000, speed: 140 }); p.step(DT, makeInput(), H.field);
      check(p.damage.get('wingL') === 0.7 && p.engines[0].health === 0.6 && p.gear.health === 1, `${def.id}: reload and reset apply persisted health to physics`);
      const otherRecords = JSON.stringify([...records].filter(([k]) => !k.includes(`.damage.${def.id}`)));
      p.damage.repair(); Store.saveSetup(def.id, { damage: p.damage.record() }, ['damage']);
      const restored = Store.loadSetup(def.id);
      check(Object.values(restored.damage).every((h) => h === 1) && JSON.stringify([...records].filter(([k]) => !k.includes(`.damage.${def.id}`))) === otherRecords,
        `${def.id}: repair restores all seven parts and writes no paint, load, tune or other aircraft record`);
    }
    const other = JSON.stringify(Store.loadSetup('f22'));
    records.set('racing-game.v1.flight.damage.b737', '{invalid json');
    check(Object.values(Store.loadSetup('b737').damage).every((h) => h === 1) && JSON.stringify(Store.loadSetup('f22')) === other && Store.loadSetup('b737').livery.body === 'ember', 'a corrupt aircraft damage record costs only that record');
    window.localStorage.setItem = () => { throw new Error('quota'); };
    check(Store.saveSetup('b737', { damage: L.defaultDamage('b737') }, ['damage']) === false, 'storage failures return failure without throwing');
  } finally {
    if (savedWindow === undefined) delete globalThis.window; else globalThis.window = savedWindow;
  }
}
