# New-chat prompt: cockpit/navigation revision Part C

Copy the text below into a new local coding chat. This file is the transfer prompt, not an
implementation record. HANDOFF.md is the current state; FLIGHT_COCKPIT_NAV_PLAN.md is the
approved design and checklist. Part C was implemented on 2026-10-22, see HANDOFF 10y. The prompt below is historical;
do not repeat implementation or infer acceptance. User testing is next.

---

Continue Part C of my Blocky Games flight cockpit/navigation revision.

Work in /Users/harrisoncohen/Documents/racing-game, the existing checkout of
https://github.com/Harrison-Cohen/Blocky-Games on Codex_test. This checkout contains a large,
intentional uncommitted working tree, including untracked source and markdown files. My
latest work is already on this computer, but has not been committed or pushed to GitHub.
Preserve it all. Do not reset, clean, stash, switch branches, pull over local changes, or
replace it with a fresh clone. Inspect git status, branch and recent log before any Git
action. Fetch remote refs if available; do not merge or rebase Flight_test. If this checkout
is not on Codex_test or cannot be found, explain the discrepancy before changing Git state.

Read these before coding:
1. AGENTS.md, all of it.
2. Claude.md, all of it.
3. HANDOFF.md sections 1, 3, 7, 7a, 10.0, then 10u, 10v, 10w and 10x. Read older referenced
   sections when needed for damage, model ownership and Hangar behavior.
4. FLIGHT.md and FLIGHT_PLAN.md for the standing flight architecture and boundaries.
5. FLIGHT_COCKPIT_NAV_PLAN.md, all of it, especially the answered decisions, Part C,
   verification boundaries, references and B follow-up.

First tell me in a few lines what is built, what is unstarted, and your implementation
order. Then carry out Part C within the existing approved scope, in reviewable steps:

1. Terrain minimap using the real world's terrain/coast/runway/airport/track data, with
   own-aircraft position, scale/compass, zoom and route progress. Share cached samples and
   transforms with the full map. Show coherent navigation in both physical cockpit panels
   and themed external HUD. Keep the no-textures rule for cockpit meshes.
2. Full-map trip planning: live-position or selected origin, multiple ordered waypoints
   and destination, airports or arbitrary map points, reorder/delete/reverse/activate/clear,
   versioned persistence, keyboard/mouse/gamepad editing. Planning must not teleport the
   aircraft or bypass airport/respawn eligibility rules.
3. P and gamepad D-pad Down cycle Off, Hold, Route, Off. Without a usable route cycle
   Off, Hold, Off with a reason. Route follows lateral legs through the actual controls,
   holding pilot-selected altitude/speed. Handle interception, overshoot, waypoint advance,
   final transition to Hold, cancel, aircraft switch/reset/crash and origin rebasing.
   Do not add auto takeoff/landing, waypoint altitude constraints or terrain avoidance.
4. F-22 exterior remodel against online Lockheed Martin/USAF photographs and three-view
   references. Improve the real silhouette/body proportions and blending, while preserving
   overall dimensions, cockpit visibility, animations, liveries and damage part ownership.
   Treat geometry changes separately from aerodynamics. Document intentional mesh hash
   changes; do not silently overwrite recorded goldens.
5. More realistic, less arcade procedural sound for both aircraft. Distinguish 737 fan/low
   rumble from F-22 turbine/exhaust/afterburner, use actual engine spool/state, improve wind
   and cockpit filtering, preserve useful warnings, mute/volume and damage/shutdown.
   Research primary reference audio and viewpoint behavior. Use existing Web Audio with
   tuning in tuning.js, no new packages or external sound assets. Be honest about what you
   have actually listened to and what still needs my judgment.

Preserve completed M5 damage/crash/repair/respawn, A/A2 speed-brake toggle, 737 exterior and
Hangar flow, and B instruments. Latest B corrections: larger aligned F-22 HUD, 737 panel
inside nose, working downward mouse/pad look and middle-button mouse-flight look, quicker
throttle/spool response on both aircraft, 80% less First person/Cockpit shake and Mach FOV
kick. These are built and checked, but I have not formally accepted their feel/readability.
The acceleration change improves power arrival, not sustained full-spool thrust. Do not
revert it or the comfort fixes while reshaping the F-22 or changing sounds. My last controls
question was answered: right mouse held to look, middle in mouse flight, R3/right stick on
gamepad. No keyboard-only look bindings exist; I have not asked for new bindings.

Latest addition before C, HANDOFF 10x: Field of view slider in Fly and pause menus, saved
as flight.fov, 55 to 110 vertical degrees with default 78 and one-degree steps. It controls
all flight camera views and keeps world/cockpit overlay angles aligned. Selected FOV does
not widen automatically with speed; the reduced Mach kick remains bounded by the maximum.
Preserve this preference through camera/aircraft switches and the F-22 remodel. Native
mouse, keyboard/pad and +/- controls are verified, with reload and corrupt-storage recovery.

Current verification baseline is HANDOFF 10v: all nine car suites, world and build pass;
434 flight checks pass and six frozen F-22 physics goldens fail. Those six normal hashes
now intentionally differ with my acceleration request, in addition to earlier Mac golden
differences. Do not call them unchanged or silently update them. The optional diagnostic
scripts/flight/damage-identity.mjs <pristine-checkout> --legacy-response isolates the new
response tuning and matches pristine physics plus current F-22 exterior meshes. The old
/tmp/blocky-m5-baseline path and screenshot/log artifacts may no longer exist; reconstruct
a pristine git archive outside the checkout if needed, without disturbing this working tree.

Run the required regressions and actual-page checks, inspect screenshots and measure
Medium/1080p on the M5 where available. Report every new failure and separate intentional
changes from regressions. Update HANDOFF.md, AGENTS.md and the plan/checklist with what you
learn, implement and verify so another agent can continue without this chat.

Never use an em dash or an en dash. Do not commit or push unless I explicitly ask in words.
Never kill my dev servers on 5173 or 5174; use another port for yours and stop only yours.
No new packages without asking, no textures, external assets or runtime network calls.
Use the simplest effective implementation and verify uncertain facts with primary sources.
Keep 60 fps at Medium/1080p on my MacBook Air M5 with 16 GB as the measured target.
Do not start helicopter or combat/milestone 6 work. Stop after Part C, tell me what to test
in order, and wait for feedback. End responses with launch instructions in a bash block,
then all keyboard/mouse/gamepad controls for flight, cars and menus, read from Input.js and
FlightInput.js. Follow the rest of AGENTS.md and Claude.md too.
