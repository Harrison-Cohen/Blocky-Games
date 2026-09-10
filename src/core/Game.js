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
import { SUSPENSION, GRAPHICS } from '../data/tuning.js';
import { normalizeCar, carAppearance } from '../data/customization.js';
import { OPPONENTS } from '../data/opponents.js';
import { RacingLine } from '../ai/RacingLine.js';
import { AIDriver } from '../ai/AIDriver.js';
import * as Storage from './Storage.js';

const sameCar = (a, b) => Object.keys(a).every((k) => a[k] === b[k]);

// Metres of road between the start line and the first rival, and between
// rivals. Far enough ahead that a time trial is not spent behind one.
const AI_GRID_GAP = 90;

export class Game {
  constructor({ canvas, uiRoot }) {
    this.scene = new Scene(canvas);
    this.camera = new ChaseCamera(this.scene.camera);

    // The car and the track come back from the last session. Both are
    // normalised on the way in, because what comes out of localStorage is
    // whatever was there -- an older version of this game, or an edit by hand.
    this.car = normalizeCar(Storage.load('car', null));
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

    this.loadTrack(TRACKS[this.trackIdx]);

    this.input = new Input();
    this.input.attach();

    this.debug = new DebugHud(uiRoot);
    this.hud = new HUD(uiRoot);
    this.results = new Results(uiRoot);
    this.hud.show();
    this.uiRoot = uiRoot;
    this.speedValueEl = uiRoot.querySelector('.speed-value');
    this.controlsCard = uiRoot.querySelector('.controls-card');
    this.autoBadge = uiRoot.querySelector('.auto-badge');
    this.paused = false;

    this.garage = new Garage(uiRoot, this.scene.renderer);
    this.garage.onSave = (car) => Storage.save('car', car);
    this.garage.onClose = (car) => this.closeGarage(car);

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
    // The racing line belongs to the track and costs about 50 ms to solve, so
    // it is built here, once, and shared by every driver on it.
    this.line = new RacingLine(this.track);
    // A timer belongs to a track: its records, its checkpoints, its sectors.
    this.timer = new LapTimer(this.track, this.vehicle.chassis.id);
    this.buildRivals();
    this.buildAutoDriver();
    this.resetVehicle();
  }

  // --- opponents ------------------------------------------------------------
  // Each rival is a Vehicle exactly like the player's, plus an AIDriver holding
  // its controls. It is stepped by the same physics on the same clock and is
  // subject to the same grip, so nothing it does is out of the player's reach.
  buildRivals() {
    for (const r of this.rivals) this.scene.scene.remove(r.vehicle.root);
    this.rivals = [];
    if (!this.rivalsOn) return;
    for (const spec of OPPONENTS.slice(0, 1)) {
      const chassis = getChassis(spec.chassis);
      const vehicle = new Vehicle(chassis, carAppearance(spec.car));
      vehicle.setHeadlights(!!this.track.data.headlights, false);
      const driver = new AIDriver(this.track, this.line, chassis,
        { name: spec.name, ...spec.style });
      this.scene.add(vehicle.root);
      this.rivals.push({ spec, vehicle, driver });
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

  // Drop the car on the track at a spawn point, resting on its springs.
  placeAt(spawn) {
    const c = this.vehicle.chassis;
    const rest = c.suspensionRest ?? SUSPENSION.restLength;
    const ground = this.track.sample(spawn.x, spawn.z, spawn.y);
    this.vehicle.physics.reset(spawn.x, ground.height + rest, spawn.z, spawn.yaw);
    this.camera._initialized = false;
    // A teleported car has no steering history, so neither should its driver.
    if (this.autoDriver) this.autoDriver.reset();
  }

  resetVehicle() {
    this.placeAt(this.track.spawn());
    this.placeRivals();
  }

  // R: back to the last checkpoint, facing down the track, not to the start.
  resetToCheckpoint() {
    // Teleporting ends the lap as a timed effort, whatever else happens.
    this.timer.invalidateForReset();
    const p = this.vehicle.physics;
    const cp = this.track.lastCheckpointFor(p.x, p.z, p.y);
    this.placeAt(this.track.spawnAt(cp.sample, 6));
  }

  step(dt) {
    if (this.paused) return;
    // The driver runs INSIDE the fixed step, like the player's input smoothing
    // and for the same reason: an AI whose steering ramp advanced once per
    // frame would drive differently on a 144 Hz machine than on a 60 Hz one.
    for (const r of this.rivals) {
      r.vehicle.step(dt, r.driver.update(dt, r.vehicle.physics), this.track);
    }
    // Auto drive replaces the keyboard, inside the fixed step like the rivals.
    const controls = this.autoDriver
      ? this.autoDriver.update(dt, this.vehicle.physics)
      : this.input.state;
    this.vehicle.step(dt, controls, this.track);
    // After the vehicle, so the physics prev* fields still hold the position at
    // the start of this step and the crossing can be timed within it.
    this.timer.step(dt, this.vehicle.physics);
  }

  render(alpha, frameDelta) {
    this.input.poll();

    // The garage owns the screen while it is open: it renders its own scene
    // into the same canvas, and the track is left exactly as it was so that
    // closing it is instant.
    if (this.garage.visible) {
      this.garage.handlePad(this.input.menu);
      if (this.garage.visible) this.garage.render(Math.max(frameDelta, 1e-4));
      return;
    }

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

    const dt = Math.max(frameDelta, 1e-4);
    this.vehicle.updateVisual(alpha, dt);
    for (const r of this.rivals) r.vehicle.updateVisual(alpha, dt);

    const s = this.vehicle.render;
    this.camera.update(s, this.vehicle.speed, this.vehicle.chassis, dt);
    this.scene.frame(s.x, s.y, s.z, dt);
    this.scene.render(dt);

    const kmh = Math.round(this.vehicle.speed * 3.6);
    if (this._lastKmh !== kmh) {
      this.speedValueEl.textContent = String(kmh);
      this._lastKmh = kmh;
    }

    this.hud.update(this.timer, this.track, this.vehicle.physics);
    this.results.render(this.timer);
    this.debug.update(this.vehicle, this.loop, this.camera, frameDelta, this.track, this.scene);
  }

  // V: swap chassis where you stand, for comparing two cars on one corner.
  // Deliberately not persisted -- saving a car is the garage's job, and its
  // Save and Discard buttons only mean something if nothing else writes.
  nextChassis() {
    const next = (this.chassisIdx + 1) % CHASSIS.length;
    this.applyCar({ ...this.car, chassis: CHASSIS[next].id });
  }

  // T: move to the next circuit. The track select screen is milestone 9; until
  // then this is the only way to reach the other two, and it stands in exactly
  // the same relationship to that screen as V does to the garage. It DOES
  // persist, because which track you are on is where you are rather than a
  // change you might want to discard.
  nextTrack() {
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
    // Records are per chassis, so swapping swaps the target and the history.
    this.timer.setChassis(chassis.id);
    this.timer.invalidateForReset();
    // The profile is per chassis, so a new car needs a new driver.
    this.buildAutoDriver();
    this.placeAt(keep);
  }

  openGarage() {
    if (this.garage.visible) return;
    this._pausedBeforeGarage = this.paused;
    this.paused = true;
    this.input.suspended = true;
    this.controlsCard.hidden = true;
    this.results.close();
    this.hud.hide();
    this.uiRoot.classList.add('garage-open');
    this.garage.open(this.car);
  }

  closeGarage(car) {
    this.uiRoot.classList.remove('garage-open');
    this.input.suspended = false;
    this.hud.show();
    this.paused = !!this._pausedBeforeGarage;
    this.loop.accumulator = 0;
    this.applyCar(car);
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
