# Claude Code build prompt: blocky browser racing sim

Paste this whole file into Claude Code, or save it as `PROMPT.md` in an empty folder and say "read PROMPT.md and build it, milestone by milestone."

---

## The build

Build a 3D blocky racing simulator that runs in the browser and is served from my own machine. Two modes: time trial against the clock, and a race against AI opponents. No multiplayer, no backend, no network calls at runtime. Three playable tracks, four car chassis with visual customization, and precise lap timing with persistent best times.

Start by reading this whole brief, then give me a short plan and your proposed file tree before writing code. Build in the milestone order at the bottom and stop after each milestone so I can drive it and give feedback.

## Stack and constraints

- Vite + vanilla JavaScript (ES modules) + Three.js. No React, no TypeScript, no CSS framework.
- `npm install` then `npm run dev` is the only thing I should need to run it.
- Three.js is the only runtime dependency. If you want post-processing, use the `examples/jsm` modules that ship with Three.js.
- Zero external art assets. Every mesh is generated in code from boxes, cylinders and extruded shapes. Fonts load from Google Fonts, everything else is procedural.
- All gameplay tuning constants live in one file, `src/data/tuning.js`, with a comment on each value explaining what it does and a sane range. I will be editing this a lot.
- When I ask for changes later, make targeted edits to the relevant files. Do not rewrite whole files to change a handful of lines.
- Target a locked 60 fps at 1080p on integrated graphics. Cap `devicePixelRatio` at 1.5, use instanced meshes for repeated scenery, and share materials across objects of the same color.

## Controls

Keyboard and gamepad, both live at the same time, no config screen needed.

- Keyboard: WASD or arrows to drive, Space for handbrake, R to reset to the last checkpoint, Esc to pause, C to cycle camera.
- Gamepad: analog triggers for throttle and brake, left stick for steering, A/cross for handbrake, Start to pause. Steering and throttle must read the analog axes properly, not treat them as buttons.
- Show a short controls card on the pause screen and on first launch.

## Driving model

Aim for the exact middle between a sim and a party racer. Forgiving enough to be fun on a keyboard with no assists to learn, but with real weight transfer and a clear difference between cars. Write a custom model, do not pull in a physics engine, and do not chase real tire data. Every element below should be the simplest version that still produces believable behavior.

- Longitudinal: engine force curve that falls off with speed, drag proportional to speed squared, rolling resistance, separate brake force, reverse below a small speed threshold.
- Lateral: a bicycle model with separate front and rear grip limits and a soft falloff past the limit, rather than a full slip angle tire curve. Losing the rear should be readable and catchable with a lift or countersteer, never a coin flip. Keep the falloff in one small function so I can sharpen or soften it from `tuning.js`.
- Steering rate scales down as speed rises so the car is not twitchy at top speed.
- Handbrake cuts rear grip sharply for deliberate drifts, and grip returns smoothly rather than snapping.
- Surface affects grip: tarmac is the baseline, gravel is roughly 0.75 grip with extra drag, grass is around 0.55 with heavy drag. Read the surface from the track data, not from a texture.
- Simple suspension: four raycasts down from the chassis corners, spring and damper per corner, so the body pitches under braking, rolls in corners and lands on crests. This body motion is most of what sells the feel, so spend time on it.
- Weight transfer from that suspension feeds the front and rear grip limits, so braking loads the front and throttle loads the rear. That single link is the one place the model leans toward sim. Everything else stays simple.
- Collision with barriers: keep the car inside the track ribbon using a distance-to-centerline check plus a scrape response that scrubs speed and pushes the car back in. Add box colliders only for freestanding props.
- Fixed timestep physics at 120 Hz with an accumulator, rendering interpolated between steps. This keeps handling identical regardless of frame rate.

## Track system

Tracks are data, not hand-built geometry. A track file is an array of control points with `{ x, y, z, width, surface, banking }`, plus metadata (name, description, sky and ground palette, prop list, target lap time).

At load time, generate from that data:

- A Catmull-Rom centerline, resampled at fixed arc length.
- The road ribbon mesh with correct banking and a chunky raised curb strip on both sides, curbs alternating two colors.
- Barriers: low blocky walls, tire stacks or guardrails depending on the track theme.
- Checkpoint gates every 60 to 80 meters, invisible, ordered, used for lap validation and for the reset position.
- A start/finish line with a checkered strip and an overhead gantry.
- A minimap path derived from the same spline, so it can never disagree with the track.

Adding a fourth track later must mean writing one data file and nothing else.

### The three tracks

1. **Copper Flats.** Desert mesa. Wide, fast and flowing, one long straight, a fast sweeper, two medium corners and a single tight hairpin to punish overdriving. All tarmac. Target lap around 55 seconds. Palette: rust orange ground, pale sky, dusty haze. Props: stacked-box mesas, cacti, low rock clusters.
2. **Harbor Nine.** Night container port. Tight and technical, right angle corners between stacked shipping containers, one chicane, one long dark tunnel section, guardrails everywhere so mistakes cost time. Wet-looking tarmac with a higher specular response and reflected light strips. Target around 70 seconds. Palette: deep blue night, sodium lamp amber, container reds and teals.
3. **Pine Ridge.** Forest hill climb loop. Real elevation change, a banked downhill sweeper, a crest that gets the car light, and a gravel middle sector that rewards throttle control. Mixed surfaces. Target around 80 seconds. Palette: cold green, slate rock, low fog between the trees.

Each track gets its own fog color, light direction and ground tint so the three feel like different places, not one place recolored.

## Cars and the garage

Four chassis, each visibly different in silhouette and clearly different to drive:

| Chassis | Feel | Trade |
| --- | --- | --- |
| Cube GT (hot hatch) | Balanced, high grip, easy | Lowest top speed |
| Boxhauler V8 (muscle) | Big top speed, loose rear | Slow to change direction, punishes late braking |
| Wedge One (open wheel) | Fastest cornering and acceleration | Very low grip on gravel, twitchy at the limit |
| Haul 4x4 (offroad truck) | Best on gravel and crests, stable | Heavy, rolls in corners, slow on tarmac |

Stats per chassis: `topSpeed`, `power`, `mass`, `gripFront`, `gripRear`, `steerRate`, `downforce`, `offroadGrip`, `centerOfMassHeight`. All in `src/data/cars.js`, all tunable.

Customization, all built from primitives and all live-previewed on a slowly rotating turntable in the garage:

- Primary and secondary paint from a fixed palette of 12 colors, plus a livery pattern picker (none, racing stripes, split, quarter panels, checker).
- Wheel style (blocky, five-spoke, deep dish, offroad knobby) and wheel color.
- Spoiler (none, lip, ducktail, big wing) and roof item (none, light bar, roof box, spare tire).
- Headlight color, plus a number roundel with a driver number I can type.
- Save the whole configuration to `localStorage` and reload it on launch. Also save the last selected track.

Cosmetic choices must not change stats. Chassis choice is the only thing that changes handling.

## Race mode and AI opponents

Two modes share the same track, car and timing code:

- **Time trial.** Empty track, unlimited laps, ghost car, restart instantly.
- **Race.** Rolling field of AI cars, fixed lap count, standing grid start, finishing positions.

Race settings live on the track select screen: lap count (3 by default), opponent count (5 by default, up to 7), and difficulty (Rookie, Club, Pro).

### How the AI drives

- Opponents run the exact same `VehiclePhysics` as the player and are controlled by an input layer that outputs throttle, brake and steering. Never move an AI car by lerping it along the spline, and never let it exceed the grip its chassis has.
- At track load, precompute a racing line: take the centerline, pull it toward the inside at corner apexes and toward the outside on entry and exit, then smooth it. Sample curvature along that line, derive a maximum speed per sample from curvature and grip, then do a backward pass to place braking points. This speed profile is what the AI targets.
- Steering is pure pursuit toward a lookahead point on the racing line, with the lookahead distance scaling with speed. Throttle and brake come from the difference between current speed and the target speed for the upcoming section.
- Each opponent gets its own small lateral offset from the line, a per-driver braking margin, and a per-driver apex speed multiplier, so they do not run nose to tail in a single file.
- Difficulty scales the target speed multiplier, the braking margin and the mistake rate. Rookie should be beatable in the Cube GT on the first try. Pro should require a clean lap.
- Mistakes are real and occasional: an early lift, a slightly missed apex, a small overshoot. No stuttering, no obvious teleporting back to the line.
- No rubber banding by default. Include a `catchUp` toggle in `tuning.js`, off by default, that gives trailing cars a small speed bonus.

### Awareness and contact

- Each AI checks a short lookahead cone for other cars. If one is close ahead, it picks a side with room and takes a temporary lateral offset to pass, then returns to the line. If contact is imminent and there is no room, it lifts.
- Opponents collide with the player and with each other using the same scrape response as the barriers: speed is scrubbed and cars are pushed apart. The player must not be able to punt an AI car across the map, and an AI car must not be able to end the player's race.
- Opponents are constrained to the track the same way the player is.

### Grid, standings and results

- Standing grid, staggered two by two, player last by default. Lights out after the countdown.
- Live position is computed from lap number, last checkpoint index, and distance to the next checkpoint. Never compute it from raw world distance.
- HUD in race mode adds position (`P4/6`) and the gap in seconds to the car ahead and the car behind.
- Race results screen: finishing order with each driver's total time, gap to winner, and best lap, with the fastest lap of the race marked in purple.
- Opponent cars are built with the same `CarBuilder`, each given a distinct livery, color and number from the palette, and a name from a fixed list. Their chassis mix should vary so the field is not five identical cars.

## Timing

This is the core of the game, so it has to be exact.

- Time from the physics clock, not `Date.now()` and not frame deltas.
- Three sectors per track, split evenly along the centerline. Show sector splits as you cross them, held on screen for two seconds.
- Live delta against your best lap on the current track and chassis, colored using motorsport convention: purple for an overall best, green for a personal best sector, yellow for slower.
- A lap is invalid if you miss checkpoints in order, reverse across a checkpoint, or have all four wheels off the track surface for more than 1.5 seconds. Invalid laps show struck through and are not saved.
- Best lap per track per chassis, persisted in `localStorage`, shown on the track select screen.
- Ghost car: record position and rotation at 30 Hz on your best lap, replay it as a translucent flat-shaded copy of the car you set it in, and let me toggle it off.
- Lap invalidation applies to time trial and to record keeping only. A messy lap in a race still counts toward the race distance, it just cannot set a saved best.
- Results screen after each time trial session: lap list, best lap, best possible lap from the best sectors, and a "new record" state that actually feels like something.

## Art direction

The look is chunky, saturated and readable, not gritty realism and not a soft pastel toy. Think physical objects made of large blocks under a hard sun.

- Flat shading everywhere (`flatShading: true`, MeshLambertMaterial). No textures, no normal maps, no PBR.
- One hemisphere light for ambient bounce plus one directional light with soft shadows at 1024 or 2048 resolution, tightly fitted around the car so shadows stay crisp.
- Fog color always matches the horizon color so scenery fades out instead of popping in.
- Scenery is built from stacked boxes with slight random rotation and scale variation, placed along the spline with an offset and jitter, drawn with instanced meshes.
- Cars read as toys: hard edges, visible wheel arches, blocky mirrors, no rounded fillets.

### Interface

Keep the HUD sparse. The car and track are the design, the HUD is signage.

- Type: Martian Mono for all timing and speed readouts, since its wide blocky forms match the world and it has real tabular figures. Archivo for menus, labels and body text. Two families total.
- Palette: ink `#0E1A2B` for panels, signal orange `#FF7A1A` for primary actions and the speed readout, off white `#EDEDE7` for text, and the motorsport timing colors `#B57BFF` purple, `#34D17A` green, `#F5C518` yellow.
- HUD layout: large speed and a small gear indicator bottom right, lap counter and current lap time top center with best underneath, live delta directly under the current time, minimap bottom left with a dot for the car and a dot for the ghost, sector flash center screen. In race mode, position and the gaps ahead and behind sit top left, and the minimap shows every car.
- Panels are hard edged rectangles with a solid fill and a single accent rule, no rounded card grid, no drop shadows, no glass blur.
- Screens: title, garage, track select, in-race HUD, pause, results. Menus are keyboard and gamepad navigable with a clear focus state, not mouse only.
- Do not use all caps labels, and do not put an arrow after button text. Buttons say what happens: "Start lap", "Save car", "Back to garage".

### Feel and polish

- Camera: spring-damped chase cam that lags slightly in corners and pulls back with speed, FOV rising from 70 to 88 across the speed range. Cockpit and far chase as alternates on the C key.
- Dust and gravel particles from the driven wheels on loose surfaces, tire smoke when the rear slips past its grip limit, and skid mark decals on tarmac that fade after a while.
- Short screen shake on wall contact, scaled by impact speed, and a speed scrub that hurts.
- Audio synthesized with the Web Audio API, no files: engine tone driven by RPM with a filtered saw, tire scrub noise that rises with slip, a thump on collision, and a three tone countdown. One master volume slider, and mute when the tab is hidden.
- A 3, 2, 1, go countdown that holds the car still, then releases.

## File structure

```
racing-game/
  index.html
  package.json
  vite.config.js
  src/
    main.js
    core/       Game.js  Loop.js  Input.js  Storage.js  Audio.js
    render/     Scene.js  ChaseCamera.js  Materials.js  Particles.js
    game/       Vehicle.js  VehiclePhysics.js  CarBuilder.js
                Track.js  TrackMesh.js  Checkpoints.js  LapTimer.js  Ghost.js
    ai/         RacingLine.js  SpeedProfile.js  AIDriver.js  Standings.js
    data/       tuning.js  cars.js  palette.js  tracks/copper-flats.js
                tracks/harbor-nine.js  tracks/pine-ridge.js
    ui/         Screens.js  Garage.js  HUD.js  Results.js  styles.css
```

## Milestones

Stop after each one and tell me what to test.

1. Project scaffold, flat ground plane, one box car, working physics and chase camera. Driveable and already feels decent.
2. Track spline system, generated road mesh and barriers, Copper Flats playable end to end.
3. Checkpoints, lap validation, timing, HUD and results screen.
4. Garage: four chassis, all customization options, live preview, persistence.
5. Harbor Nine and Pine Ridge, including surface types and scenery.
6. Racing line, speed profile and a single AI car that laps cleanly and is not obviously on rails.
7. Full race mode: grid start, field of opponents, awareness and passing, live standings, race results.
8. Ghost car, particles, skid marks, audio, camera polish.
9. Title, track select and pause screens, plus a pass on performance and any rough edges.

## Done means

- `npm install && npm run dev` gives me a playable game with no console errors or warnings.
- Steady 60 fps on all three tracks with a full six car field.
- All four cars feel meaningfully different back to back on the same track.
- The AI is beatable on Rookie and genuinely hard on Pro, drives a line I would drive, and races side by side without turning into bumper cars.
- Lap times are accurate, invalid laps are caught, and best times survive a page reload.
- Nothing on screen looks like a default UI kit.
