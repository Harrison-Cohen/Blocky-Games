# The Magpie 48 helicopter (flight milestone 4b): the approved design, not built

Status as of 2026-10-22: the user approved the two-stop plan for milestone 4 unchanged. **4a (the Boeing 737-800, flaps, spoilers,
autopilot, switching aircraft, the major's approach corridor) is built.** **4b, this helicopter, has NOT been started: the user
took it out of the plan on 2026-10-21 and must say "start 4b" before anyone builds it.** Plan it with them first. This file was
trimmed on 2026-10-22: the parts about the 737 and the shared groundwork were built and now live in the code and `HANDOFF.md`
(section 5); what stays is the helicopter's design, the 737 source notes (they also constrain how any aircraft is fitted), and what
4b still owes. Where this file disagrees with `HANDOFF.md`, `HANDOFF.md` wins.

## What the 737 work found (kept as sources)

Primary source: [Boeing, 737 Airplane Characteristics for Airport Planning, D6-58325-7 Rev C, October 2025](https://www.boeing.com/content/dam/boeing/v2/airports/acaps/737NG_REV_C.pdf).
For the 737-800 with winglets: max takeoff 79,015 kg, operating empty 41,412 kg, max landing 66,360 kg, max zero fuel 62,731 kg,
usable fuel 26,024 L (20,897 kg), wheelbase 15.60 m, main gear track 5.72 m, nose wheel steering 78 degrees (tiller), takeoff
field length about 2.2 to 2.3 km at max takeoff mass (spec: 2,316 m, the FAR field length), landing field length about 1.8 to
1.9 km read off the chart at flaps 30 (spec: 1,600 m, which fits a lighter landing or flaps 40).

**Approach speed is not published**: Boeing computes Vref per weight in the flight computer. Training and sim pages agree on mid
130s to high 140s KIAS at flaps 30 and ordinary weights ([Flyaway Simulation](https://flyawaysimulation.com/ask/answers/boeing-737-landing-speed/),
[Krepelka's notes](https://krepelka.com/fsweb/learningcenter/aircraft/flightnotesboeing737-800.htm), a forum post on
[Infinite Flight](https://community.infiniteflight.com/t/using-the-737-800-900-flaps/191982), final approach Vref plus 5 per
[Flaps 2 Approach](https://www.flaps2approach.com/journal/737-landing-procedure)). The data uses Vref 145 kt calibrated at flaps 30 and
65 t, scaled with the square root of mass, marked an estimate. Real flap detents are 1, 2, 5, 10, 15, 25, 30, 40; the user chose Up,
5, 15, 30. Flap limit speeds (training sources, not Boeing): 5 at 250 kt, 15 at 200, 30 at 175; FAA ASCENT Project 23 Table 3
corroborates the maxima. Gear: extend 270 kt, retract 235, extended limit 320 (training sources). Not found: the trailing edge flap
angle per detent and the lift coefficient at each, so the mesh turns the flaps by the detent number in degrees (unconfirmed) and the
aerodynamics are fitted to stall speeds.

## The Magpie 48 (4b)

- **Design** (approved in `FLIGHT_PLAN.md` section 2; game numbers, not matched to anything real): a blocky-smooth utility helicopter,
  4,800 kg max takeoff, 12 m four-blade main rotor, conventional tail rotor, tall dorsal intake, side-by-side cockpit and a six-seat
  cabin with sliding doors, skids, short stub wings with a gun pod and two rocket pods (weapons are milestone 7), a belly hook. Blades
  turn (visual), with a translucent disc when fast. A crate and a rope are drawn for the sling load.
- **Rotor and power** (`Rotor.js`, constants in a new `HELI` block in `tuning.js`): thrust along the disc normal, collective times
  maximum times density, with rotor lag, ground effect (a thrust gain within about one rotor diameter), a translational lift gain
  (a bump that peaks near 13 m/s and fades) and an inflow loss in a fast climb. Power by momentum theory (induced power from thrust
  and airspeed, a profile term that grows with speed, plus parasite and climb terms): if the power asked for exceeds what the engine
  gives at that density, thrust falls, so the helicopter sinks at the ceiling and past its top speed. The three game figures (top
  speed 75 m/s, climb 10 m/s at sea level at 4,300 kg, ceiling 5,000 m with 0.5 m/s of climb) come out of the model, not clamps. No
  blades as wings (SimpleRotors does that; the user ruled out the heavier model).
- **Control**: cyclic tilts the disc normal (limited, with a flapping lag) and the thrust offset from the centre of mass makes the
  pitch and roll moment plus a hub moment term. Torque reaction yaws the fuselage; the tail rotor (pedals) counters it with a fixed
  mixing fraction so manual flight is possible. Fuselage drag differs by axis, a small tail effect gives weathercock and pitch damping,
  rate damping supplies the feel.
- **Hover assist** (H, switchable any time, on by default, strength a knob the Hangar's assist tune scales): cascaded PD controllers.
  Cyclic centred: ground velocity to zero (outer loop) driving a level attitude (inner loop). Cyclic deflected: an attitude command,
  and on release the velocity loop brakes it. Collective centred: vertical speed to zero, with W and S as a climb-rate command while
  assist is on (a lever when off). Pedals centred: heading hold, deflected: a yaw-rate command. Off below 0.5 m over the ground with
  the weight on the skids. Assist off is manual.
- **Skids** (`Gear.js`): contact points with a spring and damper and sliding friction (no rolling, a friction coefficient per
  surface), a static hold so it does not creep, hard-landing thresholds.
- **Sling load** (`SlingLoad.js`): a point mass on a 10 m rope that is a spring and damper that only pulls; hook rating 1,500 kg. It
  swings, has air drag so it settles, rests on `world.sample` when set down, and its weight pulls on the hook point so the helicopter
  feels it. K picks up the nearest free crate within reach and releases it. A crate stands in front of the helicopter at every ground
  start (a test crate until missions arrive in milestone 8).
- **Controls**: collective W and S, cyclic the arrows (Up pushes the nose down, as everywhere in flight), pedals A and D, H hover
  assist, K the hook. Pad: left stick cyclic, right stick X pedals, right stick Y collective, A the hook (A is the afterburner on the
  jets and does nothing on a helicopter), Back held then X hover assist. With assist on, W and S command a climb rate. Mouse flight
  is cyclic. `FlightInput` already collects the `hover` and `hook` actions; nothing reads them.
- **Autopilot on the helicopter**: the holds are altitude, heading and ground speed, set through hover assist's targets.

## What 4b still owes (a file tree)

```
src/flight/   + HelicopterPhysics.js (rotor body, controls, hover assist, skids, hook)   + Rotor.js   + SlingLoad.js
              ~ Gear.js (skid contact)   ~ Autopilot.js (helicopter targets)
src/data/     ~ aircraft.js (MAGPIE entry, AIRCRAFT = [F22, B737, MAGPIE], kind 'rotor')   ~ loadouts.js (rescue passengers, gun rounds,
              rockets as weight only, hook, tune knobs where "assist" is hover assist strength)   ~ tuning.js (HELI block, audio
              profile)   ~ flightInstruments.js (an instrument profile; do not invent sensors)
src/render/   + aircraft/magpie.js (mesh, rotor, rope, crate)   ~ aircraft/cockpits.js (its own interior builder, or it gets a
              placeholder block; BUILDERS is keyed by the aircraft's model)
src/core,ui/  ~ FlightGame.js (hover, hook)   ~ FlightHud.js (collective, power, hover assist, hook and load rows)   ~ FlightAudio.js
              (a rotor chop that follows load)   ~ Hangar.js, MapScreen.js (silhouette by mapIcon)
scripts/      + flight/magpie.mjs (hover, assist, sling load, skids, figures)   ~ lib/flight-harness.mjs (a helicopter harness)
              ~ fit-aircraft.mjs (a fit plan: engine power, thrust and fuselage drag to hit climb, ceiling and top speed)
              ~ look.mjs, look-world.mjs (shots with the crate on a heliport)
```

Checks the user approved for it: trims in hover and at 40 m/s; hover for 60 s in a 4 m/s wind within 2 m of the start, 1 m of height
and 2 degrees of heading, and with assist off the same hover drifts more than 10 m; the three figures; the assist recovers from 60
degrees of bank or pitch; the load swings (a step in speed gives more than 3 degrees), settles (under 1 degree after 60 s), is felt
through the hook, rests on the ground when set down, and a load over 1,500 kg is refused; skid contact (rests level, does not creep,
a hard landing is a crash); frame-rate invariant at seven rates, deterministic, no allocation over 300,000 steps. The F-22 and the
737 must stay identical: the identity hashes in `HANDOFF.md` section 3 must not move because of helicopter work.

Risks: the helicopter's manual flight (assist off) is the thing most likely to feel wrong the first time, because the agent cannot
feel it (change `HELI` first, and look at the time series); the blocky look needs the user's eye.
