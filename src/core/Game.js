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
import { CHASSIS, getChassis } from '../data/cars.js';
import { getTrack, DEFAULT_TRACK, TRACKS } from '../data/tracks/index.js';
import { SUSPENSION, GRAPHICS, RACE, CAMERA, AUDIO, GRIP } from '../data/tuning.js';
import { normalizeCar, carAppearance, normalizeGarage, normalizePresets } from '../data/customization.js';
import { OPPONENTS } from '../data/opponents.js';
import { RacingLine } from '../ai/RacingLine.js';
import { AIDriver } from '../ai/AIDriver.js';
import * as Storage from './Storage.js';
import { Race } from './Race.js';
import { RaceHud } from '../ui/RaceHud.js';
import { RaceSetup, RaceResults } from '../ui/RaceScreens.js';
import { HeadlightPool } from '../render/HeadlightPool.js';
import { hexToCss } from '../data/palette.js';
import { Effects } from '../render/Effects.js';
import { GhostCar } from '../render/GhostCar.js';
import { GhostRecorder, encodeGhost, decodeGhost } from '../game/Ghost.js';
import { Gearbox, voiceFor } from '../game/Gearbox.js';
import { SoundEngine } from './Audio.js';
import { Speedo, toMph, normalizeSpeedo } from '../ui/Speedo.js';

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

// Metres of road between the start line and the first rival, and between
// rivals. Far enough ahead that a time trial is not spent behind one.
const AI_GRID_GAP = 90;

export class Game {
  constructor({ canvas, uiRoot }) {
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

    this.vehicle = new Vehicle(CHASSIS[this.chassisIdx], carAppearance(this.car));
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

    this.debug = new DebugHud(uiRoot);
    this.hud = new HUD(uiRoot);
    this.results = new Results(uiRoot);
    this.raceHud = new RaceHud(uiRoot);
    this.raceSetup = new RaceSetup(uiRoot);
    this.raceSetup.onStart = (s) => {
      this.raceSettings = normalizeRaceSettings(s);
      Storage.save('race', this.raceSettings);
      this.raceSetup.hide();
      this.closeRaceSetup();
      this.startRace(this.raceSettings);
    };
    this.raceSetup.onLeave = () => { this.raceSetup.hide(); this.closeRaceSetup(); this.endRace(); };
    this.raceSetup.onClose = () => this.closeRaceSetup();
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
    this.hud.show();
    this.uiRoot = uiRoot;
    this.controlsCard = uiRoot.querySelector('.controls-card');
    this.autoBadge = uiRoot.querySelector('.auto-badge');
    this.speedo = new Speedo(uiRoot);
    this.speedo.setStyle(this.speedoStyle);
    this.speedo.setCar(voiceFor(this.vehicle.chassis.id), this.vehicle.chassis.topSpeed);
    this._bindVolume(uiRoot);
    this.paused = false;

    this.garage = new Garage(uiRoot, this.scene.renderer);
    this.garage.onClose = (result) => this.closeGarage(result);
    // Presets are a library, not part of a car, so they are kept the moment
    // they change rather than waiting for Save car.
    this.garage.onPresets = (list) => { this.presets = list; Storage.save('presets', list); };

    this.loop = new Loop({
      step: (dt) => this.step(dt),
      render: (alpha, frameDelta) => this.render(alpha, frameDelta),
    });
  }

  start() { this.loop.start(); }

  loadTrack(data) {
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
  }

  // --- opponents ------------------------------------------------------------
  // Each rival is a Vehicle exactly like the player's, plus an AIDriver holding
  // its controls. It is stepped by the same physics on the same clock and is
  // subject to the same grip, so nothing it does is out of the player's reach.
  buildRivals() {
    for (const r of this.rivals) r.vehicle.dispose(this.scene.scene);
    this.rivals = [];
    // In a race the field is the race's, not the time trial's pace car.
    if (!this.rivalsOn || this.race) return;
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
    if (this.race) return;
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
    this.autoDrive = !this.autoDrive;
    this.buildAutoDriver();
    this.autoBadge.hidden = !this.autoDrive;
  }

  // --- race mode ------------------------------------------------------------
  // N opens the setup card. It stands in for the track select screen, which
  // is milestone 9 and will carry the same three settings.
  openRaceSetup() {
    if (this.garage.visible || this.raceSetup.visible || this.raceResults.visible) return;
    this.paused = true;
    this.input.suspended = true;
    this.controlsCard.hidden = true;
    this.results.close();
    this.raceSetup.open(this.raceSettings, !!this.race);
  }

  closeRaceSetup() {
    this.input.suspended = false;
    this.paused = false;
    this.loop.accumulator = 0;
  }

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

  // Back to time trial, on the grid, with the pace car back if it was on.
  endRace() {
    this._clearRace();
    this.raceHud.hide();
    this.raceResults.hide();
    this.uiRoot.classList.remove('race-active');
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
    // The race cards take the gamepad's menu edges the same way the garage does.
    if (this.raceSetup.visible) this.raceSetup.handlePad(this.input.menu);
    else if (this.raceResults.visible) this.raceResults.handlePad(this.input.menu);

    if (this.input.consumeAction('pause')) this.togglePause();
    if (this.input.consumeAction('reset')) this.resetToCheckpoint();
    if (this.input.consumeAction('cycleCamera')) this.camera.cycle();
    if (this.input.consumeAction('toggleDebug')) this.debug.toggle();
    if (this.input.consumeAction('nextChassis')) this.nextChassis();
    if (this.input.consumeAction('nextTrack')) this.nextTrack();
    if (this.input.consumeAction('rivals')) this.toggleRivals();
    if (this.input.consumeAction('autoDrive')) this.toggleAutoDrive();
    if (this.input.consumeAction('results')) this.results.toggle(this.timer);
    if (this.input.consumeAction('garage')) this.openGarage();
    if (this.input.consumeAction('race')) this.openRaceSetup();
    if (this.input.consumeAction('ghost')) this.toggleGhost();
    if (this.input.consumeAction('mute')) { this.sound.toggleMute(); if (this._showVolume) this._showVolume(); }
    if (this.input.consumeAction('manual')) this.toggleManual();
    if (this.input.consumeAction('shiftUp')) this._shift('up');
    if (this.input.consumeAction('shiftDown')) this._shift('down');
    if (this.input.consumeAction('neutral')) this._shift('neutral');

    const dt = Math.max(frameDelta, 1e-4);
    this.vehicle.updateVisual(alpha, dt);
    for (const r of this.rivals) r.vehicle.updateVisual(alpha, dt);
    for (const c of this.raceCars) c.vehicle.updateVisual(alpha, dt);

    const s = this.vehicle.render;
    const p = this.vehicle.physics;
    const live = !this.paused;
    if (live) this._impacts(p);
    this.camera.update(s, this.vehicle.speed, this.vehicle.chassis, dt, p);
    this._fxCars.length = 0;
    this._fxCars.push(this.vehicle);
    for (const r of this.rivals) this._fxCars.push(r.vehicle);
    for (const c of this.raceCars) this._fxCars.push(c.vehicle);
    this.effects.update(this._fxCars, live ? dt : 0);
    this._updateGhost(alpha);
    this.headlights.update(this.race ? this.raceCars : this.rivals, this.scene.camera.position);
    this.scene.frame(s.x, s.y, s.z, dt);
    this.scene.render(dt);

    // Reversing, the brake pedal is what is driving the car.
    const load = p.vLong < -0.5 ? p.brake : p.throttle;
    // Someone else at the wheel drives in automatic whatever the player chose,
    // because their controls never carry a gear.
    const manual = this.gearbox.manual && !this._someoneElseDriving();
    this.gearbox.update(live ? dt : 0, p.vLong, load, !manual);
    // The gear reaches the physics with the next step's input, on the fixed
    // clock like the pedals.
    this.input.state.manual = manual;
    this.input.state.gear = this.gearbox.selected;
    this.speedo.update(toMph(this.vehicle.speed), this.gearbox.rpm, this.gearbox.label,
      manual, this.gearbox.limiting);
    this.sound.update(live ? this._fillSound(p, load) : null);

    this.hud.update(this.timer, this.track, this.vehicle.physics, this._hudExtras());
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

  // T: move to the next circuit. The track select screen is milestone 9; until
  // then this is the only way to reach the other two, and it stands in exactly
  // the same relationship to that screen as V does to the garage. It DOES
  // persist, because which track you are on is where you are rather than a
  // change you might want to discard.
  nextTrack() {
    if (this.race) return;
    this.trackIdx = (this.trackIdx + 1) % TRACKS.length;
    this.loadTrack(TRACKS[this.trackIdx]);
  }

  // Rebuild the player's car from a config, keeping it where it stands.
  //
  // Rebuilding stands the car still, so it ends the timed lap the same way the
  // reset key does. A config that has not actually changed is a no-op, which
  // is what makes opening the garage for a look and leaving again free.
  applyCar(car) {
    const next = normalizeCar(car);
    if (sameCar(next, this.car)) return;
    this.car = next;
    const chassis = getChassis(this.car.chassis);
    this.chassisIdx = Math.max(0, CHASSIS.indexOf(chassis));
    const p = this.vehicle.physics;
    const keep = { x: p.x, y: p.y, z: p.z, yaw: p.yaw };
    this.vehicle.setCar(chassis, carAppearance(this.car), this.scene.scene);
    // Records are per chassis, so swapping swaps the target and the history --
    // and the ghost, which is the ghost of that record.
    this.timer.setChassis(chassis.id);
    this.timer.invalidateForReset();
    this.gearbox.setChassis(chassis);
    this.speedo.setCar(voiceFor(chassis.id), chassis.topSpeed);
    this.loadGhost();
    // The profile is per chassis, so a new car needs a new driver.
    this.buildAutoDriver();
    this.placeAt(keep);
  }

  openGarage() {
    // Mid-race, the car is on the grid or on the track; it cannot also be in
    // the garage. Leave the race first (N).
    if (this.garage.visible || this.race) return;
    this._pausedBeforeGarage = this.paused;
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
      presets: this.presets,
    });
  }

  // result is null for Discard changes, which leaves everything as it was.
  // Save car keeps every chassis's car, drives the one on the turntable, and
  // keeps the dashboard settings.
  closeGarage(result) {
    this.uiRoot.classList.remove('garage-open');
    this.input.suspended = false;
    this.hud.show();
    this.paused = !!this._pausedBeforeGarage;
    this.loop.accumulator = 0;
    if (!result) return;
    this.garageState = normalizeGarage({ chassis: result.chassis, cars: result.cars });
    Storage.save('garage', this.garageState);
    this.speedoStyle = normalizeSpeedo(result.speedo);
    Storage.save('speedo', this.speedoStyle);
    this.speedo.setStyle(this.speedoStyle);
    this.setManual(result.manual, false);
    this.applyCar(this.garageState.cars[this.garageState.chassis]);
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
    if (announce) this._note(on ? 'Manual gearbox. E up, Q down, X neutral' : 'Automatic gearbox');
  }

  // E, Q and X. In automatic they say how to get the manual box instead.
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
    const show = this.ghostOn && !this.race && !!this.ghostLap && this.timer.running;
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
    s.topSpeed = this.vehicle.chassis.topSpeed;
    s.tarmac = tarmac / 4;
    s.loose = loose / 4;
    return s;
  }

  // The one master volume slider, on the controls card the pause screen
  // shows. Saved as it moves.
  _bindVolume(root) {
    const slider = root.querySelector('.volume-slider');
    const label = root.querySelector('.volume-value');
    if (!slider || !label) return;
    const show = () => {
      label.textContent = this.sound.muted ? 'Muted' : String(Math.round(this.sound.volume * 100));
    };
    slider.value = String(Math.round(this.sound.volume * 100));
    show();
    slider.addEventListener('input', () => {
      this.sound.setVolume(Number(slider.value) / 100);
      if (this.sound.muted) this.sound.toggleMute();
      show();
    });
    // Let go of it once it is set, so the arrow keys go back to driving.
    slider.addEventListener('change', () => slider.blur());
    this._showVolume = show;
  }

  togglePause() {
    this.paused = !this.paused;
    this.controlsCard.hidden = !this.paused;
    if (!this.paused) this.loop.accumulator = 0;
  }

  dismissControls() {
    this.controlsCard.hidden = true;
    this.paused = false;
  }
}
