# Flight milestone 4: the approved plan (kept for 4b)

Status as of 2026-10-21: the user approved this plan unchanged, with the two stop split. **4a is built**
(the Boeing 737-800, flaps, spoilers, autopilot, switching aircraft, the major's approach corridor; see
`HANDOFF.md` sections 10k and 10l). **4b (the Magpie 48 helicopter, hover assist, skids, the sling hook)
has NOT been started and must not be until the user says so.** The text below is the plan as it was
written in plan mode before anything was built: where it says "nothing built yet", it is out of date;
the design of 4b (rotor model, hover assist, skids, sling load, checks, file tree) is still the approved
design. Where it disagrees with `HANDOFF.md`, `HANDOFF.md` wins (it records what was actually built).
The user chose: two stops, cut the major's approach, hook on K and pad A, 737 flaps Up, 5, 15, 30.

---

# Flight milestone 4: the Boeing 737-800 and the Magpie 48

Branch `Flight_test`. Nothing built yet. This is the plan, the file tree, my answers to the 13 decisions at the end of HANDOFF 10j, and what I found about the 737. I stop after it and wait for you.

## Context

Milestones 1 to 3 gave one aircraft (the F-22) a world, airports, a Hangar, a map and ground handling. Milestone 4 adds the other two aircraft and the systems they need: the 737 (heavy, flaps, spoilers, long runways, autopilot), the helicopter (rotor, hover assist, sling hook), switching aircraft in the Hangar, a refit script, and `npm run flight` extended to hold every aircraft to its figures. The F-22 must fly exactly as it does now.

State of the tree: my local branch was 3 commits behind `origin/Flight_test` (milestone 3 and the 10i/10j handoff were only on the remote). I fast-forwarded it, no local changes lost. `node_modules` is not installed in this container, so step 0 of the build is `npm install` (the existing `three` and `vite` only, no package added). Nothing in this plan needs a new package. `FLIGHT_M4_PROMPT.md` is not in the repo (only the M3 one); your pasted prompt is what I worked from.

## Three things I need from you at approval

1. **One stop or two.** This is bigger than one milestone (about 5,000 new lines: two aircraft bodies, a rotor model, a sling load, an autopilot, switching, and roughly 60 new checks). I recommend **two stops**: 4a (shared groundwork, the 737, flaps, spoilers, autopilot, switching, the Hangar for three aircraft, the refit script for the 737) then 4b (the Magpie 48, hover assist, sling hook, its autopilot mode, its sound and Hangar options). Between them you fly the 737 before I build on top of it.
2. **The major's approach.** Meridian International (3,500 m, the only airport a 737 can use comfortably) sits in a cut in a ridge with its approaches blocked from about 5 km out (10i). I recommend **cutting a graded approach corridor** into the terrain at both ends of the major (it keeps every other thing in the world, including the six track areas, exactly where it is; hinting the major elsewhere would move them and need `AREA_GOLDEN` re-recorded). I measure it first (first thing after `npm install`) and tell you how bad it is before touching anything.
3. **Two control choices.** Helicopter hook: **K on the keyboard, A on the pad** (A is the afterburner on the jets and does nothing on a helicopter). 737 flaps: **Up, then 5, 15, 30** as the three detents (takeoff, approach, landing). 40 is one data row away if you want it.

## What I found about the 737 (sources)

Primary source: [Boeing, 737 Airplane Characteristics for Airport Planning, D6-58325-7 Rev C, October 2025](https://www.boeing.com/content/dam/boeing/v2/airports/acaps/737NG_REV_C.pdf). I downloaded it and read the tables and charts. From it, for the 737-800 with winglets:

| Figure | Boeing | Your spec | Note |
| --- | --- | --- | --- |
| Max takeoff mass | 79,015 kg (174,200 lb) | 79,016 | agrees |
| Operating empty mass | 41,412 kg | 41,413 | agrees |
| Max landing mass / max zero fuel | 66,360 kg / 62,731 kg | not listed | new, used for the checks |
| Usable fuel | 26,024 L = 20,897 kg | 26,020 L | agrees |
| Seats | 160 two class, 184 all economy | 162 | I keep 162 as the Hangar's maximum |
| Wheelbase (nose to main gear) | 15.60 m (51 ft 2 in) | not listed | answers 10j's "find the figure" |
| Main gear track | 5.72 m (18 ft 9 in) | not listed | |
| Nose wheel steering, max | 78 degrees (tiller) | not listed | turning radii in the same chapter: nose gear 24.7 m at 40 degrees, 16.3 m at 78 |
| Tyres | nose 27x7.75-15, main H44.5x16.5-21 | not listed | wheel sizes for the mesh |
| Takeoff field length | chart: about 2.2 to 2.3 km at max takeoff mass, sea level, standard day | 2,316 m | agrees. It is the FAR field length (115% of the all-engine distance to 35 ft) |
| Landing field length | chart, flaps 30, dry, max landing mass: about 1.8 to 1.9 km (my reading of a chart) | 1,600 m | the spec's figure fits a lighter landing or flaps 40. It is the FAR length (actual distance from 50 ft divided by 0.6, so 960 m actual) |

**Approach speed: I could not find an authoritative figure, and I think none is public.** Boeing computes Vref per weight and flap setting in the flight computer and the quick reference handbook. What the training and sim pages agree on: Vref at flaps 30 is "mid-130s to high-140s KIAS" at ordinary weights and flaps 40 a few knots lower ([Flyaway Simulation](https://flyawaysimulation.com/ask/answers/boeing-737-landing-speed/)); a target final approach of 140 KIAS at flaps 30 and typical weight ([Krepelka's 737-800 notes](https://krepelka.com/fsweb/learningcenter/aircraft/flightnotesboeing737-800.htm)); about 142 kt at flaps 40 near 65 t (a forum post on [Infinite Flight](https://community.infiniteflight.com/t/using-the-737-800-900-flaps/191982)); and the final approach speed is Vref plus 5 ([Flaps 2 Approach](https://www.flaps2approach.com/journal/737-landing-procedure)). **I will use Vref 145 kt calibrated at flaps 30 and 65,000 kg, scaled with the square root of mass, held within 5%, marked an estimate.** The model's stall speeds are fitted so the model hits it.

**Flap settings.** Real detents are 1, 2, 5, 10, 15, 25, 30, 40. Takeoff is normally flaps 5 (not certified at 1, 25 at most) and landing is flaps 30, or 40 for short runways. The certified flap limit speeds, from [Flaps 2 Approach](https://www.flaps2approach.com/journal/737-landing-procedure) and [aviationinfo.net](https://aviationinfo.net/boeing-b737-800-approach-speeds-standard-approach-profile/): flaps 1, 2, 5 at 250 kt, 10 at 210, 15 at 200, 25 at 190, 30 at 175, 40 at 162. Gear: extend at 270 kt or Mach 0.82, retract at 235 kt, extended-gear limit 320 kt or Mach 0.82 (same training site, not Boeing; used in milestone 5 for damage). **Not found: the trailing-edge flap angle per detent and the lift coefficient at each.** The mesh will turn the flaps by the detent number in degrees (the usual convention, unconfirmed), and the aerodynamic effect comes from stall speeds I fit, not from a coefficient I do not have.

## Recommended approach, and the simpler things I rejected

- **One physics class stays one class for the fixed wings.** The 737 runs the same `AircraftPhysics` as the F-22. The differences are data (surfaces, engines without afterburner, gear, flap and spoiler tables) plus a per-aircraft layer on the `FLIGHT` feel block. I rejected forking the physics: it doubles the code and risks the F-22.
- **Per-aircraft feel without touching the F-22:** `AircraftPhysics` builds `this.F = Object.assign(Object.create(FLIGHT), FLIGHT_OVERRIDES[def.id])`. Reads become `this.F.x`. The F-22 has no overrides, so every read gives the same number, and tests that change `FLIGHT.aids` still reach it through the prototype. `Gear` gets the same `F`. This is decision 2.
- **Anything new is written so it is an exact zero or an exact one at the F-22's defaults** (`x + 0`, `x * 1` are bit-exact in IEEE arithmetic): the flap lift scale starts at 1, the flap drag at 0, the spoiler lift dump at 0, the wind at 0. That is how "defaults change nothing" is made provable.
- **The helicopter is its own class** (`HelicopterPhysics`, with `Rotor.js`), not a mode of `AircraftPhysics`. Same conventions (body axes, quaternion, 120 Hz, no allocation), same `Gear` contact (with skid points), same `interpolate()` shape so `Aircraft`, the camera and the HUD work unchanged. FLIGHT.md's own tree has `Rotor.js`.
- **No blades.** One disc, as specified. I looked at [SimpleRotors](https://github.com/mmiller84/SimpleRotors) (the repo FLIGHT.md cites): it models each blade as a wing, which is the heavier thing you ruled out. The literature on low-order real-time rotor models agrees with a disc plus momentum theory, an engine limit and a simple undercarriage, so that is the model.
- **The autopilot is a pilot, not a physics mode:** `Autopilot.js` reads the aircraft's state and writes the same stick, throttle and flap inputs a player does, once per fixed step, so it is frame-rate invariant and deterministic. Never moves the aircraft along a path.

## The F-22 guard (the first thing built)

Before any edit, on the pristine tree, I record the F-22's full state (position, velocity, quaternion, fuel, mass, every control surface deflection) at the end of five scripted runs, as 32-bit hashes in `scripts/flight/identity.mjs`: a 40 s takeoff from Meridian in the world, the existing 30 s scripted frame-rate run, a 60 s manoeuvring flight with every stick, a landing at Pinecrest, and a 90 s taxi. After every later step, `npm run flight` proves the new code reproduces them to the bit, plus the default mesh (43 meshes, the grey, every moving part) and "wind 0, flap lever 0, no autopilot, no spoiler assist = the same". The existing Hangar "defaults change nothing" check stays.

## Shared groundwork (4a)

- **Aircraft data** (`src/data/aircraft.js`): each entry gains `kind` ('fixed' or 'rotor'), `model` (which builder), `role`, `ground` (the 737's `minRunway` 1,500 m applies to every ground start, so it is never put on a 1,200 m strip or a heliport; the Magpie is `vtol`), `airStart` (speed, pitch, throttle, flaps for "Start airborne": the F-22's values are today's literals, so nothing changes), `camera` (chase distance and height), `mapIcon`, `limits`. The F-22 gets only the new keys, none of the old ones move.
- **Flaps.** A lever (`FlightGame.flapLever`, like the gear lever) is passed to the physics as `input.flaps`; the physics moves `flapPos` toward the detent at `flapTime`. A detent has: a lift scale on the wings that carry flaps (`Wing.liftScale`, default 1), a zero-lift shift (the existing `flapAlpha` path), a drag add (`Wing.cdAdd`, default 0) and a stall-angle drop. The stall warning and stall angle follow the flaps. Extending past a detent's limit speed is refused with a note ("Too fast for flaps 30"). The F-22: detent 0 is today's scheduled flaps (unchanged), detent 1 is a combat setting (more lift and drag, retracts itself above a speed).
- **Spoilers and the airbrake.** V held ramps the airbrake as now. The 737's adds lift dump on the wings (`airbrakeLiftDump`, F-22 0), and automatic ground spoilers when the weight is on the wheels with the throttle at idle (a `FLIGHT_OVERRIDES` flag, since Boeing's landing charts assume auto spoilers).
- **Engines without afterburner.** `Engine` already handles `ab == dry`. The HUD hides the burner row for aircraft that have none. High bypass lapse and Mach tables are data.
- **Wind stub** (decision 9): `OPEN_WORLD.wind` (default 0), read by `World` as `windX` and `windZ`, subtracted from the aircraft's velocity to get the air-relative velocity. Constant, so it is a pure function and the determinism checks hold. Weathercocking falls out of the fin working in the relative wind; I do not add a special term unless the check says it needs one.
- **Switching aircraft** (decision 11): `FlightGame.switchAircraft(id)` rebuilds the `Aircraft`, the `ShockWave` (only for aircraft with `supersonic`), and updates `places.def`, the camera config, the HUD layout, the audio profile and the map icon, stores `flight.aircraft`, and puts the new one at the same airport on the mouth of the same bay with its own fuel. If that airport cannot host it (a 737 at an airstrip) it goes to the nearest airport that can, with a note saying so. The Hangar's close handler saves every aircraft's setup, not only the current one.
- **The Hangar for three** (`loadouts.js`, `Hangar.js`, `HangarStore.js`): liveries per aircraft (`LIVERY_OPTIONS[id]`: patterns, insignia, the name of the stock paint; `normalizeLivery(raw, id)`), loadouts per aircraft, damage parts per aircraft, card figures per aircraft. The F-22's lists are unchanged. The 737: passengers (0 to 162, 95 kg each), cargo (kg), fictional airline stripes (cheatline, tail block, belly band, engine rings), a fictional tail logo, a tail number. The Magpie: rescue passengers, gun rounds, rockets (weight only until milestone 7), the cargo hook, and the same tune knobs (its "assist" is hover assist strength).
- **HUD, camera, audio, map.** HUD rows for flaps, spoilers, the autopilot targets, hover assist, collective and power, the hook and its load, with the burner and gear rows hidden where they do not apply. Chase camera and cockpit eye from the aircraft data. `FlightAudio` gets per-aircraft profiles in `FLIGHT_AUDIO` (a turbofan hum for the 737, a rotor chop that follows load for the Magpie) and a flap clunk. The map and the radar draw a silhouette by `mapIcon` (delta, airliner, rotor), so the aircraft reads on the map.
- **Autopilot** (decision 8): P toggles. Altitude hold, heading hold, speed hold. With it on, Up and Down move the altitude target, Left and Right the heading, W and S the speed (the mapping you approved). A readout on the HUD. It switches itself off on the ground, in a stall or a crash. Fixed wing: altitude by a vertical-speed loop into the pitch stick, heading by a bank command into the roll stick, speed by the throttle lever. Helicopter (4b): it sets the targets of hover assist (vertical speed, heading, ground speed).
- **Harness and refit** (`scripts/lib/flight-harness.mjs`, `scripts/fit-aircraft.mjs`): the F-22 pilots keep their defaults and gain options (rotate speed, pitch, flap setting, flare height, brake delay), the taxi test gains a turn radius. `fit-aircraft.mjs <id>` runs a fit plan per aircraft; the F-22's plan is the one it has now.

## The 737 (4a)

- **Data.** Boeing figures above. Surfaces: two wings (124.6 m2 total, incidence about 2 degrees), a trimmable tailplane (about 32 m2, an estimate) and a fin (about 26 m2, an estimate), ailerons plus roll spoilers as roll gain on the wings. Engines: two at 117 kN, idle about 6%, high bypass thrust lapse (thrust falls with Mach and density; fitted so full thrust at 35,000 ft is Mach 0.82 and the cruise lever gives 0.785). Gear: nose at z +14.0 m, mains 1.6 m behind the centre of mass (wheelbase 15.6 m as published), track 5.72 m, the centre of mass 3.4 m up. Load limits +2.5 g and -1.0 g. Estimates (inertias, tail areas, curve shapes, CLmax per flap setting) are marked as such, like the F-22's.
- **Feel** (`FLIGHT_OVERRIDES.b737`, every value commented with a range): heavy and slow (high damping, slow stick ramps, a slower auto-trim), nose wheel steering that follows a 78 degree tiller range at a slow rate, a taxi governor scaled to about 10 m/s, crash thresholds for a 79 t aircraft, the tail-strike guard on its own tail point.
- **Body** (`src/render/aircraft/b737.js`, the `glossy()` Loft style): lofted fuselage with a radome and tail cone, windscreen and a row of passenger windows, swept wings with winglets, slats, three-part flaps and spoilers that move, CFM56 nacelles with a fan face, tailplane with elevators, fin and rudder, twin-wheel main gear and nose gear that retract, a fictional livery (cheatline, tail colour, logo, number). It reads as a 737 by the nacelles, the winglets and the proportions.
- **Airports and the 737.** Taxiways (23 m at the major) and stand pitch (45 m for a 36 m span) already suit it. The bays and hangars are left alone, since a bay only has to contain the centre of mass. Starts are gated by `ground.minRunway`. The major's approach corridor is cut (decision 10).
- **Fitted to** (`figures`, each with its source): cruise Mach 0.785 and max Mach 0.82 at 35,000 ft, service ceiling 41,000 ft, takeoff field length 2,316 m (115% of the all-engine distance to 35 ft at max takeoff mass, flaps 5, sea level, standard day) within 8%, landing field length 1,600 m (actual distance from 50 ft divided by 0.6, at max landing mass, flaps 30) within 10%, Vref 145 kt at 65 t, flap stall speeds ordered and in plausible ratios (each detent lower than the last), mass and dimensions exactly.

## The Magpie 48 (4b)

- **Design** (as approved in FLIGHT_PLAN section 2): blocky-smooth utility helicopter, 4,800 kg max takeoff, 12 m four-blade main rotor, conventional tail rotor, tall dorsal intake, side-by-side cockpit and a six-seat cabin with sliding doors, skids, short stub wings with a gun pod and two rocket pods, a belly hook. The rotor blades turn (visual), with a translucent disc when fast. A crate and a rope are drawn for the sling load.
- **Rotor and power** (`Rotor.js`, constants in a new `HELI` block in `tuning.js`): thrust along the disc normal, `T = collective x Tmax x density`, with a rotor lag, ground effect (a thrust gain inside about one rotor diameter), a translational lift gain (a bump that peaks near 13 m/s and fades), and an inflow loss in a fast climb. Power by momentum theory (induced power from thrust and airspeed, a profile term that grows with speed, plus the parasite and climb terms): if the power asked for is more than the engine gives at that density, thrust falls, so the helicopter sinks at the ceiling and past its top speed, and the three game figures (top speed 75 m/s, climb 10 m/s, ceiling 5,000 m) come out of the model instead of being clamps.
- **Control:** cyclic tilts the disc normal (limited, with a flapping lag) and the thrust offset from the centre of mass makes the pitch and roll moment, plus a hub moment term. Torque reaction from the power yaws the fuselage and the tail rotor (pedals) counters it, with a fixed mixing fraction so manual flight is possible. Fuselage drag differs by axis (nose-on, side, top), a small tail effect gives weathercock and pitch damping, a rate damping term supplies the feel.
- **Hover assist** (H, switchable any time, on by default, strength a knob that the Hangar's assist tune scales): cascaded PD controllers. Cyclic centred: ground velocity to zero (outer loop) driving a level attitude (inner loop). Cyclic deflected: attitude command, and on release the velocity loop brakes it. Collective centred: vertical speed to zero, with W and S as a climb rate command while assist is on (as a lever when it is off). Pedals centred: heading hold, deflected: a yaw rate command. Off below 0.5 m over the ground with the weight on the skids. Assist off is manual.
- **Skids** (`Gear.js`): contact points with a spring and damper and sliding friction (no rolling, a friction coefficient per surface), a static hold so it does not creep, hard landing thresholds.
- **Sling load** (`SlingLoad.js`): the load is a point mass on a rope that is a spring and a damper that only pulls, 10 m long, with a hook rating of 1,500 kg. It swings, it has air drag so it settles, it rests on `world.sample` when set down, and its weight pulls on the hook point so the helicopter feels it. K picks up the nearest free crate within reach and releases it again. A crate stands on the ground in front of the helicopter at every ground start (a test crate until missions arrive in milestone 8).
- **Fitted to** (game numbers, `figures`): top speed 75 m/s, climb 10 m/s at sea level at 4,300 kg, ceiling 5,000 m (climb 0.5 m/s), hook 1,500 kg, mass and rotor diameter exactly.

## File tree

```
src/flight/
  ~ AircraftPhysics.js    per-aircraft F layer, flap detents, spoiler lift dump, auto spoilers, wind,
                          stall angle with flaps, accessors (spool, abLevel) the game reads
  ~ Gear.js               takes F; skid contact (slide points); per-aircraft steering limits
  ~ Wing.js               liftScale and cdAdd (exactly 1 and 0 by default)
  ~ Aircraft.js           physics class by def.kind, builder by def.model, per-model animate hook
  + Autopilot.js          altitude, heading, speed hold (fixed wing); hover assist targets (helicopter)
  + HelicopterPhysics.js  rotor body, controls, hover assist, skids, hook   (4b)
  + Rotor.js              the disc: thrust, power, ground effect, translational lift, torque   (4b)
  + SlingLoad.js          the load, the rope, the crate on the ground   (4b)
src/data/
  ~ aircraft.js           + B737 and MAGPIE entries; AIRCRAFT = [F22, B737, MAGPIE]
  ~ loadouts.js           options, liveries, damage parts and card figures per aircraft
  ~ tuning.js             APPENDED: FLIGHT_OVERRIDES, AUTOPILOT, HELI, audio profiles, OPEN_WORLD.wind
src/render/
  ~ AircraftBuilder.js    the F-22 untouched; only `export` added to its helpers (slab, fin, digits)
  + aircraft/b737.js      the 737 mesh and its animation
  + aircraft/magpie.js    the Magpie mesh, rotor, rope and crate   (4b)
src/core/
  ~ FlightGame.js         switchAircraft, flap lever, spoilers, autopilot, hover, hook, per-aircraft config
  ~ FlightInput.js        a `hook` action (K, pad A); nothing else moves
  ~ FlightPlaces.js       eligibility by def.ground, the nearest airport that can host an aircraft
  ~ FlightAudio.js        per-aircraft profiles, rotor chop, flap clunk
  ~ HangarStore.js        livery normalised per aircraft id
src/ui/
  ~ Hangar.js             per-aircraft rows, liveries, figures; switch and save all setups
  ~ FlightHud.js          flaps, spoilers, autopilot, hover, rotor and load rows; hide what does not apply
  ~ FlightScreens.js      the controls card: drop the "(not built yet)" marks on flaps, autopilot, hover
  ~ MapScreen.js, Radar.js  aircraft silhouettes by def.mapIcon
  ~ styles.css            appended
src/world/
  ~ World.js              windX, windZ from OPEN_WORLD.wind
  ~ Airports.js           the major's approach corridor (flatten); nothing else
scripts/
  ~ check-flight.mjs      loads the modules below before its final verdict
  + flight/identity.mjs   F-22 identity, to the bit
  + flight/b737.mjs       trim, stalls, figures, flaps, spoilers, takeoff, landing, crosswind, taxi
  + flight/autopilot.mjs  altitude, heading, speed on all three
  + flight/switching.mjs  Hangar per aircraft, storage keys, placement, eligibility
  + flight/magpie.mjs     hover, assist, sling load, skids, figures   (4b)
  ~ lib/flight-harness.mjs  pilots gain options; helicopter harness
  ~ fit-aircraft.mjs      fit plans for the 737 and (4b) the Magpie
  ~ look.mjs, look-world.mjs  shots of the 737 and the Magpie
HANDOFF.md                section 10k, then 1 and 10.0 at the end
```

No new package. Every tuning value goes in `tuning.js` or the aircraft data with a comment and a range. The car modes are not touched.

## Answers to the 13 decisions (HANDOFF 10j)

1. **One stop or two.** Two (4a, 4b). See above.
2. **Per-aircraft tuning.** `FLIGHT_OVERRIDES` in `tuning.js`, one block per aircraft id, merged as a prototype layer over `FLIGHT` when the physics is built. The F-22 has none, so it is bit-identical, and a test proves it. Each override has a comment and a range. The helicopter reads its own `HELI` block.
3. **Builder split and liveries.** The F-22 builder stays where it is (only its helpers get `export`). New `render/aircraft/b737.js` and `magpie.js`, chosen by `def.model` in `Aircraft.js` (not inside `AircraftBuilder.js`, which would be an import cycle). Liveries per aircraft in `loadouts.js`: the 737 gets fictional airline stripes and a tail logo, no real airline.
4. **The helicopter's name, design and controls.** Keep Magpie 48. Collective W and S, cyclic the arrows (Up pushes the nose down, as everywhere in flight), pedals A and D, H hover assist, K the hook; pad: left stick cyclic, right stick X pedals, right stick Y collective, A the hook, Back held then X hover assist. With hover assist on, W and S command a climb rate. Mouse flight is cyclic.
5. **The 737's figures.** Above: Boeing's for mass, fuel, gear and steering, your spec's for performance, Vref 145 kt an estimate, flap angles not found. Estimates are marked in the data.
6. **Rotor model, assist structure, drift limit.** One disc, momentum theory power with an engine limit, assist as cascaded PD controllers, gains in `HELI`. The check holds 60 seconds of hover in a 4 m/s wind to within 2 m of the start, 1 m of height and 2 degrees of heading, and requires that with assist off the same hover drifts by more than 10 m (so the assist is doing something).
7. **The sling hook and how to test it without missions.** A crate on the ground in front of the helicopter at ground starts, K picks it up and releases it, rope as specified, and a headless check: the load swings (a step in speed gives more than 3 degrees), settles (under 1 degree after 60 s), is felt through the hook (the helicopter needs more collective), rests on the ground when set down, and a load over 1,500 kg is refused.
8. **The autopilot.** P, three holds, the arrow keys and W and S move the targets, a HUD readout; on the helicopter the holds are altitude, heading and ground speed through hover assist.
9. **Wind.** A constant wind in `OPEN_WORLD`, default zero (bit-identical). Crosswind takeoff and landing checks for the 737 at 15 kt. No UI for it until milestone 9.
10. **The major's approach and the 737's airports.** Cut a graded approach corridor at both ends of the major (measured first, reported before I change it), the 737's `minRunway` 1,500 m, bays and hangars left alone, a taxi test with a 30 m turn radius (Boeing's table for the 737-800 with winglets gives a 24.7 m nose gear radius at 40 degrees of steering and 16.3 m at the 78 degree limit, and a 37 m wing tip radius at 40 degrees).
11. **Switching at runtime.** As in "Shared groundwork": rebuild, store `flight.aircraft`, same bay or the nearest airport that can host it, own fuel, reachable only from a bay.
12. **HUD, camera, audio per aircraft.** Camera and eye from data; HUD rows by aircraft; a turbofan hum and a rotor chop, built when each lands. I cannot hear them, so you judge them.
13. **The refit script.** `fit-aircraft.mjs <id>`: for the 737, wave drag to put full thrust at Mach 0.82 at 35,000 ft, the thrust lapse for the 41,000 ft ceiling, each flap's lift scale for its stall speed (to hit Vref), and a report of the takeoff and landing distances; for the Magpie, engine power, thrust and fuselage drag to hit climb, ceiling and top speed. It prints the tables to paste.

## Checks added to `npm run flight` (each as the milestone asks)

- **F-22 identity** to the bit (above), default mesh, wind 0 and the new inputs at rest change nothing.
- **Each aircraft:** trims in level flight (737 at three points, Magpie in hover and at 40 m/s), stalls and recovers (737 clean and at flaps 30 with a keyboard pilot; for the Magpie, which has no wing stall, the power limit and the assist recovering from 60 degrees of bank or pitch), meets its figures within the stated tolerance, frame-rate invariant at seven frame rates and deterministic, no allocation in `step()` over 300,000 steps.
- **737:** flaps lower the stall speed at every detent and add drag, spoilers dump lift and add drag, takeoff within 2,316 m at the major and at the air base, landing within its landing length at the major (once cut) and at the long regionals, crosswind takeoff and landing within the runway, taxi from a stand to the runway on pavement with the wide turns, stops in a hangar bay at the major, gear rests at the right height and brakes stop it.
- **Autopilot:** holds altitude, heading and speed on all three (a step in each, settling inside a band, no oscillation), switches itself off on the ground or in a stall.
- **Magpie:** the hover (above), the figures, the sling load (above), skid contact (rests level, does not creep, does not slide off a slope it should hold, a hard landing is a crash), the assist off and on.
- **Switching and the Hangar:** four records per aircraft under four keys, per-aircraft liveries normalise, a corrupt record costs only itself, setups for all aircraft saved, eligibility and nearest-airport placement, the mass card agrees with the physics.
- **Meshes:** each builder builds under every livery combination, keeps every moving part, wears the paint it was given, and disposes.

## Order of work

0. `npm install`. Record the F-22 goldens on the pristine tree. Measure the major's approach. Report.
1. (4a) Groundwork behind the guard: the `F` layer, flaps, spoilers, wind, accessors, per-aircraft data keys. The identity check passes after every step.
2. (4a) The 737: data, fit, then the checks, then the mesh.
3. (4a) Autopilot, switching, the Hangar, HUD, camera, audio, map icons, the approach corridor.
4. (4a) Full verification, `look` and `look-world` screenshots read, HANDOFF 10k. **Stop. Tell you what to fly.**
5. (4b, after your notes) The Magpie: rotor and power, fit, assist, skids, sling load, then mesh, HUD, audio, Hangar options, checks, screenshots. **Stop.**

## Verification before I call each stop done

- All nine car checks, `npm run flight`, `npm run world` (expect the four known failures that also fail on the pristine tree: three mesh hashes and one chunk-time check, and nothing else), `npx vite build` clean, the dev server starts with no console error or warning.
- `npm run look` and `npm run look-world` with new shots: the 737 and (4b) the Magpie from the apron, the runway, the chase camera, the cockpit, a close-up of the moving surfaces (flaps out, spoilers up, gear down), the Hangar turntable, the map and radar icon, the major's approach before and after the cut, the Magpie with its crate on a heliport. I read every PNG before I say anything looks right. In this container the browser needs `CHROME` pointed at the Playwright Chromium and `CHROME_ARGS=--no-sandbox`.
- A scratch-only throwaway soak at 250 m/s over the land for the 737, to confirm the world streams as before.
- At the end of each stop: nothing is committed unless you ask. If you ask, I commit as you (no Claude trailer) using the cloud command in HANDOFF section 3 and tell you that nothing has reached your computer until it is committed and pushed.

## Risks I want you to know about

- **Fitting the 737** is the hardest tuning: five targets (Mach, ceiling, takeoff, landing, Vref) on a handful of knobs. The refit script makes it repeatable, and if two figures fight I will say which and by how much, not hide it.
- **The helicopter's manual flight** (assist off) is the thing most likely to feel wrong the first time, because I cannot feel it. The numbers and the time series will be right; the feel is yours to judge, and I will change `HELI` first.
- **The Magpie's blocky look** and the 737's proportions need your eye. I will read the screenshots hard, but you will see things I do not.
- **Wall-clock checks** fail on a swapping machine (known); the world check takes the best of three.
