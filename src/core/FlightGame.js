// The flight game. It does for flying what Game does for driving: it owns the
// aircraft, the camera, the HUD and the sound, and runs on the same fixed
// 120 Hz loop.
//
// It does not build a renderer of its own. A canvas has one WebGL context, so
// FlightGame borrows the car Game's Scene (its renderer, post chain, sun and
// sky), its SoundEngine and its Loop, and swaps what they draw and call while
// flying is up. Nothing of the car game is torn down: entering hides the car
// world, leaving puts it back and brings the title up where you left it.
//
// Milestone 1 flew the F-22 on a flat test field with a runway. Milestone 2 put it
// over the open world: the same ground contract (World.sample), a floating origin
// so the scene is drawn near zero while the physics stays in absolute
// coordinates, and the world streamed in around the aircraft as it flies.
// Milestone 3 gave the world its airports: a flight starts on the apron of the
// airport last used, on its runway, or in the air near it; a stop in a hangar bay
// opens the Hangar; the map teleports to an airport.

import { Aircraft } from '../flight/Aircraft.js';
import { Autopilot } from '../flight/Autopilot.js';
import { AIRCRAFT } from '../data/aircraft.js';
import { World } from '../world/World.js';
import { WorldMesh, worldEnvironment } from '../render/WorldMesh.js';
import { TRACKS } from '../data/tracks/index.js';
import { FlightCamera, CAM } from '../render/FlightCamera.js';
import { ShockWave } from '../render/ShockWave.js';
import { FlightInput } from './FlightInput.js';
import { FlightPlaces } from './FlightPlaces.js';
import { mapMarkers } from '../world/MapData.js';
import { FlightAudio } from './FlightAudio.js';
import { FlightHud } from '../ui/FlightHud.js';
import { FlightScreens } from '../ui/FlightScreens.js';
import { Hangar } from '../ui/Hangar.js';
import { loadSetup, saveSetup } from './HangarStore.js';
import { payloadMass } from '../data/loadouts.js';
import { UNIT_SYSTEMS, normalizeUnits, distanceIn } from '../flight/Units.js';
import { OPEN_WORLD, FLIGHT_CAMERA as FC, SHOCK, HANGAR, DEFAULT_GRAPHICS_LEVEL } from '../data/tuning.js';
import { isUnlocked } from '../data/unlocks.js';
import * as Storage from './Storage.js';

const SYSTEM_NAMES = { aviation: 'Knots, feet and Mach', mph: 'Miles an hour and feet', metric: 'Kilometres an hour and metres' };

export class FlightGame {
  constructor(game) {
    this.game = game;
    this.scene = game.scene;
    this.sound = game.sound;
    this.uiRoot = game.uiRoot;
    const canvas = this.scene.renderer.domElement;

    // Everything is unlocked for now; the aircraft last flown, or the first that is, is flown.
    const flown = Storage.load('flight.aircraft', '');
    this.def = AIRCRAFT.find((a) => a.id === flown && isUnlocked('aircraft', a.id)) ||
      AIRCRAFT.find((a) => isUnlocked('aircraft', a.id)) || AIRCRAFT[0];
    // The world is made the first time you fly: its track areas are placed by
    // looking at the land, which takes about 20 ms.
    this.world = new World(TRACKS);
    this.places = new FlightPlaces(this.world, this.def);
    this.mesh = new WorldMesh(this.world);
    this.night = Storage.load('flight.night', false) === true;
    this.env = worldEnvironment(OPEN_WORLD, OPEN_WORLD.renderDistance.default, this.night);
    // What the Hangar keeps for this aircraft: its paint, load and tuning.
    this.setup = loadSetup(this.def.id);
    this.aircraft = new Aircraft(this.def, this.setup.livery);
    this._applySetup();
    this.shock = this.def.supersonic ? new ShockWave(this.aircraft.root, this.def.length / 2 - 1) : null;
    this.input = new FlightInput(canvas);
    this.camera = new FlightCamera(this.scene.camera);
    // The camera is kept off the ground wherever it has got to. It works in drawn
    // coordinates; the ground is in the world's.
    this.camera.groundFn = (x, z) => this.world.height(x + this.mesh.origin.ox, z + this.mesh.origin.oz);
    this.audio = new FlightAudio(this.sound);
    this.hud = new FlightHud(this.uiRoot);
    this.hud.radar.setLandmarks(mapMarkers(this.world));
    this.screens = new FlightScreens(this.uiRoot);
    this.hangar = new Hangar(this.uiRoot, this.scene.renderer);

    this.units = normalizeUnits(Storage.load('flight.units', 'aviation'));
    this.hud.setUnits(this.units);
    this.hudOn = Storage.load('flight.hud', true) !== false;
    this.mesh.setRenderDistance(Storage.load('flight.renderDistance', OPEN_WORLD.renderDistance.default));
    this.mesh.setDetail(Storage.load('flight.detail', OPEN_WORLD.detailDefault));
    this._capRenderDistance();
    this._camState = { x: 0, y: 0, z: 0, qx: 0, qy: 0, qz: 0, qw: 1 };
    this._camAbs = { x: 0, y: 0, z: 0 };
    this._fwd = { x: 0, z: 1 };

    // The systems the aircraft has: the flap lever (a detent), the autopilot, and the command
    // the physics is flown with (what the pilot does, with the autopilot's hand on it).
    this.flapLever = 0;
    this.autopilot = new Autopilot(this.def);
    this._cmd = { pitch: 0, roll: 0, yaw: 0, analog: false, throttleRate: 0, throttleKick: 0, ab: false, brake: 0, airbrake: false, gearDown: true, flaps: 0, cannon: false };
    this._configure();

    this.active = false;
    this.paused = true;
    this.gearLever = true;
    this.lastStart = 'apron';
    this._crashT = -1;
    this._menuSpin = 0;
    this._savedCamMode = 0;
    this._aoWas = true;
    this._loopWas = null;
  }

  get physics() { return this.aircraft.physics; }

  // The night preview (the day and night cycle is milestone 9): the sky, the light,
  // the fog and the airports' lamps.
  setNight(on) {
    this.night = !!on;
    Storage.save('flight.night', this.night);
    this.mesh.setNight(this.night);
    this.env = worldEnvironment(OPEN_WORLD, this.mesh.renderDistance, this.night);
    if (this.active) this.scene.setEnvironment(this.env, this.mesh.root);
  }

  // What depends on which aircraft is flown: the camera's distances, the HUD's rows, the
  // sound's voices, the map's silhouette.
  _configure() {
    const d = this.def;
    this.camera.cfg = { ...FC, ...(d.camera || null) };
    this.camera.overlay = this.scene.overlayCamera;
    this.camera.reset();
    this.hud.configure(d);
    this.audio.setAircraft(d);
    this.screens.map.icon = d.mapIcon || 'delta';
  }

  // The flap lever, one detent at a time. Out is refused above the detent's limit speed.
  _flaps(dir) {
    const det = this.def.flaps ? this.def.flaps.detents : null;
    if (!det || det.length < 2) { this.hud.note('No flaps', 1.5); return; }
    const next = Math.max(0, Math.min(det.length - 1, this.flapLever + dir));
    if (next === this.flapLever) return;
    if (next > this.flapLever && this.physics.cas > det[next].vfe) {
      this.hud.note(`Too fast for flaps ${det[next].name}`, 1.8);
      return;
    }
    this.flapLever = next;
    this.hud.note(`Flaps ${det[next].name}`, 1.5);
    this.audio.thump();
  }

  // The name of the flap setting the lever is at, for the HUD.
  flapName() {
    const det = this.def.flaps ? this.def.flaps.detents : null;
    return det && det.length > 1 ? det[Math.round(this.physics.flapPos)].name : '';
  }

  // P: the autopilot takes the aircraft as it is (the altitude, heading and speed it has
  // now), or lets go. Only in the air.
  _autopilot() {
    const p = this.physics;
    if (this.autopilot.on) { this.autopilot.disengage(); this.hud.note('Autopilot off', 1.5); return; }
    const agl = this.world.agl(p.x, p.y, p.z);
    if (p.onGround || p.gear.weightOnWheels > 0.02 || p.crashed || agl < this.autopilot.cfg.engageAgl) {
      this.hud.note('The autopilot needs some height above the ground', 1.8);
      return;
    }
    this.autopilot.engage(p);
    this.hud.note('Autopilot on: altitude, heading and speed held', 2);
  }

  _apOff() {
    this.hud.note(`Autopilot off: ${this.autopilot.why}`, 2);
    this.autopilot.why = '';
  }

  // Another aircraft, from the Hangar: the old one is taken out of the scene and put away, the new one
  // built with its own setup and put in the same place, or at the nearest airport that can take it.
  // `setup` is the Hangar's, for the new aircraft. Returns the airport it was put at.
  switchAircraft(id, setup = null) {
    const def = AIRCRAFT.find((a) => a.id === id && isUnlocked('aircraft', a.id));
    if (!def || def === this.def) return this.places.last;
    if (this.active) this.scene.scene.remove(this.aircraft.root);
    this.aircraft.dispose();
    if (this.shock) { this.shock.dispose?.(); }
    this.def = def;
    this.setup = setup || loadSetup(def.id);
    this.aircraft = new Aircraft(def, this.setup.livery);
    this._applySetup();
    this.shock = def.supersonic ? new ShockWave(this.aircraft.root, def.length / 2 - 1) : null;
    this.places.def = def;
    this.autopilot = new Autopilot(def);
    Storage.save('flight.aircraft', def.id);
    if (this.active) this.scene.add(this.aircraft.root);
    this._configure();
    // Where it goes: this airport if it can take it, otherwise the nearest that can.
    let ap = this.places.last;
    if (!this.places.eligible(ap, 'apron').ok) {
      const p = this.physics;
      ap = this.places.nearestEligible(p.x, p.z) || this.places.airports.major;
    }
    return ap;
  }

  // After a crash: choose where to start again, the hangar of the airport last used or the runway of
  // the nearest airport that can take the aircraft (a 737 is not sent to an airstrip).
  openCrash() {
    const p = this.physics;
    this.paused = true;
    this.input.suspended = true;
    this.input.setMouseFlight(false);
    this.hud.hide();
    this.uiRoot.classList.add('menu-open');
    const near = this.places.nearestEligible(p.x, p.z, 'runway');
    const far = near ? distanceIn(Math.hypot(near.px - p.x, near.pz - p.z), this.units) : null;
    const rows = [
      { label: `Respawn at the hangar, ${this.places.last.name}`, action: () => this.toHangar(false) },
      near
        ? { label: `Respawn on the nearest runway, ${near.name} (${Math.round(far.value)} ${far.unit})`, action: () => this.start('runway', near) }
        : { label: 'No runway can take it', cls: 'row-off', action: () => {} },
      { label: 'Open the map', action: () => { this.screens.crash.hide(); this.openMap('crash'); } },
      { label: 'Back to the title', action: () => this.exit() },
    ];
    this.screens.crash.open(rows, {
      sub: `The ${this.def.name} ${p.crashReason}. Where do you want to start again?`,
      onBack: () => this.toHangar(false),
      onPadStart: () => this.screens.crash.menu._activate(),
    });
  }

  // --- entering and leaving ---------------------------------------------------
  // Called from the title's Fly row.
  enter() {
    if (this.active) return;
    const g = this.game;
    const sc = this.scene;
    this.active = true;

    g._closeScreens();
    // The garage's graphics level may have changed since you last flew.
    this._capRenderDistance();
    g.input.suspended = true;
    g.sound.update(null);
    sc.holdCarWorld();
    this.mesh.setNight(this.night);
    sc.setEnvironment(this.env, this.mesh.root);
    sc.add(this.aircraft.root);
    sc.setCameraRange(FC.nearMin, this.mesh.drawRange + 3000);
    this._applyDetail();
    sc.settle(3);
    // Ambient occlusion is tuned for a few metres of reach; over kilometres of
    // depth it only speckles and costs frame time.
    if (sc.post && sc.post.ao) { this._aoWas = sc.post.ao.enabled; sc.post.ao.enabled = false; }

    this.uiRoot.classList.add('flight-mode');
    this.uiRoot.classList.remove('menu-open');
    this.input.attach();
    this.input.suspended = true;
    this.input.clearActions();

    this._loopWas = { step: g.loop.step, render: g.loop.render };
    g.loop.step = (dt) => this.step(dt);
    g.loop.render = (alpha, frameDelta) => this.render(alpha, frameDelta);
    g.loop.accumulator = 0;

    this.camera.reset();
    this._savedCamMode = this.camera.mode;
    this._place('apron');
    // Make the first meshes now, so prewarm below compiles the world's shaders
    // here and not on the first frame of a start.
    const a0 = this._camAbs;
    a0.x = this.physics.x; a0.y = this.physics.y; a0.z = this.physics.z;
    this.mesh.update(a0, this._fwd, 1, 1 / 60);
    this.hud.setUnits(this.units);
    this.hud.hide();
    this.showFlyMenu();
    if (!Storage.load('flight.seenControls', false)) {
      this.screens.showCard(this.screens.fly, true);
      Storage.save('flight.seenControls', true);
    }
    sc.prewarm();
  }

  exit() {
    if (!this.active) return;
    const g = this.game;
    const sc = this.scene;
    this.active = false;
    this.input.setMouseFlight(false);
    this.input.detach();
    this.screens.hideAll();
    this.hud.hide();
    this.audio.update(null);

    g.loop.step = this._loopWas.step;
    g.loop.render = this._loopWas.render;
    g.loop.accumulator = 0;

    sc.scene.remove(this.aircraft.root);
    sc.setOverlay(false);
    this.aircraft.setInterior(false);
    // The car world is drawn at the screen's resolution with its own shadow.
    sc.setRenderScaleCeiling(1);
    sc.setShadowReach(1);
    sc.releaseCarWorld();
    // The track comes back as it does when you pick another circuit.
    sc.setTrack(g.track, g.trackMesh);
    if (sc.post && sc.post.ao) sc.post.ao.enabled = this._aoWas;
    sc.settle(3);

    this.uiRoot.classList.remove('flight-mode', 'menu-open');
    g.camera._initialized = false;
    g._prewarm = true;
    g.showTitle(3);
  }

  // --- the aircraft ---------------------------------------------------------------
  // Put the aircraft down at an airport (the one last used unless one is named): on
  // its apron, engines idling, on the runway, in the air on the centre line, or at the
  // mouth of a hangar bay. A mode the airport cannot take (a heliport has no runway for
  // a fighter) is the air start.
  _place(mode, airport = this.places.last) {
    const p = this.physics;
    if (!this.places.eligible(airport, mode).ok) mode = 'air';
    this.lastStart = mode;
    const at = this.places.pose(airport, mode);
    this.autopilot.disengage();
    if (mode === 'air') {
      // High, level, on the centre line and the heading of the runway, so what is
      // under you is the airport and the land round it.
      const a = this.def.airStart;
      p.reset({ x: at.x, y: at.y, z: at.z, heading: at.heading, pitch: a.pitch, speed: a.speed, fuel: HANGAR.startFuel, throttle: a.throttle, gear: 0, flaps: a.flaps });
      this.gearLever = false;
      this.flapLever = a.flaps;
    } else {
      // On its wheels, a little above them: the lowest tyre's height less a hand's breadth.
      const stand = -Math.min(...this.def.gear.wheels.map((w) => w.pos[1])) - 0.15;
      p.reset({ x: at.x, y: at.y + stand, z: at.z, heading: at.heading, fuel: HANGAR.startFuel, gear: 1, throttle: 0 });
      this.gearLever = true;
      this.flapLever = 0;
    }
    this.places.setLast(airport);
    this.places.rearm();
    this._whereT = 0;               // so the place text is right on the first frame
    const st = this.input.state;
    st.throttleKick = 0;
    this._crashT = -1;
    if (this.shock) this.shock.reset();
    this._tailNoteT = 0;
    this.camera.reset();
    this._primeWorld();
    this.aircraft.updateVisual(1, 1 / 60, this.mesh.origin.ox, this.mesh.origin.oz);
  }

  // Build the ground under and ahead of the aircraft before the first frame of a
  // start, coarse levels first, so it never begins over a hole, and the airports near
  // it, so it never begins on bare ground.
  _primeWorld() {
    const p = this.physics, m = this.mesh;
    // The origin first: where the aircraft is, so everything is drawn near zero.
    m.origin.rebaseTo(Math.round(p.x / OPEN_WORLD.lattice) * OPEN_WORLD.lattice, Math.round(p.z / OPEN_WORLD.lattice) * OPEN_WORLD.lattice);
    m.chunks.prime(p.x, p.y, p.z, 0, 1, m.drawRange);
    m.primeAirports(p.x, p.z, 3500);
  }

  start(mode, airport = this.places.last) {
    this._place(mode, airport);
    this.screens.hideAll();
    this.uiRoot.classList.remove('menu-open');
    this.camera.mode = this._savedCamMode;
    this.camera.reset();
    this.paused = false;
    this.input.suspended = false;
    this.input.clearActions();
    this.game.loop.accumulator = 0;
    if (this.hudOn) this.hud.show();
  }

  // R held, or after a crash: back at the mouth of a hangar bay of the airport last
  // used (the respawn list of milestone 5 will choose the airport).
  toHangar(note = true) {
    this.start('hangar');
    if (note) this.hud.note(`At the hangar, ${this.places.last.name}`, 2.5);
  }

  // --- the fixed step ---------------------------------------------------------------
  step(dt) {
    if (this.paused) return;
    const st = this.input.state;
    st.gearDown = this.gearLever;
    st.flaps = this.flapLever;
    // The autopilot, if it is on, flies the stick and the throttle; otherwise this is the
    // pilot's own input, copied. The physics clears the throttle's kick on what it is handed.
    const cmd = this._cmd;
    this.autopilot.step(dt, this.physics, st, cmd);
    this.physics.step(dt, cmd, this.world);
    st.throttleKick = 0;
    if (!this.autopilot.on && this.autopilot.why) this._apOff();
    this.mesh.ambient.fixedStep();
  }

  // --- the screens ---------------------------------------------------------------------
  _volumeRow() { return this.game._volumeRow(); }

  _unitsRow() {
    return {
      label: 'Units',
      value: () => SYSTEM_NAMES[this.units],
      step: (d) => {
        const i = UNIT_SYSTEMS.indexOf(this.units);
        this.units = UNIT_SYSTEMS[(i + d + UNIT_SYSTEMS.length) % UNIT_SYSTEMS.length];
        Storage.save('flight.units', this.units);
        this.hud.setUnits(this.units);
      },
    };
  }

  // The most the garage's graphics level allows (OPEN_WORLD.levelCaps).
  _renderCap() {
    const caps = OPEN_WORLD.levelCaps;
    return Math.min(caps[this.game.graphicsLevel] ?? caps[DEFAULT_GRAPHICS_LEVEL], OPEN_WORLD.renderDistance.max);
  }

  _capRenderDistance() {
    const cap = this._renderCap();
    if (this.mesh.renderDistance > cap) this.mesh.setRenderDistance(cap);
  }

  // How far you can see: the world's chunks, its fog and its scenery together.
  _renderRow() {
    const rd = OPEN_WORLD.renderDistance;
    return {
      label: 'View distance',
      value: () => `${Math.round(this.mesh.renderDistance / 1000)} km`,
      step: (d) => {
        const cap = this._renderCap();
        const next = Math.min(cap, Math.max(rd.min, Math.round((this.mesh.renderDistance + d * rd.step) / rd.step) * rd.step));
        this.mesh.setRenderDistance(next);
        Storage.save('flight.renderDistance', this.mesh.renderDistance);
      },
    };
  }

  // How much the world is drawn with (OPEN_WORLD.detailSteps): sharper ground,
  // more scenery, a wider shadow, and a picture that may be rendered above the
  // screen's resolution. The Scene's half of it is applied here; the world's is
  // the mesh's. A change that touches the ground builds it again right away.
  _applyDetail() {
    const step = this.mesh.detailStep;
    this.scene.setRenderScaleCeiling(step.scale);
    this.scene.setShadowReach(step.shadow);
  }

  _detailRow() {
    const steps = OPEN_WORLD.detailSteps;
    return {
      label: 'Detail',
      value: () => {
        const s = this.mesh.detailStep;
        return `${s.name}, ${+(OPEN_WORLD.chunkSize / s.cells).toFixed(1)} m ground`;
      },
      step: (d) => {
        const next = Math.min(steps.length - 1, Math.max(0, this.mesh.detail + d));
        if (next === this.mesh.detail) return;
        const rebuilt = this.mesh.setDetail(next);
        Storage.save('flight.detail', next);
        this._applyDetail();
        if (rebuilt) this._primeWorld();
      },
    };
  }

  _invertRow() {
    return {
      label: 'Pitch with the mouse and stick',
      value: () => (this.input.invertY ? 'Inverted' : 'Normal'),
      step: () => this.input.setInvertY(!this.input.invertY),
    };
  }

  // How a start reads on the menu: its name, and why not if this airport cannot take it.
  _startRow(mode, label) {
    const ok = this.places.eligible(this.places.last, mode);
    return {
      label: ok.ok ? label : `${label}: ${ok.why.toLowerCase()}`,
      cls: ok.ok ? '' : 'row-off',
      action: () => { if (ok.ok) this.start(mode); },
    };
  }

  // Which airport free flight starts at: a line to step through, so any of them can be
  // picked without the map.
  _airportRow(rebuild) {
    return {
      label: 'Airport',
      value: () => {
        const a = this.places.last, L = a.layout;
        return `${a.name}, ${a.isHeliport ? 'helipad' : `${L.length.toLocaleString('en-US')} m`}`;
      },
      step: (d) => {
        const next = this.places.step(d);
        this.places.setLast(next);
        this._place('apron', next);
        rebuild();
      },
    };
  }

  // The night preview: until the day and night cycle (milestone 9) the world is one
  // day and one night, so the airports' lights can be judged.
  _timeRow() {
    return {
      label: 'Time of day',
      value: () => (this.night ? 'Night preview' : 'Day'),
      step: () => this.setNight(!this.night),
    };
  }

  showFlyMenu(focus = 0) {
    this.paused = true;
    this.input.suspended = true;
    this._menuSpin = 0;
    this.uiRoot.classList.add('menu-open');
    this.screens.pause.hide();
    const rebuild = () => this.showFlyMenu(this.screens.fly.menu.index);
    const rows = [
      this._startRow('apron', 'Start on the apron'),
      this._startRow('runway', 'Start on the runway'),
      { label: 'Start airborne near the airport', action: () => this.start('air') },
      this._airportRow(rebuild),
      { label: 'Open the hangar', action: () => this.openHangar('fly') },
      { label: 'Open the map', action: () => this.openMap('fly') },
      { label: 'Controls', action: () => this.screens.showCard(this.screens.fly) },
      this._unitsRow(),
      this._renderRow(),
      this._detailRow(),
      this._timeRow(),
      this._volumeRow(),
      { label: 'Back to the title', action: () => this.exit() },
    ];
    this.screens.fly.open(rows, {
      focus,
      sub: `${this.def.name}, at ${this.places.last.name}. The world is 120 km across.`,
      onBack: () => { if (!this.screens.card.hidden) this.screens.card.hidden = true; else this.exit(); },
      onPadStart: () => this.screens.fly.menu._activate(),
    });
  }

  openPause(focus = 0) {
    if (this.screens.visible) return;
    this.paused = true;
    this.input.suspended = true;
    this.input.setMouseFlight(false);
    this.uiRoot.classList.add('menu-open');
    const resume = () => this.resume();
    const restart = { apron: 'Restart on the apron', runway: 'Restart on the runway', air: 'Restart airborne', hangar: 'Back to the hangar' }[this.lastStart];
    const rows = [
      { label: 'Resume', action: resume },
      { label: restart, action: () => this.start(this.lastStart) },
      // Only in a hangar bay: the hangar is where the aircraft is, not a menu.
      ...(this.places.zone ? [{ label: 'Open the hangar', action: () => this.openHangar('pause') }] : []),
      { label: 'Open the map', action: () => this.openMap('pause') },
      { label: 'Controls', action: () => this.screens.showCard(this.screens.pause) },
      this._unitsRow(),
      this._renderRow(),
      this._detailRow(),
      this._timeRow(),
      this._invertRow(),
      this._volumeRow(),
      { label: 'Back to the title', action: () => this.exit() },
    ];
    this.screens.pause.open(rows, {
      focus,
      sub: `${this.def.name}${this.places.where(this.physics) ? ', ' + this.places.where(this.physics) : ', over the open world'}`,
      onBack: resume,
      onPadStart: resume,
    });
    this.screens.showCard(this.screens.pause, true);
  }

  resume() {
    this.screens.hideAll();
    this.uiRoot.classList.remove('menu-open');
    this.paused = false;
    this.input.suspended = false;
    this.input.clearActions();
    this.game.loop.accumulator = 0;
    if (this.hudOn) this.hud.show();
  }

  // Where the aircraft is, in words, refreshed a few times a second.
  _where(dt) {
    this._whereT = (this._whereT || 0) - dt;
    if (this._whereT <= 0) { this._whereT = 0.25; this._whereText = this.places.where(this.physics); }
    return this._whereText || '';
  }

  // What the Hangar sets reaches the aircraft here and nowhere else: its mass and
  // its three tuning scales go to the physics, its livery to the mesh.
  _applySetup(repaint = false) {
    const s = this.setup;
    this.physics.setup({ payload: payloadMass(this.def, s.loadout), tune: s.tune });
    if (repaint) this.aircraft.setLivery(s.livery);
  }

  // The Hangar: by stopping in a bay (from 'play'), or from the Fly menu or the
  // pause card. Closing goes back to whichever it came from.
  openHangar(from = 'play') {
    if (this.hangar.visible) return;
    this.paused = true;
    this.input.suspended = true;
    this.input.setMouseFlight(false);
    this.screens.hideAll();
    this.hud.hide();
    this.audio.update(null);
    this.uiRoot.classList.add('menu-open');
    // Every aircraft's setup is offered; Save keeps all of them.
    const setups = {};
    for (const a of AIRCRAFT) setups[a.id] = a.id === this.def.id ? this.setup : loadSetup(a.id);
    this.hangar.open({
      defs: AIRCRAFT,
      id: this.def.id,
      setups,
      onClose: (result) => {
        let moved = null;
        if (result) {
          for (const [id, st] of Object.entries(result.setups)) saveSetup(id, st);
          if (result.id !== this.def.id) {
            // Another aircraft was chosen: it is built and put at this airport, or the
            // nearest that can take it.
            const was = this.places.last;
            moved = this.switchAircraft(result.id, result.setups[result.id]);
            this.places.setLast(moved);
            this._place(from === 'play' ? 'hangar' : 'apron', moved);
            this._moveNote = moved !== was ? `${this.def.name} needs a longer runway: moved to ${moved.name}` : '';
          } else {
            this.setup = result.setups[this.def.id];
            this._applySetup(true);
          }
        }
        if (from === 'fly') this.showFlyMenu();
        else if (from === 'pause') this.openPause();
        else {
          this.resume();
          this.hud.note(this._moveNote || (result ? 'Hangar changes saved' : 'Left the hangar as it was'), 2.5);
          this._moveNote = '';
        }
      },
    });
  }

  // The map: from flying (M), from the Fly menu or from the pause card, and back to
  // whichever it came from. A teleport starts a flight at the airport you chose.
  openMap(from = 'play') {
    const map = this.screens.map;
    if (map.visible) return;
    this.paused = true;
    this.input.suspended = true;
    this.input.setMouseFlight(false);
    this.screens.fly.hide();
    this.screens.pause.hide();
    this.screens.card.hidden = true;
    this.uiRoot.classList.add('menu-open');
    this._mapFrom = from;
    const p = this.physics;
    map.open({
      world: this.world, places: this.places, units: this.units, defName: this.def.name,
      state: () => ({ x: p.x, z: p.z, heading: p.attitude().heading }),
      onClose: () => {
        if (this._mapFrom === 'fly') this.showFlyMenu();
        else if (this._mapFrom === 'pause') this.openPause();
        else if (this._mapFrom === 'crash') this.openCrash();
        else this.resume();
      },
      onTeleport: (ap, mode) => this.start(mode, ap),
    });
  }

  // --- the frame ----------------------------------------------------------------------------
  render(alpha, frameDelta) {
    const dt = Math.max(frameDelta, 1e-4);
    const game = this.game;
    const sc = this.scene;
    const inp = this.input;
    const p = this.physics;

    // The car Input still reads the pad's menu edges for us while it is suspended.
    game.input.poll();
    // The Hangar owns the screen while it is open: it draws its own scene.
    if (this.hangar.visible) {
      this.hangar.handlePad(game.input.menu);
      this.audio.update(null);
      if (this.hangar.visible) this.hangar.render(dt);
      return;
    }
    this.screens.handlePad(game.input.menu);

    inp.poll(dt);
    const menu = this.screens.visible;
    if (this.screens.map.visible) this.screens.map.tick();

    if (!menu) {
      if (inp.consumeAction('pause') || inp.lockLost) { inp.lockLost = false; this.openPause(); }
      if (inp.consumeAction('camera')) { this.camera.cycle(); this._savedCamMode = this.camera.mode; this.hud.cameraName(this.camera.name); }
      if (inp.consumeAction('hud')) {
        this.hudOn = !this.hudOn;
        Storage.save('flight.hud', this.hudOn);
        if (this.hudOn) this.hud.show(); else this.hud.hide();
      }
      if (inp.consumeAction('mute')) this.sound.toggleMute();
      if (inp.consumeAction('mouseFlight')) {
        inp.setMouseFlight(!inp.mouseFlight);
        this.hud.note(inp.mouseFlight ? 'Mouse flight on. Esc or T to give the mouse back.' : 'Mouse flight off.', 2.5);
      }
      if (inp.consumeAction('gear')) {
        if (this.gearLever && p.F.gearLock && p.gear.weightOnWheels > p.F.gearLockWow) {
          this.hud.note('Gear locked down: the wheels carry the aircraft', 1.8);
        } else {
          this.gearLever = !this.gearLever;
          this.hud.note(this.gearLever ? 'Gear down' : 'Gear up', 1.5);
        }
      }
      if (inp.consumeAction('flapsDown')) this._flaps(1);
      if (inp.consumeAction('flapsUp')) this._flaps(-1);
      if (inp.consumeAction('autopilot')) this._autopilot();
      if (inp.consumeAction('reset')) this.toHangar();
      if (inp.consumeAction('map')) this.openMap('play');
      // The rest are for later milestones: hover, the hook, weapons.
      inp.clearActions();
    }

    // A crash, until there are real ones (milestone 5): let the wreck sit for a moment, then ask
    // where to start again.
    if (p.crashed && this._crashT < 0 && !this.paused) {
      this._crashT = 0;
      this.hud.note(`The ${this.def.name} ${p.crashReason}.`, 3);
    }
    if (this._crashT >= 0 && !this.paused) {
      this._crashT += dt;
      if (this._crashT > FC.crashMenuDelay) this.openCrash();
    }

    // Airports: the hangar bay, and where the aircraft has landed.
    if (!this.paused) {
      if (this.places.update(dt, p) === 'hangar') this.openHangar();
    }

    // A tail that touched down is worth a word: it did no harm, but it was a
    // rotation that went too far.
    this._tailNoteT = Math.max(0, (this._tailNoteT || 0) - dt);
    if (p.gear.skidHit > 0 && !p.crashed && this._tailNoteT <= 0 && !this.paused) {
      this.hud.note('Tail strike', 1.5);
      this._tailNoteT = 4;
    }

    const mesh = this.mesh, org = mesh.origin;
    this.aircraft.updateVisual(alpha, dt, org.ox, org.oz);
    const s = this.aircraft.render;          // absolute: what the physics says

    // The world first. It follows the aircraft, and may move the origin, after
    // which everything drawn is placed from the new one.
    const abs = this._camAbs, fwd = this._fwd;
    abs.x = s.x; abs.y = s.y; abs.z = s.z;
    fwd.x = 2 * (s.qx * s.qz + s.qw * s.qy);
    fwd.z = 1 - 2 * (s.qx * s.qx + s.qy * s.qy);
    const fl = Math.hypot(fwd.x, fwd.z);
    if (fl > 1e-3) { fwd.x /= fl; fwd.z /= fl; } else { fwd.x = 0; fwd.z = 1; }
    if (mesh.update(abs, fwd, alpha, dt)) this.aircraft.updateVisual(alpha, dt, org.ox, org.oz);
    mesh.applyEnvironment(sc, abs, dt);
    // The camera and the sun's shadow work in drawn coordinates.
    const cs = this._camState;
    cs.x = s.x - org.ox; cs.y = s.y; cs.z = s.z - org.oz;
    cs.qx = s.qx; cs.qy = s.qy; cs.qz = s.qz; cs.qw = s.qw;

    // Behind the Fly menu the camera circles the aircraft on the runway.
    let look = inp.look;
    if (this.screens.fly.visible) {
      this._menuSpin += dt * 0.25;
      if (this.camera.mode !== CAM.ORBIT) this.camera.mode = CAM.ORBIT;
      look = this._spinLook || (this._spinLook = { x: 0, y: 0.12 });
      look.x = this._menuSpin;
    } else if (this.camera.mode === CAM.ORBIT && this._savedCamMode !== CAM.ORBIT && !this.paused) {
      this.camera.mode = this._savedCamMode;
    }

    const agl = Math.max(0, this.world.agl(p.x, p.y, p.z) - 1.5);
    let shake = 0;
    let boom = false;
    if (!this.paused) {
      if (this.shock) boom = this.shock.update(dt, p.mach, !p.crashed && !p.onGround, this.camera.isEye);
      if (boom) this.camera.punch = SHOCK.kickFov;
      shake = p.engines[0].abLevel * FC.shakeBurner + (p.stalled ? FC.shakeStall : p.stallWarn ? FC.shakeStall * 0.4 : 0) +
        (this.shock ? this.shock.envelope * SHOCK.shake : 0);
    }
    // The eye: the first person view looks from where the pilot's head is, the cockpit view from the
    // seat (a little back and to the side where the aircraft has one), with the inside drawn.
    const view = this.def.cockpitView;
    const inside = this.camera.mode === CAM.COCKPIT && !!this.aircraft.interior;
    this.camera.update(cs, p.tas, agl, look, shake, inside && view ? view.eye : this.def.cockpitEye, 0, dt);
    sc.setOverlay(inside);
    this.aircraft.setInterior(inside);

    sc.frame(cs.x, cs.y, cs.z, dt);
    sc.render(dt);

    // The HUD.
    if (!this.paused && this.hudOn) {
      const att = p.attitude();
      this.hud.update({
        cas: p.cas, tas: p.tas, mach: p.mach, altitude: p.altitude, agl,
        climb: p.climb, heading: att.heading, pitch: att.pitch, bank: att.bank,
        alpha: p.alpha, beta: p.beta, nz: p.nz,
        throttle: p.throttle, ab: p.abLevel, abFuel: p.abFuel, abLocked: p.abLocked,
        flaps: p.flapPos, flapName: this.flapName(), airbrake: p.airbrake,
        ap: this.autopilot,
        fuel: p.fuel / this.def.fuelCapacity, gear: p.gearDown, onGround: p.onGround,
        stallWarn: p.stallWarn, stalled: p.stalled, resetProgress: inp.resetProgress,
        cockpit: this.camera.mode === CAM.FIRST,
        x: p.x, z: p.z,
        brake: p.brake, parked: p.parked, steer: p.gear.steerAngle, weightOnWheels: p.gear.weightOnWheels,
        gearWarn: !p.onGround && p.gearDown < 0.5 && agl < p.F.gearWarnAgl && p.cas < p.F.gearWarnCas && p.climb < 3,
        where: this._where(dt), zone: this.places.zone ? this.places.progress : -1,
      });
    }

    // The sound.
    if (this.paused) {
      this.audio.update(null);
    } else {
      this.audio.update({
        spool: p.spool,
        ab: p.abLevel,
        speed: p.tas,
        stallWarn: p.stallWarn && !p.onGround,
        gearWarn: !p.onGround && p.gearDown < 0.5 && agl < p.F.gearWarnAgl && p.cas < p.F.gearWarnCas && p.climb < 3,
        cockpit: this.camera.isEye,
        boom,
        dt,
      });
    }
  }
}
