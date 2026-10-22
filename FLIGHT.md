# Claude Code build spec: flight addition

Read order: `HANDOFF.md`, then `Claude.md`, then `PROMPT.md`, then this file. This file adds a second game mode to the finished racing game. It does not replace anything in the other three.

---

## The build

Add a flying game to the racing game: a large open world you fly through in three aircraft, with free flight, air races, AI pilots, dogfights and missions. Everything runs in the browser from my own machine, as the racing game does.

- Aircraft: an F-22 Raptor, a Boeing 737-800, and an invented helicopter.
- World: one large world with a biome for each race track. The tracks sit in it as flyover scenery with AI drivers on them. Adding a track file adds a new area to the world and to the map by itself.
- Single player. Everything unlocked for now, behind one `isUnlocked()` function so progression can be added later.

This is a large build. Do not start coding. Start in plan mode and give me:

1. Your plan for milestone 1 and the file tree you intend to create.
2. Anything in this spec you think is wrong, conflicts with the existing code, or will not work.
3. Your answer to each item in "Open items for your plan" at the bottom.

Build in the milestone order at the bottom and stop after each milestone so I can fly it and give feedback. Same workflow as the car game.

## Rules that carry over, and what changes

Everything in `Claude.md` still applies. The ones that matter most here:

- Vite + vanilla JavaScript (ES modules) + Three.js. No new packages, dev dependencies included. Ask first.
- Every gameplay constant lives in `src/data/tuning.js`, each with a comment and a sane range. I edit that file constantly. Never hardcode a tuning value elsewhere.
- Physics runs on a fixed 120 Hz timestep with an accumulator, and rendering interpolates. Handling must be identical at any frame rate.
- Physics is headless: plain numbers, no Three.js objects, no DOM, no allocation in `step()`. Every system must be testable in Node with no renderer.
- Targeted edits to existing files. Never rewrite a whole file to change a few lines.
- No external art assets and no textures. Every mesh is built in code. Every material comes from `src/render/Materials.js`.
- No network calls at runtime. Fonts stay self-hosted.
- Data over code: a new track, race course, mission or dogfight arena is one file in its folder, found by a registry that uses `import.meta.glob`, the way `src/data/tracks/index.js` works. If adding one needs a change anywhere else, the system is wrong.
- AI vehicles run the same physics as the player and are driven by an input layer. Never move an AI car or aircraft along a path.

What this spec changes, on purpose:

1. **Flight is separate code.** New folders `src/flight/` and `src/world/`, with data in `src/data/`. Shared infrastructure (Loop, Input, Scene, Audio, Storage, Materials, Effects, Particles, the Menu classes, the Garage turntable, PostFX) is reused. Car modes must not change behaviour. All nine existing checks must pass at every milestone.
2. **Two narrow exceptions to the "never move along a path" rule, both for distant scenery only:**
   - Ambient AI cars on the race tracks replay laps recorded from the real `VehiclePhysics` and `AIDriver` while they are far from the camera, and hand over to live AI driving when the player comes near. The hand-over must start from the replay's exact position, heading and speed so nothing pops.
   - Ambient air traffic and road traffic follow their routes while far away, and air traffic hands over to live `AircraftPhysics` and `AIPilot` when near, in the same way. Road traffic is scenery and stays on its route.
   - Anything the player races, fights or collides with is always live physics.
3. **Cosmetics never change handling** still holds. The hangar's loadout and tuning are the exception, like the gearbox tune: kept apart from cosmetics, stored under their own key, never reaching AI.
4. **Performance:** 60 fps on a MacBook Air M5 with 16 GB at the default render distance and Medium graphics. Ultra may go beyond that. Keep expensive features behind knobs, and extend the existing `GRAPHICS_LEVELS` to cover the world.
5. **Units:** the cars use mph. Aircraft default to knots, feet and Mach, with a setting for mph and metric.

## Where it lives

A proposal. Adjust it in your plan and tell me why.

```
src/
  flight/     AircraftPhysics.js  Wing.js  Rotor.js  Engine.js  Atmosphere.js
              Gear.js  Damage.js  Autopilot.js  Aircraft.js
              Weapons.js  Cannon.js  Missile.js  Flares.js
              AIPilot.js  AirRace.js  Dogfight.js  Mission.js  Scoring.js
  world/      World.js  Heightfield.js  Biomes.js  Chunks.js  WorldOrigin.js
              Airports.js  Placement.js  Water.js  Cities.js  Roads.js
              TimeOfDay.js  Weather.js  Wind.js  Traffic.js  ProxyTraffic.js
              TrackAreas.js  MapData.js
  data/       aircraft.js  airports.js  loadouts.js
              air-races/ (index.js + one file per course)
              missions/  (index.js + one file per mission)
              arenas/    (index.js + one file per dogfight arena)
  render/     AircraftBuilder.js  WorldMesh.js  Clouds.js  WeatherFX.js  Sky additions
  ui/         FlightHud.js  Cockpit.js  MapScreen.js  Hangar.js  Respawn.js
              FlightScreens.js  AirRaceScreens.js  MissionScreens.js
  core/       FlightGame.js  FlightAudio.js
scripts/      check-flight.mjs  check-world.mjs  check-combat.mjs
              check-airrace.mjs  check-missions.mjs
```

New npm scripts: `flight`, `world`, `combat`, `airrace`, `missions`. Each runs headless against the real modules, like the nine that exist. Run all fourteen before calling a milestone done, plus `npx vite build --outDir <scratch>`.

## The three aircraft

Use the real figures where they are published, tuned the way `fit-specs.mjs` tunes the cars. Where I list a figure as an estimate, find a source, say what you found, and say so if you cannot.

### F-22 Raptor (fighter)

Published (US Air Force fact sheet, Lockheed Martin, Wikipedia):

- Length 18.9 m, wingspan 13.6 m, height 5.1 m, wing area about 78 m2 (840 sq ft).
- Empty mass 19,700 kg, maximum takeoff mass 38,000 kg, internal fuel 8,200 kg.
- Two Pratt and Whitney F119 engines, 35,000 lbf class each in afterburner (about 156 kN). Thrust to weight near 1.0 at typical combat weight on military power and about 1.25 with afterburner.
- Mach 2 class top speed. Supercruise: sustained supersonic flight above Mach 1.5 without afterburner.
- Service ceiling above 50,000 ft. Limit of +9 g.
- Two-dimensional thrust vectoring nozzles, plus or minus 20 degrees in pitch.
- One 20 mm M61A2 cannon with 480 rounds. Real loadout is two short-range infrared missiles and six medium-range radar missiles. In this game there is one missile type, heat-seeking, so the loadout is a count (default 6, maximum 8).

Handling goal: extremely agile and responsive, fast, with a strong climb. The thrust vectoring gives it control at low speed and high angle of attack that nothing else has. Stall exists but is soft and recoverable.

### Boeing 737-800 (airliner)

Published (Boeing and Wikipedia):

- Length 39.47 m, wingspan 35.79 m with winglets, wing area 124.6 m2.
- Empty mass 41,413 kg, maximum takeoff mass 79,016 kg. Fuel 26,020 litres.
- Two CFM56-7B26 engines at about 117 kN (26,300 lbf) each.
- Cruise Mach 0.785, maximum Mach 0.82. Service ceiling 41,000 ft.
- Takeoff field length 2,316 m, landing field length 1,600 m. 162 seats in two classes.
- Approach speed is not in my sources. It is about 130 to 145 knots at landing weight, but find a real figure.

Handling goal: heavy, stable, slow to respond, needs its flaps and a long runway. The 737 is the aircraft that makes airports matter. Flaps have three detents and visibly change lift, drag and stall speed. Payload (passengers and cargo) changes mass. Autopilot is most useful here.

### The helicopter (invented)

Invent a name and a blocky-smooth design in the same style as the cars. Propose both in your plan. These are game numbers, not matched to anything real. Starting point:

- Maximum takeoff mass about 4,800 kg, main rotor diameter about 12 m.
- Top speed about 75 m/s (145 knots), climb about 10 m/s, ceiling about 5,000 m.
- Sling hook rated for about 1,500 kg. Seats for rescue passengers.
- Gun pod and unguided rockets (see Weapons).

Handling goal: agile and hovering, easy to land, with a hover assist that can be switched off (see the helicopter model below).

### Shared

- Each aircraft has a data entry in `src/data/aircraft.js`: mass, dimensions, wing and tail surfaces with their curves, engine and thrust, gear positions, damage parts, hit volumes, systems, cockpit eye point, the hangar options, and the figures it was tuned to. The garage card shows those figures the way the car card does.
- A script like `scripts/fit-specs.mjs` should refit an aircraft to its published numbers after a tuning change. `npm run flight` holds each aircraft to them.
- Scaled figures: do not scale the real aircraft down. The world is large enough for real speeds.
- Look: smooth shaded with a specular highlight (`glossy()`), lofted panels like the car bodies, round wheels, details placed on the surface. Spend polygons here. The fighter, the 737 and the helicopter must read as what they are at a glance, from the chase camera and from the map.

## The flight model

The simplest thing that gives real lift, drag, thrust and a stall you can recover from. Not a kinematic model: a plane that goes where the nose points with no lift is too arcade for the feel I picked. The approach below follows the SimpleWings idea (each wing has a lift curve and a drag curve against angle of attack, and stall comes out of the curve data) rather than a full aerodynamic model.

### Aircraft physics

- A rigid body with position (kept as absolute doubles), velocity, orientation (a quaternion) and angular velocity. Decide the body frame in your plan and document it. Match the world frame used today: +y up, a car's nose along +z, and the car's right at -x. Say which you chose and why.
- A short list of lifting surfaces: a wing on each side, a tailplane, a fin. Fewer is better. Each surface has an area, a position in the body frame, a normal, and a control authority.
- For each surface, each step: find the local airflow at the surface (velocity plus the rotation term), compute the angle of attack, look up CL and CD from that surface's curves, and apply `0.5 * rho * v^2 * S * C`. Lift is perpendicular to the local airflow, drag opposes it. Apply the force at the surface's position so torque comes out of the geometry.
- Curves: lift rises roughly linearly with angle of attack, peaks near 15 to 18 degrees, falls away sharply (that is the stall), then follows a flat plate. Drag is a base term plus an induced term that grows with lift squared, plus the flat plate term past the stall. One small function per curve, with its points in `aircraft.js`, so I can sharpen or soften the stall.
- Control surfaces move the effective angle of attack of the surface they sit on. Authority fades with dynamic pressure at high speed so the aircraft stays stable when fast. A rate damping term per axis, in `tuning.js`, supplies the feel.
- Atmosphere: air density and speed of sound from altitude in one small function (`Atmosphere.js`). Mach number and true airspeed must come out right.
- Thrust acts along the engine axis. It depends on throttle, altitude and speed. The fighter has afterburner with its own fuel tank that drains while on and refills over time.
- Fighter thrust vectoring: a pitch torque (and optionally yaw) that does not depend on airspeed, plus or minus 20 degrees of nozzle, fading out as aerodynamic control takes over.

### The middle-ground aids

Every one is a knob in `tuning.js`, with a master switch, so I can take them away and feel the difference:

- Roll self-levelling when the stick is centred, gentle.
- Angle-of-attack softening near stall, so the nose mushes down rather than snapping into a spin.
- A recoverable stall and spin: lower the nose, add thrust, centre the stick.
- Auto-trim. No trim controls.
- Stall warning shown and heard before the stall.

### Ground handling

- Landing gear is three wheels (nose and two mains, plus tail or skid variants as the aircraft needs) with a spring and damper against the ground query, the same pattern as `VehiclePhysics`. Nose wheel steering, wheel brakes, rolling resistance, and weathercocking in a crosswind.
- Gear can be raised and lowered. It has drag. Raising or lowering it above its limit speed damages it. Landing gear up is survivable but scrapes the belly and damages the fuselage.
- The ground query is `World.sample(x, z, y)`, analytic like `Track.sample`: height, normal and surface type (runway, taxiway, apron, grass, sand, rock, snow, water, tarmac of a race track). No raycasts.

### The helicopter model

Do not model blades. Use a single rotor disc:

- Rotor thrust along the disc normal, driven by collective, with ground effect and a translational lift gain.
- Cyclic tilts the disc normal, limited, which gives pitch and roll.
- Torque reaction yaws the fuselage and the tail rotor (pedals) counters it.
- Fuselage drag and a small stabilising effect from the tail.
- **Hover assist**, switchable at any time: PD controllers hold level attitude, hold vertical speed when the collective is centred, hold zero ground velocity when the cyclic is centred, and hold heading when the pedals are centred. Assist off is manual cyclic, collective and anti-torque. The assist strength is a knob.
- Sling load: the load is a point mass on a rope modelled as a spring and damper that only pulls. It swings, drags, can be set down, and its mass is felt through the hook.

### Systems

Landing gear and wheel brakes. Flaps (three detents on the 737, a combat setting on the fighter). Airbrakes (the fighter and the 737 spoilers). Afterburner. Autopilot with altitude hold, heading hold and speed hold, on all three, most useful on the 737. All switchable by key and pad.

## Damage, crashes and respawn

- Damage is per part. Each aircraft lists its parts in `aircraft.js`: wings, tail or fin, engines (or rotor and tail rotor), gear, fuselage. Each part has health from 0 to 1.
- Effects: a damaged wing loses lift on its side and rolls the aircraft. Engine damage loses thrust. Tail damage loses control authority. Gear damage affects landing and ground handling. Rotor damage loses thrust and adds vibration. Fuselage health at zero destroys the aircraft.
- Visuals: smoke below 60 percent, fire below 30 percent, parts that break off at zero where it is cheap.
- A hard impact is classified by vertical speed, closing speed, attitude, surface and gear state. Gentle touchdowns and belly landings are survivable. A hard hit or a destroyed fuselage is a crash.
- Survivable damage carries over between flights, per aircraft, until repaired at a hangar.
- A crash shows the respawn screen. You choose any airport from a list (name, distance, runway size) with the map beside it. You come back at that airport's hangar apron in the same aircraft, with a destroyed airframe replaced (repaired). That repair rule is mine, to keep a crash from locking you out of an aircraft. Tell me if you see a reason it is wrong.
- Damage applies to AI aircraft the same way, through the same code.

## The world

### Size and generation

- Large: default 120 km square, set in `WORLD` in `tuning.js`. Nothing that costs time or memory may scale with the area of the world. Everything near the player is generated on demand from a fixed seed, so the same airports, cities and coasts are in the same places on every launch.
- One height function `Heightfield.height(x, z)`, built from layered seeded noise written in code (no packages). The mesh and the physics both call it. It handles mountains, canyons, valleys, plains, coast, ocean and islands, and flattens smoothly around airports and track areas.
- Terrain is built in chunks on demand, with a few detail rings (near, mid, far) and skirts so there are no cracks between rings. Chunk building is spread over frames with a time budget per frame. Decide in your plan whether it needs a Web Worker.
- **Render distance slider** in Settings, stored in `Storage`. Range and default in `WORLD`. It scales the chunk rings, the fog and the prop density together. Each graphics level caps it.
- Props (trees, rocks, buildings, towers) are instanced per chunk and thinned by detail ring.

### Floating origin

The world is far bigger than float32 can draw cleanly. Physics stays in absolute double-precision coordinates. The scene graph is placed through one class, `WorldOrigin`, which keeps rendered objects near zero and rebases when the camera drifts too far (for example past 2 km). Everything that touches world positions goes through it: chunks, instanced props, particles, lights, the shadow camera, the sky, fog, trails. Rebasing must never change physics results, and `npm run world` proves that by flying a scripted route with and without rebases and comparing.

### Biomes and the race tracks

- Each track becomes an area in the world. A track file may carry an optional block like `world: { biome, placement, heading, radius }`. If it has none, the system chooses a place and a biome itself from the track's palette, terrain settings and surfaces.
- Biomes needed from the six tracks today: desert (Copper Flats), coastal port (Harbor Nine, which needs a coast), forest hills (Pine Ridge), city (Skyline Interchange, which needs a real downtown for city courses), snow mountains (Glacier Pass), flat dry desert (Mesa Dragway). Biomes blend into each other over a transition band, with ground colour, props and fog tint following each track's palette.
- Placement: deterministic from the seed, keeps areas apart, honours the optional hint. Adding a track file must add a new area and a new map entry with no other change.
- Track meshes are built with the existing `TrackMesh` from the existing track data, placed with a transform (position and heading), and built only while within render distance. The track's own ground, road and verge blend into the world's height function over a blend band. Keep `Track` in its own local coordinates and convert in a wrapper. This is the hardest integration in the project. Plan it carefully and tell me if the existing classes cannot do it without a change that could affect the car modes.
- The six tracks must still load and play exactly as before from the car menus.

### Track AI

- Each track area has a few AI cars lapping it continuously. They are scenery with life, not a race. They use `RacingLine`, `AIDriver` and `VehiclePhysics` unchanged.
- Live near the player, replay far away, as in the rules above. Recordings are made headlessly by the real physics (one lap per car, at load or lazily when the area first comes into range) and kept in memory.
- Different chassis and liveries from the opponents list.

### Airports

- Tiered, all generated from data and the seed: one major airport with a long runway for the 737 (at least 3.2 km), regional airstrips, a military base for the fighter, heliports, and a small airstrip beside every track area, placed from that track's position and heading.
- Each airport has a runway (or helipad) with a heading and surface, taxiways, an apron, a tower, lights, and a hangar area. Every airport has a hangar apron.
- Airports are data. A track-area airstrip appears automatically when a track is added.
- Terrain is flattened and graded smoothly around them. `npm run world` checks runway slope, length and clearance.

### The rest of the world

- Cities with tall buildings (instanced boxes), enough for the city race courses.
- Canyons and mountain ranges, enough for the canyon courses.
- Ocean, coast and islands. Water is a flat-shaded blocky surface with a simple wave animation, no textures.
- Roads between towns and ground traffic on them. This is scenery.
- Air traffic: airliners on routes between the major airports, aircraft parked on aprons. Far away they follow their route, near you they fly live.
- Landmarks you can fly through or around (a big arch, a bridge, a tower), used by the stunt missions.
- Aircraft collide with terrain, buildings, landmarks and other aircraft. Trees are scenery and do not collide. Ask me in your plan if you think they should.

### Time of day and weather

- One global day and night cycle, with a time-of-day setting and a speed setting (including paused). Race tracks loaded from the car menus keep their own fixed lighting as today.
- At night: airport and runway lights, city lights, aircraft navigation lights and landing lights, built on the lighting ideas already in `TrackLights` and `HeadlightPool`.
- Weather, each with its own switch in Settings, all off-able:
  - Wind and turbulence: a global wind with gusts and local noise, felt on the runway as a crosswind and in the air as bumps.
  - Clouds you can fly through: chunky layered clouds, visibility drops inside them.
  - Rain and storms in some regions, with lightning flashes and strong turbulence, drifting slowly.
  - Fog banks in valleys and over water.
- Everything is flat shaded and faceted to match the world. No textures.

### Map and radar

- A full-screen map drawn from the same world data: coarse terrain colouring, ocean, biomes, airports, track areas, mission markers, race course starts, hostile zones. Because it reads the registries, new tracks and courses appear on it by themselves.
- The map has a teleport-to-airport option in free flight.
- A corner radar shows nearby aircraft, missiles and targets, and the compass heading.

## Modes

### Menus and flow

- The title screen gets a "Fly" entry. Fly opens: Free flight, Air race, Dogfight, Missions, Hangar, Map. Buttons say what happens ("Start free flight", "Open the hangar"), no all caps, no arrows after button text.
- Free flight starts you on the apron of the last airport you used. Settings offer "Start on the apron", "Start on the runway" and "Start airborne near the airport" (airborne is for testing).
- Pause has: resume, restart, change aircraft (only at a hangar), map, settings, back to the title.
- Settings (flight): render distance, HUD on or off, units, each audio category on or off, each weather feature on or off, time of day and speed, input options. Keep them in the same `Menu` style as the rest.

### Hangar

Reached by taxiing into a hangar zone and stopping, or from the Fly menu. Same turntable preview as the car garage, same hard-edged panels, Save and Discard pinned at the bottom.

- Switch aircraft (only here).
- Repair, with per-part health bars.
- Paint and livery: the existing 12-colour palette and patterns where they fit, plus a tail number. The 737 gets fictional airline-style stripes (no real airlines). The fighter gets a fictional insignia.
- Loadout and tuning: fighter missile count, cannon rounds and flares; 737 payload (passengers and cargo, which changes mass); helicopter hook and weapons. Tuning knobs such as power, control response and assist strength, like the gearbox tune. Stored apart from cosmetics, under its own key, per aircraft.
- Afterburner fuel is not refilled here, it refills in flight.

### Free flight

A plain open-world sandbox. No objectives. Ambient traffic and track AI are on. The player can switch hostile zones and ambient traffic on or off.

### Air races

- Course types: lap circuits through gates, point-to-point sprints, low-level canyon courses and city courses. Open to every aircraft.
- Courses are data files in `src/data/air-races/`, one file each, in world coordinates or relative to a place. Gates are large blocky rings or hoops with a clear next-gate cue. At least four courses to start: one circuit, one sprint, one canyon, one city.
- Timing reuses the ideas of `LapTimer`, `Checkpoints` and `GhostRecorder`: crossings interpolated inside the physics step, sectors, live delta in the motorsport colours, a ghost recorded at 30 Hz, results with the best possible lap. A missed gate or touching the ground on a low-level course invalidates a lap. Records and ghosts are stored per course per aircraft.
- AI pilots race with the same physics as the player. They fly the same aircraft type as you, so a race is fair, in a field of up to 7, with Rookie, Club and Pro difficulty (speed target, margin, mistake rate). No rubber banding by default; keep the `catchUp` toggle in `tuning.js`, off.
- Race setup lives on a course select screen, with the course card showing its map.

### Dogfights and combat

Three structures, all using the same combat code:

1. **Dogfight mode:** pick an arena, an aircraft, a number of AI fighters and a difficulty, then fight. Arenas are data files in `src/data/arenas/`. The first to a kill limit, or last one flying, wins.
2. **Hostile AI in free flight:** marked hostile zones where AI patrols roam. They only exist near you, and you can engage any time. Zones are on the map.
3. **Wave survival:** waves of AI aircraft that get tougher, scored by kills and time.

Only armed aircraft fight: the fighter and the helicopter. The 737 is unarmed and is not offered in combat modes.

Weapons:

- **Cannon:** 20 mm, 480 rounds, about 100 rounds per second. Tracers fly a real ballistic path with gravity. A lead-aim marker shows where to fire. Hits are found by testing the path of each round against hit volumes, and damage goes to the part hit.
- **Heat-seeking missiles:** a seeker cone and a lock tone before firing, limited count, a motor that burns then coasts, and guidance that is augmented proportional navigation (gain about 3 to 5, steering on the line-of-sight rate), with a turn-rate cap. A missile fuses on contact or a close pass.
- **Flares:** dispensed in bursts. Each flare is a hot decoy that cools. A seeker locks the hottest source in its cone, so flares can pull a missile away. AI use flares too.
- **Helicopter:** a gun pod (slower rounds, shorter range) and unguided rockets in salvos.
- Warnings: missile lock, missile launch at you, incoming missile, in HUD and in sound.

AI pilots in combat use a simple state machine on top of the same physics: pursue with lead, fire when in the cone and in range, launch when locked, break and flare when a missile is inbound, disengage when badly damaged, avoid terrain. They have the same limits as the player.

### Missions

Four types, as data files in `src/data/missions/`, one file each, with medal thresholds:

1. **Landing challenges** (best with the 737): a runway and an approach start. Scored on touchdown vertical speed, centreline offset, distance from the threshold, bounces and crosswind.
2. **Cargo and passenger routes:** fly between two airports on a route, scored on time and on smoothness (g loads, bank angle, turbulence), with the payload changing mass.
3. **Helicopter rescue and sling loads:** pick up people or a crate at remote points, deliver to a pad. The sling load is the swinging mass model above.
4. **Stunt and aerobatic scoring:** loops, rolls, inverted flight, low passes, flying through landmarks, scored for style and precision on a timer.

Start a mission two ways: fly or taxi to its marker in the world, or pick it from the Missions list, which places you at the start. Medals (bronze, silver, gold) and best scores are stored per mission per aircraft.

## HUD, cockpit, cameras, controls

### HUD

- A HUD I can switch on and off. When on: speed, altitude, vertical speed, heading, an artificial horizon with a pitch ladder, angle of attack, g load, throttle, gear, flaps, brakes, afterburner fuel, a damage panel, warnings, and the radar. In combat: target boxes, lock, lead marker, ammo, missiles and flares. In races and missions: the timing or task panel.
- Same look as the rest: Martian Mono for numbers, Archivo for labels, hard-edged panels, the existing palette and timing colours.

### Cameras

Chase (spring-damped, lags in turns, pulls back with speed), cockpit with a modelled instrument panel that works, far orbit, and free look. Cycle with the camera key; free look with the mouse or right stick.

### Controls

Keyboard, gamepad and mouse flight, and a gamepad flight stick works the same as a pad. Keys can be reused from the car game because the modes are separate. Propose a full mapping in your plan for me to approve. It must have no clashes inside flight mode and must cover:

- Pitch, roll, yaw, throttle up and down, afterburner.
- Gear, flaps, airbrake, wheel brake, autopilot, hover assist.
- Cannon, missile, flares, target cycle.
- Camera, free look, HUD, map, pause, reset to the hangar.
- Mouse flight: the mouse steers pitch and roll with a deadzone, switchable. Invert Y is a setting.

Show the controls on the pause card and on first launch, as the car game does.

## Audio

All synthesized with Web Audio, no sound files, in a new `FlightAudio.js` beside the car `SoundEngine`. Each category has its own switch in Settings:

- Engines per aircraft: jet whine and afterburner roar, a turbofan hum, rotor chop that follows load.
- Wind and airframe noise: rises with speed. Gear and flap thumps, tyre squeal on touchdown.
- Warning tones: stall, terrain pull-up, missile lock, missile launch, incoming missile, gear up, damage.
- Radio chatter with a synthetic voice using the browser's speech synthesis: tower calls and callouts. If no voice is available on the machine, this category is simply silent. Quality varies by machine, so keep the text short.

Build each category when its feature lands. Mute when the tab is hidden. One master volume.

## Saving

Everything through `Storage`: aircraft liveries, damage, hangar tunes and loadouts, last airport, race records and ghosts, mission scores, and all settings. Normalise on the way in, like the car data.

## Checks (headless)

- `npm run flight`: each aircraft trims in level flight, stalls and recovers, meets its published figures within a tolerance, is frame-rate invariant and deterministic; the helicopter hovers with assist on within a set drift for 60 seconds; gear contact and braking behave; damage changes handling as designed.
- `npm run world`: the height function is deterministic and cracks do not appear between chunk rings; mesh and physics heights agree; airports are flat enough and long enough; every track is placed without overlap and every airport and course sits on land; rebasing never changes physics.
- `npm run combat`: cannon hits, missiles hit a steady target and are beaten by flares sometimes, AI dogfights are deterministic, damage lands on the right part.
- `npm run airrace`: AI pilots finish every course, gate crossings and timing are right, ghosts replay exactly.
- `npm run missions`: a scripted run completes each mission type and scores sensibly.

## Milestones

Stop after each one and tell me what to test. Do not roll into the next on your own.

1. **Flight physics and the F-22 on a test field.** Headless `AircraftPhysics`, `Wing`, `Engine`, `Atmosphere`, the F-22 data and the first version of its body, a flat test field with a runway, chase camera, a minimal HUD (speed, altitude, angle of attack, horizon), keyboard, gamepad and mouse flight, basic engine sound, the title screen's Fly entry, `npm run flight`.
2. **The open world.** `Heightfield`, chunk streaming, the render distance slider, `WorldOrigin`, biomes, the six tracks placed in it and visible, the AI cars on them (live near, replay far), sky and fog. Fly over it. `npm run world`.
3. **Airports and the ground.** Tiered airports, runway and taxiway lights, landing gear and wheel brakes, nose wheel steering, the hangar zone and the Hangar screen (switch, repair, paint and loadout in place for the F-22), the full map screen and radar, the three start options.
4. **The 737 and the helicopter.** Their bodies, flight models, flaps, airbrakes, autopilot, hover assist, sling hook, tuned to their figures, switching aircraft in the hangar, a refit script.
5. **Damage, crashes and respawn.** Per-part damage, impact classification, smoke and fire, repair at the hangar, the respawn screen, persistence.
6. **Air races and AI pilots.** Gates, the four starter courses, timing, ghosts, records, results, AI pilots with difficulty tiers, course select screen. `npm run airrace`.
7. **Weapons and dogfights.** Cannon, missiles, flares, helicopter weapons, lock and warnings, combat AI, arenas, hostile zones in free flight, wave survival, radar targets. `npm run combat`.
8. **Missions.** The four types, markers in the world and the menu list, scoring and medals, the sling load. `npm run missions`.
9. **The living world.** Day and night, wind and turbulence, clouds, rain and storms, fog banks, ground traffic, air traffic, landmarks, ocean and island detail, radio chatter, and every settings switch.
10. **Polish and performance.** Graphics levels for the world, dynamic resolution, a measured frame-time table like the one in `HANDOFF.md`, controls card, settings completeness, rough edges, and `HANDOFF.md` brought up to date.

## Workflow

- Plan mode first. Stop at the end of each milestone, say exactly what to test, and wait.
- I run the game and fly it in the browser. You cannot see the screen, so never assume something looks or flies right. Ask me.
- Before saying a milestone is done: all fourteen checks pass (nine existing plus the new ones that exist so far), `npx vite build` is clean, and the dev server starts with no console or warning output.
- When I report a flying problem, change `tuning.js` or the aircraft's data first, and touch the model only if the model itself is wrong.
- Commit only when I ask, as me, with no Claude co-author trailer.
- Add a section to `HANDOFF.md` for flight as you go: what is built, what is waiting on my test, and what you learned.

## Open items for your plan

Answer each of these in your plan before you build:

1. How do you graft `Track` and `TrackMesh` into world coordinates and blend each track's ground into the height function, without changing how the car modes work?
2. Does terrain building need a Web Worker to hold 60 fps, or can it be time-sliced on the main thread? Pick the simpler one that works.
3. The exact floating-origin scheme and rebase threshold, and which existing renderer parts (Scene, PostFX, shadows, Particles, TrackLights) need changes to support it.
4. The body frame and sign conventions for aircraft, and how they sit against the car conventions in `HANDOFF.md`.
5. A full keyboard, gamepad and mouse mapping for me to approve.
6. Whether `Scene.js` needs a flight variant or can be extended in place.
7. How the replay-to-live hand-over works for track AI cars and for air traffic, and how you will test that it does not pop.
8. Anything in this spec you would cut or defer to keep the first four milestones solid.

## Sources used to shape this spec

- US Air Force F-22 fact sheet (via the JBLE copy), for the F-22 dimensions, weights, thrust class, ceiling and armament.
- Wikipedia, Lockheed Martin F-22 Raptor and Boeing 737 Next Generation, for thrust vectoring, supercruise, thrust to weight and the 737-800 figures.
- SimpleWings (github.com/brihernandez/simplewings) and SimpleRotors (github.com/mmiller84/SimpleRotors), for per-wing lift and drag curves against angle of attack and stall from curve data.
- "Introduction to Proportional Navigation" on ModDB, for missile guidance (gain 3 to 5, line-of-sight rate).
- three.js forum, "Camera and floating point origin", for floating origin and camera-relative rendering.
