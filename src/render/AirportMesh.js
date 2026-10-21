// An airport, as Three.js objects.
//
// Four meshes an airport (and the lamps again as points, which is a fifth call), so
// a handful of draw calls however many lines and lamps it has,
// every one with a colour per vertex and no texture:
//
//   pavement     runway, taxiways, apron, pad: flat quads laid just above the flat
//                ground, with a polygon offset so they never z-fight it (they
//                abut and never overlap, so one offset orders everything)
//   markings     edge lines, the dashed centre line, threshold bars, the runway's
//                number (built from bars: no text, no texture), touchdown marks,
//                taxiway centre lines, hold lines, stands, hangar bays, the
//                helipad's ring and H. A further polygon offset puts them over the
//                pavement
//   structures   hangars, shelters, tower, terminal, windsock, floodlight poles:
//                flat-shaded boxes, like every building in the world
//   lamps        every light in one geometry (see Materials.lamps): a lamp is a
//                small box and each face has its own colour, so the runway's end
//                lights can be green to the pilot coming in and red to the one
//                rolling out, and the edge lights amber in the last stretch for
//                the pilot who is running out of runway
//
// Everything is built in the airport's own frame, where Three's x is the layout's
// `v` (across, left positive) and z is its `u` (along): the group is turned by
// minus the heading, and placed (through WorldOrigin) on the airport's base height.
// Built in pieces by `steps()`, so the Streamer can give it a few milliseconds a
// frame instead of the lot at once.

import * as THREE from 'three';
import { facets, lamps, lampPoints } from './Materials.js';
import { hexToLinear } from '../world/Biomes.js';
import { addBox } from '../world/Props.js';
import { OPEN_WORLD } from '../data/tuning.js';

const Y_PAVE = 0.04, Y_MARK = 0.07;

// Seven-segment digits: which of a (top), b (upper right), c (lower right),
// d (bottom), e (lower left), f (upper left), g (middle) each one lights.
const SEGMENTS = {
  0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg',
};

// A growing triangle soup with flat normals and a colour per vertex.
class Geo {
  constructor() { this.pos = []; this.nor = []; this.col = []; this.pts = []; this.ptc = []; }

  _tri(ax, ay, az, bx, by, bz, cx, cy, cz, rgb) {
    const ux = bx - ax, uy = by - ay, uz = bz - az, wx = cx - ax, wy = cy - ay, wz = cz - az;
    let nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l; ny /= l; nz /= l;
    this.pos.push(ax, ay, az, bx, by, bz, cx, cy, cz);
    for (let k = 0; k < 3; k++) { this.nor.push(nx, ny, nz); this.col.push(rgb[0], rgb[1], rgb[2]); }
  }

  // A horizontal rectangle facing up: along u0..u1, across v0..v1, at height y.
  rect(u0, u1, v0, v1, y, rgb) {
    const x0 = Math.min(v0, v1), x1 = Math.max(v0, v1), z0 = Math.min(u0, u1), z1 = Math.max(u0, u1);
    this._tri(x0, y, z0, x0, y, z1, x1, y, z0, rgb);
    this._tri(x1, y, z0, x0, y, z1, x1, y, z1, rgb);
  }

  // A convex quad of (u, v) points facing up, in whichever order they come.
  quad(pts, y, rgb) {
    const P = pts.map(([u, v]) => [v, u]);       // x = v, z = u
    const up = (a, b, c) => (b[1] - a[1]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[1] - a[1]) > 0;
    for (const [a, b, c] of [[0, 1, 2], [0, 2, 3]]) {
      if (up(P[a], P[b], P[c])) this._tri(P[a][0], y, P[a][1], P[b][0], y, P[b][1], P[c][0], y, P[c][1], rgb);
      else this._tri(P[a][0], y, P[a][1], P[c][0], y, P[c][1], P[b][0], y, P[b][1], rgb);
    }
  }

  // A box with one colour: centred at (u, v), `w` along u, `d` across v, from the ground up.
  box(u, v, w, d, h, rgb, y0 = 0) {
    addBox(this, v, y0 + h / 2, u, d, h, w, rgb);
  }

  // A lamp: a small cube whose faces toward +u, -u, the sides and the top may each
  // be a different colour. (u, v) is where it stands, y its height off the ground.
  lamp(u, v, size, faces, y0 = 0) {
    const h = size / 2, cx = v, cy = y0 + size / 2, cz = u;
    this.pts.push(cx, cy, cz);
    this.ptc.push(faces.top[0], faces.top[1], faces.top[2]);
    const F = [
      [faces.side, [[h, -h, -h], [h, h, -h], [h, h, h], [h, -h, h]], [1, 0, 0]],
      [faces.side, [[-h, -h, h], [-h, h, h], [-h, h, -h], [-h, -h, -h]], [-1, 0, 0]],
      [faces.top, [[-h, h, -h], [-h, h, h], [h, h, h], [h, h, -h]], [0, 1, 0]],
      [faces.pu, [[-h, -h, h], [h, -h, h], [h, h, h], [-h, h, h]], [0, 0, 1]],
      [faces.nu, [[h, -h, -h], [-h, -h, -h], [-h, h, -h], [h, h, -h]], [0, 0, -1]],
    ];
    for (const [rgb, c, n] of F) {
      for (const k of [0, 1, 2, 0, 2, 3]) {
        this.pos.push(cx + c[k][0], cy + c[k][1], cz + c[k][2]);
        this.nor.push(n[0], n[1], n[2]);
        this.col.push(rgb[0], rgb[1], rgb[2]);
      }
    }
  }

  get empty() { return this.pos.length === 0; }

  // The lamps again, as one point each.
  points() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.pts), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(this.ptc), 3));
    g.computeBoundingSphere();
    return g;
  }

  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.pos), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(this.nor), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(this.col), 3));
    g.computeBoundingSphere();
    return g;
  }
}

const lin = (hex) => hexToLinear(hex, [0, 0, 0]);

export class AirportMesh {
  constructor(airport, cfg = OPEN_WORLD) {
    this.airport = airport;
    const c = cfg.airports.colors;
    this.C = {};
    for (const k of Object.keys(c)) this.C[k] = lin(c[k]);
    this.group = null;
    this._geos = [];
  }

  // Build it all at once (tests, and the airport the aircraft starts at).
  build() {
    for (const _ of this.steps()) { /* drain */ }
    return this.group;
  }

  // Build it a piece at a time: yields between the pieces, then finishes with
  // `this.group` made.
  *steps() {
    const A = this.airport, L = A.layout;
    const parts = {};
    parts.pavement = this._pavement(L);
    yield;
    parts.markings = this._markings(L);
    yield;
    parts.structures = this._structures(L);
    yield;
    parts.lamps = this._lamps(L);
    yield;

    const group = new THREE.Group();
    const make = (geo, mat, shadow = false) => {
      if (geo.empty) return;
      const g = geo.geometry();
      this._geos.push(g);
      const m = new THREE.Mesh(g, mat);
      m.receiveShadow = true;
      m.castShadow = shadow;
      m.matrixAutoUpdate = false;
      group.add(m);
    };
    make(parts.pavement, facets({ offset: 4 }));
    make(parts.markings, facets({ offset: 6 }));
    make(parts.structures, facets(), true);
    make(parts.lamps, lamps());
    if (parts.lamps.pts.length) {
      const pg = parts.lamps.points();
      this._geos.push(pg);
      const pm = new THREE.Points(pg, lampPoints());
      pm.matrixAutoUpdate = false;
      group.add(pm);
    }
    group.rotation.y = A.rotationY;
    group.matrixAutoUpdate = false;
    this.group = group;
  }

  dispose() {
    for (const g of this._geos) g.dispose();
    this._geos.length = 0;
  }

  // --- the pavement ----------------------------------------------------------------------
  _pavement(L) {
    const g = new Geo(), C = this.C;
    for (const p of L.pave) {
      const rgb = p.kind === 'runway' ? (L.pad ? C.apron : C.runway) : p.kind === 'taxi' ? C.taxiway : p.kind === 'apron' ? C.apron : C.pad;
      g.rect(p.u0, p.u1, p.v0, p.v1, Y_PAVE, rgb);
    }
    return g;
  }

  // --- the paint -----------------------------------------------------------------------
  _markings(L) {
    const g = new Geo(), C = this.C;
    const W = L.width, len = L.length, y = Y_MARK;
    const white = C.white, yellow = C.yellow;
    const line = (u0, u1, v0, v1, rgb = white) => g.rect(u0, u1, v0, v1, y, rgb);

    if (!L.pad) {
      // Edge lines and the dashed centre line.
      const e0 = W / 2 - 1.25, e1 = W / 2 - 0.75;
      line(60, len - 60, e0, e1); line(60, len - 60, -e1, -e0);
      const dw = W > 40 ? 0.45 : 0.3;
      for (let u = 100; u + 30 <= len - 100; u += 60) line(u, u + 30, -dw, dw);
      // Threshold bars at each end, and the number.
      const n = Math.max(2, Math.floor((W - 6) / 3.6) + 1), pitch = 3.6;
      for (let i = 0; i < n; i++) {
        const v = (i - (n - 1) / 2) * pitch;
        line(12, 42, v - 0.9, v + 0.9);
        line(len - 42, len - 12, v - 0.9, v + 0.9);
      }
      if (L.marks.designators) {
        this._digits(g, L.designators[0], 60, 1, 1, white);
        this._digits(g, L.designators[1], len - 60, -1, -1, white);
      }
      if (L.marks.touchdown) {
        for (const end of [0, 1]) {
          const at = (u0, u1) => (end ? [len - u1, len - u0] : [u0, u1]);
          for (const d of [150, 300, 450]) {
            const [a, b] = at(d, d + 22);
            for (const s of [-1, 1]) {
              line(a, b, s * 7, s * 8.8);
              if (d < 450) line(a, b, s * 11, s * 12.8);
            }
          }
          const [a, b] = at(380, 425);
          for (const s of [-1, 1]) line(a, b, s === 1 ? 9 : -15, s === 1 ? 15 : -9);
        }
      }
    } else {
      this._helipad(g, L, white);
    }

    // Blast pads: yellow chevrons pointing down the runway.
    if (L.blast) {
      for (const end of [0, 1]) {
        const sgn = end ? 1 : -1, base = end ? len : 0;
        for (let k = 0; k < 3; k++) {
          const u = base + sgn * (8 + k * 17);
          for (const s of [-1, 1]) g.quad([[u, s * (W / 2 - 3)], [u + sgn * 2.2, s * (W / 2 - 3)], [u + sgn * (-12 + 2.2), 0], [u + sgn * -12, 0]], y, yellow);
        }
      }
    }

    // Taxiway centre lines and hold lines.
    const tx = L.taxiway;
    if (tx.kind === 'parallel') {
      const vA = tx.offset - tx.width / 2, exits = tx.exits.map((x) => x * len);
      line(exits[0], exits[exits.length - 1], tx.offset - 0.2, tx.offset + 0.2, yellow);
      for (const e of exits) {
        line(e - 0.2, e + 0.2, W / 2, tx.offset, yellow);
        if (vA - W / 2 > 30) {
          for (const dv of [14, 15.4]) line(e - tx.exitWidth / 2, e + tx.exitWidth / 2, W / 2 + dv, W / 2 + dv + 0.4, yellow);
        }
      }
    } else {
      const e = tx.at * len;
      line(e - 0.2, e + 0.2, W / 2, W / 2 + tx.gap + 12, yellow);
      if (tx.gap >= 24) for (const dv of [8, 9.4]) line(e - tx.width / 2, e + tx.width / 2, W / 2 + dv, W / 2 + dv + 0.4, yellow);
    }

    // The stands: the outline of the airframe's place, nose toward the taxiway.
    for (const s of L.stands) {
      const hu = 12, hv = 15, t = 0.35;
      line(s.u - hu, s.u + hu, s.v - hv, s.v - hv + t, yellow);
      line(s.u - hu, s.u + hu, s.v + hv - t, s.v + hv, yellow);
      line(s.u - hu, s.u - hu + t, s.v - hv, s.v + hv, yellow);
      line(s.u + hu - t, s.u + hu, s.v - hv, s.v + hv, yellow);
      line(s.u - 0.2, s.u + 0.2, s.v - hv - 6, s.v - hv, yellow);        // the lead-in, toward the taxiway
    }

    // The hangar bays: an outline and two chevrons that point at the door.
    for (const z of L.zones) {
      const t = 0.5, mid = (z.u0 + z.u1) / 2;
      line(z.u0, z.u1, z.v0, z.v0 + t, yellow);
      line(z.u0, z.u1, z.v1 - t, z.v1, yellow);
      line(z.u0, z.u0 + t, z.v0, z.v1, yellow);
      line(z.u1 - t, z.u1, z.v0, z.v1, yellow);
      for (let k = 0; k < 2; k++) {
        const v = z.v0 + 8 + k * 7;
        for (const s of [-1, 1]) g.quad([[mid + s * 8, v], [mid + s * 8, v + 1.4], [mid, v + 6.4], [mid, v + 5]], y, yellow);
      }
    }
    return g;
  }

  // A runway's number: two digits of bars, nine metres tall, set at `u` and read by a
  // pilot looking along the runway. `dir` is +1 for the number at the start (its top
  // toward +u) and -1 for the one at the far end (its top toward -u); `side` turns the
  // reading direction (right is -v for the pilot at the start).
  _digits(g, number, u, dir, side, rgb) {
    const text = String(number).padStart(2, '0');
    const w = 4.5, h = 9, s = 1.1, gap = 2, total = w * 2 + gap;
    const seg = {
      a: [0, w, h - s, h], d: [0, w, 0, s], g: [0, w, (h - s) / 2, (h + s) / 2],
      f: [0, s, h / 2, h], b: [w - s, w, h / 2, h], e: [0, s, 0, h / 2], c: [w - s, w, 0, h / 2],
    };
    for (let i = 0; i < 2; i++) {
      const x0 = i * (w + gap) - total / 2;             // to the pilot's right of the centre
      for (const k of SEGMENTS[text[i]]) {
        const [xa, xb, ya, yb] = seg[k];
        // Digit space (x right, y up) to the layout: up is along `dir`, right is across.
        const ua = u + dir * ya, ub = u + dir * yb;
        const va = -side * (x0 + xa), vb = -side * (x0 + xb);
        g.rect(Math.min(ua, ub), Math.max(ua, ub), Math.min(va, vb), Math.max(va, vb), Y_MARK, rgb);
      }
    }
  }

  // The pad: a ring and an H, on the middle of the square.
  _helipad(g, L, rgb) {
    const cu = L.length / 2, r0 = 14.4, r1 = 15.6, n = 28;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
      const P = (r, a) => [cu + Math.cos(a) * r, Math.sin(a) * r];
      g.quad([P(r0, a0), P(r1, a0), P(r1, a1), P(r0, a1)], Y_MARK, rgb);
    }
    g.rect(cu - 4.5, cu + 4.5, -4.6, -3.2, Y_MARK, rgb);
    g.rect(cu - 4.5, cu + 4.5, 3.2, 4.6, Y_MARK, rgb);
    g.rect(cu - 0.7, cu + 0.7, -3.2, 3.2, Y_MARK, rgb);
  }

  // --- the buildings ------------------------------------------------------------------
  _structures(L) {
    const g = new Geo(), C = this.C;
    for (const s of L.structures) {
      if (s.kind === 'hangar') this._hangar(g, s);
      else if (s.kind === 'tower') this._tower(g, s);
      else if (s.kind === 'terminal') this._terminal(g, s);
      else if (s.kind === 'sock') {
        g.box(s.u, s.v, 0.3, 0.3, s.h, C.pole);
        for (let k = 0; k < 3; k++) g.box(s.u + 0.9 + k * 1.1, s.v, 1.1, 1.3 - k * 0.3, 1.3 - k * 0.3, k === 1 ? C.white : C.accent, s.h - 1.2);
      }
    }
    // Floodlight poles along the back of the apron and at its front corners.
    if (L.lights.apron) for (const [u, v] of this._floods(L)) g.box(u, v, 0.5, 0.5, 9, C.pole);
    return g;
  }

  _floods(L) {
    const a = L.apron, out = [];
    const n = Math.max(2, Math.round((a.u1 - a.u0) / 90));
    for (let i = 0; i <= n; i++) out.push([a.u0 + ((a.u1 - a.u0) * i) / n, a.v1 - 3]);
    out.push([a.u0 + 4, a.v0 + 4], [a.u1 - 4, a.v0 + 4]);
    return out;
  }

  _hangar(g, s) {
    const C = this.C, front = s.v - s.d / 2;
    if (s.shelter) {
      // A hardened shelter: three tiers, narrowing, like an arch cut in boxes.
      g.box(s.u, s.v, s.w, s.d, s.h * 0.55, C.wall);
      g.box(s.u, s.v, s.w * 0.84, s.d, s.h * 0.78, C.wall, 0);
      g.box(s.u, s.v, s.w * 0.6, s.d, s.h, C.roof, 0);
    } else {
      g.box(s.u, s.v, s.w, s.d, s.h, C.wall);
      g.box(s.u, s.v, s.w + 1.2, s.d + 1.2, 1, C.roof, s.h);
      g.box(s.u, s.v, s.w * 0.5, s.d * 0.62, 1.8, C.roof, s.h + 1);
    }
    // The door, on the side that faces the apron, and a band of signal orange.
    const dh = s.h * 0.72, dw = s.w * 0.82;
    g.box(s.u, front - 0.15, dw, 0.3, dh, C.door);
    g.box(s.u, front - 0.12, s.w * 1.0, 0.26, 1.1, C.accent, Math.min(s.h - 1.4, dh + 0.9));
  }

  _tower(g, s) {
    const C = this.C, h = s.h;
    g.box(s.u, s.v, s.w * 1.8, s.d * 1.8, h * 0.18, C.wall);
    g.box(s.u, s.v, s.w, s.d, h * 0.82, C.wall);
    // The cab: wider than the shaft, a band of glass, a roof, a mast.
    const cw = s.w * 2.3, cd = s.d * 2.3, cy = h * 0.8;
    g.box(s.u, s.v, cw * 1.04, cd * 1.04, 0.7, C.roof, cy - 0.7);
    g.box(s.u, s.v, cw, cd, h * 0.12, C.glass, cy);
    g.box(s.u, s.v, cw * 1.12, cd * 1.12, 0.8, C.roof, cy + h * 0.12);
    g.box(s.u, s.v, 0.4, 0.4, 5, C.pole, cy + h * 0.12 + 0.8);
  }

  _terminal(g, s) {
    const C = this.C;
    g.box(s.u, s.v, s.w, s.d, s.h, C.wall);
    g.box(s.u, s.v - s.d / 2 - 0.1, s.w * 0.96, 0.3, s.h * 0.45, C.glass, s.h * 0.3);
    g.box(s.u, s.v, s.w + 6, s.d + 8, 1.2, C.roof, s.h);
  }

  // --- the lights ---------------------------------------------------------------------------
  _lamps(L) {
    const g = new Geo(), C = this.C;
    const white = C.lampWhite, red = C.lampRed, green = C.lampGreen, blue = C.lampBlue, amber = C.lampAmber;
    const all = (rgb) => ({ pu: rgb, nu: rgb, side: rgb, top: rgb });
    const len = L.length, W = L.width, lt = L.lights;
    const lamp = (u, v, size, faces, y0 = 0.05) => g.lamp(u, v, size, faces, y0);

    if (!L.pad) {
      if (lt.edge) {
        const step = len > 2500 ? 60 : 50, instrument = lt.center;
        const caution = 600;
        for (let u = 0; u <= len + 0.01; u += step) {
          // Amber toward the end it is near, in the last stretch, on a runway with an
          // instrument approach; the pilot who sees it is running out of runway.
          const faces = { pu: white, nu: white, side: white, top: white };
          if (instrument) {
            if (u > len - caution) faces.nu = amber;
            if (u < caution) faces.pu = amber;
          }
          for (const s of [-1, 1]) lamp(u, s * (W / 2 - 0.3), 0.9, faces);
        }
      }
      if (lt.threshold) {
        // Green to the pilot coming in, red to the one rolling out, across the whole width.
        const n = Math.floor(W / 3) + 1;
        for (let i = 0; i < n; i++) {
          const v = -W / 2 + (W * i) / (n - 1);
          lamp(-0.8, v, 0.9, { pu: red, nu: green, side: green, top: green });
          lamp(len + 0.8, v, 0.9, { pu: green, nu: red, side: green, top: green });
        }
      }
      if (lt.center) {
        // White along the middle; red in the last 300 m (to the pilot running out of
        // runway) and red and white by turns in the 600 m before that.
        for (let u = 15; u <= len - 14; u += 30) {
          const faces = { pu: white, nu: white, side: white, top: white };
          const dEnd = len - u, dStart = u;
          const tone = (d) => (d < 300 ? red : Math.round(d / 30) % 2 === 0 ? red : white);
          if (dEnd < 900) faces.nu = tone(dEnd);
          if (dStart < 900) faces.pu = tone(dStart);
          lamp(u, 0, 0.6, faces, 0.02);
        }
      }
      if (lt.papi) {
        // Four boxes beside the runway, two white and two red: the picture of a pilot
        // on the glide slope, from either end.
        for (const end of [0, 1]) {
          const u = end ? len - 300 : 300;
          for (let i = 0; i < 4; i++) {
            const tone = i < 2 ? white : red;
            const faces = end ? { pu: tone, nu: C.pole, side: C.pole, top: C.pole } : { pu: C.pole, nu: tone, side: C.pole, top: C.pole };
            lamp(u, W / 2 + 14 + i * 9, 1.8, faces, 0.2);
          }
        }
      }
    } else {
      // The pad: green lights round the square, and floods (below).
      if (lt.edge) {
        const n = 10;
        for (let i = 0; i <= n; i++) {
          const t = -20 + (40 * i) / n;
          for (const [u, v] of [[0, t], [40, t], [t + 20, -20], [t + 20, 20]]) lamp(u, v, 0.9, all(green));
        }
      }
    }

    const tx = L.taxiway;
    if (lt.taxi) {
      if (tx.kind === 'parallel') {
        const vA = tx.offset - tx.width / 2, exits = tx.exits.map((x) => x * len);
        const inExit = (u) => exits.some((e) => Math.abs(u - e) < tx.exitWidth / 2 + 5);
        // Blue on the runway side of the taxiway, between the exits, and along both
        // sides of each exit; green down its middle on the bigger airports.
        for (let u = exits[0] + tx.exitWidth; u <= exits[exits.length - 1] - tx.exitWidth; u += 25) if (!inExit(u)) lamp(u, vA, 0.6, all(blue));
        for (const e of exits) {
          for (let v = W / 2 + 6; v < vA; v += 20) for (const s of [-1, 1]) lamp(e + s * tx.exitWidth / 2, v, 0.6, all(blue));
        }
        if (lt.center) {
          for (let u = exits[0]; u <= exits[exits.length - 1]; u += 20) lamp(u, tx.offset, 0.5, all(green), 0.02);
          for (const e of exits) for (let v = W / 2 + 6; v < vA; v += 15) lamp(e, v, 0.5, all(green), 0.02);
        }
      } else {
        const e = tx.at * len;
        for (let v = W / 2 + 4; v < W / 2 + tx.gap; v += 12) for (const s of [-1, 1]) lamp(e + s * tx.width / 2, v, 0.6, all(blue));
      }
    }
    if (lt.apron) for (const [u, v] of this._floods(L)) lamp(u, v, 1.4, all(white), 9);
    // The beacon on the tower: white and green, turning in a real one.
    if (lt.beacon) {
      const t = L.structures.find((s) => s.kind === 'tower');
      if (t) {
        const top = t.h + 5.8;
        lamp(t.u - 0.6, t.v, 1.1, all(white), top);
        lamp(t.u + 0.6, t.v, 1.1, all(green), top);
      }
    }
    return g;
  }
}
