// Harbor Nine. Night container port: tight, technical and unforgiving.
//
// THIS FILE IS DATA. Everything that makes this a different place from Copper
// Flats -- its light, its fog, its road colour, how much room there is to make
// a mistake, and every object standing beside the road -- is described here.
// Nothing outside this file knows what a shipping container is.
//
// Layout, from the start line: a 210 m main straight down the quay, two
// right-angle lefts between the container stacks, a right onto the covered
// straight, 134 m of tunnel, a left out into the open, a quick right-left
// chicane, the tightest corner on the circuit at 16 m radius, a bridge over the
// dock channel, and two more right angles back onto the quay.
//
// Ten corners in 1373 m. Eight of them are 90 degrees and the largest radius
// anywhere is 28 m, so nothing here is taken flat out and the guardrails are
// four and a half metres away throughout: a wide entry costs you the lap.
//
// The turn angles sum to a full circle, which is what closes the loop.

export default {
  id: 'harbor-nine',
  name: 'Harbor Nine',
  description: 'Night container port. Right angles, guardrails and one long dark tunnel.',
  order: 2,
  targetLap: 70,

  // The line sits 70 m up the main straight, leaving 140 m of run to Turn 1 and
  // room to line a grid up behind it.
  startDistance: 70,

  // The dock apron is concrete, so running wide costs no grip. On this circuit
  // the punishment is the wall, not the surface: there is no gravel to scrub
  // speed off in and nowhere to put a car that arrives too fast.
  runoffSurface: 'tarmac',
  barrierStyle: 'guardrail',

  // Half the runoff of a desert circuit. This is the number that makes Harbor
  // Nine feel like a street course rather than a permanent one.
  barrierGap: 4.5,

  // Dockland is flat. The hills that surround Copper Flats would be nonsense
  // here, so this track asks for almost none.
  terrain: { amplitude: 2.5, fade: 140 },

  palette: {
    sky: 0x0b1626,
    fog: 0x0b1626,
    ground: 0x1b222e,
    // Ordinary asphalt. It used to be nearly black, lifted by emissive, to fake
    // lamplight on a wet road when the lamps lit nothing; under real lights a
    // surface that reflects one percent of what hits it stays black in the
    // middle of a pool. The night is dark because there is little light, not
    // because the road is painted black. The emissive left is a trace, so the
    // stretch between two lamps is dark but still has an edge.
    road: 0x3e4148,
    roadGlow: 0x04070b,
    curbA: 0xc8451f,
    curbB: 0xcfcbc0,
    barrier: 0x67707e,
    runoff: 0x2c323c,
    sun: 0x9fb6dc,
    // Ambient fill, separate from the sky. The sky is nearly black here, and
    // taking the fill from it leaves the car a silhouette in its own chase
    // camera between one lamp and the next.
    hemiSky: 0x445c80,
    hemiGround: 0x141d2a,
  },
  fog: { near: 55, far: 340 },
  // Low and raking, like the last of the light off the water. It is the moon:
  // the sky draws a disc where this light comes from.
  sunDirection: { x: 0.55, y: 0.42, z: -0.72 },
  sunIntensity: 0.6,
  // Low, because the road is now a real grey: the fill is what sets how dark
  // the gaps between the lamps are, and they should be dark.
  hemiIntensity: 0.45,

  // Night. Every car runs its headlights, the sky is black with stars and a
  // moon, and the lamps below are real lights rather than glowing boxes.
  headlights: true,
  sky: {
    top: 0x02050b,
    gradient: 0.35,
    haze: 0.1,
    stars: 1100,
    discColor: 0xdfe8f5,
    discGlow: 2.4,
    discSize: 0.02,
  },
  // Lamps, lenses and brake lights spill light into the dark around them.
  post: { bloom: 0.4, bloomThreshold: 1.0, bloomRadius: 0.45 },
  // A street circuit, so it has a dashed centre line as well as edge lines.
  markings: { centre: true },

  // Scenery.
  //
  // Every prop is a list of boxes with ranged dimensions; see TrackMesh for the
  // full vocabulary. One rule worth knowing when editing these: a [lo, hi] range
  // is rolled INDEPENDENTLY per part, so two parts that have to line up (a crane
  // beam standing on crane legs) must both use fixed numbers and take their
  // variety from minScale/maxScale instead. Ranges are for parts that stand on
  // their own, and for `repeat` stacks, which line themselves up by construction.
  props: [
    // Stacks of containers, pushed right up behind the guardrails so the
    // right-angle corners are blind and walled in.
    {
      name: 'containers', count: 110, variants: 3, clearance: 2.5,
      minOffset: 22, maxOffset: 150, minScale: 0.9, maxScale: 1.2,
      parts: [
        { color: [0xa8342a, 0x1f6f70, 0x2f4f8a, 0xb0682a, 0x6f7358, 0x8a3560],
          w: 2.5, h: 2.6, d: 12.2, x: -2.72, repeat: [1, 3], jitter: 0.35 },
        { color: [0x1f6f70, 0xa8342a, 0x6f7358, 0x2f4f8a, 0xb0682a, 0x39424f],
          w: 2.5, h: 2.6, d: 12.2, x: 0, repeat: [2, 4], jitter: 0.35 },
        { color: [0x2f4f8a, 0xb0682a, 0xa8342a, 0x1f6f70, 0x8a3560, 0x6f7358],
          w: 2.5, h: 2.6, d: 12.2, x: 2.72, repeat: [1, 3], jitter: 0.35 },
      ],
    },

    // Quayside gantry cranes on the skyline. Fixed geometry so the boom lands
    // on the legs; scale is what makes them different sizes.
    {
      name: 'cranes', count: 9, variants: 2, clearance: 18, shadow: false,
      minOffset: 130, maxOffset: 320, minScale: 0.85, maxScale: 1.35,
      parts: [
        { color: 0x2a3644, w: 2.2, h: 30, d: 2.2, x: -9.5, z: -8 },
        { color: 0x2a3644, w: 2.2, h: 30, d: 2.2, x: 9.5, z: -8 },
        { color: 0x2a3644, w: 2.2, h: 30, d: 2.2, x: -9.5, z: 8 },
        { color: 0x2a3644, w: 2.2, h: 30, d: 2.2, x: 9.5, z: 8 },
        { color: [0xb0562a, 0x8e4a26, 0x3d4a5a], w: 24, h: 4.2, d: 6, y: 30 },
        { color: [0xb0562a, 0x8e4a26, 0x3d4a5a], w: 5, h: 3, d: 48, y: 34.2, z: 6 },
        { color: 0x1c2430, w: 4.5, h: 3.4, d: 5, y: 26, z: 8 },
      ],
    },

    // Warehouses and sheds filling the middle distance.
    {
      name: 'sheds', count: 20, variants: 2, clearance: 9, shadow: false,
      minOffset: 58, maxOffset: 210, minScale: 0.85, maxScale: 1.7,
      parts: [
        { color: [0x39424f, 0x2f3a47, 0x444e5c], w: 26, h: 9.5, d: 42 },
        { color: [0x4c576a, 0x3d4757], w: 28, h: 1.3, d: 44, y: 9.5 },
        { color: 0x1a212b, w: 26.4, h: 4.2, d: 6, z: 21.5 },
      ],
    },

    // Sodium lamps down both sides, arms reaching in over the road. +x is the
    // track's left, so a negative x reaches toward the centreline and the
    // builder mirrors it for the other side.
    //
    // 32 m apart, which is closer than a real quay would light it. At 46 m the
    // stretch between two lamps went black and the edge of the road stopped
    // being readable, and a night circuit you cannot see the road on is not
    // atmospheric, it is broken.
    //
    // Each lamp is a real light: a sodium-orange cone from under the head,
    // leaning in toward the middle of the road. The pools it lays down are what
    // you drive by, and between them the road is as dark as the rest of the
    // night.
    {
      name: 'lamps', place: 'line', variants: 1, shadow: false,
      spacing: 32, offset: 15.2, sides: [1, -1],
      light: { x: -3.4, y: 8.4, aim: -2.2, color: 0xffa347, intensity: 100,
        range: 34, angle: 1.0, penumbra: 0.55 },
      parts: [
        { color: 0x2e3846, w: 0.45, h: 9.2, d: 0.45 },
        { color: 0x2e3846, w: 3.6, h: 0.3, d: 0.4, x: -1.8, y: 8.9 },
        { color: 0xffb03a, emissive: 0xffb03a, glow: 1.5, w: 1.6, h: 0.34, d: 0.95, x: -3.4, y: 8.56 },
      ],
    },

    // The reflected light strips. Unlit, so they read at a constant brightness
    // whatever the moon is doing, and laid under the lamps rather than
    // anywhere: a reflection that is not under a light is just a stripe.
    {
      name: 'sheen', place: 'line', variants: 1, shadow: false,
      spacing: 32, offset: 3.7, sides: [1, -1], lift: 0.02,
      parts: [{ color: 0x54401f, unlit: true, w: 0.8, h: 0.02, d: 9.5 }],
    },

    // The tunnel: a portal every 4 m for 134 m, standing just outside the
    // guardrails and roofed over. The gap between portals lets a little light
    // in from above, and inside it the only light is the strips.
    //
    // There are three of those per portal, and there have to be. The roof puts
    // the road in shadow and there is no bounce light in a flat-shaded world,
    // so a ceiling strip on its own leaves a dark tunnel you cannot see the
    // road in -- which is a different thing from a dark tunnel. The strips at
    // driver height on the walls are what make the edges of it legible.
    {
      name: 'tunnel', place: 'line', variants: 1,
      spacing: 4, offset: 0, sides: [0], from: 470, to: 604,
      // A ceiling light every fourth portal, straight down.
      light: { y: 7.0, every: 4, color: 0xffc35a, intensity: 40, range: 18,
        angle: 1.25, penumbra: 0.8 },
      parts: [
        { color: 0x1a212c, w: 1.6, h: 7.4, d: 3.7, x: -13.4 },
        { color: 0x1a212c, w: 1.6, h: 7.4, d: 3.7, x: 13.4 },
        { color: 0x232b39, w: 28.4, h: 1.1, d: 3.7, y: 7.4 },
        { color: 0xffc35a, emissive: 0xffc35a, glow: 1.3, w: 2.6, h: 0.18, d: 2.6, y: 7.22 },
        { color: 0xffb03a, emissive: 0xffb03a, glow: 1.1, w: 0.32, h: 0.55, d: 2.6, x: -12.44, y: 2.1 },
        { color: 0xffb03a, emissive: 0xffb03a, glow: 1.1, w: 0.32, h: 0.55, d: 2.6, x: 12.44, y: 2.1 },
      ],
    },

    // Trusses along the dock channel bridge, so the hump on the back straight
    // is standing on something.
    {
      name: 'bridge', place: 'line', variants: 1, shadow: false,
      spacing: 6, offset: 13.6, sides: [1, -1], from: 926, to: 1048,
      parts: [
        { color: 0x3a4655, w: 0.5, h: 3.4, d: 0.5, y: -0.3 },
        { color: 0x3a4655, w: 0.5, h: 0.4, d: 6.2, y: 2.9 },
      ],
    },
  ],

  // x, y, z   world position of the centerline, metres
  // width     FULL road width here, metres
  // surface   applies from this point up to the next
  // banking   radians about the road's own tangent; positive raises the left
  //           edge. A container port is flat, so it is zero throughout.
  controlPoints: [
  { x: 0, y: 0, z: 0, width: 14, surface: 'tarmac', banking: 0 },
  { x: 0, y: 0, z: 23.29, width: 13.9, surface: 'tarmac', banking: 0 },
  { x: 0, y: 0, z: 46.58, width: 13.9, surface: 'tarmac', banking: 0 },
  { x: 0, y: 0, z: 69.87, width: 13.8, surface: 'tarmac', banking: 0 },
  { x: 0, y: 0, z: 93.15, width: 13.7, surface: 'tarmac', banking: 0 },
  { x: 0, y: 0, z: 116.44, width: 13.7, surface: 'tarmac', banking: 0 },
  { x: 0, y: 0, z: 139.73, width: 13.6, surface: 'tarmac', banking: 0 },
  { x: 0, y: 0, z: 163.02, width: 13.5, surface: 'tarmac', banking: 0 },
  { x: 0, y: 0, z: 186.31, width: 13.2, surface: 'tarmac', banking: 0 },
  { x: 0, y: 0, z: 209.6, width: 12.5, surface: 'tarmac', banking: 0 },
  { x: 1.67, y: 0, z: 218.02, width: 12.4, surface: 'tarmac', banking: 0 },
  { x: 6.44, y: 0, z: 225.15, width: 12.3, surface: 'tarmac', banking: 0 },
  { x: 13.58, y: 0, z: 229.92, width: 12.2, surface: 'tarmac', banking: 0 },
  { x: 22, y: 0, z: 231.6, width: 12.1, surface: 'tarmac', banking: 0 },
  { x: 47, y: 0, z: 231.6, width: 11.8, surface: 'tarmac', banking: 0 },
  { x: 72, y: 0, z: 231.6, width: 11.5, surface: 'tarmac', banking: 0 },
  { x: 78.89, y: 0, z: 230.23, width: 11.5, surface: 'tarmac', banking: 0 },
  { x: 84.73, y: 0, z: 226.33, width: 11.6, surface: 'tarmac', banking: 0 },
  { x: 88.63, y: 0, z: 220.49, width: 11.6, surface: 'tarmac', banking: 0 },
  { x: 90, y: 0, z: 213.6, width: 11.6, surface: 'tarmac', banking: 0 },
  { x: 90, y: 0, z: 188.6, width: 11.7, surface: 'tarmac', banking: 0 },
  { x: 90, y: 0, z: 163.6, width: 11.8, surface: 'tarmac', banking: 0 },
  { x: 90, y: 0, z: 138.6, width: 11.9, surface: 'tarmac', banking: 0 },
  { x: 90, y: 0, z: 113.6, width: 12, surface: 'tarmac', banking: 0 },
  { x: 91.83, y: 0, z: 104.41, width: 12, surface: 'tarmac', banking: 0 },
  { x: 97.03, y: 0, z: 96.63, width: 12, surface: 'tarmac', banking: 0 },
  { x: 104.82, y: 0, z: 91.42, width: 12, surface: 'tarmac', banking: 0 },
  { x: 114, y: 0, z: 89.6, width: 12, surface: 'tarmac', banking: 0 },
  { x: 139.6, y: 0, z: 89.6, width: 12, surface: 'tarmac', banking: 0 },
  { x: 165.2, y: 0, z: 89.6, width: 12, surface: 'tarmac', banking: 0 },
  { x: 190.8, y: 0, z: 89.6, width: 12, surface: 'tarmac', banking: 0 },
  { x: 216.4, y: 0, z: 89.6, width: 12, surface: 'tarmac', banking: 0 },
  { x: 242, y: 0, z: 89.6, width: 12, surface: 'tarmac', banking: 0 },
  { x: 267.6, y: 0, z: 89.6, width: 12, surface: 'tarmac', banking: 0 },
  { x: 277.55, y: 0, z: 87.62, width: 12, surface: 'tarmac', banking: 0 },
  { x: 285.98, y: 0, z: 81.98, width: 11.9, surface: 'tarmac', banking: 0 },
  { x: 291.62, y: 0, z: 73.55, width: 11.9, surface: 'tarmac', banking: 0 },
  { x: 293.6, y: 0, z: 63.6, width: 11.8, surface: 'tarmac', banking: 0 },
  { x: 293.6, y: 0, z: 39.6, width: 11.8, surface: 'tarmac', banking: 0 },
  { x: 293.6, y: 0, z: 15.6, width: 11.7, surface: 'tarmac', banking: 0 },
  { x: 293.6, y: 0, z: -8.4, width: 11.6, surface: 'tarmac', banking: 0 },
  { x: 293.6, y: 0, z: -32.4, width: 11.4, surface: 'tarmac', banking: 0 },
  { x: 293.6, y: 0, z: -56.4, width: 11, surface: 'tarmac', banking: 0 },
  { x: 295.73, y: 0, z: -67.12, width: 11, surface: 'tarmac', banking: 0 },
  { x: 301.8, y: 0, z: -76.2, width: 11, surface: 'tarmac', banking: 0 },
  { x: 307.87, y: 0, z: -85.28, width: 11, surface: 'tarmac', banking: 0 },
  { x: 310, y: 0, z: -96, width: 11, surface: 'tarmac', banking: 0 },
  { x: 310, y: 0, z: -121.33, width: 11, surface: 'tarmac', banking: 0 },
  { x: 310, y: 0, z: -146.67, width: 11, surface: 'tarmac', banking: 0 },
  { x: 310, y: 0, z: -172, width: 11, surface: 'tarmac', banking: 0 },
  { x: 308.78, y: 0, z: -178.12, width: 11.1, surface: 'tarmac', banking: 0 },
  { x: 305.31, y: 0, z: -183.31, width: 11.2, surface: 'tarmac', banking: 0 },
  { x: 300.12, y: 0, z: -186.78, width: 11.3, surface: 'tarmac', banking: 0 },
  { x: 294, y: 0, z: -188, width: 11.4, surface: 'tarmac', banking: 0 },
  { x: 277.25, y: 0.93, z: -188, width: 12, surface: 'tarmac', banking: 0 },
  { x: 260.5, y: 2.38, z: -188, width: 12.7, surface: 'tarmac', banking: 0 },
  { x: 243.75, y: 2.97, z: -188, width: 12.9, surface: 'tarmac', banking: 0 },
  { x: 227, y: 3.4, z: -188, width: 12.9, surface: 'tarmac', banking: 0 },
  { x: 210.25, y: 2.97, z: -188, width: 12.8, surface: 'tarmac', banking: 0 },
  { x: 193.5, y: 2.38, z: -188, width: 12.7, surface: 'tarmac', banking: 0 },
  { x: 176.75, y: 0.93, z: -188, width: 12.6, surface: 'tarmac', banking: 0 },
  { x: 160, y: 0, z: -188, width: 12.5, surface: 'tarmac', banking: 0 },
  { x: 150.82, y: 0, z: -186.17, width: 12.5, surface: 'tarmac', banking: 0 },
  { x: 143.03, y: 0, z: -180.97, width: 12.5, surface: 'tarmac', banking: 0 },
  { x: 137.83, y: 0, z: -173.18, width: 12.5, surface: 'tarmac', banking: 0 },
  { x: 136, y: 0, z: -164, width: 12.5, surface: 'tarmac', banking: 0 },
  { x: 136, y: 0, z: -137, width: 12.5, surface: 'tarmac', banking: 0 },
  { x: 136, y: 0, z: -110, width: 12.5, surface: 'tarmac', banking: 0 },
  { x: 134.48, y: 0, z: -102.35, width: 12.5, surface: 'tarmac', banking: 0 },
  { x: 130.14, y: 0, z: -95.86, width: 12.6, surface: 'tarmac', banking: 0 },
  { x: 123.65, y: 0, z: -91.52, width: 12.6, surface: 'tarmac', banking: 0 },
  { x: 116, y: 0, z: -90, width: 12.6, surface: 'tarmac', banking: 0 },
  { x: 92.5, y: 0, z: -90, width: 12.7, surface: 'tarmac', banking: 0 },
  { x: 69, y: 0, z: -90, width: 12.8, surface: 'tarmac', banking: 0 },
  { x: 45.5, y: 0, z: -90, width: 12.9, surface: 'tarmac', banking: 0 },
  { x: 22, y: 0, z: -90, width: 13, surface: 'tarmac', banking: 0 },
  { x: 13.58, y: 0, z: -88.33, width: 13.3, surface: 'tarmac', banking: 0 },
  { x: 6.44, y: 0, z: -83.56, width: 13.5, surface: 'tarmac', banking: 0 },
  { x: 1.67, y: 0, z: -76.42, width: 13.8, surface: 'tarmac', banking: 0 },
  { x: 0, y: 0, z: -68, width: 14, surface: 'tarmac', banking: 0 },
  { x: 0, y: 0, z: -45.33, width: 14, surface: 'tarmac', banking: 0 },
  { x: 0, y: 0, z: -22.67, width: 14, surface: 'tarmac', banking: 0 },
  ],
};
