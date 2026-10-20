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

import { Aircraft } from '../flight/Aircraft.js';
import { AIRCRAFT } from '../data/aircraft.js';
import { World } from '../world/World.js';
import { WorldMesh, worldEnvironment } from '../render/WorldMesh.js';
import { TRACKS } from '../data/tracks/index.js';
import { FlightCamera } from '../render/FlightCamera.js';
import { ShockWave } from '../render/ShockWave.js';
import { FlightInput } from './FlightInput.js';
import { FlightAudio } from './FlightAudio.js';
import { FlightHud } from '../ui/FlightHud.js';
import { FlightScreens } from '../ui/FlightScreens.js';
import { UNIT_SYSTEMS, normalizeUnits } from '../flight/Units.js';
import { OPEN_WORLD, FLIGHT_CAMERA as FC, SHOCK, DEFAULT_GRAPHICS_LEVEL } from '../data/tuning.js';
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

    // Everything is unlocked for now; the first aircraft that is, is flown.
    this.def = AIRCRAFT.find((a) => isUnlocked('aircraft', a.id)) || AIRCRAFT[0];
    // The world is made the first time you fly: its track areas are placed by
    // looking at the land, which takes about 20 ms.
    this.world = new World(TRACKS);
    this.mesh = new WorldMesh(this.world);
    this.env = worldEnvironment(OPEN_WORLD);
    this.aircraft = new Aircraft(this.def);
    this.shock = new ShockWave(this.aircraft.root, this.def.length / 2 - 1);
    this.input = new FlightInput(canvas);
    this.camera = new FlightCamera(this.scene.camera);
    // The camera is kept off the ground wherever it has got to. It works in drawn
    // coordinates; the ground is in the world's.
    this.camera.groundFn = (x, z) => this.world.height(x + this.mesh.origin.ox, z + this.mesh.origin.oz);
    this.audio = new FlightAudio(this.sound);
    this.hud = new FlightHud(this.uiRoot);
    this.screens = new FlightScreens(this.uiRoot);

    this.units = normalizeUnits(Storage.load('flight.units', 'aviation'));
    this.hud.setUnits(this.units);
    this.hudOn = Storage.load('flight.hud', true) !== false;
    this.mesh.setRenderDistance(Storage.load('flight.renderDistance', OPEN_WORLD.renderDistance.default));
    this.mesh.setDetail(Storage.load('flight.detail', OPEN_WORLD.detailDefault));
    this._capRenderDistance();
    this._camState = { x: 0, y: 0, z: 0, qx: 0, qy: 0, qz: 0, qw: 1 };
    this._camAbs = { x: 0, y: 0, z: 0 };
    this._fwd = { x: 0, z: 1 };

    this.active = false;
    this.paused = true;
    this.gearLever = true;
    this.lastStart = 'runway';
    this._crashT = -1;
    this._menuSpin = 0;
    this._savedCamMode = 0;
    this._aoWas = true;
    this._loopWas = null;
  }

  get physics() { return this.aircraft.physics; }

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
    this._place('runway');
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
  // Put the aircraft down: on the runway, engines idling, or in the air.
  _place(mode) {
    const p = this.physics;
    this.lastStart = mode;
    const home = this.world.spawn();
    if (mode === 'air') {
      // Near the home field, high, on its heading, so what is under you is the
      // runway and the land round it.
      p.reset({ x: home.x, y: home.y + 1500, z: home.z - 2600, heading: home.heading, pitch: 0.04, speed: 170, fuel: 0.6, throttle: 0.7, gear: 0 });
      this.gearLever = false;
    } else {
      p.reset({ x: home.x, y: home.y + 1.6, z: home.z, heading: home.heading, fuel: 0.6, gear: 1, throttle: 0 });
      this.gearLever = true;
    }
    const st = this.input.state;
    st.throttleKick = 0;
    this._crashT = -1;
    this.shock.reset();
    this._tailNoteT = 0;
    this.camera.reset();
    this._primeWorld();
    this.aircraft.updateVisual(1, 1 / 60, this.mesh.origin.ox, this.mesh.origin.oz);
  }

  // Build the ground under and ahead of the aircraft before the first frame of a
  // start, coarse levels first, so it never begins over a hole.
  _primeWorld() {
    const p = this.physics, m = this.mesh;
    // The origin first: where the aircraft is, so everything is drawn near zero.
    m.origin.rebaseTo(Math.round(p.x / OPEN_WORLD.lattice) * OPEN_WORLD.lattice, Math.round(p.z / OPEN_WORLD.lattice) * OPEN_WORLD.lattice);
    m.chunks.prime(p.x, p.y, p.z, 0, 1, m.drawRange);
  }

  start(mode) {
    this._place(mode);
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

  // --- the fixed step ---------------------------------------------------------------
  step(dt) {
    if (this.paused) return;
    const st = this.input.state;
    st.gearDown = this.gearLever;
    this.physics.step(dt, st, this.world);
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

  showFlyMenu(focus = 0) {
    this.paused = true;
    this.input.suspended = true;
    this._menuSpin = 0;
    this.uiRoot.classList.add('menu-open');
    this.screens.pause.hide();
    const rows = [
      { label: 'Start on the runway', action: () => this.start('runway') },
      { label: 'Start airborne', action: () => this.start('air') },
      { label: 'Controls', action: () => this.screens.showCard(this.screens.fly) },
      this._unitsRow(),
      this._renderRow(),
      this._detailRow(),
      this._volumeRow(),
      { label: 'Back to the title', action: () => this.exit() },
    ];
    this.screens.fly.open(rows, {
      focus,
      sub: `${this.def.name}, at the home field. The world is 120 km across.`,
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
    const rows = [
      { label: 'Resume', action: resume },
      { label: 'Restart on the runway', action: () => this.start('runway') },
      { label: 'Controls', action: () => this.screens.showCard(this.screens.pause) },
      this._unitsRow(),
      this._renderRow(),
      this._detailRow(),
      this._invertRow(),
      this._volumeRow(),
      { label: 'Back to the title', action: () => this.exit() },
    ];
    this.screens.pause.open(rows, {
      focus,
      sub: `${this.def.name}, over the open world`,
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

  // --- the frame ----------------------------------------------------------------------------
  render(alpha, frameDelta) {
    const dt = Math.max(frameDelta, 1e-4);
    const game = this.game;
    const sc = this.scene;
    const inp = this.input;
    const p = this.physics;

    // The car Input still reads the pad's menu edges for us while it is suspended.
    game.input.poll();
    this.screens.handlePad(game.input.menu);

    inp.poll(dt);
    const menu = this.screens.visible;

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
        this.gearLever = !this.gearLever;
        this.hud.note(this.gearLever ? 'Gear down' : 'Gear up', 1.5);
      }
      if (inp.consumeAction('reset')) this.start(this.lastStart === 'air' ? 'air' : 'runway');
      // The rest are for later milestones: flaps, autopilot, hover, weapons, the map.
      inp.clearActions();
    }

    // A crash, until there are real ones (milestone 5): note it, then start over.
    if (p.crashed && this._crashT < 0 && !this.paused) {
      this._crashT = 0;
      this.hud.note(`The F-22 ${p.crashReason}. Back to the runway in a moment.`, 3);
    }
    if (this._crashT >= 0 && !this.paused) {
      this._crashT += dt;
      if (this._crashT > 2.6) this.start(this.lastStart);
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
      if (this.camera.mode !== 2) this.camera.mode = 2;
      look = this._spinLook || (this._spinLook = { x: 0, y: 0.12 });
      look.x = this._menuSpin;
    } else if (this.camera.mode === 2 && this._savedCamMode !== 2 && !this.paused) {
      this.camera.mode = this._savedCamMode;
    }

    const agl = Math.max(0, this.world.agl(p.x, p.y, p.z) - 1.5);
    let shake = 0;
    let boom = false;
    if (!this.paused) {
      boom = this.shock.update(dt, p.mach, !p.crashed && !p.onGround, this.camera.mode === 1);
      if (boom) this.camera.punch = SHOCK.kickFov;
      shake = p.engines[0].abLevel * FC.shakeBurner + (p.stalled ? FC.shakeStall : p.stallWarn ? FC.shakeStall * 0.4 : 0) +
        this.shock.envelope * SHOCK.shake;
    }
    this.camera.update(cs, p.tas, agl, look, shake, this.def.cockpitEye, 0, dt);

    sc.frame(cs.x, cs.y, cs.z, dt);
    sc.render(dt);

    // The HUD.
    if (!this.paused && this.hudOn) {
      const att = p.attitude();
      this.hud.update({
        cas: p.cas, tas: p.tas, mach: p.mach, altitude: p.altitude, agl,
        climb: p.climb, heading: att.heading, pitch: att.pitch, bank: att.bank,
        alpha: p.alpha, beta: p.beta, nz: p.nz,
        throttle: p.throttle, ab: p.engines[0].abLevel, abFuel: p.abFuel, abLocked: p.abLocked,
        fuel: p.fuel / this.def.fuelCapacity, gear: p.gearDown, onGround: p.onGround,
        stallWarn: p.stallWarn, stalled: p.stalled, resetProgress: inp.resetProgress,
        cockpit: this.camera.mode === 1,
      });
    }

    // The sound.
    if (this.paused) {
      this.audio.update(null);
    } else {
      this.audio.update({
        spool: (p.engines[0].n + p.engines[1].n) * 0.5,
        ab: (p.engines[0].abLevel + p.engines[1].abLevel) * 0.5,
        speed: p.tas,
        stallWarn: p.stallWarn && !p.onGround,
        cockpit: this.camera.mode === 1,
        boom,
        dt,
      });
    }
  }
}
