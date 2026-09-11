// The ghost car: your best lap, replayed as a translucent, flat-shaded copy of
// the car you set it in.
//
// Built by the same CarBuilder as every solid car, then re-skinned colour for
// colour with the ghost material. The car's own materials are shared with
// every solid car of the same paint, so they are swapped out here rather than
// made translucent -- fading the shared red would fade every red car on track.

import { buildCar } from '../game/CarBuilder.js';
import { ghost as ghostMaterial, setGhostOpacity } from './Materials.js';
import { GHOST, SUSPENSION, SIM } from '../data/tuning.js';

function toGhost(m) {
  const hex = m && m.color ? m.color.getHex() : 0xffffff;
  return ghostMaterial(hex, GHOST.opacity, GHOST.glow);
}

export class GhostCar {
  constructor(parent) {
    this.parent = parent;
    this.root = null;
    this.body = null;
    this.visible = false;
    this.pose = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 };
  }

  // lap: a GhostLap, or null for no ghost. chassis and appearance are the car
  // it was set in.
  set(lap, chassis = null, appearance = null) {
    this.clear();
    if (!lap || !chassis) return;
    const built = buildCar(chassis, appearance || {});
    // Its own tail lamp material is replaced below, so free it now.
    built.brakeLight.dispose();
    built.root.traverse((n) => {
      if (!n.isMesh) return;
      n.material = Array.isArray(n.material) ? n.material.map(toGhost) : toGhost(n.material);
      n.castShadow = false;
      n.receiveShadow = false;
    });
    // Wheels at rest on their springs: the ghost does not record suspension.
    const rest = chassis.suspensionRest ?? SUSPENSION.restLength;
    const sag = (chassis.mass * SIM.gravity) / 4 / SUSPENSION.springRate;
    for (const w of built.wheels) w.position.y = -(rest - sag) + chassis.wheelRadius;
    this.root = built.root;
    this.body = built.body;
    this.root.visible = false;
    this.parent.add(this.root);
  }

  // Place it `t` seconds into the ghost lap. `player` is the player's render
  // state: the closer the ghost is to it, the fainter it gets.
  update(lap, t, player) {
    if (!this.root) { this.visible = false; return; }
    const on = !!lap && lap.poseAt(t, this.pose);
    this.visible = on;
    this.root.visible = on;
    if (!on) return;
    const q = this.pose;
    this.root.position.set(q.x, q.y, q.z);
    this.root.rotation.set(0, q.yaw, 0);
    // Same signs as Vehicle: the model's pitch is nose up, roll is left down.
    this.body.rotation.set(-q.pitch, 0, -q.roll);
    const d = Math.hypot(q.x - player.x, q.z - player.z);
    const k = Math.min(1, Math.max(0, (d - 2) / Math.max(0.1, GHOST.fadeNear - 2)));
    setGhostOpacity(GHOST.closeOpacity + (GHOST.opacity - GHOST.closeOpacity) * k);
  }

  clear() {
    if (!this.root) return;
    this.parent.remove(this.root);
    // Materials are cached and shared by the ghost; only geometry is its own.
    this.root.traverse((n) => { if (n.geometry) n.geometry.dispose(); });
    this.root = null;
    this.body = null;
    this.visible = false;
  }
}
