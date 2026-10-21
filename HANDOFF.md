# Handoff: blocky racing sim

Read this file, then `Claude.md` (the project rules), then `PROMPT.md` (the
full spec) before touching anything. This file is the state of the project and
everything the previous agent knew that is not written down elsewhere.

**Flight work** (the second game mode, an F-22 and a world to fly it in): read
`FLIGHT.md` (the user's spec), then `FLIGHT_PLAN.md` (the plan and review the
user approved, with the answers to the spec's open items), then sections 9 and
10 below. Section 10 starts with a "start here" box.

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
- **Flight (2026-10-19 on):** branch `Flight_test`, cut from `initial-build` at
  `00d6bb0`. Milestones 1 (an F-22 on a test field), 2 (the open world) and 3
  (airports and the ground) of ten are built. The user flew milestone 2 three times
  and sent notes each time (sections 10e, 10f, 10g: all fixed), then said on
  2026-10-20 that they were ready for milestone 3, which was planned, approved,
  built and verified the same day. **Milestone 3 is built and waiting on the user's
  test** (section 10i: what was built, what to test, what bit). Do not start milestone
  4 until they have flown it and sent notes. **Nothing flight-related is committed**
  (the working tree holds all of it, including `FLIGHT.md`, `FLIGHT_PLAN.md` and
  `FLIGHT_M3_PROMPT.md`, which are untracked, and edits to `Claude.md` and this file).
  Commit only when asked, as the user, with no Claude co-author trailer. Section 10 is
  the whole story.

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
  `src/core/Input.js` (the cars) and `src/core/FlightInput.js` (flight) rather
  than from memory; section 7 has the current lists. Include the menu controls
  line. When the response is only about flight, the flight keys first, then the
  car keys.
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
  me not claude" on 2026-09-11. A harness reminder may tell you to end commits
  with a `Co-Authored-By: Claude` line; the user's rule wins, leave it off.
- Flight: stop at the end of each of its ten milestones, say exactly what to
  test, and wait (FLIGHT.md's workflow section). When the user reports a
  flying problem, change `tuning.js` or the aircraft's data first.
- The user runs their own `npm run dev` (ports 5173 and now 5174). Never kill
  it. Scripts that open the game take a URL; the default is 5173.
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

npm run flight  # the aircraft model: atmosphere, signs, trim, stalls, the published figures,
                # thrust vectoring, g limit, a bank that holds, the control-rate envelope,
                # keyboard stall recovery, the ground, frame-rate invariance, no allocation
npm run world   # the open world: the car game's ground and meshes unchanged (hashes), the height
                # function, chunks and their seams, track placement, the floating origin, the AI
                # cars' state and exact replay-to-live hand-over, takeoff from the home runway
npm run look    # NOT a check of numbers: opens the game in a real Chrome (dev server running),
                # takes screenshots of flight, fails on any console error. Section 10c.
npm run look-world   # the same for the open world: each track area from the air and from beside
                # its road, the coast, the mountains, a pixel-for-pixel rebase test, draw costs
node scripts/soak-world.mjs [seconds] [m/s]   # flies the real game for a while at speed and
                # reports frame pacing, chunks, rebases, jobs (section 10d)
```

All nine car checks, `npm run flight` and `npm run world` must pass before
calling anything done (FLIGHT.md names three more flight checks, `combat`,
`airrace` and `missions`; they arrive with their milestones). Run `npm run look` after any
change to what is drawn, and then READ the screenshots. `race` takes a couple of
minutes. Also run `npx vite build --outDir <scratch>`: it is the only thing
that catches syntax and import errors in browser-only files (`Game.js`,
`Audio.js`, `main.js`), because no headless check imports them.

To see the game, prefer `npm run look` and `scripts/lib/browser.mjs` (section
10c): a real Chrome driven from Node, which worked when the Claude Browser pane
refused the page ("Policy check in progress", then "denied or failed"). Older
notes, for the Browser pane when it does work:

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

**Flight architecture** is in section 10 (and `FLIGHT_PLAN.md`). In one
breath: `src/flight/` is a headless aircraft model (`AircraftPhysics`, six
`Wing` surfaces with lift and drag curves, `Engine`, `Gear` contact, `Atmosphere`),
driven from `src/core/FlightGame.js`, which borrows the car `Game`'s renderer,
sound and loop and swaps them back on exit; the title's Fly row enters it. Since milestone 2 it flies over `src/world/`
(headless: noise, heightfield, biomes, track areas, chunks, floating origin, the
AI cars on the tracks) drawn by `src/render/WorldMesh.js`; section 10d.

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

### 7a. Flight keybindings (from `src/core/FlightInput.js`)

The flight mode has its own input layer; the car `Input` is suspended while it
is up. Keys marked (later) are in the mapping the user approved
(`FLIGHT_PLAN.md`) and are collected as actions, but no system reads them yet.

Keyboard:
| Key | Action |
|---|---|
| Up / Down | pitch: Up pushes the nose DOWN, Down pulls it up (Invert pitch row on the pause card flips it) |
| Left / Right | roll |
| A / D | rudder, and nose wheel steering on the ground |
| W / S | throttle up / down (a lever: held keys move it) |
| Left Shift | afterburner, held |
| G | landing gear |
| V | airbrake, held |
| B | wheel brake, held (it comes on a little at a time, `FLIGHT_INPUT.brakeAttack`) |
| C | camera: chase, cockpit, far orbit |
| Right mouse, held | free look (middle button in mouse flight) |
| U | HUD on / off |
| N | mute |
| T | mouse flight on / off (pointer lock; Esc gives it back and pauses) |
| R, held 1 s | back to the hangar (a stopped aircraft at the mouth of a bay of the airport last used) |
| Esc | pause |
| Space, F, Q, E | cannon, missile, flares, next target (later) |
| ` (backquote) | telemetry (collected, nothing reads it yet) |
| Z / X | flaps up / down (later) |
| P, H | autopilot, hover assist (later) |
| M | the map (milestone 3: pick an airport, Teleport) |
| L | reserved for lights (milestone 9) |

Mouse flight (T): the mouse moves pitch and roll from the screen centre with a
deadzone, the wheel is the throttle, left button cannon (later), right button
missile (later), middle button held looks round.

Gamepad (standard mapping):
| Button | Action |
|---|---|
| Left stick | pitch and roll |
| Right stick X / Y | rudder / throttle |
| R3, held | the right stick looks round instead |
| LT | wheel brake (analog) |
| RT | cannon (later) |
| A / B | afterburner / airbrake, held |
| X / Y | gear / camera |
| RB / LB | missile / flares (later) |
| D-pad up / down | next target / autopilot (later) |
| D-pad left / right | flaps up / down (later) |
| L3 | HUD |
| Back, tapped | the map |
| Back, held, then A | back to the hangar (held 1 s) |
| Back, held, then B / X | mute / hover assist (hover later) |
| Start | pause |

A pad with no standard mapping (a flight stick) falls back to axis 0 roll, 1
pitch, 2 twist rudder, 3 throttle slider; untested, there is no hardware.

Flight menus use the same menu controls as the rest (the line above).

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

Flight (all still open; none blocks milestone 2):

- Should flight have its own stored graphics level, default Medium? Chosen by
  default in the plan (the car default is Ultra, 24 to 27 ms a frame at
  2880 x 1800 before dynamic resolution); to be built in milestone 10. Until
  then flight uses the saved car level, and ambient occlusion is forced off.
- Trees do not collide (the spec asked; the plan says no).
- The crash rule in FLIGHT.md (a crash replaces the airframe, repairing it) is
  a free repair for crashing on purpose. The plan proposes respawning with the
  damage you had when you left the apron. Not yet answered.
- Name and design of the invented helicopter: proposed "Magpie 48" in the plan.
- `Claude.md` still says "You cannot see the screen"; it can now be seen
  (section 10c). It is the user's file, left alone.
- The 737-800 approach speed is still to be sourced (milestone 4); the plan
  deliberately quotes none.
- (2026-10-20) What did the user mean by "the F-22 engines move with the rear
  ailerons when you're taking off"? Read as part of the tail strike complaint and
  fixed there (10f item 2); if it was about how the nozzles look, it is open.
- (2026-10-20) A dictated sentence in the user's last message did not parse
  ("That's why Dubai, you can leave your feet down. Why you can leave your
  everything."): asked in the reply, unanswered.
- (2026-10-20) The Detail slider's default is High (exactly the old world). The
  user's GPU is underused at that; should the default be higher for the user's
  own graphics level? Waiting to hear what they pick. The video memory above Ultra
  is the limit (10g); colours and normals as half floats would halve it, not done.

## 9. Flight addition

FLIGHT.md (written 2026-10-19) adds a flight mode in ten milestones. Read it
after this file and Claude.md. The standing instructions in section 3 apply to
flight work too, and the nine checks in section 4 must pass at every
milestone, as must `npm run flight` and, as they arrive, the other four.

Decided by the user: single player, everything unlocked (through
`isUnlocked()`), a large world with a render distance slider, tracks as flyover
scenery with AI cars, per-part damage that carries over, planes swap only at a
hangar. The plan for milestone 1 and the review of FLIGHT.md were approved on
2026-10-19 (`FLIGHT_PLAN.md`); the review's findings are in section 10.

What comes next, in order:

1. **Milestone 2 (the open world) is built and accepted** (10d to 10g). The next job is
   **milestone 3, airports and the ground** (10h, and `FLIGHT_M3_PROMPT.md`). Start it
   in plan mode, as FLIGHT.md's workflow says, and wait for the user's approval of the
   plan. They want one milestone at a time: stop at the end of milestone 3 and say
   exactly what to test; do not start milestone 4.
2. Milestones 4 to 10 as FLIGHT.md lists them. Milestone 3 replaces the interim
   home runway (section 10d) with the tiered airports.


## 10. Flight

### 10.0 Start here (for a new chat)

- State: flight milestones 1 (the F-22 on a test field), 2 (the open world) and 3
  (airports and the ground) are built. Milestones 1 and 2 are accepted. MILESTONE 3 IS
  BUILT AND WAITING ON THE USER'S TEST (2026-10-20): read 10i (what was built, what to
  test, what bit, the known gaps) and wait for their notes, which go in 10j. DO NOT START
  MILESTONE 4 (the 737 and VTOL, FLIGHT.md's milestone list) until they have flown it and
  said so. Branch `Flight_test`. Uncommitted.
- Read, in order: this section, 10a to 10i (10e to 10g are the latest fixes and 10g
  supersedes the g limiter described in 10f; 10h is milestone 3's starting point, 10i what
  was built), `FLIGHT.md` (the Airports, Hangar, Map and radar and Menus and flow sections
  are now implemented; the milestone list), `FLIGHT_PLAN.md`. All nine car checks and
  `npm run flight` pass; `npm run world` passes everything but four checks that fail in this
  container and on the pristine tree alike (three mesh hashes and one chunk-time check: 10i).
  `npx vite build` is clean (last run 2026-10-20 after milestone 3; the 800 kB chunk advisory is
  old).
- Commands: `npm run dev` (the user already has servers on 5173 and 5174),
  `npm run flight`, `npm run world`, `npm run look` and `npm run look-world` (need a
  server; `CHROME` is the browser, `CHROME_ARGS` extra flags such as `--no-sandbox`;
  `node scripts/look-world.mjs <out> <url> <only>` takes a substring of a shot's name:
  `airport`, `ground`, `night`, `map`, `radar`, `hangar`, `zfight`), `node scripts/soak-world.mjs`,
  `node scripts/fit-aircraft.mjs` after changing the aerodynamics, engines or mass. A very slow
  `npm run world` (minutes, not 25 s) means the machine is swapping, not a regression.
- Where things are: `src/flight/` (physics, headless), `src/world/` (the world, headless: 10d;
  `Chunks.js` also cuts the sea at the waterline, 10f; `Airports.js` and `MapData.js`: 10i),
  `src/data/aircraft.js`, `src/data/airports.js` (the airports as data), `src/data/loadouts.js`
  (the Hangar's options), `src/data/biomes.js`, `src/data/tuning.js` blocks `FLIGHT`, `FIELD`,
  `FLIGHT_CAMERA`, `FLIGHT_HUD`, `FLIGHT_AUDIO`, `SHOCK` (the Mach 1 effect), `FLIGHT_INPUT`,
  `OPEN_WORLD` (the end of the file: the detail steps, `airports`, `night`), `HANGAR`, `MAP`
  and `RADAR`, `src/core/Flight*.js` (`FlightPlaces.js` the last airport and the bays),
  `src/core/HangarStore.js`, `src/render/{Aircraft,AircraftBuilder,AirportMesh,Field,World,Flight,ShockWave}*.js`,
  `src/ui/{Flight*,MapScreen,Radar,Hangar,Turntable}.js`, `scripts/check-flight.mjs`,
  `scripts/check-world.mjs`, `scripts/lib/{flight-harness,browser,track-hash}.mjs`.
- Storage keys of flight: `flight.units`, `flight.hud`, `flight.renderDistance`, `flight.detail`,
  `flight.seenControls`, `flight.invertY`, `flight.night`, `flight.lastAirport`,
  `flight.teleportMode`, and per aircraft `flight.livery.<id>`, `flight.loadout.<id>`,
  `flight.tune.<id>`, `flight.damage.<id>` (all under the `racing-game.v1.` prefix).
- What has been heard or flown by the user, and what has not: they confirmed the
  idle hold works and that the Mach 1 effects "work well". NOT yet judged by them:
  the rebuilt engine sound, the flat nozzles' look, how the pitch stick feels after
  10g (stronger pull, firmer damping, a gentler push), the water after 10f, the
  Detail slider on their GPU, and everything in milestone 3 (10i, "Waiting on the
  user's test"). Ask, do not assume.
- Open questions put to the user (also section 8): what they meant by "the F-22
  engines move with the rear ailerons" (read as the tail strike; the nozzle
  deflection on a pull is physically right and unchanged); and a dictated
  sentence in an earlier message that did not parse ("you can leave your feet down
  ... leave your everything").
- How the user works: they fly it and send notes, by dictation (expect odd words:
  "ailerons" for the stabilators, "inner distance" for the near plane). They want
  sim-like, not arcade: no assist that fights a turn. When they report feel, change
  `tuning.js` first and check with the harness (`scripts/lib/flight-harness.mjs`,
  `trimmedFlight`, and the taxi, takeoff and landing pilots) before and after. A feel
  problem is often a feedback loop: look at the time series (see the traces in 10g and
  10i) before turning knobs.
- How you check your own work: the numbers with `npm run flight` and `npm run world`;
  the picture with `npm run look`, `npm run look-world` and by reading the PNGs. You
  can see the screen now. For a render fix, shoot before and after from several
  distances and compare crops. A software-GL Chrome draws a frame in seconds: drive
  timers by hand (see 10i).
- Their dev server and yours: if `preview_start` says port 5174, the user's own
  server holds 5173. Do not kill theirs. Stop any server or Chrome you start.

### 10a. Milestone 1: built (accepted; the user's notes are 10b)

Branch `Flight_test`, nothing committed. All nine car checks and `npm run
flight` pass, and `npx vite build` is clean. The user flew it and sent notes;
the fixes are in 10b. The Browser pane refused the page, so the screen is now
seen through a real Chrome driven from Node (`scripts/lib/browser.mjs`, `npm run
look`; section 10c). What has still not been felt by anyone but the user is how
it flies: the sticks, the camera's lag and the sound.

What is in it (files marked + are new):

- `src/flight/` (headless, plain numbers, no allocation in `step()`; the one
  exception is `Aircraft.js`, which binds the physics to a mesh like
  `Vehicle.js` and so imports Three.js)
  - `+ Atmosphere.js` ISA to 32 km, geopotential. `calibratedAirspeed()` is
    what the airspeed indicator reads (with compressibility).
  - `+ Wing.js` one lifting surface and the `Curve`/`MachTable` lookups.
  - `+ Engine.js` thrust from throttle, density and Mach; spool lag; afterburner.
  - `+ Gear.js` CONTACT ONLY: spring and damper wheels, rolling friction,
    nose steering, a wheel brake, and the hull's contact. No retraction limits,
    damage or hangar zone (milestones 3 and 5).
  - `+ AircraftPhysics.js` the body. `attitude()` and `quatFromAttitude()` are
    the only place pitch, bank and heading signs are decided.
  - `+ Aircraft.js`, `+ Units.js` (knots, feet, Mach; mph; metric).
- `src/data/aircraft.js` the F-22 and `figures`, the numbers it is held to with
  where each came from. `unlocks.js` is `isUnlocked()`.
- `src/world/TestField.js` the flat field and its runway, implementing the
  ground contract `sample(x, z, y) -> { height, normal, surface }` that the
  world will too.
- `src/render/` `AircraftBuilder.js` (Loft fuselage, slab wings, canted fins,
  nozzles that tilt and burn, gear that retracts), `FieldMesh.js`,
  `FlightCamera.js`.
- `src/core/` `FlightGame.js`, `FlightInput.js`, `FlightAudio.js`.
- `src/ui/` `FlightHud.js`, `FlightScreens.js` (the Fly menu, the pause card,
  the controls card).
- Existing files touched: `CarBuilder.js` (`export class Loft`, nothing else),
  `Scene.js` (three additive methods, `holdCarWorld`, `releaseCarWorld`,
  `setEnvironment`, plus `setCameraRange`), `Game.js` (the title's `Fly` row
  and `onFly`; Garage's title focus moved from 3 to 4), `main.js`
  (builds `FlightGame` on first use, by dynamic import), `tuning.js` (blocks
  APPENDED at the end: `FLIGHT`, `FIELD`, `FLIGHT_CAMERA`, `FLIGHT_HUD`,
  `FLIGHT_AUDIO`, `FLIGHT_INPUT`), `styles.css` (appended), `package.json`
  (`flight`).
- Scripts: `scripts/check-flight.mjs`, `scripts/fit-aircraft.mjs`,
  `scripts/lib/flight-harness.mjs` (a headless aircraft, the field, and the
  scripted pilots both use).

Conventions: body +x LEFT, +y up, +z nose, the same as the cars; world north is
+z, east is -x. Orientation is a quaternion and the angular velocity is in body
axes, right-handed: +wx nose DOWN, +wy nose LEFT, +wz roll RIGHT. Pull is nose
up, roll right is right wing down, yaw right is nose right. `FlightInput` flips
signs once at its boundary; `aircraft.js` writes each surface's control gains
once.

How it flies: six surfaces (two wings, two stabilators, two canted fins), each
with a lift and drag curve against angle of attack (`Wing.force`: spanwise flow
removed, lift perpendicular to the flow, induced drag from the lift and
replaced by the flat plate past the stall). Compressibility is two tables in
`aircraft.js` (`liftMach`, `waveCd`) because a straight lift-and-drag model has
no transonic drag rise. Two engines (35,000 lbf EACH with the afterburner), a
separate afterburner tank (`FLIGHT.abDuration`, `abRefill`), pitch-only thrust
vectoring that fades with dynamic pressure. The aids are knobs in `FLIGHT` with
the master switch `aids`: roll self-levelling (off by default since the first
flight), auto-trim (it holds a shallow flight PATH, not the attitude, and also
trims off steady back pressure), angle-of-attack softening, the sideslip limiter,
the g limiter. Rate damping is always on, and its gains set the top rates. The flight computer drops
scheduled flaps with the gear down (`flapAlpha` in the data, `flapUp` in
tuning), which is what lets it lift off at 153 kt without a tail strike.

Fit (`node scripts/fit-aircraft.mjs`): level in full afterburner at 40,000 ft
Mach 2.20, on military power Mach 1.75 (supercruise), Mach 0.9 to 1.5 in
afterburner at 30,000 ft in 75 s, thrust to weight 1.26 at half fuel, +9 g,
holds 50,000 ft, takes off in 292 m. Sources and which figures are estimates
are in `aircraft.js` (USAF only says "Mach 2 class" and "above 50,000 ft";
Mach 2.25, 65,000 ft, the supercruise range and the dry thrust are not USAF).
After any change to the aerodynamics, engines or mass, run the fit and paste the
tables it prints.

Wiring: the title's Fly row calls `game.onFly()`. `FlightGame` borrows the car
Game's Scene, SoundEngine and Loop (a canvas has one WebGL context): it hides
the car world, suspends the car `Input`, swaps `loop.step`/`loop.render`, and
puts everything back on the way out (`Scene.setTrack(track, trackMesh)` brings
the circuit back, then `game.showTitle(3)`). Ambient occlusion is switched off
while flying. In dev, `window.flight` is the FlightGame; drive it by hand with
`flight.enter()`, `flight.start('runway' | 'air')`, `flight.step(1/120)` and
`flight.render(0.5, 1/60)` when the pane is hidden.

Decisions made while building, on top of the plan's list:

- Wing incidence 5 degrees and scheduled flaps (above), because the F-22
  could not rotate to 10 degrees on the runway without scraping its tail.
- The test field has no `Backtick` telemetry; the controls card marks every
  key whose system is not built yet ("not built yet"): flaps, autopilot, hover
  assist, weapons, targets, the map.
- A hard hit resets you to the runway after 2.6 s with a note (the stand-in for
  the milestone 5 crash flow).
- The Fly menu has "Start on the runway", "Start airborne", Controls, Units,
  Volume and "Back to the title"; the pause card adds an invert-pitch row.
- Graphics level is the saved car one for now (Ultra by default). The plan's
  separate `flightGraphics`, Medium by default, is still to do in milestone 10.

What the user should test (the list in the plan, restated): takeoff in
afterburner and rotation; a loop and a roll; the stall warning, then a stall and
the recovery; thrust vectoring at 100 kt against 400 kt; a supersonic pass; the
three cameras and free look; mouse flight (T); a gamepad. Look for: the
aircraft looking like an F-22 from behind, the side and the front; whether the
HUD horizon moves the right way; whether the stick directions feel right
(Up pushes the nose down, Down pulls it up; Invert pitch is on the pause card);
whether it is too twitchy or too sluggish (change `dampPitch`, `dampRoll`,
`dampYaw`, `qFadeRef` and the aileron/stabilator gains first); the afterburner
tank draining (`abDuration` 60 s); the sound.

Things learned:

- Auto-trim holds a path, so a test that releases the stick while the pilot has
  back pressure on drifts until the trim has absorbed it. `trimHold` does that
  absorbing. The test pilot in the harness uses a dead band for the same reason.
- A drop test must start just above the ground: the aircraft gains sink while it
  falls, so a 3 m drop with a 2.5 m/s start landed at 4 m/s.
- Geometric altitude tables (Wikipedia's ISA) differ from geopotential ones by
  0.16% at 10 km; the model is geopotential and the check's table is too.
- The fit is badly conditioned if top speed and supercruise are both fitted
  with the same two knobs; `fit-aircraft.mjs` fits the wave drag to supercruise
  first (the dry engines are fixed), then the afterburner's ram to top speed.
- `tuning.js` line 12 and `VehiclePhysics.js` line 13 still say "+x right" and
  "yaw increases turning right"; the code, `Input.js` and this file say +x is
  LEFT. Left alone.

### 10b. The user's first flight, and what was changed (2026-10-19)

Their notes: the handling was "too arcade"; the plane levelled itself when they
were trying to turn; the rudders physically moved outward and inward; the rudder
felt sluggish; a stall sent them into a death spiral they could not get out of.
The gear, the stall sound and the takeoff were fine.

Found, by measuring first (`scripts/lib/flight-harness.mjs`, and a stall script
that flies a keyboard pilot):

- **Self-levelling** (`FLIGHT.levelStrength` 0.9) rolled the wings level the
  moment the roll key came up. Now 0: a bank stays where you put it. The knob
  is still there and still tested.
- **Auto-trim held the flight PATH, whatever it was**, so after a stall the
  nose-down dive was held straight into the ground at 560 kt with the stick
  centred. It now holds only a shallow path (`trimMaxPath` 0.35 rad, 20 deg), is
  slower (`trimRate` 1.6 -> 0.7), and past that path angle the trim relaxes to
  neutral over `trimRelax` seconds, so the airframe's own stability pulls the
  nose up. Together with the rate changes below, 16 of 16 keyboard stalls
  (held pull, then a pilot centring the stick; or fighting it with roll and
  rudder for three seconds) are recovered with at least 2,100 m of the 3,000 m
  to spare, and 40 randomly abused flights never ended in a spin.
- **The roll and pitch rates were wild**: 245 deg/s of roll at 300 kt, 280 at
  Mach 0.9, 5 g in 0.6 s. Rate damping is what sets the fastest an axis will
  turn (full stick against the damper), so `dampRoll` 0.12 -> 0.35, `dampPitch`
  0.25 -> 0.4, and the stick ramp slower in and faster out (`stickAttack` 3 ->
  2, `stickRelease` 5 -> 10). Roll is now 100 to 125 deg/s, pitch 25 to 40
  deg/s, and a tapped roll stops about 12 deg after the key comes up.
- **The rudder** was weak at approach speed (a fin can only make so much
  force at 150 kt and it was already at its stall angle at full pedal) and
  swung the nose back through the sideslip it made. The fins are bigger (7.5 m2
  each, from 4.5), the yaw inertia a fifth lower, the pedal has its own faster
  ramp (`yawAttack` 6, `yawRelease` 7), `dampYaw` is 1.6, and a sideslip
  limiter (`betaLimit` 0.22 rad, `betaFloor` 0.35) lets a held pedal settle near
  12 degrees of sideslip instead of skidding or swinging. The rudder now yaws at
  21 deg/s after 0.4 s at 150 kt and 29 deg/s at 300 kt, from 7 and 29.
- **The rudders and flaperons are real hinged panels now.** The old rudder
  turned the whole canted fin about its own axis, which looked like it swung in
  and out. Each fin is a fixed fin and a rudder on a slanted hinge line; each
  wing has an inboard and an outboard flaperon. They move with the control and
  with the scheduled flaps.
- **A crash used to throw the numbers out of range** (the skin's contact is
  stiff; driving through it at 200 m/s gave 1e93 rad/s and NaNs). A wreck now
  stays where it fell, with finite numbers, until the crash flow replaces it.

Found by looking at it:

- The car's telemetry panel (`.debug-hud`) was showing over the flight HUD.
  Hidden while flying.
- The pitch ladder is wrong in the chase views, because the camera is not the
  nose. The ladder and flight path marker are cockpit-only now, and the chase
  views get a small attitude indicator (bottom right).
- The sun was in front of an aircraft flying north, so the side the chase
  camera sees was in shadow. It is behind and above now (`FieldMesh`).
- The horizon: the plain was 20 km across and the fog ended at 16 km, so the
  visible ground stopped about 5 degrees below the true horizon. 40 km and
  32 km (`FIELD`).
- The near plane grew with altitude (20 m at 5,000 ft) and sliced the tail off
  a close camera. It is now never more than 0.45 of the camera's distance from
  the aircraft.
- The afterburner nozzles were flat pink discs at idle; the throat is dark at
  idle and glows with the spool (its own material per engine).
- Free look aimed at a point 14 m ahead of the aircraft, putting it at the edge
  of the frame when swung round; it aims at the aircraft once swung.
- The cockpit eye sat so far back the nose filled a third of the screen
  (`cockpitEye` [0, 1.36, 3.1]).

New tests in `npm run flight` for all of it: the bank holds after a roll key
(with the aids as shipped, and at 200, 300 and 350 kt), the roll-levelling knob
still works, the rate envelope at 150, 300 and 500 kt (roll 70 to 165, pitch 15
to 55, rudder response, sideslip under 22 deg, no swing back), the keyboard
stall recoveries above, and the wreck. The trim test now measures what it
promises, that the path does not wander once the stick is let go (within 3 deg
over 25 s), instead of altitude.

### 10c. Seeing the game

`scripts/lib/browser.mjs` drives the installed Google Chrome from Node with no
packages: headless Chrome with a remote debugging port, spoken to over the
DevTools protocol with Node's own `fetch` and `WebSocket`. It uses the real GPU
(ANGLE on Metal on this machine) and does key events, JavaScript in the page,
the page console and screenshots. The approach is the one Flutter's engine test
harness uses (`lib/web_ui/dev/chrome.dart`).

- `npm run look [out-dir] [url]` (dev server running): the title, the Fly menu,
  a runway start, an airborne start in chase, cockpit and orbit, a close-up of
  the control surfaces, the pause card and back on the title, and it exits
  non-zero if the page logged an error or threw. Then read the PNGs.
- To script a flight, `const b = await launch({ url })`, then `b.eval('...')`,
  `b.key('keyDown', 'ShiftLeft', 'Shift')` (key codes are `KeyboardEvent.code`),
  `b.shot(path)`, `b.console`, `b.close()`. `window.flight` is the FlightGame;
  `flight.camera.cfg = { ...flight.camera.cfg, distance: 21 }` brings the camera
  in close. The rAF loop runs in real time there, so wait for the aircraft to
  get somewhere (a takeoff roll takes about 8 s to rotation speed).
- It cannot feel the sticks, hear anything, press a gamepad or take pointer
  lock; those are still the user's to report.
- `CLAUDE.md` still says the screen cannot be seen; that is the user's file and
  was left alone.

### 10d. Milestone 2: the open world, built (accepted 2026-10-20; the user's notes are 10e to 10g)

Branch `Flight_test`, nothing committed. All nine car checks, `npm run flight` and
`npm run world` pass, `npx vite build` is clean, and the page's console is clean
through `npm run look`, `npm run look-world`, `scripts/soak-world.mjs` and a run of
every car track before and after a flight. (`vite build` has always printed the
">800 kB chunk" advisory for the main bundle; it did before this milestone.)

What is in it (files marked + are new):

- **The ground the car game builds from, unchanged, and proved so.**
  - `+ src/game/TrackGround.js` is `TrackMesh._terrainHeight` moved out, headless:
    `height`, `heightAndOutside`, `outside`, `surfaceHeight`. `TrackMesh` calls it.
  - `TrackMesh(track, { ground, defer })`: `ground: false` skips its own ground plane,
    and the constructor body is a generator, `steps()`, that yields between pieces (the
    whole mesh is 40-70 ms with its ground, about 10 ms without; the largest step is
    4.5 ms). The default path drains it, so output is byte-identical.
  - Proof: before touching `TrackMesh` a hash of the ground over a grid and of every
    attribute, index, group and instance matrix of the built mesh was recorded for all
    six tracks (`scripts/lib/track-hash.mjs`); after the extraction every hash is
    identical, and they are the goldens in `check-world` (a change to a track file or to
    the ground changes them on purpose: re-record with that script).
  - The six track files each gained one line, `world: { biome }` (data the car game
    never reads; `check-world` asserts a biome guessed from palette, terrain and
    surfaces equals it for all six, so a seventh file needs none).
- **`src/world/` (headless, no Three.js except where marked)**
  - `Noise.js`: integer-hash value noise (no `Math.sin`: the same world on every
    machine), fbm and ridged, each octave turned by a 3-4-5 rotation.
  - `Heightfield.js`: `base(x, z)` (continents and a sunk rim, the plain, ranges, hills,
    canyons; the ranges are read through warped coordinates or the lattice shows in the
    crests), `height(x, z)` (base, the home runway's flat rectangle, and each track area
    blended in). Seed 195, picked by looking at contact sheets of maps for a home on a
    plain with mountains and a coast in reach. 53% land.
  - `Biomes.js` and `src/data/biomes.js`: seven biomes (grassland, desert, forest,
    snow, flats, coast, city) from slow temperature and moisture patterns, height
    (snow lines per biome), and each track's area pulling its own biome in over a band.
    Ground tones, rock, sand, fog tint and the props of each are data.
  - `TrackAreas.js`: every track is an area: a rigid frame (position, heading, base
    height; `worldY = localY - groundLevel + base`) round the track's own coordinates,
    and a TUBE round the centreline (flat to `areaInner`, blending out over
    `areaBlend`; biome over `biomeBand`). Placement is seeded per track id and scored
    by what the biome wants (the coast needs the sea a third of the way round it; snow
    wants height), in an order set by the seed, so adding a track moves none of the
    others. `sink()` lowers terrain vertices on a track's surface so a coarse facet
    never buries the ribbon (it never does at levels 0 to 2; checked).
  - `World.js`: the ground contract `sample(x, z, y)`, one reused object: a track's
    own surface (`Track.sample`, raised by the area's base), the home runway, water
    (height 0), sand, rock, snow, grass. `FLIGHT.surfaces` gained `gravel` and `water`.
  - `WorldOrigin.js`: a 1 km lattice, rebase at 2 km, objects registered at absolute
    positions. A rebase is invisible: `look-world` compares every pixel before and after,
    and fewer differ by more than 3 levels than between two frames with no rebase at all
    (the sun's shadow edges, which land a texel differently, are most of what changes).
  - `Chunks.js`: the quadtree (level 0 = 512 m chunks of 32 cells of 16 m, doubling
    to a 131 km root), `buildTerrain` (non-indexed triangles, one colour per facet, a
    skirt `OPEN_WORLD.skirt` cells deep on every edge), and `ChunkManager`: a node splits
    while the camera is within `splitFactor` times its size, its children replace it
    only when all four are built (no holes), requests are sorted nearest first and
    ahead of the camera first, `prime()` builds a view's worth at once. A chunk costs
    about 0.5 ms (2 ms worst), so there is no worker: Mach 2 needs 37 chunks a second,
    under 2% of a core.
  - `Props.js`: trees, rocks, towers: boxes from the biome data baked to one
    vertex-coloured geometry a kind, placed on a lattice per kind, thinned by chunk level
    and biome weight, none on or within `propClear` of a track.
  - `Streamer.js`: a queue of jobs given `chunkBudgetMs` a frame, highest priority first,
    with a job that has waited 12 pieces going first.
  - `AmbientLap.js` and `AmbientCars.js`: the AI cars on the tracks (below).
- **Edits to car code, all additive and guarded**: `VehiclePhysics.copyState/loadState`
  and `STATE_LENGTH`; `AIDriver.copyState/loadState` (`mulberry32` now exposes its state;
  the sequence is identical); `Materials.facets()` (flat, a colour per vertex);
  `Scene.setFog`; `Sky.setHorizon` (repaints the dome's horizon in place; painting the
  colour it was built with gives back the dome, checked); `FlightCamera.groundFn`;
  `FieldMesh.addRunway` (extracted).
- **`src/render/WorldMesh.js`**: the world as Three.js objects, placed through the
  origin: chunk meshes (arrays dropped after upload), instanced props, one flat faceted
  sea plane that follows the camera, the home runway, each track's `TrackMesh` built a
  piece a frame under its frame's wrapper (scenery hidden beyond `trackPropDistance`,
  the whole mesh dropped beyond 1.4 x `trackBuildDistance`), car meshes (built one a
  frame while still invisible, 4-17 ms each, shown inside `meshRadius`), fog and the
  horizon following the biome under the camera.
- **`FlightGame`** flies the world: `world.sample` for the aircraft, the origin passed to
  `Aircraft.updateVisual`, the camera and shadow in drawn coordinates, `agl` from the
  heightfield, a `View distance` row on the Fly menu and the pause card (8 to 60 km,
  default 30, capped by the garage's graphics level: `OPEN_WORLD.levelCaps`, because
  `GRAPHICS_LEVELS` cannot yet be extended; stored as `flight.renderDistance`), and
  the world primed (coarse first) at every start.

The AI cars on the tracks: three cars lap every area (chassis and livery from the
opponents list by the track's hash). `AmbientCar.record()` drives a warm-up lap and then
one lap through the real `VehiclePhysics` and `AIDriver` (20-45 ms), storing a pose for
every physics step and a full-state keyframe every 120. Far away the pose is put on the
car; within `liveRadius` (700 m) the keyframe at or before now is loaded, the remaining
steps (under 120) are taken, and the car is live physics from then on, handing back past
1.5 times that. All on integer step counts. `check-world` proves, at 216 seeded times over
six tracks, that the hand-over equals an uninterrupted run bit for bit (the car's 66
numbers and its driver's 24), now and ten seconds later, that the replay's pose is the live
car's to 0.03 mm, and that a loop closes within a metre (it only loops where nobody is
looking). The racing line (54 ms, one constructor) is the one piece that cannot be sliced.
No skid marks, particles or headlights on these cars yet.

Decisions made while building, on top of the plan's list:

- The depth spike (scratch only, nothing in the repo): `reversedDepthBuffer` works on
  this machine (EXT_clip_control present, the whole post chain with shadows, bloom and
  GTAOPass ran clean) but it is a renderer constructor flag, so it changes the car game's
  render too (0.45% of pixels in a car-track scene differ by more than 12/255; two
  standard renders differ by exactly 0), and the standard depth buffer already resolves
  the real road-to-ground gap (`TRACK.vergeDrop`, 1.2 m) from 30 m, 300 m and 3,000 m up to
  30 km. It only helps in a synthetic 0.3 m case from 3,000 m. Not adopted: standard depth,
  `FlightCamera`'s altitude-scaled near plane, far = fog end + margin.
- A polygon offset on the terrain, to push it behind roads, was tried and removed: it
  pushes grazing terrain further than the screen-facing skirts, which then showed as dark
  lines along every chunk edge. The sink alone keeps every road above the mesh.
- The interim home runway (3,500 m x 60 m at 22 m, `OPEN_WORLD.home`) is milestone 3's to
  replace. `TestField` and `FieldMesh` stay: the flight harness uses the field.
- The sea is one flat plane at -0.04 m; ocean detail is milestone 9. No wind (the model has
  none yet), no time of day, roads, cities beyond a block grid in the city biome, or
  ground traffic, as FLIGHT_PLAN cut.
- Shadows still follow the aircraft only; `Scene` shadows are not cascaded.
- Collision is terrain only: the aircraft flies through trees, the city biome's towers and
  a track's scenery and bridges (a track's own road and apron are solid, through
  `Track.sample`). Buildings and landmarks come with later milestones; trees never collide.
- Starting a flight pauses for about 0.3 s while the ground is built (`_primeWorld`, coarse
  levels first); the first frame after entering compiles the world's shaders (a quarter of a
  second once per page load).

Numbers (headless Chrome with the real GPU, 1440 x 900; a guide, not the user's fps):
about 400 chunks, 0.6-1.2 million triangles and 700-1,350 draw calls drawn at the default
30 km, 130 calls at 9 km up; CPU time to submit a frame 1-2 ms. `soak-world` at 300 m/s
over the land: median frame 16.7 ms, 99th 16.8, one frame in 2,700 over 25 ms (the first).
Not measured by anyone: the GPU cost on a MacBook Air, and how it feels.

What the user should test: takeoff from the home runway; a climb through the chunk rings;
a Mach 1.5 pass low over land, the coast and the mountains; each of the six track areas from
the air (the road, its scenery, the cars lapping; then dive to a hundred metres beside one
and the cars go live); the View distance row at 8, 30 and 60 km; the horizon, the fog and
its colour over the desert and over snow; the seams between detail rings (a thin dark line
along a chunk edge would be a skirt showing); and that the car
game still plays all six tracks. Look for: popping when a chunk sharpens, a track building
in front of you, a car mesh appearing (one a frame, built early; a hitch there is a
car mesh costing 17 ms), trees or buildings looking wrong for the biome.

Things learned:

- `OPEN_WORLD` is not `WORLD`: `WORLD` is the car terrain block and the graphics levels
  write onto it.
- A 30 Hz replay differs from live physics by 1 cm on a bend: poses are stored every step.
- A skirt shows wherever a coarse chunk's edge stands above a fine one beside it, which is
  the price of no cracks; it is only visible when something else (a polygon offset) lets it
  through.
- `renderer.info.render` after the post chain counts only its last pass; for draw costs set
  `info.autoReset = false` (as `look-world` does).
- Three's `InstancedMesh` needs its `boundingSphere` set by hand to be culled by chunk
  rather than computed from its instances.

Findings from the review of FLIGHT.md (the plan has the full list). Settled in
milestone 2: `Track.sample()` and `TrackMesh._terrainHeight` disagreeing outside the
apron (`TrackGround`), the depth range (above), the replay-to-live hand-over (full-state
keyframes). Still standing: crash-as-free-repair (respawn with the damage you left the apron
with); speech synthesis must use local voices only; the Garage turntable is
inline in `Garage.js` and the Hangar needs it extracted.

Preview note: `preview_start` reported port 5174 while the Vite log said 5173;
the user may have their own server on 5173. Stop the preview when done.

### 10e. The user's first flight of the open world: four gripes, fixed (2026-10-20)

The user flew milestone 2 and reported four things. Nothing is committed. Milestone 3 has
not been started.

1. **Nose-up at speed, and a dead pitch stick.** Two causes, both in `AircraftPhysics`.
   (a) The pitch auto-trim was multiplied by the dynamic-pressure fade along with the stick,
   so its authority fell as 1/q: at Mach 1+ it could no longer hold the tail against the
   wings' 5 degrees of incidence, the airframe settled at a nose-up angle of attack and
   climbed on its own (to the vertical, in a test). Now the stick, damping and rudder are
   faded and the trim is not (`pitchOut`), its integrator keeps the fade so the loop gain
   is unchanged, and it runs at `trimRate` 4 (was 0.7, ten seconds to find its balance).
   (b) Past a 20 degree climb the trim relaxed to zero, which is not balanced at speed, so
   the nose kept coming up: climbs now hold the trim (`trimMaxClimb` 1.2 rad), dives still
   let go (`trimMaxPath`). The stick: pitch keys have their own ramp (`pitchAttack` 4.5,
   was the shared 2.0: a 0.2 s tap now gives 20-28 deg/s, was 8), `qFadeRef` 14000 to 22000
   (a full pull at Mach 1.3 is 8 g instead of 5-6), and `gSoft` 3 to 6 so the g limiter
   eases in early enough not to overshoot 9 g. `npm run flight` has a new section, "Going
   fast", for both. Not changed: the camera's lag (`orientSpring`) if it still feels slow.
2. **Trees on the runway.** The world's prop lattice ran straight across the home field:
   46 trees and bushes stood on the strip and 206 within 150 m of it. `Heightfield.inHomeClear`
   (the strip, `home.clearSide` 160 m each side, `home.clearEnd` 320 m past each end) now
   keeps all scenery off it; a future airport is cleared the same way. `npm run world` audits
   every landmark: over the home field and all six track areas, at the finest level, no
   world prop is on the runway or its verge, in a track's tube or within `propClear` of it,
   or in the sea, and every prop a track brings itself stands on the ground or on the road
   structure (a lamp on a bridge parapet is allowed). Nothing else was found out of place.
3. **Engine sound.** Rebuilt (`FlightAudio.js`). The old voices were all filtered WHITE noise,
   which hisses at any cutoff. Now: brown noise for the core rumble (its sub-bass high-passed
   away, a laptop cannot play it), pink noise for the exhaust, a sawtooth turbine whine per
   engine with the two a hair apart so they beat, a flickering low afterburner growl with a
   raspy band and a thump when it lights, and a cabin low-pass in the cockpit camera. All
   levels are in `FLIGHT_AUDIO`. Measured offline in a real Chrome (spectrum of the render): the
   afterburner's energy above 800 Hz went from 68% to 4%, its spectral flatness from 0.21
   to 0.005. Nobody has HEARD it yet: that is the user's to judge.
4. **Afterburner nozzles.** The F-22's are flat two-dimensional nozzles. `AircraftBuilder` now
   builds a rectangular duct (toothed upper and lower flaps, cheeks, a rectangular glowing
   throat) and the plume is a wide flat ribbon with a core and five shock diamonds, not a
   round cone. `Aircraft.updateVisual` scales them with the burner as before.

Things learned: an auto-trim must not share the stick's q-fade; a test that releases a stick
that was held the whole time starts out of trim, so measure what a power change does after
the trim has settled; the machine can be swapping (it was at 5.5 of 7 GB of swap) which makes
`npm run world` take 17 minutes instead of 13 seconds and is not the code.

### 10f. The second flight of the open world: seven things, fixed (2026-10-20)

The user flew again and reported seven things (and asked, mid-work, for a sonic shock wave).
Nothing is committed. Milestone 3 has not been started.
NOTE: items 3 and 4 below describe the g limiter and push authority as first built (`gSoft`,
`gSoftNeg`, `gLead` fades). That limiter made the stabilators flutter and was REPLACED in 10g by an
integrating cap (`gCutRate`, `gRelease`); `dampPitch` is 0.7 and `pushAuthority` 0.4 now. The
figures in 10g are the current ones.

1. **Water glitching at a distance, shimmering on beaches.** The sea was one plane a few
   centimetres under the waterline, laid over a terrain whose beaches meet the waterline at a
   shallow angle. The depth buffer cannot tell two coplanar surfaces apart, and what it can
   resolve gets coarser with distance and with the camera's near plane (which grows with
   altitude, up to 20 m): the shore tore and flickered from far away and "fixed itself" on the
   way down. Now the SEA IS THE TERRAIN'S OWN FACES (`buildTerrain`, `src/world/Chunks.js`): a
   face wholly under the sea is one flat sea-coloured triangle at the waterline; a face the
   waterline runs through is cut along it into its land part and its sea part, sharing that
   edge to the bit. Nothing is coplanar but the sea with the sea. Chunk skirts hang from the
   surface as drawn (never under the sea); the sea itself has no skirt (a wall there showed as
   a dark line where two meshes' edges missed by a pixel). The old plane stays only past the
   map's edge, `OPEN_WORLD.seaDrop` (0.5 m) under the waterline and pushed back in depth. The
   sea colour lost its emissive term, so `OPEN_WORLD.sea` was brightened (0x2b6a94 to
   0x2b729c) to read the same (within 3 levels of the old pixel). `OPEN_WORLD.seabed` is gone
   (the sea floor is never drawn). `npm run world` audits 40 shore chunks at levels 0-4: the
   surface covers each chunk's footprint exactly once with every face looking up, nothing but
   a skirt is under the sea, no face straddles it, every flat face at the waterline is the
   sea's colour. The seam check now compares the surface as drawn (clamped at the sea).
2. **Tail strike.** On a hard rotation the tail went into the runway at over 4 m/s (`crashSpeed`)
   and it was a crash ("hit the ground") at an 8 degree nose-up, with no push off. Now: (a) the
   flight computer holds the nose short of the tail strike attitude (`tailMargin`, `tailBand`,
   `tailLead`, `tailGuardHeight` in `FLIGHT`): from the height of the centre of mass over the
   ground and the tail point's place in the airframe it works out the attitude at which the tail
   would touch, fades the pull out as the nose, looked at a little ahead along the pitch rate,
   approaches it, and pushes back past it. The thrust-vectoring nozzles follow the same
   command, so they stop pushing the tail down too. (b) The tail hull point is a `skid`
   (`aircraft.js`): reported apart (`skidHit`, `skidImpact`), so it is scraped, not wrecked:
   only `skidCrashSpeed` 9 m/s or `skidCrashDepth` 0.6 m is a crash ("struck its tail on the
   ground"), and a flare 17 degrees nose up scrapes it and is pushed off, level again. A HUD
   note, "Tail strike", says so. The nozzle deflection (up with the stabilators on a pull) was
   read as part of the same complaint; it is physically right and is unchanged. If the user
   meant something about how the nozzles LOOK, ask.
3. **The nose pitching back after a push over.** A held push reached -5 or -6 g in a second, and
   on release the airframe's static stability brought the nose back toward the flight path from
   15 degrees of negative incidence. Now a negative g limit (`gLimitNeg` -3 in `aircraft.js`,
   `gSoftNeg`) fades the push from +1 g down, a push has `pushAuthority` 0.6 of a pull's, and the
   spring-back after a one second push is about 5 degrees where it was 13. The airframe's
   tendency to follow its path is kept (it is stability), only less of it.
4. **Pull harder.** The stabilators' pitch gain went from 0.42 to 0.6 (`aircraft.js`). A full pull
   is now 7 g in 0.4 s from Mach 0.35 to 1.4 (it was 0.5 s and a lower peak), 6-9 g at one
   second where it was 3-5, pitch rates of 40-65 deg/s, peaks 8.4-9.5 g. The g limiter looks
   ahead along the load factor's rate (`gLead`) and `gSoft` is 5.5. A pad stick snapped to full
   in one step may brush 10 g for an instant; the check allows `gLimit` + 1 for that case. Tried
   and removed: a push-back past the limit (it overshot more). The pitch rate check's upper
   bound went from 55 to 70.
5. **Creeping at idle.** Idle thrust (11.6 kN) is more than the tyres' rolling resistance, so
   the aircraft crept off and reached 20 m/s in 100 s with the brake off. Now a parking hold: on
   its wheels, the throttle under `parkThrottle` 0.1 and slower than `parkSpeed` 0.5 m/s, the
   ground velocity is zeroed before the position moves (static friction, in effect). It lets go
   as the throttle comes up (0.25 taxis at 5+ m/s in 10 s). 90 s at idle moves it 0 m.
6. **The shock wave at Mach 1** (asked for mid-work). `SHOCK` block in `tuning.js`;
   `src/render/ShockWave.js`. Going up through `SHOCK.mach` three rings of vapour spread out from
   the nose and slide back along the aircraft, fading; while within `coneBand` of Mach 1 a sleeve
   of vapour wraps the airframe; the field of view jumps `kickFov` and the camera shakes; and
   `FlightAudio._boom` plays a thump, a crack and a rumble (`boomGain`, `boomDelay`, a moment
   after the crossing). It fires once per crossing, re-arms below `rearm`, and not on the ground,
   in a wreck, or when the air start is already supersonic. The rings ride in the aircraft's
   frame because the chase camera is behind it and a ring left in the air would be behind the
   camera at once. No textures: soft edges are alpha in the vertex colours (`ownVapour`).
   `npm run flight` has a "sound barrier" section for the logic. I have not heard the boom.

Things learned: a plane just under a surface cannot be saved with a bias, because the depth
buffer's resolution is a function of distance and the near plane; make the two surfaces one mesh.
A test that held back stick forever (`ground.mjs`) is a good way to find the tail's real limit.
Peaks above the g limit with a stronger stick are a lag between the command and the airframe, and
only a look-ahead on the load factor, not a bigger push-back, cuts them.

### 10g. Third flight: stabilator flutter, and a detail slider (2026-10-20)

The user said the idle creep is fixed and the Mach 1 effects "work well", and reported two
things. Nothing is committed. Milestone 3 has not been started.

1. **The tailplanes flutter in a hard pull or push at speed, in a turn.** Reproduced headless
   (`scratchpad/m2fix/osc3.mjs`: trimmed, rolled to 60 degrees, the pitch key held): the
   stabilator deflection swung 0.2-0.35 rad two or three times a second and the load swung
   between 4 and 12 g, at every speed from Mach 0.6 up. A held half pull was steady. Cause: the
   load limiter I wrote last round was a PROPORTIONAL fade of the stick with the load (the cut
   began 5.5 g under the limit), a feedback loop with a gain of about five and the airframe's
   short period in it, and it sat on the plateau of a held pull (the stick's own authority
   settles a full pull at 8.5 g and, as it was, held 6 g under that limiter). It limit-cycled.
   The fix, in three parts, all in `AircraftPhysics.js` and `FLIGHT`:
   (a) The limits are now an INTEGRATING cap on the stick (`gCutRate`, `gRelease`, `gLead`):
   cut at a rate per g past the limit and given back slowly, with a crossover well under the
   short period, and nothing at all below the limit. A held full pull now simply sits at
   about 8.5 g.
   (b) `dampPitch` 0.4 to 0.7, and the pitch damping fades with `dampFadePow` 0.5 of the stick's
   fade, not 1: the airframe's stiffness grows with q, so the short-period motion was barely
   damped at speed. With this a snapped full stick no longer overshoots its plateau (12 g
   before, 8.5 now) and the load rises to seven g in 0.3-0.5 s.
   (c) `pushAuthority` 0.6 to 0.4: a full push settles at about -2.4 g (the stick's push is as
   strong as its pull, so at 0.5 it sat on the -3 limit and rippled).
   Measured: the stabilator flutter (what is left of the deflection with its drift taken out)
   is 0.001-0.012 rad at every point of the envelope I tried, down from 0.2-0.35; `npm run
   flight` fails on it above 0.04 rad (section "Load limit"). Held load within 0.04 g. The
   pitch-rate check bound is 15 to 70 deg/s. The push checks were loosened to the new design
   (lowest -4.2 g, which is the airframe's overshoot on the first half second, and a nose
   attitude of 7 degrees in 0.6 s). Known and left: at 12 km, Mach 1, in a 60 degree turn a
   held pull runs at the angle-of-attack limit (23 degrees) and wanders slowly at about 0.045
   rad: that is the AoA softening, not a flutter.
   Not understood: the user's sentence "That's why Dubai, you can leave your feet down. Why you
   can leave your everything." (dictation). Asked in the reply.
2. **The detail slider.** "The GPU is not being fully used, so give me a slider for how much
   render quality, not just distance." A second row, "Detail", beside "View distance" on both
   the Fly menu and the pause card, six steps (`OPEN_WORLD.detailSteps`, default `detailDefault`
   = High, which is exactly the world as it was): Low, Medium, High, Higher, Ultra, Maximum.
   Each step is five numbers relative to today's: `lod` (how far out each size of terrain chunk
   is kept, a multiple of `splitFactor`), `cells` (cells a side of every chunk: 32 is 16 m
   ground, 64 is 8 m), `props` (how many trees, rocks, buildings: the lattice they stand on is
   finer, `buildProps(..., densify)`), `shadow` (the sun's shadow width, a multiple of
   `WORLD.shadowRadius`: same map size, so wider is coarser, but the trees and hills round you
   now cast onto the ground) and `scale` (the most the picture may be rendered at, a multiple of
   the resolution the screen asks for: above 1 it is supersampling, and the existing
   frame-rate controller, `Scene._adaptResolution`, now climbs toward it by itself while the
   frame has room and gives back when it has not; the ceiling is `Scene.maxRenderScale`, 1
   everywhere but in flight). Changing `cells` or `props` frees every chunk (they were made at
   the old detail) and builds the ground again round the aircraft (`FlightGame._primeWorld`,
   0.1 to 2 s depending on the step); `lod` alone keeps them. Stored as `flight.detail`.
   Measured (headless Chrome, the 60 m low pass; the user's GPU will differ):
   Low 0.27 M triangles 607 calls, High 0.72 M 905 calls (today's), Higher 1.43 M 1153,
   Ultra 2.77 M 1506, Maximum 5.38 M 1918. The estimated video memory for the terrain is
   about 100 MB at High, 400 MB at Ultra, 900 MB at Maximum (216 bytes a facet pair: it would
   halve if colours and normals were half floats, not done). Streaming at Mach 2 asks for 70
   chunks a second at High and 124 at Maximum (16% of a core, a backlog of 45 chunks: the
   coarse ancestor is drawn meanwhile). `npm run world` has a "Detail" section: the default
   step is the old world, the steps never ask for less, every step covers every ground point
   exactly once with chunks of the cells it asked for, the props are the same lattice at 1 and
   more at more, and a change of ground detail frees what was built. Not changed: the car
   modes (the ceiling and shadow width are put back on leaving flight).
   Things I did not do: MSAA (a render-target property, rebuilt on resize, not a slider), more
   levels of chunks nearer than 16 m (the tree is fixed at construction), track area detail.


### 10h. Milestone 3: the starting point (2026-10-20; built, see 10i)

The user is ready for milestone 3, "Airports and the ground" (FLIGHT.md, milestone list):
tiered airports, runway and taxiway lights, landing gear and wheel brakes, nose wheel steering,
the hangar zone and the Hangar screen (switch, repair, paint and loadout in place for the F-22),
the full map screen and radar, the three start options. The prompt for the new chat is
`FLIGHT_M3_PROMPT.md`. Plan first, wait for approval, build, stop and say what to test.

What the spec asks for (FLIGHT.md, "Airports", "Map and radar", "Menus and flow", "Hangar"):
- One major airport with a runway of at least 3.2 km (the 737's), regional airstrips, a military
  base for the fighter, heliports, and a small airstrip beside EVERY track area, placed from that
  track's position and heading, appearing by itself when a track file is added. All generated
  from data (`src/data/airports.js`) and the seed, the same on every launch.
- Each airport: a runway (or helipad) with a heading and surface, taxiways, an apron, a tower,
  lights, a hangar area. Every airport has a hangar apron. The terrain is flattened and graded
  smoothly round each; `npm run world` checks runway slope, length and clearance.
- Hangar: reached by taxiing into a hangar zone and stopping, or from the Fly menu. The same
  turntable preview as the car garage, hard-edged panels, Save and Discard pinned at the bottom.
  Switch aircraft (only here; only the F-22 exists until milestone 4), repair with per-part health
  bars (damage arrives in milestone 5, so they read full), paint and livery (the 12-colour palette,
  patterns, a tail number, a fictional insignia), loadout and tuning (missile count, cannon rounds,
  flares; power, control response and assist strength), stored apart from cosmetics under their
  own key per aircraft and never reaching the AI. Afterburner fuel is not refilled there.
- Map: a full-screen map from the same world data (coarse terrain colour, ocean, biomes, airports,
  track areas), reading the registries so a new track appears by itself; a teleport-to-airport option
  in free flight; a corner radar with the compass heading. Mission markers, course starts and hostile
  zones come with their own milestones.
- Menus: free flight starts you on the apron of the last airport you used; Settings offer "Start on
  the apron", "Start on the runway" and "Start airborne near the airport". Pause gains map and
  change aircraft (only at a hangar). Reset (R held one second, Back held then A) goes to the hangar.
  Buttons say what happens; no all caps, no arrows after button text.

What already exists to build on (all verified in the tree on 2026-10-20):
- The ground contract is `World.sample(x, z, y) -> { height, normal, surface }`
  (`src/world/World.js`). Surfaces already in `FLIGHT.surfaces`: runway, tarmac, gravel, grass,
  sand, rock, snow, water. A track's own road and apron come from `Track.sample` through
  `world.areas`. An airport's flat zone, its runway surface and its taxiways have to answer here.
- The home runway is the interim airport: `OPEN_WORLD.home` (x, z, heading, length 3,500 m, width
  60 m, height 22 m, start offset, `flatHalfWidth`, `flatMargin`, `blend`, `landRadius`, `landBias`,
  `clearSide`, `clearEnd`). It is done by hand in `Heightfield` (`_homeSetup`, `homeFrame`,
  `_flatten`, `onRunway`, `inHomeClear`), `World.spawn()`, `Props.js` (`inHomeClear` keeps scenery
  off it), `WorldMesh._buildRunway` (reuses `FieldMesh.addRunway`) and the world checks. Milestone 3
  replaces it with a LIST of airports that all go through the same functions. Keep "Start on the
  runway" working through the change. `TestField` and `FieldMesh` stay: the flight harness uses them.
- Aircraft ground handling is in `src/flight/Gear.js` (v0 from milestone 1: a spring and damper per
  wheel, rolling and brake friction per surface, nose wheel steering that fades with speed, a
  `skid` tail point, hull points) and `AircraftPhysics.js` (a parking hold when throttle is under
  `FLIGHT.parkThrottle` and the aircraft is nearly stopped, so TAXIING NEEDS A LITTLE THROTTLE, and
  the tail-strike guard, 10f). Retraction limits, limit speeds, damage and the hangar zone were left
  for milestones 3 and 5 in FLIGHT_PLAN (the plan says M3 for the zone).
- Input already collects `map` (M key, gamepad Back tapped) and `reset` (R held one second): no
  system reads `map` yet, and reset goes to the runway (`FlightGame._place`). See section 7a.
- UI: `src/ui/FlightScreens.js` (menus whose rows are `{ label, value, step }` or `{ label, action }`,
  the controls card), `FlightHud.js`. The Fly menu and pause card are built in
  `FlightGame.showFlyMenu` and `openPause`. Storage keys in use: `flight.units`, `flight.hud`,
  `flight.renderDistance`, `flight.detail`, `flight.seenControls`. The new ones (last airport,
  per-aircraft livery, loadout and tune) go through `Storage` and are normalised on the way in, like
  the car data.
- The hangar's turntable: `Loft` is exported from `src/game/CarBuilder.js`, but the Garage turntable
  is still inline in `src/ui/Garage.js` (the section "the turntable", around line 166), not a class.
  FLIGHT_PLAN (section 3, F) expected a copy or extraction in this milestone. The aircraft mesh is
  `src/render/AircraftBuilder.js` (`buildAircraft(def)` returns `{ root, parts, dispose }`); the 12
  paints are `src/data/palette.js`.
- World streaming: airports are scenery that should build lazily by distance, like the track areas
  (`WorldMesh.views`, `_areaJobs`, `Streamer`), and register with the floating origin
  (`world/WorldOrigin.js`: `origin.add(obj, x, y, z)`; nothing is placed by absolute position
  otherwise). Placement for track-area airstrips can follow `TrackAreas.js`: deterministic from the
  seed and the track id, kept apart, on land, and adding a track must move none of the others.
- Tests to extend: `npm run world` (`scripts/check-world.mjs`: heights, seams, placement, origin,
  hand-over, streaming, the "Detail" section) and `npm run flight` (the ground section already takes
  off from the home runway in the world and the test field).

Things learned that will bite milestone 3 (do not rediscover them):
- Two surfaces at the same height z-fight in the depth buffer, and the error grows with distance and
  with the camera's near plane (up to 20 m at altitude). That is why the sea is the terrain's own
  faces (10f). A runway, taxiway or apron laid on flattened terrain needs `flat(..., { offset })`
  (a polygon offset: `Materials.js`) or its own geometry in the terrain; test it from a few hundred
  metres, 3 km and 10 km up by shooting before and after and comparing crops, not with a still.
- Terrain chunks are drawn at several levels of detail and, since 10g, at 24 to 64 cells a side
  (facets of 8 to 21 m at the finest, 8 to 21 times that far out). A flat zone, a graded edge and a
  runway must not be buried or torn by a coarse chunk: a track area handles it with `trackSink`
  (terrain sunk near the ribbon) and a check that the drawn surface is under the road at levels 0
  to 2; do the same for airports, at every Detail step.
- `Heightfield.height` is called for every chunk vertex (about a million a second while flying fast)
  and by prop placement: an airport's flatten and `inHomeClear` must be a cheap lookup, not a loop
  over every airport, once there are twenty of them. Chunks build in about 0.5 ms each at 32 cells.
- Scenery: the prop lattice runs across everything. Every airport needs its clear zone, and
  `npm run world` audits the landmarks (props on a runway, in a tube, in the sea).
- Wall-clock checks fail on a swapping machine; the world check takes the best of three.
- The user dictates: expect wrong words ("ailerons" for the stabilators, "inner distance" for the
  near plane). When they report a feel problem it is often a feedback loop: trace the time series.

Decisions to put to the user in the plan (FLIGHT.md's open-items habit; suggestions in brackets):
1. How many airports, and where (suggest: one major near the middle of the map, 4 to 6 regional
   strips, one military base, 2 heliports, plus one strip per track area, about 14 in all), and how
   they are placed (deterministic from the seed, scored on flatness and land, kept apart, hints in
   data like a track's `world.placement`).
2. What becomes of the home runway (suggest: it becomes the military base or the major airport, so
   "Start on the runway" and every check that uses it keep working).
3. The data format for an airport (`src/data/airports.js`) and how a track-area airstrip is derived
   from a track's position and heading.
4. How the map is drawn (suggest a 2D canvas in the DOM from `Heightfield` and `Biomes`, built once
   and cached; it is a screen, not a texture in the 3D world).
5. Runway and taxiway lights without a day and night cycle (that is milestone 9): suggest emissive
   geometry, visible by day too, switched by a night flag the world already has a place for.
6. The hangar: which of loadout and tuning knobs are real now (suggest: store all of them, wire only
   the ones the F-22 model already has, such as power and control response, and say which in the UI).
7. Whether reset goes to the hangar of the last airport at once (suggest yes, as FLIGHT.md says).

### 10i. Milestone 3: airports and the ground, built (2026-10-20, waiting on the user's test)

The user asked for milestone 3 on 2026-10-20. The plan (read-first order, ten decisions with
answers) was approved in plan mode, then built in one pass: no commits, no packages. They have
NOT flown it yet; their notes will go in a section 10j. What follows is what exists, what to
test, and what bit. The whole milestone is in the working tree.

**Built**

Airports: data, placement, ground.
- `src/data/airports.js`: the tier recipes (`TIERS`: major 3,500 x 60 m, military 3,000 x 46,
  regional 1,800 x 30, strip 1,200 x 25, heliport 40 m pad: runway, taxiway, apron, back row of
  hangars, tower and terminal, stands, lights, platform margins, relief limit), the named list
  (`AIRPORTS`: Meridian International, which IS the old home runway, hinted at 0, 0, heading 0,
  height 22, with the same lifted plain; Fort Falcon Air Base; Pinecrest, Saltmarsh, Highmesa,
  Redwater, Cold Harbor; Skyline and Ridgeview heliports) and `stripFor(track)`: a strip for
  every track in the registry. 15 airports today (9 named, 6 strips). A new track file adds its
  airstrip with no other change; `npm run world` adds a synthetic seventh track and checks that
  nothing else moves.
- `src/world/Airports.js` (headless): `buildLayout` (the airport's own frame: origin at the
  runway threshold, `u` along, `v` across, left positive; pavement rectangles, structures,
  hangar bays, stands, platform), `Airport`, `Airports` (seeded placement scored on relief, land
  and approach clearance, 8 headings, kept `spacing` apart and clear of track areas; `addStrips`
  once the areas are placed; `flatten`, `surfaceAt`, `kindAt`, `zoneAt`, `inClear`, `nearest`,
  `start(ap, mode)` for 'apron', 'runway', 'air' and 'hangar').
- Order in `World`: heightfield, airports (seed only), track areas (which now keep clear of
  airports), strips (derived from the placed areas), then `hf.airports`. `height = airports.flatten(
  areas.blend(base))`. A platform is an exactly flat rectangle at the airport's base height with a
  smoothstep blend out (the same Chebyshev-distance maths as the old home `_flatten`, so the major's
  ground did not change a metre). `OPEN_WORLD.home` is gone; its numbers are the major's recipe.
  `OPEN_WORLD.airports` in tuning.js holds the knobs (seedSalt 138 was chosen by scanning so the
  six existing track areas did not move; changing it, or the spacing, moves them).
- `World.spawn(airport = major)`, `World.sample` (runway, tarmac) through `airports.surfaceAt`,
  `Props.js` keeps scenery off every platform (`airports.inClear`).

Drawing.
- `src/render/AirportMesh.js`: four meshes and lamp points per airport, built a piece at a time
  as a Streamer job (priority 80, within `buildDistance` 24 km): pavement at polygon offset 4,
  markings at 6 (edges, dashed centre line, threshold bars, seven-segment runway numbers, hold
  lines, stand lines, bays with chevrons, helipad ring and H, blast pads), structures (flat
  shaded: hangars, tower, terminal, windsock, floodlights), lamps (white edge, green threshold,
  red end, blue taxiway edge, centre lights, PAPI, beacon; `Materials.js` `lamps()` and
  `lampPoints()`, so a far light is still a fixed-size dot). `facets()` gained an `offset`.
- "Time of day" (Day or Night preview) on the Fly menu and the pause card: `OPEN_WORLD.night`,
  `WorldMesh.setNight`, `worldEnvironment(cfg, rd, night)`. It only exists to judge the lamps;
  milestone 9's real cycle replaces it. Stored as `flight.night`.

Ground handling (FLIGHT block in tuning.js, each with a comment and a range, one master switch
`groundAssist`). Measured with the harness before and after (the traces were scratch, the
numbers are here):
- Taxi governor: on the wheels, lever under `taxiLeverMax` 0.3 and under 22 m/s, the lever
  asks for a speed (`taxiSpeedPerLever` 40 m/s per unit) and the brakes hold it. Lever 0.10 held 4.7 m/s
  (before: 20 m/s after 20 s and still climbing), 0.20 held 9.1 m/s. Lever 0 from 10 m/s
  stops in 32 m (before: it did not stop at all, 1,001 m rolled). Off above the band,
  so the takeoff roll is as it was (the takeoff checks still pass).
- Nose wheel: fed from the ramped pedal, rate limited (`noseSteerRate` 1.3 rad/s) and capped by
  lateral g (`noseSteerLatG` 0.4 g). Full pedal at 5 m/s: radius 11 m (was 21 m, with 5 degrees of
  bank); at 8 m/s: 2.6 degrees of bank, at 12 m/s: 2.8 (was 22), at 25 m/s: 4.5 (was 25.6).
  At 40 m/s it still banks 23 degrees: that is aero (the rudder), unchanged.
- Brake: the key ramps (`FLIGHT_INPUT.brakeAttack` 2.5 per second, `brakeRelease` 8); a stopped
  aircraft with the brake held (or the lever low) stays put (parking hold on brake, up to lever
  0.85): before it crept 5 to 186 m against levers 0.2 to 0.7. Stop distances at speed unchanged
  (14 m from 10 m/s, 122 m from 30, 522 m from 60).
- Gear: the lever cannot raise it while the wheels carry the aircraft (it used to drop the jet
  on its belly), a note says why; a gear warning (HUD text and a tone) on short final with the
  gear up (`gearWarnAgl` 220 m, `gearWarnCas` 110 m/s).

Flow.
- `src/core/FlightPlaces.js`: the airport last used (`flight.lastAirport`; set by a start, a
  teleport, or sitting stopped on an airport for `HANGAR.landedAfter` 3 s, which is what a landing
  is), the teleport mode (`flight.teleportMode`), which starts an airport can take
  (`aircraft.ground.minRunway` 1,000 m, `vtol` false: a heliport is airborne only for the F-22),
  and the bay watcher (stopped in a bay for `HANGAR.dwell` 1.5 s fires it once; it re-arms only
  when the aircraft leaves; a reset puts you at the mouth, outside the bay, so it does not slam
  the Hangar over you).
- Fly menu: Start on the apron (the default, at the last airport), Start on the runway (greyed
  with the reason at a heliport), Start airborne near the airport, an Airport stepper, Open the
  hangar, Open the map, Controls, Units, View distance, Detail, Time of day, Volume, Back to the
  title. Pause: Resume, a Restart row that names the mode, Open the hangar (only while in a bay),
  Open the map, the settings. R held (or Back held then A) and a crash put you at the hangar:
  stopped at the mouth of a bay, engines idling. "Start on the runway" works as it did.
- HUD: the ground row (brake, nose wheel angle, Parked), where you are ("Redwater Airport,
  apron"), the bay's dwell bar, the gear warning, and the radar.

Map and radar.
- `src/world/MapData.js` (headless): a 320 x 320 raster of the whole world from `Heightfield` and
  `Biomes` (biome colours, hillshade, sea depth), built in slices, and the markers read from the
  registries (airports from the world, tracks from the areas). `src/ui/MapScreen.js`: M, the Fly
  menu or the pause card; wheel zoom, drag pan, click to pick, a list by distance, the three start
  buttons, Teleport; pad: d-pad, A, B. `src/ui/Radar.js`: a heading-up disc in the top-left corner
  with the compass, range rings, blips, and the nearest airport. It takes a contact list, so the
  aircraft and targets of milestones 6 and 7 plug in.

The Hangar (step 6, the last thing built).
- `src/ui/Hangar.js` and `src/ui/Turntable.js` (the Garage's classes and look; the turntable is a
  copy that scales its fog, floor, disc and camera to the aircraft, because the Garage's 16 to 46 m
  fog would swallow a fighter; `Garage.js` was not touched). Rows: Aircraft (one so far), Repair
  (a health bar per part: wings, tail, engines, gear, fuselage; they read Sound until damage
  arrives in milestone 5; Enter on a part, or Repair everything), Paint (body and accent swatches),
  Livery (pattern, tail number, insignia), Loadout (medium range and short range missiles, cannon
  rounds, flares), Tuning (engine power, control response, flight assist, and "back to stock"),
  Save and Discard pinned. The card shows mass, thrust, thrust to weight, wing loading and load
  limit for what is set, the moved ones in orange.
- `src/data/loadouts.js` (the options and the normalisers), `src/core/HangarStore.js` (four
  records per aircraft under four keys, `flight.livery.f22`, `flight.loadout.f22`, `flight.tune.f22`,
  `flight.damage.f22`; every record is normalised on the way in, so a corrupt one costs only
  itself). Ranges for the tune knobs are in tuning.js, `HANGAR.tune` (power 0.8 to 1.2, response
  0.7 to 1.3, assist 0.2 to 1.5; 1 is the aircraft as fitted).
- What reaches the physics: `AircraftPhysics.setup({ payload, tune })`: the payload mass (the
  default loadout weighs exactly `def.payload`, so every fitted figure is unchanged; the missile and
  round masses are in loadouts.js with their sources), engine power (`Engine.power`, scales thrust
  and fuel flow), control response (scales the stick and the damping together, before the aids and
  the load limits) and flight assist (scales the auto trim and the roll self levelling; NOTE
  `FLIGHT.levelStrength` is 0 as shipped, so for now it is the auto trim only). Livery is paint:
  `buildAircraft(def, livery)` colours the body, lays accent decals (tips, bands, spine, or the
  whole left side) on the fixed surfaces only, builds the tail number from bars on both fins (it
  reads the right way round from outside each side) and an invented insignia on the wings; the
  default is exactly the old grey. `Aircraft.setLivery` rebuilds the body inside the same root.
- Nothing reaches an AI aircraft (there is none yet). Fuel and the afterburner tank are not touched.

**Final run (2026-10-20, after the last edit)**
- All nine car checks pass (`check`, `lap`, `parts`, `ai`, `fx`, `specs`, `drag`, `timing`, `race`).
- `npm run flight`: 146 ok, 0 fail. `npm run world`: 108 ok and the four known failures (below).
- `npx vite build` is clean (the main chunk's 800 kB advisory is old: 902 kB on the pristine tree,
  904 kB now; the flight code stays in its own lazy chunk, 108 kB before, 178 kB now).
- `npm run look` and `npm run look-world` (airports, ground starts, the bay, night, radar, Hangar):
  every PNG was read and the page console was clean (no errors, no warnings).
- Z-fighting, the approach to a runway rendered twice with the camera a metre apart, the fraction of
  sampled pavement pixels that changed a lot (the ground beside it, as the control, was 0% every time):
  Meridian 2.27% from low (700 m back, 35 m up), 0.58% from 3 km, 0% from 10 km; Pinecrest 0.75%,
  0.07%, 0%. The low figure is pixels on the edges of narrow pavement moving by a metre, not
  flicker inside a surface; `look-world` fails if the pavement is 3 points worse than the ground.

**Tests added**
- `npm run world`: airports (every runway at least its tier's length, the major at least 3,200 m;
  slope under 1% and level to 1 cm; clearance; on land; apart; placement hints honoured; two worlds
  identical; the six track areas exactly where they were; every track has its strip; a seventh
  track moves nothing; the layout hash), the ground (no tearing or burial at every Detail step,
  asserted at levels 0 to 2 and from Medium at 3, reported at 4), scenery off every platform,
  `sample()` agreeing with the layout, the airport meshes (a mesh built headless and placed by its
  group's matrix lies on pavement), start poses, the map raster and markers.
- `npm run flight`: Ground handling (14 checks: the governor, the nose wheel, the brake, the hold,
  the gear lock, the takeoff roll), Airports in the world (a takeoff in afterburner from four
  airports at other headings, a landing at three regionals from a 3 degree approach, a taxi from the
  stand to the runway on pavement the whole way, a stop in a bay), Places (the starts, the bay's
  dwell, the landing sets the last airport), The Hangar (defaults change nothing to the bit,
  normalisation, four keys, the tune moves the right things the right way, 100 liveries build and
  keep every moving part, paint never reaches the physics).
- `scripts/look.mjs` and `scripts/look-world.mjs` gained shots (apron, map, Hangar, one of each
  tier, the ground starts, the bay, the night, the radar) and a z-fight measurement (below).
  `scripts/lib/browser.mjs` reads `CHROME_ARGS` (a container wants `--no-sandbox`).

**Waiting on the user's test** (ask, do not assume)
- Whether taxiing feels right: lever 0.1 a walk, 0.25 a jog, stopping, parking, turning on the
  apron at 3 to 8 m/s, the key brake coming on gradually. It was tuned from numbers; I cannot feel the sticks.
- The look and the sense of scale of the airports from the air and from the apron; the lights at
  night (Time of day); the Hangar (paint, tail number, insignia, the bars, the card), the bay
  opening it, Esc coming back; the map and the radar; the three starts at a regional, a strip, a
  heliport (airborne only) and the military base.

**What bit (do not rediscover)**
- Idle thrust (11.5 kN) beats rolling resistance (5 kN), and the tyre model has no static friction,
  so a brake could not hold the aircraft against thrust above about lever 0.3. The fix is the
  governor (holds a speed) and the parking hold (now also on brake); do not try to fix it in `Gear.js`'s friction.
- The airport's reach for the heightfield must use the circumradius with the Chebyshev corners
  (`hypot(hu + blend, hv + blend)`), or the blend is cut at the corners.
- Placement is seeded and the track areas keep clear of airports, so editing the airport list, the
  spacing or `seedSalt` can move track areas. The world check records the six positions
  (`AREA_GOLDEN`) and the layout hash (`AIRPORT_GOLDEN`); a change that moves them must be deliberate
  and re-recorded.
- A stand whose `u` equals the exit's `u` gave duplicate route points and a NaN in the taxi pilot:
  `roundedRoute` skips duplicates and collinear points; stand 0 is across from the exit or the stub.
- The Garage's turntable cannot be reused as is for an aircraft (fog, size); the floor must run out
  past where the fog has swallowed it or its edge shows as a faint arc.
- Headless Chrome (software GL) draws a frame in seconds, so the bay's 1.5 s dwell cannot be waited
  for in a real page; the look and test scripts drive `places.update` by hand.

**Known gaps and things to tell the user**
- The major airport (the old home runway) sits in a cut in a ridge with its approaches blocked from
  about 5 km out; it was kept exactly as it was, as asked, so the landing test uses the regionals.
  Options for milestone 4 (the airliner needs it): move or hint it, or cut the approach.
- A 1,200 m airstrip is long enough to take off from but short for an F-22 landing from a normal
  approach; the landing test uses the regionals (1,500 to 1,900 m).
- Buildings are not solid (collision with damage is milestone 5), like trees and the city biome.
- No weathercocking (no wind until milestone 9). Damage is stored but not applied (milestone 5).
  Missiles, rounds and flares are weight only until milestone 7.
- The Chebyshev blend deviates slightly from a Euclidean one at the corners (by design, to keep the
  major's ground identical).
- Burial is asserted at levels 0 to 2 (and 3 from Medium) and only reported at 3 and 4 at the
  finest Detail steps (the same as track areas).
- `npm run world` ends with four failures in this container, and the same four fail on the
  pristine tree (checked in a clean worktree of HEAD): the mesh hashes of copper-flats,
  glacier-pass and pine-ridge, and "a chunk takes 2.56 ms against a 2 ms budget" (a wall-clock
  check, best of three). They are not this milestone's; every check this milestone added passes.
- `Turntable.js` duplicates the Garage's scene (debt noted, as the plan said).
