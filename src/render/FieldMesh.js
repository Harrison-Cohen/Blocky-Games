// The test field of milestone 1, as geometry: a plain, a runway, and enough
// landmarks to feel speed and height against. Flat shaded, hard facets, no
// textures, like the rest of the world. Milestone 2's world replaces it.
//
//   the plain      one large quad, with a checker of slightly different green
//                  over the middle of it, so the ground has scale from altitude
//   the runway     a dark strip, edge lines, a dashed centre line, threshold bars
//   the pylons     tall blocks scattered in rings round the runway, in three
//                  colours, because nothing tells you how fast you are going
//                  like something going past at your wingtip

import * as THREE from 'three';
import { FIELD } from '../data/tuning.js';
import { flat } from './Materials.js';

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// A runway: a dark strip with edge lines, a dashed centre line and threshold
// bars, running north (+z) from z = 0 to z = L, centred on x = 0, laid just above
// the ground at y = 0 with polygon offsets so it never z-fights it. The open
// world's home runway uses it too, inside a group placed on its flat ground.
// flatQuad(w, d) makes a horizontal quad geometry the caller disposes.
export function addRunway(group, flatQuad, L, W, runwayColour, markColour) {
  const m = new THREE.Matrix4();
  const cz = L / 2;
  const strip = new THREE.Mesh(flatQuad(W, L), flat(runwayColour, { offset: 4 }));
  strip.position.set(0, 0.05, cz);
  strip.receiveShadow = true;
  group.add(strip);

  // Markings: edge lines, a dashed centre line, threshold bars at each end.
  const mark = flat(markColour, { offset: 6 });
  const bars = [];
  const edge = 0.9;
  bars.push([W / 2 - 1.2, cz, 0.4, L - 40]);
  bars.push([-W / 2 + 1.2, cz, 0.4, L - 40]);
  for (let z = 40; z < L - 40; z += 40) bars.push([0, z + 9, 0.5, 18]);
  for (const end of [14, L - 14]) {
    for (let x = -W / 2 + 4; x <= W / 2 - 4; x += 4.2) bars.push([x, end, edge, 22]);
  }
  const marks = new THREE.InstancedMesh(flatQuad(1, 1), mark, bars.length);
  bars.forEach(([x, z, w, d], i) => {
    m.makeScale(w, 1, d).setPosition(x, 0.09, z);
    marks.setMatrixAt(i, m);
  });
  marks.receiveShadow = true;
  marks.frustumCulled = false;
  group.add(marks);
}

export class FieldMesh {
  constructor() {
    this.group = new THREE.Group();
    this.lights = [];
    this._geos = [];
    const flatQuad = (w, d) => {
      const g = new THREE.PlaneGeometry(w, d);
      g.rotateX(-Math.PI / 2);
      this._geos.push(g);
      return g;
    };

    // The plain.
    const half = FIELD.half;
    const ground = new THREE.Mesh(flatQuad(half * 2, half * 2), flat(FIELD.ground));
    ground.receiveShadow = true;
    this.group.add(ground);

    // The checker: tiles over the middle of the plain, every other one.
    const tile = 500, n = 48;                      // 24 km square
    const count = (n * n) / 2;
    const tiles = new THREE.InstancedMesh(flatQuad(tile, tile), flat(FIELD.groundAlt, { offset: 2 }), count);
    const m = new THREE.Matrix4();
    let k = 0;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if ((i + j) % 2) continue;
        m.makeTranslation((i - n / 2 + 0.5) * tile, 0.02, (j - n / 2 + 0.5) * tile);
        tiles.setMatrixAt(k++, m);
      }
    }
    tiles.receiveShadow = true;
    tiles.frustumCulled = false;
    this.group.add(tiles);

    // The runway.
    const L = FIELD.runwayLength, W = FIELD.runwayWidth;
    const cz = L / 2;
    addRunway(this.group, flatQuad, L, W, FIELD.runway, FIELD.marking);

    // The pylons, in rings round the middle of the runway.
    const box = new THREE.BoxGeometry(1, 1, 1);
    this._geos.push(box);
    const colours = [0xff7a1a, 0xedede7, 0x2b3a52];
    const lists = [[], [], []];
    const rand = rng(0x71f1e1d);
    for (let ring = 1; ring <= FIELD.pylonRings; ring++) {
      const r = ring * FIELD.pylonSpacing;
      const around = Math.max(6, Math.round((r * 2 * Math.PI) / (FIELD.pylonSpacing * 1.6)));
      for (let a = 0; a < around; a++) {
        const ang = ((a + rand() * 0.6) / around) * Math.PI * 2;
        const x = Math.cos(ang) * r, z = cz + Math.sin(ang) * r;
        // Not on the runway.
        if (Math.abs(x) < W + 40 && z > -80 && z < L + 80) continue;
        const h = 25 + rand() * 90 + ring * 10;
        const w = 6 + rand() * 6;
        lists[(ring + a) % 3].push([x, z, w, h]);
      }
    }
    lists.forEach((list, c) => {
      if (!list.length) return;
      const im = new THREE.InstancedMesh(box, flat(colours[c]), list.length);
      list.forEach(([x, z, w, h], i) => {
        m.makeScale(w, h, w).setPosition(x, h / 2, z);
        im.setMatrixAt(i, m);
      });
      im.castShadow = true;
      im.receiveShadow = true;
      im.frustumCulled = false;
      this.group.add(im);
    });

    // Static: bake the matrices once.
    this.group.updateMatrixWorld(true);
    this.group.traverse((o) => { o.matrixAutoUpdate = false; });
  }

  applyShadows() {}

  dispose() {
    for (const g of this._geos) g.dispose();
  }
}

// What Scene.setEnvironment reads, as a track would give it: the sky, the fog
// and the light, from the field's own colours.
export function fieldEnvironment() {
  const half = FIELD.half;
  return {
    data: {
      id: 'flight-field',
      sky: { top: FIELD.skyTop, haze: 0.3, gradient: 0.45, disc: true, discSize: 0.022, stars: 0, clouds: 0 },
      fog: { near: FIELD.fogNear, far: FIELD.fogFar },
      post: { bloom: 0.3, bloomThreshold: 1.0 },
      // The sun is behind and above an aircraft flying north (+z), so the
      // side you see from the chase camera is the lit one.
      hemiIntensity: 1.35,
      sunIntensity: 2.3,
      sunDirection: { x: -0.35, y: 0.8, z: -0.45 },
    },
    palette: {
      sky: FIELD.sky,
      fog: FIELD.sky,
      ground: FIELD.ground,
      sun: FIELD.sun,
      hemiSky: 0xbfd9f2,
      hemiGround: FIELD.ground,
    },
    groundLevel: 0,
    minimap: { minX: -half, maxX: half, minZ: -half, maxZ: half },
  };
}
