// Wires everything together. Owns the scene, the track, the player vehicle, the
// camera and the loop. Timing, race logic and screens hang off here in later
// milestones rather than growing inside it.

import { Scene } from '../render/Scene.js';
import { ChaseCamera } from '../render/ChaseCamera.js';
import { Vehicle } from '../game/Vehicle.js';
import { Track } from '../game/Track.js';
import { TrackMesh } from '../game/TrackMesh.js';
import { Loop } from './Loop.js';
import { Input } from './Input.js';
import { DebugHud } from '../ui/DebugHud.js';
import { HUD } from '../ui/HUD.js';
import { Results } from '../ui/Results.js';
import { LapTimer } from '../game/LapTimer.js';
import { Garage } from '../ui/Garage.js';
import { CHASSIS, getChassis, chassisIndex, realTopSpeed } from '../data/cars.js';
import { getTrack, DEFAULT_TRACK, TRACKS } from '../data/tracks/index.js';
import { SUSPENSION, GRAPHICS, RACE, CAMERA, AUDIO, GRIP } from '../data/tuning.js';
import { normalizeCar, carAppearance, normalizeGarage, normalizePresets } from '../data/customization.js';
import { OPPONENTS } from '../data/opponents.js';
import { RacingLine } from '../ai/RacingLine.js';
import { AIDriver } from '../ai/AIDriver.js';
import * as Storage from './Storage.js';
import { Race } from './Race.js';
import { RaceHud } from '../ui/RaceHud.js';
import { RaceResults } from '../ui/RaceScreens.js';
import { MenuScreen, TrackSelect } from '../ui/Screens.js';
import { Drag } from '../game/Drag.js';
import { DragHud, DragSlip } from '../ui/DragScreens.js';
import { HeadlightPool } from '../render/HeadlightPool.js';
import { hexToCss } from '../data/palette.js';
import { Effects } from '../render/Effects.js';
import { GhostCar } from '../render/GhostCar.js';
import { GhostRecorder, encodeGhost, decodeGhost } from '../game/Ghost.js';
import { Gearbox, normalizeTune, tunedChassis } from '../game/Gearbox.js';
import { SoundEngine } from './Audio.js';
import { Speedo, toMph, normalizeSpeedo } from '../ui/Speedo.js';
import { setGraphicsLevel } from '../render/GraphicsLevel.js';

const sameCar = (a, b) => Object.keys(a).every((k) => a[k] === b[k]);

// Race settings from storage, held to what the game can actually run.
function normalizeRaceSettings(raw) {
  const s = raw && typeof raw === 'object' ? raw : {};
  const int = (v, lo, hi, d) => (Number.isInteger(v) ? Math.min(hi, Math.max(lo, v)) : d);
  return {
    laps: int(s.laps, 1, 10, RACE.laps),
    opponents: int(s.opponents, 1, RACE.maxOpponents, RACE.opponents),
    difficulty: RACE.levels[s.difficulty] ? s.difficulty : RACE.difficulty,
  };
}

// Drag strip settings from storage: one player or two, and player 2's car and
// gearbox. Player 1 always drives the garage's car.
function normalizeDragSettings(raw) {
  const s = raw && typeof raw === 'object' ? raw : {};
  return {
    players: s.players === 2 ? 2 : 1,
    car2: CHASSIS.some((c) => c.id === s.car2) ? s.car2 : 'tesla-roadster',
    manual2: s.manual2 === true,
  };
}

// Every chassis's gearbox tune from storage, each held to what its gearbox can
// do. A chassis that was never tuned comes back stock.
function normalizeTunes(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const out = {};
  for (const c of CHASSIS) out[c.id] = normalizeTune(c.id, src[c.id]);
  return out;
}

// Once the time slip is up, both drivers are on the brakes in the shutdown
// area, and off them again once stopped: held, the brake would reverse.
const SHUT = [0, 1].map(() => ({ throttle: 0, brake: 0, steer: 0, handbrake: 0,
  steerIsAnalog: true, pedalsAreAnalog: true }));
function shutdown(p, out) {
  out.brake = p.vLong > 1 ? 1 : 0;
  return out;
}

// Metres of road between the start line and the first rival, and between
// rivals. Far enough ahead that a time trial is not spent behind one.
const AI_GRID_GAP = 90;

export class Game {
  constructor({ canvas, uiRoot }) {
    // The graphics level goes first: the renderer, the post chain and the
    // track are all built from the values it sets.
    this.graphicsLevel = setGraphicsLevel(Storage.load('graphics', null));
    this.scene = new Scene(canvas);
    this.camera = new ChaseCamera(this.scene.camera);
    this.headlights = new HeadlightPool(this.scene.scene);

    // The cars and the track come back from the last session, normalised on
    // the way in, because what comes out of localStorage is whatever was there
    // -- an older version of this game, or an edit by hand. Every chassis has
    // its own car and `car` is the one being driven. Older versions saved a
    // single car under 'car'; it becomes its own chassis's car here.
    this.garageState = normalizeGarage(Storage.load('garage', null), Storage.load('car', null));
    this.car = this.garageState.cars[this.garageState.chassis];
    this.presets = normalizePresets(Storage.load('presets', null));
    this.speedoStyle = normalizeSpeedo(Storage.load('speedo', null));
    this.chassisIdx = Math.max(0, CHASSIS.findIndex((c) => c.id === this.car.chassis));
    this.trackIdx = Math.max(0, TRACKS.findIndex((t) => t.id === Storage.load('lastTrack', DEFAULT_TRACK)));
    // Each chassis's gearbox tune, from the garage. Not cosmetic: it is the
    // one thing besides the chassis that changes how a car drives, so it is
    // kept apart from the cars, whose values never reach the physics.
    this.tunes = normalizeTunes(Storage.load('tunes', null));

    this.vehicle = new Vehicle(this.chassisFor(CHASSIS[this.chassisIdx].id), carAppearance(this.car));
    this.scene.add(this.vehicle.root);

    // One opponent, on by default. The full field, the standings and the
    // contact between cars are milestone 7; this is the pace car you chase.
    this.rivals = [];
    this.rivalsOn = Storage.load('rivals', true);

    // Auto drive: the player's own car with the AI at the wheel. Off at every
    // launch -- a game that starts driving itself is not one you are playing.
    this.autoDrive = false;
    this.autoDriver = null;

    // Race mode. Null in time trial, which is where the game starts and what
    // it goes back to. The race owns the field; Game owns their meshes.
    this.race = null;
    this.raceCars = [];
    this.raceSettings = normalizeRaceSettings(Storage.load('race', null));
    this._resultsShown = false;

    // Drag strip. `drag` is the pass in progress whenever the track is a drag
    // strip; `p2` is player 2's car, gearbox and camera in a two-player race.
    this.drag = null;
    this.p2 = null;
    this.dragSettings = normalizeDragSettings(Storage.load('drag', null));
    this.dragBests = Storage.load('dragBest', null) || {};
    this._dragControls = [];

    // What the wheels leave behind, the ghost of your best lap, and the sound.
    // All of it is seen or heard only -- none of it reaches the physics.
    this.effects = new Effects(this.scene.scene);
    this.ghostCar = new GhostCar(this.scene.scene);
    this.ghostRecorder = new GhostRecorder();
    this.ghostLap = null;
    this._pendingGhost = null;
    this.ghostOn = Storage.load('ghost', true) !== false;
    this.gearbox = new Gearbox(this.vehicle.chassis);
    // Automatic or manual is the player's standing choice, made in the garage
    // or with B, and it lasts between sessions.
    this.gearbox.setManual(Storage.load('manual', false) === true);
    this.sound = new SoundEngine();
    this._fxCars = [];
    this._lastHit = 0;
    this._wasAir = false;
    this._airVy = 0;
    this._soundState = { rpm: 0, voice: null, throttle: 0, shifting: false, slip: 0,
      speed: 0, topSpeed: 1, tarmac: 1, loose: 0 };

    this.loadTrack(TRACKS[this.trackIdx]);

    this.input = new Input();
    this.input.attach();
    this.input.manualKeys = this.gearbox.manual;

    this.debug = new DebugHud(uiRoot);
    this.hud = new HUD(uiRoot);
    this.results = new Results(uiRoot);
    this.raceHud = new RaceHud(uiRoot);
    this.raceResults = new RaceResults(uiRoot);
    this.raceResults.onAgain = () => {
      this.raceResults.hide();
      this.input.suspended = false;
      this.startRace(this.raceSettings);
    };
    this.raceResults.onLeave = () => {
      this.raceResults.hide();
      this.input.suspended = false;
      this.endRace();
    };
    // Back from track select is back to these results, with the rest of the
    // field still coming home.
    this.raceResults.onTracks = () => {
      this.raceResults.hide();
      this.openTrackSelect('race', 'Back to the results', () => {
        this._closeScreens();
        this.paused = false;
        this.loop.accumulator = 0;
        if (this.race) this.raceResults.show(this.race.results(), this._raceMeta());
        else this._resume();
      });
    };
    this.hud.show();
    this.uiRoot = uiRoot;
    this.controlsCard = uiRoot.querySelector('.controls-card');
    this.autoBadge = uiRoot.querySelector('.auto-badge');
    this.speedo = new Speedo(uiRoot);
    this.speedo.setStyle(this.speedoStyle);
    this.speedo.setCar(this.gearbox.voice, realTopSpeed(this.vehicle.chassis));
    this.paused = false;

    // Flying is a second game that borrows this one's renderer (main.js sets
    // this). Null until then, and the title's Fly row does nothing without it.
    this.onFly = null;

    // The screens between drives. `screen` is the one up, or null while
    // driving: 'title' and 'tracks' fly the camera down the track behind
    // them, 'pause' and 'results' hold it where it was.
    this.screen = null;
    this.title = new MenuScreen(uiRoot.querySelector('.title-screen'));
    this.pauseMenu = new MenuScreen(uiRoot.querySelector('.pause-screen'));
    this.trackSelect = new TrackSelect(uiRoot);
    this.trackSelect.onStart = (pick) => this.startSession(pick);

    this.garage = new Garage(uiRoot, this.scene.renderer);
    this.garage.onClose = (result) => this.closeGarage(result);
    // Presets are a library, not part of a car, so they are kept the moment
    // they change rather than waiting for Save car.
    this.garage.onPresets = (list) => { this.presets = list; Storage.save('presets', list); };

    this.loop = new Loop({
      step: (dt) => this.step(dt),
      render: (alpha, frameDelta) => this.render(alpha, frameDelta),
    });

    // The drag strip's screens, and player 2's camera and dashboard.
    this.dragHud = new DragHud(uiRoot);
    this.dragSlip = new DragSlip(uiRoot);
    this.dragSlip.onAgain = () => this.restageDrag();
    this.dragSlip.onSetup = () => {
      this.dragSlip.hide();
      this.openTrackSelect('drag', 'Back to the strip', () => { this._resume(); this.restageDrag(); });
    };
    this.dragSlip.onClose = () => { this.dragSlip.hide(); this.input.suspended = false; };
    this.camera2 = new ChaseCamera(this.scene.makeCamera());
    this.speedo2 = new Speedo(uiRoot.querySelector('.dash-p2'));
    if (this.track.data.drag) this.startDrag(this.dragSettings);

    // Every launch opens on the title, over the last track you drove. The
    // very first one also shows the controls, as the brief asks.
    this.showTitle();
    if (!Storage.load('seenControls', false)) {
      this._showControls(this.title, true);
      Storage.save('seenControls', true);
    }
  }

  start() { this.loop.start(); }

  loadTrack(data) {
    this._clearDrag();
    if (this.trackMesh) this.trackMesh.dispose();
    Storage.save('lastTrack', data.id);
    this.track = new Track(data);
    this.trackMesh = new TrackMesh(this.track);
    this.scene.setTrack(this.track, this.trackMesh);
    // A night circuit turns the headlights on. Only the player's cast shadows;
    // six shadow-casting beams would be six more passes over the whole scene.
    this.vehicle.setHeadlights(!!data.headlights, GRAPHICS.headlightShadows);
    // Everybody else's beams share a few real lights; see HeadlightPool.
    this.headlights.setCount(data.headlights ? GRAPHICS.rivalHeadlights : 0);
    // The racing line belongs to the track and costs about 50 ms to solve, so
    // it is built here, once, and shared by every driver on it.
    this.line = new RacingLine(this.track);
    // A timer belongs to a track: its records, its checkpoints, its sectors.
    this.timer = new LapTimer(this.track, this.vehicle.chassis.id);
    // Skid marks belong to the road they were laid on.
    this.effects.setTrack(this.track);
    this.loadGhost();
    this.buildRivals();
    this.buildAutoDriver();
    this.resetVehicle();
    this._prewarm = true;
    // A drag strip runs drag passes; anywhere else the lap timer is back.
    // (Before the screens exist, the constructor does this itself.)
    if (this.dragHud) {
      if (data.drag) this.startDrag(this.dragSettings);
      else this.hud.show();
    }
  }

  // --- opponents ------------------------------------------------------------
  // Each rival is a Vehicle exactly like the player's, plus an AIDriver holding
  // its controls. It is stepped by the same physics on the same clock and is
  // subject to the same grip, so nothing it does is out of the player's reach.
  buildRivals() {
    for (const r of this.rivals) r.vehicle.dispose(this.scene.scene);
    this.rivals = [];
    // In a race the field is the race's, not the time trial's pace car.
    if (!this.rivalsOn || this.race || this.track.data.drag) return;
    for (const spec of OPPONENTS.slice(0, 1)) {
      const chassis = getChassis(spec.chassis);
      const look = carAppearance(spec.car);
      const vehicle = new Vehicle(chassis, look);
      const driver = new AIDriver(this.track, this.line, chassis,
        { name: spec.name, ...spec.style });
      this.scene.add(vehicle.root);
      this.rivals.push({ spec, vehicle, driver, css: hexToCss(look.primary) });
    }
    this.placeRivals();
  }

  // On the line, spread up the road ahead of the player so a time trial is not
  // spent driving through the back of somebody.
  placeRivals() {
    this.rivals.forEach((r, k) => {
      const ahead = Math.round((AI_GRID_GAP * (k + 1)) / this.track.ds);
      const i = (this.track.startSample + ahead) % this.track.count;
      const spawn = this.track.spawnAt(i, 0, this.line.offset[i]);
      const rest = r.vehicle.chassis.suspensionRest ?? SUSPENSION.restLength;
      const ground = this.track.sample(spawn.x, spawn.z, spawn.y);
      r.vehicle.physics.reset(spawn.x, ground.height + rest, spawn.z, spawn.yaw);
      r.driver.reset();
    });
  }

  toggleRivals() {
    if (this.race || this.drag) return;
    this.rivalsOn = !this.rivalsOn;
    Storage.save('rivals', this.rivalsOn);
    this.buildRivals();
  }

  // --- auto drive -----------------------------------------------------------
  // An AIDriver on the player's car: the same racing line, the same speed
  // profile and the same physics a rival uses, so the car is driven exactly the
  // way the AI would drive this chassis on this track. Rebuilt whenever either
  // changes, because the speed profile belongs to both of them.
  buildAutoDriver() {
    this.autoDriver = this.autoDrive
      ? new AIDriver(this.track, this.line, this.vehicle.chassis, { name: 'Auto drive' })
      : null;
    this.timer.setAssisted(this.autoDrive);
  }

  toggleAutoDrive() {
    // On the drag strip the lanes are the drivers'.
    if (this.drag) return;
    this.autoDrive = !this.autoDrive;
    this.buildAutoDriver();
    this.autoBadge.hidden = !this.autoDrive;
  }

  // --- drag strip -----------------------------------------------------------
  // On a track with a `drag` block the game runs drag passes (src/game/Drag.js)
  // instead of laps: one player against the clock, or two side by side on a
  // split screen. N opens the setup, R puts the cars back on the line.
  startDrag(settings) {
    this._clearDrag();
    for (const r of this.rivals) r.vehicle.dispose(this.scene.scene);
    this.rivals = [];
    if (this.autoDrive) {
      this.autoDrive = false;
      this.buildAutoDriver();
      this.autoBadge.hidden = true;
    }
    const two = settings.players === 2;
    const lanes = [{ physics: this.vehicle.physics, chassis: this.vehicle.chassis, name: two ? 'Player 1' : 'You' }];
    if (two) {
      const chassis = this.chassisFor(settings.car2);
      const vehicle = new Vehicle(chassis, carAppearance(this.garageState.cars[chassis.id]));
      this.scene.add(vehicle.root);
      const gearbox = new Gearbox(chassis);
      gearbox.setManual(settings.manual2);
      this.p2 = { vehicle, gearbox };
      const cam = this.camera2.camera;
      cam.far = this.scene.camera.far;
      cam.updateProjectionMatrix();
      this.speedo2.setStyle(this.speedoStyle);
      this.speedo2.setCar(gearbox.voice, realTopSpeed(chassis));
      lanes.push({ physics: vehicle.physics, chassis, name: 'Player 2' });
    }
    this.drag = new Drag(this.track, lanes);
    this._prewarm = true;
    this.input.setTwoPlayer(two);
    this.uiRoot.classList.toggle('split', two);
    this.uiRoot.querySelector('.dash-p2').hidden = !two;
    this.hud.hide();
    this.dragHud.show(lanes.length);
    this.restageDrag();
    this.paused = false;
    this.scene.settle();
  }

  // Both cars back on the line, the tree dark, the slip away.
  restageDrag() {
    if (!this.drag) return;
    this.drag.restage();
    this.gearbox.resetGear();
    this.camera._initialized = false;
    if (this.p2) {
      this.p2.gearbox.resetGear();
      this.camera2._initialized = false;
    }
    this.timer.reset();
    this._lit = 0;
    this._dragPhase = 'staged';
    this._slipShown = false;
    this.dragSlip.hide();
    this.input.suspended = false;
    this.loop.accumulator = 0;
  }

  _clearDrag() {
    if (this.p2) {
      this.p2.vehicle.dispose(this.scene.scene);
      this.p2 = null;
    }
    this.drag = null;
    if (!this.dragHud) return;
    this.input.setTwoPlayer(false);
    this.uiRoot.classList.remove('split');
    this.uiRoot.querySelector('.dash-p2').hidden = true;
    this.dragHud.hide();
    this.dragSlip.hide();
    this.scene.endSplit();
  }

  // Player 2's shift keys: / and . and , on the keyboard, or their own pad.
  _shift2(how) {
    if (this.paused || !this.p2 || !this.p2.gearbox.manual) return;
    const gb = this.p2.gearbox;
    if (how === 'up') gb.shiftUp();
    else if (how === 'down') gb.shiftDown();
    else gb.neutral();
  }

  // Once per rendered frame on the strip: the lanes' HUD, the tree in the
  // world, its tones, and the time slip once the pass is over.
  _updateDrag() {
    const d = this.drag;
    const notes = d.lanes.map((l) => {
      const b = this.dragBests[l.chassis.id];
      return b ? `Best ${b.et.toFixed(3)}` : '';
    });
    this.dragHud.update(d, notes);

    const tree = d.tree();
    const lamps = this.trackMesh.dragTree;
    if (lamps) {
      for (let k = 0; k < 2; k++) {
        const lane = k < d.lanes.length ? tree.lanes[k] : null;
        lamps.stage[k].visible = !!lane && tree.staged;
        lamps.ambers.forEach((a, i) => { a[k].visible = !!lane && i < tree.ambers; });
        lamps.green[k].visible = !!lane && lane.green;
        lamps.red[k].visible = !!lane && lane.red;
      }
    }
    // One tone as each amber lights, an octave up at the green.
    if (tree.ambers > (this._lit || 0)) this.sound.beep(false);
    if (this._dragPhase === 'staged' && d.phase !== 'staged') this.sound.beep(true);
    this._lit = tree.ambers;
    this._dragPhase = d.phase;

    if (d.phase === 'done' && !this._slipShown) {
      this._slipShown = true;
      const res = d.results();
      const bests = [], newBest = [];
      for (const l of res.lanes) {
        const id = l.chassis.id;
        const prev = this.dragBests[id] ? this.dragBests[id].et : null;
        const better = l.clean && (prev === null || l.et < prev);
        if (better) this.dragBests[id] = { et: l.et, mph: l.mph };
        bests.push(this.dragBests[id] ? this.dragBests[id].et : null);
        newBest.push(better);
      }
      if (newBest.some(Boolean)) Storage.save('dragBest', this.dragBests);
      this.input.suspended = true;
      this.dragSlip.show(res, { track: `${this.track.data.name}, quarter mile`, bests, newBest });
    }
  }

  // --- race mode ------------------------------------------------------------
  // Started from the track select screen, which carries its three settings.
  // A race on the current track with the current car. The player's own car
  // and physics go into it, so everything about how it drives is the same as
  // in time trial; the time trial's pace car makes way for the field.
  startRace(settings) {
    this._clearRace();
    for (const r of this.rivals) r.vehicle.dispose(this.scene.scene);
    this.rivals = [];

    const field = OPPONENTS.slice(0, settings.opponents).map((spec) => {
      const chassis = getChassis(spec.chassis);
      const look = carAppearance(spec.car);
      const vehicle = new Vehicle(chassis, look);
      this.scene.add(vehicle.root);
      return { spec, chassis, vehicle, physics: vehicle.physics, color: look.primary, css: hexToCss(look.primary) };
    });
    this.raceCars = field;
    this._prewarm = true;
    const mine = carAppearance(this.car);
    this.race = new Race({
      track: this.track,
      line: this.line,
      settings,
      player: { physics: this.vehicle.physics, chassis: this.vehicle.chassis,
        name: 'You', number: this.car.number, color: mine.primary },
      field,
    });
    // A fresh lap list for the race; records carry on as they are.
    this.timer.reset();
    if (this.autoDriver) this.autoDriver.reset();
    // A manual box leaves the grid in first.
    this.gearbox.resetGear();
    this.camera._initialized = false;
    this._resultsShown = false;
    this._lit = 0;
    this._racePhase = 'countdown';
    this.raceResults.hide();
    this.raceHud.show();
    this.uiRoot.classList.add('race-active');
    this.paused = false;
    this.loop.accumulator = 0;
    this.scene.settle();
  }

  _clearRace() {
    for (const c of this.raceCars) c.vehicle.dispose(this.scene.scene);
    this.raceCars = [];
    this.race = null;
  }

  // The field, its HUD and its results gone, and nothing put back yet.
  _leaveRace() {
    this._clearRace();
    this.raceHud.hide();
    this.raceResults.hide();
    this.uiRoot.classList.remove('race-active');
  }

  // Back to time trial, on the grid, with the pace car back if it was on.
  endRace() {
    this._leaveRace();
    this.buildRivals();
    this.resetVehicle();
    this.timer.reset();
    this.paused = false;
    this.loop.accumulator = 0;
    this.scene.settle();
  }

  _raceMeta() {
    return {
      track: this.track.data.name,
      laps: this.race.laps,
      difficulty: RACE.levels[this.race.difficulty].name,
      done: this.race.phase === 'done',
    };
  }

  // Once per rendered frame in a race: the HUD, and the results once the
  // player has taken the flag. The results stay live while the rest of the
  // field comes home behind.
  _updateRace() {
    const race = this.race;
    this.raceHud.update(race.view(), race);
    // The start tones: one as each lamp comes on, one an octave up at lights
    // out. Same arithmetic as the lamps themselves, so they cannot disagree.
    const lit = race.phase === 'countdown' ? Math.min(3, Math.ceil(RACE.countdown - race.countdown)) : 0;
    if (race.phase === 'countdown' && lit > (this._lit || 0)) this.sound.beep(false);
    if (this._racePhase === 'countdown' && race.phase !== 'countdown') this.sound.beep(true);
    this._lit = lit;
    this._racePhase = race.phase;
    if (race.playerFinished && !this._resultsShown &&
        race.clock - race.playerFinishClock >= RACE.resultsDelay) {
      this._resultsShown = true;
      this.input.suspended = true;
      this.controlsCard.hidden = true;
      this.results.close();
      this.raceResults.show(race.results(), this._raceMeta());
    }
    if (this.raceResults.visible) this.raceResults.render(race.results(), this._raceMeta());
  }

  _hudExtras() {
    const list = this.race ? this.raceCars : this.rivals;
    const cars = this._dots || (this._dots = []);
    cars.length = list.length;
    list.forEach((c, k) => {
      const p = c.vehicle.physics;
      const d = cars[k] || (cars[k] = { x: 0, z: 0, color: '' });
      d.x = p.x; d.z = p.z; d.color = c.css;
    });
    if (this.ghostCar.visible) {
      const g = this._ghostDot || (this._ghostDot = { x: 0, z: 0, color: '#edede7', ghost: true });
      g.x = this.ghostCar.pose.x;
      g.z = this.ghostCar.pose.z;
      cars.push(g);
    }
    if (!this.race) return { cars, lapText: null };
    const v = this.race.view();
    return { cars, lapText: `${v.lap}/${v.laps}` };
  }

  // Drop the car on the track at a spawn point, resting on its springs.
  placeAt(spawn) {
    const c = this.vehicle.chassis;
    const rest = c.suspensionRest ?? SUSPENSION.restLength;
    const ground = this.track.sample(spawn.x, spawn.z, spawn.y);
    this.vehicle.physics.reset(spawn.x, ground.height + rest, spawn.z, spawn.yaw);
    this.camera._initialized = false;
    // A teleported car has no steering history, so neither should its driver.
    if (this.autoDriver) this.autoDriver.reset();
    // And it is standing still, so a manual box goes back to first.
    this.gearbox.resetGear();
  }

  resetVehicle() {
    this.placeAt(this.track.spawn());
    this.placeRivals();
  }

  // R: back to the last checkpoint, facing down the track, not to the start.
  resetToCheckpoint() {
    // On the drag strip, R is back to the line for another pass.
    if (this.drag) { this.restageDrag(); return; }
    // On the grid there is nowhere to go back to.
    if (this.race && this.race.phase === 'countdown') return;
    // Teleporting ends the lap as a timed effort, whatever else happens.
    this.timer.invalidateForReset();
    const p = this.vehicle.physics;
    const cp = this.track.lastCheckpointFor(p.x, p.z, p.y);
    this.placeAt(this.track.spawnAt(cp.sample, 6));
  }

  step(dt) {
    if (this.paused) return;
    // A drag pass moves and times every car on the strip itself.
    if (this.drag) {
      const shut = this.drag.phase === 'done' && this.dragSlip.visible;
      const c = this._dragControls;
      c.length = this.drag.lanes.length;
      c[0] = shut ? shutdown(this.vehicle.physics, SHUT[0]) : this.input.state;
      if (this.p2) c[1] = shut ? shutdown(this.p2.vehicle.physics, SHUT[1]) : this.input.state2;
      this.drag.step(dt, c);
      return;
    }
    const race = this.race;
    // Auto drive replaces the keyboard, inside the fixed step like the rivals.
    // In a race it sees the traffic, as the opponents do.
    const controls = this.autoDriver
      ? this.autoDriver.update(dt, this.vehicle.physics,
        race ? race.traffic : null, race ? race.entries.length - 1 : -1)
      : this.input.state;
    if (race) {
      if (this.autoDriver && race.phase === 'racing' && !race.playerFinished) race.player.assisted = true;
      // The race moves every car, the player's included, and resolves the
      // contact between them.
      race.step(dt, controls);
    } else {
      // The driver runs INSIDE the fixed step, like the player's input
      // smoothing and for the same reason: an AI whose steering ramp advanced
      // once per frame would drive differently on a 144 Hz machine than on a
      // 60 Hz one.
      for (const r of this.rivals) {
        r.vehicle.step(dt, r.driver.update(dt, r.vehicle.physics), this.track);
      }
      this.vehicle.step(dt, controls, this.track);
    }
    // After the vehicle, so the physics prev* fields still hold the position at
    // the start of this step and the crossing can be timed within it.
    this.timer.step(dt, this.vehicle.physics);
    // The ghost records on the same clock the timer runs on. Time trial only:
    // a race lap is not a lap against yourself.
    if (!race) {
      const best = this.ghostRecorder.step(this.timer, this.vehicle.physics, dt);
      if (best) this._pendingGhost = best;
    }
  }

  render(alpha, frameDelta) {
    this.input.poll();

    // The garage owns the screen while it is open: it renders its own scene
    // into the same canvas, and the track is left exactly as it was so that
    // closing it is instant.
    if (this.garage.visible) {
      this.sound.update(null);
      this.garage.handlePad(this.input.menu);
      if (this.garage.visible) this.garage.render(Math.max(frameDelta, 1e-4));
      return;
    }
    // The screens and cards take the gamepad's menu edges the same way the
    // garage does.
    const m = this.input.menu;
    if (this.title.visible) this.title.handlePad(m);
    else if (this.pauseMenu.visible) this.pauseMenu.handlePad(m);
    else if (this.trackSelect.visible) this.trackSelect.handlePad(m);
    else if (this.results.ending) this.results.handlePad(m);
    else if (this.raceResults.visible) this.raceResults.handlePad(m);
    else if (this.dragSlip.visible) this.dragSlip.handlePad(m);

    if (this.input.consumeAction('pause')) this.openPause();
    if (this.input.consumeAction('reset')) this.resetToCheckpoint();
    if (this.input.consumeAction('cycleCamera')) this.camera.cycle();
    if (this.input.consumeAction('toggleDebug')) this.debug.toggle();
    if (this.input.consumeAction('nextChassis')) this.nextChassis();
    if (this.input.consumeAction('nextTrack')) this.nextTrack();
    if (this.input.consumeAction('rivals')) this.toggleRivals();
    if (this.input.consumeAction('autoDrive')) this.toggleAutoDrive();
    if (this.input.consumeAction('results')) this.results.toggle(this.timer);
    if (this.input.consumeAction('garage')) this.openGarage();
    if (this.input.consumeAction('race')) this.quickTrackSelect();
    if (this.input.consumeAction('ghost')) this.toggleGhost();
    if (this.input.consumeAction('mute')) this.sound.toggleMute();
    if (this.input.consumeAction('manual')) this.toggleManual();
    if (this.input.consumeAction('shiftUp')) this._shift('up');
    if (this.input.consumeAction('shiftDown')) this._shift('down');
    if (this.input.consumeAction('neutral')) this._shift('neutral');
    if (this.input.consumeAction('shiftUp2')) this._shift2('up');
    if (this.input.consumeAction('shiftDown2')) this._shift2('down');
    if (this.input.consumeAction('neutral2')) this._shift2('neutral');
    if (this.input.consumeAction('cycleCamera2') && this.p2) this.camera2.cycle();

    // Whatever was built since the last frame gets its shaders now, not the
    // first time it comes into view (Scene.prewarm).
    if (this._prewarm) { this._prewarm = false; this.scene.prewarm(); }

    const dt = Math.max(frameDelta, 1e-4);
    this.vehicle.updateVisual(alpha, dt);
    for (const r of this.rivals) r.vehicle.updateVisual(alpha, dt);
    for (const c of this.raceCars) c.vehicle.updateVisual(alpha, dt);
    if (this.p2) this.p2.vehicle.updateVisual(alpha, dt);

    const s = this.vehicle.render;
    const p = this.vehicle.physics;
    const live = !this.paused;
    if (live) this._impacts(p);
    // Behind the title and track select the camera flies the track instead.
    const touring = this.screen === 'title' || this.screen === 'tracks';
    const look = touring ? this.camera.tour(this.track, dt, this._tourFrom) : null;
    this._tourFrom = null;
    if (!touring) this.camera.update(s, this.vehicle.speed, this.vehicle.chassis, dt, p);
    if (this.p2) {
      const v2 = this.p2.vehicle;
      this.camera2.update(v2.render, v2.speed, v2.chassis, dt, v2.physics);
    }
    this._fxCars.length = 0;
    this._fxCars.push(this.vehicle);
    for (const r of this.rivals) this._fxCars.push(r.vehicle);
    for (const c of this.raceCars) this._fxCars.push(c.vehicle);
    if (this.p2) this._fxCars.push(this.p2.vehicle);
    this.effects.update(this._fxCars, live ? dt : 0);
    this._updateGhost(alpha);
    this.headlights.update(this.race ? this.raceCars : this.rivals, this.scene.camera.position);
    if (touring) {
      this.scene.frame(look.x, look.y, look.z, dt);
      this.scene.render(dt);
    } else if (this.p2) {
      // Split screen: player 1 on top, player 2 below.
      const s2 = this.p2.vehicle.render;
      const views = this._views || (this._views = [{ camera: this.scene.camera }, { camera: this.camera2.camera }]);
      views[0].x = s.x; views[0].y = s.y; views[0].z = s.z;
      views[1].x = s2.x; views[1].y = s2.y; views[1].z = s2.z;
      this.scene.renderSplit(views, dt);
    } else {
      this.scene.frame(s.x, s.y, s.z, dt);
      this.scene.render(dt);
    }

    // Reversing, the brake pedal is what is driving the car.
    const load = p.vLong < -0.5 ? p.brake : p.throttle;
    // Someone else at the wheel drives in automatic whatever the player chose,
    // because their controls never carry a gear.
    const manual = this.gearbox.manual && !this._someoneElseDriving();
    // A tuned gearbox in automatic changes gear in the physics; the readout
    // shows the gear it is actually in.
    this.gearbox.update(live ? dt : 0, p.vLong, load, !manual, p.chassis.gearing ? p.autoGear : 0);
    // The gear reaches the physics with the next step's input, on the fixed
    // clock like the pedals.
    this.input.state.manual = manual;
    this.input.state.gear = this.gearbox.selected;
    this.speedo.update(toMph(this.vehicle.speed), this.gearbox.rpm, this.gearbox.label,
      manual, this.gearbox.limiting);
    // Player 2's gearbox and dashboard. The sound is player 1's car.
    if (this.p2) {
      const q = this.p2.vehicle.physics;
      const gb = this.p2.gearbox;
      const load2 = q.vLong < -0.5 ? q.brake : q.throttle;
      gb.update(live ? dt : 0, q.vLong, load2, !gb.manual, q.chassis.gearing ? q.autoGear : 0);
      this.input.state2.manual = gb.manual;
      this.input.state2.gear = gb.selected;
      this.speedo2.update(toMph(this.p2.vehicle.speed), gb.rpm, gb.label, gb.manual, gb.limiting);
    }
    this.sound.update(live ? this._fillSound(p, load) : null);

    if (this.drag) this._updateDrag();
    else this.hud.update(this.timer, this.track, this.vehicle.physics, this._hudExtras());
    if (this.race) this._updateRace();
    this.results.render(this.timer);
    this.debug.update(this.vehicle, this.loop, this.camera, frameDelta, this.track, this.scene);
  }

  // V: swap chassis where you stand, for comparing two cars on one corner.
  // Each chassis comes as its own car, in its own paint. Deliberately not
  // persisted -- saving is the garage's job, and its Save and Discard buttons
  // only mean something if nothing else writes.
  nextChassis() {
    if (this.race) return;
    const next = (this.chassisIdx + 1) % CHASSIS.length;
    this.applyCar(this.garageState.cars[CHASSIS[next].id]);
  }

  // T: move to the next track where you stand, a shortcut beside the track
  // select screen in the same way V is beside the garage. It DOES persist,
  // because which track you are on is where you are rather than a change you
  // might want to discard.
  nextTrack() {
    if (this.race) return;
    this.trackIdx = (this.trackIdx + 1) % TRACKS.length;
    this.loadTrack(TRACKS[this.trackIdx]);
  }

  // Rebuild the player's car from a config, keeping it where it stands.
  //
  // Rebuilding stands the car still, so it ends the timed lap the same way the
  // reset key does. A config that has not actually changed is a no-op, which
  // is what makes opening the garage for a look and leaving again free --
  // unless `retuned`: the same car on a new gearbox tune is a new car.
  applyCar(car, retuned = false) {
    const next = normalizeCar(car);
    if (!retuned && sameCar(next, this.car)) return;
    this.car = next;
    const chassis = this.chassisFor(this.car.chassis);
    this.chassisIdx = chassisIndex(chassis.id);
    const p = this.vehicle.physics;
    const keep = { x: p.x, y: p.y, z: p.z, yaw: p.yaw };
    this.vehicle.setCar(chassis, carAppearance(this.car), this.scene.scene);
    this._prewarm = true;
    // Records are per chassis, so swapping swaps the target and the history --
    // and the ghost, which is the ghost of that record.
    this.timer.setChassis(chassis.id);
    this.timer.invalidateForReset();
    this.gearbox.setChassis(chassis);
    this.speedo.setCar(this.gearbox.voice, realTopSpeed(chassis));
    this.loadGhost();
    // The profile is per chassis, so a new car needs a new driver.
    this.buildAutoDriver();
    this.placeAt(keep);
    // On the drag strip a new car goes straight to the line.
    if (this.drag) {
      this.drag.lanes[0].chassis = chassis;
      this.restageDrag();
    }
  }

  // `back` is where to go when it closes: the title or the pause card that
  // opened it. Without one (G), it is straight back to driving.
  openGarage(back = null) {
    // Mid-race, the car is on the grid or on the track; it cannot also be in
    // the garage. Leave the race first.
    if (this.garage.visible || this.race) return;
    this._garageBack = back;
    this._pausedBeforeGarage = this.paused;
    this._closeScreens();
    this.screen = null;
    this.paused = true;
    this.input.suspended = true;
    this.controlsCard.hidden = true;
    this.results.close();
    this.hud.hide();
    this.uiRoot.classList.add('garage-open');
    this.garage.open({
      chassis: this.car.chassis,
      cars: { ...this.garageState.cars, [this.car.chassis]: this.car },
      speedo: this.speedoStyle,
      manual: this.gearbox.manual,
      graphics: this.graphicsLevel,
      presets: this.presets,
      tunes: this.tunes,
    });
  }

  // The chassis the physics drives: the chassis itself on a stock gearbox, a
  // copy with the gearing folded in on a tuned one (Gearbox.js).
  chassisFor(id) {
    return tunedChassis(getChassis(id), this.tunes[id]);
  }

  // result is null for Discard changes, which leaves everything as it was.
  // Save car keeps every chassis's car, drives the one on the turntable, and
  // keeps the dashboard settings.
  closeGarage(result) {
    const back = this._garageBack;
    this._garageBack = null;
    this.uiRoot.classList.remove('garage-open');
    this.input.suspended = false;
    if (!this.drag) this.hud.show();
    this.paused = !!this._pausedBeforeGarage;
    this.loop.accumulator = 0;
    if (result) this._keepGarage(result);
    if (back) back();
  }

  _keepGarage(result) {
    this.garageState = normalizeGarage({ chassis: result.chassis, cars: result.cars });
    Storage.save('garage', this.garageState);
    const id = this.garageState.chassis;
    const tunes = normalizeTunes(result.tunes);
    const retuned = JSON.stringify(tunes[id]) !== JSON.stringify(this.tunes[id]);
    this.tunes = tunes;
    Storage.save('tunes', this.tunes);
    this.speedoStyle = normalizeSpeedo(result.speedo);
    Storage.save('speedo', this.speedoStyle);
    this.speedo.setStyle(this.speedoStyle);
    this.speedo2.setStyle(this.speedoStyle);
    this.setManual(result.manual, false);
    if (result.graphics !== this.graphicsLevel) this.setGraphics(result.graphics);
    this.applyCar(this.garageState.cars[id], retuned);
  }

  // The garage's Graphics setting. Everything built from GRAPHICS or WORLD is
  // built again in place: the car stays where it is and the lap goes on.
  setGraphics(id) {
    this.graphicsLevel = setGraphicsLevel(id);
    Storage.save('graphics', this.graphicsLevel);
    this.scene.applyGraphics(this.trackMesh);
    const night = !!this.track.data.headlights;
    this.vehicle.setHeadlights(night, GRAPHICS.headlightShadows);
    this.headlights.setCount(night ? GRAPHICS.rivalHeadlights : 0);
    this._prewarm = true;
  }

  // --- gearbox --------------------------------------------------------------
  // B, or the garage's Gearbox setting. Kept between sessions.
  toggleManual() {
    this.setManual(!this.gearbox.manual, true);
  }

  setManual(on, announce) {
    on = !!on;
    if (on !== this.gearbox.manual) this.gearbox.setManual(on);
    Storage.save('manual', on);
    // The keyboard's shifters are the driving keys you are not using, so Input
    // needs to know when they stop steering and start shifting.
    this.input.manualKeys = on;
    if (announce) {
      const k = this.input.shiftKeyNames();
      this._note(on ? `Manual gearbox. ${k.up} up, ${k.down} down, X neutral` : 'Automatic gearbox');
    }
  }

  // The shift keys (see Input) and X. Only X reaches here in automatic, and
  // it says how to get the manual box instead.
  _shift(how) {
    if (this.paused) return;
    if (!this.gearbox.manual) { this._note('Press B for the manual gearbox'); return; }
    if (how === 'up') this.gearbox.shiftUp();
    else if (how === 'down') this.gearbox.shiftDown();
    else this.gearbox.neutral();
  }

  // Auto drive, or the cool-down lap after the flag: not the player's hands.
  _someoneElseDriving() {
    return !!this.autoDriver || !!(this.race && this.race.coolDown);
  }

  _note(text) {
    this.timer.flash = { text, colour: 'note', until: this.timer.clock + 1.6 };
  }

  // --- ghost ----------------------------------------------------------------
  // The saved ghost for this track and chassis, if there is one.
  loadGhost() {
    this.ghostRecorder.reset();
    this._pendingGhost = null;
    const raw = Storage.load(Storage.ghostName(this.track.data.id, this.vehicle.chassis.id), null);
    this._setGhost(decodeGhost(raw));
  }

  // The ghost is a copy of the car it was set in, not of whatever you are
  // driving now: same chassis by construction, but the paint is the paint it
  // had on the day.
  _setGhost(lap) {
    this.ghostLap = lap;
    if (!lap) { this.ghostCar.set(null); return; }
    const chassis = getChassis(lap.chassis || this.vehicle.chassis.id);
    const car = normalizeCar({ ...(lap.car || this.car), chassis: chassis.id });
    this.ghostCar.set(lap, chassis, carAppearance(car));
    this._prewarm = true;
  }

  // Once a frame. A new best from the physics step is saved and swapped in
  // here, not in the step, because building a car and writing 50 KB to
  // storage has no business inside the fixed clock.
  _updateGhost(alpha) {
    if (this._pendingGhost) {
      const lap = this._pendingGhost;
      this._pendingGhost = null;
      lap.car = { ...this.car };
      Storage.save(Storage.ghostName(this.track.data.id, lap.chassis), encodeGhost(lap));
      this._setGhost(lap);
    }
    const show = this.ghostOn && !this.race && !this.drag && !!this.ghostLap && this.timer.running;
    // The car on screen is interpolated between the last two physics steps, so
    // it is (1 - alpha) of a step behind the timer. The ghost is drawn at the
    // same moment, or the two would sit half a car apart at speed.
    const t = this.timer.clock - this.timer.lapStart - this.loop.dt * (1 - alpha);
    this.ghostCar.update(show ? this.ghostLap : null, t, this.vehicle.render);
  }

  toggleGhost() {
    this.ghostOn = !this.ghostOn;
    Storage.save('ghost', this.ghostOn);
    const text = !this.ghostOn ? 'Ghost off'
      : this.ghostLap ? 'Ghost on' : 'Ghost on. Set a clean lap to race it';
    this.timer.flash = { text, colour: 'note', until: this.timer.clock + 1.6 };
  }

  // --- feel -----------------------------------------------------------------
  // Shake and a thump for a hit, from a wall or another car, and a softer
  // jolt for a landing. Read off the physics' own record of the hardest recent
  // hit, which decays on the fixed clock: a jump in it is a new hit.
  _impacts(p) {
    const hit = Math.max(p.impactSpeed || 0, p.contactSpeed || 0);
    if (hit > this._lastHit + 0.5 && hit > CAMERA.shakeThreshold) {
      this.camera.kick((hit - CAMERA.shakeThreshold) * CAMERA.shakePerImpact);
      this.sound.thump(hit / AUDIO.thumpFull);
    }
    this._lastHit = hit;
    if (p.airborne) {
      this._airVy = Math.min(this._airVy, p.vy);
    } else if (this._wasAir) {
      const v = -this._airVy;
      if (v > 1) {
        this.camera.kick(v * CAMERA.shakePerLanding);
        this.sound.thump((v / AUDIO.thumpFull) * 0.6);
      }
      this._airVy = 0;
    }
    this._wasAir = p.airborne;
  }

  _fillSound(p, load) {
    const s = this._soundState;
    let tarmac = 0, loose = 0;
    for (let i = 0; i < 4; i++) {
      if (!p.wheelGrounded[i]) continue;
      if (p.wheelSurface[i] === 'tarmac') tarmac++; else loose++;
    }
    s.rpm = this.gearbox.rpm;
    s.voice = this.gearbox.voice;
    s.throttle = load;
    // A shift, or a bounce off the rev limiter in manual: both dip the note.
    s.shifting = this.gearbox.shift > 0 || this.gearbox.cut;
    // The front squeals too, once it is working at its limit.
    s.slip = Math.max(Math.abs(p.slipRear), Math.abs(p.slipFront) * 0.8) / GRIP.peakSlipAngle;
    s.speed = p.speed;
    s.topSpeed = realTopSpeed(this.vehicle.chassis);
    s.tarmac = tarmac / 4;
    s.loose = loose / 4;
    return s;
  }

  // --- screens ----------------------------------------------------------------
  // The title, the pause card and track select all stop the clock and take
  // the input; the menus read the keyboard themselves and the pad through
  // input.menu. Only one is up at a time.
  _closeScreens() {
    this.title.hide();
    this.pauseMenu.hide();
    this.trackSelect.hide();
    this.controlsCard.hidden = true;
  }

  _holdFor(screen) {
    this._closeScreens();
    this.results.close();
    this.screen = screen;
    this.paused = true;
    this.input.suspended = true;
    // The driving HUD is signage for driving; none of it belongs over a menu.
    this.uiRoot.classList.add('menu-open');
    // The fly-by is one camera on the whole screen.
    if ((screen === 'title' || screen === 'tracks') && this.p2) this.scene.endSplit();
  }

  // Straight back to driving, from any screen.
  _resume() {
    this._closeScreens();
    this.screen = null;
    this.uiRoot.classList.remove('menu-open');
    this.paused = false;
    this.input.suspended = false;
    this.loop.accumulator = 0;
    this.camera._initialized = false;
    if (this.p2) this.camera2._initialized = false;
  }

  // The controls card, in the title or the pause card beside its menu.
  _showControls(screen, on = this.controlsCard.hidden) {
    screen.el.append(this.controlsCard);
    this.controlsCard.hidden = !on;
  }

  // The master volume, in steps of 5. Stepping it unmutes (M mutes).
  _volumeRow() {
    return {
      label: 'Volume',
      value: () => (this.sound.muted ? 'Muted' : String(Math.round(this.sound.volume * 100))),
      step: (d) => {
        this.sound.setVolume(Math.min(1, Math.max(0, Math.round(this.sound.volume * 20 + d) / 20)));
        if (this.sound.muted) this.sound.toggleMute();
      },
    };
  }

  showTitle(focus = 0) {
    this._holdFor('title');
    this._tourFrom = this.track.startSample * this.track.ds - 60;
    const rows = [
      { label: 'Time trial', action: () => this.openTrackSelect('trial', 'Back to the title', () => this.showTitle(0)) },
      { label: 'Race', action: () => this.openTrackSelect('race', 'Back to the title', () => this.showTitle(1)) },
      { label: 'Drag race', action: () => this.openTrackSelect('drag', 'Back to the title', () => this.showTitle(2)) },
      { label: 'Fly', action: () => { if (this.onFly) this.onFly(); } },
      { label: 'Garage', action: () => this.openGarage(() => this.showTitle(4)) },
      { label: 'Controls', action: () => this._showControls(this.title) },
      this._volumeRow(),
    ];
    this.title.open(rows, {
      focus,
      // Esc on the title puts the controls away, if they are out.
      onBack: () => { this.controlsCard.hidden = true; },
      onPadStart: () => this.title.menu._activate(),
    });
  }

  // Esc or Start while driving. What is on the card depends on what you are
  // doing: a lap, a race or a drag pass.
  openPause(focus = 0) {
    if (this.garage.visible || this.screen || this.raceResults.visible ||
        this.dragSlip.visible || this.results.ending) return;
    this._holdFor('pause');
    const back = () => this.openPause(this.pauseMenu.menu.index);
    const resume = { label: 'Resume', action: () => this._resume() };
    const toTitle = { label: 'Back to the title', action: () => this.leaveToTitle() };
    let rows, mode;
    if (this.race) {
      mode = `race, ${this.race.laps} ${this.race.laps === 1 ? 'lap' : 'laps'}`;
      rows = [
        resume,
        { label: 'Restart race', action: () => { this._resume(); this.startRace(this.raceSettings); } },
        { label: 'Change track or settings', action: () => this.openTrackSelect('race', 'Back to the pause menu', back) },
        { label: 'Leave race', action: () => { this._resume(); this.endRace(); } },
        toTitle,
      ];
    } else if (this.drag) {
      mode = this.p2 ? 'two players' : 'drag race';
      rows = [
        resume,
        { label: 'Back to the line', action: () => { this._resume(); this.restageDrag(); } },
        { label: 'Change players or cars', action: () => this.openTrackSelect('drag', 'Back to the pause menu', back) },
        { label: 'Garage', action: () => this.openGarage(back) },
        toTitle,
      ];
    } else {
      mode = 'time trial';
      rows = [
        resume,
        { label: 'Restart from the grid', action: () => { this._resume(); this.restartLap(); } },
        { label: 'Change track or car', action: () => this.openTrackSelect('trial', 'Back to the pause menu', back) },
        { label: 'Garage', action: () => this.openGarage(back) },
        toTitle,
      ];
    }
    rows.push(this._volumeRow());
    this.pauseMenu.open(rows, {
      focus,
      sub: `${this.track.data.name}, ${mode}`,
      onBack: () => this._resume(),
      onPadStart: () => this._resume(),
    });
    // The brief puts a short controls card on the pause screen.
    this._showControls(this.pauseMenu, true);
  }

  // `back` is the label of the way out, and `onBack` what it does.
  openTrackSelect(mode, back, onBack) {
    this._holdFor('tracks');
    this.trackSelect.onBack = onBack;
    this.trackSelect.open({
      mode,
      trackId: this.track.data.id,
      chassisId: this.vehicle.chassis.id,
      race: this.raceSettings,
      drag: this.dragSettings,
      trial: { pace: this.rivalsOn, ghost: this.ghostOn },
      dragBests: this.dragBests,
      back,
    });
  }

  // N while driving: track select for a race, or on the strip for the next
  // drag race. Mid-race it is Esc that has the race's options.
  quickTrackSelect() {
    if (this.race || this.garage.visible || this.screen) return;
    this.openTrackSelect(this.drag ? 'drag' : 'race', 'Back to driving', () => this._resume());
  }

  // Start from track select: the car, then the track, then the mode, each only
  // rebuilt if it changed. Whatever was running before ends here, and a time
  // trial with laps in it shows its results first.
  startSession(pick) {
    this._endTrialSession(() => this._startSession(pick));
  }

  _startSession(pick) {
    if (this.race) this._leaveRace();
    if (pick.chassisId !== this.car.chassis && CHASSIS.some((c) => c.id === pick.chassisId)) {
      // Picked here, it is the car you drive from now on, as in the garage.
      this.garageState = normalizeGarage({ ...this.garageState, chassis: pick.chassisId });
      Storage.save('garage', this.garageState);
      this.applyCar(this.garageState.cars[pick.chassisId]);
    }
    if (pick.mode === 'race') {
      this.raceSettings = normalizeRaceSettings(pick.race);
      Storage.save('race', this.raceSettings);
    } else if (pick.mode === 'drag') {
      this.dragSettings = normalizeDragSettings(pick.drag);
      Storage.save('drag', this.dragSettings);
    } else {
      this.rivalsOn = pick.trial.pace !== false;
      Storage.save('rivals', this.rivalsOn);
      this.ghostOn = pick.trial.ghost !== false;
      Storage.save('ghost', this.ghostOn);
    }
    const idx = Math.max(0, TRACKS.findIndex((t) => t.id === pick.trackId));
    const moved = TRACKS[idx] !== this.track.data;
    this._resume();
    if (moved) {
      this.trackIdx = idx;
      // Builds the pace car, or on a strip stages the drag race.
      this.loadTrack(TRACKS[idx]);
    }
    if (pick.mode === 'race') {
      this.startRace(this.raceSettings);
    } else if (pick.mode === 'drag') {
      if (!moved) this.startDrag(this.dragSettings);
    } else if (!moved) {
      this.buildRivals();
      this.resetVehicle();
      this.timer.reset();
      this.hud.show();
    }
    this.scene.settle();
  }

  // Leaving a time trial that has laps in it: its results first, then on.
  _endTrialSession(next) {
    if (this.race || this.drag || this.timer.laps.length === 0) { next(); return; }
    this._holdFor('results');
    this.results.showEnd(this.timer, this.track.data.name, () => {
      this.timer.reset();
      next();
    });
  }

  // Back to the start line, the lap given up, the pace car back ahead.
  restartLap() {
    this.timer.invalidateForReset();
    this.resetVehicle();
    this.timer.reset();
  }

  // Whatever you were doing ends, and the title comes up over this track.
  leaveToTitle() {
    this._endTrialSession(() => {
      if (this.race) this.endRace();
      else if (this.drag) this.restageDrag();
      this.showTitle();
    });
  }
}
