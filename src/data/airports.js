// ============================================================================
// AIRPORTS
// ----------------------------------------------------------------------------
// What airports exist and what each kind of airport IS. Where the unhinted ones
// go, how they are flattened into the land and how they are drawn is code
// (src/world/Airports.js, src/render/AirportMesh.js) with its knobs in
// tuning.js, OPEN_WORLD.airports. Everything about the shape of an airport is
// here.
//
// A runway is the airport's frame. Its threshold is the origin, `u` runs along
// the runway from there and `v` runs across it, positive to the LEFT of the
// direction of travel. Positions in a recipe are fractions of the runway's
// length along u (so a recipe scales to a longer or shorter runway) and metres
// across v; sizes are metres. Fractions may run outside 0 to 1 (a heliport's
// pad is 40 m long, so its apron is 1.75 of it).
//
// Dimensions follow published practice, scaled UP for a game: ICAO Annex 14 gives a
// 45 m runway for code 4E and 60 m for code F, a taxiway of 23 m for code E. A 737 is 36 m
// across the wings and is flown by a person looking at it from behind, so the pavement is
// made wide enough to be landed on and taxied on without effort: every runway is at least
// 1.25 wingspans of it (the major's is two and a half), and the taxiways are as wide as the
// wingspan or nearly. (The first version was the published figures, and a 737 on a 30 m
// regional runway was wider than the runway.) The rule that keeps the world as it was: a
// tier's flat platform is the same rectangle it always was, so what a runway gains in width
// comes out of its `right` margin, the parallel taxiway grows inward (its outer edge, and so
// the apron and the buildings, stay where they were) and a stub's gap shrinks. The lights
// are white along the edge, green at the threshold, red at the end and blue along a taxiway.
// Estimates (a heliport's pad and apron, a regional's hangars) are marked.
// ============================================================================

export const TIERS = {
  // One. A long runway for an airliner (the 737 of milestone 4 needs 2,316 m to
  // take off), a parallel taxiway with four exits, a deep apron, a terminal.
  major: {
    label: 'Major airport',
    runway: { length: 3500, width: 90, surface: 'runway' },
    taxiway: { kind: 'parallel', width: 45, offset: 104, exits: [0.03, 0.27, 0.66, 0.97], exitWidth: 45 },
    apron: { from: 0.28, to: 0.72, depth: 150 },
    // The row along the back of the apron. `zone` gives a hangar a marked bay in
    // front of its door, where stopping opens the Hangar.
    back: [
      { kind: 'hangar', at: 0.34, w: 50, d: 40, h: 16, zone: true },
      { kind: 'tower', at: 0.42, w: 9, d: 9, h: 42 },
      { kind: 'terminal', at: 0.5, w: 220, d: 48, h: 16 },
      { kind: 'hangar', at: 0.66, w: 50, d: 40, h: 16, zone: true },
    ],
    stands: 8,
    lights: { edge: true, center: true, threshold: true, taxi: true, apron: true, papi: true, beacon: true },
    marks: { designators: true, touchdown: true },
    // The flat zone: `end` metres past each end of the runway, `right` past the
    // runway's right edge, out to `leftTo` metres on the left, blending into the
    // land over `blend`. These are exactly the flat rectangle the home runway of
    // milestone 2 had (420 either side, 500 past each end, 1,100 of blend), so
    // the land round it is unchanged (the 90 m runway's extra 30 m is taken off `right`).
    platform: { end: 500, right: 375, leftTo: 420, blend: 1100 },
    relief: 40,
    range: [0, 0],
  },

  // The fighter's base. A long, narrower runway with blast pads, hardened
  // shelters in a row, a plain tower.
  military: {
    label: 'Air base',
    runway: { length: 3000, width: 70, surface: 'runway', blast: 60 },
    taxiway: { kind: 'parallel', width: 35, offset: 86.5, exits: [0.04, 0.3, 0.7, 0.96], exitWidth: 35 },
    apron: { from: 0.25, to: 0.75, depth: 120 },
    back: [
      { kind: 'hangar', at: 0.30, w: 34, d: 42, h: 9, zone: true, shelter: true },
      { kind: 'hangar', at: 0.38, w: 34, d: 42, h: 9, zone: true, shelter: true },
      { kind: 'tower', at: 0.46, w: 8, d: 8, h: 30 },
      { kind: 'hangar', at: 0.54, w: 34, d: 42, h: 9, zone: true, shelter: true },
      { kind: 'hangar', at: 0.62, w: 34, d: 42, h: 9, zone: true, shelter: true },
      { kind: 'hangar', at: 0.70, w: 34, d: 42, h: 9, zone: true, shelter: true },
    ],
    stands: 8,
    lights: { edge: true, center: true, threshold: true, taxi: true, apron: true, papi: true, beacon: true },
    marks: { designators: true, touchdown: false },
    platform: { end: 300, right: 148, left: 70, blend: 900 },
    relief: 30,
    range: [22000, 46000],
  },

  // Regional airports: 1,500 to 2,000 m, a parallel taxiway, a small apron.
  regional: {
    label: 'Regional airport',
    runway: { length: 1800, width: 60, surface: 'runway' },
    taxiway: { kind: 'parallel', width: 30, offset: 67.5, exits: [0.05, 0.5, 0.95], exitWidth: 30 },
    apron: { from: 0.34, to: 0.66, depth: 90 },
    back: [
      { kind: 'hangar', at: 0.40, w: 36, d: 30, h: 11, zone: true },
      { kind: 'tower', at: 0.5, w: 6, d: 6, h: 18 },
      { kind: 'hangar', at: 0.60, w: 36, d: 30, h: 11, zone: true },
    ],
    stands: 5,
    lights: { edge: true, center: false, threshold: true, taxi: true, apron: true, papi: true, beacon: true },
    marks: { designators: true, touchdown: false },
    platform: { end: 180, right: 115, left: 50, blend: 700 },
    relief: 30,
    range: [10000, 50000],
  },

  // The small airstrip beside a race track. Derived, never listed: one for every
  // track in the registry (see `stripFor`).
  strip: {
    label: 'Airstrip',
    runway: { length: 1200, width: 45, surface: 'runway' },
    taxiway: { kind: 'stub', width: 25, at: 0.5, gap: 18 },
    apron: { from: 0.4, to: 0.62, depth: 70 },
    back: [
      { kind: 'hangar', at: 0.46, w: 30, d: 26, h: 9, zone: true },
      { kind: 'tower', at: 0.56, w: 5, d: 5, h: 12 },
    ],
    stands: 3,
    lights: { edge: true, center: false, threshold: true, taxi: false, apron: false, papi: false, beacon: true },
    marks: { designators: true, touchdown: false },
    platform: { end: 150, right: 90, left: 50, blend: 500 },
    relief: 50,
    range: [0, 0],
  },

  // A helipad. The 'runway' is a 40 m square pad (an estimate: 1.5 times the
  // rotor of the invented helicopter, with room), the apron is big enough to
  // stand and open a hangar bay for the fighter as well.
  heliport: {
    label: 'Heliport',
    runway: { length: 40, width: 40, surface: 'tarmac', pad: true },
    taxiway: { kind: 'stub', width: 20, at: 0.5, gap: 20 },
    apron: { from: -0.4, to: 1.4, depth: 70 },
    back: [
      { kind: 'hangar', at: 0.5, w: 30, d: 24, h: 8, zone: true },
      { kind: 'tower', at: 1.2, w: 4, d: 4, h: 10 },
    ],
    stands: 2,
    lights: { edge: true, center: false, threshold: false, taxi: false, apron: true, papi: false, beacon: true },
    marks: { designators: false, touchdown: false },
    platform: { end: 80, right: 110, left: 50, blend: 400 },
    relief: 12,
    range: [8000, 46000],
  },
};

// The named airports. `placement: { x, z, heading }` is a hint, as in a track
// file's `world.placement`: the airport stands exactly there (compass heading in
// radians, 0 north, east is -x). Without one it is placed from the seed, on flat
// land, apart from the others. `runway` overrides the tier's runway (a longer
// one); `height` fixes the height of the flat ground; `land` raises the sea
// floor around it so it stands on a plain: `{ radius, bias }` metres and map
// units. A new line here is a new airport.
export const AIRPORTS = [
  // The home runway of milestone 2, as it was: same place, heading, size and
  // height, and the same lifted plain round it.
  {
    id: 'meridian-intl', name: 'Meridian International', tier: 'major',
    placement: { x: 0, z: 0, heading: 0 }, height: 22,
    land: { radius: 15000, bias: 0.5 },
    // The ridge it sits in blocks both approaches: cut a graded corridor at each end (the
    // knobs are OPEN_WORLD.airports.corridor).
    corridor: true,
  },
  { id: 'fort-falcon', name: 'Fort Falcon Air Base', tier: 'military' },
  { id: 'pinecrest', name: 'Pinecrest Regional', tier: 'regional', runway: { length: 1800 } },
  { id: 'saltmarsh', name: 'Saltmarsh Field', tier: 'regional', runway: { length: 1500 } },
  { id: 'highmesa', name: 'Highmesa Airfield', tier: 'regional', runway: { length: 2000 } },
  { id: 'redwater', name: 'Redwater Airport', tier: 'regional', runway: { length: 1600 } },
  { id: 'cold-harbor', name: 'Cold Harbor Airport', tier: 'regional', runway: { length: 1900 } },
  { id: 'skyline-heliport', name: 'Skyline Heliport', tier: 'heliport' },
  { id: 'ridgeview-heliport', name: 'Ridgeview Heliport', tier: 'heliport' },
];

// The airstrip that goes with a track: its id and name come from the track, its
// place and heading from where the track area is (Airports.addStrips).
export const stripFor = (track) => ({
  id: `strip-${track.id}`,
  name: `${track.name} Airstrip`,
  tier: 'strip',
  track: track.id,
});

// The land that has to be raised round an airport so it stands on a plain (the
// home runway had it; Heightfield adds it to the world's own land).
export const landLifts = (list) => list.filter((a) => a.land && a.placement)
  .map((a) => ({ x: a.placement.x, z: a.placement.z, radius: a.land.radius, bias: a.land.bias }));
export const LAND_LIFTS = landLifts(AIRPORTS);
