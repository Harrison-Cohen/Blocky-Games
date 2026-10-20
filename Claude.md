# Racing game

Blocky 3D browser racing sim. Time trial, race against AI opponents, and a
drag strip for one or two players (split screen). Six tracks (one a drag
strip), seven chassis (six modelled on real cars), customizable cars, precise
lap and drag timing.

Full spec is in PROMPT.md. Read it before starting new work on a milestone.

Picking this up in a new session? Read HANDOFF.md first: current state, the
user's open requests, standing instructions, and testing gotchas.

## Commands

```
npm install
npm run dev     # the only thing needed to play it
npm run build

npm run check   # frame-rate invariant, unchanged by paint, reverses correctly
npm run lap     # every chassis can lap every track, clean
npm run timing  # lap timing, sectors and the validation rules
npm run parts   # no car part floats or is sealed inside another; cars sit on hills
npm run ai      # the racing line is a racing line, and the AI laps it clean
npm run race    # a full field races every track to the flag, cleanly
npm run fx      # the ghost replays exactly, the gearbox never hunts, a gearbox tune is felt, skid marks sit on the road
npm run specs   # every real car does its 0-60, quarter mile, top speed, grip and turning circle (real, scaled by STREET)
npm run drag    # drag passes are timed right: reaction, splits, ET, trap speed, red lights and fouls
```

The check scripts run headless against the real Track, VehiclePhysics and
CarBuilder, with no browser and no renderer. Run all nine before calling a
milestone done.

## Stack

Vite + vanilla JavaScript (ES modules) + Three.js. No React, no TypeScript,
no CSS framework. Three.js is the only runtime dependency. Ask before adding
any package, including dev dependencies.

## Rules

- Make targeted edits to existing files. Do not rewrite a whole file to change
  a few lines, and do not reformat code you were not asked to touch.
- All gameplay tuning constants live in `src/data/tuning.js`, each with a
  comment explaining what it does and a sane range. I edit this file often,
  so never move values out of it or hardcode them elsewhere.
- Physics runs on a fixed 120 Hz timestep with an accumulator. Rendering
  interpolates between steps. Handling must be identical at any frame rate.
- No external art assets. Every mesh is generated in code from primitives.
  Fonts are self-hosted woff2 in `public/fonts/`, so the game makes no network
  calls at all at runtime and the timing readouts never fall back to a
  proportional face mid-lap.
- No network calls at runtime, no backend, no analytics.
- Tracks are data. A new track is one file in `src/data/tracks/` and nothing
  else. If adding a track requires touching other files, the track system is
  wrong and needs fixing instead.
- AI cars run the same `VehiclePhysics` as the player and are driven by an
  input layer. Never move an AI car by interpolating it along a spline.
- Cosmetic customization never changes handling. Chassis is the only thing
  that changes stats, apart from the garage's gearbox tune (final drive, gear
  ratios, shift point), which is kept per chassis apart from the cosmetics.

## Look and feel

- Smooth cars, chunky world. This is the one deliberate split in the art
  direction and it is what the game looks like.
  - Cars are smooth shaded with rounded edges and a specular highlight
    (`glossy()`, MeshPhongMaterial). Bodywork boxes are bevelled, wheels are
    round with sidewalls, rims and spokes. Spend polygons here.
  - Everything else is flat shaded Lambert (`flat()`) with hard facets: road,
    curbs, barriers, terrain, scenery. Higher polygon counts are welcome, but
    the world stays faceted rather than becoming smooth.
- No textures and no PBR anywhere. Phong is one specular term, not a PBR
  model, and it is only ever used on cars.
- Never construct a material outside `src/render/Materials.js`.
- Type: Martian Mono for timing and speed readouts, Archivo for menus and
  labels. Two families total.
- Palette: ink `#0E1A2B`, signal orange `#FF7A1A`, off white `#EDEDE7`, and
  the timing colors `#B57BFF` purple, `#34D17A` green, `#F5C518` yellow.
- HUD panels are hard edged rectangles. No rounded card grid, no drop
  shadows, no glass blur, no all caps labels, no arrows after button text.
- Buttons say what happens: "Start lap", "Save car", "Back to garage".

## Performance

Target a locked 60 fps at 1080p on integrated graphics with a full six car
field. Cap `devicePixelRatio` at 1.5, use instanced meshes for repeated
scenery, share materials across objects of the same color.

## Workflow

- Build one milestone at a time, in the order given in PROMPT.md.
- Stop at the end of each milestone, tell me exactly what to test, and wait.
  Do not roll into the next milestone on your own.
- I run the game and test it in the browser. You cannot see the screen, so
  never assume something looks or drives correctly. Ask me.
- Before saying a milestone is done, confirm the dev server starts clean with
  no console errors or warnings.
- When I report a handling problem, change values in `tuning.js` first and
  only touch the physics code if the model itself is wrong.

## Flight

A second mode: a large open world flown in an F-22 Raptor, a Boeing 737-800
and an invented helicopter. Full spec is in FLIGHT.md. Read it before starting
flight work.

Commands, in addition to the nine above:

```
npm run flight    # trim, stall and recovery, published figures, hover, gear, damage
npm run world     # height function, chunk seams, airports, track placement, origin rebasing
npm run combat    # cannon, missiles, flares, combat AI
npm run airrace   # AI pilots finish every course, gate timing, ghosts
npm run missions  # every mission type completes and scores
```

Rules:

- Flight lives in `src/flight` and `src/world`. Car modes must not change
  behaviour, and all nine car checks must keep passing.
- Flight physics is headless, fixed 120 Hz, no Three.js and no allocation in
  `step()`. Aircraft stats live in `src/data/aircraft.js`.
- AI aircraft run the same `AircraftPhysics` as the player. Never move one along
  a path. The only exceptions are distant ambient scenery (recorded track laps,
  air and road traffic), which hands over to live physics when you come near.
- The ground is one height function used by both the mesh and the physics.
  No raycasts.
- The scene graph is placed through `WorldOrigin`. Physics stays in absolute
  coordinates.
- Races, missions and arenas are data: one file each, found by a registry.
  A new track places itself in the world and on the map.
- Hangar loadout and tuning are kept apart from cosmetics, like gearbox tunes.
  Cosmetics never change handling.
- Everything is unlocked through `isUnlocked()`, so progression can be added
  later.
- Aircraft are smooth shaded like the cars. The world is flat shaded and
  faceted.
- Performance: 60 fps on a MacBook Air M5 at the default render distance and
  Medium graphics.
