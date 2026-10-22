// Headless per-aircraft health. Construction allocates; fixed-step damage does not.
// No storage, player, renderer or random dependencies, so future AI uses the same state.
import { FLIGHT_DAMAGE as D } from '../data/tuning.js';

const valid = (v) => typeof v === 'number' && Number.isFinite(v);
const clamp = (v) => Math.max(0, Math.min(1, v));

export class Damage {
  constructor(def) {
    this.parts = def.damage;
    this.indices = Object.fromEntries(this.parts.map((p, i) => [p.id, i]));
    this.health = new Float64Array(this.parts.length).fill(1);
    this.surfacePart = new Int16Array(def.surfaces.length).fill(-1);
    this.enginePart = new Int16Array(def.engines.length).fill(-1);
    this.hullPart = new Int16Array(def.gear.hull.length).fill(-1);
    this.contactOn = new Uint8Array(def.gear.hull.length);
    this.revision = 0;
    this.gear = this.index('gear');
    this.tail = this.index('tail');
    this.fuselage = this.index('fuselage');
    for (let i = 0; i < this.parts.length; i++) {
      const part = this.parts[i];
      for (const j of part.surfaces || []) this.surfacePart[j] = i;
      for (const j of part.engines || []) this.enginePart[j] = i;
      for (let j = 0; j < def.gear.hull.length; j++) {
        if (part.hull.includes(def.gear.hull[j].name)) this.hullPart[j] = i;
      }
    }
    this.wheelsOn = false;
  }

  index(id) { return Object.hasOwn(this.indices, id) ? this.indices[id] : -1; }
  get(id) { return this.health[this.index(id)]; }
  set(id, value) {
    const i = this.index(id);
    if (i < 0 || !valid(value)) return false;
    this._set(i, clamp(value));
    return true;
  }
  _set(i, value) {
    if (i >= 0 && this.health[i] !== value) {
      this.health[i] = value; this.revision++;
      if (value === 0) this._breakChildren(i);
    }
  }
  _breakChildren(i) {
    const children = this.parts[i].breaks;
    if (children) for (let j = 0; j < children.length; j++) this._set(this.index(children[j]), 0);
  }
  lose(i, amount) { if (i >= 0 && amount > 0) this._set(i, Math.max(0, this.health[i] - amount)); }
  repair() { for (let i = 0; i < this.health.length; i++) this._set(i, 1); }
  load(record) {
    for (let i = 0; i < this.parts.length; i++) {
      const p = this.parts[i];
      const v = record && (Object.hasOwn(record, p.id) ? record[p.id] : p.legacy ? record[p.legacy] : undefined);
      this._set(i, valid(v) ? clamp(v) : 1);
    }
    for (let i = 0; i < this.parts.length; i++) if (this.health[i] === 0) this._breakChildren(i);
  }
  record() {
    const out = {};
    for (let i = 0; i < this.parts.length; i++) out[this.parts[i].id] = this.health[i];
    return out;
  }
  resetContacts() { this.contactOn.fill(0); this.wheelsOn = false; }

  // Preserve today's aircraft-specific destroyed boundaries exactly.
  crashReason(gear, F) {
    if (this.health[this.fuselage] === 0) return 'lost its fuselage';
    if (gear.hullImpact > F.crashSpeed) return 'hit the ground';
    if (gear.touchdownSink > F.maxSink) return 'landed too hard';
    if (gear.hullHit > F.hullCrashDepth) return 'hit the ground';
    if (gear.skidImpact > F.skidCrashSpeed || gear.skidHit > F.skidCrashDepth) return 'struck its tail on the ground';
    return '';
  }

  contacts(dt, gear, F) {
    if (gear.onGround && !this.wheelsOn) {
      this.lose(this.gear, Math.max(0, gear.touchdownSink - F.maxSink * D.landingOnset) * D.landingDamage * gear.touchdownSeverity);
    }
    this.wheelsOn = gear.onGround;
    for (let i = 0; i < this.contactOn.length; i++) {
      const active = gear.hullDepth[i] > 0;
      const part = this.hullPart[i];
      // A tail skid protects the tail assembly in a shallow, low-closing-speed scrape.
      const protectedSkid = gear.hull[i].skid && gear.hullDepth[i] <= F.skidCrashDepth * D.skidProtection && gear.hullClosing[i] <= F.skidCrashSpeed * D.landingOnset;
      if (active && !protectedSkid) {
        const severity = gear.hullSeverity[i];
        if (!this.contactOn[i]) this.lose(part, Math.max(0, gear.hullClosing[i] - D.strikeOnset) * D.strikeDamage * severity);
        if (gear.hullSliding[i] > D.scrapeMinSpeed) this.lose(part, gear.hullSliding[i] * D.scrapeRate * severity * dt);
      }
      this.contactOn[i] = active ? 1 : 0;
    }
  }

  limits(dt, p, gearBefore) {
    const limits = p.def.damageLimits;
    if (limits && p.gearDown > 0) {
      const moving = p.gearDown !== gearBefore;
      const limit = moving ? (p.gearDown > gearBefore ? limits.gearExtend : limits.gearRetract) : limits.gearDown;
      const excess = Math.max(p.cas / limit, p.mach / limits.gearMach) - D.overspeedMargin;
      this.lose(this.gear, Math.max(0, excess) * D.overspeedRate * dt);
    }
    // Fighter combat flaps automatically retract; do not introduce fighter envelope changes.
    if (!p.flapAutoRetract && p.flapPos > 0) {
      const detent = Math.ceil(p.flapPos);
      const excess = p.cas / p.flapVfeD[detent] - D.overspeedMargin;
      for (let i = 0; i < this.parts.length; i++) if (this.parts[i].kind === 'wing') {
        this.lose(i, Math.max(0, excess) * D.overspeedRate * dt);
      }
    }
  }
}
