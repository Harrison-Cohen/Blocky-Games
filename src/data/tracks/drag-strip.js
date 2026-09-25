// Mesa Dragway. A quarter-mile drag strip.
//
// THIS FILE IS DATA, like every track. The `drag` block below is what makes
// it a drag strip: the game sees it and runs drag passes here instead of laps
// -- a tree of start lights, reaction time, ET and trap speed, and two players
// side by side (N). See src/game/Drag.js.
//
// Layout: a real dragway is not a line, it is a loop. The strip runs straight
// from the staging area through the quarter mile and a long shutdown area,
// a turnaround takes you onto the return road beside it, and a second
// turnaround brings you back behind the line. So the track system sees an
// ordinary closed circuit, and the lap timer, the AI and every check work on it
// as they do on the others.
//
//   control point 0   80 m behind the start line, at the end of the turnaround
//   start line        80 m along (startDistance)
//   finish            the start line + drag.distance, a quarter mile
//   shutdown          418 m of strip past the finish, then a 30 m turnaround
//   return road       60 m to the right of the strip, back to the start
//
// Flat, as a drag strip has to be, with concrete walls three metres off it.

export default {
  id: 'drag-strip',
  name: 'Mesa Dragway',
  description: 'A quarter-mile drag strip. Race the clock, or a friend in the other lane.',
  order: 6,
  targetLap: 60,

  startDistance: 80,

  // A drag strip: two lanes, each `lane` metres either side of the centreline,
  // timed over `distance` metres from the start line.
  drag: { lane: 3.3, distance: 402.336 },

  runoffSurface: 'tarmac',
  barrierStyle: 'wall',
  barrierGap: 3,
  apronWidth: 8,
  terrain: { amplitude: 0, fade: 140 },
  // A solid white line between the two lanes: a dash longer than the track.
  markings: { centre: true, dash: 5000, gap: 1 },

  palette: {
    sky: 0xbfd4e4,
    fog: 0xbfd4e4,
    ground: 0x6f7d45,
    road: 0x3a3a3c,
    curbA: 0xe9e7df,
    curbB: 0x2c2c2e,
    barrier: 0xcdc8bc,
    runoff: 0x7a776f,
    lines: 0xf1efe6,
    sun: 0xfff0d8,
    hemiGround: 0x505c34,
  },
  fog: { near: 200, far: 900 },
  sunDirection: { x: 0.5, y: 0.8, z: -0.3 },
  sunIntensity: 2.2,
  hemiIntensity: 1.0,
  sky: { top: 0x4a86c5, gradient: 0.35, haze: 0.3, clouds: 18, cloudHeight: 300,
    cloudColor: 0xfbf7ee, wind: 2, discGlow: 6 },
  post: { bloom: 0.25, bloomThreshold: 1.5 },

  props: [
    // Grandstands down the left of the strip, from behind the line to past the
    // finish. Line props run in metres from control point 0, so the start line
    // is at 80 and the finish at 482.
    {
      name: 'grandstand', place: 'line', variants: 1, spacing: 30, offset: 19,
      sides: [1], from: 50, to: 520,
      parts: [
        { color: 0x9a968c, w: 12, h: 1.1, d: 27, x: 0 },
        { color: 0x9a968c, w: 9, h: 1.1, d: 27, x: 1.5, y: 1.1 },
        { color: 0x9a968c, w: 6, h: 1.1, d: 27, x: 3, y: 2.2 },
        { color: 0x9a968c, w: 3, h: 1.1, d: 27, x: 4.5, y: 3.3 },
        { color: [0x2f5fa8, 0xc23a2a], w: 11.6, h: 0.35, d: 26, x: 0.2, y: 1.1 },
        { color: 0x55524c, w: 0.4, h: 7.5, d: 0.4, x: 5.8, z: 12 },
        { color: 0x55524c, w: 0.4, h: 7.5, d: 0.4, x: 5.8, z: -12 },
        { color: 0xe9e7df, w: 13, h: 0.3, d: 28, x: 1, y: 7.5 },
      ],
    },
    // Floodlight towers both sides of the strip.
    {
      name: 'floodlights', place: 'line', variants: 1, spacing: 60, offset: 14,
      from: 20, to: 880, shadow: false,
      parts: [
        { color: 0x6b6f75, w: 0.5, h: 16, d: 0.5 },
        { color: 0x6b6f75, w: 2.6, h: 1.1, d: 0.7, x: -0.9, y: 16 },
        { color: 0xfff4d6, unlit: true, w: 2.4, h: 0.9, d: 0.1, x: -0.9, y: 16.1, z: 0.36 },
      ],
    },
    // The timing boards beside the finish line, on the right.
    {
      name: 'scoreboard', place: 'line', variants: 1, spacing: 100, offset: 16,
      sides: [-1], from: 478, to: 490,
      parts: [
        { color: 0x55524c, w: 0.5, h: 5, d: 0.5, z: 5 },
        { color: 0x55524c, w: 0.5, h: 5, d: 0.5, z: -5 },
        { color: 0x14161a, w: 0.8, h: 4, d: 13, y: 5 },
        { color: 0xff7a1a, unlit: true, w: 0.1, h: 0.5, d: 12, x: -0.45, y: 8.2 },
      ],
    },
    // Low scrub on the flats around the strip.
    {
      name: 'scrub', count: 140, variants: 3, clearance: 6,
      minOffset: 30, maxOffset: 260, minScale: 0.7, maxScale: 1.8,
      parts: [
        { color: [0x566b35, 0x4a5e2e, 0x6b7a3f],
          w: [1.2, 3], h: [0.8, 2], d: [1.2, 3],
          repeat: [1, 3], shrink: [0.6, 0.85], rise: [-0.5, -0.2], spin: [0, 1.5], jitter: 2 },
      ],
    },
  ],

  controlPoints: [
    // The strip, heading +z: staging, the quarter mile, the shutdown area.
    ...Array.from({ length: 23 }, (_, k) =>
      ({ x: 0, y: 0, z: -80 + 40 * k, width: 14, surface: 'tarmac', banking: 0 })),
    // Turnaround onto the return road, radius 30 about (30, 800).
    { x: 4.02, y: 0, z: 815, width: 10, surface: 'tarmac', banking: 0 },
    { x: 15, y: 0, z: 825.98, width: 10, surface: 'tarmac', banking: 0 },
    { x: 30, y: 0, z: 830, width: 10, surface: 'tarmac', banking: 0 },
    { x: 45, y: 0, z: 825.98, width: 10, surface: 'tarmac', banking: 0 },
    { x: 55.98, y: 0, z: 815, width: 10, surface: 'tarmac', banking: 0 },
    // The return road, heading -z.
    ...Array.from({ length: 23 }, (_, k) =>
      ({ x: 60, y: 0, z: 800 - 40 * k, width: 10, surface: 'tarmac', banking: 0 })),
    // Turnaround back behind the start line, radius 30 about (30, -80).
    { x: 55.98, y: 0, z: -95, width: 10, surface: 'tarmac', banking: 0 },
    { x: 45, y: 0, z: -105.98, width: 10, surface: 'tarmac', banking: 0 },
    { x: 30, y: 0, z: -110, width: 10, surface: 'tarmac', banking: 0 },
    { x: 15, y: 0, z: -105.98, width: 10, surface: 'tarmac', banking: 0 },
    { x: 4.02, y: 0, z: -95, width: 10, surface: 'tarmac', banking: 0 },
  ],
};
