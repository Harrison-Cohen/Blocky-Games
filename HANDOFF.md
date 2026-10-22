# Handoff: blocky racing sim

Read `AGENTS.md` (the agent entry point: who the user is, how they want to be worked with, the hand-off
protocol between Claude Code and Codex), then this file, then `Claude.md` (the project rules), then
`PROMPT.md` (the full spec) before touching anything. This file is the state of the project and
everything the previous agent knew that is not written down elsewhere.

**Flight work** (the second game mode, an F-22 and a world to fly it in): read
`FLIGHT.md` (the user's spec), then `FLIGHT_PLAN.md` (the plan and review the
user approved, with the answers to the spec's open items), then sections 9 and
10 below. Section 10 starts with a "start here" box.

---

## 1. Where things stand

- Committed and pushed, 2026-10-22, at the user's word ("commit to origin and then merge with flight
  test"): all the M5 and A/A2/B/C work is now two commits on Codex_test (`758f1cd` code, `1e05684` docs,
  pushed to origin/Codex_test), and local `Flight_test` was fast-forwarded to the same commit (it had no
  commits of its own after `9a71305`). Flight_test was NOT pushed to origin (the draft PR still shows the
  old tip) until the user says so. Statements below that say "no commits/pushes" describe the time they
  were written. Claude Code resumed the work after Codex ran out of usage; Part C is still waiting on the
  user's test (10y test order), nothing new was built. Re-ran flight (451 ok, the same nine documented
  identity failures) and the build (clean, old size advisory).

- Part C implemented on Codex_test, 2026-10-22: terrain map/HUD/cockpit navigation, versioned
  multi-stop planner, Off/Hold/Route AP, reference-led F-22 exterior and revised procedural
  sound. Read HANDOFF 10y for files, checks, intentional hash differences and test order.
  Stop for user test after C. All previous local work retained, no commits/pushes. Audio
  signal checks are not a listening test; user audition is still required.

- Latest pre-C addition, Codex_test, 2026-10-22: saved Field of view slider added to Fly and
  pause menus, 55 to 110 degrees, default 78, controls all flight views and cockpit overlay.
  Read 10x. 18 browser checks and build pass, eight pictures inspected. Transfer prompt
  updated to preserve the setting; C remains unstarted. No commit/push.

- New-chat transfer prepared, Codex_test, 2026-10-22: user asked whether Part C is preserved
  and requested a prompt for a new chat. It is saved in FLIGHT_PART_C_PROMPT.md; read 10w.
  Full C design/additions remain in FLIGHT_COCKPIT_NAV_PLAN.md and 10v. No C code started,
  no B acceptance inferred, no commit/push. Continue from this existing dirty local checkout.

- Newest, Codex_test, 2026-10-22: user tested B and sent two cockpit screenshots. B follow-up
  fixes HUD/frame fit, 737 panel containment and downward look; quicker throttle/spool for
  both aircraft and 80% less pilot-view shake/Mach kick. Read 10v for verification and retest.
  F-22 body remodel and more realistic aircraft sound are added to C, still unstarted with
  the minimap/waypoints/Route AP. Normal physics identity now intentionally changes because
  the user asked for quicker acceleration; goldens are retained, never silently replaced.

- Newest, Codex_test, 2026-10-22: user requested the next step after A2. Approved cockpit/navigation revision batch B is built and verified, waiting on the user's test. Working aircraft-themed panels and matching external HUD share one telemetry snapshot. Read 10u. Stop after B for user test before C (terrain minimap, multiple waypoints, Route AP). Existing M5/A/A2 working tree remains uncommitted.

- Newest, Codex_test, 2026-10-21: user approved A2 with "exicute the plan", then "continue". A2 is built and verified, waiting on their test. Read 10t and FLIGHT_COCKPIT_NAV_PLAN.md. Stop for their test before B/C. Local uncommitted working tree preserves M5 and accepted A.

- Latest, Codex_test, 2026-10-21: user approved FLIGHT_COCKPIT_NAV_PLAN.md with "continue with the plan". Batch A is built: toggle speed brakes, revised separate 737 nose/upper flight deck, shared window openings and improved seated visibility. See 10r for files, verification and test order. Stop for their test before B (instruments) and C (minimap/waypoints/Route AP). Changes remain local and uncommitted, preserving M5.

- Latest revision request, Codex_test, 2026-10-21: user wants toggle speed brakes, a corrected two-piece 737 nose/flight deck with better pilot visibility, working aircraft-themed cockpit instruments and matching external HUD, a terrain minimap, and multi-waypoint trip planning. They chose authentic instruments with retro styling, multiple waypoints, and AP button cycling visual/manual guidance versus route following. Planning only: read FLIGHT_COCKPIT_NAV_PLAN.md and 10q, wait for approval before code. Existing M5 changes remain local and uncommitted.

- Latest, Codex_test, 2026-10-21: user requested "continue with part B". Milestone 5 (5a and 5b) is built and awaiting their test, F-22 and 737 only. See 10p for collisions, effects/sound, respawn, checks and test order. Stop here, no milestone 6 or helicopter work. Flight checks have only six recorded physics-hash failures reproduced on pristine 8559a6a; final/pristine results match exactly. No commits or pushes.

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
  test** (section 10i: what was built, what to test, what bit). It was committed as
  `4f4b427` and pushed to `Flight_test` on 2026-10-21, at the user's request (they
  found the files were not on their computer: a cloud session's files live only in its
  container until they are pushed), and a draft pull request holds it:
  `Harrison-Cohen/Blocky-Games#1`, `Flight_test` into `initial-build`. The planning docs
  (`FLIGHT.md`, `FLIGHT_PLAN.md`, `FLIGHT_M3_PROMPT.md`) were committed earlier, in
  `c573a52`. **The next milestone is 4, the 737 and the helicopter, and it has not been
  started**: section 10j is its starting point and `FLIGHT_M4_PROMPT.md` is the prompt the
  user pastes into the new chat. Do not start it until they say so (they may fly milestone
  3 first and send notes; those go in the next free section after 10j). Commit again only
  when asked, as the user, with no Claude co-author trailer (section 3). Section 10 is the
  whole story.
- **Flight milestone 4, first stop (4a), 2026-10-21: the Boeing 737-800, flaps, spoilers, the
  autopilot, switching aircraft and the major's approach, built and verified; committed and
  pushed to `Flight_test` on 2026-10-21 at the user's request ("commit the change now"), the
  commit after `f00427b`; waiting on the user's test** (section 10k: what was built, what to test, what bit, the known
  gaps). The user approved a two stop plan (4a, then 4b the Magpie 48 helicopter with hover assist
  and the sling hook); 4b has NOT been started and must not be until they say so. Everything is
  committed on branch `Flight_test` (on top of `f00427b`) and pushed, so it is in the draft PR
  `Harrison-Cohen/Blocky-Games#1`. Anything done after that commit exists only in the cloud
  container until it is committed and pushed again: tell the user and offer it.
- **Flight milestone 4a, the user's notes after flying the 737 (2026-10-21), built, verified, and
  committed and pushed to `Flight_test` on 2026-10-21 when the user asked in words (they were running out of
  Claude usage and asked for the agent hand-off files to be written and committed) as two commits on top of
  `c6d2373`: the code, then the hand-off documents** (section 10l): wider runways and taxiways at every airport, spoilers that slow the
  aircraft instead of stalling it, a firmer landing threshold, a gear that folds instead of passing
  through the body, a crash menu (respawn at the hangar or the nearest runway), a first person view
  without the black lines plus a new Cockpit view with a modelled inside (737 flight deck and F-22
  cockpit), a 737 nose and flight deck glass remodelled from photographs, and the F-22's side
  intakes remodelled from photographs (its three mesh goldens were re-recorded on purpose; the
  physics goldens did not move). 4b (the Magpie 48) is still NOT started. The user's agents now include
  Codex as well as Claude Code: `AGENTS.md` is Codex's entry point and holds what is known about the user, and
  `FLIGHT_M4_PLAN.md` keeps the approved plan (the 4b design) in the repo. Anything done after the pushed
  commits exists only in the container or working tree until it is committed and pushed again: tell the user.

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

`AGENTS.md` section 2 is the fuller, current list of the user's preferences (no em or en dashes, find the
simplest solution and check online sources, they/them, academic calendar, and the rules below); read it.
The same three below are also in the auto-memory at
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
- In a CLOUD session the container's git config is Claude's (`Claude
  <noreply@anthropic.com>`), so commit as the user explicitly:
  `git -c user.name="Harrison Cohen" -c user.email="114955979+Harrison-Cohen@users.noreply.github.com" commit`
  (the same identity as their own commits), with no Claude co-author trailer. A pull
  request description may carry the Claude Code footer; a commit may not.
- Files made in a cloud session exist ONLY in its container until they are committed and
  pushed; the container is reclaimed afterwards. A stop hook asks for a commit at the end
  of a turn: the user's "commit only when asked" wins, so at the end of a milestone say
  plainly that nothing has reached their computer and offer to commit and push (this
  went wrong once: 2026-10-21, "these files are not on my local computer").
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
| Either Shift | afterburner, held |
| G | landing gear |
| V | toggle airbrake (the 737's spoilers; automatic ground spoilers still work) |
| B | wheel brake, held (it comes on a little at a time, `FLIGHT_INPUT.brakeAttack`) |
| C | camera: chase, first person, cockpit, far orbit (the pad's Y too) |
| Right mouse, held | free look; drag down to see lower panels (middle button in mouse flight) |
| U | external HUD on / off; physical cockpit instruments keep working |
| N | mute |
| T | mouse flight on / off (pointer lock; Esc gives it back and pauses) |
| R, held 1 s | back to the hangar (a stopped aircraft at the mouth of a bay of the airport last used) |
| Enter | enter a nearby Hangar when its button is visible; no automatic entry |
| Esc | pause |
| Space, F, Q, E | cannon, missile, flares, next target (later) |
| ` (backquote) | telemetry (collected, nothing reads it yet) |
| Z / X | flaps up / down, one setting at a time (the 737: up, 5, 15, 30; the F-22: Auto, Combat). Out is refused above the setting's limit speed, with a note |
| P | Off, Hold, Route, Off; without an activated usable trip: Off, Hold, Off with reason. Airborne and at least 60 m AGL. Hold captures targets. Up/Down altitude, W/S speed; Left/Right heading in Hold only. Route holds pilot altitude/speed and steers lateral legs. |
| H | hover assist (later, milestone 4b) |
| K | cargo hook (later, milestone 4b) |
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
| A / B | A enters a nearby Hangar when prompted, otherwise hold for afterburner; B toggles airbrake (Back+B still mutes). Release menu/entry A before afterburner can engage |
| X / Y | gear / camera |
| RB / LB | missile / flares (later) |
| D-pad up | next target (later) |
| D-pad down | Off/Hold/Route/Off; left stick Y altitude, X heading in Hold only, right stick Y speed |
| D-pad left / right | flaps up / down |
| L3 | HUD |
| Back, tapped | the map |
| Back, held, then A | back to the hangar (held 1 s) |
| Back, held, then B / X | mute / hover assist (hover later) |
| Start | pause |

A pad with no standard mapping (a flight stick) falls back to axis 0 roll, 1
pitch, 2 twist rudder, 3 throttle slider; untested, there is no hardware.

Flight menus use the same menu controls as the rest (the line above).
Hangar physical visits offer Leave hangar (stationary, nose out) and Teleport to runway.
Pending paint/load/tune or aircraft selection asks Save/Discard/Keep editing first.
Enter/Space repairs the selected part immediately, even if other edits are later discarded.
Esc/B requests normal departure or cancels the pending Save/Discard choice. Fly-menu preview
retains Save aircraft/Discard and returns to that menu without a physical departure.
Trip planner controls: read 10y, mouse buttons and map picking; Tab/Up/Down/Enter, map cursor arrows and Enter; pad Up above first airport then A, menu directions/A, cursor D-pad/A, B returns/closes.
Map: Up/Down or W/S airport, Left/Right or A/D start (apron/runway/air/Hangar), Enter/Space
teleport, Esc/M close, +/- and wheel zoom, drag pan. Pad follows menu navigation.

Milestone 5 respawn: Up/Down or W/S selects an airport; Enter/Space or pad A/Start
respawns at its hangar apron. Ineligible airports show why and cannot be confirmed.
Esc/M or pad B opens return-to-list/title choices. The explicit Back to title button
leaves flight. While wrecked, R, M and Esc lead to this choice rather than bypassing it.


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
- (2026-10-21) The major airport (the old home runway) sits in a cut in a ridge and its
  approaches are blocked from about 5 km out; it was kept exactly as it was in milestone 3, so
  the landing test uses the regionals. The 737 needs a clean approach: to be put to the user
  in the milestone 4 plan (hint it elsewhere, or cut the approach), see 10j.
- (2026-10-21) The Hangar's "flight assist" scales only the auto trim for now, because
  `FLIGHT.levelStrength` is 0 as shipped (no roll self levelling). Fine unless they want
  self levelling back.
- (2026-10-21) Milestone 3 has not been flown by the user yet. Ask for their notes, do not
  assume it feels right (taxi feel in particular was tuned from numbers).

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

- Newest: Part C implemented, read 10y before any further flight work. User testing is next.
  Navigation/planner/Route AP, F-22 exterior and audio are built. Do not restart C from the
  old transfer prompt. No combat/helicopter work or formal acceptance inferred.

- Transfer prompt: read 10w and FLIGHT_PART_C_PROMPT.md when moving to a new local chat.
- Latest camera addition: read 10x for the saved FOV slider, verification and test order.
- Newest implementation: read 10v for the user's B test feedback and fixes: HUD glass/frame fit, 737 panel containment, downward look, quicker power response and reduced pilot-view shake. Retest before C. User added F-22 body and realistic aircraft sound to C alongside navigation. No commit/push, no helicopter or milestone 6 work. Normal physics identity intentionally changes under the newly authorized acceleration tuning; legacy-response diagnostic isolates it.

- Newest: read 10t. A2 is approved, built and verified, waiting on their test. Stop after A2 for the user test before B/C. Same working tree, no commits/pushes.

- Latest: read 10r. Cockpit/navigation plan is approved; batch A built and ready for user test. B/C are unstarted, do not roll into them. Read the checklist in FLIGHT_COCKPIT_NAV_PLAN.md. Standard flight checks still have only six preexisting physics hash mismatches; same-runtime identity unchanged. No commits or pushes.

- Newest: read 10q and FLIGHT_COCKPIT_NAV_PLAN.md. Cockpit/navigation revision is planned and awaiting approval. No implementation for that request yet. Prior M5 implementation/checks in 10p are preserved.

- Latest, Codex_test: read `FLIGHT_M5_PLAN.md` and 10p. Both halves of milestone 5 are built; the user approved 5b with "continue with part B". Ready for their test, stop here. Car/world checks and screenshots pass; flight checks have six preexisting recorded physics-hash mismatches, with exact pristine/final matches in the same runtime. No goldens changed. Helicopter and milestone 6 remain unstarted. 4a has no separate acceptance report yet. 10m through 10o are historical.

- UPDATE 2026-10-21 (later): the user flew the 737 and sent ten notes; all are built and verified in
  10l (committed and pushed). Read 10l after 10k. 4b still has not been started. A second agent, Codex,
  may pick the work up: read `AGENTS.md` first.
  A branch `Codex_test` was cut from `Flight_test` at `9a71305` for Codex (AGENTS.md section 3a: each agent
  commits only to its own branch; the user merges). The agent hand-off files after that commit (the
  `FLIGHT_M5_PROMPT.md` below, the helicopter deferral) live on `Codex_test`, not on `Flight_test`.
  `FLIGHT_M5_PROMPT.md` (milestone 5, damage, crashes and respawn) was written for the user to paste into Codex
  or Claude; it is not started. THE USER TOOK THE HELICOPTER OUT OF THE PLAN FOR NOW (2026-10-21): milestone 5
  covers the F-22 and the 737 only, 4b stays unstarted, and its design stays in `FLIGHT_M4_PLAN.md`.
- UPDATE 2026-10-21: FLIGHT MILESTONE 4 IS HALF BUILT. 4a (the Boeing 737-800, flaps, spoilers, the
  autopilot, switching aircraft in the Hangar, the major's approach corridor) is built and
  verified and WAITING ON THE USER'S TEST: read 10k. It is committed and pushed (the commit after `f00427b`).
  4b (the Magpie 48 helicopter: rotor and power model, hover assist, skids, the sling hook, its
  mesh, sound and Hangar options, its checks) has NOT been started: wait for the user's notes
  and for them to say "start 4b", then plan it with them (10k lists what 4b still owes). The
  paragraphs below were written when milestone 4 was not started; where they differ from 10k,
  10k wins.
- State: flight milestones 1 (the F-22 on a test field), 2 (the open world) and 3
  (airports and the ground) are built. Milestones 1 and 2 are accepted. MILESTONE 3 IS
  BUILT, COMMITTED (`4f4b427`) AND PUSHED, AND WAITING ON THE USER'S TEST (2026-10-21): read
  10i (what was built, what to test, what bit, the known gaps) and wait for their notes,
  which go in the next free section after 10j. THE NEXT MILESTONE IS 4 (the 737 and the
  helicopter, FLIGHT.md's milestone list). It has NOT been started: 10j is its starting point
  and `FLIGHT_M4_PROMPT.md` is the prompt the user pastes into the new chat. Plan it in plan
  mode first, and do not build anything until they approve the plan. Branch `Flight_test`,
  draft PR #1 into `initial-build`. Commit again only when asked (section 3 has the identity
  to use).
- Read, in order: this section, 10a to 10j (10e to 10g are the latest fixes and 10g
  supersedes the g limiter described in 10f; 10h was milestone 3's starting point, 10i is what
  was built, 10j is milestone 4's starting point), `FLIGHT.md` (the Airports, Hangar, Map and radar and Menus and flow sections
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
  `scripts/check-world.mjs`, `scripts/lib/{flight-harness,browser,track-hash}.mjs`. Milestone 4a added
  `src/flight/Autopilot.js`, `src/render/aircraft/b737.js`, `scripts/flight/{identity,b737,autopilot,
  switching,flaps}.mjs` (loaded by `check-flight.mjs` before its verdict), `scripts/lib/{airliner-harness,
  fit-b737}.mjs`; the tuning blocks `FLIGHT_OVERRIDES`, `AUTOPILOT` and `FLIGHT_AUDIO_PROFILES`.
- Storage keys of flight: `flight.units`, `flight.hud`, `flight.renderDistance`, `flight.detail`,
  `flight.seenControls`, `flight.invertY`, `flight.night`, `flight.lastAirport`,
  `flight.teleportMode`, `flight.aircraft` (the one last flown), and per aircraft `flight.livery.<id>`, `flight.loadout.<id>`,
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
answers) was approved in plan mode, then built in one pass, with no packages. It was committed as
`4f4b427` on 2026-10-21 and pushed to `Flight_test` (draft PR `Harrison-Cohen/Blocky-Games#1`).
They have NOT flown it yet; their notes will go in the next free section after 10j (10j is the
starting point of milestone 4). What follows is what exists, what to test, and what bit.

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

### 10j. Milestone 4: the starting point (2026-10-21, not started)

The next flight milestone is 4, "The 737 and the helicopter" (FLIGHT.md, milestone list): their
bodies, flight models, flaps, airbrakes, autopilot, hover assist, sling hook, tuned to their
figures, switching aircraft in the hangar, a refit script. The prompt for the new chat is
`FLIGHT_M4_PROMPT.md`. Plan first, wait for approval, build, stop and say what to test. The user
may fly milestone 3 first (10i) and send notes; fix those before building, and write them in the
next free section after this one.

What the spec asks (FLIGHT.md, "The three aircraft", "The flight model", "Systems", "Hangar",
"Controls", "Checks"; FLIGHT_PLAN.md section 2 and section 5 item 5):
- **Boeing 737-800.** Length 39.47 m, span 35.79 m with winglets, wing area 124.6 m2, empty
  41,413 kg, maximum takeoff 79,016 kg, fuel 26,020 litres, two CFM56-7B26 at about 117 kN each,
  cruise Mach 0.785, maximum Mach 0.82, ceiling 41,000 ft, takeoff field length 2,316 m, landing
  field length 1,600 m, 162 seats. The approach speed is NOT in the spec's sources (about 130 to
  145 knots at landing weight): find a real figure online and say so if you cannot. Heavy, stable,
  slow to respond; needs flaps (three detents that visibly change lift, drag and stall speed) and a
  long runway. Spoilers as its airbrake. Payload (passengers and cargo) changes mass. Autopilot is
  most useful here. A fictional airline-style livery (no real airlines).
- **The helicopter.** "Magpie 48" (FLIGHT_PLAN section 2, approved there, game numbers not matched
  to anything real): blocky-smooth utility helicopter, 4,800 kg, 12 m four-blade main rotor,
  conventional tail rotor, tall dorsal intake, side-by-side cockpit and a six-seat cabin with sliding
  doors, skid gear, short stub wings with a gun pod and two rocket pods (the weapons are milestone
  7), a belly hook. Top speed about 75 m/s, climb about 10 m/s, ceiling about 5,000 m, sling hook
  rated for about 1,500 kg.
- **The helicopter model** (FLIGHT.md): no blades, one rotor disc. Rotor thrust along the disc
  normal driven by collective, with ground effect and a translational lift gain; cyclic tilts the
  disc normal, limited; torque reaction yaws the fuselage and the tail rotor (pedals) counters it;
  fuselage drag and a small tail stabilising effect. **Hover assist**, switchable at any time: PD
  controllers hold level attitude, hold vertical speed with the collective centred, hold zero
  ground velocity with the cyclic centred, hold heading with the pedals centred; assist off is
  manual; the strength is a knob. **Sling load**: a point mass on a rope (a spring and damper that
  only pulls); it swings, drags, can be set down, and its mass is felt through the hook.
- **Systems**: flaps (three detents on the 737, a combat setting on the fighter), airbrakes
  (the fighter's, the 737's spoilers), autopilot with altitude hold, heading hold and speed hold on
  all three. All switchable by key and pad.
- **Hangar**: switch aircraft (only here), the 737's payload (passengers and cargo), the helicopter's
  hook and weapons, tuning knobs, a livery for each, all stored per aircraft under their own keys.
- **A refit script** for the new aircraft (`scripts/fit-aircraft.mjs` takes an id today and fits the
  F-22's supercruise and top speed), and `npm run flight` extended so each aircraft is held to its
  published figures, plus "the helicopter hovers with assist on within a set drift for 60 seconds".

What already exists to build on (all verified in the tree on 2026-10-21):
- `src/data/aircraft.js`: `AIRCRAFT` (a list with only the F-22), `getAircraft(id)`,
  `DEFAULT_AIRCRAFT`; `src/data/unlocks.js` (`isUnlocked('aircraft', id)`, always true). An entry holds
  mass, shape, curves, surfaces, engines, gear (wheels and hull points), `payload`, `figures` with their
  sources, `ground: { minRunway, vtol }`, `cockpitEye`, `camTarget`. The F-22 already has `flapAlpha`
  (scheduled flaps with the gear down, taken up by `FLIGHT.flapUp`), `airbrakeCdA` and `gearCdA`.
- `FlightPlaces.eligible(ap, mode)` already reads `def.ground`: `vtol` lets a helicopter start on a
  heliport; `minRunway` greys "Start on the runway". `Airports.start(ap, mode)` gives the poses.
- The Hangar (`src/ui/Hangar.js`) takes a `defs` list, shows an Aircraft row, switches its preview
  (`_switch`), keeps a setup per aircraft id, and its Save returns `{ id, setups }`. Options per
  aircraft are in `HANGAR_OPTIONS` (`src/data/loadouts.js`: loadout items with masses, the three tune
  knobs, the damage parts), and `hangarOptions(id)`, `normalizeSetup(id, raw)`, `payloadMass(def, loadout)`
  take the id. Storage is per aircraft (`core/HangarStore.js`: `flight.<part>.<id>`).
  `AircraftPhysics.setup({ payload, tune })`, `Aircraft.setLivery`.
- `FlightInput` already collects the actions `flapsUp` and `flapsDown` (Z, X; pad d-pad left and right),
  `autopilot` (P; pad d-pad down) and `hover` (H; pad Back held then X); nothing reads them. The key map
  is the one the user approved (FLIGHT_PLAN section 5 item 5): with the autopilot on, Up and Down,
  Left and Right and W and S move its three targets.
- Tests and tools: `scripts/check-flight.mjs` and `scripts/lib/flight-harness.mjs` (`takeoffPilot`,
  `landingPilot`, `taxiPilot`, `roundedRoute`, `standToRunway`, `trimmedFlight`, `levelMach`,
  `airborne`, `runOn`), `scripts/fit-aircraft.mjs [id]`, `scripts/look.mjs` and `scripts/look-world.mjs`
  (which take a substring to pick shots).

What is F-22 specific and has to be generalised (this is most of the work):
- `src/render/AircraftBuilder.js` `buildAircraft(def, livery)` is one hard-coded fighter, and its
  livery decals (wing tips and bands, fin tips, the tail number on the fins, the roundel on the wings)
  are placed on its own panels. The 737 and the helicopter need their own builders (lofted panels,
  `glossy()`, round wheels), and `Aircraft.js` animates the F-22's named parts (stabilators, rudders,
  flaperons, nozzles, gear). Keep the F-22's default mesh identical (43 meshes; the livery
  check in `npm run flight` holds the default colours).
- `FLIGHT` in `tuning.js` is tuned for the F-22: the damping, the aids, the g limiter, the taxi
  governor (`taxiSpeedMax`, `taxiSpeedPerLever`), the tail guard, the nose wheel limits, the gear
  warning speeds, the stick ramps. There is no per-aircraft override. A 79 t airliner and a helicopter
  need their own values.
- `FlightGame` fixes `this.def` at construction (`AIRCRAFT.find(isUnlocked)`), builds one `Aircraft`,
  one `ShockWave`, one `FlightPlaces`, and `openHangar`'s `onClose` ignores the returned `id`: switching
  aircraft has to rebuild those and decide where the new aircraft is put (the same stand?). There is no
  stored "current aircraft" key yet.
- `AircraftPhysics` assumes fixed wings, jet engines (`Engine.js`) and wheels (`Gear.js`: a spring and
  damper per wheel, hull points, a `skid` tail point). A helicopter needs a rotor model, skids (contact
  without rolling and with sliding friction) and its own control mapping (collective, cyclic, pedals).
- `FlightCamera` (chase distance, `cockpitEye`), `FlightHud` (no flaps, spoiler or autopilot readouts;
  no rotor or hover display), `FlightAudio` (a jet and an
  afterburner; the 737 wants a turbofan hum, the helicopter a rotor chop that follows load) and
  `ShockWave` (Mach 1; the 737 never reaches it) are tuned to a 19 m fighter.
- The harness pilots and most of `check-flight` carry F-22 numbers (rotate at 125 kt, `vref` 76 m/s,
  50 m climb-out, runways of 1,500 to 1,900 m, roll limits).
- `hangarOptions(id)` and the Hangar card fall back to the F-22; `HANGAR_OPTIONS` has only `f22`.

Things learned in milestone 3 that will bite milestone 4 (do not rediscover them):
- The 737 against the airports. It needs 2,316 m to take off and 1,600 m to land, so only the major
  (3,500 m), the air base (3,000 m, built for fighters) and perhaps a long regional (up to 2,000 m)
  are possible: set `ground.minRunway` for it (about 2,400 m) and the greyed "Start on the runway" and
  the airport list follow. Its span (35.8 m) and length (39.5 m) are about twice the fighter's: the
  stands, the bays (`OPEN_WORLD.airports.zone`, 30 x 34 m) and the hangars (the major's are 50 x 40 m,
  the regionals' 36 x 30 m) were sized for a fighter, the regionals' taxiways are 15 m and the strips'
  12 m, and a wheelbase of about 15 m (find the figure) makes apron turns wide: the taxi test routes
  use a 9 to 10 m turn radius (`roundedRoute`, `standToRunway`), the nose wheel limits are in `FLIGHT`.
- The major's approaches are blocked from about 5 km out (it sits in a cut in a ridge: 10i). The
  landing test excludes it. The 737 makes this matter. Options: give it a placement hint elsewhere
  (that moves the home area and the six track areas' `AREA_GOLDEN`, which the world check records:
  re-record deliberately), or cut the approach into the ridge. Put it to the user.
- Placement is seeded and track areas keep clear of airports: editing the airport list, the spacing
  or `seedSalt` can move track areas (10i).
- There is no wind. FLIGHT_PLAN section 5 item 8 promised "a stub only (a settable constant wind)" in
  this milestone so the 737's crosswind work can use it; weathercocking was not modelled in 3. It must
  be a pure function of position and time, or the determinism checks break.
- `FLIGHT.levelStrength` is 0 (no roll self levelling), so the Hangar's flight assist scales only the
  auto trim; a helicopter's assist is a separate thing (hover assist).
- Idle thrust beats rolling resistance and the tyre model has no static friction, which is why the taxi
  governor and the parking hold exist (10i). A 737 and its brakes will need their own numbers.
- A software-GL Chrome draws a frame in seconds: drive timers by hand (the bay dwell, the map raster
  `_built`) in the look scripts, and give `look-world` a substring so a run takes minutes, not an hour.
- `npm run world` ends with four failures in this container that also fail on the pristine tree (three
  mesh hashes and one chunk-time check, 10i): not yours. Wall-clock checks fail on a swapping machine.
- The user dictates: expect wrong words ("ailerons" for the stabilators, "inner distance" for the near
  plane). When they report a feel problem it is often a feedback loop: trace the time series first.

Decisions to put to the user in the plan (FLIGHT.md's open-items habit; recommendations in brackets):
1. One stop or two. [One milestone, one stop, but build in order: the 737 first, checked and flyable,
   then the helicopter. If the plan looks larger than a milestone, propose 4a (the 737, flaps,
   spoilers, autopilot, switching) and 4b (the helicopter, hover assist, the sling hook) with a stop
   after each, and let them choose.]
2. Per-aircraft flight tuning. [Keep `FLIGHT` as the shared defaults and add a per-aircraft override
   block in `tuning.js` (for example `FLIGHT_OVERRIDES.b737`), merged over `FLIGHT` when the physics is
   built, so the F-22's behaviour is bit-identical (the "defaults change nothing" check) and every
   override has a comment and a range.]
3. How the builder is split and how liveries fit. [`src/render/aircraft/{f22,b737,magpie}.js` behind
   the same `buildAircraft(def, livery)`; the F-22's output unchanged; livery options and decals per
   aircraft in `loadouts.js` (the 737: fictional airline-style stripes and a tail number; no real
   airlines).]
4. The helicopter's name, design and controls. [Keep "Magpie 48" unless they object (it is in
   FLIGHT_PLAN section 2, approved). Collective on W and S (the throttle lever's role), cyclic on the
   arrows, pedals on A and D, H for hover assist; pad: left stick cyclic, right stick X pedals, right
   stick Y collective. Propose the full mapping, including the hook key, for them to approve.]
5. The 737's figures. [Use FLIGHT.md's; source the approach speed and the flap detent settings
   (up, an approach setting, a landing setting) online and say what you found; the wheelbase and
   the nose wheel angle too. Say when a number is an estimate.]
6. The rotor model and hover assist structure, and the hover drift limit the check holds. [One rotor
   disc, assist as PD controllers on attitude, vertical speed, ground velocity and heading, each with
   a gain in `tuning.js`; a drift limit of about 2 m over 60 s, proposed in the plan.]
7. The sling hook and how to test it without missions. [A crate on a heliport apron, a hook key, a
   spring and damper rope that only pulls, the load rests on `world.sample`, released on the ground;
   a headless check that it swings and settles.]
8. The autopilot. [P toggles; altitude, heading and speed hold; with it on the stick and throttle keys
   move the three targets (as approved); a small HUD readout; on the helicopter the holds are
   altitude, heading and ground speed.]
9. Wind. [A settable constant wind vector in `OPEN_WORLD` (default zero, so nothing changes), a
   weathercocking term on the ground, a crosswind takeoff and landing check for the 737.]
10. The major's approach and the 737's airports (see above). [Clear the major's approach (hint or
    cut, they choose), give the 737 `ground.minRunway`, scale the bays and stand spacing by the
    aircraft, and add a taxi test with a wide turn radius.]
11. How switching aircraft works at runtime. [The Hangar already returns `{ id, setups }`; rebuild the
    `Aircraft`, the physics, `FlightPlaces`, the `ShockWave` and the HUD; store the current aircraft
    (`flight.aircraft`); put the new one on the same apron stand with its own fuel; "change aircraft"
    stays reachable only from a bay, as the pause card says.]
12. HUD, camera and audio per aircraft. [Chase distance and the cockpit eye from the aircraft data; flaps
    and spoiler rows, an autopilot row, a helicopter row (rotor load, hover assist on or off); a
    turbofan hum and a rotor chop in `FlightAudio`, built when each aircraft lands.]
13. The refit script. [`scripts/fit-aircraft.mjs <id>` generalised: for the 737, cruise Mach 0.785 and
    maximum Mach 0.82 at altitude, takeoff and landing field lengths; for the helicopter, the game
    numbers (top speed, climb, ceiling).]

### 10k. Milestone 4a: the Boeing 737-800, built (2026-10-21, waiting on the user's test)

Branch `Flight_test`, on top of `f00427b`. Committed and pushed on 2026-10-21 when the user said
"commit the change now" (the user's rule: commit only when asked, as the user, no Claude trailer,
section 3; the stop hook alone is not a request, they asked in words). The plan was made in plan mode and the user approved
it unchanged: two stops, 4a (this) and 4b (the Magpie 48), the major's approach cut (not moved),
the hook on K and pad A, 737 flap detents Up, 5, 15, 30. FLIGHT_M4_PROMPT.md is not in the repo; the
user's pasted prompt was the brief.

**Verified (all on the final tree).** All nine car checks pass. `npm run flight` passes (249 checks):
the F-22 is identical to the bit (`scripts/flight/identity.mjs`: six scripted runs and three mesh
hashes recorded on the pristine tree). `npm run world` passes everything except the four failures
that also fail on the pristine tree (three mesh hashes for copper-flats, glacier-pass and pine-ridge,
with the SAME hash values as the pristine tree, and the wall-clock chunk time check, which is noise
on a busy machine; it passed on one pristine run and failed on one of mine). `npx vite build` is
clean (the 800 kB advisory is old). The dev server starts with no error. `npm run look` and
`npm run look-world` exit non-zero in this container ONLY because Chromium's software WebGL logs
"Automatic fallback to software WebGL" and "GPU stall due to ReadPixels" warnings, which the scripts
count; the pristine tree does exactly the same (checked on a worktree). Read the PNGs, not the exit
code. The page's physics barely runs in software GL (a few steps a frame): the scripts and any scratch
flight step the aircraft by hand (`flight.step(1/120)` in a loop, in ONE eval: the input is polled
between evals and resets a held key such as the airbrake).

**What was built.**
- Per aircraft feel without touching the F-22: `AircraftPhysics.F = Object.assign(Object.create(FLIGHT),
  FLIGHT_OVERRIDES[def.id])` and `Gear` takes the same `F`. The F-22 has no overrides. Everything new is
  an exact 0 or exact 1 at the F-22's values (`x + 0`, `x * 1`), which is why the identity check can
  hold. `FLIGHT_OVERRIDES.b737` is in `tuning.js`, every value commented with a range.
- Flaps (`def.flaps`: detents with a name, angle, zero-lift shift, lift gain, drag, limit speed;
  `time`; `autoRetract`): `input.flaps` is the lever, `flapPos` follows it at a rate, `Wing.liftScale`
  and `Wing.cdAdd` (1 and 0 by default), the stall angle falls with the flaps. The F-22 got a second
  setting, Combat (lift 7 percent, 3 degrees of zero-lift shift, drag 0.012, retracts by itself above
  165 m/s), checked by `scripts/flight/flaps.mjs`; its first, Auto, is the aircraft as it was.
- Spoilers: `airbrakeLiftDump` (0.8 on the 737) and automatic ground spoilers (`FLIGHT.autoSpoilers`,
  on for the 737 only: wheels down and the lever at idle). The HUD calls the airbrake "Spoilers" on the
  737 (`def.airbrakeName`).
- A turbofan has no afterburner (`hasAb`), ground effect (`def.groundEffect`: 10 percent more lift at
  the ground, 36 m reach), a constant wind stub (`OPEN_WORLD.wind`, default 0, `World.windX/windZ`, the
  physics subtracts it from the velocity; no UI until milestone 9).
- The 737 (`src/data/aircraft.js` B737): Boeing's mass, fuel, wheelbase 15.6 m and track 5.72 m, the
  spec's performance, estimates marked as such. Fitted by `scripts/fit-aircraft.mjs b737`
  (`scripts/lib/fit-b737.mjs`): maximum Mach 0.82 at 35,000 ft, cruise Mach 0.785 at lever 0.77,
  ceiling 41,000 ft (0.49 m/s of climb left), stall speeds at 65 t of 153.4, 135.0, 126.0 and
  117.9 kt for up, 5, 15 and 30, Vref 145 kt at flaps 30 (1.23 times the stall, an estimate), takeoff
  at the maximum mass with flaps 5: 35 ft at 2,100 m, times 1.15 is 2,415 m (published 2,316, 4 percent
  over, tolerance 8), landing at the maximum landing mass with flaps 30: 50 ft to a stop divided by
  0.6 is 1,640 m (published 1,600, tolerance 10). A refit prints flap gains a little different from
  the ones in the data (0.293, 0.495, 0.676 against 0.299, 0.467, 0.732) because the stall measurement
  now runs under the new speed loop; both meet every figure, so the data was left alone and the CHECKS
  are the authority.
- The mesh (`src/render/aircraft/b737.js`, `buildB737(def, livery)`, `glossy()` smooth shading): a
  lofted fuselage with a radome and tail cone, windscreen and window rows, swept wings with dihedral
  and winglets, slats, two flaps, an aileron and four spoilers a wing (all of them move), nacelles
  with a turning fan, tailplane and elevators, fin and rudder, twin-wheel gear. About 5,000
  triangles, 3 ms a build. Fictional livery: cheat line, tail colour, belly band, engine rings, a
  tail logo (ring, wave, star, bars), a tail number. Chosen by `def.model` in `Aircraft.js`
  (`BUILDERS`); the F-22 builder is untouched except that its helpers are exported.
- The autopilot (`src/flight/Autopilot.js`, tuning `AUTOPILOT`): a pilot, not a physics mode. It reads
  the state and writes the same stick, lever and flaps a player does, once per fixed step, so it is
  frame rate invariant and deterministic. Altitude: error to a vertical speed to the stick, with an
  integral that only works within 30 m of the target (it wound up and overshot before). Heading: error
  to a bank to the roll stick. Speed: a CASCADE (error asks for an acceleration, the lever moves at a
  rate in proportion to the acceleration still missing): no integrator to wind up. It lets go by itself
  on the ground, in a stall and in a wreck, and refuses to engage below 60 m (`engageAgl`). Measured
  (`scripts/flight/autopilot.mjs`): a 300 m step settles inside 4 m with 2 to 8 m of overshoot and load
  factor 0.67 to 1.24 on the 737 (2.9 g at the most on the F-22), a turn rolls out on the heading to
  0.00 degrees inside the bank limit (25 degrees on the 737, 57 on the F-22), speed steps of 30 to 40
  kt settle to 0.0 kt with 1.5 kt of overshoot.
- Switching (`FlightGame.switchAircraft`, `openHangar`): the Hangar offers all aircraft, Save keeps
  every setup, the one chosen is built (`Aircraft`, `ShockWave` only if `def.supersonic`, `FlightPlaces`,
  `Autopilot`), the camera, HUD rows, sound profile and map silhouette are configured from the data
  (`_configure`), `flight.aircraft` is stored, and it is put at the same airport at the mouth of the
  bay, or, if that airport cannot take it (a 737 needs `ground.minRunway` 1,500 m, never a strip or
  heliport), at the nearest that can (`FlightPlaces.nearestEligible`) with a note.
- Hangar per aircraft (`loadouts.js`, `Hangar.js`, `HangarStore.js`): liveries per aircraft
  (`LIVERY_OPTIONS[id]`, `normalizeLivery(raw, id)`: another aircraft's pattern falls back to this
  one's default), loadouts (737: passengers 0 to 162 at 95 kg, cargo to 8,000 kg), damage parts, card
  figures per aircraft (the 737 adds the landing speed, and shows the mass in yellow above the maximum
  takeoff mass or above Boeing's maximum zero fuel mass, 62,731 kg, which a full cabin and hold exceeds).
- HUD: flaps and spoilers, an autopilot line (`AP ALT 5,090 ft HDG 000 SPD 224 kt`), no burner row on an
  aircraft with no afterburner. Sound: `FLIGHT_AUDIO_PROFILES.b737` (deeper rumble, higher and quieter
  fan whine, no burner or boom) and a flap clunk. The 737's chase camera is 78 m back and 19 m up.
  Map: an airliner silhouette (`def.mapIcon`). Controls card: flaps, autopilot, hook rows.
- The major's approach corridor (`Airports.flatten` -> `_corridor`, `OPEN_WORLD.airports.corridor`,
  `corridor: true` on `meridian-intl`): the ridge it sits in blocked both approaches (a 3 degree path
  was 171 m under the ground on the south, 20 m on the north). The land beyond the platform's end is cut
  down to a 2 degree ramp (`slope` 0.035) out to 7 km, 300 m half width widening 0.06 a metre, sides
  rising back over 600 m, fading in over 300 m and out over the last third. It only lowers land
  (deepest cut 290 m), never steeper than the land (1.40 either way), touches no track area and no
  other airport. The 3 degree path now clears the ground by 39 m (runway 36) and 41 m (runway 18) at
  the least from the platform's end to 7 km. Placement is untouched, so `AIRPORT_GOLDEN` and
  `AREA_GOLDEN` did not move. The F-22's takeoff golden in `identity.mjs` is flown over the world
  WITHOUT the corridor (`corridor: false` on the data) because the climb out now crosses lowered ground
  and the tail guard sees a different height: the world changed, the aircraft did not (proved: the
  hash returns to the golden).
- Checks added: `scripts/flight/{identity,b737,autopilot,switching,flaps}.mjs` and a corridor section in
  `check-world.mjs`; `scripts/lib/airliner-harness.mjs` (737 pilots and measurements). The harness flies
  the autopilot with its OWN fixed altitude gains (`MEASURING`: the stall and ceiling measurements must
  not move when the autopilot is tuned) and the autopilot checks ask for the tuned ones (`tuned: true`).
  `look.mjs` takes the 737 through the Hangar (hangar-737-a to d, apron, runway, approach, spoilers,
  cockpit, autopilot, map); `look-world.mjs` has the approach to the major (name contains `approach`).

**What I found about the 737 (sources, as asked).** Boeing, 737 Airplane Characteristics for Airport
Planning, D6-58325-7 Rev C (October 2025): max takeoff 79,015 kg, operating empty 41,412 kg, max
landing 66,360 kg, max zero fuel 62,731 kg, usable fuel 20,897 kg (26,024 L), wheelbase 15.60 m, main
gear track 5.72 m, nose wheel steering 78 degrees (tiller), tyres, and takeoff and landing field length
charts (about 2.2 to 2.3 km takeoff at the maximum mass; landing about 1.8 to 1.9 km at flaps 30 read off
the chart, the spec's 1,600 m fits a lighter landing or flaps 40; both are FAR lengths). THE APPROACH
SPEED IS NOT PUBLISHED: Boeing computes Vref per weight in the flight computer. Training and sim sources
agree on the mid 130s to high 140s KIAS at flaps 30 and ordinary weights, flaps 40 a few knots lower,
about 142 kt at flaps 40 near 65 t, final approach Vref plus 5. The data uses Vref 145 kt at flaps 30 and
65 t, scaled with the square root of the mass, marked an estimate. Real detents are 1, 2, 5, 10, 15, 25,
30, 40 (takeoff normally 5, landing 30 or 40); the user chose Up, 5, 15, 30. Flap limit speeds from the
training sources (not Boeing): 5 at 250 kt, 15 at 200, 30 at 175 (used: 128.6, 102.9, 90.0 m/s calibrated).
NOT FOUND: the trailing edge flap angle per detent and the lift coefficient at each (the mesh turns the
flaps by the detent number in degrees, unconfirmed; the aerodynamics are fitted to stall speeds). Gear
speeds (extend 270 kt, retract 235, extended limit 320, from the same training sites) are not enforced
until damage (milestone 5).

**What to test (tell the user, in this order).**
1. Pick the 737 in the Hangar (Fly menu, Open the hangar, Aircraft row, Save). Look at it on the
   turntable: livery rows (pattern, insignia, number, two colours), passengers and cargo, the card (the
   mass goes yellow with a full cabin and hold). Then Start on the apron and on the runway.
2. Take off at Meridian: flaps to 5 (X, once), full lever, rotate about 155 kt, gear up, flaps in
   (Z) as it accelerates (out is refused above each setting's limit with a note). Does it feel like a
   heavy airliner: slow to answer, stable, a long roll (about 1.8 km)? Does the nose wheel steer on the
   roll and the taxi feel right (a low lever holds a taxi speed)?
3. Land at Meridian from either end (it is now clear): flaps 15 then 30 (X), gear down, 145 kt, about
   3 degrees; the spoilers come up by themselves on touchdown (V by hand in the air), brakes B.
4. P in the air: the autopilot holds altitude, heading and speed; Up/Down, Left/Right and W/S move the
   three targets; P again, or a stall or a landing, lets go. Try it on the F-22 too.
5. The F-22: Z/X now cycles Auto and Combat flaps. Otherwise it must feel exactly as before.
6. Switch back and forth; chosen at an airstrip, the 737 is moved to a long runway with a note.
7. Judge by ear (not heard by me): the 737's engine sound and the flap clunk.

**What bit (do not reintroduce).**
- The harness autopilot WAS the measurement tool: changing the autopilot's gains moved the stall speeds
  and broke the landing checks (a negative Vref made the whole landing run dive). Hence `MEASURING`.
- The speed target is clamped to `spdMin` (65 m/s on the 737): a stall speed run that lowers the
  target needs `spdMin` lowered too (the harness does).
- The speed loop must not trust the first airspeed reading: before the first physics step `p.cas` is a
  stale value, and a jump to the real one read as a huge acceleration and chopped the lever. It
  baselines on the first step and clamps the measured acceleration (`ACC_LIMIT`).
- Windscreen panes drawn as boxes block the cockpit camera; they are single sided planes now, raked
  back (front edge low), so the eye looks through them.
- A pasted `maxZeroFuelMass` ended up twice in the data (harmless, removed).
- `identity.mjs` must stay on the world as it was; if the world changes again, the F-22's takeoff
  golden does NOT mean the aircraft changed.
- The first `look` run of a 737 flaps/spoiler shot showed nothing because `flight.input.state.airbrake`
  is reset by the next frame's poll: set it and step in one eval.

**Known gaps and things to tell the user.**
- The 737's crosswind takeoff drifts 9.1 m off the line at 15 kt in the check (the scripted pilot has no
  aileron into the wind; a person will do better); a crosswind LANDING is not tested.
- The cut in the major's ridge is large (up to 290 m deep and about 1.5 km wide at its widest): it is the
  price of an airliner approach at that airport; its knobs are `OPEN_WORLD.airports.corridor` if they want
  it narrower (the world check pins the 3 degree path clearance at 35 m).
- No reversers, no gear or flap limit speeds enforced beyond the flap lever's refusal, no cockpit
  interior, no passengers, no cabin sound; stalls are soft-edged (the aids ease the pull); the 737's
  flaps animate by detent degrees (unconfirmed angles).
- The autopilot refuses below 60 m and holds a fixed bank limit; no approach mode. The radar's own symbol
  is still the star. Hover assist, the hook and the helicopter do not exist yet.
- The Hangar's switch is exercised end to end by a scratch page script (flaps, autopilot, switching,
  placement, storage all passed) but not by a person; the pad was not tried.

**What 4b still owes (not started).** The Magpie 48: `HelicopterPhysics` + `Rotor.js` (one disc, momentum
theory power with an engine limit, ground effect, translational lift), cascaded PD hover assist (H, on by
default, a Hangar knob), skids as contact points in `Gear`, `SlingLoad.js` (spring damper rope that only
pulls, hook rating 1,500 kg, K and pad A, a crate at ground starts), its mesh (blocky smooth, turning rotor,
rope and crate), HUD rows (collective, power, hover assist, hook and load), a rotor chop in the sound, its
Hangar options and livery, its autopilot mode (altitude, heading and ground speed through hover assist),
`scripts/flight/magpie.mjs`, a helicopter harness and fit plan in `fit-aircraft.mjs`, `look` shots (with the
crate on a heliport), `AIRCRAFT = [F22, B737, MAGPIE]`, and sections 1 and 10.0 updated at the end. The
game numbers to fit: top speed 75 m/s, climb 10 m/s at sea level at 4,300 kg, ceiling 5,000 m, mass 4,800
kg, rotor 12 m. The hover check: 60 s in a 4 m/s wind within 2 m, 1 m of height and 2 degrees, and more than
10 m of drift with the assist off.

### 10l. Milestone 4a, the user's notes after flying the 737: built (2026-10-21, waiting on the user's test)

The user flew the 737 and wrote: the 737 flies fine; every runway is too narrow for it and the taxiways
too; the speed brakes stall the plane without slowing it; a soft landing counts as a crash; the gear
goes through the body and then vanishes when it retracts; after a crash offer a choice of where to
respawn (the hangar or the nearest runway); first person is glitchy with black lines through the map, and
they want a Cockpit view with the inside of the cockpit modelled IN ADDITION to the first person view they
have; the 737's nose looks nothing like a real 737's glass; the F-22's side intakes look tacked on. All
nine are done. Committed and pushed on the user's request (in words) together with the agent hand-off files.

**Verified (all on this tree).** All nine car checks pass. `npm run flight` passes (251 checks, the F-22
identical to the bit; see the mesh goldens below). `npm run world` fails only the three mesh hash checks
(copper-flats, glacier-pass, pine-ridge) that fail on the pristine tree too. `npx vite build` is clean (the
800 kB advisory is old). The dev server console is clean in the new views (`errors []` from the page).
Screenshots were read for the nose, the intakes, both cockpits (forward, left, down, back) and first
person.

**What was built.**
1. Runways and taxiways (`src/data/airports.js`, header comment explains it). Runway widths now: major 90 m
   (was 60), air base 70 (45), regional 60 (30), strip 45, heliport pad unchanged; taxiways 45, 35, 30, strip
   stub 25, heliport stub 20. The rule that kept the world as it was: every tier's flat PLATFORM is the same
   rectangle (a runway's extra width comes out of its `right` margin, the parallel taxiway grows INWARD so
   its outer edge, the apron and the buildings stay put, a stub's `gap` shrinks), so airport placement and
   `AIRPORT_GOLDEN` (6dd44d5b) and `AREA_GOLDEN` did not move.
2. Spoilers. The wing lift dump is split in two: `airbrakeLiftDump` (on the wheels, 0.8 on the 737) and
   `airbrakeLiftDumpAir` (in the air, 0.1 on the 737), blended by the weight on the wheels, and
   `airbrakeCdA` 7.0. In the air the 737's spoilers now take about 1.4 kt a second off without dropping
   the nose; on the ground the dump keeps the weight on the wheels so the brakes work (check:
   `scripts/flight/b737.mjs`, speed brake and ground load 482.6 against 128.1 kN).
3. Landing hardness. New tunable `FLIGHT.hullCrashDepth` (0.35, how far the gear can compress past its
   stop before the hull is counted as hitting; the F-22 keeps it) and `FLIGHT_OVERRIDES.b737`
   `crashSpeed` 5, `maxSink` 6.5 m/s, `skidCrashSpeed` 7, `skidCrashDepth` 0.8, `hullCrashDepth` 0.6.
   Checked: a firm landing and a late flare survive, an unflared 6 degree glide is a crash.
4. Gear fold (`b737.js` `FOLD_MAIN`, `FOLD_NOSE`, `FOLD_SLIDE`; `Aircraft.js` for the F-22): the legs
   swing inboard and aft with a slide as they retract, so they never pass through the skin and then pop.
5. Crash menu (`FlightGame.openCrash`, `FlightScreens.crash`): after `FLIGHT_CAMERA.crashMenuDelay` (1.6 s)
   of wreck a menu offers: respawn at the hangar of the last airport, respawn on the nearest runway that
   can take the aircraft (with the distance), open the map (and come back to the menu), back to the title.
   Esc goes to the hangar. Pad: the standard menu buttons.
6. Cameras (`FlightCamera.js`, `FLIGHT_CAMERA`): C cycles Chase, First person, Cockpit, Far orbit
   (`CAM`). THE BLACK LINES were depth fighting: the near plane was fixed small while the camera looked
   across the far world, so the world's coplanar faces shimmered; the near plane now grows with height
   above the ground (`firstNearMax` 2 m cap), and first person has its own field of view (`firstFov` 72).
   First person keeps the eye it had (`def.cockpitEye`).
   The COCKPIT view draws the inside in a SECOND PASS (`PostFX.OverlayPass`, `Scene.setOverlay`,
   `_renderOverlay`): the world is drawn first, then the depth is cleared and the aircraft plus its
   interior are drawn with their own camera (near `cockpitNear` 0.04, far `cockpitFar` 120, fov
   `cockpitFov` 78), so a dashboard centimetres from the eye does not share a depth buffer with a mountain
   100 km away. Three.js layers do the sorting: the interior is on layer 1 only (the ordinary camera never
   draws it), the aircraft's body is on layers 0 and 1, the lights are on both. The overlay pass nulls
   `scene.background`, and the shadow map is rendered per call with the view camera's layers. The eye is
   `def.cockpitView.eye` (737: [0.55, 0.82, 14.1], the left seat; F-22: [0, 1.3, 2.9]).
7. The interiors (`src/render/aircraft/cockpits.js`, `BUILDERS` keyed by `def.model`; the HULL IS ONE
   SIDED so from inside it is invisible and the interior has to close the space itself, with holes where
   there is glass). 737: a shell of grid cells standing 7 cm inside the skin with the windows left open
   (the window list is `COCKPIT_GLASS` in `b737.js`, shared so the openings match the glass), the two
   bulkheads, floor, overhead panel with lights, the instrument panel with six screens (a real moving
   artificial horizon on both PFDs, cut to the window analytically every frame, nothing allocated per
   frame; the screens are blocks of colour with rings and bars), the glareshield with the autopilot panel,
   the pedestal with two throttle levers, a speed brake lever and a flap lever that move with the aircraft,
   a gear lever, two yokes that turn with the roll and come back with the pull, seats and pedals. F-22: a
   tub and sill rails, canopy arches (`CANOPY_STATIONS`, exported from `AircraftBuilder.js`, a Loft
   whose arches follow the glass), coaming, a head-up display frame (the symbols are the page's own HUD),
   a panel with a moving horizon, side consoles, left hand throttles that move, a stick that tilts with
   the inputs, an ejection seat. Interior materials carry part of their colour as a glow (`inside()`):
   the hemisphere light painted the roof the colour of the ground. An aircraft with no builder gets a
   placeholder block (the Magpie will need its own).
8. The 737's nose (`b737.js`): the fuselage tapers over the last 9 m to a small tip (measured off side
   photographs, not the first version's blunt dome) and the flight deck has four glass panes a side
   (`COCKPIT_GLASS`: forward windshield high on the slope so it faces forward over the top, front side
   window, sliding window, small fixed one), each a curved patch of the skin (`patch()`) standing proud of it
   with a dark frame under it. The old pane planes and side window row are gone.
   Photos used (Wikimedia Commons, by file name): "D-ATUF B737-8K5W TUIfly-Hapag retro PMI 26SEP10
   (6341092368).jpg" (side view of the nose and glass), "N785SW BWI MD1.jpg" (a 737-700, side), and "The
   737-800 Flight Deck (3852492599).jpg" (the flight deck for the interior layout).
9. The F-22's intakes (`AircraftBuilder.js` `INTAKE`, `intakeDuct`, `intakeThroat`): a lofted duct of
   rounded parallelogram sections (top edge leaning outboard), its front ring raked back along the top and
   outer edges (a swept lip), the cheek the colour of the hull and swelling out of the fuselage side under
   the rear of the canopy, a black throat behind the lip, instead of dark pods under the wing roots. Modelled
   on a head-on and a top-down photograph of an F-22 (Wikimedia Commons: "F-22 Raptor edit1 (cropped).jpg"
   and a flying photo "Demo Teams A Special Formation Flight 201120-F-VA182-9002.jpg"); the shape facts
   (a fixed geometry caret inlet, parallelogram from the front, swept on all entrance edges) are in the
   Wikipedia article on the diverterless supersonic inlet and a patent describing it. THE F-22'S THREE MESH
   GOLDENS WERE RE-RECORDED ON PURPOSE (`identity.mjs`: meshDefault c62a6dc3 to c55516da, meshTips 468e0c98
   to 628e730d, meshSplit 3f01b48b to f8b23a12); the six physics hashes did not move.
10. The controls card now reads "Camera: chase, first person, cockpit, far orbit".

**What to test (tell the user, in this order).**
1. Fly the 737 off the major and land it: the runway should now feel wide; taxi on the wider taxiway.
2. Spoilers (V) in the air: the speed should fall and the nose should NOT drop. On the runway they stop it.
3. Land softly and land firmly: a normal firm landing must not crash it. A really hard one still does.
4. Retract the gear (G): the legs fold into the body, no pass through, no vanishing. The F-22's too.
5. Crash on purpose: the menu should appear after a moment: hangar or nearest runway.
6. C: Chase, First person (clean, no black lines), Cockpit (the inside), Far orbit. Look round with the
   right mouse button: in the Cockpit view the flight deck should be built all round the eye. Does the
   horizon on the panel follow the aircraft, do the throttles and yokes move?
7. Judge the 737's nose and the F-22's intakes against the real ones by eye.

**What bit (do not reintroduce).**
- Draw order inside a cockpit: a screen is a thin box and its contents must sit IN FRONT of its face (more
  negative z toward the pilot); the first panel had them behind and showed black.
- The hemisphere light paints downward facing surfaces the ground colour: interior materials need their own
  glow (`inside()`), and a roof lit that way read as dark green.
- A shared cached material must not be mutated (two sided walls): clone it (`inside()` clones and the
  interior frees them).
- The hull is single sided: a window opening on the outside is a patch and on the inside a hole in the
  shell; both come from `COCKPIT_GLASS` so they agree.
- `identity.mjs` mesh goldens now stand on the new intakes; the physics goldens are untouched. If a later
  change moves a PHYSICS hash, that is a real change in the F-22's flight.
- Wikimedia: needs a User-Agent; it rate limits (429) and `upload.wikimedia.org` originals are blocked, but
  `thumb.wikimedia.org/.../thumb/<h>/<hh>/<name>/1280px-<name>` works (the hash path is the md5 of the file
  name, first one and two letters); search results are noisy (scanned PDFs), so name files directly.

**Known gaps.**
- The flight deck is a stylised, blocky 737: no overhead detail beyond lights, no tapes or ladders on the
  screens, the engine gauges are static. The F-22's HUD frame carries no symbols (the page's HUD draws
  them). Both are for the Cockpit view only; first person keeps its old eye.
- The 737 has no cabin; looking back from the flight deck shows the rear bulkhead.
- The intakes' throat is a flat black plane (no duct inside), the lip is swept but the mouth is partly
  hidden by the fuselage cheek from the front.


### 10m. Codex takeover and missing milestone 5 brief (2026-10-21)

- User requested milestone 5 planning for the F-22 and 737 only; helicopter excluded. Milestone 4a remains under their test. Do not implement until they approve a plan, file tree and the brief's decisions.
- Local checkout is `/Users/harrisoncohen/Documents/racing-game`, origin `https://github.com/Harrison-Cohen/Blocky-Games.git`. Switched from clean `Codex_test` to `Flight_test`, then pulled `origin Flight_test`: already up to date at `9a71305`. Dependencies already present; no install needed.
- Read AGENTS.md, Claude.md, current handoff sections, flight spec and approved flight plan, and both input files. `FLIGHT_M5_PROMPT.md` is missing from this checkout after the pull. Need the user to provide it before producing the requested milestone-specific plan or answers. No implementation or tests performed, no commits or pushes, no servers stopped.
- This session runs on the user's Mac, so edits are already local. Session access grants may be temporary; the checkout should be opened as a project for durable workspace access.

### 10n. Milestone 5 proposal ready for review (2026-10-21)

Branch `Codex_test`. This supersedes 10m's blocked status, retaining its history.

- User requested takeover, sync Codex_test, read instructions and milestone 5 brief, then state
  project status before planning. They require a plan, file tree and all nine decision answers,
  followed by an approval stop. Scope is F-22 and 737 only; 4a remains under test.
- Fetch, checkout Codex_test and pull origin Codex_test succeeded at 8559a6a. node_modules
  exists. No packages installed, no merge/rebase, no commits/pushes, no servers touched.
  Initial fetch hit the read-only .git sandbox; approved escalation completed the requested sync.
- Read AGENTS.md, Claude.md, required HANDOFF sections and latest flight notes, FLIGHT.md,
  FLIGHT_PLAN.md, FLIGHT_M5_PROMPT.md and both input sources. Inspected physics crash/modifier
  hooks, store/normalization, aircraft binding/builders, airport layout, props and MapScreen.
- `FLIGHT_M5_PLAN.md` records the proposal, decisions, file tree, sources, verification and test
  order. Recommend two stops: 5a headless damage, persistence, repair and basic warnings; 5b
  airport structures, effects and map respawn. User must approve before either starts.
- Recommendations include seven parts per aircraft with old-record migration; full repair on
  crash because respawn reaches a free-repair hangar anyway; explicit repair for survivors;
  ground and gear/flap exposure damage; airport buildings solid in 5b; procedural city/track
  scenery solidity deferred because props currently vary with graphics detail/density;
  dev-only console damage hook; reuse MapScreen in respawn mode; pooled particles and vanish
  cheap groups at zero, no debris physics. These are PROPOSALS, not user-approved decisions.
- Sources: FAA ASCENT Project 23 report Table 3 supports existing 737-800 flap maxima
  250/200/175 kt (manuals cited by that research). FAA landing design sink speeds are structural
  design cases, not universal survival cutoffs. NG-specific primary confirmation of gear limits
  not found. Keep inherited limits provisional, preserve current destruction thresholds and
  the 737 firm-landing regression. URLs and details are in the plan.
- Risks: half-health wing may exceed current trim/AP authority at some conditions; trace at a
  feasible flight point rather than adding a magical assist. Damage modifiers must compose with
  flaps and preserve F-22 full-health hashes. No golden re-recording. No repeated resting impact
  charges, no graphic-dependent physics, no solid box filling an open hangar doorway.
- Verification this session: read-only inspection and branch sync only. No test suite, build,
  screenshots or performance checks run because implementation has not been approved.
- Only planning markdown changed in this session. Files are already on the user's Mac, uncommitted.
  Next action is wait for the user's approval, decision changes and batch preference.


### 10o. Milestone 5a: damage and recovery state (2026-10-21)

Branch `Codex_test`, on 8559a6a, local Mac checkout. The user said "continue with the plan",
which approved the recommendations and two stops in `FLIGHT_M5_PLAN.md`. 5a is built, stop
for their test. Do not begin 5b until they approve continuing. No commits or pushes requested
or made. All changes are already on their Mac, uncommitted. The prior HANDOFF edits were
preserved and their stale status superseded, not discarded.

**What was built.**
- `src/flight/Damage.js`: headless seven-part health and normalized load/record interface,
  revision tracking, contact onset and sliding exposure, original crash classification,
  737 gear/flap limit exposure. No Three.js, player dependency, storage or step allocations.
- `aircraft.js` owns each aircraft's part list and surface/engine/hull mapping: wingL,
  wingR, engineL, engineR, tail, gear, fuselage. `loadouts.js` derives Hangar rows from it.
  Old grouped wings/engines health migrates to both children; explicit child wins, corrupt
  child costs only itself. All new rates, tolerances, warning thresholds and AP trim knobs
  are in `FLIGHT_DAMAGE` in tuning.js with comments and ranges. Gear speeds remain provisional
  inherited settings with the sourcing gap labeled. No new packages.
- `AircraftPhysics.js`: side-specific wing lift loss/drag composed with flaps, separate
  engine thrust via existing health, proportional tail control/trim/vectoring authority,
  gear support/brake/steering effects, fuselage-zero destruction. Physics reset keeps damage.
  `Gear.js` records preallocated contact depth/closing/sliding/severity. Surface affects wear;
  impact is charged on contact onset, motionless resting skin does not continuously wear.
- Wing health is condition, not area: half-health wing retains 75 percent lift (tunable),
  zero detaches all lift. Initial 50 percent lift loss made the 737 unrecoverable in traces.
  No magic force or self-levelling was added. `Autopilot.js` adds bounded roll-stick trim
  against bank error only for asymmetric wing damage. Healthy AP trim is exactly zero.
- The tail skid protects shallow/slow scrapes instead of damaging the tail assembly for
  its intended protective contact. This preserves the existing F-22 landing script.
  Existing hard-impact thresholds and reasons remain, including the revised 737 firm landing.
- `FlightGame.js` applies stored health, saves dirty revisions every second and at lifecycle
  transitions/pagehide/hidden, saves before switch/restart, replaces destroyed airframes,
  and keeps survivors damaged until explicit repair. `HangarStore.saveSetup` returns write
  success so dirty saves can retry. Storage is outside the fixed step.
- Hangar repair is instant and persistent even if subsequent paint/load/tuning edits are
  discarded. Individual rows and Repair everything work on all seven parts. Returning to
  a hangar with collapsed gear places the hull safely on the ground, does not secretly heal.
- HUD shows damaged parts/percentages plus caution/critical warnings, using the existing yellow
  caution and signal-orange alert palette. Visual effects, broken
  groups and new sound are 5b. Current crash menu remains until 5b; it now replaces wrecks.
- Dev only: `flight.debugDamage(partId, health)` sets actual physics health and persists it.
  Returns the health record or false for invalid input. Vite strips it from production.
  The usual dev window.flight/window.game handles were already dev-only too.

**Verified.**
- All nine car scripts pass: check, lap, timing, parts, ai, race, fx, specs, drag.
- npm run world PASSES on this Mac, including the hashes that failed in the old container.
- npm run flight: 312 checks pass, six FAIL, all six from the preexisting recorded F-22
  physics goldens. All 67 added damage/store checks pass. All original 737 performance,
  firm landing, late flare, stall/recovery, autopilot and mesh checks pass.
- The six hash failures also occur on untouched 8559a6a, archived to /tmp/blocky-m5-baseline
  with the same installed dependencies. The exact pristine and final hashes MATCH:

  | Scenario | Recorded golden | Pristine and final on this Mac |
  | --- | --- | --- |
  | takeoff | 3f2cfbfe | 66ea10a7 |
  | scripted | 09bf0cef | 9c751de9 |
  | manoeuvre | 4ee079ce | 7dccc763 |
  | landing | 0245d3c6 | 5bc89393 |
  | taxi | c28ddd66 | 7bc6611f |
  | parked | dc711af3 | d7f0a697 |

  Three mesh goldens remain c55516da, 628e730d, f8b23a12 and pass. No golden edits.
  Homebrew Node v26.5.0 arm64 and bundled Node both reproduce the same local table. The
  cause of the difference from recorded goldens is not established. Do not call npm run
  flight clean or silently replace hashes. `node scripts/flight/damage-identity.mjs
  /tmp/blocky-m5-baseline` passes all nine before/after comparisons. This supplements,
  does not bypass, the existing identity check.
- Seven simulated display rates (30, 48, 60, 75, 120, 144, 240) produce identical damaged
  physics/exposure. Repeated run is identical. 100,000 damaged steps retained no heap growth.
- Half-wing trim/AP trace last 40 s: F-22 at 300 kt, altitude error 0.18 m, heading 0.54 deg,
  bank 0.86 deg; 737 at 230 kt/62 t, altitude 0.20 m, heading 0.27 deg, bank 0.33 deg.
- `scripts/flight/damage-browser.mjs` runs an isolated Chrome profile, not the user's saves:
  11 checks pass for actual component health, persistence on restart/switch/reload, immediate
  repair with discard, collapsed-gear return, crash/replacement and critical warning. Browser console clean.
- Production build passes, only existing 800 kB chunk advisory. debugDamage absent from
  production bundle. No runtime package or asset/network dependency was introduced.
- npm run look and npm run look-world pass with clean page consoles on local headless Chrome.
  All original screenshots inspected via labeled contact sheets; damage HUD and Repair views
  also inspected full size. look is extended with both aircraft's damaged HUD/Repair pictures.
  Screenshots are under /tmp/look-m5a-final, /tmp/look-m5a-world and /tmp/look-m5a-browser-final.
  Smoke/fire/broken-part and new respawn shots await 5b. No full-M5 frame-time claim yet.

**What bit.**
- The old stall-speed measurement started with landing flaps at 230 kt. Once overspeed wears
  wings that measures a damaged aircraft. It now starts below the chosen detent's limit.
  The old stall recovery held full throttle/landing flaps for two minutes; its pilot now
  retracts flaps before accelerating through their limit. The screenshot approach fixture
  also slows to 145 kt before landing flaps. Assertions/tolerances and aircraft fits are not
  weakened. The final old 737 checks still pass.
- Game.onFly is async (lazy import). A browser fixture must await it before using flight.
- The default shell Python has no Pillow; bundled workspace Python has it. No install needed.
- Server binds and isolated Chrome required sandbox escalation. Port 5175 was occupied;
  own test server used 5185. Never touched servers on 5173/5174 or stopped the unknown 5175.
  Own 5185 test server was stopped at the end. User servers were left alone.

**User test, in order.**
1. Fly the 737 normally and land softly, then firmly. The revised 4a landing tolerance stays.
2. Try a controlled low-sink belly landing and a hard crash; survive the former, crash the latter.
3. In browser console during a dev flight: `flight.debugDamage('wingL', 0.5)` or
   `flight.debugDamage('engineL', 0.5)`. Test the roll/yaw, opposite stick and AP at altitude.
   Try tail/gear too, separately; reset between tests by explicit hangar repair.
4. Switch aircraft and reload. Each aircraft keeps its own damage. R/teleport do not heal.
5. Return to a marked hangar bay or use Open the hangar from the Fly menu. Repair a part,
   then Repair everything. Repair persists immediately; discarding paint/tuning does not undo it.
6. Accelerate the 737 with flaps out or operate gear above its limits. Health wears over time,
   rather than instantly crashing at a placard speed. A normal legal flight should remain sound.

**Still waiting.** The user's feel/gamepad judgment. No smoke, fire, broken meshes, damage
sound, solid airport buildings or new respawn map yet. Those are 5b. The helicopter and M6
remain untouched. After their test, fix feedback in tuning/data first, then seek their go-ahead
for 5b. Commit/push only if they ask in words, to Codex_test only.


### 10p. Milestone 5b: airport impacts, effects, sound and respawn (2026-10-21)

Branch `Codex_test`, local Mac working tree on 8559a6a. User said "continue with part B",
which authorized the second half of the approved FLIGHT_M5_PLAN.md. 5b is built. Milestone 5
is ready for their test; STOP HERE, no milestone 6 or helicopter. They did not provide a
separate 5a/4a acceptance report. No packages, commits, pushes, merges or rebases. The 5a
changes and preexisting HANDOFF history were retained.

**What changed.**
- New `src/world/AirportStructures.js`: one list of visible/solid boxes for airport hangars,
  terminals and towers. `AirportMesh.js` draws those exact boxes. Hangars have real side/back
  walls, doorway jambs/header and roof, with the doorway open. The old painted door over a
  solid body is gone. Roof overhangs and tower cab/mast boxes also collide. Trees, procedural
  city scenery, track props and light/windsock poles retain their existing behaviour.
- New `src/world/AirportCollisions.js`, constructed by `World.js`: analytic swept contacts in
  absolute coordinates, shared by player/future AI and independent of streaming/graphics/origin.
  Airport distance/height broad phase, then scalar slab tests against expanded solid boxes.
  Each physics object owns its hit result and previous rotation. Aircraft part hit spheres
  are model approximations listed in aircraft.js, not mesh raycasts. A sphere/box expansion is
  conservative at corners; this is a lightweight proxy model, not exact triangle collision.
- `AircraftPhysics.js`: earliest contact stops/interpolates position and quaternion just before
  the wall. Slow impacts damage the actual contact part; above FLIGHT_DAMAGE.objectCrashSpeed
  (10 m/s normal closing speed, a game setting, not a real survivability claim), crash with
  reason "hit an airport building". Resting contact below onset does not repeatedly wear.
  New collision tuning is in tuning.js with ranges/comments. Gear proxies follow the existing
  99-percent-down contact rule. Missing parts no longer create passive aero forces or hull
  ground contacts; their object volumes are skipped too. All full-health F-22 results preserved.
- `aircraft.js` also defines per-part smoke/fire anchors and 737 wing break dependencies:
  wingL takes engineL with it, wingR engineR. `Damage.js` propagates these in the headless
  state; loadouts normalization enforces them for saved records. This avoids floating nacelles
  or invisible live thrust when the wing disappears. Repairing the wing alone leaves its
  engine needing its own repair; Repair everything restores both.
- Builders expose arrays of existing mesh references through built.damageGroups. No reparenting,
  new default geometry or changed default transforms. `Aircraft.js` hides a zero-health wing,
  tail/fin, gear, or 737 engine and restores it after repair. F-22 integrated engine hardware
  stays; its flame is suppressed when the engine is destroyed. Wing markings/737 tail logos
  are included in the hidden groups, so they do not float.
- New `src/render/DamageEffects.js`: reuses the existing opaque cube Particles pool with an
  optional capacity argument (car default unchanged). Smoke below .6, flame below .3. No textures,
  new material types, lights or debris physics. All FX/audio values in DAMAGE_FX in tuning.js.
  GRAPHICS_LEVELS caps: Low 48 particles/12 emissions per second, Medium 96/24, High 160/40,
  Ultra 224/56, shared across all parts. Missing external parts do not leave floating fires;
  a wreck's fuselage and embedded F-22 engines can burn at zero health. Pause freezes particles,
  rebasing preserves their absolute positions, restart/respawn/switch/exit clears the pool.
- `FlightAudio.js`: engine gain/note changes with mean engine health, preserving full-health
  values. Brief synthesized warning on a new/worsening caution/critical condition, cooldown
  and latching prevent repeats for unchanged damage. Pending warning cancels after repair.
  Existing audio bus/volume/mute/cockpit filtering reused; no extra audio files or network calls.
- `MapScreen.js` has a respawn context, reusing its list, raster, markers, mouse pan/zoom and
  keyboard +/- zoom. Name/distance/runway dimensions and eligibility reason per airport;
  nearest compatible default. Start mode locked to hangar apron and separate from ordinary map
  teleport preference. Enter/Space or pad A/Start confirms; Esc/M or pad B opens a small
  return-to-list/title choice. Back to title button is explicit. Ineligible choices stay visible
  but disabled. A rejected callback leaves the list open, not a blank paused screen.
- `FlightPlaces.respawnPose(id)` validates a canonical airport and aircraft eligibility;
  `FlightGame.respawnAt(id)` checks it again, requires a wreck and keeps the same aircraft.
  It replaces the destroyed airframe and starts at the chosen hangar apron, velocity zero.
  R/M/Esc while wrecked open the respawn flow. Ordinary map teleports remain available when
  healthy. Transient HUD notes clear on relocation, preventing stale airport messages.

**Verification on the final source.**
- All nine car scripts PASS: check, lap, timing, parts, ai, race, fx, specs, drag.
- npm run world PASSES, including the three hashes that failed in the old container.
- npm run flight: 370 pass, six FAIL, only the same preexisting recorded F-22 physics golden
  mismatches as 10o. No new failure. Before/after comparison against untouched 8559a6a passes
  all six physics scenarios and all three mesh scenarios. The exact table in 10o is unchanged.
  No golden edits. Do not call the standard flight command clean or overwrite its hashes.
- Added headless modules structures.mjs, respawn.mjs and damage-visuals.mjs (registered in
  check-flight.mjs): rotated/roof/thin-structure sweeps at high speed, doorway clearance,
  actual 3/160/700 m/s hits, no repeated resting damage, 30/60/144 Hz collision identity,
  exact hangar poses and eligibility, per-side visibility/repair/dependent engine, every FX
  budget, flame emission, rebase invariance and pause/clear. Physics step remains allocation-free;
  the existing and 5a heap checks pass.
- Existing damage-browser.mjs: 11 lifecycle/storage/repair checks pass with the new respawn flow.
- New damage-b-browser.mjs: 29 real-page checks pass, clean console. Covers both aircraft,
  smoke/fire/broken side, repair, respawn layout/default/eligibility, stale ID and rejected
  callback, real Enter/Escape events, pad confirm/Back/Start, chosen stationary apron/same
  aircraft/full repair/FX cleanup, warning latch in real Web Audio and title exit/car loop.
- Production build passes, only the existing 800 kB advisory. debugDamage stripped from bundle.
- Extended npm run look passes, screenshots in /tmp/look-m5b-suite-final (35 pictures, including
  both aircraft's smoke/fire/broken wing/Repair/respawn). npm run look-world passes in
  /tmp/look-m5b-world-final (44 pictures). Its added damage subset also passes, two pictures
  in /tmp/look-m5b-world-damage: fire at an airport, actual slow terminal contact. That contact
  survived with fuselage health 0.701779210791603. All 81 suite pictures inspected on labeled
  contact sheets; new effects, broken 737 wing/engine, respawn, fire/terminal contact also
  inspected at full size. Browser-specific images in /tmp/look-m5b-final-checked.
- New damage-performance.mjs: isolated headless Chrome, Medium, 1920 x 1080, render scale 1,
  actual ANGLE Metal renderer reporting Apple M5. Two ten-second samples after four-second
  warmup, real flight physics: healthy 597 frames (median 16.7 ms, p95 16.7); burning/damaged
  601 frames (median 16.7 ms, p95 16.8), 55 live particles, no crash. Other screenshot jobs ran
  during this measurement. This is evidence for this scene/sample, not a guarantee over the
  entire world or a substitute for their interactive feel/sound/gamepad test.
- Own test server on port 5185 was stopped at end; never touched 5173/5174 or unknown
  5175. Chrome profiles for checks are isolated from the user's browser and saves.

**What bit and how not to repeat it.**
- Do not edit imported source while screenshot suites run: Vite reloads lose window.flight.
  One intermediate look-world attempt failed for this reason; the stable-source rerun passed.
- A stationary respawn's wheels settle vertically for a few frames. Assert zero velocity in
  the spawn call and near-zero horizontal speed afterwards; do not fail a valid ground spawn
  because the suspension has a small settling velocity.
- The car title screen intentionally suspends driving input for menu controls. Title exit
  verification checks the restored car loop, not input.suspended===false.
- Step physics AND effects together when making moving smoke pictures. Advancing only FX at
  a frozen aircraft with nonzero velocity piles particles in front of the source and misrepresents
  the trail. Frozen ground-fire fixtures can advance FX alone with zero aircraft speed.
- A 737 wing and its nacelle were initially separate visibility groups. That exposed a floating
  engine after wing break. The attachment is now a headless data dependency, not just a render fix.

**Test in this order, then wait for notes.**
1. At an airport, taxi gently into a terminal/hangar wall. Stop with local damage. The hangar
   doorway is open; the walls, back and roof are solid. A fast hit crashes.
2. In dev flight, use flight.debugDamage('engineL',0.5) for smoke, then .2 for fire. Judge the
   warning sound and lower engine note. Pause, switch camera/aircraft, inspect both planes.
3. flight.debugDamage('wingL',0) removes that wing. On the 737 its engine goes with it. This is
   severe damage; do this at altitude, then use crash/respawn or repair at the Hangar.
4. Crash either aircraft. Choose a different eligible airport with Enter or pad A/Start. Same
   aircraft, fully repaired, stopped at its chosen hangar apron. Try a short runway/heliport in
   the 737: it must show why it is unavailable. Test Esc/B choices and Back to title.
5. Repair and switching/reload persistence; full-health F-22 comparison; normal and firm 737
   landing. All preexisting headless landing checks still pass.

Known scope limits are the approved ones: no procedural city/track/tree collision, physical
debris, spreading fire, structural g/speed damage, repair economy, weapons or helicopter.
No new milestone was started. Commit/push only when the user asks in words, Codex_test only.

### 10q. Cockpit, instruments and trip planning revision, plan awaiting approval

Codex_test, 2026-10-21. User reported speed brakes require holding, 737 nose does not look
right, cockpit visibility/instruments need improvement, and requested aircraft-themed retro
speed/altitude gauges across cameras, terrain minimap and map trip planning.

Read current FlightInput/Input, FlightHud/Radar, MapScreen/MapData, 737 builder, cockpit
builder, camera, telemetry integration and project instructions. Existing corner display is
landmark radar, not terrain map. Cockpit has animated horizon/levers but mostly decorative
screen geometry. Nose and cockpit shell share one loft-derived skin.

Asked three scope questions. Answers: authentic instrument styles with retro treatment;
multiple waypoints; user chooses guidance or route AP by cycling AP during flight. Proposed
Off -> Hold -> Route -> Off, skip Route if invalid. Plan covers three batches with user test
stops: A toggle/nose/visibility; B profiles/shared telemetry/working panels; C terrain minimap,
waypoint editing/storage and lateral Route AP. Route holds selected altitude/speed; no auto
landing or terrain avoidance. Planning origin does not teleport. Trip persists, AP does not
silently re-engage. Keyboard/pad flow must remain complete.

Full plan, decisions, expected file tree, validation and source links saved in
FLIGHT_COCKPIT_NAV_PLAN.md. Await explicit plan approval before gameplay edits. No new
packages, commits, pushes or servers started/stopped in this planning turn. Existing M5
working tree preserved; baseline caveat in 10p remains. No M6 or helicopter work.

Research: Boeing NG overview and NG image listing; Commons 737-800 cockpit, JAL nose close-up
and Gol front view, USAF F-22 simulator HUD article. Boeing image direct page returned 403;
Boeing historical PDF link returned 404. Do not confuse MAX or museum early-737 photos with
737-800 NG. Source photos are references only; no texture/assets/network calls in game.

### 10r. Cockpit/navigation revision, batch A built, waiting on user test

Codex_test, 2026-10-21. User approved the plan in 10q with "continue with the plan".
Delivered A only, with the planned test stop before B and C. The earlier milestone 5 work
is preserved uncommitted. No packages installed, no commits/pushes, no other branch touched.

**Behavior and code.**
- FlightInput.js emits a one-shot airbrake action on V and unmodified standard-pad B. Holding
  or key repeat cannot repeat it. Back+B remains mute; releasing Back before B cannot
  accidentally toggle. Suspended pad polling updates the held-button history.
- FlightGame.airbrakeLever is independent of transient input state, copied into the fixed-step
  command. Pause and camera changes preserve it. _place clears it for new flight, hangar,
  teleport, reset and respawn; switching aircraft clears it too. Existing physical deployment
  times (F-22 1.2 seconds, 737 1.6), drag/lift behavior and automatic ground spoilers unchanged.
  The HUD shows actual physical surface travel; note confirms lever deployment/retraction.
- FlightScreens controls card says toggle, not hold, and no longer falsely says airport
  buildings are not solid. HANDOFF controls table updated. No car input changes.
- New render/aircraft/b737Nose.js owns the shared lower nose and upper deck geometry, sill,
  brow, roof and three framed panes per side. External shell has actual window holes, not
  glass laid over an opaque tapered tube. Rounded lower nose and fuller upper forehead,
  swept windscreen, narrower seals/centre post. Model remains a procedural interpretation
  of photographs, not a measured CAD replica. Keep overall dimensions and physics/proxies.
- b737.js retains the aft Loft, attaches separate lower/deck/glass/frame meshes, uses existing
  cached materials/liveries and disposes every geometry. Livery strips stop at the cabin join
  behind the flight deck; passenger windows stay behind it. Rear/front stripe sampling clamps
  harmless floating-point endpoint overrun to the Loft, rather than dereference a null section.
- cockpits.js uses identical shell vertices with BackSide interior material. Separate normal
  offsets initially opened fine cracks at the brow/roof junction, so do not reintroduce them.
  No opaque inside glass and no front cap across the view. Floor tapers below panel, rear
  bulkhead meets cabin at z=12.6, overhead fits the reshaped roof. F-22 interior untouched.
- B737 cockpitEye and cockpitView.eye both [0.55,1.04,14.1], captain's left seat. It was .82
  high inside and on the right outside before. New eye clears the existing glareshield while
  staying inside the glass. Panel gauges remain the old decorative ones for this batch;
  working/authentic instruments are B, and route/AP cycle and terrain minimap are C.

**References actually opened and inspected.**
- Kentaro Iemoto JAL 737-800 nose side close-up:
  https://commons.wikimedia.org/wiki/File:JAL_B737-800(JA304J)_(5001639172).jpg
- Cory W. Watts Miami Air 737-800 flight deck:
  https://commons.wikimedia.org/wiki/File:The_Flight_Deck_of_the_Boeing_737-800._(2956276002).jpg
- Commons page in the browser returned 429; direct thumb.wikimedia.org images worked. The
  Boeing airport PDF URL researched returned 404. These are reference images, no downloaded
  assets or runtime texture/network feature. Windshield height was reduced after first render
  comparison, preserving more white forehead above it. User still judges appearance/feel.

**Final checks.**
- All nine car commands PASS (check, lap, timing, parts, ai, race, fx, specs, drag).
- npm run world PASS; production build PASS, only existing 800 kB advisory.
- npm run flight: 387 PASS, six FAIL, exactly the existing F-22 physics goldens from 10o/10p:
  takeoff 66ea10a7 vs recorded 3f2cfbfe; scripted 9c751de9 vs 09bf0cef;
  manoeuvre 7dccc763 vs 4ee079ce; landing 5bc89393 vs 0245d3c6;
  taxi 7bc6611f vs c28ddd66; parked d7f0a697 vs dc711af3.
  Unmodified pristine 8559a6a comparison (damage-identity.mjs /tmp/blocky-m5-baseline) matches
  all six physics hashes and all three F-22 mesh hashes exactly. No golden edits. Do not say
  npm run flight is clean. Logs /tmp/cockpit-a-{flight,world,identity,build}.log.
- New flight/input.mjs adds 11 real input-edge checks (keyboard, repeat, pad, modifier order,
  suspension). New flight/cockpit.mjs adds six geometry/bounds/raycast visibility checks from
  actual pilot eye (straight, above, runway below, side) and same-eye camera agreement.
  Both registered in check-flight.mjs. These raycasts are test-only, no runtime ground raycast.
- New flight/cockpit-a-browser.mjs: 19 checks PASS, clean console, both aircraft. Actual CDP
  V events; gamepad simulated through navigator.getGamepads. Pause/resume, camera, deployment,
  retraction, held edges, Back+B sound mute, starts/switching and crash respawn. Simulated pad
  verification is not physical-controller acceptance. /tmp/cockpit-a-browser.log.
- That script captures 13 final PNGs in /tmp/look-cockpit-a-final: exterior front/side/three
  quarter and forward/left/right/down-panel/First person on runway and in air. Eight before
  pictures in /tmp/look-cockpit-a-before; first iteration in /tmp/look-cockpit-a-first.
- npm run look extended with 737 look left/right/down-panel: PASS, clean console, 38 pictures
  in /tmp/look-cockpit-a-suite. Spoiler fixtures now use airbrakeLever instead of transient
  input.state.airbrake, which FlightGame intentionally overwrites each fixed step.
- npm run look-world extended with 737 Cockpit approach forward/left/right: PASS, clean
  console, 49 pictures in /tmp/look-cockpit-a-world. Rebase comparison within same-frame noise,
  existing terminal slow contact still survives. Logs /tmp/cockpit-a-look{,-world}.log.
- All final picture sets inspected on labeled contact sheets; nose, forward cockpit, side
  cockpit, downward panel and approach also inspected full size. Corrected the downward
  fixture: existing FlightCamera look.y is negative for looking down. Initial positive sign
  photographed the roof. Existing mouse/pad look semantics unchanged in this geometry batch.
- Initial browser deployment assertion stepped only one second, short of existing deployment
  time, so correctly saw 0.8333. Fixed the harness to step two seconds, not physics. External
  camera fixture initially imported a second Three module and emitted its duplicate-instance
  warning; replaced with vector clones from scene camera. Final run has no warning. External
  fixture must call scene.frame after moving camera so the sky follows and shadows settle.
- git diff --check clean. Runtime physics did not change for A. No new performance guarantee;
  B must measure its actual working panels. No claims of instruments/navigation delivered yet.

**Test in this order.**
1. Fly the F-22: tap V, release, check it stays applied; tap again to retract. Repeat in 737.
   Try controller B, and verify Back+B still mutes without changing speed brakes.
2. Leave deployed while switching camera and pausing/resuming. It stays deployed. New flight,
   reset/respawn and aircraft switch start retracted. The 737 can still automatically deploy
   ground spoilers at idle with wheel weight, even with the manual lever retracted.
3. Inspect the 737 front, side and three-quarter shape in the Hangar/orbit. Judge proportions
   against the linked photo. Tell us if the nose is too pointed/blunt or forehead too high.
4. Cycle C to Cockpit, taxi/take off and approach Meridian. Check runway and horizon visible,
   look left/right/down, panel/glareshield and window posts do not obstruct the normal forward
   view. Compare First person at the same captain's eye.
5. Send notes before B. Instruments remain decorative until B, map/Route AP stay unchanged
   until C. Do not start another batch or milestone until the user asks.

Own Vite test server was on 5185, stopped at session end. Never touched 5173/5174. Isolated
Chrome profiles were closed by their scripts; no tests touched the user's saved game/profile.

### 10s. User accepts A and adds exterior/Hangar work to the plan

Codex_test, 2026-10-21. User says everything looks good, then adds:
1. Update remaining 737 model, especially inaccurate engines; remove random object on rudder.
2. Teleport to Hangar, fix inability to get back into it after leaving. Replace automatic
   stopped dwell with an explicit Enter Hangar button. Offer teleport to runway on exit.
   Normal departure turns aircraft around so the pilot is ready to taxi.

Planning only, no gameplay edits. Updated FLIGHT_COCKPIT_NAV_PLAN.md with a new A2 before
B/C, marked A accepted. Await approval before A2 implementation; preserve M5/accepted A.
No tests run for this docs-only revision; prior 10r results remain the implementation baseline.

Findings from code:
- FlightPlaces.update sets armed=false on automatic entry, and only arms on leaving the bay.
  Same-aircraft Hangar close from play resumes without leaving/rearming. This is the clear
  cause of the reported re-entry lockout; explicit button availability should replace the
  timer/latch, not just call rearm and cause immediate forced reopening.
- MapScreen/FlightPlaces teleport modes currently apron/runway/air; Airports.start already
  has a hangar pose facing the door. Add the missing Map mode and a deliberate Enter button,
  not automatic menu opening after teleport. R hold remains last-airport Hangar shortcut.
- Existing hangar start offset is fixed at 16 m, while a 737 is long. Use aircraft size and
  airport layout for safe outward departure, with clear hull/tail/wing footprint, not a blind
  rotation that places its tail inside the now-solid hangar. Runway exit uses existing
  eligible runway start; idle throttle, AP off, no automatic acceleration.
- Current 737 nacelle is a capped Loft with circular dark disk and flat fan bars placed almost
  on its front face. A2 needs lip/recess, correct silhouette, blades/spinner/exhaust/pylon.
- Tail ring/disc insignia is positioned at z=-16.4, y=FIN.root+5.2, near the leading edge of
  the swept fin; the raised badge can extend outside the fin. Likely random object described.
  Confirm rendered object while implementing; remove raised/floating ornament while retaining
  real fin/rudder and rudder animation. No screenshot requested because code identifies a
  plausible cause and it can be checked in the existing local renderer.

Recommended flow is detailed in plan. Button available only grounded/nearly stopped/low
throttle/not wrecked. Click/Enter/contextual pad A, consuming A to avoid afterburner. Can
re-enter immediately after normal exit when conditions hold. Two departure actions: Leave
hangar (outward apron), Teleport to runway. Resolve pending Save/Discard explicitly, preserve
immediate Repair persistence. Menu-only preview returns to Fly normally; explicit departure
moves aircraft. Both aircraft, mouse/keys/pad, repeated visit regression checks, eligibility,
switching/repair/damage/respawn and collision clearance required. Keep aerodynamic model,
accepted nose and cockpit, dimensions and normal animations unchanged.

Online primary references identify 737-800 engine as CFM56-7B:
https://www.boeing.com/commercial/737ng
https://www.cfmaeroengines.com/cfm56/CFM56-5B-CFM56-7B
Use NG installation photographs at implementation, not MAX LEAP styling. No packages,
servers, commits or pushes this turn. All changes remain local on Codex_test.


### 10t. Approved A2: 737 engines/tail and explicit Hangar visits

Codex_test, 2026-10-21. User approved the addition in 10s with "exicute the plan", then
"continue" after an interrupted turn. A2 only. Stop for their test before B (working retro
aircraft instruments) and C (terrain minimap, multi-waypoint planner, Off/Hold/Route AP).
M5 and accepted A remain in the same uncommitted working tree. No packages, textures,
external runtime assets, commits, pushes, merges or other branch changes.

**Built.**
- src/render/aircraft/cfm56.js is a procedural open 737NG nacelle: rounded metallic lip,
  flattened lower cowl, recessed swept fan/spinner, core exhaust and plug, rear annular
  closure and a short wing pylon. Twenty-four fan blades share one mesh per engine, rotate
  with the existing spool value, and remain within the engine's damage ownership. b737.js
  owns/disposes helper geometry, retains livery bands and accepted nose/cockpit. No thrust,
  mass, aero or control tuning changes. Audited wing/pylon/gear/tail attachments in pictures.
- Removed the solid torus/disc tail badge. All insignia now use thin planar shapes on the
  fixed fin, smaller and positioned clear of its leading edge and moving rudder. Ring is a
  RingGeometry paint marking, not a solid ornament. Fin, rudder and elevator animation stay.
- FlightPlaces.availableHangar replaces dwell/armed latch. Grounded (including resting on
  hull with broken gear), nearly stopped, low throttle, compatible airport and not crashed.
  HANGAR.entryReach 24 m includes reset/teleport point; clearance 4 m bounds turn placement.
  Airport arrival/last-airport bookkeeping stays independent. No automatic menu opening.
- FlightGame creates an independent Enter hangar button (still visible with U HUD hidden),
  revalidates click/Enter/contextual pad A, captures the actual airport/bay, and removes old
  dwell HUD progress/hints. R hold still teleports to the last airport's mouth.
- MapScreen/FlightPlaces include stored Hangar teleport mode, airport eligibility retained.
  Teleport lands at mouth, then offers entry. Planning/navigation behavior remains for C.
- Airports.start accepts optional aircraft/zone/outward placement, using size and actual
  hangar wall location. Normal departure is stationary in that same bay, heading 180 degrees
  from the entry pose. Runway departure uses the existing selected-airport start and heading.
  Throttle zero, AP off. Ordinary visits preserve survivor damage and fuel; repairs remain
  explicit and immediately persisted. Existing teleport/respawn rules remain separate.
- Hangar physical visits offer Leave hangar and Teleport to runway. Pending paint/load/tune
  edits or aircraft selection require Save/Discard/Keep editing before that departure.
  Esc/B requests normal departure or cancels that confirmation. Preview from Fly menu keeps
  original Save aircraft/Discard return flow. Aircraft switch rechecks runway eligibility;
  fallback nearest eligible airport now uses the old aircraft's location, not new default 0,0.
- FlightInput tracks contextual/menu/Back+A usage until A is released. FlightGame polls
  suspended controls before menu callbacks can resume flight, preventing a held confirmation
  from engaging afterburner or re-entering. No car input edits. Controller tests are synthetic,
  not acceptance on a physical gamepad or flight stick.

**References actually inspected online, no image assets added.**
- Delta official 737-800 side photo: https://news.delta.com/media/image/48166
- Avio Aero official engine article/photo: https://www.avioaero.com/news/articles/the-salento-hub
  The close-up shows rounded inlet lip, fan recess, spinner/swept blades and flattened lower
  casing. Plan also records Boeing and CFM primary references. This is a procedural visual
  interpretation, not measured CAD fidelity. User judges final proportions and taxi feel.

**Final verification.**
- All nine car commands PASS: check, lap, timing, parts, ai, race, fx, specs, drag. World PASS.
- Production build PASS with existing 800 kB chunk advisory. Logs /tmp/a2-{name}.log.
- Flight: 404 PASS and six preexisting physics golden mismatches. Exact mismatches remain takeoff 66ea10a7 vs3f2cfbfe;
  scripted 9c751de9 vs09bf0cef; manoeuvre 7dccc763 vs4ee079ce; landing 5bc89393 vs0245d3c6;
  taxi 7bc6611f vsc28ddd66; parked d7f0a697 vsdc711af3. No golden edits. Same-runtime pristine
  8559a6a comparison via damage-identity.mjs /tmp/blocky-m5-baseline matches all six physics
  and three F-22 mesh hashes exactly. Do not claim npm run flight is clean.
- Headless hangar-flow.mjs covers both aircraft, every compatible airport/bay, repeated
  availability, 180-degree departure, conservative footprint clearance against shared
  building solids, movement/throttle/airborne/crash guards, broken gear, finite geometry,
  inlet recess, removed torus, broken wing's dependent engine/pylon. Registered in flight.
  Existing check-flight Places tests now assert explicit availability instead of old dwell.
- Input module adds contextual A, release latch and Enter checks. Browser hangar-browser.mjs
  exercises actual page, keyboard/mouse and synthetic standard pad in an isolated profile.
  Includes three visits per aircraft, Save/Discard/Keep editing, repair surviving Discard,
  fuel/damage, runway alignment, HUD off prompt, crash guards/replacement, second bay,
  aircraft switch/fallback, Map eligibility/stored mode, held Map A, preview return and fan
  animation and clear outward camera line. 57 checks PASS, console clean.
- FlightCamera external views use an obstruction callback; AirportCollisions.cameraFraction
  reuses the existing swept-box solver with separate scratch for one camera sphere, without
  changing aircraft collision/damage state. Clearance 1.5 m lives in FLIGHT_CAMERA. Both
  aircraft departure pictures now show the aircraft, not the Hangar roof. Three analytic
  heading/clear-sky tests added to structures.mjs; pilot cameras are unchanged.
- Accepted A cockpit/toggle browser checks: 19 PASS. M5 damage browser: 11 PASS; M5b
  effects/repair/respawn/audio browser: 29 PASS, all with clean consoles. Tests use isolated
  Chrome profiles, no changes to the user browser save.
- npm run look PASS: 41 pictures in /tmp/look-a2-suite. npm run look-world PASS: 51 pictures
  in /tmp/look-a2-world. Both extended with physical Hangar entry/departure fixtures and
  clean consoles. Rebase: 601 changed pixels against baseline 621, inside tolerance; slow
  terminal contact still survives with fuselage health 0.701779210791603.
- All final PNG sets inspected on labeled contact sheets: suite 41, world 51, A2 close-ups/
  visits/map 15, accepted cockpit views 13, damage 12. New engine front/side/rear, tail,
  Save/Discard, map Hangar mode and outward chase view also inspected full size. Accepted
  cockpit forward/side/panel visibility preserved. No physical-controller or interactive
  taxi-feel acceptance claimed. User still tests those.
- Final git diff --check clean; no forbidden Unicode dash characters added. package.json,
  package-lock.json and car Input.js unchanged. No new dependencies or runtime assets.
- Only our Vite test server on 5185 was used; stopped after verification. User ports
  5173/5174 were not stopped. Chrome profiles belong to the scripts and were closed.
- Reproduce: npm run flight/world/build and all nine car commands, then
  node scripts/flight/hangar-browser.mjs http://localhost:5185 /tmp/look-a2-hangar;
  node scripts/flight/cockpit-a-browser.mjs http://localhost:5185 /tmp/look-a2-cockpit;
  node scripts/flight/damage-browser.mjs http://localhost:5185;
  node scripts/flight/damage-b-browser.mjs http://localhost:5185 /tmp/look-a2-damage;
  npm run look -- /tmp/look-a2-suite http://localhost:5185;
  npm run look-world -- /tmp/look-a2-world http://localhost:5185.
  Start an isolated Vite server on 5185 first, never stop the user's servers.

**What bit this implementation.**
- An initial test used await import at script expression top level in CDP; changed to async
  IIFE. It was a harness syntax error, not a game failure.
- Fan blades overlapped and were too dark at first; separated and batched them. Pylon initially
  protruded above the wing; lowered it to meet underside. Rear annulus faced inward and let
  the scene show through the back; reversed profile winding. Final close-ups checked again.
- Flat ring initially sat inside the fin bevel and straddled the rudder; moved planar paint
  to fixed fin face with actual extrusion/bevel offset. No raised badge.
- Outward 737 departure revealed the long chase camera inside/behind the Hangar roof,
  obscuring the aircraft despite safe hull placement. A render-only obstruction guard is
  verified using existing airport collision boxes; no aircraft move or forced view change.
  This is render-only and leaves the camera's desired distance intact, so it returns as
  space clears. No raycasts, no frame-rate guarantee inferred from headless screenshots.

**User test order.**
1. Inspect 737 engine front/side/rear and tail in Hangar/orbit, compare the linked references.
2. M map, pick compatible airport, At the hangar, Teleport. Confirm it waits for entry; click
   Enter hangar or press Enter. U hides flight HUD but leaves the entry button usable.
3. Leave hangar, confirm nose faces out and aircraft is stopped, clear and visible. Taxi,
   then stop and re-enter; repeat three visits in both aircraft. Try contextual pad A.
4. Change paint/load/tune, select departure, try Keep editing, then Save or Discard. Repair
   damaged parts and discard a cosmetic edit; repair stays. No free survivor repair/refuel.
5. Try Teleport to runway, check selected airport/runway alignment and idle throttle. Switch
   F-22 to 737 from a short field, confirm explained move to a compatible airport.
6. Send notes before B/C. Existing V/pad B toggles remain, Hold AP only until C. Helicopter
   and milestone 6 stay unstarted.


### 10u. Cockpit/navigation revision batch B: working aircraft instruments

Codex_test, 2026-10-22. The user asked "continue with the next step of this part" after
A2. This authorizes the next batch B in FLIGHT_COCKPIT_NAV_PLAN.md, not milestone 6.
Built B only, preserving M5, accepted A and A2 in the same local uncommitted tree.
Stop for user readability/visibility feedback before C. No new packages, external assets,
textures, runtime network calls, commits, pushes, merges or other branch changes.

**Architecture and files.**
- data/aircraft.js selects instrumentProfile '737ng' or 'raptor'. New
  data/flightInstruments.js owns profiles, palettes, display mount/layout data and shared
  speed/altitude scale rules. Each profile identifies its intended display family. Unknown
  IDs use a safe generic glass profile. This is a data extension point for future aircraft;
  it does not invent an authentic design for an unknown model automatically.
- flight/FlightTelemetry.js creates and updates one read-only render snapshot. SI physics
  fields, converted CAS/TAS, Mach, MSL altitude, AGL, climb, pitch/bank/heading, flight path
  from alpha/beta, AoA/G, throttle, fuel, AB reserve/lock, gear/flaps/speedbrake, wheel brake,
  steering/park, AP selected targets/mode, per-part health/severity and nearest airport.
  Engine values are actual Engine.n*100, fuelFlow*3600 kg/h and thrust/1000 kN. Label Spool
  instead of N1: n is the simulation's relative spool, with zero at idle. No invented EGT,
  oil pressure, temperature, magnetic variation, ILS, radio or combat values.
- FlightGame samples before scene rendering even with U off, then gives that same snapshot
  to physical panels and FlightHud. Health, warning priority and units have one source.
  No control commands or aircraft physics changes. Navigation markers are absolute world
  coordinates, so origin rebasing cannot move instruments relative to their map information.
- flight/InstrumentDrawing.js owns renderer-neutral vector strokes, clipped attitude/pitch
  ladder, moving speed/altitude tapes, heading-up landmark display, engine arcs, systems,
  standby, mode control and F-22 HUD. Its small procedural glyph table is compiled into
  horizontal runs once, no bitmap/texture assets. Canvas and cockpit use the same strokes.
- render/aircraft/FlightInstruments.js emits one bounded vertex-colour triangle batch per
  physical display. Rect/line fast paths avoid per-glyph array allocation; polygon winding
  accepts both directions and always faces the seated pilot. Materials.instrumentInk is
  the shared unlit vertex-colour material, with no textures. Geometry is disposed by the
  existing interior ownership traversal. No persistent callbacks or per-panel timers.
- FLIGHT_INSTRUMENTS in tuning.js: refreshHz 30, maxVertices 24000 per surface, navRange
  20000 m, hudPitchSpan 40 degrees, each with comment/range. Display budgets only, not
  fixed-step simulation. Peak headless surface 10962 vertices; ordinary whole cockpit about
  33750 F-22 / 41136 737 vertices. Positions/colours capacity about 4.03 / 4.61 MB respectively.
- cockpits.js mounts actual displays on modelled panels, replaces decorative gauge shapes,
  preserves mechanical controls and shell/windows. 737: captain/FO PFD and ND pairs, upper
  engine screen, closer lower centre systems display, standby flight readout, working MCP
  targets. Lowered yokes, angled panel toward pilot, shortened pedestal so it cannot cover
  warning/health rows; gear knob kept outside lower screen. MCP clears the glareshield.
- F-22: green working HUD, primary flight/navigation/engine screens, lower systems screen
  and two up-front control/status displays. Side stick and lower consoles clear the displays.
  The exterior fuselage is a continuous loft, with no cockpit recess: it hid the lower
  systems panel. AircraftBuilder now exposes that unchanged mesh as cockpitShell; Aircraft
  excludes just that shell from the close overlay pass in Cockpit, retaining it in the
  world pass. Interior draws in the cleared-depth overlay. Other views and repaint restore
  original layers. F-22 exterior geometry/materials and all three mesh hashes unchanged.
- ui/FlightInstrumentDraw.js is the external Canvas2D adapter. FlightHud uses the profile's
  primary/navigation/engine/systems displays in Chase/orbit; F-22 First person uses green HUD
  symbology. Physical Cockpit hides floating gauges and warning duplicates. U only hides the
  screen overlay, not the physical panels. Service notes, reset progress, camera and location
  labels remain separate. Canvas aria labels and a text health mirror expose actual values.
  Existing radar object is retained as a hidden landmark registry until C; no duplicate disc.
- No terrain minimap, trip planner or Route AP yet. Navigation panels currently show compass,
  airport/runway/track markers, range and nearest airport distance/bearing/eligibility. P and
  D-pad Down still toggle existing Hold. AP targets use chosen display units and true heading.

**Future aircraft/profile contract.**
Choose/add a profile in data/flightInstruments.js and reference its key in the aircraft data.
Panel specs declare id/type/parent, body-mount position, physical size and logical vector
view size. A cockpit builder passes named parent groups to createInstrumentSet and returns
that set as interior.instruments. finish(group) applies layer 1. Interior.dispose owns all
child geometry; shared Materials.js materials are not disposed by each panel. Generic
fallback provides working primary/nav/systems on the placeholder interior. Add real model
instrument styling explicitly when that aircraft is implemented, including the helicopter
if the user brings it back. Do not add sensors the simulation does not have.

**References researched this batch.**
- Boeing NG design overview: https://www.boeing.com/Commercial/737ng/737-next-generation-design-highlights
- Boeing NG display image listing: https://secure.boeingimages.com/archive/The-Boeing-737-Next-Generation-Flight-Deck-2F3XC5KE3X4.html
  Search-index description confirmed LCD flight deck; direct page returned 403. Prior A
  flight deck/nose photos remain in 10r and the plan. No reference images shipped as assets.
- USAF F-22 simulator/photo: https://www.af.mil/News/Article-Display/Article/134990/sheppard-airmen-check-out-raptor-simulator/
- USAF side-stick explanation explicitly names the F-22:
  https://www.aftc.af.mil/About-Us/History/On-This-Day-in-Test-History/Article-Display-Test-History/Article/2272288/august-11-1956-f-102-side-stick-testing/
These are recognizable instrument-family interpretations of the simulated systems, not
full avionics replicas. Keep the user's aircraft-authentic with retro styling decision.

**Verification complete.**
- All nine car commands PASS, npm run world PASS, production build PASS with existing
  800 kB advisory. Logs /tmp/b-{check,lap,timing,parts,ai,race,fx,specs,drag,world,build}.log.
- npm run flight: 422 PASS, six preexisting recorded Mac physics golden mismatches:
  takeoff 66ea10a7 vs3f2cfbfe; scripted 9c751de9 vs09bf0cef; manoeuvre 7dccc763 vs4ee079ce;
  landing 5bc89393 vs0245d3c6; taxi 7bc6611f vsc28ddd66; parked d7f0a697 vsdc711af3.
  Unmodified 8559a6a same-runtime comparison matches all six physics and three F-22 mesh
  hashes exactly, /tmp/b-identity.log. No golden changes. Do not claim flight suite clean.
- New flight/instruments.mjs registered in check-flight: 18 checks for heading wrap, unit/AP
  conversions, non-mutating snapshot, actual engine values, warning priority, finite/facing
  geometry under extreme pitch/bank, budget/no textures/layers, GPU disposal, generic future
  fallback and shell layer restoration. Physical matrices/strokes tested, no test-only
  raycasts introduced to runtime. Existing nose visibility ray tests still pass.
- New instruments-browser.mjs: 31 checks PASS, console clean, both aircraft. Keyboard U,
  actual movement of physical vertex buffers, no Cockpit overlay duplicates, three unit
  systems, profile themes, First person, AP targets, damage, bank/pitch, origin rebase,
  respawn, repeated switch/disposal, reload and 1280x720 non-overlapping external layout.
  27 final PNGs in /tmp/look-b-final, all inspected on labeled contact sheets. Both seated
  forward views, 737 mode-control/lower systems and F-22 HUD also inspected full size.
- Existing A2 Hangar checks: 57 PASS. Accepted A cockpit/toggle: 19 PASS. M5 damage persistence:
  11 PASS. M5b effects/audio/repair/respawn: 29 PASS, clean console, 12 PNGs in
  /tmp/look-b-damage. Isolated Chrome saves only; physical gamepad feel remains untested.
- Extended npm run look PASS: 45 PNGs in /tmp/look-b-suite. npm run look-world PASS:
  53 PNGs in /tmp/look-b-world. Console clean. Rebase difference 608 pixels versus baseline
  624, within tolerance; slow airport wall contact survives with fuselage health
  0.701779210791603. Final production build rerun after the last CSS change, PASS.
- All 27 specialist, 45 look, 53 look-world and 40 combined A/A2/M5b regression pictures
  inspected on ten labeled contact sheets. Checked panel clearance, bank/pitch, units,
  night contrast, damage/repair/respawn, exterior views, Hangar departures and small HUD.
  git diff --check clean. Controls reread from both Input.js and FlightInput.js.
- Stopped only this batch's Vite server on 5185 (session 95012); port confirmed clear.
  User dev servers on 5173/5174 were left alone. Implementation and memory files remain
  local and uncommitted on Codex_test; nothing was pushed. No package or lockfile changes.

**Measured performance, real local Apple M5 GPU, 1920x1080, Medium.**
New instruments-performance.mjs uses isolated Chrome, four seconds warm-up, eight seconds
measurement each case (481 frames), live physics and actual renderer. ANGLE Metal Renderer:
Apple M5. Does not certify other graphics levels or interactive controller feel.

| Aircraft/view | Frame median/p95 ms | Render CPU median/p95 ms | Physical batch median/p95 ms |
|---|---|---|---|
| F-22 Chase | 16.7 / 16.8 | 2.3 / 3.6 | 0.3 / 0.6 |
| F-22 Cockpit | 16.7 / 16.7 | 3.4 / 4.4 | 0.4 / 0.5 |
| 737 Chase | 16.7 / 16.7 | 2.5 / 3.5 | 0.5 / 0.7 |
| 737 Cockpit | 16.7 / 16.7 | 3.3 / 4.5 | 0.5 / 0.7 |

Physical batch timing forces CPU rebuild 100 times, independent of the frame timing samples;
actual refresh is capped to 30 Hz. Frame results are consistent with 60 fps in these captures,
not a blanket guarantee for all locations/graphics settings. Console clean, neither aircraft
crashed. /tmp/b-performance.log. Later cosmetic panel/console clearance adjustments keep the
same batches and capacity. Do not compare these numbers to simultaneous GPU screenshot runs.

**What bit this batch.**
- Prototype lines/arcs vanished because line quads and rectangles had opposite winding.
  Batched polygon adapter now normalizes winding; headless facing checks protect it.
- Enlarged 737 primary screens exposed old yoke overlap. Lowered wheel without changing
  animation or control physics. Lower systems display needed a closer/larger mount, proper
  panel angle, and a shorter pedestal so neither nav labels nor the warning row is covered.
- F-22 lower display was underneath the unchanged external loft; fixed close overlay layer
  ownership rather than altering exterior vertices or hiding wings. Pilot views are still
  separate, and switching/repainting must preserve the shell-layer restoration.
- Engine n is not real N1. Retain Spool naming and actual kg/h/kN. Do not invent EGT/oil
  or pressure readings to make the real layout appear busier.
- Resetting camera mode alone does not reset FlightInput.look. Test fixtures must explicitly
  clear look before each aircraft/forward shot, otherwise a previous look-down contaminates it.
- Git fetch initially hit restricted .git/FETCH_HEAD, then succeeded through the approved
  escalation. No checkout/pull over the dirty implementation tree. Codex_test still 8559a6a.

**User test order.**
1. 737, cycle C to Cockpit. Start on runway, look forward then down with held right mouse
   (middle in mouse-flight, pad hold R3/right stick). Check speed/altitude and text readability,
   window/runway view, yoke clearance, lower systems and mode-control targets.
2. Take off; check tapes, horizon/flight path, climb, heading, fuel and separate engine spools.
   Turn/bank and change throttle/flaps/spoilers/brakes/gear. Confirm numbers move with systems.
3. P engages Hold in eligible flight; adjust arrows/W/S and check displayed targets. Switch
   units from pause and compare Cockpit, First person and Chase. U hides overlay while
   physical displays continue. Try night setting to judge contrast.
4. F-22 repeat, inspect green HUD and six panels, look down at lower health/systems display.
   Inspect alerts/part health after damage, repair/respawn, and aircraft switches. Check that
   old warning/AP states do not survive a replacement. Existing Hangar flow remains usable.
5. Send readability/visibility/style/performance notes before C. Terrain minimap, waypoint
   planning and Route autopilot remain approved but unstarted until the next requested batch.

### 10v. B user-test corrections: HUD fit, panel containment, lower views and power response

Codex_test, 2026-10-22. User supplied two cockpit screenshots and asked for:
1. F-22 HUD glass/frame large enough to contain every number/symbol.
2. 737 instrument housing contained within the nose and access to the lower panels; their
   screenshots were the lowest view they could reach during play.
3. Quicker acceleration for both aircraft and about 80% less first-person afterburner/Mach-1
   shaking, which they described as nearly unplayable.
4. Add the F-22 exterior/body remodel and less arcade, more realistic sound to Part C.

The first three are this B follow-up. C's navigation scope is preserved and expanded in
FLIGHT_COCKPIT_NAV_PLAN.md. Do not implement C during this retest, and do not start combat
or helicopter work. No commits/pushes or package changes. All earlier local work preserved.

**Built and why.**
- F-22 HUD glass, four frame bars and vector surface now share one tilted parent transform.
  Previously separate transforms left the symbols/frame at different slopes. Enlarged
  glass .26 x .19 -> .34 x .26 m, enlarged symbols .255 x .18 -> .28 x .20 m, retaining a
  physical border on every side. Instrument stroke data and long-number tests fit on glass.
  Files: render/aircraft/cockpits.js and data/flightInstruments.js.
- 737 main instrument assembly moved aft .32 m. Shortened glareshield depth .60 -> .40 m
  and moved it aft .42 m, leaving its corners inside the actual nose. Moved lower systems
  and pedestal aft with the main panel so neither is buried. Standby unit moved left and
  narrowed to clear the yoke, without changing the yoke animation or control authority.
  Named main-panel, lower-bulkhead, glareshield and MCP housings for containment diagnostics.
- FlightInput vertical free look had reversed signs: dragging the mouse down or right
  stick down looked UP. Both now look down. The mouse-flight branch used to intercept
  middle-button movement before the look branch, so middle look did not work at all.
  Look now takes priority while held, leaving the virtual stick unchanged. Existing
  1.4-radian limits and return spring retained. No new controls or pointer-lock behavior.
  Pause controls explicitly say drag down for lower panels. Actual CDP mouse input tested.
- tuning.js FLIGHT_CAMERA eyeShakeScale and eyeKickScale are .2 (ranges 0-1): First person
  AND Cockpit get 80% less positional shake and Mach-crossing FOV punch. This scales the
  existing combined effect, including stall tremor. Chase/orbit keep their amplitude.
  World and overlay still use exactly the same camera transform. No flight dynamics change
  from camera scaling. Files: tuning.js and render/FlightCamera.js.
- Faster power is a response tune, not fictitious engine ratings: FLIGHT.throttleRate
  .35 -> .65 fraction/s; b737 override .18 -> .35. New engineSpoolUpScale .55 and
  engineAbUpScale .65 multiply existing engine time constants once in AircraftPhysics's
  constructor. Actual data/aircraft.js rated thrust, drag curves, mass and top-end power
  unchanged. Runtime Engine fuel/thrust/damage behavior unchanged. Shortens arrival of
  power, not sustained acceleration once engines have settled. No allocation in step().
- First 737 landing regression failed (field lengths about 1842 to 1883 m against 1600 m
  plus 10% tolerance): faster manual lever had doubled the AP speed-loop authority. Reduced
  AUTOPILOT.b737.kSpdA .5 -> .26 to preserve lever authority. Final four-airport landings
  pass at 1642 to 1648 m, touch down 386 to 388 m with 1.5 to 1.6 m/s sink. No weakened
  acceptance limits, no landing pilot or braking changes. Existing Hold checks pass.

**Measured power response, same 120 Hz simulation.**
3000 m altitude, 50% fuel, gear up, idle initial engines; hold W from time zero, F-22 also
holds afterburner. F-22 begins 150 m/s, 737 begins 100 m/s. Same altitude-hold pilot in both
before/after, 1200 steps. Values are in-game response measurements, not real-aircraft claims.

| Aircraft | Old 10-second speed gain | New gain | Improvement |
|---|---|---|---|
| F-22 | 58.82 m/s | 67.60 m/s | about 15% |
| 737 | 13.87 m/s | 17.60 m/s | about 27% |

F-22 final altitude 3017.3 vs 3017.5 m, 737 2910.2 vs 2899.2 m. New results do not come
from diving lower. For more sustained acceleration after spool-up, discuss a separate
explicit thrust/drag tune using traces; do not claim this response pass raises steady thrust.

**Verification.**
- All nine car suites PASS, world PASS, production build PASS (old 800 kB advisory).
  Logs /tmp/b-feedback-{check,lap,timing,parts,ai,race,fx,specs,drag,world,build}.log.
- Full flight: 434 PASS, six retained recorded F-22 physics golden failures. IMPORTANT:
  these are no longer unchanged results. The user explicitly asked for quicker acceleration,
  and the response tune intentionally changes all six normal hashes. Goldens left untouched:

  | Scenario | Normal result now | Recorded golden |
  |---|---|---|
  | takeoff | 43755769 | 3f2cfbfe |
  | scripted | efc81f03 | 09bf0cef |
  | manoeuvre | 83f47016 | 4ee079ce |
  | landing | 487530f2 | 0245d3c6 |
  | taxi | 267e9520 | c28ddd66 |
  | parked | 3d160d7c | dc711af3 |

  All other flight checks, including published cruise/top speed, takeoff/landing, Hold,
  damage, input, frame-rate invariance and geometry pass. /tmp/b-feedback-flight-final.log.
- Existing damage-identity.mjs now accepts optional --legacy-response: temporarily restores
  ONLY throttleRate .35, engineSpoolUpScale 1 and engineAbUpScale 1 for the diagnostic,
  then restores the current knobs in finally. With this flag, all six pristine same-runtime
  physics and three F-22 mesh hashes match exactly. /tmp/b-feedback-identity.log.
  Command: node scripts/flight/damage-identity.mjs /tmp/blocky-m5-baseline --legacy-response.
  Without the flag the comparison correctly fails because acceleration is now different.
- New registered flight/cockpit-feedback.mjs: 12 headless checks PASS. Real shell ray
  containment for all 737 housing vertices, high-number/damage HUD strokes inside glass,
  mouse/mouse-flight/pad look, actual camera displacement/FOV scaling, external amplitude,
  before/after speed gains with altitude sanity guard. Existing 18 instrument checks pass.
- New cockpit-feedback-browser.mjs: 11 PASS, clean console, 20 PNGs in
  /tmp/look-cockpit-feedback, at 2048 x 1184 approximating the user's screenshots. Actual
  right and middle mouse events, lower views, release return, units/night/fast-high warning.
  Test sets mouseFlight directly to isolate the existing event path; it does not certify a
  physical flight stick or browser-specific pointer-lock permission behavior.
- Existing B browser suite: 31 PASS, clean console, 27 PNGs in /tmp/look-feedback-instruments.
  Camera/unit/U, AP targets, damage, reload, switch/disposal, rebasing and small HUD layout.
- Extended look PASS, clean console, 45 PNGs in /tmp/look-feedback-suite.
- Extended look-world PASS, clean console, 53 PNGs in /tmp/look-feedback-world. Rebase
  difference 572 pixels versus 593 frame-noise control, inside tolerance. Airport wall
  contact still survives with fuselage health 0.701779210791603. First attempt was interrupted
  by Vite HMR after editing a source file while the script was running, then a full rerun
  passed without edits. Keep source saves out of browser capture/performance runs.
- All 20 feedback, 27 instrument, 45 look and 53 world PNGs inspected on 12 labeled
  contact sheets. F-22 high-altitude warning HUD and corrected 737 lower/standby view also
  inspected full size. Pause hint text fits the control card in the final world pictures.
  User comfort/readability and physical controller feel still require their retest.
- Final Medium/1920 x 1080 capture, real Apple M5 Metal renderer, four seconds warm-up and
  eight seconds sampling per case: 480/481 frames each, all frame medians 16.7 ms; p95
  16.7 ms except 737 Chase 16.8 ms. Render CPU median/p95 ms: F-22 Chase 2.2/3.1,
  F-22 Cockpit 2.8/4.0, 737 Chase 2.4/3.1, 737 Cockpit 2.6/4.0. Physical batch CPU
  median/p95: .4/.7, .4/.6, .5/.7, .5/.6 respectively. Same buffer capacities, console
  clean, no crashes. /tmp/b-feedback-performance.log. Consistent with 60 fps in these
  samples, not a guarantee for every location, graphics setting or interactive input.
- Final build and git diff --check pass; additions/untracked source checked for forbidden
  dash characters. Controls reread from Input.js and FlightInput.js. No package/lockfile or
  car input edits. Only own test Vite on 5185 stopped; user 5173/5174 servers left alone.
  All work is local and uncommitted on Codex_test at 8559a6a, nothing pushed.

**References and C additions.**
Checked NASA excess-thrust explanation: acceleration depends on thrust minus drag and mass,
https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/excess-thrust-thrust-drag/ .
USAF fact sheet retains F-22's 35,000-pound-class engines, no new rating invented:
https://www.af.mil/About-Us/Fact-Sheets/Display/Article/104506/f-22-raptor/ .
Expanded C plan links USAF/Lockheed three-view and photographs for the F-22 body; NASA fan/
jet/core noise reference for aircraft-specific procedural audio and a NASA pilot interview
for Mach-1 viewpoint treatment. Those are references, no assets shipped. C now includes:
- Original terrain minimap, multiple waypoint planner and Off/Hold/Route AP.
- Reference-led F-22 fuselage/chines/canopy/wing junction/intake shoulders/aft body/tails/
  nozzle silhouette; preserve dimensions, animations, cockpit clearance and damage ownership.
- Separate 737 fan/rumble and F-22 turbine/exhaust voices, smoother real-spool response,
  wind/cockpit filtering, less repeating arcade pitch/pulse, retained warnings/mute/damage.
  No new packages or recordings. Actual listening and user feedback required for acceptance.

**Retest order before C.**
1. C to F-22 Cockpit. Check the larger HUD border at idle and high speed/altitude. Hold
   right mouse and drag DOWN to see the entire lower systems panel; hold R3 and move right
   stick down on a pad. T mouse-flight: hold middle button and drag down, check no steering.
2. Repeat in the 737: forward windshield view, look left/right/down, main/standby/lower
   systems, and MCP. Check the rectangle stays inside the nose. Release look to recenter.
3. From idle add W on each aircraft; F-22 add Shift. Judge quicker response. Check Hold
   targets/landing handling still feel appropriate. This improves power arrival, not full-
   spool steady thrust. Existing tune/payload/fuel selections still affect the aircraft.
4. F-22 First person and Cockpit with afterburner and through Mach 1: judge the remaining
   20% shake/kick. External camera deliberately keeps its effects. Sound is not revised yet.
5. Send visibility/response/comfort notes. Stop here, then start expanded C on the user's
   instruction. No commit or push unless explicitly asked in words.

### 10w. Part C transfer prompt for a new chat

Codex_test, 2026-10-22. User asked if Part C is already in the handoff and requested a
prompt for a new chat. Confirmed the expanded scope is recorded in 10v and the full
FLIGHT_COCKPIT_NAV_PLAN.md. Created FLIGHT_PART_C_PROMPT.md, a self-contained pasteable
prompt with the actual local checkout, branch, reading order, current state and boundaries.

Part C remains unstarted: shared terrain minimap and cockpit map, multiple-waypoint trip
planning/persistence, Off/Hold/Route autopilot, reference-led F-22 exterior and more realistic
aircraft-specific procedural sound. All decisions and verification details stay in the
plan and 10v. No B feel/readability acceptance was inferred from this transfer request.

Important carry-forward facts are in the prompt: preserve the large dirty/untracked local
tree; no pull/reset/clean/branch replacement over it; no commit/push; 5173/5174 untouched;
current response tune and 80% pilot-view shake reduction already built; six intentional
normal-physics hash changes with retained goldens; --legacy-response baseline diagnostic;
/tmp pictures/logs/baseline may disappear and are not durable memory. A new local chat can
read the files directly; GitHub-only or cloud chats cannot see this uncommitted working tree.

The user's intervening keyboard look question did not request a code change: right mouse
held looks around, middle button in mouse flight, held R3/right stick on pad. No keyboard-
only look bindings exist. Do not invent an approved IJKL/numpad look task from that question.

This transfer turn changes markdown only. Input.js and FlightInput.js reread for controls;
git diff --check and new prompt character/reference checks pass. No dev server started,
no tests rerun for documentation, no commit or push. Paste the new prompt in a chat attached
to /Users/harrisoncohen/Documents/racing-game to begin C on the existing work.

### 10x. Saved flight FOV slider before Part C

Codex_test, 2026-10-22. User requested an FOV slider before moving to C because the fixed
view made it hard to see all instruments. Added the actual control and updated the Part C
transfer prompt. C still unstarted, no B acceptance assumed, no commits/pushes/packages.

Built:
- Fly and flight pause menus contain Field of view, a native mouse-draggable range slider
  with degree readout and +/- buttons. Keyboard left/right or menu gamepad left/right changes
  one degree, Enter/Space/A also steps as other settings do. Menu focus stays on the row.
- tuning.js FLIGHT_CAMERA userFovMin 55, userFovMax 110, userFovDefault 78, userFovStep 1,
  comments/ranges supplied. These are vertical degrees, confirmed from installed Three.js
  PerspectiveCamera source documentation. Default preserves the old Cockpit angle.
- FlightGame loads/saves flight.fov through Storage and owns setFov/_fovRow. Camera owns
  normalizeFlightFov: finite numeric values clamp/round; absent or malformed data uses 78.
  The setting survives aircraft switch/configuration, pause, camera change and page reload.
- FlightCamera.userFov supplies the selected base angle for all four flight views, so
  camera changes or speed cannot override the user's preference. The previous speed-based
  widening is disabled for gameplay with a selected FOV. Existing small Mach kick remains,
  capped at 110; First person/Cockpit retain the prior 80% comfort reduction. Near/far rules
  remain separate while world/overlay projection angles match. Physics/eye position unchanged.
- RaceScreens.Menu has optional range row support; only FOV opts in. Other menus retain
  their previous stepper. Native input click stops row activation to prevent an extra step;
  focus synchronizes the row index, input updates storage/value, paint synchronizes thumb.
  styles.css adds one .race-range rule. No car FOV, input, geometry, physics or audio changes.

Verified:
- New scripts/flight/fov-browser.mjs: 18 actual-page checks PASS, clean console. Tests native
  mouse slider, keyboard single increment (no native/menu double step), gamepad menu path,
  both aircraft, all camera modes, world/overlay agreement, Mach maximum clamp, no aircraft
  movement from changing view, pause/Fly agreement, reload, malformed storage, menu fit at
  1280x720 and existing car volume/menu behavior. Isolated Chrome save, synthetic pad menu.
- Eight PNGs in /tmp/look-flight-fov, all visually inspected on /tmp/fov-contact.jpg; small
  pause menu inspected full size too. Both cockpits at 78 and 110 show the expanded panel
  coverage. Higher FOV makes instruments smaller; downward look still accesses lower panels.
- npm run build PASS with the existing 800 kB chunk advisory; /tmp/fov-build.log. git diff
  --check and forbidden-dash checks pass. No full physics/world/car suite rerun for this
  settings-only addition; the last full results and six golden caveats remain in 10v.
- Test server was only own 5185, user 5173/5174 left alone. Stop own server after verification.
- Own 5185 server stopped after verification, port confirmed clear. Existing 12 cockpit
  feedback headless checks also pass, including original standalone camera shake behavior.
  All changes remain local/uncommitted on Codex_test, including the updated prompt.

User test: Esc, select Field of view, drag toward 95 to 110 and resume. Compare 737 and
F-22 Cockpit panels, look down, switch cameras/aircraft and reload to check the saved choice.
Fly menu offers the same setting. Keep this feature when implementing C and its F-22 remodel.

### 10y. Part C: terrain navigation, trip planner, Route AP, F-22 exterior and audio

Codex_test, 2026-10-22. User explicitly requested the complete approved Part C in the
existing local checkout, preserving all dirty/untracked M5/A/A2/B/FOV work. This section
supersedes earlier statements that C is unstarted. Do not infer formal B or C acceptance.
Stop after C for user testing. No helicopter, combat or milestone 6 work. No commits,
pushes, merges, rebases, pulls, branch changes, packages, textures or runtime network calls.
Remote refs fetched only; branch remains Codex_test at 8559a6a. Initial local work backed
up to /tmp/blocky-before-part-c.tar.gz before editing, but that is disposable scratch.

**Built navigation and planning.**
- world/FlightMapCache.js owns one WeakMap-cached raster per world, using the existing
  MapData height/biome/coast samples. FlightGame starts it before the full map ever opens.
  FLIGHT_NAV.cacheMs limits generation to about 2 ms per frame (one row is the minimum
  work unit). Canvas upload only when its revision changes. Full map/external navigation
  share that canvas. Physical displays read its RGBA into a bounded 22 by 22 vector mesh,
  no CanvasTexture. MapData airport markers now use actual runway centres, not the offset
  platform centres. All airport/runway markers and sampled real track centrelines share
  the cache registry, including automatically discovered tracks.
- ui/FlightMapView.js supplies north-up transforms, clipped overlays, track/runway strokes,
  ownship rotation, planned/active route and active stop. InstrumentDrawing.navigation
  uses it for both cockpit and themed external HUD; Canvas crops the cached terrain.
  Shared scale, north indication, heading, range and progress. External Map zoom buttons
  and planner Navigation zoom buttons control both physical and external range. No new
  flight keybindings. Physical panels continue with U off. Existing Radar object is hidden
  and retained only for its regression-compatible landmark registry; no visible old disc.
- flight/FlightRoute.js is headless, absolute coordinates, no render-origin dependency.
  One version-1 trip: null origin means capture live position at activation; fixed origin
  is retained. Up to 24 ordered stops, final stop is destination, labels/airport IDs bounded,
  finite world-bounded coordinates and 50 m minimum adjacent spacing. Invalid saved trips
  recover empty. Invalid edits retain the old trip with a reason rather than erase it.
  FlightRouteStore.js uses existing Storage under flight.trip. Progress and AP engagement
  are never persisted. Aircraft switches/spawns preserve the planned trip, clear guidance.
- MapScreen has explicit Plan a trip versus Teleport options. Mouse click picks a marker or
  arbitrary point. Origin can be live or selected; add airports/points, select stops, move
  up/down, delete, reverse, activate nearest forward leg or a selected leg, cancel and clear.
  Incompatible airport stops remain navigable and list why the aircraft cannot land there.
  Activation shows leg selection before AP use. Planning does not move, repair or refuel
  aircraft. Teleport/Hangar and crash respawn retain their separate eligibility checks.
- Keyboard: Tab accesses Plan a trip and buttons; Up/Down or W/S cycles planner actions,
  Enter/Space chooses. Move map cursor then arrows/WASD moves the cursor, Enter/Space adds;
  Escape returns to buttons. Mouse uses the same actions. Standard pad: Up above the first
  airport focuses Plan a trip, A opens; menu directions cycle buttons, A chooses. Cursor
  uses D-pad/stick and A adds; B leaves cursor, next B closes map. Start closes ordinary
  map. Existing teleport controls unchanged. Last stop is always the destination.

**Route autopilot.**
- P / D-pad Down: Off, Hold, Route, Off. A route must first be activated in Map. Without a
  usable trip: Off, Hold, Off plus a readable reason. Airborne/AGL engagement guards remain.
  Hold captures current targets. Route preserves selected altitude/CAS, owns lateral
  heading; arrows/pad still adjust altitude/speed, heading selection belongs to Hold.
- Route.update runs on the fixed physics clock even in manual/visual guidance. Nearest
  forward-leg activation, bounded cross-track interception/lookahead, endpoint recovery,
  swept arrival and endpoint-plane crossing with corridor guard, low-speed guard, monotonic
  leg advance (no waypoint chatter), and remaining distance. Final arrival transitions AP
  to Hold on final leg heading with a completion notice. No direct motion, altitude/speed
  constraints per waypoint, terrain avoidance, automatic takeoff or landing.
- Edits/cancel during Route fall back to Hold on current heading. Crash turns AP off and
  clears route progress. Reset/spawn/switch also clear progress and leave AP off. Rebase
  only moves render objects, never route points or progress. New tuning lives in FLIGHT_NAV.

**F-22 exterior.**
- AircraftBuilder.js: slimmer/flatter chined forebody, revised broad aft fuselage taper,
  blended angular strakes, paired lower/flatter engine shoulders, main-wing root/sweep,
  tailplane planform, wider fin separation and wider/flatter rectangular nozzle exits.
  Photographic review found exposed shoulder caps; tapered their forward ends into the
  forebody and lowered/flattened bulges before final captures. Existing canopy stations,
  seated eye, FOV preference, HUD frame and cockpit panels retained. Added hull skin is in
  cockpitShell layer handling so it cannot cover lower physical panels. Hull skin remains
  fuselage-owned, wings/fins/stabilators and nozzles retain their existing damage groups.
  Livery, flap/rudder/stabilator/nozzle/gear animation paths preserved. No aircraft data,
  inertia, collision, thrust, lift or aerodynamic tuning changed by this visual revision.
- Before/after mesh bounding boxes match exactly: min [-6.829999923706055, -1.35, -11.25],
  max [6.829999923706055, 3.153693293775311, 8.600000381469727]. Bounds include invisible
  plume geometry, so they are a preservation comparison, not real airframe measurements.
- Retained mesh goldens intentionally fail, NOT overwritten: default c55516da -> 56457cf3,
  tips 628e730d -> ff389890, split f8b23a12 -> 39caa9c3. Identity suite heading now explains
  that retained B-response/C-exterior references intentionally differ instead of claiming
  the F-22 is unchanged. Six normal physics hashes are exactly the pre-C 10v outputs.

**Procedural sound.**
- FlightAudio.js retains Web Audio and shared SoundEngine master/mute/hidden-tab lifecycle.
  Core/exhaust noise plus restrained harmonics: 737 lower triangle fan/low rumble, F-22
  higher sine turbine and stronger exhaust/actual burner roar. Harmonics follow each
  engine's own n, health and running/fuel state. Broad noise follows surviving actual spool;
  failed/stopped engines fade away, rather than leaving an idle voice indefinitely.
- Removed periodic swell/flutter oscillators and artificial twin-engine pitch detuning,
  removed burner ignition kick by default, smoother audio targets. No engine response or
  physics change. Pilot views attenuate/filter engines and wind separately by aircraft;
  stall/gear/damage alerts bypass the cabin lowpass but retain master volume and pause.
  Filter cutoff respects the context Nyquist limit, including offline/low-rate contexts.
- Sonic boom suppressed in First person and Cockpit. External camera retains the existing
  crossing presentation, not a stationary-observer propagation simulation. Camera comfort
  scaling and bounded Mach kick unchanged. All new sound tuning is in tuning.js.
- Audio limitation: reference recording pages were researched and signal graphs measured,
  but neither reference recordings nor the revised synthesis were actually listened to by
  this agent. No sound-authenticity or perceived-quality claim. The user must audition
  idle, power changes, burner, wind, cabin/external transitions, warnings and mute/volume.

**Primary references, reference-only, no shipped assets.**
- Lockheed Martin product card, retrieved/rendered locally and photographs inspected:
  https://www.lockheedmartin.com/content/dam/lockheed-martin/aero/documents/f22/F-22-Product-Card.pdf
- DVIDS/NAWDC orthographic top and front images, retrieved and inspected:
  https://www.dvidshub.net/image/9081649/f-22-raptor-top-orthographic-view
  https://www.dvidshub.net/image/9081638/f-22-raptor-front-orthographic-view
  These are orthographic reference illustrations, not flight photographs. Manufacturer
  side/three-quarter photos supply the photographic comparison. The planned USAF three-view
  https://www.aetc.af.mil/News/Photos/igphoto/2000550281/ and manufacturer overview returned
  403, including a direct retry; do not claim those inaccessible images were inspected.
- NASA engine noise sources, fan/core/jet discussion:
  https://ntrs.nasa.gov/api/citations/20140006523/downloads/20140006523.pdf
- NASA test pilot explicitly says pilots do not hear their own boom:
  https://www.nasa.gov/podcasts/small-steps-giant-leaps/small-steps-giant-leaps-episode-166-bringing-back-supersonic-flight/
- Primary exterior recording pages identified, not auditioned:
  https://www.dvidshub.net/video/481165/f-22-raptor-taxi-and-takeoff
  https://norwegian-no.mynewsdesk.com/videos/boeing-737-800-taking-off-from-osl-26362

**Verification record (final additions below).**
- Nine car commands PASS, world PASS, build PASS with existing 800 kB advisory.
- Full flight: 451 checks PASS, only nine retained identity failures: six 10v response
  outputs and three explicitly authorized C mesh outputs above. No other failures.
- Legacy-response diagnostic against fresh git archive of 8559a6a in /tmp/blocky-c-pristine:
  all six physics traces match pristine exactly. Three mesh differences are intentional.
  Do not describe the diagnostic's nonzero exit as an unexpected physics regression.
- New registered navigation.mjs: 20 checks including actual-physics three-leg completion
  on both aircraft, interception, overshoot, low speed, invalid storage/edit, target changes,
  cancel and identical output at 30/60/144 Hz. Maximum altitude excursion over the scripted
  420 s trip: F-22 18.93 m, 737 7.54 m. Bank maxima 1.0015 and .4491 rad, inside existing
  allowed transient margin. Final AP mode Hold, neither aircraft stalled/crashed.
- navigation-browser.mjs: 29 actual-page checks PASS. Real keyboard/mouse plus synthetic
  standard navigator.getGamepads input via the real Input and FlightInput polling paths.
  Shared cache before map open, planner order/origin/reverse/delete/activation/clear,
  Off/Hold/Route cycle via P and pad D-pad Down, reset/switch/crash/rebase, versioned reload
  and corrupt storage. Console clean. Seven PNGs in /tmp/look-c-navigation-final inspected.
- audio-c-browser.mjs: 16 offline real-Web-Audio checks PASS, console clean. Energy rises
  with spool, cabin attenuates/filters, failed/shut-down engine voices disappear, no clipping
  in sampled cases, no amplitude LFOs, warning spectrum retained, boom viewpoint, actual
  burner and distinct wave profiles. Signal checks do not replace listening.
- Existing instrument-browser: 31 PASS, 27 PNGs /tmp/look-c-initial inspected. A2 Hangar:
  57 PASS, 15 PNGs /tmp/look-c-hangar inspected. FOV: 18 PASS, eight PNGs /tmp/look-c-fov inspected.
- Extended look PASS, 45 PNGs /tmp/look-c-suite inspected; look-world PASS, 53 PNGs
  /tmp/look-c-world inspected. Console clean. Rebase difference zero pixels over threshold
  versus zero control; mean .0239 versus .0232. Airport wall contact survives, hull .7017792.
- Final F-22 specialist: nine PNGs /tmp/look-c-exterior-final, front/side/top/quarter/rear,
  Cockpit 78/110 forward/down. Clean console. Final front/quarter inspected full size;
  all remaining final views inspected on labeled contact sheet. Earlier nine prototype views informed shoulder correction.
- Test-script gotchas: game.onFly is asynchronous, await it before accessing window.flight.
  Heading assertions must wrap modulo 2*pi. Offline audio contexts can have Nyquist below
  20 kHz; clamp filter cutoff. Browser harness eval timeout timers keep Node alive briefly
  after its visible PASS, so do not assume a command chain has reached the next script.

**User test order.**
1. M, Plan a trip. Pick a live or fixed origin, add two turns and a destination by clicking
   airports/map points or moving the cursor. Reorder/delete/reverse, activate, inspect the
   selected active leg. Close map and compare HUD/cockpit terrain, range and route progress.
2. Start safely airborne. P once Hold, again Route, again Off. Adjust altitude and speed,
   watch interception/waypoint changes/final Hold. With no activated trip, check Off/Hold/Off
   and reason. Repeat on 737 and pad. Route is lateral guidance, choose safe altitude.
3. Inspect F-22 front/side/top/rear in orbit/Hangar, control surfaces, gear, livery and cockpit
   at preferred FOV. Check downward look, larger HUD and unchanged comfort settings.
4. Listen to both aircraft at idle, power changes, cruise and F-22 burner. Compare First
   person/Cockpit with external, wind, useful warnings, mute/volume and engine damage.
5. Test ordinary Hangar entry/leave/re-entry, Map teleport, reset and crash respawn. Reload
   should keep trip/FOV but never engage AP. Send feel/readability/model/audio feedback.

**Final verification and measured performance.**
- Existing M5b browser: 29 PASS, live Web Audio warnings/latched damage, smoke/fire/broken
  parts, repair, eligible respawn and return to car loop. 12 PNGs /tmp/look-c-damage inspected.
- Final audit added exact transformed-runway-midpoint checks. Airport local u=0 is the
  threshold; use toWorld(length/2,0), not either airport origin or platform centre.
  Added pad return from Plan a trip entry focus to first airport to preserve teleport flow.
- All specialist/navigation/Hangar/FOV/M5b, instrument and extended suite images inspected
  on labeled contact sheets; forward/quarter F-22 and route cockpit/map views also full size.
- Final performance used an isolated Chrome on real ANGLE Metal Apple M5, Medium,
  1920x1080, 4 s warm-up and 8 s sampling (481 frames each). Activated two-stop Route AP
  and terrain navigation on both aircraft. Earlier overlapping diagnostic capture discarded
  for reporting; these values are /tmp/c-performance-isolated.log.

| Aircraft/view | Frame median/p95 ms | Render CPU median/p95 ms | Physical batch median/p95 ms |
|---|---|---|---|
| F-22 Chase | 16.7 / 16.8 | 2.4 / 3.4 | .5 / .8 |
| F-22 Cockpit | 16.7 / 16.8 | 2.8 / 4.1 | .5 / .7 |
| 737 Chase | 16.7 / 16.7 | 2.7 / 3.6 | .6 / .9 |
| 737 Cockpit | 16.7 / 16.8 | 3.2 / 4.6 | .6 / .9 |

Display vertex totals about 35,000 F-22 / 44,000 737, capacities unchanged at 4.03/4.61 MB.
Console clean, neither aircraft crashed. Consistent with 60 fps in these measured cases,
not every location/graphics level or physical controller feel. The final runway midpoint
correction only changes cached marker coordinates and does not alter draw workload.

- Final checks/logs: /tmp/c-{check,lap,timing,parts,ai,race,fx,specs,drag}.log,
  /tmp/c-world-final.log, /tmp/c-flight-final.log, /tmp/c-build-final.log,
  /tmp/c-legacy-identity-final.log. Scratch paths can disappear; the results above are memory.
- No original working file is missing, no package/lockfile changes, no newly added em/en
  dashes, git diff --check clean. Source controls reread from Input.js and FlightInput.js.
- Stop for user testing. Existing changes remain on the user's local computer, uncommitted
  on Codex_test. Nothing pushed. No permission to commit or proceed beyond C inferred.
- Additional exact healthy-Hold comparison used the pre-C Autopilot.js/tuning.js extracted
  from the initial working-file backup, with the current unchanged AircraftPhysics. Both
  aircraft flew the same 90 s combined altitude/heading/speed target change. Position,
  velocity, attitude, fuel and AP integrators/targets match to the bit. /tmp/c-hold-identity.log.
- Final full world rerun after runway midpoint correction PASS. Final navigation browser
  29 PASS and all seven replacement PNGs inspected again. Final full flight 451 PASS and
  the same nine documented identity differences. Final build PASS, old size advisory only.
- Stopped only this session's Vite on 5186 (unified exec session 27450, exit 130). No action
  targeted 5173 or 5174. No test server remains on 5186. User testing is the next action.
