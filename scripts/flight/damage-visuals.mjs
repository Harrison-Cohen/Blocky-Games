// Cheap visibility and graphics budgets, with no browser or player dependency.
export default async function run({ check, H }) {
  const { F22, B737 } = await import(H.R + 'data/aircraft.js');
  const { Aircraft } = await import(H.R + 'flight/Aircraft.js');
  const { DamageEffects } = await import(H.R + 'render/DamageEffects.js');
  const { GRAPHICS_LEVELS, DAMAGE_FX } = await import(H.R + 'data/tuning.js');
  const THREE = await import('three');
  console.log('\nDamage visuals and budgets');
  for (const def of [F22, B737]) {
    const a = new Aircraft(def); a.physics.reset({ y: 1000, speed: 100, gear: 1 });
    a.physics.damage.set('wingL', 0); a.physics.damage.set('tail', 0); a.physics.damage.set('gear', 0);
    a.updateVisual(1, 0);
    check(a.built.damageGroups.wingL.length > 0 && a.built.damageGroups.wingL.every((o) => !o.visible) && a.built.damageGroups.wingR.every((o) => o.visible), `${def.id}: zero left wing hides its panels, right wing remains`);
    if (def === B737) check(a.physics.damage.get('engineL') === 0 && a.built.damageGroups.engineL.every(o=>!o.visible), '737: breaking a wing takes its attached engine with it');
    check(a.built.damageGroups.tail.every((o) => !o.visible) && a.parts.gear.every((g) => !g.group.visible), `${def.id}: zero tail and gear hide their mesh groups`);
    a.physics.damage.repair(); a.updateVisual(1, 0);
    check(a.built.damageGroups.wingL.every((o) => o.visible) && a.built.damageGroups.tail.every((o) => o.visible), `${def.id}: repair restores hidden geometry`);
    a.physics.damage.set('engineL', 0);
    if (def === B737) { a.updateVisual(1, 0); check(a.built.damageGroups.engineL.every((o) => !o.visible), '737: destroyed left nacelle disappears'); }
    a.physics.damage.set('engineR', 0.2);
    const scene = new THREE.Group(), effects = new DamageEffects(scene), origin = { ox: 0, oz: 0 };
    for (const level of GRAPHICS_LEVELS) {
      effects.clear();
      for (let i = 0; i < 300; i++) effects.update(1 / 60, a, origin, level.id);
      const pool = effects.pool;
      check(pool.alive > 0 && pool.alive <= level.damageParticles && pool.max === level.damageParticles && pool.alive <= DAMAGE_FX.capacity, `${def.id}: ${level.id} effects stay within ${level.damageParticles} particles`);
      check(pool.r.some((v, i) => i < pool.alive && v === Math.fround(DAMAGE_FX.fireColor[0])), `${def.id}: ${level.id} critical damage emits flame as well as smoke`);
    }
    const x = effects.pool.x[0]; origin.ox = 2000; effects.update(0, a, origin, 'ultra');
    check(Math.abs(effects.pool.x[0] + 2000 - x) < 0.001, `${def.id}: rebase preserves reconstructed particle position`);
    const age = effects.pool.age[0]; effects.update(0, a, origin, 'ultra');
    check(effects.pool.age[0] === age, `${def.id}: pause freezes particles`);
    effects.clear(); check(effects.pool.alive === 0 && !effects.pool.mesh.visible, `${def.id}: respawn clear removes all particles`);
    effects.dispose(); a.dispose();
  }
}
