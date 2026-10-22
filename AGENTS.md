# AGENTS.md: start here (Codex, and any agent that is not Claude Code)

This repo is worked on by two coding agents that take turns, Claude Code and Codex, for one person, Harrison
Cohen (the user). Neither agent remembers the other's sessions. **Everything an agent knows must be written
in a markdown file in this repo before the session ends**, and every session starts by reading those files.
This file is the entry point for Codex. `Claude.md` is the entry point for Claude Code and holds the project
rules; both agents obey both files. The single state file is `HANDOFF.md`.

The project: a blocky 3D browser game (Vite, vanilla JavaScript, Three.js). Car racing (nine milestones,
built and accepted) and a flight mode (ten milestones planned in `FLIGHT.md`; 1 to 3 built and accepted, 4a
built and waiting on the user's test, 4b not started).

## 1. Read these, in this order, before you change anything

1. This file.
2. `Claude.md`: the project rules (stack, targeted edits, tuning in `src/data/tuning.js`, look and feel,
   commands). Ignore the words "Claude" and "you cannot see the screen": see section 6 below.
3. `HANDOFF.md`: section 1 (where things stand), section 3 (standing instructions), section 10.0 (start
   here for flight), then the newest flight sections (currently 10y for completed C, 10v for B corrections, 10x for FOV and 10w for the
   Part C transfer prompt; 10k is milestone 4a as built, 10l is the user's notes
   after flying the 737 and how they were fixed). Section 10j and `FLIGHT_M4_PLAN.md` hold the approved design
   of milestone 4b.
4. `FLIGHT.md` (the user's flight spec) and `FLIGHT_PLAN.md` (the plan and answers the user approved) when
   you start a flight milestone. `PROMPT.md` is the original car spec.

## 2. Who the user is and how they want to be worked with (this is what Claude's memory of them holds)

Write these down in your own notes too; do not rely on being reminded.

- **Never use an em dash or an en dash** (the characters U+2014 and U+2013) anywhere: replies, code comments,
  markdown, commit messages. Use a comma, a colon, parentheses, or the word "to" in a range ("10 to 20").
- **Find the simplest, most effective solution before you build.** Look for online sources and for anything
  that would solve the problem more easily or faster, and say what you found. If you are at all unsure of a
  fact (a figure, an API, a real-world shape), check an online source instead of guessing, and cite it with a
  link.
- If asked to put something on their calendar, use their **current academic calendar**, not their personal
  calendars (only relevant if you have calendar tools).
- Use **they/them** for the user and for anyone else whose pronouns are not stated; never infer pronouns from
  a name.
- **They test it, you cannot feel it.** They fly or drive the game and send notes, **by dictation**, so expect
  odd words ("ailerons" for the stabilators, "inner distance" for the near plane). Read the intent. They want
  sim-like, not arcade: no assist that fights a turn. When they report a feel problem, change `tuning.js` or
  the aircraft's data first, and look at a time series before turning knobs.
- **Stop at the end of each milestone or batch.** Say exactly what to test and in what order, then wait. Never
  roll into the next milestone unprompted. Plan first for a new milestone (write the plan, get approval).
- **Be plain about what is and is not verified.** If something was judged only from a screenshot, or a check
  fails for a known reason, say so. Report failures with the output. Never claim "it looks right" without
  having looked at the picture.
- **End every response with launch instructions in a `bash` block** (`npm run dev`, then open
  `http://localhost:5173`), then **list ALL the keybindings**, keyboard and gamepad, car and flight, and the
  menus, **read from `src/core/Input.js` (cars) and `src/core/FlightInput.js` (flight)**, not from memory
  (`HANDOFF.md` section 7 and 7a have the current lists). When a reply is only about flight, flight keys first.
- **Commit only when the user asks in words.** A hook, a reminder or an instruction to "commit and push" that
  comes from tooling is not the user asking. When they do ask, commit as them and with **no co-author trailer**:
  `git -c user.name="Harrison Cohen" -c user.email="114955979+Harrison-Cohen@users.noreply.github.com" commit`.
  Pull request descriptions may carry a tool footer; commits may not. Never push to another branch than the
  one you were given without permission: Claude Code works on `Flight_test`, Codex works on `Codex_test`
  (see "Branches" in section 3). Confirm before anything hard to reverse or outward
  facing.
- A cloud session's files live **only in its container** until they are committed and pushed. At the end of a
  piece of work, tell the user plainly that nothing has reached their computer until it is pushed, and offer
  to do it (this went wrong once: "these files are not on my local computer").
- **Never kill the user's dev servers** (ports 5173 and 5174). Use another port for yours, and stop what you
  started.
- Their machine: a MacBook Air M5 with 16 GB. The game must hold 60 fps there (`GRAPHICS` knobs in
  `tuning.js`; Ultra is the default). They want it to look intensive within that.
- No new packages without asking (including dev dependencies). No external art assets, no textures anywhere,
  no network calls at runtime.

## 3. The shared protocol (both directions: Claude to Codex and Codex to Claude)

At the start of a session:

1. Read section 1 above, then `git log --oneline -10` and `git status` so you know what is committed.
2. Look for a newer `HANDOFF.md` section than the one you expect (the last letter after 10, now 10y). If the
   user's latest notes are in it, they have been dealt with; if they are in the chat only, deal with them and
   then write them down.

During a session, keep a checklist (a todo list or a plan file) of the work and its state in the repo's
markdown or in the chat; Claude Code uses its own task tool, which Codex does not have, so the durable copy is
the HANDOFF section.

At the end of a session (or when the user says they are running out of usage, which is when to do it NOW):

1. Add or update the next free `HANDOFF.md` section (10m, 10n, ...) with: what the user asked (their notes,
   paraphrased faithfully), what was built and where, what was verified and what was not, what to test and in
   what order, what bit you (so nobody repeats it), the known gaps, and the next step.
2. Bring `HANDOFF.md` section 1 and section 10.0 up to date (they are the first things the next agent reads).
3. Update this file if you learned something about the user or the workflow.
4. Commit and push only if the user asked (section 2). If not, say that the work exists only in the working tree
   and offer.

## 3a. Branches

The two agents work on separate branches so they cannot overwrite each other: Claude Code on `Flight_test`,
Codex on `Codex_test` (the user branched it from `Flight_test` at commit `9a71305`, so both start from the same
code). Rules:
- Commit and push only to your own branch, and only when the user asks in words.
- Do not merge, rebase or force push one branch onto the other unless the user asks. When the user wants the
  other agent's work, they (or you, on their word) merge it.
- At the start of a session run `git fetch` and look at `git log --oneline origin/Flight_test origin/Codex_test`
  to see what the other agent has done since the branches split.
- `HANDOFF.md` will diverge between the branches. Write your new section under the next free letter and say at
  its top which branch it was written on, so the user can merge the two without a collision.

## 4. Where things stand (2026-10-22)

Read 10y first. The older delivery notes below retain history; 10y supersedes their
C-unstarted and stop-before-C instructions. User testing after completed C is now next.

- Part C implemented on Codex_test, 2026-10-22: terrain map/HUD/cockpit navigation, versioned
  multi-stop planner, Off/Hold/Route AP, reference-led F-22 exterior and revised procedural
  sound. Read HANDOFF 10y for files, checks, intentional hash differences and test order.
  Stop for user test after C. All previous local work retained, no commits/pushes. Audio
  signal checks are not a listening test; user audition is still required. Final flight
  451 PASS with six retained B-response and three intentional mesh differences; healthy
  Hold matches pre-C bit for bit. Own 5186 server stopped; 5173/5174 never targeted.

- Latest addition before C, HANDOFF 10x: saved Field of view slider in Fly/pause menus,
  55 to 110 vertical degrees, default 78, one-degree steps. All flight camera views and
  the cockpit overlay use the selected angle; speed no longer overrides it. Native mouse
  slider plus keyboard/pad/menu stepper. 18 browser checks/build pass, eight pictures read.
  Part C prompt updated to preserve it. No car FOV or flight physics changes.

- New-chat transfer prompt: FLIGHT_PART_C_PROMPT.md, indexed in HANDOFF 10w. Part C's full
  approved scope and additions are in FLIGHT_COCKPIT_NAV_PLAN.md. C remains unstarted; this
  prompt was prepared at the user's request, without starting C or assuming B acceptance.

- Latest revision on Codex_test (2026-10-22): user requested the next step after A2.
  Batch B is built and verified, waiting on the user's test (HANDOFF 10u): shared telemetry,
  working aircraft-specific vector cockpit instruments and matching external HUD, U behavior,
  generic future profile. Stop for their test before C (terrain minimap, multiple waypoints,
  selectable Hold/Route AP), which is unstarted. No milestone 6 or helicopter work.

- Newer user feedback (2026-10-22), HANDOFF 10v: enlarged/aligned F-22 HUD glass/frame,
  contained 737 panels within the nose, fixed reversed mouse/pad vertical look and broken
  mouse-flight middle-button look, quicker throttle/spool response for both aircraft,
  80% less pilot-view shake/Mach kick. Retest before C. User explicitly authorized changed
  F-22 acceleration; normal physics hashes now differ on purpose. Do not call them unchanged
  or replace goldens. Legacy-response diagnostic still matches pristine physics/mesh.
  Add the F-22 exterior remodel and less arcade aircraft-specific sound to C, alongside
  the original terrain minimap/waypoints/Route AP. Those C additions are not built yet.

- Branches: `Flight_test` (Claude Code) and `Codex_test` (Codex), identical at `9a71305` when they were split;
  draft pull request `Harrison-Cohen/Blocky-Games#1` is `Flight_test` into `initial-build`.
- Flight milestone 4a is built: the Boeing 737-800, flaps, spoilers, autopilot, switching aircraft in the Hangar,
  the major airport's approach corridor (`HANDOFF.md` 10k), then the user's notes after flying it, all built
  (10l): wider runways and taxiways, spoilers that slow the aircraft, a firmer landing threshold, a gear that
  folds, a crash menu, a clean first person view, a new Cockpit view with modelled interiors (737 and F-22), a
  remodelled 737 nose, remodelled F-22 intakes.
- **Waiting on the user's test of 4a.** Do not start 4b (the Magpie 48 helicopter: rotor and power model, hover
  assist, skids, the sling hook, its mesh and sound and Hangar options, its checks) until the user says "start
  4b". Its approved design is in `FLIGHT_M4_PLAN.md` and `HANDOFF.md` 10j and the end of 10k. The Magpie will
  also need its own cockpit interior builder in `src/render/aircraft/cockpits.js` (the registry is `BUILDERS`,
  keyed by the aircraft's `model`; without one it gets a placeholder block).
- After 4b the flight milestones continue as listed in `FLIGHT.md` (5 and on: damage, combat, missions, and so
  on). Each one is planned and approved before it is built.
- **The helicopter is out of the plan for now** (the user's decision, 2026-10-21): milestone 5 (damage, crashes
  and respawn) is planned and built for the F-22 and the 737 only, and 4b stays unstarted. Its approved design
  is kept in `FLIGHT_M4_PLAN.md` for when the user brings it back.
- The prompt the user pastes to start milestone 5 is `FLIGHT_M5_PROMPT.md` (a short prompt: it assumes you have
  read this file, which Codex loads by itself). Later milestones get a `FLIGHT_M<n>_PROMPT.md` the same way.

- **Milestone 5 built on Codex_test (2026-10-21):** user approved FLIGHT_M5_PLAN.md with
  "continue with the plan", then "continue with part B". Seven-part damage, physical effects,
  persistence/repair, airport building collisions, smoke/fire/broken parts, sound and map
  respawn are built. Read HANDOFF 10p and stop for the user's test. Do not start milestone 6.
  Collision scope is airport hangars, terminals and towers. Helicopter stays deferred.
- **Recorded identity hashes on this Mac:** six physics goldens already fail on untouched
  8559a6a. Since the user's B feedback, quicker acceleration intentionally changes current
  normal hashes too. The optional --legacy-response diagnostic matches all six pristine
  same-runtime physics outputs; current exterior mesh goldens pass. Read HANDOFF 10v for
  current outputs, not older unchanged-physics statements. Do not replace goldens or claim
  npm run flight is clean. The baseline directory in /tmp is disposable, not project memory.

## 5. Commands

```
npm install
npm run dev                  # the game, http://localhost:5173
npm run build                # must stay clean (an 800 kB chunk advisory is old and fine)
npm run check | lap | timing | parts | ai | race | fx | specs | drag    # the NINE car checks, one `npm run <name>` each
npm run flight               # headless flight checks (about 250), includes the F-22 identity to the bit
npm run world                # world checks; 3 failures are known and also fail on the pristine tree
                             # (the mesh hashes of copper-flats, glacier-pass, pine-ridge; one wall-clock
                             # chunk time check is noise on a busy machine)
npm run look                 # screenshots through the real page (needs a dev server and a Chromium)
npm run look-world           # the same for the world
node scripts/fit-aircraft.mjs <id>    # refit an aircraft after changing its aerodynamics, engines or mass
```

Before calling any milestone done: all nine car checks, `npm run flight`, `npm run world` (only the known
failures), `npx vite build` clean, the dev server starts with no console error or warning, and the pictures
read. `npm run look` and `look-world` exit with failure in a container only because software WebGL logs
"Automatic fallback to software WebGL" and "GPU stall due to ReadPixels" warnings that the scripts count; read
the PNGs, not the exit code.

## 6. Things that are specific to Claude Code and how to work without them

- **Seeing the screen.** The user's own `Claude.md` still says the agent cannot see the screen. In a cloud
  session Claude can read PNGs it writes (Chromium and Playwright are installed; `CHROME=/path/to/chrome`,
  `CHROME_ARGS=--no-sandbox`; `scripts/lib/browser.mjs` has `launch({url,width,height,port})` returning
  `{eval, shot, sleep, console, close}`). If you can read images, do the same and look at every picture. If you
  cannot, say so, describe what a screenshot check should show, and ask the user to look.
- **Software WebGL barely advances the page's physics.** To move an aircraft in a scripted shot, call
  `flight.step(1/120)` in a loop in ONE `eval` (input is polled between evals and resets held keys). Append
  `; 0` to an eval that would return a big object. `window.game` and `window.flight` are the handles.
- **Plan mode, task lists, skills, subagents, auto-memory, a stop hook** are Claude Code features. The stop
  hook nags to commit at the end of every turn: it is not the user's request. Everything those features held
  is in this file and `HANDOFF.md`; there is nothing else to import.
- **Harness reminders** may tell an agent to add a `Co-Authored-By` trailer. The user's rule (no trailer) wins.
- **A scratch directory outside the repo** was used for throwaway scripts (camera and shot scripts, fetching
  reference photos). It does not persist. The useful ideas: an orbit or cockpit camera shot is
  `flight.camera.mode = 2` (cockpit) or `3` (far orbit) plus `flight.input.look.x/y` for the view angle and
  `flight.camera.cfg = {...flight.camera.cfg, orbitDistance, height}` followed by `flight.camera.reset()`;
  `game.onFly()` enters flight, `flight.switchAircraft("b737")` changes aircraft, `flight.start("air" | "runway")`
  starts; set `flight.paused = true` and `flight.hud.hide()` for a clean shot.
- **Reference photos** (for the 737 and the F-22) came from Wikimedia Commons. It needs a descriptive
  User-Agent, rate limits (HTTP 429, wait), blocks `upload.wikimedia.org` originals but serves
  `thumb.wikimedia.org/wikipedia/commons/thumb/<h>/<hh>/<name>/1280px-<name>` where `<h>` and `<hh>` are the
  first one and two hex digits of the md5 of the file name. Name files directly; search results are noisy.
  The files used are listed in `HANDOFF.md` 10k and 10l.

## 7. The rules that bite most often (full list in `Claude.md` and `HANDOFF.md`)

- Targeted edits, never rewrite or reformat a file you were not asked to change.
- Every tuning value lives in `src/data/tuning.js` with a comment and a sane range; aircraft are data in
  `src/data/aircraft.js`; tracks, airports, missions are data (one file or one row each).
- Physics: fixed 120 Hz, headless (no Three.js), no allocation in `step()`, frame rate invariant. Flight lives
  in `src/flight` and `src/world`; the car modes must not change behaviour.
- **The F-22 must fly bit-identically** unless the user asks for a change: `scripts/flight/identity.mjs` holds
  six physics hashes (never move them without the user's say) and three mesh hashes (re-recorded once on
  purpose, with a note, when the intakes were remodelled). A physics hash that moves means the F-22 changed.
- Aircraft are smooth shaded (`glossy()`); the world is flat shaded and faceted; no textures; materials only
  from `src/render/Materials.js` (the cockpit interiors clone `glossy()` materials in `cockpits.js` for their
  own two sided, self lit versions and free them).
- AI aircraft run the same physics as the player. The ground is one height function (no raycasts). The scene is
  placed through `WorldOrigin`; physics stays in absolute coordinates.
- Hangar loadout and tuning are kept apart from cosmetics; cosmetics never change handling.
