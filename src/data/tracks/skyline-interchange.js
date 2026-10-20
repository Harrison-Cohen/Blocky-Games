// Skyline Interchange. Dusk city figure-8, 1664 m.
//
// THIS FILE IS DATA. See harbor-nine.js for the prop vocabulary.
//
// The only circuit here that crosses itself. From the start line the main
// straight runs through the middle of the city and under a flyover; a
// left-hand lobe of city-block corners -- a 34 m left, a tight 22 m left, a
// right-left chicane and a sweeper -- brings the road up onto that flyover and
// back across the straight nine metres overhead. The right-hand lobe is the
// quick one: esses, a long 110 degree sweeper, and a tight right back onto the
// main straight. One lobe turns left, the other right, so the turn angles sum
// to nothing rather than a full circle, which is what a figure-8 is.
//
// The flyover is a cosine hump nine metres high over 280 m: 10% at its
// steepest, and gentle enough over the top that nothing leaves the ground.
// Wherever the road is more than three metres up, the control points are
// flagged `bridge`, so it stands on a deck and pillars instead of an
// embankment, and the car underneath is told apart from the car on top by its
// height.
//
// Concrete walls three and a half metres from the kerb all the way round. The
// sun is going down behind the towers: long shadows, a burning horizon, and
// the street lights and windows coming on.

export default {
  id: 'skyline-interchange',
  // Where it sits in the flight world (src/world); the car game never reads it.
  world: { biome: 'city' },
  name: 'Skyline Interchange',
  description: 'Dusk city figure-8. Concrete walls, neon, and a flyover across its own main straight.',
  order: 4,
  targetLap: 68,

  // 100 m up the main straight, 85 m short of the flyover.
  startDistance: 100,

  runoffSurface: 'tarmac',
  barrierStyle: 'wall',
  barrierGap: 3.5,
  // A city has no room for embankments.
  apronWidth: 18,
  terrain: { amplitude: 4, fade: 160 },

  palette: {
    sky: 0x5c3857,
    fog: 0x5c3857,
    ground: 0x25212b,
    road: 0x28282e,
    lines: 0xd8d4c8,
    curbA: 0xd0392f,
    curbB: 0xdedad0,
    barrier: 0x7a767d,
    bridge: 0x6f6b73,
    runoff: 0x302d35,
    sun: 0xffa060,
    hemiSky: 0x5c5c8e,
    hemiGround: 0x2b2531,
  },
  fog: { near: 90, far: 520 },
  // The sun sitting just above the rooftops.
  sunDirection: { x: 0.8, y: 0.16, z: 0.55 },
  sunIntensity: 1.7,
  hemiIntensity: 0.9,

  headlights: true,
  sky: {
    top: 0x111a3f,
    gradient: 0.55,
    haze: 1.1,
    hazeColor: 0xff7a3a,
    stars: 320,
    discColor: 0xffb070,
    discGlow: 5,
    discSize: 0.034,
  },
  post: { bloom: 0.4, bloomThreshold: 1.0, bloomRadius: 0.5 },
  markings: { centre: true },

  props: [
    // Towers. Four fixed shapes rather than one ranged one, because the window
    // bands have to line up with the floors they belong to; each gets its
    // variety from scale. Bands start three metres up and repeat every 3.6 m,
    // and every tower is tall enough that the last band stops below the roof.
    {
      name: 'tower-glass', count: 55, variants: 1, clearance: 6,
      minOffset: 30, maxOffset: 260, minScale: 0.75, maxScale: 1.35,
      parts: [
        { color: 0x2a3444, w: 16, h: 72, d: 16 },
        { color: 0x9fd4ff, emissive: 0x9fd4ff, glow: 1.1, w: 16.2, h: 0.8, d: 16.2, y: 3, repeat: 19, rise: 2.8 },
        { color: 0x1a1f28, w: 16.6, h: 1, d: 16.6, y: 72 },
        { color: 0xff3d9a, emissive: 0xff3d9a, glow: 3, w: 16.8, h: 0.5, d: 16.8, y: 71.2 },
      ],
    },
    {
      name: 'tower-warm', count: 50, variants: 1, clearance: 6,
      minOffset: 28, maxOffset: 240, minScale: 0.8, maxScale: 1.4,
      parts: [
        { color: 0x3a3036, w: 22, h: 46, d: 18 },
        { color: 0xffc27a, emissive: 0xffc27a, glow: 1.2, w: 22.2, h: 1.0, d: 18.2, y: 3, repeat: 11, rise: 2.8 },
        { color: 0x2d262b, w: 14, h: 10, d: 12, y: 46 },
        { color: 0x39f0ff, emissive: 0x39f0ff, glow: 3, w: 0.4, h: 6, d: 9, x: 11.2, y: 30 },
      ],
    },
    {
      name: 'tower-slim', count: 30, variants: 1, clearance: 6,
      minOffset: 40, maxOffset: 280, minScale: 0.8, maxScale: 1.3,
      parts: [
        { color: 0x23262e, w: 10, h: 95, d: 10 },
        { color: 0xe9f1ff, emissive: 0xe9f1ff, glow: 1.0, w: 10.2, h: 0.6, d: 10.2, y: 4, repeat: 26, rise: 2.9 },
        { color: 0x6d6a70, w: 0.5, h: 14, y: 95 },
        { color: 0xff2a2a, emissive: 0xff2a2a, glow: 4, w: 1, h: 1, y: 109 },
      ],
    },
    // Low-rise shops right up behind the walls, each with a lit shopfront and a
    // neon sign over it.
    {
      name: 'shops', count: 110, variants: 3, clearance: 2,
      minOffset: 18, maxOffset: 90, minScale: 0.85, maxScale: 1.25,
      parts: [
        { color: [0x4a3f45, 0x3c4452, 0x514a3e], w: 24, h: 9, d: 16 },
        { color: 0xffd89a, emissive: 0xffd89a, glow: 1.2, w: 24.2, h: 1.4, d: 16.2, y: 3.4 },
        { color: [0xff3d9a, 0x39f0ff, 0x9dff3a], emissive: [0xff3d9a, 0x39f0ff, 0x9dff3a], glow: 3,
          w: 12, h: 0.8, d: 16.4, y: 6.5 },
      ],
    },

    // Street lights: cool LED, over the road from both sides, 30 m apart. Real
    // lights, like Harbor Nine's lamps, so the road is lit in pools. A third of
    // Harbor's candela, because white light on this road reads far brighter
    // than sodium orange does -- at the same number it blew the tarmac out.
    {
      name: 'streetlights', place: 'line', variants: 1,
      spacing: 30, offset: 13.4, sides: [1, -1],
      light: { x: -3.0, y: 7.9, aim: -2, color: 0xdfe9ff, intensity: 34,
        range: 30, angle: 1.0, penumbra: 0.6 },
      parts: [
        { color: 0x3a3d45, w: 0.35, h: 8.5 },
        { color: 0x3a3d45, w: 3.2, h: 0.25, d: 0.3, x: -1.6, y: 8.3 },
        { color: 0xe8f2ff, emissive: 0xe8f2ff, glow: 1.4, w: 1.4, h: 0.25, d: 0.6, x: -3.0, y: 8.05 },
      ],
    },
    // Shorter lamps standing on the flyover's parapets.
    {
      name: 'deck-lights', place: 'line', variants: 1, onBridge: true,
      spacing: 24, offset: 12.1, lift: 1.0, sides: [1, -1], from: 1007, to: 1150,
      light: { x: -1.2, y: 5.6, aim: -1.5, color: 0xdfe9ff, intensity: 24,
        range: 24, angle: 1.0, penumbra: 0.6 },
      parts: [
        { color: 0x3a3d45, w: 0.3, h: 6 },
        { color: 0xe8f2ff, emissive: 0xe8f2ff, glow: 1.4, w: 1.2, h: 0.2, d: 0.5, x: -1.2, y: 5.8 },
      ],
    },
    // Billboards on legs behind the walls, framed in neon.
    {
      name: 'billboards', place: 'line', variants: 3,
      spacing: 110, offset: 19, sides: [1, -1],
      parts: [
        { color: 0x3a3d45, w: 0.5, h: 7, x: -4 },
        { color: 0x3a3d45, w: 0.5, h: 7, x: 4 },
        { color: 0x1b1d24, w: 11, h: 5, d: 0.5, y: 7 },
        { color: [0xff3d9a, 0x39f0ff, 0xffd23a], emissive: [0xff3d9a, 0x39f0ff, 0xffd23a], glow: 3.5,
          w: 11.4, h: 0.3, d: 0.6, y: 12 },
        { color: [0x39f0ff, 0xffd23a, 0xff3d9a], emissive: [0x39f0ff, 0xffd23a, 0xff3d9a], glow: 2,
          w: 7, h: 1.6, d: 0.6, y: 8.6 },
      ],
    },
  ],

  // x, y, z   world position of the centerline, metres
  // width     FULL road width here, metres
  // bridge    this span is a deck on pillars, not a road on an embankment
  controlPoints: [
  { x: 0, y: 0, z: 0, width: 14, surface: 'tarmac', banking: 0 },
  { x: 0, y: 0, z: 21.71, width: 14, surface: 'tarmac', banking: 0 },
  { x: 0, y: 0, z: 43.41, width: 14, surface: 'tarmac', banking: 0 },
  { x: 0, y: 0, z: 65.12, width: 14, surface: 'tarmac', banking: 0 },
  { x: 0, y: 0, z: 86.83, width: 14, surface: 'tarmac', banking: 0 },
  { x: 0, y: 0, z: 108.54, width: 14, surface: 'tarmac', banking: 0 },
  { x: 0, y: 0, z: 130.24, width: 14, surface: 'tarmac', banking: 0 },
  { x: 0, y: 0, z: 151.95, width: 14, surface: 'tarmac', banking: 0 },
  { x: 0, y: 0, z: 173.66, width: 14, surface: 'tarmac', banking: 0 },
  { x: 0, y: 0, z: 195.36, width: 14, surface: 'tarmac', banking: 0 },
  { x: 0, y: 0, z: 217.07, width: 14, surface: 'tarmac', banking: 0 },
  { x: 0, y: 0, z: 238.78, width: 14, surface: 'tarmac', banking: 0 },
  { x: 0, y: 0, z: 260.49, width: 14, surface: 'tarmac', banking: 0 },
  { x: 0, y: 0, z: 282.19, width: 14, surface: 'tarmac', banking: 0 },
  { x: 0, y: 0, z: 303.9, width: 14, surface: 'tarmac', banking: 0 },
  { x: 0, y: 0, z: 325.61, width: 14, surface: 'tarmac', banking: 0 },
  { x: 0, y: 0, z: 347.32, width: 14, surface: 'tarmac', banking: 0 },
  { x: 0, y: 0, z: 369.02, width: 14, surface: 'tarmac', banking: 0 },
  { x: 0, y: 0, z: 390.73, width: 14, surface: 'tarmac', banking: 0 },
  { x: 0, y: 0, z: 412.44, width: 14, surface: 'tarmac', banking: 0 },
  { x: 0, y: 0, z: 434.14, width: 14, surface: 'tarmac', banking: 0 },
  { x: 0, y: 0, z: 455.85, width: 12, surface: 'tarmac', banking: 0 },
  { x: 2.59, y: 0, z: 468.86, width: 12, surface: 'tarmac', banking: 0 },
  { x: 9.96, y: 0, z: 479.89, width: 12, surface: 'tarmac', banking: 0 },
  { x: 20.99, y: 0, z: 487.26, width: 12, surface: 'tarmac', banking: 0 },
  { x: 34, y: 0, z: 489.85, width: 12, surface: 'tarmac', banking: 0 },
  { x: 56, y: 0, z: 489.85, width: 12, surface: 'tarmac', banking: 0 },
  { x: 78, y: 0, z: 489.85, width: 12, surface: 'tarmac', banking: 0 },
  { x: 100, y: 0, z: 489.85, width: 12, surface: 'tarmac', banking: 0 },
  { x: 122, y: 0, z: 489.85, width: 12, surface: 'tarmac', banking: 0 },
  { x: 144, y: 0, z: 489.85, width: 12, surface: 'tarmac', banking: 0 },
  { x: 152.42, y: 0, z: 488.18, width: 12, surface: 'tarmac', banking: 0 },
  { x: 159.56, y: 0, z: 483.41, width: 12, surface: 'tarmac', banking: 0 },
  { x: 164.33, y: 0, z: 476.27, width: 12, surface: 'tarmac', banking: 0 },
  { x: 166, y: 0, z: 467.85, width: 12, surface: 'tarmac', banking: 0 },
  { x: 166, y: 0, z: 447.85, width: 12, surface: 'tarmac', banking: 0 },
  { x: 166, y: 0, z: 427.85, width: 12, surface: 'tarmac', banking: 0 },
  { x: 166, y: 0, z: 407.85, width: 12, surface: 'tarmac', banking: 0 },
  { x: 166, y: 0, z: 387.85, width: 12, surface: 'tarmac', banking: 0 },
  { x: 167.98, y: 0, z: 377.9, width: 12, surface: 'tarmac', banking: 0 },
  { x: 173.62, y: 0, z: 369.47, width: 12, surface: 'tarmac', banking: 0 },
  { x: 179.25, y: 0, z: 361.03, width: 12, surface: 'tarmac', banking: 0 },
  { x: 181.23, y: 0, z: 351.08, width: 12, surface: 'tarmac', banking: 0 },
  { x: 181.23, y: 0, z: 328.58, width: 12, surface: 'tarmac', banking: 0 },
  { x: 181.23, y: 0, z: 306.08, width: 12, surface: 'tarmac', banking: 0 },
  { x: 181.23, y: 0, z: 283.58, width: 12, surface: 'tarmac', banking: 0 },
  { x: 181.23, y: 0, z: 261.08, width: 12, surface: 'tarmac', banking: 0 },
  { x: 177.61, y: 0, z: 240.56, width: 12, surface: 'tarmac', banking: 0 },
  { x: 167.19, y: 0, z: 222.51, width: 12, surface: 'tarmac', banking: 0 },
  { x: 151.23, y: 0, z: 209.12, width: 12, surface: 'tarmac', banking: 0 },
  { x: 139.68, y: 0, z: 202.45, width: 12, surface: 'tarmac', banking: 0 },
  { x: 128.14, y: 0.1, z: 195.79, width: 13, surface: 'tarmac', banking: 0 },
  { x: 116.59, y: 0.57, z: 189.12, width: 13, surface: 'tarmac', banking: 0 },
  { x: 109.35, y: 1.02, z: 186.12, width: 13, surface: 'tarmac', banking: 0 },
  { x: 101.59, y: 1.57, z: 185.1, width: 13, surface: 'tarmac', banking: 0 },
  { x: 89.68, y: 2.58, z: 185.1, width: 13, surface: 'tarmac', banking: 0 },
  { x: 77.78, y: 3.72, z: 185.1, width: 13, surface: 'tarmac', banking: 0, bridge: true },
  { x: 65.87, y: 4.92, z: 185.1, width: 13, surface: 'tarmac', banking: 0, bridge: true },
  { x: 53.97, y: 6.08, z: 185.1, width: 13, surface: 'tarmac', banking: 0, bridge: true },
  { x: 42.06, y: 7.14, z: 185.1, width: 13, surface: 'tarmac', banking: 0, bridge: true },
  { x: 30.16, y: 8.01, z: 185.1, width: 13, surface: 'tarmac', banking: 0, bridge: true },
  { x: 18.25, y: 8.63, z: 185.1, width: 13, surface: 'tarmac', banking: 0, bridge: true },
  { x: 6.34, y: 8.95, z: 185.1, width: 13, surface: 'tarmac', banking: 0, bridge: true },
  { x: -5.56, y: 8.97, z: 185.1, width: 13, surface: 'tarmac', banking: 0, bridge: true },
  { x: -17.47, y: 8.66, z: 185.1, width: 13, surface: 'tarmac', banking: 0, bridge: true },
  { x: -29.37, y: 8.06, z: 185.1, width: 13, surface: 'tarmac', banking: 0, bridge: true },
  { x: -41.28, y: 7.2, z: 185.1, width: 13, surface: 'tarmac', banking: 0, bridge: true },
  { x: -53.18, y: 6.16, z: 185.1, width: 13, surface: 'tarmac', banking: 0, bridge: true },
  { x: -65.09, y: 4.99, z: 185.1, width: 13, surface: 'tarmac', banking: 0, bridge: true },
  { x: -77, y: 3.8, z: 185.1, width: 13, surface: 'tarmac', banking: 0 },
  { x: -88.9, y: 2.65, z: 185.1, width: 13, surface: 'tarmac', banking: 0 },
  { x: -100.81, y: 1.63, z: 185.1, width: 13, surface: 'tarmac', banking: 0 },
  { x: -112.29, y: 0.82, z: 182.82, width: 13, surface: 'tarmac', banking: 0 },
  { x: -122.02, y: 0.27, z: 176.31, width: 12, surface: 'tarmac', banking: 0 },
  { x: -128.52, y: 0.02, z: 166.58, width: 12, surface: 'tarmac', banking: 0 },
  { x: -130.81, y: 0, z: 155.1, width: 12, surface: 'tarmac', banking: 0 },
  { x: -130.81, y: 0, z: 143.85, width: 12, surface: 'tarmac', banking: 0 },
  { x: -130.81, y: 0, z: 132.6, width: 12, surface: 'tarmac', banking: 0 },
  { x: -130.81, y: 0, z: 121.35, width: 12, surface: 'tarmac', banking: 0 },
  { x: -130.81, y: 0, z: 110.1, width: 12, surface: 'tarmac', banking: 0 },
  { x: -130.81, y: 0, z: 98.85, width: 12, surface: 'tarmac', banking: 0 },
  { x: -130.81, y: 0, z: 87.6, width: 12, surface: 'tarmac', banking: 0 },
  { x: -130.81, y: 0, z: 76.35, width: 12, surface: 'tarmac', banking: 0 },
  { x: -130.81, y: 0, z: 65.1, width: 12, surface: 'tarmac', banking: 0 },
  { x: -132.25, y: 0, z: 56.89, width: 12, surface: 'tarmac', banking: 0 },
  { x: -136.42, y: 0, z: 49.67, width: 12, surface: 'tarmac', banking: 0 },
  { x: -140.59, y: 0, z: 42.46, width: 12, surface: 'tarmac', banking: 0 },
  { x: -142.04, y: 0, z: 34.25, width: 12, surface: 'tarmac', banking: 0 },
  { x: -142.04, y: 0, z: 10.91, width: 12, surface: 'tarmac', banking: 0 },
  { x: -142.04, y: 0, z: -12.42, width: 12, surface: 'tarmac', banking: 0 },
  { x: -142.04, y: 0, z: -35.75, width: 12, surface: 'tarmac', banking: 0 },
  { x: -138.03, y: 0, z: -56.36, width: 12, surface: 'tarmac', banking: 0 },
  { x: -126.6, y: 0, z: -73.96, width: 12, surface: 'tarmac', banking: 0 },
  { x: -109.41, y: 0, z: -86, width: 12, surface: 'tarmac', banking: 0 },
  { x: -88.96, y: 0, z: -90.72, width: 12, surface: 'tarmac', banking: 0 },
  { x: -68.23, y: 0, z: -87.44, width: 12, surface: 'tarmac', banking: 0 },
  { x: -49.43, y: 0, z: -80.6, width: 12, surface: 'tarmac', banking: 0 },
  { x: -30.64, y: 0, z: -73.75, width: 12, surface: 'tarmac', banking: 0 },
  { x: -11.84, y: 0, z: -66.91, width: 12, surface: 'tarmac', banking: 0 },
  { x: -5.65, y: 0, z: -63.09, width: 12, surface: 'tarmac', banking: 0 },
  { x: -1.47, y: 0, z: -57.13, width: 12, surface: 'tarmac', banking: 0 },
  { x: 0, y: 0, z: -50, width: 12, surface: 'tarmac', banking: 0 },
  { x: 0, y: 0, z: -25, width: 12, surface: 'tarmac', banking: 0 },
  ],
};
