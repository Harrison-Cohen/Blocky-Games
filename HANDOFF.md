# Handoff: blocky racing sim

Read this file, then `Claude.md` (the project rules), then `PROMPT.md` (the
full spec) before touching anything. This file is the state of the project and
everything the previous agent knew that is not written down elsewhere.

---

## 1. Where things stand

- Branch `initial-build` (not `main`). Commits so far:
  - `2bd4cb8` milestones 1-6 plus a polish round
  - `d6997de` milestone 7, full race mode
- **Committed** on 2026-09-11, at the user's request, in the commit after
  `d6997de`. Commit again only when the user asks. That commit holds:
  - Checkpoint gate fix (`src/game/Checkpoints.js`, tests in `scripts/check-timing.mjs`)
  - Sector flash moved under the timer (`index.html`, `src/ui/styles.css`)
  - Steering "refuses to turn" fix, `STEERING.yawStability` (`src/game/VehiclePhysics.js`,
    `src/data/tuning.js`, regression test in `scripts/check-determinism.mjs`)
  - Milestone 8 in full (ghost, particles, skid marks, audio, camera polish)
  - The five requests made after milestone 8 (section 2): finer launch
    smoke, a manual gearbox and two dashboards in mph, the garage redesign,
    colour presets, and a car per chassis
  - The neutral smoke fix: revving in neutral no longer smokes the tyres.
    Launch smoke follows the drive the tyres actually get
    (`VehiclePhysics.driveUse`, `EFFECTS.launchDriveUse`), guarded in
    `npm run fx`
- Milestones 1-8 of 9 are built. Milestone 8 was handed to the user for testing
  and they came back with the change requests in section 2 rather than a bug
  report, so treat milestone 8 as accepted-with-changes.
- Milestone 9 (title, track select and pause screens, performance pass) has NOT
  been started. Do not start it until the section 2 requests are done and the
  user says to move on.
- All seven headless checks pass on the current tree. The production build is
  clean and the dev server loads with no console errors or warnings.

## 1a. Milestones: what each one delivered

The nine milestones are defined at the bottom of `PROMPT.md`. What was actually
built for each, including where the build goes beyond the spec:

1. **Scaffold and driving model.**
   - Vite and Three.js, with a fixed 120 Hz loop.
   - Bicycle model with a friction ellipse, 4-corner suspension, weight
     transfer, surfaces, and a handbrake.
   - Spring-damped chase camera with three modes: chase, cockpit and far
     chase.
   - The ground query is analytic from the start (no raycasts).
2. **Track system and Copper Flats.**
   - Catmull-Rom centreline, road ribbon, continuous curb ribbon, barriers,
     start gantry, minimap, and declarative prop recipes.
3. **Timing, HUD and results.**
   - Checkpoints and sectors, lap validation (missed gate, reversed, off
     track for more than 1.5 s, reset, auto drive), live delta, and sector
     flashes.
   - Session results with the best possible lap, and records per track and
     chassis in localStorage.
4. **Garage.**
   - The chassis plus every cosmetic option, a turntable preview, and
     persistence.
   - A fifth chassis, "Bighead" (the Kanye face on four wheels), was added at
     the user's request, so there are five chassis, not the spec's four.
5. **Harbor Nine and Pine Ridge.**
   - Surfaces (gravel, grass) and scenery.
   - Later, two extra tracks were added at the user's request: Skyline
     Interchange (a figure 8 with a real bridge) and Glacier Pass. That makes
     five tracks, not three.
6. **Racing line, speed profile and one AI car.**
   - A minimum-curvature line, a braking and acceleration speed profile that
     knows about gradient and roll, and pure pursuit steering.
   - "O" toggles a pace car in time trial.
7. **Full race mode.**
   - N opens a race setup card for laps, opponents (up to 7) and difficulty.
   - Standing grid with countdown lights, awareness and passing, capsule
     contact, and live standings with gaps.
   - Race results, with the fastest lap in purple.
8. **Ghost, particles, skid marks, audio, camera polish.**
   - See section 5 and the `GHOST`, `EFFECTS` and `AUDIO` blocks in
     `tuning.js`.
   - Also a gear readout, a volume slider on the Esc card, and H (ghost) and
     M (mute).
9. **Not started.** Title, track select and pause screens, plus a
   performance and rough-edges pass. The race setup card (N) and the dev keys
   (V/T/O) are stand-ins for the track select screen until then.

## 1b. Requests the user made between milestones (why things exist)

- More torque and horsepower for every car ("I want to LAUNCH"). Launches are
  grip limited, so the knob that matters is `ENGINE.launchTraction` (1.5),
  alongside `powerScale` and `launchBoost`.
- Reverse steering was inverted; fixed. Brake lights added. Curbs were
  z-fighting and were rebuilt as a continuous ribbon.
- Auto drive (P): the AI drives the player's car. Laps driven that way are
  always invalid.
- Night track lighting: real street and tunnel lights, headlights, and eye
  adaptation. The user wanted it dark but properly lit.
- "Intensive" graphics: post-processing, the sky, shadows, dynamic
  resolution. Then the 60 fps on a MacBook Air M5 requirement.
- Easier high-speed turning without losing grip: `GRIP.speedGrip`.
- The car floating downhill and phasing through hills; both fixed (section
  6).
- Checkpoints missed when running wide; fixed. The sector flash moved under
  the timer. The car refusing to turn with D held; fixed (section 6).

## 2. Requests after milestone 8: built, waiting on the user's test

All five are built and all seven checks pass. The user has been told what to
test; wait for their report before touching milestone 9. What was built:

1. **Launch smoke.** Its own finer knobs in `EFFECTS` (`launchSmokeRate`,
   `launchSmokeSize`, `launchSmokeGrow`, `launchSmokeLife`,
   `launchSmokeRise`). The largest launch block is now about 0.3 m; it was
   about 3 m. Slide smoke and dust are smaller and more numerous too
   (`maxParticles` 3200), and `smokeColor` is a light grey so sunlit smoke
   stays under the bloom threshold.
2. **Manual gearbox.** The open question below (do gears affect the drive?)
   was decided as: yes, in manual only, on the player's car only.
   `Gearbox.manualDrive()` scales the traction-capped drive force in
   `VehiclePhysics` when `input.manual` is set; the AI, auto drive and every
   check never set it. In the right gear the factor is exactly 1, so shifting
   at the redline is bit-identical to automatic (guarded in `npm run fx`).
   Neutral gives no drive. Reverse is still the brake pedal from a stop, in
   any gear but neutral. Top gear has no limiter. Knobs: `GEARBOX` in
   `tuning.js`. Keys B, E, Q, X; pad D-pad right, RB, LB, D-pad down. The
   choice is stored under `manual`.
   **Dashboards**: `src/ui/Speedo.js`. Digital is a rev bar with a red end,
   with the gear and speed in the same panel; classic is two canvas dials side
   by side. Picked in the garage and stored under `speedo`. Every
   player-facing speed is mph, the telemetry panel included.
3. **Garage.** `src/ui/Garage.js` rewritten: a sectioned list, custom
   dropdowns (live preview while browsing; Esc or a click outside reverts), a
   real text box for the number, stat bars, and Save car / Discard changes
   pinned at the bottom. Numbers run 0-9999; the roundel shrinks digits to
   fit, 0 now draws, and `null` means no roundel.
4. **Colour presets.** 13 named ones in `COLOUR_PRESETS`
   (`src/data/customization.js`). The player saves their own from the Paint
   section, stored under `presets` (at most 24). Delete/Backspace, or pad X,
   deletes one of theirs in the preset dropdown.
5. **A car per chassis.** Stored under `garage` as `{ chassis, cars }`. The
   old single `car` record migrates to its own chassis; the others start in
   their `CHASSIS_PRESET` colours. V swaps to the next chassis's own car.

The original request, and the notes worked out before building it:

The user's exact message, which was interrupted before any work began:

> 1. make the particles for the launching smaller they blind the user, and make
>    the particles more fine
> 2. have the user be able to shift gears manually with a toggleable button for
>    the manual mode you need to change the current speedomiter to have two
>    custimizations in the garage, a clasic version where it has the normal dial
>    with an RPM meter and a speedomter and then a digital RPM meter and a
>    digital speedometer, for the classic they shoule be side by side and for the
>    modern digital one it should be a rectange for the RPM meter with red at the
>    end of the RPM meter and then in the same place where that is the speed and
>    change all speeds to MPH. The user will press the button to change to manula
>    mode and then when it is toggled on then have them press a button for up
>    down and neutral.
> 3. lastly update the garage to look more modern and cleanr, the user should
>    also be able to type in any number and there shoule be a drop down for the
>    options instead of clicking through
> 4. Create color presets that go well together and give them name and let the
>    user make color presets
> 5. Have the user be able to do diffrent colors for diffrent cars

Notes the previous agent had worked out for each:

1. **Launch smoke.** In `src/data/tuning.js` `EFFECTS`: `smokeSize` 0.35 and
   `smokeGrow` 5.5 make blocks up to ~2.5 m across right behind the chase
   camera. Launch smoke is emitted at full rate (`k = 1`) in
   `src/render/Effects.js` `_emit`. "More fine" means smaller and more numerous:
   lower sizes and growth, raise rates, and consider a separate, smaller launch
   size and rate. Keep `maxParticles` in mind (1400) and the 60 fps target.
   Per `Claude.md`, change `tuning.js` first.
2. **Manual gearbox and new speedo.** Today `src/game/Gearbox.js` is COSMETIC
   ONLY: the physics has no gears; engine force falls off smoothly with speed.
   A manual mode the player controls has to decide whether gears start to
   affect drive force. If they do, that is a physics change: it must run inside
   the fixed 120 Hz step, stay frame-rate invariant (`npm run check`), and apply
   to the player only, with the AI unaffected (`npm run ai` / `race` unchanged).
   If they don't, say so to the user. Ask before choosing. Needs:
   - A key to toggle manual mode, plus shift-up, shift-down and neutral keys,
     and gamepad equivalents. Check `src/core/Input.js` for free keys. Already
     taken: W A S D, arrows, Space, R C G H M N O P T V, Esc, Tab, backtick.
   - Two speedo styles, picked in the garage:
     - Classic: an analog speed dial and an rpm dial, side by side.
     - Digital: a rectangular rpm bar that is red at the redline end, with the
       speed in the same panel.
   - MPH everywhere. The readout is in `Game.render` (`kmh`) and
     `.speed-readout` in `index.html` and `styles.css`. Race and results
     screens may show speeds too. The garage stats card may show a top speed
     (`src/ui/Garage.js`). The debug HUD can stay metric if you like.
   - The rpm source is `this.gearbox.rpm` in `Game.render`, and redline and
     idle come from `AUDIO.voices` in `tuning.js`.
3. **Garage redesign.** The file is `src/ui/Garage.js`; rows are built from the
   option lists in `src/data/customization.js`. The number field is
   `number: 1-99` today; the user wants to type any number (check what the
   roundel in `CarBuilder.addRoundel` can render). Use dropdowns
   (`<select>`-like, keyboard and gamepad navigable, no default UI-kit look)
   instead of left/right cycling. Keep the art rules: hard-edged panels, no
   rounded cards, no drop shadows or blur, no all-caps, and buttons that say
   what happens.
4. **Colour presets.** Named, curated primary/secondary (plus wheel) combos,
   plus user-made presets saved through `src/core/Storage.js`. The palette of
   12 paint colours is in `src/data/palette.js`.
5. **Per-car colours.** Today one saved car config (`Storage 'car'`) carries a
   chassis plus its paint, and switching chassis keeps the paint. The user wants
   each chassis to remember its own paint. `Game.applyCar` / `nextChassis` (V)
   and the garage save path are where this lives. Migrate the old single
   `'car'` record gracefully (`normalizeCar` already sanitises).

These are built; see the top of this section.

## 3. Standing instructions (every response)

The same three are also in the auto-memory at
`~/.claude/projects/-Users-harrisoncohen-Documents-racing-game/memory/`.

- **End every response with launch instructions**, in their own `bash` block:
  `npm run dev`, then "open `http://localhost:5173`".
- **Then list ALL keybindings**, keyboard and gamepad, read from
  `src/core/Input.js` rather than from memory; section 7 has the current
  list. Include the menu controls line.
- **Graphics:** the user has a strong machine and wants it to look intensive,
  but required "keep all the graphics but make it run at 60 fps on a MacBook Air
  M5 with 16 GB". Keep expensive features behind `GRAPHICS` knobs in
  `tuning.js`. `Claude.md`'s Performance section (devicePixelRatio cap 1.5)
  is out of date: the build uses `maxPixelRatio 2` plus dynamic resolution.
  This was flagged to the user and never answered.
- After each milestone or batch: stop, say exactly what to test, and wait. Never
  roll into the next milestone unprompted.
- Commit only when asked, and commit as the user (Harrison Cohen, their own
  git config) with no Claude co-author trailer. They asked for commits "as
  me not claude" on 2026-09-11.
- When the user reports a handling problem, change `tuning.js` first; touch
  the physics only if the model itself is wrong.

## 4. How to verify work

```
npm run check   # frame-rate invariance, paint does not change handling, reverse steers right,
                # held full lock at speed never yaws or points its wheels the wrong way
npm run lap     # every chassis laps every track
npm run timing  # lap timing, sectors, validation, every gate spans the whole drivable area
npm run parts   # no part floats, cars sit on hills
npm run ai      # racing line beats centreline, AI laps clean, deterministic
npm run race    # full field races every track cleanly (contact <= 5% per car), difficulty ordered
npm run fx      # ghost records/replays exactly, gearbox never hunts, skid marks on road, pools bounded
```

All seven must pass before calling anything done. `race` takes a couple of
minutes. Also run `npx vite build --outDir <scratch>`: it is the only thing
that catches syntax and import errors in browser-only files (`Game.js`,
`Audio.js`, `main.js`), because no headless check imports them.

In-browser checks, with the Claude Browser pane:
- The preview config is named `racing-game` in `.claude/launch.json`, port 5173.
  If port 5173 is already taken by the user's own `npm run dev`, don't kill it:
  navigate the pane to `http://localhost:5173` instead.
- `window.game` is exposed in dev. The pane is often hidden, so
  `requestAnimationFrame` does not run. Drive the game by hand with
  `game.step(1/120)` and `game.render(0, 1/60)`.
- To make the auto driver's laps count as valid in a test, override
  `game.timer.setAssisted = () => {}` and set `game.timer.assisted = false`.
  **Afterwards `delete game.timer.setAssisted`, and snapshot and restore
  `localStorage`,** or you leave fake records and ghosts in the pane's storage.
  This happened once and was cleaned up.
- For screenshots, use `resize_window` to 1440x900 then
  `window.dispatchEvent(new Event('resize'))`; the scene skips drawing until its
  canvas has area. Reset with the `desktop` preset afterwards.

Gotcha: in zsh, a bare `echo =====` is a glob error and aborts a `;` chain.
Use `echo '-----'`.

## 5. Architecture in brief

Stack: Vite plus vanilla ES modules plus Three.js r185. There is no other
runtime dependency; ask before adding any package, including dev dependencies.

- **Physics**: `src/game/VehiclePhysics.js`. Fixed 120 Hz step with an
  accumulator in `src/core/Loop.js`, and render interpolation.
  - Axes: body +x is LEFT, +z forward. Pitch is positive nose up; roll is
    positive with the left side down. Physics steer −1 is right (D), and
    `Input` flips the sign once.
  - Bicycle model with a friction ellipse. Longitudinal forces take their grip
    first and cornering gets the remainder.
  - The front slip angle is capped at `peakSlipAngle * limitMargin`, relative
    to the front axle's own lateral velocity.
  - `STEERING.yawStability` (14000) damps yaw rate minus path rate. It fades in
    from 18 to 32 m/s (`yawStabilityFrom` / `yawStabilityFull`) and is off
    while the handbrake is on.
  - `GRIP.speedGrip` adds grip that grows with speed squared.
  - Suspension: 4 corners, dampers acting relative to the ground (`groundVy`),
    and the slope force comes through the spring normal.
- **Ground query** (analytic, no raycasts): `Track.sample(x, z, y)` and
  `Track.bounds(x, z, y)`. The `y` hint separates a bridge from the road under
  it. The nearest-sample lookup is height weighted and then walks to the
  nearest sample in plan view.
- **Tracks are data**: one file in `src/data/tracks/` each, and nothing else.
  - Five tracks: Copper Flats, Harbor Nine (night), Pine Ridge (gravel sector),
    Skyline Interchange (figure 8 with a bridge), Glacier Pass.
  - Control points carry `{x, y, z, width, surface, banking, bridge?}`. Track
    files also set palette, sky, props and lights.
- **Five chassis** in `src/data/cars.js`: cube-gt, boxhauler-v8, wedge-one,
  haul-4x4 and bighead (the "Kanye face" car). All of them drive through the
  rear axle in the physics.
- **Timing**: `src/game/LapTimer.js` and `src/game/Checkpoints.js`.
  - Crossings are timed within the physics step.
  - Gates have NO lateral width limit. A crossing counts if its point's
    nearest road sample is within half a gate spacing of the gate. This was the
    fix for "missed a checkpoint" after running wide.
  - Records are stored per track and per chassis (`Storage.recordName`).
- **AI**: `src/ai/RacingLine.js` (a minimum-curvature line),
  `src/ai/SpeedProfile.js`, `src/ai/AIDriver.js` (pure pursuit, traffic
  awareness, seeded mistakes) and `src/ai/Standings.js`. The AI drives the same
  physics as the player; it is never moved along the spline.
- **Race**: `src/core/Race.js` is headless.
  - Grid, countdown, contact (`src/game/Contact.js`, capsule shapes), standings
    and results.
  - Opponent pace is solved against the profile's lap time, per difficulty
    (`RACE.levels`).
  - Opponents are listed in `src/data/opponents.js` (7 of them).
- **Rendering**: `src/render/Scene.js`, with post effects in `PostFX.js`: MSAA,
  GTAO, bloom, eye adaptation that only darkens, and dynamic resolution.
  - `Sky.js`, `TrackLights.js` (a pool of spot lights) and `HeadlightPool.js`.
  - Scenery is split into chunks for culling.
  - **Every material comes from `src/render/Materials.js`**. Cars use
    `glossy()` (Phong); the world uses `flat()` (Lambert). No textures, no PBR.
- **Milestone 8 modules**:
  - `src/game/Ghost.js` is pure, with no Three.js. `GhostRecorder` samples at
    exact 30 Hz of lap time. It keeps only a new valid best and saves it under
    `Storage.ghostName`, with the car's appearance at the time.
  - `src/render/GhostCar.js` builds a translucent copy from `ghost()`
    materials.
  - `src/render/Effects.js` sits over `Particles.js` (one instanced cube
    pool, fading by shrinking) and `SkidMarks.js` (a ring buffer of quads with
    vertex alpha).
  - `src/core/Audio.js` holds `SoundEngine`: an engine built from saw waves
    through a lowpass filter, driven by the gearbox rpm, plus scrub, loose,
    wind, thump and start tones. It unlocks on the first keydown or
    pointerdown and suspends when the tab is hidden.
  - `src/game/Gearbox.js`: in automatic it is cosmetic, with rpm and gear
    derived from speed for the sound and the dashboard. In manual (player
    only) the chosen gear goes to the physics as `input.manual` and
    `input.gear`, and `manualDrive()` scales the drive force inside the step.
- **Game wiring**: `src/core/Game.js` owns everything. `step(dt)` is the fixed
  step; `render(alpha, frameDelta)` handles the UI, camera, effects, ghost and
  sound.
- **UI**: `src/ui/HUD.js` (timer and minimap), `Speedo.js` (the dashboard,
  in mph), `RaceHud.js`,
  `RaceScreens.js`, `Garage.js`, `Results.js` and `DebugHud.js`, with markup in
  `index.html` and styles in `src/ui/styles.css`. Fonts are Martian Mono for
  numbers and Archivo for text, self-hosted in `public/fonts`.

## 6. Bug history (do not reintroduce)

- The downhill "float" came from dampers acting on absolute vertical speed. They
  must act relative to the ground.
- Hill "phasing" came from three things: a pitch sign error in `Vehicle.js` (the
  body rotation is `(-pitch, 0, -roll)`), the wheel mount's pitch term, and the
  cockpit camera. The height-biased nearest-sample lookup is guarded by the
  hill test in `npm run parts`.
- Reverse steering was once inverted. The front slip is measured in the wheel
  frame with the sign of `vLong`. Guarded by `npm run check`.
- "Missed a checkpoint" when running wide came from gates narrower than the
  runoff. Gates now have no width limit. Guarded by `npm run timing`.
- "Refuses to turn with D held" was a yaw overshoot: the rear let go and the
  slip cap swung the wheels onto the opposite lock. Fixed with `yawStability`,
  and guarded by `npm run check`. It was NOT the reverse fix.
- Race contact on Pine Ridge sits near the 5% limit and swings with any
  handling change. Re-run `npm run race` after any physics or tuning change.
- Harsh or blinding lighting under lamps and in tunnels was fixed with gentler
  decay, lower intensities and eye adaptation that only darkens.
- A stale `PIXEL_PACK_BUFFER` after an async readback produced fake timings.
  `PostFX.js` unbinds it.

## 7. Current keybindings (from `src/core/Input.js`)

Keyboard:
| Key | Action |
|---|---|
| W/↑ | throttle |
| S/↓ | brake, and reverse from a stop |
| A/← and D/→ | steer |
| Space | handbrake |
| R | reset to the last checkpoint |
| C | camera |
| Esc | pause (controls card and volume slider) |
| Tab | session results |
| G | garage |
| H | ghost on/off |
| M | mute |
| P | auto drive |
| N | race |
| V | next chassis |
| T | next track |
| O | pace car |
| backtick | telemetry |
| B | manual gearbox on/off |
| E / Q | shift up / down (manual) |
| X | neutral (manual) |

G, V and T are blocked during a race, and so is O.

Gamepad:
| Button | Action |
|---|---|
| right / left trigger | throttle / brake |
| left stick | steer |
| A | handbrake |
| Y | reset |
| X | camera |
| D-pad up | ghost |
| Start | pause |
| Select/Share | results |
| B | garage |
| D-pad right | manual gearbox on/off |
| RB / LB | shift up / down (manual) |
| D-pad down | neutral (manual) |

Menus: ↑ ↓ ← → Enter Esc on the keyboard; D-pad, A and B on a gamepad. In the
garage, digits type the driver number, and Delete/Backspace (pad X) deletes
one of your own presets in the preset dropdown.

## 8. Unresolved questions put to the user

- The track files' `targetLap` values are now slower than the AI on Copper
  Flats and Pine Ridge. Should they be updated?
- `Claude.md`'s Performance section still says pixel ratio 1.5. Should it be
  updated to match the build?
- No ghost exists for a best set before milestone 8 until that best is beaten.
  An offer to record a ghost from the next clean lap when none exists was made
  and not answered.
- Only the player's car has engine sound; the AI cars are silent.
