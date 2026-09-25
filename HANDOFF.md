# Handoff: blocky racing sim

Read this file, then `Claude.md` (the project rules), then `PROMPT.md` (the
full spec) before touching anything. This file is the state of the project and
everything the previous agent knew that is not written down elsewhere.

---

## 1. Where things stand

- Branch `initial-build` (not `main`). Commits so far:
  - `2bd4cb8` milestones 1-6 plus a polish round
  - `d6997de` milestone 7, full race mode
- **Committed** on 2026-09-11, at the user's request, as `52e198e`. Commit
  again only when the user asks. That commit holds:
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
- **Committed** on 2026-09-25, at the user's request, as the commit after
  `52e198e` ("Add real cars, drag strip, gearbox tuning and milestone 9
  screens"): the manual shift keys moved to the driving set you are not
  using (section 2, item 2), the graphics levels (section 2, item 6), the
  line-up of real cars (section 2, item 7), the quicker, sharper real cars
  (section 2, item 8), the Tesla Roadster, drag strip and two players
  (section 2, item 10), the tunable gearboxes and tighter-turning real cars
  (section 2, item 11), the roll-centre fix for cars lifting their inside
  wheels (item 11, follow-up), and milestone 9 (section 2a). Commit again
  only when the user asks.
- All nine milestones are built. Milestone 8 was handed to the user for
  testing and they came back with the change requests in section 2 rather
  than a bug report, so treat milestone 8 as accepted-with-changes.
- Milestone 9 (title, track select and pause screens, performance pass) was
  started on 2026-09-25 when the user said "continue with the next
  milestone". It is built and handed to the user to test (section 2a); wait
  for their report.
- All nine headless checks pass on the current tree. The production build is
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
9. **Title, track select, pause, and a performance pass.** Built; see
   section 2a. The old race setup card and drag setup card are gone: track
   select carries their settings. V, T and O stay as shortcuts.

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
   `tuning.js`. B toggles manual, X is neutral. The shifters are the left and
   right keys of whichever set you are NOT driving with: → up and ← down when
   driving on W A S D, D up and A down when driving on the arrows. The set is
   whichever one's throttle or brake was pressed last, and in manual only
   that set steers (`Input.drivingSet`, `Input.manualKeys`). E/Q were the
   first shift keys and were replaced at the user's request. Pad: D-pad
   right, RB, LB, D-pad down. The choice is stored under `manual`.
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

6. **Graphics levels**, asked for after the five above. Garage, Settings,
   Graphics: Low, Medium, High or Ultra, stored under `graphics`. The default
   is Ultra, which is exactly the `GRAPHICS` and `WORLD` values.
   `GRAPHICS_LEVELS` in `tuning.js` holds each level's overrides and the
   measured cost of every feature (occlusion and 4x MSAA about 9 ms each,
   bloom about 6, resolution the rest; shadows under 1 ms).
   `src/render/GraphicsLevel.js` writes a level onto `GRAPHICS` and `WORLD`,
   keeping the declared values so Ultra restores them.
   `Scene.applyGraphics` rebuilds the post chain, the shadow map, the lamp
   pool and the optional prop shadows live, without reloading the track, so
   the car and the lap carry on. Frame times at 2880 x 1800 with dynamic
   resolution off: Low 3.5, Medium 10.6, High 19.8, Ultra 23.9 ms on Copper
   Flats; 3.0, 10.5, 21.4, 27.0 on Harbor Nine. Guarded in `npm run fx`:
   levels name only real settings, and Ultra restores tuning.js exactly.

7. **Real cars**, asked for after item 6. Every chassis but the Wedge One was
   replaced by five modelled on real cars: Porsche 911 (992 Carrera S),
   Mustang GT (S650), Chevelle SS 396 (1969), Ferrari Enzo and Lamborghini
   Huracán EVO. Cube GT, Boxhauler V8, Haul 4x4 and Bighead are gone.
   - Physics: real mass, dimensions, wheelbase, track, weight distribution,
     centre of mass height and overhangs. `power`, `launchSpeed`,
     `powerFalloff`, `topSpeed`, the grips and `steerRate` are TUNED so the
     physics reproduces each car's published 0-60, quarter mile, top speed,
     skidpad and turning circle, which live in `specs` in cars.js. The new
     eighth check, `npm run specs`, measures them and holds them to it (since
     item 8, to the real figures scaled by STREET). To retune after a
     tuning.js change, `node scripts/fit-specs.mjs [id ...]` prints the
     numbers: power, launchSpeed and topSpeed fitted to 0-60, quarter mile
     and top speed (Gauss-Newton, with a sweep where it stalls), both grips
     scaled to the skidpad, and steerRate to the turning circle.
     Braking distances are NOT matched: the model uses one friction
     coefficient for cornering and braking, and real cars stop harder than
     they corner.
   - The Huracán is all-wheel drive in life; the physics drives every car
     through the rear, so its traction is in its launch numbers.
   - New per-chassis overrides: `launchSpeed` and `powerFalloff`
     (VehiclePhysics, and SpeedProfile for the falloff). `bodyCenter()` in
     cars.js places a real body off the centre of mass; the contact capsules
     in Race and Contact use it, as do the garage turntable and cockpit eye.
   - Bodies: `SHAPES` in CarBuilder, lofted superellipse panels (`Loft`) from
     each car's profile and plan. Wheel openings are cut automatically, clear
     of the front wheel's full-lock sweep, and details are placed on the
     surface by marching to it. check-parts reads the curved panels through
     `buildCar().volumes`.
   - Paint: 12 real factory paints in palette.js, and three factory schemes
     per car in COLOUR_PRESETS, tagged with `chassis` and offered only for
     that car. CHASSIS_PRESET sets each car's default; the Mustang and the
     Chevelle default to stripes (CHASSIS_LOOK). Voices have the real engine
     layout, redline, gear count and first-gear ratio (`firstGearTop`).
   - Opponents moved onto the new cars, and the race's reference chassis is
     the 911.

8. **Quicker, sharper real cars**, asked for after item 7: "the handling of
   all the cars accept for the wedge feels bulky and slow ... up the
   acceleration on each of the cars and improve the handling for each of
   them, each car shouls still feel diffrenst just far more responsive".
   Measured against the Wedge One before changing anything: 0-100 mph in
   6-14 s against 2.3, 0.8-1.1 g at 56 mph against 2.3, twice the Wedge's
   static spring compression, 37-44 m to stop from 60 against 20, and the
   nose overshooting 1.6-2.3x its settled yaw rate after turn-in against
   1.26. Steering response itself was already as quick as the Wedge's.
   - `STREET` in tuning.js scales all five real cars alike -- accel 1.8,
     grip 1.45 -- so each stays as far from the others as the real cars
     are. `gameSpecs()` in cars.js gives the scaled figures (0-60 / accel,
     quarter mile / sqrt(accel), skidpad * grip; top speed and turning
     circle unscaled). `npm run specs` and the garage card use them; the
     Wedge's specs are `measured: true` and unscaled. Each car's power,
     launchSpeed, powerFalloff, topSpeed, grips and steerRate were refitted
     with `scripts/fit-specs.mjs`.
   - `SIM.referenceMass` (780, the Wedge): spring rate, damper rate, brake
     and handbrake force, and yaw stability are given for that mass and
     scale with each car's (`massK` in VehiclePhysics, `springRate()` for
     the static sag in CarBuilder, GhostCar and check-parts). Every car now
     sits at the Wedge's depth on its springs (the 911's nose-up at rest
     halved), stops on its tyres, and settles after turn-in at 1.4-1.75x
     instead of 1.6-2.3x. The Wedge is unchanged: its scale is 1.
   - Rejected: a realistic per-car yaw inertia calmed turn-in the most but
     slowed it by 40 ms; starting yaw stability at 10 m/s calmed it further
     but also changed the Wedge and would tame power oversteer out of slow
     corners.
   - The specs crawl lost its 2% throttle floor, which pushed the stronger
     engines past 1.5 m/s and widened the circle; the Wedge's measured
     turning circle is 11.1 m on the corrected measure, not 11.6.
   - With the field nearer the Wedge's pace, a Wedge AI caught in the pack on
     Pine Ridge rubbed for 5.7% of the race (limit 5%). `AI.passGap` 0.7 ->
     0.85 and `AI.followTime` 0.3 -> 0.35 took Pine Ridge's contact steps
     from 3054 to 1159, worst car 3.4%.

9. **A temporary barrier gap, undone.** The user asked for one barrier taken
   out for a while to look outside a map; a `debugGap` on Copper Flats did
   it, and their next message had it undone completely. Track.js,
   TrackMesh.js's barrier loop and copper-flats.js are back as they were.

10. **Tesla Roadster, and a drag strip for two players**, asked for after
    item 9: "add a tesla roadster and a drag strip map that times the users
    time allow two players to race on this map". Asked and answered: the
    second-generation Roadster, and split screen.
    - PROMPT.md says "No multiplayer". Two players on one machine was the
      user's own request, so it supersedes that for the drag strip. Still no
      network: both players share the keyboard or have a pad each.
    - Roadster (`tesla-roadster`): Tesla's claimed 1.9 s, 8.8 s and 250 mph,
      scaled by STREET like the other real cars. Tesla has not published its
      power, weight or dimensions, so those are estimates from the 2017
      prototype, as are its skidpad and turning circle; `hp: null` shows as
      "Not published". New opt-in `awd: true` in VehiclePhysics: the drive
      cap is both axles' grip and the force is split between them by it --
      rear drive alone cannot reach the claimed launch. Its voice is
      `electric`: one gear shown as D, no clutch slip, a motor whine in
      Audio.js that is silent at rest. Factory schemes Red Multi-Coat (its
      default), Midnight Silver and Pearl White.
    - Mesa Dragway (`src/data/tracks/drag-strip.js`) is a closed loop like
      every track -- staging, the quarter mile, 418 m of shutdown, a 30 m
      turnaround, a return road 60 m to the right, and back -- so the lap,
      AI, timing and effects checks run on it unchanged. Its `drag` block
      (`lane`, `distance`) is what makes it a strip. `markings.centre` with a
      dash longer than the track is the solid line between the lanes.
      TrackMesh `_buildDrag` adds the finish and eighth-mile lines and a 3D
      tree whose lit lamps are meshes the game shows and hides.
    - `src/game/Drag.js`, headless on the fixed clock: a full tree (STRIP in
      tuning.js; DRAG there is aerodynamic drag), a 7-inch rollout, reaction
      time and red lights, 60 ft, 330 ft, 1/8 mile with mph over the last
      66 ft, 1000 ft, and the quarter's ET and trap, every crossing
      interpolated inside its step. First to the finish wins; a red light or
      crossing the centre line loses; two reds, the first to go loses.
      `npm run drag` is the ninth check.
    - Game: on a drag track `startDrag(settings)` replaces laps. The lap HUD,
      pace car, auto drive and ghost are off; R restages; N opens DragSetup
      (players, player 2's car and gearbox; player 1 drives the garage's
      car). The time slip (DragSlip) comes up once both have finished, both
      cars brake themselves while it is up, and each chassis's best ET is
      kept (`dragBest`). Two players: Input `twoPlayer` (W A S D and the
      first pad; the arrows and the second pad; E/Q and / . , to shift),
      Scene `renderSplit` (top and bottom, without the post chain, so no AO
      or bloom in split screen), a second ChaseCamera and Speedo
      (`.dash-p2`). Only player 1's engine is heard.
    - check-race skips drag tracks, where race mode is not offered;
      check-effects' manual test allows a single-speed car.

11. **Tunable gearboxes, and tighter-turning real cars**, asked for after
    item 10: "i want all the gearboxes to be tunable meaning the user can
    change the gear timing for the cars" and "all the cars accept for the
    wedge need to have a tighter turning radius because they all feel
    clunky, they should not all be the same".
    - Turning, measured first: at 40 mph the real cars went round a 23-33 m
      circle to the Wedge One's 17 m, with turn-in already as quick. Grip
      decides that, so `STREET.grip` 1.45 -> 1.8 (skidpad 1.4 g for the
      Chevelle up to 1.9 g for the 911 and Roadster; the Wedge is 2.1), and
      a new `STREET.turn` 1.2 shrinks every real car's turning circle (911
      11.2 -> 9.3 m; gameSpecs divides turningCircle by it). All six real
      cars refitted with fit-specs; at 40 mph they now turn a 19-29 m
      circle, each still its own. The Wedge One is unchanged.
    - Knock-on fixes: `AI.passGap` 0.85 -> 1.0, `passEdge` 0.6 -> 1.0 and
      `followTime` 0.35 -> 0.45 (Pine Ridge contact reached 9.3%, and cars
      passing on the outside of Copper Flats' long left-hander rode the kerb
      for 4 s). `EFFECTS.launchDriveUse` 0.9 -> 0.55 (grippier tyres hook up
      by walking pace, and a 911 launch left 40 cm of marks). The reverse
      test in check-determinism measures its 5 m along the path, since a car
      turning a circle under 10 m across never gets 5 m straight back; the
      scripted driver in check-timing holds its steering gain to 0.54 rad of
      lock.
    - Gearbox tune, per chassis, in the garage's new Gearbox section (the
      automatic/manual setting moved there): final drive (80-125%), the
      automatic's shift point in rpm, where each gear runs out in mph, and
      "Put the gearbox back to stock". Stored under `tunes`, apart from the
      cosmetic cars; Save car keeps it and Discard drops it. It applies to
      player 1's car and player 2's on the strip; the AI is always stock.
    - How it drives (Gearbox.js): `tunedChassis(chassis, tune)` returns the
      chassis itself for a stock tune, so every check's car is untouched,
      and otherwise a copy with power x finalDrive, topSpeed / finalDrive
      and a `gearing` voice (tops, shiftUp, shiftDown, stock). A tuned car
      drives through its gears in automatic too: VehiclePhysics changes
      `autoGear` on the fixed clock and applies `manualDrive`, which for a
      tuned voice multiplies by an engine power curve (`GEARBOX.powerPeak`,
      `powerDrop`) at its revs over the stock gearbox's, and gives a
      shortened top gear a limiter. The dashboard shows the physics gear.
    - Measured: a 911 goes 1.52-2.25 s to 60 and 161-218 mph across the
      final drive range; changing up at 70% of the redline costs 0.5 s over
      the quarter; top gear at 80% caps it at 170 mph. Guarded in
      `npm run fx`. The garage card shows top speed, 0-60 and quarter mile
      with the tune, in orange, from `src/game/Performance.js` (the standing
      start, now shared with check-specs).
    - CLAUDE.md's "chassis is the only thing that changes stats" rule now
      names the gearbox tune as the one exception, since the user asked for
      it. Lap records, ghosts and drag bests stay per chassis, tuned or not.
    - Follow-up report: "the larger cars look like they are almost coming
      off the wheels when turning". Asked first; the user saw the body
      leaning far over, chose to keep the grip and stop the lift, and a
      little lean per car. Measured: from about 45 mph the 911, Mustang and
      Chevelle (the Huracan from 65) rolled to `maxRoll` with both inside
      wheels in the air -- at 1.9 g the weight transfer about a 0.46-0.57 m
      centre of mass is more than the inside wheels carry. New per-chassis
      `rollCentre` in cars.js: the roll torque in VehiclePhysics uses
      (centerOfMassHeight - rollCentre), and a car without one (the Wedge)
      is unchanged. Each was set so the car leans about 10 degrees per metre
      of centre of mass height at the limit: now 2.8-5.1 degrees, the
      Chevelle and Mustang most, no wheel ever off the ground. Planted tyres
      grip more, so all six were refitted again (grips down, e.g. the
      Chevelle 1.61 -> 1.42); at 40 mph they turn an 18-27 m circle.
    - That refit left one race failure: a car passing on the outside of
      Copper Flats' long left-hander rode the kerb for 4.4 s. AIDriver chose
      its passing lane inside `passEdge` plus its half width, but clamped the
      aim point only to the racing line's limit; the aim is now held to the
      same edge (or the line, where the line runs wider). Tuning alone did
      not do it: `passEdge` 1.3 made Pine Ridge rub (7.3%), 1.5 changed
      nothing at Copper Flats.

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

## 2a. Milestone 9: built, waiting on the user's test

- **Screens** are in `src/ui/Screens.js`, built on the `Menu` in
  `src/ui/RaceScreens.js` (which gained section headings, `onFocus`,
  `onPadStart`, rows that have both a value and an action, and mouse − / +
  steppers on settings). Game owns the flow: `showTitle`, `openPause`,
  `openTrackSelect(mode, backLabel, onBack)`, `startSession(pick)`,
  `leaveToTitle`, `_holdFor(screen)`, `_resume`. `Game.screen` is the one
  up: 'title', 'pause', 'tracks', 'results' or null while driving.
- **Title** ("Full Lock", a name made up for it; section 8): Time trial,
  Race, Drag race, Garage, Controls, Volume. Every launch opens on it; the
  first launch ever (`Storage 'seenControls'`) also shows the controls card
  beside it. Behind the title and track select the camera flies the loaded
  track (`ChaseCamera.tour`, knobs `CAMERA.tour*`).
- **Track select** lists the tracks for the mode (drag strips for Drag race,
  circuits otherwise), a card with the map (drawn from the centreline, loose
  surface dashed, bridges drawn over), length, climb, surface, lighting, and
  every chassis's best on that track. Rows: the tracks (Enter on one starts
  it), the car (persisted as the garage's chassis when you start), then the
  mode's settings (race: laps, opponents, difficulty; drag: players, player
  2's car and gearbox; time trial: pace car, ghost), Start, Back.
- **Pause** (Esc / Start) has the mode's options (resume, restart, change
  track or settings, garage where allowed, leave race, back to the title,
  volume) beside the controls card, over a flat ink wash. The volume slider
  on the controls card is gone; volume is a menu row now.
- **End of a time trial session**: leaving a time trial with laps in it
  (starting anything from track select, or back to the title) shows the
  session results with a Continue row first (`Results.showEnd`).
- **N** opens track select (race, or drag on the strip) instead of the old
  race setup card; mid-race it does nothing (Esc has the race options).
- **Performance.** Physics is negligible (8 cars, under 0.04 ms a step);
  track loads are about 100 ms. The measurable stall was a shader built the
  first time something came into view mid-lap (268 ms at Copper Flats);
  `Scene.prewarm()` now compiles every material after anything is built
  (`Game._prewarm`). Two GTAO normal-pass shaders still build at the first
  launch (about 20 ms, once per page load). Draw calls run 430-1090 a frame
  with a full field; GPU cost is left to dynamic resolution as before.
  Frame timing in the hidden Browser pane is GPU-queue bound and not a
  guide to real fps.
- **Rough edges**: the telemetry panel remembers being hidden
  (`Storage 'telemetry'`); stale "milestone 9" comments updated.

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
  This was flagged to the user and never answered. The garage's Graphics
  setting (section 2, item 6) now offers Low to Ultra; Ultra is the default
  and is exactly these values, so tune the top end in `GRAPHICS` and the
  steps down in `GRAPHICS_LEVELS`.
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
npm run fx      # ghost records/replays exactly, gearbox never hunts, a gearbox tune is felt, skid marks on road, pools bounded
npm run specs   # every real car does its real 0-60, quarter mile, top speed, skidpad and turning circle
npm run drag    # drag timing: reaction, splits, ET against the quarter mile, red lights, fouls, determinism
```

All nine must pass before calling anything done. `race` takes a couple of
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
  - Six tracks: Copper Flats, Harbor Nine (night), Pine Ridge (gravel sector),
    Skyline Interchange (figure 8 with a bridge), Glacier Pass, and Mesa
    Dragway, a drag strip (its `drag` block; section 2, item 10).
  - Control points carry `{x, y, z, width, surface, banking, bridge?}`. Track
    files also set palette, sky, props and lights.
- **Seven chassis** in `src/data/cars.js`: porsche-911, mustang-gt,
  chevelle-ss, ferrari-enzo, lamborghini-huracan (modelled on the real cars;
  see section 2, item 7), tesla-roadster (item 10) and wedge-one, the
  open-wheeler. All but the Roadster (`awd: true`) drive through the rear
  axle in the physics.
- **Gearbox tune** (section 2, item 11): `normalizeTune`, `tunedChassis` and
  `autoGear` in `src/game/Gearbox.js`. Game builds every player car with
  `chassisFor(id)`; a stock tune is the chassis object itself.
- **Drag strip**: `src/game/Drag.js` (headless timing and rules),
  `src/ui/DragScreens.js` (lane HUD, setup, time slip), `Scene.renderSplit`
  and Input's `twoPlayer` for two players. Run by Game whenever the track has
  a `drag` block. Guarded by `npm run drag`.
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
  in mph), `RaceHud.js`, `Screens.js` (title, pause, track select),
  `RaceScreens.js` (the shared `Menu` and race results), `DragScreens.js`,
  `Garage.js`, `Results.js` and `DebugHud.js`, with markup in
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

- Real cars cornering on two wheels: raising `STREET.grip` to 1.8 let the
  tall cars pull more g than their centre of mass height allows, so they
  rolled to `maxRoll` with the inside wheels in the air. Fixed with a
  per-car `rollCentre` (section 2, item 11). After any grip change, measure
  the roll and wheel lift at full lock at 12, 20 and 30 m/s, not just the
  skidpad.

## 7. Current keybindings (from `src/core/Input.js`)

Keyboard:
| Key | Action |
|---|---|
| W/↑ | throttle |
| S/↓ | brake, and reverse from a stop |
| A/← and D/→ | steer |
| Space | handbrake |
| R | reset to the last checkpoint; on the drag strip, back to the line |
| C | camera |
| Esc | pause (controls card and volume slider) |
| Tab | session results |
| G | garage |
| H | ghost on/off |
| M | mute |
| P | auto drive |
| N | track select (race; on the drag strip, drag race) |
| V | next chassis |
| T | next track |
| O | pace car |
| backtick | telemetry (remembered) |
| B | manual gearbox on/off |
| → / ← | shift up / down (manual, driving on W A S D) |
| D / A | shift up / down (manual, driving on the arrows) |
| X | neutral (manual) |
| E / Q | two-player drag: player 1 shifts up / down (manual) |
| / and . | two-player drag: player 2 shifts up / down, comma neutral (manual) |

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
| second pad | player 2 in a two-player drag race: triggers, stick, RB / LB, D-pad down, X camera |

Menus: ↑ ↓ ← → (or W A S D) Enter Esc on the keyboard; D-pad or left stick,
A and B on a gamepad, and Start (starts on the title, resumes from pause).
Settings rows also have − and + for the mouse. In the garage, digits type the
driver number, and Delete/Backspace (pad X) deletes one of your own presets
in the preset dropdown.

## 8. Unresolved questions put to the user

- The title screen needed a name and got "Full Lock" (also the page title).
  Asked whether they want a different one.
- The track files' `targetLap` values are now slower than the AI on Copper
  Flats and Pine Ridge. Should they be updated?
- `Claude.md`'s Performance section still says pixel ratio 1.5. Should it be
  updated to match the build?
- No ghost exists for a best set before milestone 8 until that best is beaten.
  An offer to record a ghost from the next clean lap when none exists was made
  and not answered.
- Only the player's car has engine sound; the AI cars are silent.
