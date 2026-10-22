# Flight cockpit and navigation revision

Current: user requested C on 2026-10-22. C is built, see HANDOFF 10y. Stop for user
testing after C. Earlier stop-before-C notes below are historical, not current blockers.

Branch: Codex_test. Approved by "continue with the plan", 2026-10-21.
Batch A accepted by the user's "everything looks good", 2026-10-21.
Batch A2 approved by "exicute the plan", 2026-10-21. Built and verified, waiting on the user test.
User requested the next step on 2026-10-22. Batch B built and verified; user testing found
HUD frame overflow, a protruding 737 panel and inaccessible lower views. B follow-up built
and verified, including quicker power response and 80% less pilot-view shake. Stop for retest.
Existing milestone 5 working tree is preserved, uncommitted. No milestone 6 or helicopter work.

- [x] A: toggle speed brakes, 737 nose and seated visibility, tested and accepted.
- [x] A2: remaining 737 exterior, engines/tail cleanup, explicit Hangar entry and departures.
- [x] B: working aircraft-specific cockpit instruments and themed external HUD.
- [x] C: terrain minimap, multiple waypoint planning and selectable Route autopilot,
  plus the user's 2026-10-22 F-22 body and aircraft sound revisions.

## User request and answered decisions

- Speed brakes toggle rather than needing to be held, keyboard and controller.
- Correct the 737-800 nose from online photographs. Separate the lower nose/radome and upper
  flight deck so the cockpit windows, shell and seated pilot view can be shaped properly.
- Put every current flight HUD instrument/readout on working cockpit panels. Carry each
  aircraft's authentic instrument style, with retro treatment, into the other camera views.
- Replace the landmark-only corner radar with a terrain minimap using the real map data.
- Full map trip planning from live position or a selected start, multiple waypoints and a
  destination, visible on minimap and cockpit navigation display.
- User answered: aircraft-authentic retro styling; multiple waypoints; let the pilot choose
  visual guidance or autopilot route following by cycling the autopilot button in flight.
- Added after accepting A: correct remaining 737 exterior, especially inaccurate engines,
  and remove the random object on its rudder/tail. Add teleport to Hangar, fix inability to
  re-enter after leaving, replace dwell entry with a button, offer runway teleport on exit,
  and turn the aircraft around on normal departure so it is ready to taxi.

## Recommended decisions

1. P / pad D-pad Down cycles Off, Hold, Route, Off. Without a usable route: Off, Hold, Off
   with a readable reason. Hold preserves today's altitude/heading/speed controls. Route
   follows lateral legs with bank-limited normal autopilot controls, and holds pilot-selected
   altitude/speed. Pilot can still adjust altitude/speed in Route. Heading selection belongs
   to Hold. Do not add waypoint altitude constraints, auto takeoff, landing or terrain avoidance.
   Show active mode and target. At final waypoint, enter Hold on the final leg heading with
   a completion note. Disengage/clear on crash and reset; no surprise re-engagement after load.
2. V / unmodified pad B toggles airbrake. Back+B still mutes. Pause and camera changes keep
   the lever setting; start, respawn and aircraft switch retract it. Key repeat cannot toggle
   repeatedly. Keep actual surface animation/ramping and aircraft-specific spoiler behavior.
3. Trip planning is separate from teleport and respawn. A selected origin plans a route,
   never moves the aircraft. Airports and arbitrary map points can be origin/waypoints/end.
   Ordered list: add, select, move up/down, delete, reverse, activate, clear. Keyboard/pad
   focus navigation and map cursor selection as well as mouse. Label incompatible airport
   destinations but permit navigation to them, with explicit cannot-land warning. Respawn
   still forbids them. One saved active trip initially, not a library of named trips.
4. A live-position origin is captured at activation; the aircraft marker remains live. A
   planned origin remains fixed. Activation chooses a forward leg by position/progress so
   an aircraft joining from elsewhere does not unexpectedly turn back to the start. Show
   selected active leg before engagement, allow selecting another leg. Use segment crossing
   and arrival radius with overshoot handling, low-speed guard and hysteresis. Arrival radius,
   intercept limits and display/performance budgets in tuning.js. Navigation uses absolute
   world coordinates and shared heading signs; no origin-rebase drift. Route is a direct
   sequence of legs, not obstacle avoidance or an aviation clearance.
5. Save versioned route coordinates, labels and order through Storage; normalize each point,
   bound count/coordinates, reject invalid trips safely. Preserve trip when changing aircraft;
   reset progress on fresh spawn and reselect explicitly on activation. Do not persist AP on.
6. Instrument profiles referenced from aircraft data: layout, colors, scales, labels and
   available systems. 737-800 primary flight/navigation/engine displays, speed/altitude tapes
   and standby gauges; F-22 green HUD and multifunction displays. Retro treatment through
   crisp linework, tick marks, numerals and restrained glow/colors, not fictional analog-only
   panels. A documented profile/fallback serves future aircraft; no helicopter implementation.
7. One telemetry snapshot feeds cockpit and external HUD. Include airspeed/TAS/Mach, altitude/
   AGL/climb, attitude/flight path, heading, throttle/burner/fuel, AoA/G, gear/flaps/spoilers,
   brakes/steering/park, autopilot targets/mode, damage/warnings and route/map. Put service
   notices/reset progress outside the panel as readable messages. Avoid duplicate floating
   flight gauges in Cockpit; First person stays an unobstructed view with themed HUD.
   U toggles screen overlay; physical cockpit instruments keep working. No fake engine
   temperatures/pressures or other values the simulation does not model.
8. Preserve no textures, no packages, no runtime network requests. Physical cockpit gauges
   use batched vector geometry/glyphs and shared Materials.js materials. Terrain navigation
   panel uses a bounded colored mesh from shared map samples, no CanvasTexture. External
   HUD/map remain canvas/DOM. Shared instrument scales/layout logic avoids inconsistent
   numbers between renderers. Prototype readability/performance before filling all panels.
9. Share a time-sliced cached map raster between full map and minimap, available before the
   full map has ever opened. Terrain/coasts, airports/runways and track outlines, scale,
   compass, ownship, route and active waypoint. North up initially, aircraft icon rotates;
   range zoom buttons. Crop existing raster rather than resample terrain every frame. The
   cockpit map and external minimap show the same active route and progress.

## Delivery batches, stop for user test after each

### A. Speed brake toggle and 737 geometry/visibility

Save before/after reference views; reshape lower nose and upper flight deck as distinct
pieces with shared window boundary data for exterior/interior. Correct radome, windshield
slope, brow, cheeks and body transition. Set seated eye, sill and glareshield together.
Preserve overall aircraft dimensions, physics, collision proxies and damage grouping.
Check exterior front/side/three-quarter, pilot straight ahead, look left/right/down, ground
and approach. No exterior-shell obstruction, seams or near-plane clipping. Toggle tests
include repeat, pad modifier, pause, camera, respawn and switch behavior.

### A2. Remaining 737 exterior and explicit Hangar visits (approved addition)

**Model.** Compare the 737-800 NG exterior with front/side/three-quarter/rear photographs,
especially the CFM56-7B installation. Correct nacelle proportions and flattened lower shape,
inlet lip and visible recess, swept fan blades/spinner, rear exhaust and wing pylons. The
current inlet is a circle and flat bars placed on a capped Loft face, explaining its shallow
appearance. Audit the rest of the exterior for obvious proportion, attachment and overlap
errors. Keep accepted nose/cockpit and overall aircraft dimensions; changes are visual,
not thrust, mass, aerodynamics or control tuning. Preserve gear/control animation, liveries,
damage side ownership and dependent wing/engine removal. Do not turn this into a full rebuild.

Remove the raised/floating tail ornament the user calls the random rudder object. Current
builder places a ring/disc insignia near the fin's leading edge, where it can extend off
the fin; this is the likely object. Compare the actual rendered tail while implementing,
remove the protruding ornament, retain the structural fin/rudder and rudder animation. Any
remaining tail paint/markings must lie flat on the fin, with no hovering solid badge.

**Teleport to Hangar.** Add a named Hangar destination to the full map's existing apron,
runway and airborne starts. It relocates to the selected compatible airport's hangar apron
and displays the Enter Hangar button; it does not open the editor automatically. Preserve
ground eligibility rules and damage/fuel/reset behavior of existing teleport. Existing R
hold remains the shortcut to the last airport's Hangar area. Map planning stays separate.

**Explicit entry/re-entry.** Replace automatic stopped dwell and its armed latch with a
visible Enter Hangar button in a nearby bay when grounded, nearly stopped, throttle low
and not crashed. Clicking, Enter or contextual pad A enters. Context consumes the pad press
so it cannot also engage afterburner. Leave normal flight bindings elsewhere unchanged.
After leaving, the button is immediately usable again when its conditions hold. No need
to leave/re-enter the zone, no automatic reopening. Remove stale dwell progress and hints.
Keep the separate stopped-at-airport bookkeeping that records the last airport.

**Exit choice.** Offer Leave hangar and Teleport to runway as clear departure actions. Keep
the existing Save/Discard semantics explicit: if edits are pending, resolve Save or Discard
before the selected departure, rather than silently saving or losing changes. Repairs keep
their existing immediate persistence. Both exits are keyboard/mouse/gamepad accessible.
Normal departure places the aircraft stationary on that hangar's clear exterior apron,
rotated 180 degrees from the entry heading so the nose faces out toward taxi space. Recompute
a safe placement from aircraft size and airport layout so the long 737 tail/wings cannot
intersect the new solid hangar walls during rotation. Runway departure uses the selected
airport's existing eligible stationary runway start, aligned for takeoff. Throttle zero,
autopilot off; no automatic acceleration. Revalidate after an aircraft switch, and explain
any required airport change. Hangar preview from the Fly menu returns to its menu normally;
only an explicit physical departure/teleport moves the aircraft.

**Checks/test stop.** For both aircraft, enter/leave/re-enter three times in the same bay,
using mouse, Enter and pad confirmation. Include Save, Discard, Repair and aircraft switch.
Verify entry never opens while moving/airborne/crashed, no accidental afterburner, leaving
does not force a reopen, normal departure faces outward with hull/wing clearance, and runway
departure/Map Hangar teleport use the correct airport and enforce eligibility. Check respawn
still replaces wrecks correctly and ordinary Hangar visits do not free-repair survivors.
Inspect 737 engine/tail front/side/rear pictures, animations and broken-part behavior. Run
existing regression suites and preserve the recorded F-22 baseline caveat. Stop for test
before B. A2 built and verified. Read HANDOFF.md 10t for final files, checks and test order.

### B. Aircraft-specific instruments and working cockpit panels

Introduce profiles and shared telemetry; validate one primary display at real seated size
first, then complete flight/navigation/engine/system readouts and warnings. Give external
HUD the same aircraft theme. Verify values agree across cameras/units, damage and AP modes,
U behavior and look-around attachment. Measure real Medium graphics on the user's M5 class
hardware, targeting 60 fps. Stop for readability/visibility and styling feedback.

### C. Terrain minimap, waypoint planner and Route autopilot

Shared map cache/view transforms, pure headless route model, versioned storage, planner
editing/focus controls, then map/minimap/panel overlays. Add Route AP mode on existing
control outputs without moving aircraft directly or changing aerodynamics. Test both
aircraft over multi-leg trips, manual interception, overshoot, final completion, cancel,
switch/reset/crash, invalid storage and world rebase. Repeat at 30/60/144 Hz. Retest old
teleport and crash respawn separately. Stop for user test, do not continue to combat.

User added two items on 2026-10-22, to implement during C rather than this B follow-up:
- Remodel the F-22 exterior against manufacturer/USAF front, side, top and three-quarter
  references. Correct the fuselage/chines, canopy blend, wing/body junctions, intake/engine
  shoulders, aft body, canted tails and flat nozzle silhouette as needed. Preserve overall
  dimensions, cockpit panel/window clearance, control/gear animations, liveries and damage
  ownership. Visual changes are authorized; record intended mesh hash changes rather than
  silently replacing goldens. Do not alter aerodynamics as a side effect of the remodel.
- Revise both aircraft's procedural sound to reduce the arcade character. Differentiate
  737 fan/low rumble and F-22 turbine/exhaust roar, follow actual engine spool and burner
  state smoothly, improve wind and cockpit filtering, and remove exaggerated repeating
  tones/pulses from engine voices. Preserve useful warnings, mute/volume and damage/engine
  shutdown behavior. Compare primary reference audio, audit Mach-1 treatment by viewpoint,
  and ask the user to judge sound after listening. No sampled external assets or packages.
  All audio tuning stays in tuning.js; synthesize with existing Web Audio infrastructure.

Complete the original navigation scope and these additions in reviewable steps within C;
keep this expanded checklist in the handoff. C remains unstarted during the B corrections.

## Expected touched/new files

```text
src/
  core/FlightInput.js             toggle edges, no car input changes
  core/FlightGame.js              lever, telemetry, route/AP lifecycle
  core/FlightAudio.js             C: aircraft-specific engine/wind/cockpit sound
  core/FlightPlaces.js            A2: repeatable Hangar availability and teleport mode
  core/FlightRouteStore.js        new: Storage normalization
  data/aircraft.js                instrument profile references, cockpit eye
  data/flightInstruments.js       new: profiles and reusable display definitions
  data/tuning.js                 display/navigation/control budgets
  flight/FlightTelemetry.js       new: shared values, no render dependencies
  flight/FlightRoute.js           new: waypoints, leg math, progress, bearings
  flight/Autopilot.js             Hold/Route cycle and steering
  render/FlightCamera.js          seated framing, A2 airport obstruction guard
  render/AircraftBuilder.js       C: reference-led F-22 exterior shape
  render/Materials.js             only needed shared vector material helpers
  render/aircraft/b737.js          nose/flight deck, A2 nacelles/flat tail paint
  render/aircraft/cfm56.js         new procedural open NG engine installation
  render/aircraft/cockpits.js      panel mounts, visibility and updates
  render/aircraft/FlightInstruments.js  new: batched vector gauges/glyphs/map
  ui/FlightHud.js                 themed gauges/shared telemetry/minimap
  ui/Hangar.js                    A2: explicit departure and Save/Discard resolution
  ui/FlightScreens.js             A2: Hangar controls and entry/departure hints
  ui/FlightMinimap.js             new: replaces Radar use in flight HUD
  ui/FlightInstrumentDraw.js      new: external gauge drawing with profile scales
  ui/FlightMapView.js             new: common map transforms/route overlays
  ui/MapScreen.js                 planner separate from teleport/respawn
  ui/styles.css                  themes, planner focus and readable panels
  world/FlightMapCache.js         new: shared time-sliced raster ownership
  world/MapData.js                reuse sampling; targeted exports if needed
  world/Airports.js               A2: outward departure pose and aircraft clearance
  world/AirportCollisions.js      A2: camera query reuses solid-box solver
scripts/
  flight/input.mjs                new focused toggle/mode checks
  flight/instruments.mjs          new profile/telemetry/geometry checks
  flight/navigation.mjs           new route/AP/store/frame-rate checks
  flight/hangar-flow.mjs          new A2 repeat-entry/exit/teleport regression checks
  flight/hangar-browser.mjs       new actual-page A2 regression and close-ups
  check-flight.mjs                register meaningful regression checks
  look.mjs, look-world.mjs        nose, panels, themed gauges, route screenshots
AGENTS.md, HANDOFF.md             durable state, controls and findings
FLIGHT_COCKPIT_NAV_PLAN.md         this approval/checklist
```

Keep actual edits targeted; camera work belongs in existing src/render/FlightCamera.js.

## Verification and boundaries

All nine car checks, world, build, flight suite and extended screenshot suites. Inspect
every new picture. Browser input tests for keyboard, mouse and gamepad planner flow; real
value agreement and cleanup. No golden changes without permission. Six F-22 recorded
physics goldens already fail on pristine 8559a6a on this Mac; same-runtime baseline comparison
must remain exact for untouched healthy manual/Hold scenarios. The user's 2026-10-22
acceleration request intentionally changes engine/lever response: normal physics hashes
therefore change. Use damage-identity.mjs --legacy-response to isolate those three new
response knobs and verify other healthy physics still matches pristine. Do not replace the
recorded goldens or describe normal gameplay as bit-identical. F-22 mesh hashes stay exact
until the explicitly requested C remodel;
737 geometry is intentionally revised. Display work must not change flight physics.
No commit/push, dependency installation or server shutdown on 5173/5174. Existing M5 files
remain uncommitted; no milestone acceptance is implied by this new revision request.

## References

- Delta 737-800 exterior photo: https://news.delta.com/media/image/48166
- Avio Aero engine close-up: https://www.avioaero.com/news/articles/the-salento-hub
- Boeing NG aircraft/engine identification (737-800 uses CFM56-7B):
  https://www.boeing.com/commercial/737ng
- CFM manufacturer reference for the NG engine:
  https://www.cfmaeroengines.com/cfm56/CFM56-5B-CFM56-7B
- Boeing Next Generation design overview:
  https://www.boeing.com/Commercial/737ng/737-next-generation-design-highlights
- Boeing NG flight deck image listing (direct page blocked with 403 in research tool):
  https://secure.boeingimages.com/archive/Next-Generation-737-Flight-Deck-2F3XC5JIWTS.html
- 737-800 flight deck photograph, not an older museum 737 or MAX panel:
  https://commons.wikimedia.org/wiki/File:The_Flight_Deck_of_the_Boeing_737-800._(2956276002).jpg
- 737-800 nose close-up, side and windshield reference:
  https://commons.wikimedia.org/wiki/File:JAL_B737-800(JA304J)_(5001639172).jpg
- Front nose photograph:
  https://commons.wikimedia.org/wiki/File:Boeing_737-800_(Gol)_(8373690521).jpg
- US Air Force F-22 cockpit/HUD simulator article:
  https://www.af.mil/News/Article-Display/Article/134990/sheppard-airmen-check-out-raptor-simulator/
- USAF F-22 three-view by Lockheed Martin, for the C exterior revision:
  https://www.aetc.af.mil/News/Photos/igphoto/2000550281/
- Manufacturer F-22 overview and photographs:
  https://lockheedmartin.com/en-us/products/f-22.html
- NASA engine noise sources (fan, jet, core), for the C procedural sound revision:
  https://ntrs.nasa.gov/api/citations/20140006523/downloads/20140006523.pdf
- NASA pilot interview about sonic-boom perception, for the C viewpoint audit:
  https://www.nasa.gov/podcasts/small-steps-giant-leaps/small-steps-giant-leaps-episode-166-bringing-back-supersonic-flight/

Photos are references only, not assets shipped in the game. No precise new performance
figures inferred from photographs. Exact model proportions require visual comparison during A.


## Batch A implementation record

Read HANDOFF.md 10r for final behavior, checks, pictures and test order. New shared geometry
file is src/render/aircraft/b737Nose.js. Interior uses the same actual window openings as the
exterior, with inward-facing shell materials; separate offsets caused cracks and were removed.
Current left-seat eye is [0.55, 1.04, 14.1] in both pilot cameras. FlightGame owns airbrakeLever;
FlightInput only emits toggle edges, so the existing physics ramp and auto ground spoilers
are preserved. Controls card and screenshot fixtures were updated with the new toggle.
No AP mode changes yet: the approved Off/Hold/Route cycle belongs to C.

All nine car commands, world, build, real-browser checks and both extended screenshot suites
pass. Flight has 387 passing checks, six preexisting recorded physics-hash failures, with all
nine pristine/final identity comparisons matching. No goldens changed. No commit/push.

## A2 verification checklist

- [x] Explicit entry and three same-bay visits for both aircraft, mouse/Enter/synthetic pad.
- [x] Held pad A cannot leak into afterburner or re-entry after departure.
- [x] Save/Discard/Keep editing, repair, fuel/damage preservation, aircraft switch.
- [x] Map Hangar mode, airport eligibility, stored choice, second bay, Fly preview return.
- [x] All nine car commands and world checks pass.
- [x] Flight: 404 checks pass, only six existing Mac physics golden mismatches.
- [x] Pristine same-runtime identity comparison matches all nine physics/mesh outputs.
- [x] Build succeeds, existing chunk-size advisory.
- [x] Outward chase camera clears Hangar roofs, both aircraft, shared airport solids.
- [x] Final engine/tail close-up review and both extended screenshot suites.
- [x] Durable final handoff and stop for user test before B/C.

## B implementation checklist (2026-10-22)

- [x] Shared telemetry and data profiles with safe future-aircraft fallback.
- [x] Seated-size primary display prototype inspected before completing panels.
  Fixed missing back-facing line primitives and yoke overlap before final views.
- [x] Working PFD/HUD, heading/navigation, engines, systems, AP, warnings and standby.
- [x] External HUD shares aircraft theme and values; Cockpit has no duplicate gauges.
- [x] U, camera/unit switches, damage/reset/switch cleanup, bounded resources.
- [x] Browser checks, measured Medium frame times, regressions and pictures inspected.
- [x] Handoff, controls, test order; stop before C.

Read HANDOFF.md 10u for implementation, full results, performance limits and user test order.
31 new browser checks pass; all 27 specialist, 45 look, 53 look-world and 40 regression
pictures inspected. Existing six Mac physics golden mismatches remain unchanged, with
same-runtime pristine identity comparison matching. C remains unstarted.

## B user-test follow-up (2026-10-22)

- [x] Larger F-22 HUD glass/frame, shared transform, all symbology inside its border.
- [x] 737 main/MCP/glareshield housings contained in nose, accessible lower/standby panels.
- [x] Correct downward mouse/pad look and middle-button look during mouse flight.
- [x] Quicker power response on both aircraft, same rated thrust and settled top speed.
- [x] 80% less positional shake and Mach FOV kick in First person and Cockpit.
- [x] Expanded C plan includes F-22 body shape and more realistic procedural aircraft sound.
- [x] Headless/browser checks, flight/car/world/build regressions and legacy-response identity.
- [x] Finish final world pictures/performance capture and handoff; stop for user retest.

Normal F-22 physics hashes now change intentionally under the user's acceleration request.
The unchanged identity statement above describes the original B delivery only. The optional
legacy-response diagnostic confirms no other healthy-physics difference. No golden updates.

## Final pre-C addition: saved FOV (2026-10-22)

- [x] Native Field of view slider in Fly/pause menus, 55 to 110 vertical degrees, default 78.
- [x] Shared saved preference across aircraft and all flight camera views; aligned overlay.
- [x] Mouse dragging, one-degree keyboard/pad/stepper changes, reload and invalid-data recovery.
- [x] Build and 18 browser checks, eight pictures inspected; HANDOFF 10x and transfer prompt updated.

Read HANDOFF 10x before C. Preserve the selected FOV during the F-22 remodel. No automatic
speed-driven widening when a player FOV is selected. C remains unstarted.

## C implementation checklist (Codex_test, 2026-10-22)

Implementation record is HANDOFF 10y. Built, stop for user testing, no acceptance inferred.

User explicitly requested Part C in this local checkout. Prior working files preserved;
pre-C backup at /tmp/blocky-before-part-c.tar.gz is disposable, not durable project memory.

- [x] Shared terrain cache, absolute map transforms and bounded vector cockpit terrain.
- [x] Pure route model, versioned normalized persistence, ordered planner and all input paths.
- [x] Hold/Route cycle, actual-control steering, progress and lifecycle checks.
- [x] Primary-reference F-22 exterior revision, ownership and intentional hash record.
- [x] Aircraft-specific procedural audio, real spool, viewpoints and warnings.
- [x] Regressions, actual-page pictures/input, Medium/1080p measurement, final handoff.

Final results and limitations: HANDOFF 10y. 451 flight checks pass, six retained B-response
and three intentional C mesh golden differences, no goldens overwritten. Car/world/build
pass; actual-page navigation, Hangar, FOV, damage and audio-signal checks pass. All pictures
inspected; measured Medium/1080p M5 frames 16.7 ms median, p95 16.7-16.8 ms. Sound
reference pages researched but not auditioned, user listening judgment required. Stop here.
