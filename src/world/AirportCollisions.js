// Swept aircraft proxy volumes against the same boxes AirportMesh draws.
// Headless and independent of rendering, graphics detail, streaming and floating origin.
import { structureBoxes } from './AirportStructures.js';
import { FLIGHT_DAMAGE as D } from '../data/tuning.js';

export function createStructureHit() {
  return { hit: false, t: 1, nx: 0, ny: 0, nz: 0, closing: 0, part: -1 };
}

export class AirportCollisions {
  constructor(airports) {
    this.sites = airports.list.map((ap) => {
      const boxes = ap.layout.structures.flatMap(structureBoxes);
      return { ap, boxes, top: boxes.reduce((y, b) => Math.max(y, b.y + b.h), 0) };
    });
  }

  // A render camera is one swept point using the same airport solids. Separate scratch
  // prevents this query from touching an aircraft contact or damage state.
  cameraFraction(x0, y0, z0, x1, y1, z1, clearance) {
    if (!this._cameraBody) {
      const r = new Float64Array([1,0,0,0,1,0,0,0,1]);
      this._cameraBody = {def:{length:0}, r, prevR:r, gearDown:1,
        damage:{health:[1]}, structureVolumes:[{x:0,y:0,z:0,radius:0,part:0}]};
      this._cameraHit = createStructureHit();
    }
    const b = this._cameraBody;
    b.prevX=x0; b.prevY=y0; b.prevZ=z0; b.x=x1; b.y=y1; b.z=z1;
    b.def.length=clearance; b.structureVolumes[0].radius=clearance;
    return this.sweep(b,1,this._cameraHit).t;
  }

  // Conservative sphere/box expansion, swept through translation and rotation of each
  // data-defined body point. Slab intersection uses scalar scratch, no allocation.
  sweep(body, dt, out) {
    out.hit = false; out.t = 1; out.closing = 0;
    const r0 = body.prevR, r1 = body.r;
    const travel = Math.hypot(body.x - body.prevX, body.z - body.prevZ);
    for (let a = 0; a < this.sites.length; a++) {
      const site = this.sites[a], ap = site.ap;
      if (Math.min(body.y, body.prevY) - body.def.length > ap.base + site.top) continue;
      const reach = ap.radius + body.def.length + travel;
      if (Math.abs(body.x - ap.px) > reach || Math.abs(body.z - ap.pz) > reach) continue;
      for (let i = 0; i < body.structureVolumes.length; i++) {
        const h = body.structureVolumes[i];
        if (body.damage.health[h.part] === 0 || (h.gear && body.gearDown < 0.99)) continue;
        const sx = body.prevX + r0[0] * h.x + r0[1] * h.y + r0[2] * h.z - ap.x;
        const sy = body.prevY + r0[3] * h.x + r0[4] * h.y + r0[5] * h.z - ap.base;
        const sz = body.prevZ + r0[6] * h.x + r0[7] * h.y + r0[8] * h.z - ap.z;
        const ex = body.x + r1[0] * h.x + r1[1] * h.y + r1[2] * h.z - ap.x;
        const ey = body.y + r1[3] * h.x + r1[4] * h.y + r1[5] * h.z - ap.base;
        const ez = body.z + r1[6] * h.x + r1[7] * h.y + r1[8] * h.z - ap.z;
        const u0 = -sx * ap.sin + sz * ap.cos, v0 = sx * ap.cos + sz * ap.sin;
        const du = -(ex - sx) * ap.sin + (ez - sz) * ap.cos;
        const dv = (ex - sx) * ap.cos + (ez - sz) * ap.sin, dy = ey - sy;
        for (let j = 0; j < site.boxes.length; j++) {
          const b = site.boxes[j];
          let enter = 0, leave = 1, axis = -1, sign = 0, miss = false;
          for (let k = 0; k < 3; k++) {
            const pos = k === 0 ? u0 : k === 1 ? v0 : sy;
            const delta = k === 0 ? du : k === 1 ? dv : dy;
            const min = (k === 0 ? b.u - b.w / 2 : k === 1 ? b.v - b.d / 2 : b.y) - h.radius;
            const max = (k === 0 ? b.u + b.w / 2 : k === 1 ? b.v + b.d / 2 : b.y + b.h) + h.radius;
            if (Math.abs(delta) < D.sweepEpsilon) { if (pos < min || pos > max) { miss = true; break; } }
            else {
              const t0 = (min - pos) / delta, t1 = (max - pos) / delta;
              const near = Math.min(t0, t1), far = Math.max(t0, t1);
              if (near >= enter) { enter = near; axis = k; sign = delta > 0 ? -1 : 1; }
              leave = Math.min(leave, far);
              if (enter > leave) { miss = true; break; }
            }
          }
          if (miss || axis < 0 || leave < 0 || enter < 0 || enter > out.t || enter > 1) continue;
          const nu = axis === 0 ? sign : 0, nv = axis === 1 ? sign : 0, ny = axis === 2 ? sign : 0;
          const closing = -(du * nu + dv * nv + dy * ny) / dt;
          if (closing <= D.sweepEpsilon) continue;
          out.hit = true; out.t = enter; out.closing = closing; out.part = h.part;
          out.nx = nv * ap.cos - nu * ap.sin; out.nz = nu * ap.cos + nv * ap.sin; out.ny = ny;
        }
      }
    }
    return out;
  }
}
