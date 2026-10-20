// Seeded noise for the world. Plain numbers in, plain numbers out: no Three.js,
// no allocation, and nothing that depends on the machine.
//
// Every random-looking number in the world comes from an integer hash of a
// lattice cell, never from Math.random and never from a transcendental
// function (Math.sin gives different last digits on different engines, and a
// world that differs in the last digit is a world whose airports move). Integer
// multiplies and IEEE adds are the same everywhere, so the same seed is the
// same world on every launch and every browser.

const imul = Math.imul;

// A number in [0, 1) for a lattice cell and a seed.
export function hash2(ix, iz, seed) {
  let h = imul(ix, 374761393) ^ imul(iz, 668265263) ^ imul(seed | 0, 1274126177);
  h = imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// A second, independent number for the same cell, for when one hash has to
// make several decisions.
export function hash2b(ix, iz, seed) {
  return hash2(iz + 7919, ix - 104729, seed + 0x9e3779b);
}

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

export function smoothstep(a, b, x) {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

// Value noise in [0, 1], one lattice cell per unit, with a quintic fade so the
// slope is continuous across cell edges (the cubic TrackGround uses leaves a
// crease on every one, which a hill seen from the air makes plain).
export function value2(x, z, seed) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const sx = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
  const sz = fz * fz * fz * (fz * (fz * 6 - 15) + 10);
  const a = hash2(ix, iz, seed), b = hash2(ix + 1, iz, seed);
  const c = hash2(ix, iz + 1, seed), d = hash2(ix + 1, iz + 1, seed);
  return (a + (b - a) * sx) * (1 - sz) + (c + (d - c) * sx) * sz;
}

// Fractal noise in [0, 1]: `octaves` layers, each twice as fine and half as
// strong, divided by their total so the range does not depend on the count.
export function fbm2(x, z, seed, octaves) {
  let sum = 0, amp = 1, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * value2(x, z, seed + i * 7919);
    norm += amp;
    amp *= 0.5;
    // Twice as fine, and turned (a 3-4-5 triangle: exact, no trig) so the
    // lattice's axes do not line up from one octave to the next.
    const rx = 0.8 * x - 0.6 * z, rz = 0.6 * x + 0.8 * z;
    x = rx * 2 + 17.31;
    z = rz * 2 - 9.77;
  }
  return sum / norm;
}

// Ridged noise in [0, 1]: sharp crests where the underlying noise crosses its
// middle, which is what a mountain range looks like from above. Each octave is
// weighted by the one before it, so the fine ridges grow on the coarse ones.
export function ridged2(x, z, seed, octaves) {
  let sum = 0, amp = 1, norm = 0, prev = 1;
  for (let i = 0; i < octaves; i++) {
    const n = value2(x, z, seed + i * 7919);
    let r = 1 - Math.abs(2 * n - 1);
    r *= r;
    sum += amp * r * prev;
    norm += amp;
    prev = 0.35 + 0.65 * r;
    amp *= 0.5;
    const rx = 0.8 * x - 0.6 * z, rz = 0.6 * x + 0.8 * z;
    x = rx * 2 + 31.7;
    z = rz * 2 - 12.9;
  }
  return sum / norm;
}
