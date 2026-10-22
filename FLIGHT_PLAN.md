> **This is the plan for flight milestone 1 and the review of FLIGHT.md that the
> user approved on 2026-10-19.** It is kept in the repo because it also holds
> the answers to FLIGHT.md's eight "Open items" (which govern milestone 2 on),
> the approved flight controls mapping, and the list of things in FLIGHT.md that
> do not work as written. Where the build differs from it (the auto-trim, the
> rates, the rudder and several details), `HANDOFF.md` (section 5, flight architecture) is the truth.
> Milestones 1 to 5 are built; see `HANDOFF.md` section 1 for what is next.

# Flight: milestone 1 plan, and a review of FLIGHT.md

Read, in order: HANDOFF.md, Claude.md, PROMPT.md, FLIGHT.md. I then read Input, Loop, Storage, Scene, Materials, Sky, PostFX, Game, Screens, Track, TrackMesh, CarBuilder, Garage, Audio, Vehicle, the tuning.js graphics blocks and the track registry, to check FLIGHT.md against what is really there. No code written. Branch is `Flight_test`; nothing committed (commit only when you ask, as you, no Claude trailer).

## 0. The short version

- Milestone 1 is buildable as specced, with three additions the spec's file tree misses: `FlightInput.js`, `FlightCamera.js` (the car `ChaseCamera` is yaw-only and takes a chassis) and a small contact-only `Gear.js`, so the F-22 can roll and lift off the runway.
- **Five things in FLIGHT.md will not work as written** (section 3, A to E). The two that matter most: the ground height has two sources of truth in the existing code, and a pure SimpleWings model has no Mach effects, so the F-22 and the 737 would not hit their published speeds.
- Two edits to existing car code are needed later, both additive and guarded: export `Loft` (M1, one word) and pull `TrackMesh._terrainHeight` into a headless `TrackGround` (M2, with a before/after height proof).

## 1. Milestone 1: what gets built

Scope is FLIGHT.md's: headless `AircraftPhysics`, `Wing`, `Engine`, `Atmosphere`, the F-22 data and first body, a flat test field with a runway, chase camera, minimal HUD, keyboard/pad/mouse flight, basic engine sound, the title screen's Fly entry, `npm run flight`.

### File tree (new files marked +, edited files marked ~)

```
src/flight/                    (all headless: plain numbers, no Three.js, no allocation in step())
  + Atmosphere.js      ISA density, pressure, temperature, speed of sound; Mach, TAS, EAS/IAS
  + Wing.js            one lifting surface: curves, control authority, force and torque
  + Engine.js          thrust vs throttle, altitude and Mach; spool lag; afterburner tank; nozzle
  + Gear.js            CONTACT ONLY in M1: spring/damper points, rolling friction, nose steer, brake
  + AircraftPhysics.js rigid body, quaternion, 120 Hz step, aids, render-state snapshot
  + Aircraft.js        binds physics to the mesh (the Vehicle.js role), nozzle and flame animation
  + Units.js           knots/feet/Mach, mph, metric
src/world/
  + TestField.js       flat field + runway implementing the ground contract sample(x,z,y)
src/data/
  + aircraft.js        F-22 entry, the published figures with their sources, refit targets
  + unlocks.js         isUnlocked(kind, id) -> true
  ~ tuning.js          new FLIGHT blocks APPENDED at the end; no existing value touched
src/render/
  + AircraftBuilder.js F-22 body from Loft panels, canopy, intakes, canted twin fins, stabilators
  + FieldMesh.js       ground, runway, markings, speed-reference pylons (replaced by WorldMesh in M2)
  + FlightCamera.js    chase, cockpit, far orbit, free look (NOT in FLIGHT.md's tree)
  ~ CarBuilder.js      `class Loft` -> `export class Loft` (line 179). Nothing else.
  ~ Scene.js           additive methods only, see item 6
src/core/
  + FlightGame.js      owns the flight loop, pause, restart
  + FlightInput.js     keyboard/pad/mouse -> control state (NOT in FLIGHT.md's tree)
  + FlightAudio.js     jet, afterburner, wind, stall tone, built into SoundEngine's master gain
  ~ Game.js            one title row, `Fly`, calling `this.onFly()`; nothing else
src/ui/
  + FlightHud.js       speed, altitude, AoA, g, throttle, afterburner, horizon and pitch ladder
  + FlightScreens.js   Fly menu, flight pause card, flight controls card (DOM built in JS)
  ~ styles.css         one appended block
src/main.js            ~ wires game.onFly -> FlightGame
scripts/
  + check-flight.mjs
  + fit-aircraft.mjs   refits an aircraft to its published numbers, as fit-specs.mjs does
package.json           ~ "flight" script. No new packages.
HANDOFF.md             ~ new section 10, Flight
```

### Conventions (open item 4)

- **Body frame: +x LEFT, +y up, +z nose.** The same as the car bodies (HANDOFF section 5, the comment at Input.js:296), so FLIGHT.md's "right at -x" is correct. Right-handed (x = y cross z).
- **Orientation is a unit quaternion**, angular velocity in the body frame, all maths right-handed. So +wx is nose DOWN, +wy is nose LEFT, +wz is roll RIGHT. No Euler angles in the physics: that is the class of bug behind the pitch-sign error in the bug history (section 6 of HANDOFF).
- Pitch (+ nose up), bank (+ right wing down) and compass heading come out of ONE function, `attitude(q, out)`. World north is +z, east is -x. The mesh takes the quaternion directly, so there is no conversion at render time.
- Inputs are flipped once at the boundary, as `Input.js` does for steering: `FlightInput` outputs pitch (+1 pull), roll (+1 right), yaw (+1 right), throttle 0..1; `Wing` maps them to deflections with the signs written in one place.
- Physics state in absolute doubles. Digital keys are ramped inside the fixed step, analog passed through, as the car does.

### Physics design

- **Surfaces (6):** left and right wing (39 m2 each), left and right stabilator (pitch, and differential for roll), twin canted fins (rudder). Each: area, position, chord axis, normal, control mapping.
- **Per step, per surface:** local airflow = v + w x r, angle of attack from the chord and normal, CL and CD from that surface's curves, force `0.5 rho v^2 S C`, lift perpendicular to the airflow, drag opposing it, applied at the surface so torque falls out of geometry. Curves are tables in `aircraft.js` with one small lookup function each (linear, peak near 15 to 18 deg, soft stall, flat plate after).
- **What the spec leaves out and the model needs:**
  - A Mach table for lift slope and for wave drag (item A in section 3).
  - A body drag term (fuselage CdA) and a little body lift.
  - IAS/EAS next to TAS, because stall, approach and rotation speeds are indicated speeds.
- **Engines:** two, each with dry and afterburner thrust at sea level static, a lapse with air density and Mach, first-order spool lag, fuel flow. The afterburner has its own tank that drains while on and refills while off. Thrust vectoring: pitch only (that is the real F-22), plus or minus 20 deg, authority = max(0, 1 - aero authority) so it fades out as dynamic pressure rises, force applied along the rotated axis at the nozzle (so it costs forward thrust by cos).
- **Aids, each a knob with a master switch:** roll self-levelling, AoA softening near stall, a recoverable stall and spin, auto-trim (an integrator that nulls pitch rate when the stick is centred), a soft +9 g limiter, authority fading with dynamic pressure, per-axis rate damping.
- **Integration:** semi-implicit Euler at 120 Hz (angular rate first, then orientation, then re-normalise). `check-flight` sweeps damping against dynamic pressure so the 120 Hz explicit damping term cannot go unstable at Mach 2.
- **Collision:** the F-22 covers 5.7 m a step at Mach 2, so ground tests are swept along the step segment, not point samples (matters for M2 on).
- **Ground contact v0 (`Gear.js`):** nose and two mains from data, spring and damper against `ground.sample`, rolling friction, nose steering from the rudder, a wheel brake on B. No retraction, limit speeds, damage or hangar zone (M3 and M5). A hard hit in M1 resets you to the runway with a message: a stand-in for the M5 crash flow, said so on screen.

### Wiring

- `FlightGame` borrows `game.scene` (one WebGL renderer per canvas, so it cannot build its own). `main.js` sets `game.onFly`; entering sets `game.input.suspended = true` (Input.js:132 then stops car actions piling up), calls `game.sound.update(null)`, swaps `game.loop.step` and `game.loop.render`, and `Scene.holdCarWorld()`. Leaving reverses it, re-applies `scene.setTrack(track, mesh)` and calls `game.showTitle()`.
- Menus reuse `Menu`/`MenuScreen` and `input.menu` (the pad edges Input already produces while suspended). Flight controls come from `FlightInput` only.
- Fly menu in M1: "Start on the runway", "Start airborne" (a test start; FLIGHT.md makes it a setting in M3), "Back to the title". Pause: Resume, Restart on the runway, Back to the title, Volume. Controls card on pause and on the first Fly (`Storage 'seenFlightControls'`).
- Storage keys: `flight.*`, normalised on the way in.

### `npm run flight` (M1)

1. Atmosphere against ISA tables (density, a, pressure) at 0, 5, 11, 20 km, within 0.1%.
2. Trim: level, stick centred, holds altitude and speed over 30 s at three points (250 kt at 10,000 ft, M0.9 at 30,000 ft, M1.6 at 40,000 ft).
3. Stall and recovery: stall warning fires before the stall; recovery (nose down, throttle, stick centred) returns AoA below stall within N seconds; no unrecoverable spin; the aids' master switch changes the result.
4. Published figures, each with its source in a comment (see section 4 below).
5. Thrust vectoring: pitch authority at 100 kt is clearly above the same case with vectoring off, and fades to about nothing at high dynamic pressure.
6. Frame-rate invariance through the real `Loop` at seven frame rates (bit-identical, as `check` does) and run-to-run determinism.
7. No allocation: heap growth over 200,000 steps under a small bound (run with `--expose-gc`).
8. Ground: rests at the right height on the flat field, accelerates in afterburner and lifts off at a plausible speed.

Then the other nine checks, `npx vite build --outDir <scratch>`, and the dev server loaded in the Browser pane with a clean console.

### Order of work

1. Atmosphere, Wing, Engine, AircraftPhysics, aircraft.js and the check, fitted with `fit-aircraft.mjs` until the figures pass.
2. AircraftBuilder, Aircraft, FieldMesh, TestField.
3. FlightInput, FlightCamera, FlightHud, FlightAudio, FlightGame, screens, the Fly row.
4. All fourteen-so-far checks, build, dev server.

### What you will test after M1

Fly it from "Start on the runway" and "Start airborne": takeoff in afterburner and rotation; a loop and a roll; the stall warning, then a stall and a recovery; thrust vectoring at 100 kt versus at 400 kt; supersonic pass; the three cameras and free look; mouse flight; a pad. Tell me what feels wrong and I change `tuning.js` or the aircraft data first.

## 2. The helicopter (name and design, as asked)

**Magpie 48.** Blocky-smooth utility helicopter, 4,800 kg, 12 m four-blade main rotor, conventional tail rotor, tall dorsal intake, side-by-side cockpit with a six-seat cabin and sliding doors, skid gear, short stub wings carrying a fixed gun pod and two rocket pods, a belly hook. Named for what it does: picks things up and carries them. Game numbers, not matched to anything real. Not built until M4.

## 3. What is wrong, conflicting or will not work in FLIGHT.md

**A. Ground height has two sources of truth today (blocks M2, and the aircraft's ground).** `Track.sample()` (Track.js:358) returns the road, curb and verge, and is flat past the apron (`baseY - vergeDrop`, Track.js:394). The rendered hills outside the barriers come from `TrackMesh._terrainHeight` (TrackMesh.js:123), a private method on a built mesh. So "keep `Track` in local coordinates and convert in a wrapper" gives aircraft a ground that does not match what they see outside the apron, and cannot answer for a track whose mesh is not built (a build is about 100 ms, HANDOFF section 2a). Fix in M2: move `_terrainHeight` into a headless `src/game/TrackGround.js` that `TrackMesh` calls; prove identical heights before and after on all six tracks over a grid.

**B. No compressibility.** SimpleWings-style curves have no Mach effects. With the thrust the spec gives, the F-22 would not stop near Mach 2.2 and the 737 would sail past its 0.82. Needs a lift-slope-vs-Mach table, a wave-drag table (peak near M1) and thrust vs Mach, all in `aircraft.js`.

**C. The F-22 thrust figure is per engine, and several figures are estimates, not USAF.** 35,000 lbf (156 kN) is each engine, so about 311 kN in afterburner. The USAF fact sheet says only "Mach 2 class" and "above 50,000 ft". Mach 2.25 and 65,000 ft are from non-USAF pages; supercruise is quoted as Mach 1.76 to 1.82; dry thrust (about 26,000 lbf each) is unofficial; thrust to weight is not published, my arithmetic gives about 0.84 at 38,000 kg takeoff mass and about 1.25 at 50% fuel. So `check-flight` uses the USAF figures as hard floors (Mach 2.0, 50,000 ft, +9 g) and the rest as targets with ±5% and the source named.

**D. Depth range.** Scene.js has near 0.2 and far about 2,000 m (Scene.js:39, 92), and the sky dome is a fixed 1,800 m (`GRAPHICS.skyRadius`). A 20 km view with those gives metres of z-fighting. Plan: near plane scaled with height above ground, far = fog end plus margin, dome radius tied to far (`Sky.setTrack` gets an optional radius). Three r185 has `reversedDepthBuffer` (it is in the build), but I cannot tell if `GTAOPass` copes, so M2 starts with a spike; the `logarithmicDepthBuffer` is rejected (loses early-z, unknown with the post chain).

**E. Hand-over from replay to live needs more than position, heading and speed.** A car restarted at the replay's pose has fresh suspension and tyre state and visibly bounces. See item 7: restore full state instead. That means additive `copyState`/`loadState` on `VehiclePhysics` and `AIDriver`, and exposing the closure state of `mulberry32` (AIDriver.js:61).

**F. Smaller, mostly for later milestones:**

- `Loft` is private (CarBuilder.js:179) and the Garage turntable is inline in `Garage.js` (lines 166 to 227), not a reusable class. The Hangar needs `Loft` exported now and a turntable extraction or copy in M3. FLIGHT.md says both are "reused".
- "Cockpit with a modelled instrument panel that works" fights "no textures": dials must be geometry (needles and tick marks as meshes) or DOM. I would do the gauges in the DOM HUD, model only the coaming and glass in M1, and decide on 3D gauges in M10.
- Radio chatter: `speechSynthesis` on Chrome can use remote (network) voices, which breaks "no network calls". Use only voices with `localService === true`, otherwise silent.
- Mouse flight needs pointer lock, which needs a click and gives up on Esc. Esc will pause and release it. Flight sticks usually have a non-standard mapping; I will add a best-effort axis fallback and I cannot test it without one.
- Crash repair rule (M5): a crash replaces the airframe, so crashing on purpose is a free repair anywhere, which undermines "damage carries over until the hangar". I would respawn with the damage you had when you left the apron. Never locks you out, closes the loophole.
- Stale comments in car code that aircraft will copy: tuning.js:12 and VehiclePhysics.js:13 say "+x right ... yaw increases turning right", while VehiclePhysics.js:21 and HANDOFF say +x is LEFT (and `Vehicle` sets `rotation.y = yaw`, which turns the nose left). I will not touch them unless you say so. Claude.md's pixel-ratio-1.5 line is the known stale one.
- Wind and turbulence must be pure functions of (seed, time, position), or determinism checks break.
- Anything swept at Mach 2 (thin landmark pillars, gates) needs segment tests, not point tests.
- Still to source in M4: the 737-800 approach speed (I have not searched yet; I will not quote one from memory) and the helicopter numbers, which are game numbers.

## 4. The F-22 figures the check will hold it to

| Figure | Value | Source and standing |
| --- | --- | --- |
| Length, span, height, wing area | 18.9 m, 13.6 m, 5.1 m, about 78 m2 | USAF fact sheet |
| Empty, max takeoff, internal fuel | 19,700 kg, 38,000 kg, 8,200 kg | USAF fact sheet |
| Thrust | 2 x 156 kN afterburner (35,000 lbf each); dry about 2 x 116 kN | afterburner from the spec and GlobalSecurity; dry is unofficial |
| Top speed | floor Mach 2.0; target 2.2 | USAF "Mach 2 class"; 2.25 from Milavia and DVIDS |
| Supercruise | floor Mach 1.5; target 1.75 dry | the spec; 1.76 (DVIDS) to 1.82 (Airman magazine) |
| Ceiling | floor 50,000 ft | USAF; 65,000 ft is a non-USAF estimate |
| Load limit | +9 g | the spec |
| Tails, inertia, CL and CD curves | estimates | not published; fitted to the performance figures |

## 5. Answers to "Open items for your plan"

**1. Grafting `Track` and `TrackMesh` into world coordinates.** Treat each track area as a rigid local frame.

- `Track` stays untouched in local coordinates. A `TrackArea` holds `{ track, x0, y0, z0, heading }` and converts world to local (rotate by heading, subtract origin), including the `y` hint the bridge lookup needs.
- The world height function near an area is `lerp(areaHeight, worldNoise, smoothstep(blend band))`, where `areaHeight` is `Track.sample` inside the paved ribbon and `TrackGround` outside it (finding A). The area's base elevation is the flattened world height at its centre, so Pine Ridge's 60 m climb sits on top of it.
- `TrackMesh` gets a constructor option `{ ground: false }` that skips `_buildGround` (the 1,800 m padded plane at TrackMesh.js:155), because world chunks draw the terrain. It also needs a stepwise build (its `_build*` methods already run in sequence, so a generator over them) so the 100 ms build can be time-sliced. Defaults unchanged.
- The `TrackMesh` group goes under a wrapper `Group` carrying position and heading. Its children have `matrixAutoUpdate = false` (TrackMesh.js:86 to 87); Three's parent update forces them, so moving the wrapper moves them correctly and the subtree is only walked on a rebase.
- AI cars, skid marks and particles for an area live under the same wrapper, in local coordinates. So the cars' physics stays bit-identical to the car modes (tracks are a few km, no precision issue) and "physics stays in absolute coordinates" applies to the aircraft only. Aircraft do not collide with cars.
- Risk to car modes: only the `TrackMesh` option and the `TrackGround` extraction. Guards: the height before/after proof, the nine checks, and you driving all six tracks.
- Open issue: Harbor Nine is a night track with tunnel lamps, in a world with one global clock. In the world, a track contributes ground, props and fog tint; its lamps follow the world's night. Decided in M9, noted now.

**2. Web Worker?** No. Time-slice on the main thread. A near chunk (about 33 x 33 vertices) is roughly 7,000 noise evaluations plus normals, colours and upload, around 1 to 2 ms, split into separate units (heights, mesh, props) under a per-frame budget `WORLD.chunkBudgetMs` (about 2 ms). Generation is written as pure functions so a worker can host it later unchanged. The gate: M2 measures chunk demand at 600 m/s and moves to a worker only if the budget cannot keep the rings ahead of the player. A worker also costs a second code path for the Node checks (no `Worker` there), Vite worker bundling, and transfers of instance matrices.

**3. Floating origin.** `WorldOrigin` holds `(ox, oz)` on a 1 km lattice. When the camera is more than 2 km (spec's figure) from it, it snaps to the nearest lattice point and shifts every registered object by the difference. Render coordinates then stay under about 3 km, where float32 resolves 0.25 mm. Altitude is not rebased (20 km is fine in float32).

- Static things (chunks, instanced props, track areas) register once with an absolute position; their vertices are chunk-local so a rebase never rewrites geometry.
- Moving things (aircraft, particles) are placed each frame through `origin.toLocal`.
- Renderer parts that change:
  - `Scene.fitShadowTo(x,y,z)`: callers pass render-space coordinates; no code change.
  - `Sky.update(cameraPosition)` is already camera-relative; its clouds are world-fixed and go through the origin in M9.
  - PostFX: none, it is screen-space.
  - `Particles`/`Effects`: pool groups register with the origin, and instances are stored relative to the pool's own anchor.
  - `TrackLights`: lamp positions get an optional transform (area wrapper plus origin) in M2, for the night areas.
- `npm run world` proves it: a scripted route flown with forced rebases every N metres and with none gives identical physics, every registered object's reconstructed absolute position is invariant to 1 mm across a rebase, and no render coordinate exceeds 4 km.

**4. Body frame and signs.** Section 1, Conventions.

**5. Controls (for your approval).** Modes are separate, so car keys are reused freely; no clashes inside flight; no Ctrl combos (Ctrl+W closes the tab). The full map exists from M1 so it stays stable; actions with no system yet are no-ops.

| Keyboard | Action |
| --- | --- |
| Up / Down | pitch (Up pushes the nose down; the Invert Y setting flips it) |
| Left / Right | roll |
| A / D | rudder; nose wheel steering on the ground |
| W / S | throttle up / down (held, ramps) |
| Left Shift | afterburner (held) |
| Space | cannon or gun pod (held) |
| F | missile or rockets |
| Q | flares |
| E | cycle target |
| G | gear |
| Z / X | flaps up / down one detent |
| V | airbrake (held) |
| B | wheel brake (held) |
| P | autopilot on or off (holds altitude, heading, speed; with it on, Up/Down, Left/Right and W/S move the three targets) |
| H | hover assist (helicopter) |
| C | camera: chase, cockpit, far orbit |
| Right mouse (held) | free look |
| U | HUD on or off |
| M | map |
| N | mute |
| T | mouse flight on or off |
| R (held 1 s) | reset to the hangar |
| Esc | pause |
| Backtick | telemetry |
| L | reserved for lights (M9) |

Mouse flight on: moving the mouse is pitch and roll from the screen centre with a deadzone, wheel is throttle, left button is cannon, right button is missile, middle (held) is free look.

| Gamepad (standard mapping) | Action |
| --- | --- |
| Left stick | pitch and roll |
| Right stick X | rudder; Right stick Y: throttle (ramps) |
| R3 (held) | right stick becomes free look |
| RT / LT | cannon / wheel brake (analog) |
| RB / LB | missile / flares |
| A / B | afterburner (held) / airbrake (held) |
| X / Y | gear / camera |
| D-pad up / down | cycle target / autopilot |
| D-pad left / right | flaps up / down |
| L3 | HUD |
| Back (tap) | map |
| Back (held) then A / B / X | reset to the hangar (held 1 s) / mute / hover assist |
| Start | pause |

A non-standard pad or flight stick falls back to axis 0 roll, 1 pitch, 2 twist rudder, 3 throttle slider.

**6. Does `Scene.js` need a flight variant?** No: extend it in place. Apart from `setTrack`/`trackGroup`/`trackLights`, it is generic: the renderer, post chain, graphics levels, dynamic resolution, split-screen path and `prewarm`. A variant would fork `applyGraphics` and the resolution governor. Additive methods: `setEnvironment({ sky, fog, hemi, sun, post })` (what `setTrack` reads from a track, from plain data; `Sky.setTrack` and `PostFX.setTrack` already take a track-like object), `holdCarWorld()` / `releaseCarWorld()` (hide the track group and car roots, restore them), and `setCameraRange(near, far)`. M1 uses these on the flat field.

**7. Replay to live hand-over, and testing that it does not pop.**

- *Track cars:* record one lap per car from the real `VehiclePhysics` + `AIDriver`, as a 30 Hz pose track (cheap replay) plus a full-state keyframe every second (physics and driver, including the RNG). At hand-over: restore the keyframe at or before now, fast-forward under 120 steps (about 5 ms; can be spread over a few frames while the replay keeps drawing), swap. The AI is deterministic (`npm run ai` already asserts it), so live equals the recording to the last bit. Test: hand over at 200 random times across all six tracks, assert zero position and yaw difference at the swap and after 10 s of live against the recording's continuation.
- *Air traffic:* far, it follows its route; near, `AircraftPhysics` is created at the route position from an exactly trimmed state (the solver `check-flight` uses) and an `AIPilot` with matching targets. Test: 100 random route points, 30 s live; position at the swap equal to 1e-9, then bounded deviation from the route (position, altitude, speed, attitude transient), asserted.

**8. What I would cut or defer to keep M1 to M4 solid.**

- M2 ships biome terrain, colour, fog and props, the coast Harbor Nine needs, and a minimal downtown block grid for the city biome. Full cities, roads, ground traffic and ocean detail move to M9.
- The 3D working instrument panel goes to M10 (item F); DOM gauges until then.
- Weather and wind: a stub only (a settable constant wind) until M9, so the 737 crosswind work in M4 can use it.
- Radio chatter stays in M9.
- Shadow cascades: not done; the sun's shadow box follows the aircraft (about 48 m), so mountains will not shadow terrain at a distance. A visual limit I am accepting.
- Trees: no collision (scenery), as the spec suggests. Say so if you want it.
- Everything else in the spec stays.

## 6. Defaults I am choosing; tell me if any is wrong

1. Flight uses its own stored graphics level, `flightGraphics`, defaulting to Medium (the car default is Ultra, which measured 24 to 27 ms a frame at 2880 x 1800 before dynamic resolution). Decided in M10; M1 just uses the saved level.
2. The M1 Fly menu has the two start buttons above.
3. A hard hit in M1 resets you to the runway with an on-screen note, until M5.
4. Units default to knots, feet and Mach; metric and mph are a setting.
5. Helicopter: Magpie 48, as above.
6. Reset to the hangar is a one-second hold, so it cannot be hit by accident.

## Sources for the F-22 figures

- [USAF F-22 fact sheet (JBLE copy)](https://www.jble.af.mil/Portals/46/F-22%20Fact%20Sheet.pdf)
- [Milavia F-22 specifications](https://milavia.net/aircraft/f-22/f-22_specs.htm)
- [GlobalSecurity, F119](https://www.globalsecurity.org/military/systems/aircraft/f-22-f119.htm)
- [Airman magazine, Airframe: the F-22 Raptor](https://airmanmagazine.af.mil/Features/Display/Article/2594193)
