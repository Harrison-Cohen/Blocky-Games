// Car against car.
//
// Each car is a capsule in plan: a line down its middle, from a bumper's worth
// in from the nose to the same from the tail, with a radius of half the body's
// width. That is round at the corners where a box would snag, and two
// capsules have one well defined closest pair of points, so the push is
// always along a sensible direction however the cars meet.
//
// The response is the barrier's, between two cars instead of a car and a wall:
//
//   push apart   the overlap is removed, shared by mass, so the heavier car
//                moves less
//   impact       the speed going INTO each other is taken out, with a little
//                back as bounce, shared by mass -- and capped, so no single
//                contact can change a car's speed by more than CONTACT.maxDeltaV
//   scrape       the speed sliding ALONG each other is scrubbed
//   no spin      contact damps yaw rate and never adds to it
//
// That last pair is the point. Real contact can pivot a car round; here it
// cannot, because the spec wants contact that costs time without deciding a
// race, and a hit that spins the player off is a hit that decided it.
//
// Pure state, no allocation per call, no Three.js. Called once per fixed step
// after every car has moved.

import { CONTACT } from '../data/tuning.js';

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const hit = { ax: 0, az: 0, bx: 0, bz: 0 };

// Closest points between segments P1-Q1 and P2-Q2, in the x-z plane.
function closest(p1x, p1z, q1x, q1z, p2x, p2z, q2x, q2z) {
  const d1x = q1x - p1x, d1z = q1z - p1z;
  const d2x = q2x - p2x, d2z = q2z - p2z;
  const rx = p1x - p2x, rz = p1z - p2z;
  const a = d1x * d1x + d1z * d1z;
  const e = d2x * d2x + d2z * d2z;
  const f = d2x * rx + d2z * rz;
  let s = 0, t = 0;
  if (a > 1e-9 || e > 1e-9) {
    if (a <= 1e-9) {
      t = clamp01(f / e);
    } else {
      const c = d1x * rx + d1z * rz;
      if (e <= 1e-9) {
        s = clamp01(-c / a);
      } else {
        const b = d1x * d2x + d1z * d2z;
        const denom = a * e - b * b;
        s = denom > 1e-9 ? clamp01((b * f - c * e) / denom) : 0;
        t = (b * s + f) / e;
        if (t < 0) { t = 0; s = clamp01(-c / a); }
        else if (t > 1) { t = 1; s = clamp01((b - c) / a); }
      }
    }
  }
  hit.ax = p1x + d1x * s; hit.az = p1z + d1z * s;
  hit.bx = p2x + d2x * t; hit.bz = p2z + d2z * t;
  return hit;
}

// cars: [{ physics, halfLen, halfWid, offset }], offset being how far the
// body's middle sits ahead of the centre of mass (0 if left out). Sets
// physics.inContact and raises
// physics.contactSpeed, the closing speed of the hardest hit, for anything that
// wants to shake the camera or play a thump. Returns the number of contacts.
export function resolveContacts(cars, dt) {
  let count = 0;
  const scrape = 1 - Math.exp(-CONTACT.scrape * dt);
  const spin = Math.exp(-CONTACT.yawScrub * dt);
  for (let i = 0; i < cars.length; i++) {
    const A = cars[i], pa = A.physics;
    for (let j = i + 1; j < cars.length; j++) {
      const B = cars[j], pb = B.physics;
      if (Math.abs(pa.y - pb.y) > CONTACT.maxHeight) continue;
      const sa = Math.sin(pa.yaw), ca = Math.cos(pa.yaw);
      const sb = Math.sin(pb.yaw), cb = Math.cos(pb.yaw);
      // The middle of each body, which on a car with real overhangs is not
      // its centre of mass; see bodyCenter in cars.js.
      const oa = A.offset || 0, ob = B.offset || 0;
      const ax = pa.x + sa * oa, az = pa.z + ca * oa;
      const bx = pb.x + sb * ob, bz = pb.z + cb * ob;
      const reach = A.halfLen + B.halfLen + CONTACT.pad * 2;
      const cdx = ax - bx, cdz = az - bz;
      if (cdx * cdx + cdz * cdz > reach * reach) continue;

      const ra = A.halfWid + CONTACT.pad, rb = B.halfWid + CONTACT.pad;
      const ha = Math.max(0, A.halfLen - A.halfWid), hb = Math.max(0, B.halfLen - B.halfWid);
      const c = closest(
        ax - sa * ha, az - ca * ha, ax + sa * ha, az + ca * ha,
        bx - sb * hb, bz - cb * hb, bx + sb * hb, bz + cb * hb);
      let nx = c.ax - c.bx, nz = c.az - c.bz;
      const d = Math.hypot(nx, nz);
      const overlap = ra + rb - d;
      if (overlap <= 0) continue;
      if (d > 1e-6) { nx /= d; nz /= d; }
      else {
        // Dead centre on each other: push out sideways from A.
        nx = ca; nz = -sa;
      }
      count++;
      pa.inContact = true; pb.inContact = true;

      const ma = pa.chassis.mass, mb = pb.chassis.mass;
      const wa = mb / (ma + mb), wb = ma / (ma + mb);
      pa.x += nx * overlap * wa; pa.z += nz * overlap * wa;
      pb.x -= nx * overlap * wb; pb.z -= nz * overlap * wb;

      // World-frame velocities, the same conversion the barrier uses.
      let vax = pa.vLong * sa + pa.vLat * ca, vaz = pa.vLong * ca - pa.vLat * sa;
      let vbx = pb.vLong * sb + pb.vLat * cb, vbz = pb.vLong * cb - pb.vLat * sb;

      const closing = (vax - vbx) * nx + (vaz - vbz) * nz;
      if (closing < 0) {
        const impulse = -(1 + CONTACT.restitution) * closing / (1 / ma + 1 / mb);
        const dva = Math.min(impulse / ma, CONTACT.maxDeltaV);
        const dvb = Math.min(impulse / mb, CONTACT.maxDeltaV);
        vax += nx * dva; vaz += nz * dva;
        vbx -= nx * dvb; vbz -= nz * dvb;
        pa.contactSpeed = Math.max(pa.contactSpeed || 0, -closing);
        pb.contactSpeed = Math.max(pb.contactSpeed || 0, -closing);
      }

      // Scrape: bring the two cars' sliding speeds toward each other.
      const tx = -nz, tz = nx;
      const slide = ((vax - vbx) * tx + (vaz - vbz) * tz) * scrape;
      vax -= tx * slide * wa; vaz -= tz * slide * wa;
      vbx += tx * slide * wb; vbz += tz * slide * wb;

      pa.vLong = vax * sa + vaz * ca; pa.vLat = vax * ca - vaz * sa;
      pb.vLong = vbx * sb + vbz * cb; pb.vLat = vbx * cb - vbz * sb;
      pa.yawRate *= spin; pb.yawRate *= spin;
    }
  }
  return count;
}
