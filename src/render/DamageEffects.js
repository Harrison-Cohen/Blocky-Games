// Visual-only pooled blocks, with coordinates corrected when WorldOrigin changes.
import { Particles } from './Particles.js';
import { DAMAGE_FX as F, FLIGHT_DAMAGE as D, GRAPHICS_LEVELS } from '../data/tuning.js';

export class DamageEffects {
  constructor(parent) {
    this.pool = new Particles(parent, F.capacity);
    this.pool.mesh.name = 'aircraft-damage-particles';
    this.ox = 0; this.oz = 0; this.cursor = 0; this.serial = 0; this.credit = 0;
  }
  clear() { this.pool.clear(); this.credit = 0; }
  dispose() { this.pool.dispose(); }

  update(dt, aircraft, origin, levelId) {
    const pool = this.pool, p = aircraft.physics, parts = p.damage.parts;
    const dx = origin.ox - this.ox, dz = origin.oz - this.oz;
    if (dx || dz) {
      for (let i = 0; i < pool.alive; i++) { pool.x[i] -= dx; pool.z[i] -= dz; }
      this.ox = origin.ox; this.oz = origin.oz;
    }
    const level = GRAPHICS_LEVELS.find((l) => l.id === levelId) || GRAPHICS_LEVELS[1];
    pool.max = Math.min(F.capacity, level.damageParticles);
    pool.alive = Math.min(pool.alive, pool.max);
    dt = Math.min(dt, F.maxDelta);
    let sources = 0;
    for (let i = 0; i < parts.length; i++) if (this._emits(parts[i], p.damage.health[i], aircraft.def)) sources++;
    if (dt > 0 && sources && pool.max > 0) {
      this.credit += dt * level.damageEmit;
      while (this.credit >= 1) {
        this.credit--;
        let index = this.cursor % parts.length;
        while (!this._emits(parts[index], p.damage.health[index], aircraft.def)) index = (index + 1) % parts.length;
        this.cursor = index + 1;
        const a = parts[index].anchor, r = p.r;
        const x = p.x + r[0] * a[0] + r[1] * a[1] + r[2] * a[2] - origin.ox;
        const y = p.y + r[3] * a[0] + r[4] * a[1] + r[5] * a[2];
        const z = p.z + r[6] * a[0] + r[7] * a[1] + r[8] * a[2] - origin.oz;
        const fire = p.damage.health[index] < D.fire && this.serial++ % F.flameEvery === 0;
        const c = fire ? F.fireColor : F.smokeColor;
        pool.emit(x, y, z, p.vx * F.inheritVelocity, p.vy * F.inheritVelocity + F.rise, p.vz * F.inheritVelocity,
          fire ? F.fireLife : F.smokeLife, fire ? F.fireSize : F.smokeSize, fire ? F.fireGrow : F.smokeGrow,
          c[0], c[1], c[2], 0, F.drag, -Infinity);
      }
    } else if (!sources) this.credit = 0;
    pool.update(dt);
  }

  _emits(part, health, def) {
    // A missing external part cannot leave a fire floating where it used to be.
    return health < D.smoke && (health > 0 || part.kind === 'fuselage' || (part.kind === 'engine' && def.model === 'f22'));
  }
}
