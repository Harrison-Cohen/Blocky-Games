# Menu redesign: the plan (approved 2026-10-22; batches 1 to 4 built)

**Status: finished.** All four batches were built and accepted by the user on 2026-10-22 and are committed as `bece5bb`. This file is now the
record of the design and of what each batch built; the lasting architecture facts are in `HANDOFF.md` section 4. Nothing here is still to do.

**Batch 1 as built (2026-10-22), waiting on the user's test.** The theme (`--accent` sand, frame variables in `styles.css`), the shared
`Menu` (pointer cell, numbers, hints, table columns, framed buttons), the title (Play: Time trial, Race, Drag race, Fly; Setup: Garage,
Controls; General: Volume, Graphics), pause (the same list plus General, the driving controls beside it), track select as a table with
the track card and a best-laps bar chart, the session and race results, and the Controls chart with Driving and Flying tabs from
`src/data/controls.js` (guarded by `npm run controls`). Menus, the garage, the Hangar, the map screens and the garage turntable ring
use the sand accent; the HUD and the map's track markers keep orange. Deviations from the plan: the title's Setup group holds Garage and
Controls (there is no separate Settings row yet; General holds the shared settings and each mode's own settings arrive with batches 3
and 4); Graphics is a new row on the title and pause menus (it was in the garage only). The flight Fly menu and flight pause still use
their own long controls card until batch 4.

**Batch 4 as built (2026-10-22), waiting on the user's test.** The Fly menu and the flight pause card use the same list style as the title:
numbered choices in groups (Fly, Setup, General, Flying) with the runway length as the airport row's hint, and Controls opens the shared
chart on its Flying tab (the old flight controls card is gone; its mouse-flight and taxi notes are in the chart's footnote). The map
screen is a dash panel with two tabs. Airports is the teleport list as before (pointer, tinted focus, the four starts as a segmented
control, a sand Teleport button). Plan a trip is laid out like a map app: a chip with the aircraft and the speed the times are planned at,
the stops A, B, C with a dotted leg between each pair giving its distance and time, a search box (type a name; Up and Down move through
the results, Enter adds one; a click on a result adds it), a summary ("2 stops, 10 nm, about 2 min") with Start route under it, then the
selected point (add it, use it as A, move the cursor, add the airport chosen in the other tab), the selected stop (move up and down, remove,
and the same on the stop itself for the mouse) and Reverse, Clear and the cockpit panel's zoom. The route is drawn on the real map with an
ink edge, its leg lengths and lettered pins (A sand, the destination pink, the leg being flown yellow); a click picks a point, the buttons
add it. The keyboard and pad paths are the old ones (up and down walk the buttons, Enter presses one, the cursor, the pad's Up above the
first airport then A). Deviations from the plan: no Graphics row in the flight menus (it rebuilds the post chain, which flight sets up for
itself; Volume is the general setting there), and a click on the map picks a point instead of adding a stop at once, so a pan or a stray
click cannot add one. Times are at the aircraft's air start speed. No physics, track or aircraft changed; the route and autopilot code are untouched.

**Batch 3 as built (2026-10-22), waiting on the user's test.** The Garage is in five tabs (Car: chassis, speedometer, graphics; Paint;
Parts; Gearbox; Stats) and the Hangar in six (Aircraft, Repair, Paint, Livery, Loadout, Tuning; a tab with nothing for the aircraft is
left out). The strip (`ui/Tabs.js`) has Q and E key caps at its ends; the active tab is a sand cell. Q and E, a pad's LB and RB, a
click, or Left and Right on the strip (which Up from the first row, or Down from the buttons, lands on) change tab. Rows now carry the
`>` pointer and a number like every other menu, and nothing scrolls except a long gearbox on a small window. Stats is a table of all
seven cars (top speed, 0-60, quarter mile, power, mass, grip; the best of each column bold) and the panel widens for it; Up and Down
on it pick the car, which turns on the turntable. The side card (name, blurb, bars, tune highlights) stays on every tab so a gearbox
tune can still be judged as it is made. Deviation from the plan: no separate Settings tab, the speedometer and graphics rows sit on
the Car tab under "Dash and display". Repair is the existing health-bar rows. No physics, track or aircraft changed.

**Batch 2 as built (2026-10-22), waiting on the user's test.** `ui/Loading.js` is the step panel from the prototype (title, subtitle, a
Step and Status table, a segmented bar with a moving block on the step in hand, a tip from the real controls chart, a percentage). It
goes in on the click frame, fades in after `MENU.loadingDelay` (150 ms, a CSS animation delay) and out from however opaque it got, and
swallows keys and clicks while up. `Game.work()` stops the loop around a job. Behind it: Fly (the flight code, the aircraft, the world,
shaders), every session start (the road, the racing line, the cars, shaders; two steps when the track is unchanged), `T` for the next
track, the Graphics stepper, and in flight every start (`go`), the airport stepper and the Detail stepper. The waits were cut by
slicing the world build (`MENU.sliceMs`), compiling shaders with `compileAsync`, and fetching the flight code while the title is idle.
`MENU` in `tuning.js` holds `loadingDelay`, `loadingFade`, `sliceMs`. Not changed: no physics, no tracks, no aircraft; all nine car
checks, `npm run flight` (451 ok, the same nine hash differences as before) and `npm run world` are as they were.

Measured with `scripts/menu-waits.mjs` (a real Chrome, cold profile, this Mac). Before: first Fly froze 500 to 700 ms; a session on a
new track 220 ms; a drag race 120 ms; airborne start 170 to 280 ms. After (time to ready, worst gap between two frames):

| Click | Ready | Worst frame gap | Panel |
|---|---|---|---|
| First Fly of a session | 430 to 460 ms | 33 to 67 ms | shown, about 400 ms |
| Session on a new track | 140 to 165 ms | 50 to 67 ms | not shown (under 150 ms) |
| Session on the same track | about 30 ms | 17 ms | no |
| Drag race | about 127 ms | 33 ms | no |
| Start airborne in flight | 100 to 230 ms | 33 ms | faint at the top of the range |
| Detail stepper in flight (rebuilds the world) | about 700 ms | 33 ms | shown (the same work was one frozen block before) |
| Graphics stepper, first change to Low | about 25 ms | 17 ms | no (it was a 200 ms stall on the next frame) |
| Every other menu open or close | none | 17 ms | no |

What cannot be removed from the main thread: the track build (about 90 ms) and the racing line (about 40 to 55 ms), and the flight
object (about 75 ms). The terrain, the largest part of the first Fly (about 335 ms), is sliced but is still that much work. A wait
just over the delay shows a faint panel for a moment; raise `loadingDelay` to hide those or lower it to show the panel sooner. Not
verified: that the panel's fade and moving block keep running while the main thread is blocked (they are opacity and transform
animations, which Chrome runs on the compositor, but a headless Chrome cannot show it; it stays correct either way because the work is sliced).

Written 2026-10-22. The prototypes are on a canvas (https://claude.ai/artifact/WhZ91oe6kd3mpRsk8XyDkk, row A is the chosen
style: main menu with the controls chart, race setup, trip planner on the real map, loading screens). Nothing in `src/` has
changed yet. Build in the batches below, one stop each, after the user approves this file.

## What the user decided

- **Style A, the dash display**: flat ink panels, an off white double-line frame (no orange rule across the top of a panel),
  numbered rows in tables and charts wherever data has columns, a `>` pointer for the selected row. Readability first.
- **The highlight colour is not orange and not cyan: a neutral.** Chosen: warm sand `#D8C8A0` (pointer, selected row tint
  `rgba(216,200,160,.14)`, primary button fill with ink text). If it reads too warm, the cool alternative is steel `#A9B8C8`; it is
  one value (a CSS variable) so the swap is trivial.
- **Type and caps rules are lifted** ("do whatever fits"). The plan keeps Martian Mono (numbers, tables, key caps) and Archivo (names,
  headings); no new font is planned. Update `Claude.md` when this plan is approved: drop the two-families rule and the no-all-caps rule,
  keep hard-edged rectangles, no rounded cards, no blur, "buttons say what happens".
- **The map screens keep the real topographic map** (the game's own raster). Only the frame, the route drawing and the planner panel change.
- **Main menu** grouped under Play (Time trial, Race, Drag race, Fly), Setup (Garage, Settings) and Options (Controls, Volume).
- **Controls screen** is one action chart: a row per action, Keyboard and Gamepad columns, tabs for Driving and Flying.
- **Settings stay per context, with the general settings always showing.** Defined below.
- **Garage and Hangar use tabs** so nothing scrolls.
- **Trip planner like Google Maps**: lettered stops with legs between them, an aircraft chip, a search field to add stops, a distance and
  time summary, the route drawn on the map.
- **Waits**: answer every click on the same frame; show the step panel (the prototype) if the wait is longer than about 150 ms; and
  actually shorten the waits.

Assumed unless the user says otherwise: the in-game HUD (dashboard shift cue, race position, lap timer) and the map's track markers keep
their orange; only menus and the map screens change colour. The HUD recolour is a later, separate decision.

## Settings, defined

- **General (shown in every menu that has settings: title, pause, Fly, pause in flight):** Volume, Graphics level (Low to Ultra), Mute.
- **Driving context:** speedometer style, gearbox mode and tune (the Garage's Gearbox tab), ghost, pace car.
- **Flying context:** units, field of view, view distance, detail, time of day, invert pitch.
- The pause menu shows General plus the context for what is running. The title shows General plus both contexts under Settings.

## Screens and layout (see the prototypes)

| Screen | Layout |
|---|---|
| Title | Left panel: grouped list with a number per row, the last used choice as a right-hand hint, a volume meter. Right: nothing by default; Controls opens the chart. |
| Controls | Full chart, tabs Driving and Flying, key caps in the Keyboard column. Generated from the same binding tables as the input code so it cannot drift. |
| Pause (car and flight) | Same list style: Resume, Restart, Change track or car, Garage, Back to the title, then the General block and the context block as tables. |
| Track select (time trial, race, drag) | Left: track table (number, name, length, surface, light, your best), then the setting rows as a table, Start and Back. Right: track card with the outline map, a stats table and a best-laps bar chart per car. |
| Garage | Tabs: Car, Paint, Parts, Gearbox, Stats. One short table per tab, the preview stays large, Save and Discard pinned. |
| Hangar | Tabs: Aircraft, Repair, Paint, Livery, Loadout, Tuning. Repair is a table of parts with health bars. |
| Results, race results, drag slip | Tables with the same frame, best time in purple, bars where a chart helps. |
| Fly menu, flight pause, crash menu | Same list style; the crash menu and respawn keep their list-plus-map layout. |
| Map and Plan a trip | The real raster map; left panel is the Google Maps style trip list (stops A to D, legs, search, summary, Start route). Click the map to add a stop; keyboard and pad paths are kept. |

## The waits: measured, and what will change

Measured on the dev server in a real Chrome on this Mac (cold profile, so the first run of anything is a worst case):

| Action | Worst freeze | Where it goes |
|---|---|---|
| First Fly of a session | 500 to 700 ms | loading the flight code 100 ms, building FlightGame 100 ms, `enter()` (priming the world, compiling shaders) about 560 ms |
| Start a time trial or race on a new track | about 220 ms (up to 650 ms on a cold shader cache) | `loadTrack` 190 ms, then the first frames compile shaders |
| Start a drag race | about 120 ms | track plus staging |
| Start airborne in flight | about 170 ms | priming the world |
| Every other menu open or close | none measurable | |

What will change:
1. **A shared loading step panel** (the prototype). On click it appears at once (an `await` of two animation frames before any heavy work so it
   is painted), only if the wait passes about 150 ms. Its bar animates with `transform` so it keeps moving on the compositor thread while
   the main thread is busy. Real step names come from real phases of the work, each separated by an `await` so progress can advance.
2. **Preload while idle on the title**: fetch the flight chunk with `requestIdleCallback` so the 100 ms import is already done.
3. **Time-slice the heavy phases** that can be sliced: world priming in `enter()` and `_primeWorld` (chunks are about 0.5 ms each, so a few
   per frame), and the track build (`TrackMesh` already builds through a generator that yields).
4. **Compile shaders off the critical path** with `renderer.compileAsync` (parallel shader compile) where Three.js supports it, and warm the
   flight materials in idle time on the title.
Target: every click acknowledged within one frame; no frame gap over 100 ms outside the panel; the panel itself shown for under a second.
This will be measured again with the same script after the work (`scratchpad/waits.mjs` becomes `scripts/menu-waits.mjs`).

## Files touched

- `src/ui/styles.css` (new theme tokens as CSS variables, frames, tables, pointer, tabs, the loading panel), `index.html` (small).
- `src/ui/RaceScreens.js` (the shared `Menu`: number cell, pointer cell, group dividers; markup only, input unchanged),
  `Screens.js` (title, pause, track select), `Results.js`, `DragScreens.js`.
- `src/ui/Garage.js` and `Hangar.js` (tabs), `Turntable.js` (framing only).
- `src/ui/FlightScreens.js`, `MapScreen.js` (the trip planner panel), `FlightMapView.js` (route and pin drawing on the Canvas).
- New `src/ui/Loading.js` (the step panel) and `src/ui/ControlsChart.js`; `src/core/Game.js`, `main.js`, `FlightGame.js` (the loading hooks,
  idle preload, sliced priming).
- `src/data/tuning.js`: a `MENU` block (colours, loading threshold) with comments and ranges. `Claude.md`, `HANDOFF.md`.
- No physics, no tracks, no aircraft. The car and flight checks must stay identical.

## Batches (each ends with a stop, what to test, and a wait)

1. **Theme, shared Menu, title, pause, controls chart, results.** New look everywhere a menu is a list.
2. **Loading**: the step panel, the idle preload, sliced priming, shader warm-up, before and after wait measurements.
3. **Garage and Hangar tabs**, with the stats card.
4. **Flight menus, the map screen and the Google Maps style trip planner.**

## Verification

All nine car checks, `npm run flight`, `npm run world` and the build unchanged; the ten browser regression scripts (several drive menus by
class name, so they are updated with the markup); `npm run look` and `look-world` with new menu pictures, every picture read; keyboard,
mouse and pad paths tested through every new screen (tabs reachable by pad); the wait script before and after; a frame-rate check that
the loading panel animates while the main thread is busy.

## Risks

- Tabs add a navigation level for the pad and keyboard: Left and Right on a tab bar, Up and Down inside a tab; tested with the synthetic pad.
- Several browser scripts select menu rows by class: keep `race-row`, `focused` and the row structure stable, or change the scripts with the markup.
- A heavy phase that cannot be sliced (the racing line, about 54 ms; shader link) still blocks for that long; the panel hides it but cannot remove it.
- The sand highlight must stay legible on the lit track backgrounds (checked on the day and night tracks and over the world).
