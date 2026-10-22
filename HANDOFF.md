# Handoff: blocky racing sim

Read `AGENTS.md` first (who the user is, how they want to be worked with, the hand-off protocol between Claude
Code and Codex), then this file, then `Claude.md` (the project rules). `PROMPT.md` is the car game's spec,
`FLIGHT.md` the flight game's spec and `FLIGHT_PLAN.md` the plan and answers the user approved for it.
`FLIGHT_M4_PLAN.md` holds the approved design of the Magpie 48 helicopter, which is deferred.

This file was condensed on 2026-10-22 from a 3,600 line session log to what the next agent needs: the state,
the rules, how to verify, how the code is laid out, what bit, and what is next. The full per-session history
(every number, every picture list) is in git: `git show b9338aa:HANDOFF.md`. The prompt and plan files of
finished work (`FLIGHT_M3_PROMPT.md`, `FLIGHT_M4_PROMPT.md`, `FLIGHT_M5_PROMPT.md`, `FLIGHT_M5_PLAN.md`,
`FLIGHT_COCKPIT_NAV_PLAN.md`, `FLIGHT_PART_C_PROMPT.md`) were deleted in the same pass and are in git too.

---

## 1. Where things stand (2026-10-22)

- **Menu redesign (the dash display): done.** The user accepted each of its four batches ("looks good") and it is committed as
  `bece5bb`. `MENU_REDESIGN_PLAN.md` has what each batch built, the measured waits and the deviations; section 4 here ("Menus",
  "Loading", "Garage and Hangar tabs", "Flight menus and the map") has the architecture. In short: flat ink panels in an off white
  double-line frame, numbered rows, a `>` pointer and warm sand (`--accent`, `#D8C8A0`) instead of orange in every menu; the title,
  pause, track select, results, Garage, Hangar, Fly menu, flight pause and map all in that style; one Controls chart (Driving and
  Flying tabs) generated from `src/data/controls.js`; a loading step panel behind every wait over 150 ms (Fly, session starts, flight
  starts, Graphics and Detail steppers); the Garage and Hangar in tabs; the map with a Google Maps style trip planner. Open and
  unconfirmed: the HUD, the cockpit panels and the map's track markers keep their orange and pink (a recolour would be a separate
  decision); the flight menus have no Graphics row (it rebuilds the post chain, which flight configures itself); the loading panel's
  fade and moving block are opacity and transform animations that Chrome runs on the compositor, which a headless Chrome cannot show,
  so "keeps moving while the main thread is busy" is by design, not observed; nobody has tried a real pad's LB and RB on the tabs or
  the panel on the user's own screen. `Claude.md`'s type and no-caps rules were lifted and the sand accent documented there.

- **Branches.** `Flight_test` (Claude Code's) and `Codex_test` (Codex's) are level, at one hand-off commit on top of `bece5bb` (the
  menu redesign, one commit) on top of `0275d6f` (the 2026-10-22 cleanup) on top of `b9338aa`. **Nothing since `b9338aa` is pushed**: `origin/Flight_test` and
  `origin/Codex_test` are still at `b9338aa`, so the cleanup and the menu redesign exist only on this Mac until the user asks for a push
  (offer it). `initial-build` (`00d6bb0`) is the draft PR's base: draft pull request `Harrison-Cohen/Blocky-Games#1` is `Flight_test`
  into `initial-build`. Commit only when the user asks in words (section 2).
- **Car game: all nine milestones are built and accepted.** Six tracks (one a drag strip), seven chassis, race
  mode, drag mode for one or two players, garage, ghost, audio, graphics levels. Nothing is waiting.
- **Flight game.** Built and accepted: milestone 1 (the F-22 on a test field), 2 (the open world), 3 (airports,
  ground handling, the Hangar, the map). Built and tested by the user with notes already fixed: 4a (the Boeing
  737-800, flaps, spoilers, autopilot, switching aircraft), milestone 5 (per-part damage, crashes, respawn) and the
  cockpit/navigation revision's batches A (toggle speed brakes, 737 nose and flight deck), A2 (737 engines and
  tail, explicit Hangar visits) and B (working aircraft-specific cockpit instruments, HUD fit, power response,
  less pilot-view shake). The saved field-of-view slider is built. **Part C is built and WAITING ON THE USER'S TEST**
  (section 9): the terrain map and minimap, the multi-stop trip planner, Off/Hold/Route autopilot, the remodelled
  F-22 exterior and the revised procedural engine sound. The user has not yet said C is accepted.
- **Not started:** the Magpie 48 helicopter (4b; the user took it out of the plan on 2026-10-21), and flight
  milestones 6 to 10 (air races and AI pilots, weapons and dogfights, missions, the living world, polish). Each is
  planned, approved, then built, one stop at a time.
- **Checks on the current tree** (run 2026-10-22 on `bece5bb`): all nine car checks and `npm run controls` pass, `npm run world` passes
  (119 ok), `npx vite build` is clean (main chunk 938 kB, `FlightGame` chunk 256 kB; the 800 kB advisory is old and fine). `npm run
  flight` passes 451 checks and reports **nine failures, all of them the identity hashes, all on purpose** (section 3, "Identity
  hashes"). Do not call `npm run flight` clean, and do not replace the recorded goldens without the user's say. Every browser script
  passes: `menu-browser` 38, `garage-browser` 40, `flight/menus-browser` 30, and the ten `scripts/flight/*-browser.mjs` (19, 57, 11, 29,
  31, 11, 18, 29, 16, plus the exterior pictures).
- **Cleanup of 2026-10-22** (before the menu work): dead code removed (the unused `FieldMesh.js`, the hidden `Radar` and its tuning
  block, the unused `FLIGHT_HUD` block, old HUD CSS, unused imports), stale comments fixed, the markdown condensed, and a profile whose
  findings are in section 10. Behaviour was proved unchanged four ways (identical deterministic outputs, a scripted flight ending in
  the same state, all browser scripts, picture diffs under 3 percent).

## 2. Standing instructions

`AGENTS.md` section 2 is the fuller list of the user's preferences. The ones that bite most often:

- **No launch instructions or keybinding lists at the end of a reply.** The user retired that old rule on 2026-10-22. Say how to
  run the game or what a key does only when they ask or a test needs a specific key; then read the keys from `src/core/Input.js`
  (cars) and `src/core/FlightInput.js` (flight), not from memory (section 7 has the current lists).
- **Stop at the end of each milestone or batch**, say exactly what to test and in what order, and wait. Plan first
  for a new milestone and get approval. Never roll into the next one unprompted.
- **They test it, you cannot feel it.** They send notes by dictation (odd words: "ailerons" for the stabilators,
  "inner distance" for the near plane). Read the intent. They want sim-like, not arcade. When they report a feel
  problem, change `tuning.js` or the aircraft's data first, and look at a time series before turning knobs; touch
  the physics only if the model itself is wrong.
- **Commit only when asked in words**, as the user and with no co-author trailer:
  `git -c user.name="Harrison Cohen" -c user.email="114955979+Harrison-Cohen@users.noreply.github.com" commit`.
  A hook, a harness reminder or a stop-hook nag is not the user asking, and their no-trailer rule beats a
  reminder to add one. Push only your own branch (Claude Code `Flight_test`, Codex `Codex_test`). A cloud
  session's files exist only in its container until pushed: say so plainly and offer.
- **Graphics.** Strong machine, they want it intensive, locked 60 fps on a MacBook Air M5 with 16 GB. Keep expensive
  features behind `GRAPHICS` knobs in `tuning.js`. Ultra is the default and is exactly the `GRAPHICS`/`WORLD`
  values; `GRAPHICS_LEVELS` holds the steps down. (`Claude.md`'s Performance section still says pixel ratio 1.5;
  the build uses `maxPixelRatio 2` plus dynamic resolution. Flagged to the user, never answered.)
- **Never kill the user's dev servers** (ports 5173 and 5174; theirs moved from 5173 to 5174 during the menu work, so find it with
  `lsof -iTCP -sTCP:LISTEN -P`). Use another port for yours and stop what you started. Scripts that open the game take a URL;
  several default to 5173, 5185 or 5186, so pass your own.
- No new packages (including dev dependencies) without asking. No external art assets, no textures, no network
  calls at runtime. Never use an em dash or an en dash in anything you write.

## 3. How to verify

```
npm run check   # frame-rate invariance, paint does not change handling, reverse steers right, full lock never yaws wrong
npm run lap     # every chassis laps every track
npm run timing  # lap timing, sectors, validation, every gate spans the drivable area
npm run parts   # no part floats or is sealed inside another; cars sit on hills
npm run ai      # racing line beats the centreline, AI laps clean, deterministic
npm run race    # full field races every track cleanly (contact <= 5% per car), difficulty ordered
npm run fx      # ghost replays exactly, gearbox never hunts, a tune is felt, skid marks on the road, pools bounded
npm run specs   # every real car does its real 0-60, quarter mile, top speed, skidpad, turning circle (scaled by STREET)
npm run drag    # drag timing: reaction, splits, ET, trap, red lights, fouls
npm run controls  # the controls chart (data/controls.js) shows only keys the input code really listens for
npm run flight  # the aircraft model (about 450 checks): atmosphere, signs, trim, stalls, published figures, ground,
                # damage, collisions, cockpit geometry, instruments, navigation, input, frame-rate invariance, no allocation
npm run world   # the open world: car ground and meshes unchanged (hashes), heightfield, chunks and seams, airports,
                # track placement, floating origin, AI cars hand-over, map
npx vite build  # the only thing that catches import errors in browser-only files (Game.js, Audio.js, main.js)
```

Run all nine car checks, `npm run flight`, `npm run world` and the build before calling anything done. `world` takes
about 30 s and `parts` about 10 s on this Mac (minutes would mean the machine is swapping, not a regression). Run `npm run look`
and `npm run look-world` after anything that changes what is drawn, then READ the PNGs.

**Seeing the game.** `scripts/lib/browser.mjs` drives the installed Google Chrome from Node with no packages
(`launch({url,width,height,port,args})` returns `{eval, shot, key, sleep, send, console, close}`); it uses the real GPU
(ANGLE on Metal). It cannot feel sticks, hear anything, press a gamepad or take pointer lock. In dev,
`window.game` and `window.flight` are the handles (`await game.onFly()` first: it is a lazy import). Useful:
`flight.start('apron'|'runway'|'air'|'hangar')`, `flight.switchAircraft('b737')`, `flight.camera.mode = 0..3`,
`flight.step(1/120)` (step the aircraft in a loop inside ONE eval: held input is polled between evals and resets),
`flight.hud.hide()`, `flight.paused = true`. Software WebGL barely advances the page's physics.

**Browser regression scripts** (`scripts/flight/`, each opens an isolated Chrome profile, never the user's saves; pass a
dev server URL and an output folder: `node scripts/flight/<name> <url> [outdir]`; then read the PNGs):

| Script | What it covers |
|---|---|
| `scripts/menu-browser.mjs` | the car menus by key press: title groups and numbers, Controls chart tabs, General settings, track select table, pause, the loading panel on Fly and on a race start (38) |
| `scripts/flight/menus-browser.mjs` | the Fly menu and pause card groups, the chart, the map's tabs, the planner (lettered stops, legs, typing in the search box, results, stop buttons, Start route), the crash menu (30) |
| `scripts/garage-browser.mjs` | the Garage and Hangar tabs by key press, click and pad edge: strip, Q/E, Stats picking a car, a dropdown on a tab, Save (40) |
| `scripts/menu-waits.mjs` | every click's wait in a real Chrome: time to ready, worst frame gap, long tasks, whether the panel showed; run it before and after touching a loading path |
| `cockpit-a-browser.mjs` | toggle speed brakes, cockpit views, V and pad B edges, 737 and F-22 (19 checks) |
| `hangar-browser.mjs` | explicit Enter hangar, departures, Save/Discard, repair, map Hangar mode (57) |
| `damage-browser.mjs`, `damage-b-browser.mjs` | damage persistence, repair, smoke/fire/broken parts, respawn, warning audio (11, 29) |
| `instruments-browser.mjs` | physical cockpit panels and external HUD for both aircraft (31) |
| `cockpit-feedback-browser.mjs` | HUD fit, panel containment, lower views, look inputs (11) |
| `fov-browser.mjs` | the field-of-view slider (18) |
| `navigation-browser.mjs` | map cache, trip planner, Off/Hold/Route, keyboard, mouse, pad (29) |
| `audio-c-browser.mjs` | offline Web Audio signal checks of the engine voices (16) |
| `exterior-c-browser.mjs` | F-22 front/side/top/rear/quarter pictures |
| `instruments-performance.mjs`, `damage-performance.mjs` | frame time and render CPU at Medium, 1080p |

Other tools: `node scripts/soak-world.mjs [seconds] [m/s] [url]` flies the real game at speed and reports frame
pacing; `node scripts/fit-aircraft.mjs <id>` refits an aircraft after its aerodynamics, engines or mass change (paste
the tables it prints into the data); `node scripts/fit-specs.mjs [id ...]` does the same for a car's 0-60, quarter
mile, top speed, skidpad and turning circle. Do not edit source while a browser script runs: Vite reloads the page and
`window.flight` is lost. `npm run look` and `look-world` exit non-zero in a container only because software WebGL logs
warnings the scripts count; on the Mac they pass.

**Identity hashes.** `scripts/flight/identity.mjs` holds six physics hashes (scripted F-22 runs: takeoff, scripted,
manoeuvre, landing, taxi, parked) and three F-22 mesh hashes. The recorded goldens were made in another container;
**six physics goldens already fail on the untouched commit `8559a6a` on this Mac** (cause not established). Then, at
the user's request, the F-22's power response was made quicker (10v of the old log: `FLIGHT.throttleRate` .35 to .65,
`engineSpoolUpScale` .55, `engineAbUpScale` .65, 737 `throttleRate` .18 to .35), which changed the six normal
hashes again on purpose, and the user authorised the F-22 exterior remodel in Part C, which changed the three mesh
hashes. Current outputs against the retained goldens (goldens left untouched on purpose):

| Scenario | Current | Recorded golden |
|---|---|---|
| takeoff | 43755769 | 3f2cfbfe |
| scripted | efc81f03 | 09bf0cef |
| manoeuvre | 83f47016 | 4ee079ce |
| landing | 487530f2 | 0245d3c6 |
| taxi | 267e9520 | c28ddd66 |
| parked | 3d160d7c | dc711af3 |
| meshDefault | 56457cf3 | c55516da |
| meshTips | ff389890 | 628e730d |
| meshSplit | 39caa9c3 | f8b23a12 |

A change that moves any of these current values is a real change to the F-22 (or the world it flies in). The
before/after diagnostic is `node scripts/flight/damage-identity.mjs /path/to/pristine-checkout --legacy-response`
against a `git archive` of `8559a6a`: with the flag (it restores only the three response knobs) all six physics
traces and the pre-Part C meshes match exactly. The same-runtime diagnostic fails without the flag, correctly.
`npm run world` also records goldens that must move only on purpose: `AIRPORT_GOLDEN` (6dd44d5b), `AREA_GOLDEN`
(the six track areas' places) and the six track mesh hashes (`scripts/lib/track-hash.mjs` re-records them).

## 4. Car game architecture

Stack: Vite plus vanilla ES modules plus Three.js r185; no other runtime dependency. Fonts are self-hosted in
`public/fonts` (Martian Mono for numbers, Archivo for text).

- **Physics** (`src/game/VehiclePhysics.js`): fixed 120 Hz step with an accumulator (`src/core/Loop.js`) and render
  interpolation. Body +x is LEFT, +z forward, pitch positive nose up, roll positive left side down; physics steer -1 is
  right and `Input` flips the sign once. Bicycle model with a friction ellipse (longitudinal takes its grip first),
  front slip angle capped at `peakSlipAngle * limitMargin`, `STEERING.yawStability` damping (off with the handbrake),
  `GRIP.speedGrip`, four-corner suspension with dampers acting relative to the ground, slope force through the spring
  normal. `SIM.referenceMass` (780, the Wedge) scales spring, damper, brake and yaw stability per car (`massK`). `awd:
  true` (Tesla Roadster) splits the drive cap across both axles. Per-chassis `rollCentre` stops tall cars lifting
  their inside wheels.
- **Ground** (analytic, no raycasts): `Track.sample(x, z, y)` and `Track.bounds`; the `y` hint separates a bridge from the
  road under it. `src/game/TrackGround.js` is the terrain height shared with the flight world.
- **Tracks are data**: one file per track in `src/data/tracks/` (found by `index.js`) and nothing else. Copper Flats,
  Harbor Nine (night), Pine Ridge (gravel), Skyline Interchange (figure 8 with a bridge), Glacier Pass, and Mesa Dragway
  (a drag strip: its `drag` block makes it one). Each also carries a `world: { biome }` line for the flight world.
- **Cars** (`src/data/cars.js`): wedge-one (the open-wheeler, measured specs) plus five modelled on real cars (Porsche 911,
  Mustang GT, Chevelle SS 396, Ferrari Enzo, Lamborghini Huracan EVO) and the Tesla Roadster, whose power, mass and
  dimensions are estimates. Their power, launchSpeed, powerFalloff, topSpeed, grips and steerRate are fitted to published
  figures held by `npm run specs` (`STREET` in tuning.js scales all real cars alike: accel 1.8, grip 1.8, turn 1.2; the
  Wedge is unscaled). Bodies are lofted superellipse panels (`Loft` in `CarBuilder.js`); wheel openings are cut automatically.
- **Gearbox**: `src/game/Gearbox.js` (automatic is cosmetic, manual on the player's car scales the drive force; B toggles,
  X neutral, the shifters are the left/right keys of the driving set you are not using). A per-chassis **gearbox tune** (final
  drive, shift point, per-gear tops) is stored under `tunes` apart from the cosmetic cars; `tunedChassis` returns the
  chassis itself for a stock tune. This and the Cosmetic-only rule are the one exception to "chassis is the only thing that
  changes stats".
- **Timing**: `LapTimer.js`, `Checkpoints.js` (gates have NO lateral width limit: a crossing counts if its point's nearest
  road sample is within half a gate spacing; records per track and per chassis). **Drag**: `src/game/Drag.js`, headless
  (tree, rollout, reaction, 60 ft/330 ft/eighth/1000 ft/quarter, red lights, fouls), `DragScreens.js`, split screen
  through `Scene.renderSplit` (no post chain) and Input's `twoPlayer`.
- **AI**: `src/ai/RacingLine.js` (minimum curvature), `SpeedProfile.js`, `AIDriver.js` (pure pursuit, awareness, seeded
  mistakes, passing lane held to `passEdge`), `Standings.js`. AI cars run the same `VehiclePhysics`; never move one along
  a spline. **Race**: `src/core/Race.js` headless (grid, countdown, contact capsules in `Contact.js`, standings, results),
  opponents in `src/data/opponents.js`, pace solved per difficulty (`RACE.levels`).
- **Rendering**: `src/render/Scene.js` plus `PostFX.js` (4x MSAA on an HDR target, GTAO at half resolution, bloom at half
  resolution for materials that opt in with `glow`, a 64 x 36 luminance meter read back asynchronously every fourth frame
  for eye adaptation that only darkens, vignette plus tone mapping in one pass) and dynamic resolution. `Sky.js`,
  `TrackLights.js`, `HeadlightPool.js`. **Every material comes from `src/render/Materials.js`**: cars use `glossy()`
  (Phong), the world `flat()`/`facets()` (Lambert, flat shaded), plus `ghost()`, `lamps()`, `instrumentInk()`. No textures,
  no PBR. `Scene.prewarm()` compiles every material after anything is built. Effects: `Particles.js` (one instanced cube
  pool), `Effects.js`, `SkidMarks.js` (ring buffer of quads), `GhostCar.js`; audio `src/core/Audio.js` (`SoundEngine`,
  Web Audio synthesis, unlocked on the first key or pointer press).
- **UI**: `HUD.js`, `Speedo.js` (digital rev bar or classic dials, mph), `RaceHud.js`, `Screens.js` (title "Full Lock",
  pause, track select), `RaceScreens.js` (the shared `Menu`), `DragScreens.js`, `Garage.js` (sectioned list, dropdowns,
  presets, per-chassis cars under `garage`, gearbox tune), `Results.js`, `DebugHud.js`. Markup in `index.html`, styles in
  `src/ui/styles.css`. `Game.js` owns everything: `step(dt)` is the fixed step, `render(alpha, frameDelta)` the rest.
- **Menus** (the dash display, 2026-10-22). Every card is a `Menu` (`RaceScreens.js`): a list of rows with one focus. A row is a
  setting `{label, value(), step(d)}`, a choice `{label, action()}`, a heading `{section}` or column titles `{head: [...]}`; optional
  `no` (the number before the label), `cols` (fixed table columns), `hint` (a dim note on the right), and `cls` (`btn` and `btn primary`
  make a framed button, `ts-track` and `ts-head` the track table). `MenuScreen.open(rows, {numbered: true})` numbers the choices.
  Theme tokens are CSS variables in `styles.css` (`--accent` sand, `--frame-shadow` the inset line of the double frame, `--line`):
  menus use the accent and orange stays on the HUD. The title's rows are keyed by `showTitle(focus)` (0 time trial to 5 controls),
  not by row index. `Game._generalRows()` is the general settings block (Volume, Graphics) shown on the title and the pause menu.
  The Controls chart is `ui/ControlsChart.js` drawing `data/controls.js` (`[label, KeyboardEvent.code]` pairs); `npm run controls`
  fails if a printed key is not in `Input.js` or `FlightInput.js`. The flight menus use the same chart (`FlightScreens.chart`, always on
  its Flying tab).
- **Flight menus and the map** (batch 4). `FlightGame.showFlyMenu` and `openPause` build rows with `{section}` headings and
  `numbered: true`; there is no Graphics row in flight (it rebuilds the post chain, which flight configures for itself), Volume is
  the general setting. `MapScreen` (`ui/MapScreen.js`): the panel has a `TabBar` (no Q/E keys); the second tab button is
  `planToggle`, which the pad's Up above the first airport focuses (DOM focus), and `_planning(on)` switches the tabs. The planner
  is drawn again by `_planner()` into `mpTop`, `mpRoute` and `mpRest` (the search box between them keeps what is typed); every
  focusable button goes in `planButtons`, in order, and `planFocus` is the one the keyboard and pad are on (`_planFocus`); the
  mouse-only up, down and remove buttons on a stop are `tabIndex -1` and are not in it. `_addStop(p)` is the one place a stop is added
  (refuses a stop within `NAV.minLeg` or past `NAV.maxPoints`); the search (`_results`) lists airports and race tracks by name or
  kind, nearest first, and Enter in the box adds the highlighted one. Times use `ctx.planSpeed` (the aircraft's `airStart.speed`).
  The map draws the legs with an ink edge and their lengths, and the stops as lettered pins (`_drawLegs`, `_drawPins`); the pink
  route and the yellow leg being flown are the cockpit panels' colours. `FlightInput._onKeyDown` no longer swallows Space or the
  arrows while a text box has the focus. The crash map (respawn) has no tabs.
- **Garage and Hangar tabs** (batch 3). Both keep ONE list of fields (`FIELDS` / `hangar.fields`, indices stable; the last is the
  buttons row) and each field has a `tab`; `_shown(it)` hides the fields of other tabs, so `_focus(i)` on a field of another tab
  opens that tab (the scripts rely on it). `tabFocus` is true while the focus is on the strip (`ui/Tabs.js` `TabBar` only draws):
  `_move` walks a ring of the strip, the shown rows and the buttons; `_step` on the strip changes tab; `_setTab(i, onStrip)`
  puts the focus on the tab's first row (on Stats, the row of the current car). Q and E and the pad menu's new `prev` and `next`
  edges (LB and RB, `Input._pollMenuPad`) change tab. The Garage's `ITEMS` carry `tab`, a `section` is a heading inside a tab,
  `head` the Stats table's header and `note` its footnote; the Stats rows are `carrow` fields, and focusing one sets the chassis.
  `CAR_COLS` is the Stats table's columns (the best of each is bold). The Hangar leaves out a tab with no fields for the aircraft.
  The pointer and number on a row are CSS (`.garage-row::before/::after`, a counter on `.garage-rows`); the side card stays.
- **Loading** (batch 2). `Game.work(opts, fn)` runs `fn(job)` behind `ui/Loading.js` with the loop stopped (nothing steps or draws a
  half-built scene) and restarts it after; `opts` is `{title, sub, steps: [labels], tip}` and the job has `step(i)` (marks the step,
  yields), `progress(f)`, `yield()`, `sub(text)` and `sliceMs`. The panel goes in on the click frame but fades in after
  `MENU.loadingDelay` (a CSS animation delay, so a shorter wait shows nothing), swallows keys (a capture listener) and clicks (it covers
  the screen) while up, and fades out from however opaque it got. Users: `main.js onFly` (the flight code is fetched on idle at the
  title, `FlightGame.enterAsync`), `Game._startSession` and `nextTrack` (`_trackBuild`, `_trackLine`, `_trackFinish` are `loadTrack`
  in pieces), `Game.changeGraphics`, and in flight `go(mode, airport)` (start behind the panel), `placeWorld` (airport stepper,
  longer-runway move) and the Detail stepper. `FlightGame.start()` and `_primeWorld()` stay synchronous (the scripts use them);
  `_primeAsync` is the same priming in `MENU.sliceMs` slices (`Chunks.prime` and `WorldMesh.primeAirports` take a `ms` budget).
  Shaders are compiled with `Scene.prewarmAsync()` (`renderer.compileAsync`, off the main thread). `respawnAt`, `toHangar` and a
  hangar departure now go through `go()`, so they finish a few frames later: a script must `await game.loading.whenIdle()` before it
  reads the result (the browser scripts do). `controlTip(kind)` (data/controls.js) gives the panel a tip from the real chart.
- **Graphics levels** (Low, Medium, High, Ultra; stored `graphics`): `GraphicsLevel.js` writes a level onto `GRAPHICS` and
  `WORLD`, keeping the declared values so Ultra restores them; `Scene.applyGraphics` rebuilds the post chain, shadow map
  and lamp pool live. Measured at 2880 x 1800, dynamic resolution off: Low 3.5, Medium 10.6, High 19.8, Ultra 23.9 ms on
  Copper Flats.

## 5. Flight architecture

`FlightGame` (`src/core/FlightGame.js`) borrows the car `Game`'s renderer, sound engine and loop (one canvas has one WebGL
context): it hides the car world, suspends the car `Input`, swaps `loop.step`/`loop.render`, and restores everything on exit.
The title's Fly row calls `game.onFly()`, which lazy-loads the flight chunk. Flight lives in `src/flight` (headless physics),
`src/world` (headless world) and the flight files of `core`, `render`, `ui`, `data`. Car modes must not change.

**Conventions.** Body +x LEFT, +y up, +z nose; world north is +z, east is -x. Orientation is a quaternion, angular
velocity in body axes (+wx nose down, +wy nose left, +wz roll right). Pull is nose up, roll right is right wing down.
`attitude()`/`quatFromAttitude()` in `AircraftPhysics.js` are the only place pitch, bank and heading signs are decided;
`FlightInput` flips signs once at its boundary. Physics runs at a fixed 120 Hz, headless (no Three.js), no allocation in
`step()` (a heap check enforces it), absolute coordinates; the scene is placed through `WorldOrigin` (a 1 km lattice, a
rebase at 2 km, invisible: `look-world` compares every pixel).

**Aircraft physics** (`AircraftPhysics.js`, `Wing.js`, `Engine.js`, `Gear.js`, `Atmosphere.js`, data in `src/data/aircraft.js`).
Six or more lifting surfaces with lift/drag curves against angle of attack and compressibility tables; engines with spool lag
and (F-22 only) an afterburner tank; pitch-only thrust vectoring that fades with dynamic pressure; ISA atmosphere to 32 km.
Aids (all knobs in `FLIGHT`, master switch `aids`): auto-trim holds a shallow flight path (not the attitude), roll self-levelling
is OFF (`levelStrength` 0), angle-of-attack softening, sideslip limiter, an integrating g limiter (not a proportional fade: that
limit-cycled and made the stabilators flutter), a tail-strike guard. Rate damping sets the top rates. Per-aircraft feel:
`AircraftPhysics.F = Object.assign(Object.create(FLIGHT), FLIGHT_OVERRIDES[def.id])`; the F-22 has no overrides, and every new
term is an exact 0 or 1 at the F-22's values so identity can be proved. Flaps (`def.flaps` detents; F-22 Auto/Combat, 737 Up,
5, 15, 30; out is refused above a detent's limit speed), spoilers (`airbrakeLiftDump` on the wheels, `airbrakeLiftDumpAir` in
the air, automatic ground spoilers on the 737), ground effect, a constant wind stub (`OPEN_WORLD.wind`, default 0; no UI until
milestone 9). Ground handling: a taxi governor holds a speed at low lever (taxiing needs a little throttle; below 0.1 and
nearly stopped, a parking hold zeroes the velocity), rate-limited nose wheel steering, a ramped wheel brake, the gear lever
cannot raise the gear while the wheels carry the aircraft, gear-up and flap warnings. Tuning blocks in `tuning.js`: `FLIGHT`,
`FLIGHT_OVERRIDES`, `AUTOPILOT`, `FLIGHT_CAMERA`, `FLIGHT_INPUT`, `FLIGHT_AUDIO(_PROFILES)`, `SHOCK`, `OPEN_WORLD` (detail
steps, airports, night, wind), `HANGAR`, `MAP`, `FLIGHT_DAMAGE`, `DAMAGE_FX`, `FLIGHT_INSTRUMENTS`, `FLIGHT_NAV`.

**The aircraft.** F-22 (fitted by `node scripts/fit-aircraft.mjs f22` to Mach 2.2 level at 40,000 ft, supercruise Mach 1.75,
+9 g, takeoff in 292 m; sources and which figures are estimates are in `aircraft.js`). Boeing 737-800 (Boeing's ACAPS D6-58325-7
Rev C figures; Vref 145 kt at flaps 30 and 65 t is an ESTIMATE because Boeing publishes none; flap angles per detent not found,
the aerodynamics are fitted to stall speeds; gear and flap placards from training sources, not Boeing). The Magpie 48 does not
exist yet. Meshes are smooth shaded (`glossy()`): `AircraftBuilder.js` (F-22, `buildAircraft(def, livery)`),
`aircraft/b737.js` plus `b737Nose.js` and `cfm56.js` (the open 737NG nacelle), interiors in `aircraft/cockpits.js` (the registry
is `BUILDERS`, keyed by the aircraft's `model`; an aircraft without one gets a placeholder block). `Aircraft.js` binds physics to
a mesh and animates the named parts.

**Autopilot** (`src/flight/Autopilot.js`): a pilot, not a physics mode; it writes the same stick, lever and flaps a player does,
once per fixed step. Off, Hold (altitude, heading, speed; Up/Down, Left/Right and W/S move the targets) and Route (follows the
active trip's lateral legs, keeps the pilot's altitude and speed; heading selection belongs to Hold). Refuses below 60 m, lets
go on the ground, in a stall or a crash. The harness uses its own fixed `MEASURING` gains so tuning the autopilot cannot move
the stall and ceiling measurements.

**Damage and collisions (milestone 5).** `src/flight/Damage.js`: seven parts per aircraft (wingL, wingR, engineL, engineR, tail,
gear, fuselage) with a normalised record per aircraft (old grouped wings/engines migrate), onset-charged impacts (a resting
hull does not wear), a 737 wing taking its engine with it, flap/gear overspeed wear. Half-health wing keeps 75 percent lift;
zero detaches. Fuselage zero destroys the airframe. `src/world/AirportStructures.js` is the one list of solid boxes (hangars with
open doorways, terminals, towers) that `AirportMesh.js` draws and `AirportCollisions.js` sweeps analytically (above
`objectCrashSpeed` 10 m/s it is a crash). Trees, city scenery and track props are NOT solid. Rendering: `DamageEffects.js`
(smoke below .6 health, fire below .3, pooled cube particles capped per graphics level), broken groups hidden and restored
(`built.damageGroups`), warning tones in `FlightAudio`. A crash shows the wreck for `crashMenuDelay` 1.6 s, then the respawn
map (`MapScreen` respawn mode): same aircraft, fully repaired, stopped on the chosen hangar apron. Survivors are NOT repaired
by teleport or reset; repair is explicit in the Hangar and persists at once. Dev only: `flight.debugDamage(partId, health)`.

**The world** (`src/world`, headless unless noted). `Noise.js` (integer-hash noise, no `Math.sin`: identical on every machine),
`Heightfield.js` (seed 195; continents, plain, ranges, canyons; the ground is ONE height function used by the mesh and the
physics), `Biomes.js` plus `data/biomes.js` (seven biomes), `TrackAreas.js` (every track is placed in the world as a rigid frame
with a tube of flattened ground; placement is seeded per track id so adding a track moves none of the others), `World.js` (the
ground contract `sample(x, z, y)`, one reused object), `Chunks.js` (quadtree of 512 m chunks, 32 cells at the default detail;
the sea is the terrain's own faces cut at the waterline, so nothing is coplanar; a skirt on every edge), `Props.js`, `Streamer.js`
(a job queue given `chunkBudgetMs` a frame), `AmbientLap.js`/`AmbientCars.js` (AI cars lap every track: replayed far away, loaded
into live `VehiclePhysics` within 700 m, bit-identical to an uninterrupted run), `MapData.js`/`FlightMapCache.js` (one cached
raster of the whole world plus markers). Drawn by `src/render/WorldMesh.js`. Settings: `View distance` 8 to 60 km and `Detail`
(Low to Maximum; changing cells or props rebuilds the ground), both stored.

**Airports** (`src/data/airports.js`, `src/world/Airports.js`, `src/render/AirportMesh.js`): 15 today (Meridian International is the
major, 3,500 x 90 m, with a graded approach corridor cut into the ridge it sits in; Fort Falcon air base; regionals; two
heliports; a strip per track area, derived from the track so a new track file adds its own). Tier recipes, runway/taxiway widths
and the flat-platform rule are in the data header. Placement is seeded, so editing the airport list, spacing or `seedSalt` can
move track areas; the world check records the goldens. Eligibility by `def.ground` (`minRunway`, `vtol`) through `FlightPlaces`.
Start modes: apron (default), runway, air, hangar. The Hangar (`src/ui/Hangar.js`, `Turntable.js`, `HangarStore.js`,
`data/loadouts.js`): switch aircraft (only here), repair, paint/livery, loadout, tuning; cosmetics, loadout/tune and damage are
stored apart per aircraft; cosmetics never change handling. A physical visit uses an explicit Enter hangar button; leaving offers
Leave hangar (stationary, nose out, in the same bay) or Teleport to runway.

**Cockpit, instruments, cameras.** `C` cycles Chase, First person, Cockpit, Far orbit. The Cockpit view draws the modelled
interior in a second pass (`PostFX.OverlayPass`, `Scene.setOverlay`): world first, depth cleared, then aircraft plus interior with
their own camera; the interior is on layer 1 only. The hull is single sided, so the interior closes the space itself with holes
where the glass is (`COCKPIT_GLASS`). The F-22's exterior loft is exposed as `cockpitShell` and kept out of the overlay pass so
it cannot cover the lower panels. Instruments: `data/flightInstruments.js` (profiles per aircraft: `737ng`, `raptor`, a generic
fallback), `flight/FlightTelemetry.js` (ONE read-only snapshot per frame, even with the HUD off), `flight/InstrumentDrawing.js`
(renderer-neutral vector strokes), `render/aircraft/FlightInstruments.js` (one bounded triangle batch per physical display,
refreshed at `refreshHz` 30), `ui/FlightInstrumentDraw.js` and `ui/FlightHud.js` (the same strokes on Canvas2D for the external
HUD; U hides only the overlay). Engine panels say Spool, not N1, and show only values the simulation has. A new aircraft
needs an instrument profile and a cockpit builder; do not invent sensors. `FlightCamera.js`: field of view is the user's saved
slider (55 to 110 vertical degrees, default 78, `flight.fov`), the near plane grows with height above ground (a fixed small one
caused black depth-fight lines), First person and Cockpit have 80 percent less shake and Mach kick than before, and an external
camera obstruction guard keeps the chase view out of hangar roofs. Free look: right mouse held (middle in mouse flight), R3
on a pad; there are no keyboard look keys.

**Navigation (Part C).** `world/FlightMapCache.js` builds one time-sliced raster (`FLIGHT_NAV.cacheMs`), shared by the full map
and the cockpit/HUD terrain displays. `flight/FlightRoute.js` is a headless versioned trip (up to 24 ordered stops, the last is the
destination, a null origin is captured live at activation, invalid edits keep the old trip with a reason) persisted by
`core/FlightRouteStore.js` under `flight.trip`; progress and autopilot engagement are never persisted. `ui/MapScreen.js` has Plan
a trip versus Teleport; keyboard, mouse and pad all work. Route steers laterally only: no altitude or speed constraints per stop, no
terrain avoidance, no automatic takeoff or landing.

**Audio** (`core/FlightAudio.js`, Web Audio, no files): per-aircraft engine voices (737 fan and low rumble, F-22 turbine and
exhaust) following each engine's real spool and health, wind, cabin low-pass in pilot views, warnings that bypass the cabin
filter, a sonic boom only in the external camera. All levels in `FLIGHT_AUDIO(_PROFILES)` and `DAMAGE_FX`.

**Storage keys** (all under the `racing-game.v1.` prefix): car game `garage`, `presets`, `race`, `drag`, `rivals`, `ghost`,
`manual`, `speedo`, `graphics`, `tunes`, `telemetry`, `seenControls`, records and ghosts per track and chassis; flight
`flight.units`, `flight.hud`, `flight.renderDistance`, `flight.detail`, `flight.fov`, `flight.seenControls`, `flight.invertY`,
`flight.night`, `flight.lastAirport`, `flight.teleportMode`, `flight.aircraft`, `flight.trip`, and per aircraft
`flight.livery.<id>`, `flight.loadout.<id>`, `flight.tune.<id>`, `flight.damage.<id>`. Everything read from storage is
normalised on the way in.

## 6. Things that bit (do not reintroduce)

Car game:
- Downhill "float": dampers must act relative to the ground. Hill "phasing": a pitch sign error in `Vehicle.js` (body rotation is
  `(-pitch, 0, -roll)`), the wheel mount's pitch term and the cockpit camera; the height-biased nearest-sample lookup is guarded
  by the hill test in `npm run parts`.
- Reverse steering was inverted (front slip is measured in the wheel frame with the sign of `vLong`; guarded by `npm run check`).
  "Refuses to turn with D held" was a yaw overshoot, fixed with `yawStability`.
- "Missed a checkpoint" when running wide: gates have no width limit now (`npm run timing`).
- Race contact on Pine Ridge sits near the 5 percent limit and swings with any handling change: rerun `npm run race` after any
  physics or tuning change. After a grip change, measure roll and wheel lift at full lock at 12, 20 and 30 m/s, not just the skidpad.
- A stale `PIXEL_PACK_BUFFER` after an async readback produced fake timings; `PostFX.js` unbinds it.
- Two surfaces at the same height z-fight, worse with distance and a large near plane: make them one mesh (the sea is the terrain's
  own faces) or use `flat(..., { offset })` polygon offsets (roads, markings). A polygon offset on terrain showed skirts as dark lines.
- `renderer.info.render` after the post chain counts only the last pass: set `info.autoReset = false` to count a frame.
- Three's `InstancedMesh` needs its `boundingSphere` set by hand to be culled by chunk.
- `OPEN_WORLD` is not `WORLD` (`WORLD` is the car terrain block that graphics levels write onto).
- zsh: a bare `echo =====` is a glob error and aborts a chain; `grep --include=*.js` without quotes does too.

Flight:
- Auto-trim must not share the stick's dynamic-pressure fade (the nose climbed on its own at Mach 1); climbs hold the trim, dives
  let go. A g limiter that is a proportional fade limit-cycles; use the integrating cap.
- Idle thrust beats rolling resistance and the tyre model has no static friction, hence the taxi governor and parking hold. Do not
  try to fix it in `Gear.js`.
- A crash used to throw the numbers out of range (stiff skin contact at 200 m/s); a wreck stays where it fell with finite numbers.
- The harness autopilot is a measurement tool (`MEASURING` gains); retuning the real one moved the stall speeds once.
- A speed loop must not trust the first airspeed reading (a stale value read as a huge acceleration and chopped the lever).
- The hull is single sided: a window is a patch on the outside and a hole in the interior shell; both come from `COCKPIT_GLASS`.
  Interior materials need their own glow (`inside()`; the hemisphere light painted roofs the ground colour) and are cloned, never
  mutating a cached material. A screen's contents must sit in front of its face. Separate normal offsets on the 737 nose shell and
  its interior opened cracks at the brow; they share vertices now.
- The airport reach for the heightfield must use the circumradius with Chebyshev corners; a stand whose `u` equals the exit's gave
  duplicate route points and a NaN in the taxi pilot (`roundedRoute` skips duplicates).
- FlightInput look signs were reversed and a mouse-flight branch swallowed middle-button look; both fixed. Resetting camera mode
  does not reset `input.look`: clear it in fixtures.
- Faster power response doubled the 737 autopilot's speed-loop authority and broke the landing check; `AUTOPILOT.b737.kSpdA` was
  reduced to .26 to compensate.
- Pad A used for a menu, an entry or Back+A must be released before it can command afterburner (`_menuAUsed`).
- Picture comparisons need a QUIET machine and a warm dev server: the page's own loop keeps stepping the aircraft in real time
  between scripted commands, so a cold Vite server or another Chrome running at the same time changes how far the 737 has flown
  and makes 20 percent of pixels differ with no code change. Compare two runs of the same tree first as the noise control.
- Browser fixtures: `game.onFly()` is asynchronous; offline audio contexts can have a Nyquist below 20 kHz (clamp filter cutoffs);
  CDP top-level `await import` needs an async IIFE; call `scene.frame` after moving the camera in a fixture; step physics and
  effects together for smoke pictures; do not edit source while a capture runs.
- The menu work (2026-10-22): `respawnAt`, `toHangar` and a hangar departure now go through `FlightGame.go()` and the loading panel, so
  they finish a few frames later; a script must `await game.loading.whenIdle()` before reading the result (`flight.start()` and
  `_primeWorld()` stay synchronous, and `game.startSession()` returns its promise). A CDP screenshot waits for the main thread, so one
  taken during a blocking job shows the finished page: photograph the panel during sliced work (Fly, Detail) or lower
  `(await import('/src/data/tuning.js')).MENU.loadingDelay` to 0 first. The first launch shows the controls card on the title and the
  first flight shows the flight controls card, so a test that presses Enter on Controls toggles it OFF: hide it first. A click on a
  Start button or a key during a loading job is swallowed on purpose (a capture keydown guard and a full-screen overlay). The flight
  input used to `preventDefault` Space and the arrows even in a text box, which made a space untypeable in the map's search box.
  zsh has no `timeout`; macOS `sed -i` needs `''`.
- Wikimedia (reference photos): needs a descriptive User-Agent, rate limits (429), blocks `upload.wikimedia.org` originals but
  serves `thumb.wikimedia.org/wikipedia/commons/thumb/<h>/<hh>/<name>/1280px-<name>` (`<h>`, `<hh>` the first one and two hex
  digits of the md5 of the file name).

## 7. Current keybindings

Read from `src/core/Input.js` (cars) and `src/core/FlightInput.js` (flight); reread them before quoting a key, do not trust this copy.

### Cars

Keyboard:

| Key | Action |
|---|---|
| W/↑ | throttle |
| S/↓ | brake, and reverse from a stop |
| A/← and D/→ | steer |
| Space | handbrake |
| R | reset to the last checkpoint; on the drag strip, back to the line |
| C | camera |
| Esc | pause (controls card and volume) |
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

G, V, T and O are blocked during a race.

Gamepad: right/left trigger throttle/brake; left stick steer; A handbrake; Y reset; X camera; D-pad up ghost; Start pause;
Select/Share results; B garage; D-pad right manual gearbox on/off; RB/LB shift up/down (manual); D-pad down neutral (manual);
a second pad is player 2 in a two-player drag race (triggers, stick, RB/LB, D-pad down, X camera).

Menus: ↑ ↓ ← → (or W A S D), Enter, Esc on the keyboard; D-pad or left stick, A and B on a gamepad, Start (starts on the title,
resumes from pause). Settings rows also have − and + for the mouse. In the garage, digits type the driver number and
Delete/Backspace (pad X) deletes one of your own presets. In the Garage and the Hangar, Q and E (a pad's LB and RB) change
tab, and Up from the first row lands on the tab strip, where Left and Right change tab.

### Flight

Keyboard:

| Key | Action |
|---|---|
| Up / Down | pitch: Up pushes the nose DOWN, Down pulls it up (Invert pitch on the pause card flips it) |
| Left / Right | roll |
| A / D | rudder, and nose wheel steering on the ground |
| W / S | throttle lever up / down (held keys move it) |
| Either Shift | afterburner, held |
| G | landing gear |
| V | toggle airbrake (the 737's spoilers; automatic ground spoilers still work) |
| B | wheel brake, held (comes on gradually) |
| C | camera: chase, first person, cockpit, far orbit (pad Y too) |
| Right mouse, held | free look; drag down to see the lower panels (middle button in mouse flight) |
| U | external HUD on/off; the physical cockpit instruments keep working |
| N | mute |
| T | mouse flight on/off (pointer lock; Esc gives it back and pauses) |
| R, held 1 s | back to the hangar (stopped at the mouth of a bay of the airport last used) |
| Enter | enter a nearby Hangar when its button is visible |
| Esc | pause |
| Z / X | flaps up / down one setting (737: Up, 5, 15, 30; F-22: Auto, Combat); out is refused above the setting's limit speed |
| P | autopilot Off, Hold, Route, Off (without an activated usable trip: Off, Hold, Off with a reason); airborne and at least 60 m AGL. Up/Down altitude, W/S speed; Left/Right heading in Hold only |
| M | the map (Plan a trip or Teleport) |
| backtick | telemetry (collected, nothing reads it yet) |
| Space, F, Q, E | cannon, missile, flares, next target (collected, no system reads them until milestone 7) |
| H, K | hover assist, cargo hook (helicopter, deferred) |

Mouse flight (T): the mouse moves pitch and roll from the screen centre with a deadzone, the wheel is the throttle, left button
cannon, right button missile (later), middle button held looks round.

Gamepad (standard mapping):

| Button | Action |
|---|---|
| Left stick | pitch and roll |
| Right stick X / Y | rudder / throttle |
| R3, held | the right stick looks round instead |
| LT | wheel brake (analog) |
| RT | cannon (later) |
| A | enters a nearby Hangar when prompted, otherwise hold for afterburner (release a menu or entry A first) |
| B | toggle airbrake (Back+B still mutes) |
| X / Y | gear / camera |
| RB / LB | missile / flares (later) |
| D-pad up | next target (later) |
| D-pad down | autopilot Off/Hold/Route/Off; left stick Y altitude, X heading in Hold only, right stick Y speed |
| D-pad left / right | flaps up / down |
| L3 | HUD |
| Back, tapped | the map |
| Back, held, then A | back to the hangar (held 1 s) |
| Back, held, then B / X | mute / hover assist (hover later) |
| Start | pause |

A pad with no standard mapping falls back to axis 0 roll, 1 pitch, 2 twist rudder, 3 throttle slider (untested, no hardware).

Menus and screens: the flight menus use the same menu controls as the rest (the Fly menu and pause card carry View distance, Detail,
Field of view (native slider; one degree per step with keys and pad), Time of day, Units, Pitch with the mouse and stick and Volume).
Map: two tabs, Airports and Plan a trip. Airports: Up/Down or W/S airport, Left/Right or A/D start (apron/runway/air/Hangar),
Enter/Space teleport, Esc/M close, +/- and wheel zoom, drag pan. Plan a trip: click the map to pick a point (it is added with Add this
point as a stop, or used as A), or type an airport or race track name in the search box (Up/Down through the results, Enter adds,
Esc empties it); Tab reaches the buttons, Up/Down or W/S walk them, Enter/Space presses one; Move map cursor then arrows/WASD moves
the cursor and Enter/Space adds a stop, Esc returns to the buttons. On a pad, Up above the first airport focuses the Plan a trip tab, A
opens it, the d-pad and stick walk the buttons or move the cursor, A adds, B leaves the cursor then closes the map. Respawn after a
crash: Up/Down or W/S selects an airport (no tabs), Enter/Space or pad A/Start respawns at its hangar apron, Esc/M or pad B opens a
return-to-list/title choice. Hangar visit: Leave hangar or Teleport to runway; pending edits ask Save, Discard or Keep editing first;
Enter/Space repairs the selected part; Esc/B requests departure. Garage and Hangar: Q and E (pad LB and RB) change tab.

## 8. Milestones and requests, in short

Car game (details in git history and `PROMPT.md`): 1 scaffold and driving model; 2 track system and Copper Flats; 3 timing, HUD,
results; 4 garage (plus a fifth chassis the user asked for, since replaced by real cars); 5 Harbor Nine and Pine Ridge (plus
Skyline Interchange and Glacier Pass); 6 racing line, speed profile, one AI car; 7 full race mode; 8 ghost, particles, skid marks,
audio, camera polish; 9 title, track select, pause, performance pass. User requests between milestones: bigger launches (grip
limited; `ENGINE.launchTraction`), brake lights, auto drive, night lighting, "intensive" graphics at 60 fps, finer launch smoke,
a manual gearbox with two dashboards in mph, a redesigned garage with dropdowns and typed numbers, colour presets, a car per
chassis, graphics levels, real cars, quicker and tighter-turning real cars (`STREET`), the Tesla Roadster and a drag strip for two
players on one machine (this supersedes PROMPT.md's "no multiplayer", still no network), and tunable gearboxes.

Flight, in order (FLIGHT.md lists ten milestones; the user flies each and sends notes):
1. F-22 on a test field. Notes: too arcade, self-levelling and a death spiral on stall; fixed (self-levelling off, auto-trim holds
   only a shallow path, slower rates, bigger fins, hinged rudders and flaperons).
2. The open world. Notes (three rounds): nose-up at speed and a dead pitch stick (trim vs q-fade), trees on the runway, engine
   sound rebuilt, flat 2D nozzles, water glitching (the sea became the terrain's own faces), tail strike (flight computer guard,
   tail is a `skid`), push-over spring-back, creeping at idle (parking hold), the Mach 1 shock wave, stabilator flutter (integrating
   g cap), the Detail slider. Accepted.
3. Airports and the ground: 15 airports, lights, map, Hangar, gear and brakes, ground handling. Accepted.
4a. The Boeing 737-800, flaps, spoilers, autopilot, switching. Notes after flying it: wider runways and taxiways, spoilers that
   slow instead of stall, a firmer landing threshold, a gear that folds, a crash menu, a clean first person view plus a Cockpit
   view with modelled interiors, a remodelled 737 nose, remodelled F-22 intakes. 4b (the helicopter) deferred by the user.
5. Damage, crashes, respawn (5a headless damage and persistence, 5b airport collisions, effects, sound and map respawn).
   Cockpit/navigation revision: A accepted ("everything looks good"), A2 (737 engines and tail, explicit Hangar visits), B
   (working instruments; the user's notes: larger F-22 HUD, 737 panels inside the nose, reversed vertical look, quicker power,
   80 percent less shake), FOV slider, then Part C (built, waiting on the test).

## 9. Part C: what to test, and what has not been checked

User test order:
1. Press M, then the Plan a trip tab. A is your position, or a point you click on the map and choose Use this point as A. Add two
   turns and a destination by clicking the map and pressing Add this point as a stop, by typing an airport or track name in the
   search box and pressing Enter, or with the map cursor. Move up, move down, remove and reverse; Start route; Fly to this stop for
   the selected leg. Close the map and compare the HUD/cockpit terrain, range and route progress.
2. Start safely airborne. P once is Hold, again Route, again Off. Adjust altitude and speed, watch interception, waypoint changes
   and the final Hold. With no activated trip: Off, Hold, Off with a reason. Repeat on the 737 and a pad. Route is lateral guidance,
   so choose a safe altitude.
3. Inspect the F-22 front/side/top/rear in orbit and the Hangar, control surfaces, gear, livery and the cockpit at your preferred FOV.
4. Listen to both aircraft at idle, power changes, cruise and the F-22's burner. Compare First person/Cockpit with external, wind,
   warnings, mute/volume and engine damage.
5. Ordinary Hangar entry/leave/re-entry, Map teleport, reset and crash respawn. A reload keeps the trip and FOV but never engages
   the autopilot.

Menu redesign, not verified (the user accepted it from looking at it): the loading panel on their screen and the compositor claim above,
a real pad's LB and RB on the Garage, Hangar and map tabs, a Mac trackpad on the map, and the planned trip times (they use the
aircraft's `airStart.speed`, not a measured cruise).

Not verified, and only the user can: how anything FEELS (taxiing, the new power response, Route's steering, a physical gamepad or
stick), and how anything SOUNDS (the revised engine voices were measured as signals and never listened to). Reference pages for
the F-22 and engine noise were researched, not auditioned; make no authenticity claim. Pictures were inspected but the F-22
remodel is a procedural interpretation of photographs and orthographic drawings (Lockheed Martin product card, DVIDS/NAWDC top and
front views), not CAD.

## 10. Performance

Measured on this Mac (headless Chrome, the real GPU through ANGLE Metal, Apple M5, 1920 x 1080), frame time locked at 16.7 ms
(vsync) with these CPU costs per rendered frame at Medium: F-22 chase 2.2 ms median / 3.1 p95 render CPU, F-22 cockpit 2.8 / 4.0,
737 chase 2.4 / 3.1, 737 cockpit 2.6 / 4.0; physical instrument batch under 0.7 ms. Consistent with 60 fps in those captures,
not a guarantee for every location or graphics level.

Profile of 2026-10-22 (CPU profile at Ultra, 1080p, 10 s per scene, plus an uncapped run with vsync off): the main thread is
78 to 93 percent idle in every scene; GC is negligible; uncapped, every scene ran at roughly 195 to 270 fps (a frame in about
4 ms, GPU included) so there is more than 3x headroom at Ultra on this Mac. Draw load per frame: car scenes 130 to 320 calls and
465,000 to 515,000 triangles; flight 685 to 1,040 calls and 650,000 to 900,000 triangles. In flight 4,165 of about 4,450 scene objects
already have `matrixAutoUpdate = false`. The largest remaining CPU items are all inside Three.js (`updateMatrixWorld` and
`multiplyMatrices` about 2 to 3 percent, `projectObject` about 1.3 percent) followed by the instrument vertex writer
(about 1 percent in the cockpit) and `Chunks._visit` (about 0.5 percent). The render pipeline was already tuned (half resolution
GTAO and bloom, one merged finish pass, an asynchronous luminance meter every fourth frame). Ideas considered and NOT done
because the gain was small against the risk of changing behaviour: freezing static chunk groups with
`matrixWorldAutoUpdate = false` (about 0.3 ms a frame; every placement and rebase would have to force an update), reducing the
meter's readback rate (changes eye adaptation timing), caching the external HUD canvas width (a forced layout read about 0.6 ms a
second), and trimming the 912 kB main chunk (Three.js is about three quarters of it; the flight code is already a lazy chunk).
If CPU ever gets tight, start with the first.

## 11. Open questions for the user

- "Full Lock" is the title screen's made-up name; do they want a different one?
- The tracks' `targetLap` values are now slower than the AI on Copper Flats and Pine Ridge; update them?
- `Claude.md`'s Performance section says pixel ratio 1.5 and "you cannot see the screen"; both are out of date (it is their file).
- No ghost exists for a best set before milestone 8 until beaten; an offer to record one from the next clean lap went unanswered.
- Only the player's car has engine sound; the AI cars are silent.
- Flight: should it have its own stored graphics level (default Medium)? Planned for milestone 10; for now it uses the car level.
  The Detail slider's default is High; should it be higher for their GPU?
- Trees never collide (the plan says no). A crash used to be a free repair; the shipped design respawns fully repaired at the chosen
  hangar (survivors are not healed).
- The 737 flap detents are Up, 5, 15, 30 (their choice); 40 is one data row away.
- Menus: the sand accent was accepted (the cool alternative was steel `#A9B8C8`, one value in `--accent`). Do they want the HUD,
  the cockpit panels and the map's track markers recoloured to match? Is `MENU.loadingDelay` (150 ms) right? A wait just over it shows
  a faint panel for a moment.
- Their message "That's why Dubai, you can leave your feet down. Why you can leave your everything." did not parse.

## 12. What comes next

1. The user tests Part C (section 9) and sends notes; fix those first, in `tuning.js`/data where it is feel. The menu redesign needs
   nothing more unless they send notes.
2. Optional refactors the 2026-10-22 cleanup found and deliberately did not do (each touches many lines, none changes behaviour):
   the Codex-written modules (`FlightRoute.js`, `InstrumentDrawing.js`, `FlightMapView.js`, `FlightInstrumentDraw.js`,
   `FlightTelemetry.js`, `FlightHud.js`, `render/aircraft/FlightInstruments.js`, parts of `FlightGame.js`; `MapScreen.js`'s planner
   and key handling were rewritten in the normal style in the menu work, its drawing core is still dense) are written in a dense
   one-line style unlike the rest of the codebase; `Turntable.js` duplicates the Garage's turntable scene; a tiny `clamp` helper is defined 17
   times (identical bodies in most); the instrument vertex writer spreads arrays per point. Reformat or share them only when the user
   asks, and rerun every check after.
3. Then, by the user's choice: the Magpie 48 helicopter (4b; design in `FLIGHT_M4_PLAN.md`: a rotor disc with momentum theory,
   cascaded PD hover assist, skids, a sling load, its own cockpit builder and instrument profile), or milestone 6 (air races and AI
   pilots), 7 (weapons and dogfights; a radar will be needed again and the old disc is in git history), 8 (missions), 9 (the living
   world), 10 (polish and performance). Plan each, get approval, build, stop.
