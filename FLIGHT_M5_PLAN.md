# Flight milestone 5: approved plan and implementation state

Written on `Codex_test`, 2026-10-21. User approved by saying "continue with the plan".
The user authorized 5b with "continue with part B". Both halves are implemented and awaiting
their milestone 5 test. Stop here before milestone 6. See HANDOFF.md 10p.
Scope: F-22 and Boeing 737-800 only. Milestone 4a remains under the user's test.
Helicopter milestone 4b remains deferred. No new packages.

## Starting point and constraints

- Checkout: `/Users/harrisoncohen/Documents/racing-game`, origin Harrison-Cohen/Blocky-Games.
- Requested fetch, checkout Codex_test and pull origin Codex_test completed. HEAD is 8559a6a.
  Dependencies already exist. No install needed. No commit, push, merge or rebase.
- AGENTS.md, Claude.md, HANDOFF sections 1, 3, 7, 7a, 10.0, 10k, 10l and 10m,
  FLIGHT.md, FLIGHT_PLAN.md and FLIGHT_M5_PROMPT.md were read, plus both input files.
- Existing uncommitted HANDOFF section 10m describes an earlier missing brief on Flight_test.
  The brief exists on Codex_test. Preserve that history and supersede its status in 10n.
- The existing impact thresholds stay the destruction boundaries. In particular, the 737's
  crashSpeed 5, maxSink 6.5, skidCrashSpeed 7, skidCrashDepth 0.8 and hullCrashDepth 0.6 stay.
- Six F-22 physics hashes and three default mesh hashes stay unchanged. At health 1 new
  modifiers are exactly 1 or 0. No hash updates without explicit permission.
- Damage belongs to physics, not FlightGame or rendering: plain numbers, fixed 120 Hz,
  preallocated arrays and scratch records, no allocation in step(), usable by future AI.
- All tuning belongs in tuning.js with comments and ranges. Part definitions and mappings
  belong in aircraft.js. No package, external art, texture or runtime network additions.
- User preferences: no U+2013/U+2014 punctuation; they/them unless stated; simplest effective
  solution; source uncertain facts; no commits or pushes unless asked in words; Codex_test
  only; never stop their servers on 5173 or 5174. Local edits are already on their Mac.

## Recommended delivery sequence

This is a broad milestone. Recommend two approval/test stops within milestone 5:

1. **5a, damage and recovery state:** part data, headless damage, ground classification,
   gear/flap limit exposure, physical effects, persistence migration, instant hangar repair,
   basic HUD warnings and a development-only damage hook. Extend the headless checks.
   Stop for testing and approval before 5b. The current crash menu remains temporarily.
2. **5b, world impacts and presentation:** airport building collisions, smoke/fire and broken
   part visibility, damage sound, map-based respawn screen, screenshot coverage and full checks.
   Stop for the user's milestone 5 test. No milestone 6 work.

If the user prefers one delivery, execute the same sequence without the intermediate stop.
Approval received for the recommendations and two-stop delivery. The intermediate stop remains.

## Decisions and recommendations

1. **Crash repair:** keep FLIGHT.md's full replacement on crash. All respawns already lead to
   a hangar apron, and hangar repair is instant/free, so restoring a departure snapshot would
   add state without preventing free repair after arrival. Clearly say replacement occurs.
   Surviving aircraft keep their damage until an explicit Repair action. Returning with R or
   teleporting does not silently repair. Save damage before changing aircraft or resetting.
2. **Damage sources:** ground contacts, belly scrapes, tail/wing strikes, gear overspeed while
   extending/retracting/down, and flaps left out while accelerating. Keep the existing refusal
   to extend flaps too fast. Limit damage accumulates by exposure time and excess, with a small
   tunable tolerance, not instant destruction at a placard speed. No random failures, fuel
   starvation damage, spreading fire, general structural overspeed or g damage this milestone.
   Make airport hangars, terminals and towers solid in 5b using their existing layout data.
   Slow wall contact stops motion and damages the contact part; fast contact crashes. Use
   swept part volumes against analytic boxes, bounded broad phase, deterministic contact
   ordering and a preallocated result. Hangar walls and roof are solid, doorway stays open.
   Defer procedural city/scenery building solidity: their placement currently changes with
   graphics density/detail. Trees remain non solid. Rocks and track scenery remain as today.
3. **Parts:** seven health values on both aircraft: left wing, right wing, left engine,
   right engine, tail/fins, landing gear and fuselage. This enables asymmetric lift and
   engine-out yaw without separate health for every flap or wheel. Aircraft data maps each
   health value to surface indices, engine indices, hit volumes, visual anchors and groups.
   Old wings/engines health maps to both children; explicit new child values take precedence.
   Hangar options derive damage rows from this data, not a second independent list.
   Damaged wing scales its side's lift and adds damage drag, composed with existing flap
   modifiers. Tail scales pitch/yaw and relevant control authority including trim/vectoring
   paths as appropriate. Engine health uses the existing thrust multiplier and application
   point. Gear health reduces support travel, braking and steering, increases rolling drag;
   zero health collapses support and uses existing belly contacts. Fuselage zero crashes.
4. **Testing damage:** Vite development-only console hook for setting a named part's health,
   calling the real damage interface. No shipped key, cheat menu or Hangar developer row.
   Headless harness calls the same interface directly. Provide exact commands after building.
5. **Respawn:** reuse MapScreen with an explicit respawn mode instead of a second map UI.
   List left, map right; crash reason and replacement explanation above. Every airport shows
   name, distance from crash, runway length/width or helipad, and eligibility/reason. Nearest
   eligible airport selected initially. Ineligible entries remain visible but cannot spawn.
   Respawn always at chosen airport's hangar apron in the same aircraft, with zero velocity;
   no runway/airborne selector in this mode. Up/Down or W/S and pad D-pad/stick choose;
   Enter/Space or pad A/Start confirm an eligible airport. Explicit Back to title button;
   Esc/pad B opens a small choice of return to respawn or title, never resumes the wreck.
   Mouse map selection, wheel zoom, drag pan and keyboard +/- zoom remain. Recheck eligibility
   at the actual spawn boundary. Ordinary map teleport behaviour stays unchanged.
6. **Repair:** explicit instant, free Repair at a hangar, restoring every health value to 1,
   immediately updating physics and persisted state. No cost/time system before money exists.
7. **HUD/audio:** compact damaged-part list with percentages, amber caution and red critical
   warning at smoke/fire thresholds; one short warning sound on a new/worsening condition,
   no continuous alarm. Engine health changes the existing engine layers, preserving spool
   behaviour. Preserve full-health sound. No voice callouts or full systems failure panel.
8. **Visual budget:** pooled opaque block smoke and flame, no textures, dynamic lights or
   physics debris. Proposed total live damage particles: Low 48, Medium 96, High 160,
   Ultra 224; total emission caps 12/24/40/56 per second, shared across all damaged parts.
   Smoke health <0.6, fire health <0.3; all controls in tuning.js and GRAPHICS_LEVELS.
   Reuse Particles and Materials through a flight-owned pool with an optional capacity;
   car defaults remain unchanged. Origin-safe anchors, clear on respawn, freeze on pause.
   At zero health hide inexpensive preidentified groups (wing/flap groups, tail panels,
   737 nacelles, gear). F-22 embedded engine geometry need not detach. No mesh reparenting
   or group refactor that changes the default mesh goldens. No flying debris in this pass.
9. **Defer:** general structural speed/g damage, progressive fire damage, physical debris,
   procedural scenery/track collision, individual wheels/control surface health, repair
   economy, weapons, helicopter and AI pilots. Airport buildings are the explicit solidity
   boundary for this milestone, subject to user approval.

## Impact classification to implement and test

| Contact | Proposed outcome |
| --- | --- |
| Gentle gear-down touchdown, aligned on pavement | No damage |
| Firm touchdown below today's destruction thresholds | Survive, graded gear damage above tunable onset |
| Low-sink, level belly landing | Survive, fuselage wear and scrape drag, no forward-speed-only crash |
| Tail or wing strike below destruction boundary | Local damage from normal closing speed, attitude and depth |
| Grass/sand/rock/snow/water contact | Surface-specific damage/drag; no assumption that water is pavement |
| Existing hard-hit boundary exceeded | Crash, preserving current reasons and 737 regression cases |
| Slow airport wall strike (5b) | Stop penetration, local damage, no repeated stationary damage |
| High-closing-speed airport wall strike (5b) | Crash; sweep prevents tunnelling |
| Fuselage health reaches zero | Crash regardless of contact |

Use contact onset and exposure, not the same impact charge every resting step. Record contact
side/location with reusable scratch state. Exact damage rates and survivable contact tolerances
are game tuning, validated against existing landing trajectories, not claimed real crash limits.

## Proposed file tree

`+` new, `~` targeted edit. No car gameplay changes.

```text
FLIGHT_M5_PLAN.md                      + proposal and approved decisions later
HANDOFF.md                            ~ progress, verification and next step
src/data/
  aircraft.js                         ~ parts, effect/hit/visual mappings
  tuning.js                           ~ damage/contact/FX knobs and graphics budgets
  loadouts.js                         ~ data-backed rows and legacy health migration
src/flight/
  Damage.js                           + reusable headless health/classification state
  AircraftPhysics.js                  ~ damage inputs, modifiers, limits and crash integration
  Gear.js                             ~ contact details and gear health effects
  Aircraft.js                         ~ apply broken-part visibility at render time
src/core/
  FlightGame.js                       ~ lifecycle, persistence, repair, dev hook, FX
  HangarStore.js                      ~ isolated normalized damage persistence
  FlightPlaces.js                     ~ guarded respawn destination
  FlightAudio.js                      ~ warning and damaged engine layers
src/world/
  AirportCollisions.js                + swept airport structure contacts (5b)
  Airports.js                         ~ shared headless structure bounds
  World.js                            ~ airport collision query
src/render/
  DamageEffects.js                    + pooled origin-aware smoke/fire (5b)
  Particles.js                        ~ optional capacity, car default unchanged
  AircraftBuilder.js                  ~ expose existing F-22 damage groups only
  aircraft/b737.js                    ~ expose existing 737 damage groups only
  AirportMesh.js                      ~ share structure dimensions if needed
src/ui/
  FlightHud.js                        ~ damage readout
  Hangar.js                           ~ repair integration and individual part bars
  MapScreen.js                        ~ respawn mode, eligibility and title flow
  FlightScreens.js                    ~ replace old crash menu wiring (5b)
  styles.css                          ~ targeted damage/respawn styles
scripts/
  flight/damage.mjs                   + physical damage and impact regressions
  flight/damage-store.mjs             + normalization/migration/repair/isolation
  flight/respawn.mjs                  + airport eligibility and selected-aircraft spawn
  check-flight.mjs                    ~ register new checks
  check-world.mjs                     ~ airport collision bounds/sweeps
  look.mjs                           ~ damage, broken part, Repair and respawn shots
  look-world.mjs                     ~ origin-safe FX and airport impacts
```

## Verification and user's test order

- For 5a: asymmetric lift/right-way roll; engine health vs thrust; tail authority; gear support,
  brakes and steering; full impact table; 737 firm/late-flare survival; fuselage-zero crash;
  seven display frame rates, determinism and allocation; storage corruption isolation,
  migration, restart/switch persistence and repair. Trace trim/AP recovery with one wing at
  half health at feasible speed/weight on each aircraft. Do not add a damage-cancelling assist
  or silently weaken this requirement; report if existing authority cannot meet it.
- For 5b: swept thin-wall/wingtip hits at high speed, doorway clearance, no repeated wall
  charge, airport eligibility at actual spawn, same aircraft and correct stationary apron
  pose; all graphics budgets, rebasing, pause and pool cleanup. Dev hook absent in production.
- At final stop: all nine car scripts (check, lap, timing, parts, ai, race, fx, specs, drag),
  npm run flight, npm run world, production build; only documented pristine world failures
  excepted. Use local Vite binary, no package downloads. Start own server on 5175 or another
  unused port with strict port selection; never kill 5173/5174. Check browser console.
- Run npm run look and npm run look-world with shots for both aircraft: smoke, fire, zero-health
  part, respawn list/map and Repair row. Open and inspect every generated image. Report actual
  warnings and limitations, not just an exit status. Measure frame time on this Mac at Medium
  and report resolution and conditions; do not claim hardware performance from headless checks.
- User testing after 5a: ordinary and firm 737 landing first; belly landing; asymmetric wing and
  engine damage via dev hook; gear/brakes; persistence on switching/reload; Repair.
- User testing after 5b: slow taxi wall contact, fast building crash, smoke/fire and missing
  part, nearest/alternative airport respawn, 737 short-runway rejection, pad flow, title exit,
  then full-health F-22 comparison. Stop and await feedback. No milestone 6 work.

## Sources and limits of evidence

- FAA ASCENT Project 23 report, Table 3, page 7 (PDF page 9), lists 737-800 speed-window maxima
  of 250/200/175 kt for flaps 5/15/30, citing operating/training manuals. Supports keeping
  the current game's numbers. It is research evidence, not a directly inspected Boeing AFM.
  https://rosap.ntl.bts.gov/view/dot/89740/dot_89740_DS1.pdf
- FAA 14 CFR 25.473 uses design landing-load descent speeds of 10 ft/s at design landing
  weight and 6 ft/s at design takeoff weight (3.048 and 1.8288 m/s). These are structural
  design cases, not universal survivable sink rates or a reason to lower the game's 6.5 m/s
  737 destruction threshold. No universal real survivability boundary was found.
  https://www.govinfo.gov/link/cfr/14/25?link-type=pdf&sectionnum=479&year=mostrecent
- NG-specific manufacturer/regulator confirmation of gear 270/235/320 kt was not located.
  NTSB's matching figures found during research refer to a 737-300 and must not be presented
  as verification for the -800. Recommend preserving the inherited -800 values as provisional
  game settings; source labels must state the verification gap.

Checklist: [x] sync/read/inspect/research; [x] proposal recorded; [x] user approval;
[x] 5a implementation and automated/visual checks; [ ] user 5a test;
[x] 5b approval/implementation/automated and visual checks; [ ] user milestone 5 test.
See HANDOFF.md 10p for actual verification and the six preexisting identity failures.

## Implementation refinements from 5a traces

- A half-health wing retains 75 percent lift, adds drag and reduces control effectiveness
  through that lift scale. At zero the whole wing loses lift. `FLIGHT_DAMAGE.wingLiftLoss`
  controls this relationship. Treating half health as losing half the entire wing's lift
  exceeded the 737's existing control authority in traces. Health measures condition, not
  remaining wing area. No compensating force was added.
- AP roll trim integrates actual bank error under asymmetric wing damage, bounded by the
  same stick limits and with anti-windup. It is exactly zero on a healthy aircraft. Existing
  pitch auto-trim is unchanged. Tests hold altitude/heading at 300 kt F-22 and 230 kt 737.
- The tail skid protects shallow low-closing-speed scrapes, including the original scripted
  F-22 landing. Deeper/faster strikes damage the tail or cross today's destruction boundary.
- Measurement pilots now start flap configurations below their speed limits, and retract
  landing flaps while accelerating after a stall recovery. The old fixtures held landing
  flaps above limits for extended periods; preserving those would now measure damaged wings.
- Additional files actually used: `src/flight/Autopilot.js`, `scripts/lib/airliner-harness.mjs`,
  targeted existing b737/switching assertions, `scripts/flight/damage-browser.mjs` and
  `scripts/flight/damage-identity.mjs`. The latter compares to an untouched checkout in the
  same runtime without changing or bypassing identity.mjs goldens.
- The critical HUD uses the existing signal-orange alert color, preserving the project palette.
- Smoke, fire, broken mesh visibility, sound changes, airport collisions and map respawn
  are implemented in 5b. The 5a crash menu is replaced. See HANDOFF 10p for the measured
  Medium graphics sample and its limits.



## 5b implementation record

Approved by the user with "continue with part B". The implementation follows the proposed
scope, with lightweight per-part swept hit spheres against shared visible airport boxes.
AirportStructures.js is the shared shape source; AirportCollisions.js is headless. A broken
737 wing destroys its attached engine through aircraft data, preventing floating geometry
and invisible thrust. Missing lifting parts have no passive forces or ground contacts.
DamageEffects.js reuses Particles with an optional capacity; car defaults are unchanged.
MapScreen uses a respawn context instead of a second map implementation. FlightScreens'
existing crash card supplies the exit choices without a separate replacement class.

Additional actual files: scripts/flight/structures.mjs, respawn.mjs, damage-visuals.mjs,
damage-b-browser.mjs and damage-performance.mjs. Standard look and look-world suites are
extended. Full implementation, exact verification, failures and user test order are in
HANDOFF.md 10p. User acceptance is pending; do not start the next milestone.
