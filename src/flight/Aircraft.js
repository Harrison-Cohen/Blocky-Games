// Binds an AircraftPhysics to an aircraft mesh.
//
// The split matters, as it does for the cars: physics runs on the fixed clock
// and knows nothing about Three.js; this runs at render time and only reads the
// interpolated state. The root takes the physics' position and quaternion
// directly -- same frame, no conversion -- and the moving parts follow.

import * as THREE from 'three';
import { AircraftPhysics, createRenderState } from './AircraftPhysics.js';
import { buildAircraft } from '../render/AircraftBuilder.js';
import { buildB737 } from '../render/aircraft/b737.js';
import { buildInterior } from '../render/aircraft/cockpits.js';
import { FLIGHT } from '../data/tuning.js';

// The mesh of each aircraft, by `def.model` (data/aircraft.js). The F-22's is the first, and
// the default.
const BUILDERS = { f22: buildAircraft, b737: buildB737 };
const build = (def, livery) => (BUILDERS[def.model] || buildAircraft)(def, livery);

export class Aircraft {
  // livery: the Hangar's paint, pattern, number and insignia (data/loadouts.js);
  // nothing, the aircraft as it has always looked.
  constructor(def, livery = null) {
    this.def = def;
    this.physics = new AircraftPhysics(def);
    this.render = createRenderState();
    const built = build(def, livery);
    this.root = built.root;
    this.built = built;
    this.parts = built.parts;
    this._dispose = built.dispose;
    this._flame = 0;
    // The inside of the cockpit, for the Cockpit camera (hidden otherwise), and the body on the
    // layer that view's second pass draws, so it is in front of the world at any distance.
    this.interior = buildInterior(def);
    if (this.interior) this.root.add(this.interior.group);
    this._bodyLayers();
  }

  _bodyLayers() {
    this.built.body.traverse((o) => o.layers.enable(1));
    this._cockpitShellLayers();
  }

  // A continuous exterior shell has no cockpit recess. Draw it in the world
  // pass, then the recessed interior in the overlay, so it cannot cover panels.
  _cockpitShellLayers() {
    if(this.built.cockpitShell)for(const o of this.built.cockpitShell){
      if(this.interior?.group.visible)o.layers.disable(1);else o.layers.enable(1);
    }
  }

  // Show the inside of the cockpit (the Cockpit camera) or not.
  setInterior(on) {
    if(!this.interior||this.interior.group.visible===on)return;
    this.interior.group.visible=on;this._cockpitShellLayers();
  }

  // Repaint: build the body again and put it in the same root, so everything that
  // holds the root (the shock wave, the camera, the scene) keeps holding it.
  setLivery(livery) {
    const next = build(this.def, livery);
    this.root.remove(this.built.body);
    this._dispose();
    this.built = next;
    this.parts = next.parts;
    this._dispose = next.dispose;
    this.root.add(next.body);
    this._bodyLayers();
  }

  // Place the mesh from the physics, `alpha` of the way between its last two
  // steps. ox and oz are the origin the scene is placed relative to (the
  // floating origin of milestone 2; zero for the test field).
  updateVisual(alpha, dt, ox = 0, oz = 0) {
    const s = this.physics.interpolate(alpha, this.render);
    this.root.position.set(s.x - ox, s.y, s.z - oz);
    this.root.quaternion.set(s.qx, s.qy, s.qz, s.qw);
    if (this.interior && this.interior.group.visible) this.interior.update(s, this.physics, dt);

    // An aircraft with its own animation moves its own parts (the 737); the F-22's are
    // moved below.
    if (this.built.update) { this.built.update(s, this.physics, dt); this._damageVisuals(s); return; }

    const p = this.parts;
    // The stabilators are the third and fourth surfaces: pull is trailing
    // edges up, so the turn is minus the deflection. A deflection is an
    // effective angle of attack; the panel turns about as far again as it reads.
    p.stabL.rotation.x = -s.surfaces[2] * 0.9;
    p.stabR.rotation.x = -s.surfaces[3] * 0.9;

    // The rudders turn their trailing edges toward the pedal; the right fin's
    // gain has the opposite sign, so its deflection is read the other way.
    p.rudders[0].group.quaternion.setFromAxisAngle(p.rudders[0].axis, s.surfaces[4] * 1.15);
    p.rudders[1].group.quaternion.setFromAxisAngle(p.rudders[1].axis, -s.surfaces[5] * 1.15);

    // The flaperons: the wing's deflection is lift up on that side when it is
    // positive, which is the trailing edge DOWN.
    for (const w of p.wingFlaps) {
      const d = s.surfaces[w.side === 1 ? 0 : 1];
      w.inboard.group.quaternion.setFromAxisAngle(w.inboard.axis, -d * 2.4);
      w.outboard.group.quaternion.setFromAxisAngle(w.outboard.axis, -d * 2.4);
    }

    // Nozzles tilt with the vectoring; the throat glows with the spool and the
    // burner flame grows with the burner.
    const ab = s.abLevel;
    const flick = 0.92 + 0.08 * Math.sin(performance.now() * 0.05);
    const heat = Math.max(0, Math.min(1, (s.spool - 0.05) / 0.95));
    for (let i = 0; i < p.nozzles.length; i++) {
      const n = p.nozzles[i];
      n.group.rotation.x = s.nozzle;
      n.hotMat.color.setRGB(0.12 + heat * 1.4 + ab * 0.4, 0.12 + heat * heat * 0.35 + ab * 0.3, 0.12 - heat * 0.08 + ab * 0.1);
      const on = ab > 0.03 && this.physics.engines[i].health > 0;
      n.flame.visible = on;
      n.core.visible = on;
      n.diamonds.visible = on;
      if (on) {
        // A flat plume: it lengthens with the burner, and flickers a little
        // wider and thinner as it goes.
        n.flame.scale.set(1, 1, (1.5 + ab * 5.5) * flick);
        n.core.scale.set(1, 1, (1 + ab * 3.2) * flick);
        n.diamonds.scale.set(1, 1, (0.9 + ab * 3.4) * flick);
      }
    }

    // Landing gear, folded into the body as it retracts (the first version lifted the legs straight up,
    // and a wheel showed on the outside of the intake before it vanished): a main leg swings inboard
    // through a quarter turn, which lays its wheel flat, while it slides toward the middle and up so it
    // ends inside the fuselage; the nose leg swings aft. A leg is only drawn while some of it is out.
    // The strut shortens as it compresses and the wheels turn.
    const g = s.gear, fold = 1 - g;
    const wheels = this.def.gear.wheels;
    for (let i = 0; i < p.gear.length; i++) {
      const part = p.gear[i];
      part.group.visible = fold < 0.995;
      if (!part.group.visible) continue;
      const comp = i < s.compression.length ? s.compression[i] : 0;
      const centreY = part.y0 + comp;
      const len = Math.max(0.1, part.belly - centreY);
      part.strut.scale.set(1, len, 1);
      part.strut.position.y = -len / 2;
      part.wheel.position.y = centreY - part.belly;
      part.wheel.rotation.x = this.physics.gear.spin[i] || 0;
      const w = wheels[i], grp = part.group;
      if (w.steer) {
        grp.rotation.set(fold * Math.PI / 2, s.steer * (1 - fold), 0);
        grp.position.y = part.belly + 0.35 * fold;
      } else {
        const side = Math.sign(w.pos[0]);
        grp.rotation.set(0, 0, -side * fold * Math.PI / 2);
        grp.position.x = w.pos[0] - side * 1.0 * fold;
        grp.position.y = part.belly + 0.3 * fold;
      }
    }
    this._damageVisuals(s);
  }

  _damageVisuals(s) {
    const damage = this.physics.damage;
    const groups = this.built.damageGroups;
    if (groups) for (const id of Object.keys(groups)) {
      for (const object of groups[id]) object.visible = damage.get(id) > 0;
    }
    for (const part of this.parts.gear) part.group.visible = damage.get('gear') > 0 && s.gear > 0.005;
  }

  dispose() {
    this._dispose();
    if (this.interior) this.interior.dispose();
  }
}
