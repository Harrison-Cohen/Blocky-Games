// Shared material cache.
//
// Every object of the same color and finish gets the SAME material instance,
// which is what keeps the draw call count and the GPU state changes down with
// a six car field plus scenery. Never construct a material outside this file.
//
// The world is flat-shaded Lambert: hard facets, no textures, no PBR. The cars
// are the exception -- they are smooth-shaded Phong so the bodywork catches a
// highlight and reads as a moulded shell rather than a folded box. Phong is not
// PBR: it is one specular term and no energy conservation, so the look stays
// hand-authored rather than physically simulated. Still no textures anywhere.

import * as THREE from 'three';

const cache = new Map();

// Options shared by flat() and unlit():
//   emissive   a colour the surface gives off whatever the light is
//   glow       multiplier on that emission (or on the colour, for unlit). Above
//              1 it is brighter than white, which is what the bloom pass picks
//              out: a sodium lamp or a neon strip glows, a white curb does not.
//   fog        false for things beyond the fog that must still be seen: the
//              sun, the clouds.
//   offset     polygon offset, for markings laid ON another surface. Pulls the
//              surface toward the camera in depth only, so it never z-fights
//              the road under it at any distance.
function key(hex, opts) {
  return `${hex}|${opts.transparent ? opts.opacity : 1}|${opts.emissive || 0}|${opts.side || 0}` +
    `|${opts.glow ?? 1}|${opts.fog === false ? 0 : 1}|${opts.offset ?? 0}`;
}

function applyOffset(m, opts) {
  if (!opts.offset) return;
  m.polygonOffset = true;
  m.polygonOffsetFactor = -opts.offset;
  m.polygonOffsetUnits = -opts.offset;
}

// A flat-shaded Lambert material for the given color. Repeated calls with the
// same arguments return the identical instance.
export function flat(hex, opts = {}) {
  const k = key(hex, opts);
  let m = cache.get(k);
  if (m) return m;

  m = new THREE.MeshLambertMaterial({
    color: hex,
    flatShading: true,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.glow ?? 1,
    side: opts.side ?? THREE.FrontSide,
    fog: opts.fog !== false,
  });
  if (opts.transparent) {
    m.transparent = true;
    m.opacity = opts.opacity ?? 1;
  }
  applyOffset(m, opts);
  cache.set(k, m);
  return m;
}

// Flat-shaded Lambert with a colour PER VERTEX. The flight world's terrain and
// props use it: still a faceted world with no textures, but the colour comes from
// the geometry, so a chunk of ground can be a different colour on every facet and
// still be one draw call. Vertex colours are linear, as the rest of the lighting
// is, so the world converts its palette before it writes them. `offset` is the
// polygon offset of flat() (pavement and markings laid on the ground).
export function facets(opts = {}) {
  const k = opts.offset ? `facets|${opts.offset}` : 'facets';
  let m = cache.get(k);
  if (m) return m;
  m = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  applyOffset(m, opts);
  cache.set(k, m);
  return m;
}

// Airport lights: unlit, a colour per vertex (so a lamp can be green on one face
// and red on the back of it, as a runway's end lights are, and every lamp of an
// airport is one draw call). The shared material's own colour multiplies them,
// which is the one knob: how bright the lights are (above 1 the bloom pass picks
// them out). Set it with `setLampLevel`; nothing else uses this material.
export function lamps() {
  const k = 'lamps';
  let m = cache.get(k);
  if (m) return m;
  m = new THREE.MeshBasicMaterial({ vertexColors: true });
  cache.set(k, m);
  return m;
}

// The same lights as points of a fixed size on the screen: a lamp seen from ten
// kilometres is far smaller than a pixel as a box, and an airport at night is seen
// from that far. Drawn with the boxes, and brightened by the same level.
export function lampPoints() {
  const k = 'lamp-points';
  let m = cache.get(k);
  if (m) return m;
  m = new THREE.PointsMaterial({ vertexColors: true, size: 2.5, sizeAttenuation: false });
  cache.set(k, m);
  return m;
}

export function setLampLevel(level) {
  lamps().color.setScalar(level);
  lampPoints().color.setScalar(level);
}

// Unlit, for things that must read at a constant brightness regardless of the
// light direction: light bar lenses, timing gantry strips, the ghost car.
export function unlit(hex, opts = {}) {
  const k = 'basic|' + key(hex, opts);
  let m = cache.get(k);
  if (m) return m;
  m = new THREE.MeshBasicMaterial({ color: hex, fog: opts.fog !== false });
  // The colour is in linear space by now, so scaling it past 1 is a genuinely
  // brighter-than-white surface for the bloom pass rather than a clipped one.
  if (opts.glow) m.color.multiplyScalar(opts.glow);
  applyOffset(m, opts);
  if (opts.transparent) {
    m.transparent = true;
    m.opacity = opts.opacity ?? 1;
    m.depthWrite = false;
  }
  cache.set(k, m);
  return m;
}

// Smooth-shaded, with a specular highlight. Car bodywork only -- this is what
// separates "smooth cars" from the deliberately chunky world around them.
// `shininess` is the tightness of the highlight, `specular` its colour.
export function glossy(hex, opts = {}) {
  const shininess = opts.shininess ?? 55;
  const specular = opts.specular ?? 0x3a3a42;
  const k = `phong|${hex}|${shininess}|${specular}|${opts.transparent ? opts.opacity : 1}`;
  let m = cache.get(k);
  if (m) return m;
  m = new THREE.MeshPhongMaterial({
    color: hex,
    specular,
    shininess,
    flatShading: false,
  });
  if (opts.transparent) {
    m.transparent = true;
    m.opacity = opts.opacity ?? 1;
  }
  cache.set(k, m);
  return m;
}

// An unlit material that is NOT shared, for a lens whose colour changes: brake
// lights. Everything else in this file is cached precisely so that two objects
// of the same colour cost one material, and that is exactly why an animated
// lens cannot use the cache -- brightening the shared red would brighten the
// tail lights of every other car on track at the same time. One extra material
// per car is the price of the six cars each having their own brake lights.
//
// The owner is responsible for disposing it. Vehicle does, when it rebuilds.
export function ownLamp(hex) {
  return new THREE.MeshBasicMaterial({ color: hex });
}

// A translucent, unlit material that is NOT shared, for vapour whose opacity
// changes from frame to frame: the shock rings at Mach 1. Its geometry carries
// the colour AND the alpha per vertex (a four-component `color` attribute), so
// an edge can fade out without a texture; the material's own opacity is the
// whole effect's fade. The owner disposes it.
export function ownVapour(hex = 0xffffff) {
  return new THREE.MeshBasicMaterial({
    color: hex, vertexColors: true, transparent: true, opacity: 0,
    depthWrite: false, side: THREE.DoubleSide,
  });
}

// The sky dome: a colour per vertex, drawn on the inside of a sphere, never
// fogged and never writing depth, so it is behind everything by construction.
export function skyDome() {
  const k = 'sky-dome';
  let m = cache.get(k);
  if (m) return m;
  m = new THREE.MeshBasicMaterial({
    vertexColors: true,
    side: THREE.BackSide,
    fog: false,
    depthWrite: false,
  });
  cache.set(k, m);
  return m;
}

// Stars. A fixed size in pixels whatever the distance, because a star is a
// point, and `glow` above 1 lets the brightest few catch the bloom.
export function stars(hex, size, glow = 1) {
  const k = `stars|${hex}|${size}|${glow}`;
  let m = cache.get(k);
  if (m) return m;
  m = new THREE.PointsMaterial({
    color: hex,
    size,
    sizeAttenuation: false,
    fog: false,
    depthWrite: false,
  });
  m.color.multiplyScalar(glow);
  cache.set(k, m);
  return m;
}

// The ghost car: flat-shaded Lambert like the world, translucent, and lit from
// within a little so it reads on a night track. A copy of the car it was set
// in, colour for colour -- never the car's own glossy materials, which are
// shared with every solid car of the same paint.
//
// Cached per colour like everything else, and ONLY the ghost uses them, which
// is what lets setGhostOpacity() fade the whole ghost at once.
const ghostSet = new Set();
export function ghost(hex, opacity = 0.35, glow = 0) {
  const k = `ghost|${hex}|${glow}`;
  let m = cache.get(k);
  if (m) return m;
  m = new THREE.MeshLambertMaterial({
    color: hex,
    flatShading: true,
    transparent: true,
    opacity,
    emissive: hex,
    emissiveIntensity: glow,
  });
  cache.set(k, m);
  ghostSet.add(m);
  return m;
}

export function setGhostOpacity(opacity) {
  for (const m of ghostSet) if (m.opacity !== opacity) m.opacity = opacity;
}

// Dust, gravel and smoke. White, so each particle's own instance colour is
// the colour it shows. Opaque: particles fade by shrinking, which needs no
// transparency sorting.
export function particles() {
  const k = 'particles';
  let m = cache.get(k);
  if (m) return m;
  m = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });
  cache.set(k, m);
  return m;
}

// Skid marks: colour and fade come per vertex, alpha included. Laid ON the
// road, so pulled toward the camera in depth like the painted lines, a step
// further so a mark across a line sits on top of it.
export function skidMarks() {
  const k = 'skid-marks';
  let m = cache.get(k);
  if (m) return m;
  m = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  applyOffset(m, { offset: 3 });
  cache.set(k, m);
  return m;
}

export function disposeAll() {
  for (const m of cache.values()) m.dispose();
  cache.clear();
  ghostSet.clear();
}

// Batched, texture-free cockpit vector ink. Vertex colours are linear; no lights
// or tone mapping change the instrument readings between day and night.
export function instrumentInk() {
  const k='instrument-ink';
  if(!cache.has(k))cache.set(k,new THREE.MeshBasicMaterial({vertexColors:true,toneMapped:false,fog:false}));
  return cache.get(k);
}
