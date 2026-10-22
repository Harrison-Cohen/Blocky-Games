// Hashes of what a track builds, to prove a refactor changed nothing.
//
//   gridHash(track, height)   the ground height over a grid around the track,
//                             inside its box and well outside it, as the exact
//                             bit pattern of every Float64
//   meshHash(trackMesh)       every geometry attribute, index, group and
//                             instance matrix, every material's look, and the
//                             order they were added to the scene
//
// FNV-1a, 32 bit. These are not security hashes, they are "is it the same
// number" hashes: a changed bit anywhere changes the result.

import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const SRC = fileURLToPath(new URL('../../src/', import.meta.url));

export async function loadTrackData() {
  const dir = SRC + 'data/tracks/';
  const out = [];
  for (const f of readdirSync(dir).sort()) {
    if (!f.endsWith('.js') || f === 'index.js') continue;
    const data = (await import(dir + f)).default;
    if (data && data.id) out.push(data);
  }
  return out;
}

const PRIME = 16777619;
export class Hasher {
  constructor() { this.h = 2166136261; }
  bytes(u8) {
    let h = this.h;
    for (let i = 0; i < u8.length; i++) { h ^= u8[i]; h = Math.imul(h, PRIME); }
    this.h = h >>> 0;
    return this;
  }
  array(a) { return this.bytes(new Uint8Array(a.buffer, a.byteOffset, a.byteLength)); }
  number(x) { return this.array(new Float64Array([x])); }
  string(s) { return this.bytes(Buffer.from(String(s))); }
  get hex() { return (this.h >>> 0).toString(16).padStart(8, '0'); }
}

// The ground over the track's box grown by `margin` on every side, sampled on a
// grid that does not line up with the 24 m query grid or the 16 m mesh grid.
export function gridHash(track, height, { step = 37, margin = 1400 } = {}) {
  const mm = track.minimap;
  const h = new Hasher();
  const row = [];
  for (let z = mm.minZ - margin; z <= mm.maxZ + margin; z += step) {
    for (let x = mm.minX - margin; x <= mm.maxX + margin; x += step) row.push(height(x, z));
  }
  h.array(new Float64Array(row));
  return { hash: h.hex, count: row.length };
}

function materialLook(m, h) {
  const mats = Array.isArray(m) ? m : [m];
  for (const mat of mats) {
    h.string(mat.type);
    h.number(mat.color ? mat.color.getHex() : -1);
    h.number(mat.emissive ? mat.emissive.getHex() : -1);
    h.number(mat.emissiveIntensity ?? -1);
    h.number(mat.polygonOffset ? mat.polygonOffsetFactor : 0);
    h.number(mat.fog ? 1 : 0);
    h.number(mat.flatShading ? 1 : 0);
    h.number(mat.side);
  }
}

export function meshHash(trackMesh) {
  const h = new Hasher();
  let meshes = 0, tris = 0;
  trackMesh.group.traverse((o) => {
    h.string(o.type);
    h.array(o.matrix.elements instanceof Float32Array ? o.matrix.elements : new Float64Array(o.matrix.elements));
    h.number(o.visible ? 1 : 0);
    h.number(o.castShadow ? 1 : 0);
    h.number(o.receiveShadow ? 1 : 0);
    if (!o.isMesh) return;
    meshes++;
    const g = o.geometry;
    for (const name of Object.keys(g.attributes).sort()) {
      h.string(name);
      h.array(g.attributes[name].array);
    }
    if (g.index) { h.array(g.index.array); tris += g.index.count / 3; }
    else tris += g.attributes.position.count / 3;
    for (const grp of g.groups) { h.number(grp.start); h.number(grp.count); h.number(grp.materialIndex); }
    if (o.isInstancedMesh) { h.number(o.count); h.array(o.instanceMatrix.array.subarray(0, o.count * 16)); }
    materialLook(o.material, h);
  });
  for (const l of trackMesh.lights) {
    h.array(new Float64Array([l.x, l.y, l.z, l.tx, l.ty, l.tz, l.color, l.intensity, l.range, l.angle, l.penumbra]));
  }
  h.number(trackMesh.dragTree ? 1 : 0);
  return { hash: h.hex, meshes, tris };
}
