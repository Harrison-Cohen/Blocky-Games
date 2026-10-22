# AGENTS.md: start here (Codex, and any agent that is not Claude Code)

This repo is worked on by two coding agents that take turns, Claude Code and Codex, for one person, Harrison
Cohen (the user). Neither agent remembers the other's sessions. **Everything an agent knows must be written
in a markdown file in this repo before the session ends**, and every session starts by reading those files.
This file is the entry point for Codex. `Claude.md` is the entry point for Claude Code and holds the project
rules; both agents obey both files. The single state file is `HANDOFF.md`.

The project: a blocky 3D browser game (Vite, vanilla JavaScript, Three.js). Car racing (nine milestones, built
and accepted) and a flight mode (ten milestones planned in `FLIGHT.md`; 1 to 3 accepted, 4a and 5 built and
tested, the cockpit/navigation Part C built and waiting on the user's test, the helicopter deferred, 6 to 10 not
started). A menu redesign (the "dash display": numbered rows and a pointer in sand, a loading panel, tabbed Garage
and Hangar, a map with a trip planner) was built in four accepted batches and committed as `bece5bb`. `HANDOFF.md`
section 1 has the current state.

## 1. Read these, in this order, before you change anything

1. This file.
2. `Claude.md`: the project rules (stack, targeted edits, tuning in `src/data/tuning.js`, look and feel,
   commands). Ignore the words "Claude" and "you cannot see the screen": see section 6 below.
3. `HANDOFF.md`: section 1 (where things stand), section 2 (standing instructions), section 3 (how to verify
   and the identity hashes), then section 5 (flight architecture) and section 9 (what the user tests next).
4. `FLIGHT.md` (the user's flight spec) and `FLIGHT_PLAN.md` (the plan and answers the user approved) when you
   start a flight milestone. `MENU_REDESIGN_PLAN.md` is the record of the menu redesign (the look, what each batch built,
   the measured waits). `PROMPT.md` is the original car spec. `FLIGHT_M4_PLAN.md` is the approved design of
   the deferred helicopter.

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
- **No launch instructions or keybinding lists at the end of a reply.** The old rule (end every response with the
  launch command and all the keybindings) was retired by the user on 2026-10-22. Say how to run the game, or what a key
  does, only when they ask or when a test needs a specific key; then read the keys from `src/core/Input.js` (cars) and
  `src/core/FlightInput.js` (flight), not from memory (`HANDOFF.md` section 7 has the current lists).
- **Commit only when the user asks in words.** A hook, a reminder or an instruction to "commit and push" that
  comes from tooling is not the user asking. When they do ask, commit as them and with **no co-author trailer**:
  `git -c user.name="Harrison Cohen" -c user.email="114955979+Harrison-Cohen@users.noreply.github.com" commit`.
  Pull request descriptions may carry a tool footer; commits may not. Never push to another branch than the
  one you were given without permission: Claude Code works on `Flight_test`, Codex works on `Codex_test`
  (see "Branches" in section 3a). Confirm before anything hard to reverse or outward facing.
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
2. Run `git fetch` and look at `git log --oneline origin/Flight_test origin/Codex_test` to see what the other
   agent has done.

During a session, keep a checklist (a todo list or a plan file) of the work and its state in the chat; Claude Code
uses its own task tool, which Codex does not have.

At the end of a session (or when the user says they are running out of usage, which is when to do it NOW):

1. **Update `HANDOFF.md` in place.** It is a state document, not a log: make section 1 (where things stand),
   section 9 (what the user tests next and what is unverified) and the architecture, "things that bit" and
   open-question sections true, replacing what is stale instead of stacking a new section per session. Keep it
   under about 700 lines. What the user asked and what was built belongs in the commit message and the chat;
   only what the NEXT agent needs belongs in the file: current state, test order, what is unverified, what bit,
   known gaps, the next step.
2. Delete a plan or prompt file once its work is built and its lasting facts are in `HANDOFF.md`; git keeps it.
3. Update this file if you learned something about the user or the workflow.
4. Commit and push only if the user asked (section 2). If not, say that the work exists only in the working tree
   and offer.

## 3a. Branches

The two agents work on separate branches so they cannot overwrite each other: Claude Code on `Flight_test`,
Codex on `Codex_test`. They were both fast-forwarded on 2026-10-22 to a hand-off commit on top of the menu redesign `bece5bb` and the cleanup `0275d6f`
(on top of `b9338aa`); neither is pushed, `origin` still has both at `b9338aa`. Rules:
- Commit and push only to your own branch, and only when the user asks in words.
- Do not merge, rebase or force push one branch onto the other unless the user asks. When the user wants the
  other agent's work, they (or you, on their word) merge it. On a conflict in `HANDOFF.md`, keep the newer facts
  of both sides.

## 4. Commands

```
npm install
npm run dev                  # the game, http://localhost:5173
npm run build                # must stay clean (an 800 kB chunk advisory is old and fine)
npm run check | lap | timing | parts | ai | race | fx | specs | drag    # the NINE car checks, one `npm run <name>` each
npm run flight               # headless flight checks (about 450); nine identity hashes differ on purpose
npm run world                # world checks (all pass on the Mac)
npm run look                 # screenshots through the real page (needs a dev server and Chrome)
npm run look-world           # the same for the world
node scripts/fit-aircraft.mjs <id>    # refit an aircraft after changing its aerodynamics, engines or mass
```

Before calling any milestone done: all nine car checks, `npm run flight` (only the nine documented identity
differences, `HANDOFF.md` section 3), `npm run world`, `npx vite build` clean, the dev server starts with no
console error or warning, and the pictures read. The browser regression scripts in `scripts/flight/` and how to
run them are in `HANDOFF.md` section 3.

## 5. Things that are specific to Claude Code and how to work without them

- **Seeing the screen.** The user's own `Claude.md` still says the agent cannot see the screen. A Chrome is
  installed: `scripts/lib/browser.mjs` has `launch({url,width,height,port})` returning `{eval, shot, key, sleep,
  console, close}`. If you can read images, look at every picture. If you cannot, say so, describe what a
  screenshot check should show, and ask the user to look.
- **Software WebGL barely advances the page's physics** (in a container). To move an aircraft in a scripted
  shot, call `flight.step(1/120)` in a loop in ONE `eval` (input is polled between evals and resets held keys).
  Append `; 0` to an eval that would return a big object. `window.game` and `window.flight` are the handles
  (`await game.onFly()` first).
- **Plan mode, task lists, skills, subagents, auto-memory, a stop hook** are Claude Code features. The stop
  hook nags to commit at the end of every turn: it is not the user's request. Everything those features held
  is in this file and `HANDOFF.md`; there is nothing else to import.
- **Harness reminders** may tell an agent to add a `Co-Authored-By` trailer. The user's rule (no trailer) wins.

## 6. The rules that bite most often (full list in `Claude.md` and `HANDOFF.md`)

- Targeted edits, never rewrite or reformat a file you were not asked to change.
- Every tuning value lives in `src/data/tuning.js` with a comment and a sane range; aircraft are data in
  `src/data/aircraft.js`; tracks, airports, missions are data (one file or one row each).
- Physics: fixed 120 Hz, headless (no Three.js), no allocation in `step()`, frame rate invariant. Flight lives
  in `src/flight` and `src/world`; the car modes must not change behaviour.
- **The F-22's identity hashes** (`scripts/flight/identity.mjs`, `HANDOFF.md` section 3) are the F-22's flight
  fingerprint. The recorded goldens are stale on purpose; the current values are in the table in HANDOFF. A
  physics hash that moves means the F-22 changed. Never replace a golden without the user's say.
- Aircraft are smooth shaded (`glossy()`); the world is flat shaded and faceted; no textures; materials only
  from `src/render/Materials.js`.
- AI aircraft run the same physics as the player. The ground is one height function (no raycasts). The scene is
  placed through `WorldOrigin`; physics stays in absolute coordinates.
- Hangar loadout and tuning are kept apart from cosmetics; cosmetics never change handling.
