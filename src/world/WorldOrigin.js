// The floating origin.
//
// The world is 120 km across and a float32 cannot draw that cleanly: at 50 km
// from zero it resolves a few millimetres, enough to make a runway shimmer and a
// wheel jitter against it. So physics stays in absolute double-precision
// coordinates, and everything DRAWN is placed relative to an origin that follows
// the camera.
//
// The origin sits on a lattice of `lattice` metres (1 km). While the camera is
// within `rebase` metres (2 km) of it, nothing moves. Past that the origin snaps
// to the lattice point nearest the camera and every registered object is shifted
// by the difference, so rendered coordinates stay under about 3 km, where a
// float32 resolves a quarter of a millimetre. A rebase is invisible: every object
// is moved by exactly the amount the origin moved, and the camera with them.
//
// Altitude is not rebased. Twenty kilometres up is fine in a float32.
//
// This class knows nothing about Three.js: an object is anything with a
// `position.set(x, y, z)`, and `updateMatrix()` is called on those that opt out
// of automatic matrices (a track's whole subtree is baked and not walked each
// frame). That is also what lets `npm run world` prove, in Node, that a rebase
// changes nothing.

import { OPEN_WORLD } from '../data/tuning.js';

export class WorldOrigin {
  constructor(cfg = OPEN_WORLD) {
    this.lattice = cfg.lattice;
    this.rebaseAt = cfg.rebase;
    this.ox = 0;
    this.oz = 0;
    this.items = new Set();
    this.rebases = 0;
  }

  // Place an object at an absolute position. The returned item is the handle:
  // `move` it when the object moves in the world, `remove` it when it goes.
  add(obj, x, y, z) {
    const item = { obj, x, y, z };
    this.items.add(item);
    this._place(item);
    return item;
  }

  remove(item) { this.items.delete(item); }

  move(item, x, y, z) {
    item.x = x; item.y = y; item.z = z;
    this._place(item);
  }

  _place(item) {
    const o = item.obj;
    o.position.set(item.x - this.ox, item.y, item.z - this.oz);
    // Things that are not recomputed every frame (a track's wrapper) are told.
    if (o.matrixAutoUpdate === false) {
      o.updateMatrix();
      o.matrixWorldNeedsUpdate = true;
    }
  }

  // An absolute position as it is drawn now. Writes into out.
  toLocal(x, z, out) {
    out.x = x - this.ox;
    out.z = z - this.oz;
    return out;
  }

  // The reverse: where a drawn position is in the world.
  toWorld(lx, lz, out) {
    out.x = lx + this.ox;
    out.z = lz + this.oz;
    return out;
  }

  // Call each frame with the camera's absolute position. Returns true when the
  // origin moved (so the caller can shift whatever it holds in drawn
  // coordinates: the camera, the sun's shadow box).
  update(camX, camZ) {
    if (Math.abs(camX - this.ox) <= this.rebaseAt && Math.abs(camZ - this.oz) <= this.rebaseAt) return false;
    const L = this.lattice;
    this.rebaseTo(Math.round(camX / L) * L, Math.round(camZ / L) * L);
    return true;
  }

  rebaseTo(ox, oz) {
    if (ox === this.ox && oz === this.oz) return;
    this.ox = ox;
    this.oz = oz;
    this.rebases++;
    for (const item of this.items) this._place(item);
  }
}
