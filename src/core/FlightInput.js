// Keyboard, gamepad and mouse flight, all live at once.
//
// The cars' Input is left alone: this is a second input layer that the flight
// game owns while it is up, and the car Input is suspended meanwhile (so it
// neither drives nor collects shortcuts). The two modes never share a key
// press; they share the layout of the menus, which the car Input's gamepad menu
// edges serve for both.
//
// Everything the physics reads is in `state`, in the signs the model wants and
// flipped once, here: pitch + is pull, roll + is right, yaw + is right.
// Digital keys are flagged (`analog` false) so the physics can ramp them on the
// fixed clock; smoothing here would run at display rate and make the aircraft
// handle differently at 144 Hz.
//
// One-shot actions are collected in `actions` and consumed by the game once.
//
// The standard gamepad mapping is assumed; a pad that reports no mapping (a
// flight stick) falls back to axis 0 roll, 1 pitch, 2 twist rudder, 3 throttle.

import { INPUT, FLIGHT_INPUT as FI, FLIGHT_CAMERA as FC } from '../data/tuning.js';
import { load, save } from './Storage.js';

function deadzone(v, dz) {
  const a = Math.abs(v);
  if (a < dz) return 0;
  return Math.sign(v) * ((a - dz) / (1 - dz));
}
const curve = (v) => Math.sign(v) * Math.pow(Math.abs(v), INPUT.steerGamma);
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

export class FlightInput {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.suspended = false;

    // What the physics reads.
    this.state = {
      pitch: 0, roll: 0, yaw: 0, analog: false,
      throttleRate: 0, throttleKick: 0,
      ab: false, brake: 0, airbrake: false,
      gearDown: true,
      // The flap lever (a detent index; the game sets it) and the autopilot's three target
      // keys, each -1..1 and the same on every aircraft: altitude (up, down), heading
      // (right, left) and speed (W, S). The autopilot reads them only while it is on.
      flaps: 0, apAlt: 0, apHdg: 0, apSpd: 0,
      // Weapons and systems, held states (later milestones read them).
      cannon: false,
    };

    // One-shot actions, consumed by the game.
    this.actions = {
      pause: false, camera: false, hud: false, map: false, mute: false,
      mouseFlight: false, reset: false, telemetry: false,
      gear: false, hangar: false, airbrake: false, flapsUp: false, flapsDown: false, autopilot: false, hover: false, hook: false,
      missile: false, flares: false, target: false,
    };

    this.invertY = load('flight.invertY', false) === true;
    this.mouseFlight = false;
    this.look = { x: 0, y: 0, active: false };   // free look offsets, radians
    this.resetProgress = 0;                      // 0..1 while the reset is held

    this._mouse = { x: 0, y: 0 };
    this._lookMouse = false;
    this._resetHeld = 0;
    this._brakeKey = 0;
    this._backWas = false;
    this._backUsed = false;
    this._prev = [];
    this._menuAUsed = false;
    this._prevThrottleAxis = null;
    this._pad = null;
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._onBlur = this._onBlur.bind(this);
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onMouseDown = this._onMouseDown.bind(this);
    this._onMouseUp = this._onMouseUp.bind(this);
    this._onWheel = this._onWheel.bind(this);
    this._onLock = this._onLock.bind(this);
    this._onContext = (e) => e.preventDefault();
  }

  attach() {
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    window.addEventListener('wheel', this._onWheel, { passive: false });
    window.addEventListener('contextmenu', this._onContext);
    document.addEventListener('pointerlockchange', this._onLock);
  }

  detach() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('blur', this._onBlur);
    window.removeEventListener('mousemove', this._onMouseMove);
    window.removeEventListener('mousedown', this._onMouseDown);
    window.removeEventListener('mouseup', this._onMouseUp);
    window.removeEventListener('wheel', this._onWheel);
    window.removeEventListener('contextmenu', this._onContext);
    document.removeEventListener('pointerlockchange', this._onLock);
    this.setMouseFlight(false);
    this.keys.clear();
  }

  setInvertY(on) {
    this.invertY = !!on;
    save('flight.invertY', this.invertY);
  }

  // Mouse flight needs the pointer locked to the game, which the browser only
  // grants to a user gesture -- a key press counts. Esc gives the lock back.
  setMouseFlight(on) {
    if (on && !this.mouseFlight) {
      try {
        const r = this.canvas.requestPointerLock && this.canvas.requestPointerLock();
        if (r && r.catch) r.catch(() => {});
      } catch { /* a browser that refuses simply stays on the keys */ }
    } else if (!on && document.pointerLockElement === this.canvas) {
      document.exitPointerLock();
    }
    this.mouseFlight = on;
    if (!on) { this._mouse.x = 0; this._mouse.y = 0; }
  }

  _onLock() {
    const locked = document.pointerLockElement === this.canvas;
    if (!locked && this.mouseFlight) {
      this.mouseFlight = false;
      this._mouse.x = 0; this._mouse.y = 0;
      this.lockLost = true;
    } else if (locked) {
      this.mouseFlight = true;
    }
  }

  _onKeyDown(e) {
    // Not in a text box (the map's stop search): there a space is a space.
    const typing = e.target && e.target.tagName === 'INPUT' && e.target.type === 'text';
    if (!typing && (e.code === 'Space' || e.code.startsWith('Arrow'))) e.preventDefault();
    if (typing || e.repeat || this.suspended) return;
    this.keys.add(e.code);
    const A = this.actions;
    switch (e.code) {
      case 'Escape': A.pause = true; break;
      case 'KeyC': A.camera = true; break;
      case 'KeyU': A.hud = true; break;
      case 'KeyM': A.map = true; break;
      case 'KeyN': A.mute = true; break;
      case 'KeyT': A.mouseFlight = true; break;
      case 'Backquote': A.telemetry = true; break;
      case 'KeyG': A.gear = true; break;
      case 'Enter': A.hangar = true; break;
      case 'KeyV': A.airbrake = true; break;
      case 'KeyZ': A.flapsUp = true; break;
      case 'KeyX': A.flapsDown = true; break;
      case 'KeyP': A.autopilot = true; break;
      case 'KeyH': A.hover = true; break;
      case 'KeyK': A.hook = true; break;
      case 'KeyF': A.missile = true; break;
      case 'KeyQ': A.flares = true; break;
      case 'KeyE': A.target = true; break;
      default: break;
    }
  }

  _onKeyUp(e) { this.keys.delete(e.code); }
  _onBlur() { this.keys.clear(); this._lookMouse = false; }

  _onMouseMove(e) {
    if (this.suspended) return;
    if (this._lookMouse) {
      // Negative look.y points down. Middle look takes priority over the mouse-flight stick.
      this.look.x = clamp(this.look.x - e.movementX * FC.lookMouse, -Math.PI, Math.PI);
      this.look.y = clamp(this.look.y - e.movementY * FC.lookMouse, -1.4, 1.4);
    } else if (this.mouseFlight) {
      this._mouse.x = clamp(this._mouse.x + e.movementX * FI.mouseSensitivity, -1, 1);
      this._mouse.y = clamp(this._mouse.y + e.movementY * FI.mouseSensitivity, -1, 1);
    }
  }

  _onMouseDown(e) {
    if (this.suspended) return;
    if (this.mouseFlight) {
      if (e.button === 0) this.state.cannon = true;
      if (e.button === 2) this.actions.missile = true;
      if (e.button === 1) { this._lookMouse = true; e.preventDefault(); }
    } else if (e.button === 2) {
      this._lookMouse = true;
    }
  }

  _onMouseUp(e) {
    if (e.button === 0) this.state.cannon = false;
    if (e.button === 2 || e.button === 1) this._lookMouse = false;
  }

  _onWheel(e) {
    if (this.suspended) return;
    if (this.mouseFlight) {
      this.state.throttleKick += -Math.sign(e.deltaY) * FI.wheelStep;
      e.preventDefault();
    }
  }

  consumeAction(name) {
    if (this.actions[name]) { this.actions[name] = false; return true; }
    return false;
  }

  clearActions() { for (const k of Object.keys(this.actions)) this.actions[k] = false; }

  _findPad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (let i = 0; i < pads.length; i++) if (pads[i] && pads[i].connected) return pads[i];
    return null;
  }

  // Polled once per rendered frame. dt is the frame time in seconds, used for
  // the things that are about real time and not physics: the free-look return
  // and the reset hold.
  poll(dt) {
    const s = this.state;
    const pad = this._findPad();

    if (this.suspended) {
      this.keys.clear();
      s.pitch = 0; s.roll = 0; s.yaw = 0; s.analog = false;
      s.throttleRate = 0; s.ab = false; s.brake = 0; s.airbrake = false; s.cannon = false;
      s.apAlt = 0; s.apHdg = 0; s.apSpd = 0;
      this._brakeKey = 0;
      this._resetHeld = 0; this.resetProgress = 0;
      // Keep the pad's button states current so what was held to open or close
      // a menu does not read as a fresh press when flying resumes.
      if (pad) {
        this._menuAUsed ||= !!pad.buttons[0]?.pressed;
        for (let i = 0; i < pad.buttons.length; i++) this._prev[i] = pad.buttons[i].pressed;
      }
      return s;
    }

    const K = this.keys;
    const kb = (a, b) => (K.has(a) ? 1 : 0) - (K.has(b) ? 1 : 0);
    const inv = this.invertY ? -1 : 1;

    // --- keyboard ---
    // Up pushes the nose down; Down pulls it up.
    let pitch = kb('ArrowDown', 'ArrowUp') * inv;
    let roll = kb('ArrowRight', 'ArrowLeft');
    let yaw = kb('KeyD', 'KeyA');
    let throttleRate = kb('KeyW', 'KeyS');
    let apAlt = kb('ArrowUp', 'ArrowDown');
    let apHdg = kb('ArrowRight', 'ArrowLeft');
    let apSpd = throttleRate;
    let ab = K.has('ShiftLeft') || K.has('ShiftRight');
    // The key's brake ramps (FLIGHT_INPUT.brakeAttack): a switch is grabby at taxi speed.
    const keyBrake = K.has('KeyB') ? 1 : 0;
    const brakeStep = (keyBrake > this._brakeKey ? FI.brakeAttack : FI.brakeRelease) * dt;
    this._brakeKey += Math.max(-brakeStep, Math.min(brakeStep, keyBrake - this._brakeKey));
    let brake = this._brakeKey;
    let cannon = K.has('Space') || (this.mouseFlight && this.state.cannon);
    let analog = false;
    let lookX = 0, lookY = 0, padLook = false;
    let resetKey = K.has('KeyR');

    // --- mouse flight ---
    if (this.mouseFlight) {
      const m = this._mouse;
      const mx = deadzone(m.x, FI.mouseDeadzone), my = deadzone(m.y, FI.mouseDeadzone);
      if (mx || my) {
        roll = mx;
        pitch = my * inv;
        analog = true;
      }
      // Drift back toward the centre.
      if (FI.mouseReturn > 0) {
        const k = Math.exp(-FI.mouseReturn * dt);
        m.x *= k; m.y *= k;
      }
    }

    // --- gamepad ---
    let resetPad = false;
    if (pad) {
      const A = this.actions;
      const down = (i) => !!(pad.buttons[i] && pad.buttons[i].pressed);
      const edge = (i) => {
        const now = down(i), was = !!this._prev[i];
        this._prev[i] = now;
        return now && !was;
      };
      const value = (i) => {
        const x = pad.buttons[i];
        return x ? (typeof x.value === 'number' ? x.value : (x.pressed ? 1 : 0)) : 0;
      };

      if (pad.mapping === 'standard' || pad.buttons.length >= 12) {
        // A used for a menu/entry must be released before it can command afterburner.
        if (!down(0)) this._menuAUsed = false;
        const sx = curve(deadzone(pad.axes[0] ?? 0, INPUT.stickDeadzone));
        const sy = curve(deadzone(pad.axes[1] ?? 0, INPUT.stickDeadzone));
        const rx = deadzone(pad.axes[2] ?? 0, INPUT.stickDeadzone);
        const ry = deadzone(pad.axes[3] ?? 0, INPUT.stickDeadzone);
        if (sx || sy) { roll = sx; pitch = sy * inv; analog = true; }
        if (sy) apAlt = -sy;
        if (sx) apHdg = sx;
        if (down(11)) {
          // R3 held: the right stick looks round instead of flying.
          lookX = rx; lookY = ry; padLook = true;
        } else {
          if (rx) { yaw = rx; analog = true; }
          if (ry) { throttleRate = -ry * FI.stickThrottle; apSpd = -ry; }
        }
        if (value(7) > FI.triggerFire) cannon = true;
        if (value(6) > 0.05) brake = Math.max(brake, value(6));

        // Back is a modifier. Tapped it opens the map; held, A, B and X are the
        // second row: reset to the hangar (held), mute, hover assist.
        const back = down(8);
        if (back && !this._backWas) this._backUsed = false;
        if (back) {
          if (down(0) || down(1) || down(2)) this._backUsed = true;
          resetPad = down(0);
          this._menuAUsed ||= down(0);
          if (edge(1)) A.mute = true;
          if (edge(2)) A.hover = true;
          this._prev[0] = down(0);
        } else {
          if (down(0) && !this.hangarAvailable && !this._menuAUsed) ab = true;
          if (edge(1)) A.airbrake = true;
          if (edge(2)) A.gear = true;
          // A is the afterburner on a jet and the cargo hook on a helicopter: the game
          // reads the edge only where it means something.
          if (edge(0)) {
            if (this.hangarAvailable) { A.hangar = true; this._menuAUsed = true; }
            else A.hook = true;
          }
          if (this._backWas && !this._backUsed) A.map = true;
        }
        this._backWas = back;
        if (edge(3)) A.camera = true;
        if (edge(5)) A.missile = true;
        if (edge(4)) A.flares = true;
        if (edge(12)) A.target = true;
        if (edge(13)) A.autopilot = true;
        if (edge(14)) A.flapsUp = true;
        if (edge(15)) A.flapsDown = true;
        if (edge(10)) A.hud = true;
        if (edge(9)) A.pause = true;
      } else {
        // A flight stick or an odd pad: twist for the rudder, a slider for the throttle.
        const sx = curve(deadzone(pad.axes[0] ?? 0, INPUT.stickDeadzone));
        const sy = curve(deadzone(pad.axes[1] ?? 0, INPUT.stickDeadzone));
        const tw = deadzone(pad.axes[2] ?? 0, INPUT.stickDeadzone);
        if (sx || sy) { roll = sx; pitch = sy * inv; analog = true; }
        if (tw) { yaw = tw; analog = true; }
        if (typeof pad.axes[3] === 'number') {
          const slider = (1 - pad.axes[3]) * 0.5;
          if (this._prevThrottleAxis !== null) s.throttleKick += slider - this._prevThrottleAxis;
          this._prevThrottleAxis = slider;
        }
        if (down(0)) cannon = true;
        if (edge(1)) A.missile = true;
        if (down(2)) ab = true;
        if (edge(3)) A.gear = true;
        if (edge(4)) A.camera = true;
        if (edge(9)) A.pause = true;
      }
    }

    s.pitch = clamp(pitch, -1, 1);
    s.roll = clamp(roll, -1, 1);
    s.yaw = clamp(yaw, -1, 1);
    s.analog = analog;
    s.throttleRate = clamp(throttleRate, -2, 2);
    s.ab = ab;
    s.brake = brake;
    s.cannon = cannon;
    s.apAlt = clamp(apAlt, -1, 1);
    s.apHdg = clamp(apHdg, -1, 1);
    s.apSpd = clamp(apSpd, -1, 1);

    // --- free look ---
    if (padLook) {
      this.look.x = clamp(this.look.x - lookX * FC.lookStick * dt, -Math.PI, Math.PI);
      this.look.y = clamp(this.look.y - lookY * FC.lookStick * dt, -1.4, 1.4);
      this.look.active = true;
    } else if (this._lookMouse) {
      this.look.active = true;
    } else {
      // Ease back to centre when released.
      const k = Math.exp(-FC.lookReturn * dt);
      this.look.x *= k; this.look.y *= k;
      this.look.active = Math.abs(this.look.x) + Math.abs(this.look.y) > 0.01;
    }

    // --- reset to the hangar: a hold ---
    if (resetKey || resetPad) {
      this._resetHeld += dt;
      this.resetProgress = clamp(this._resetHeld / FI.resetHold, 0, 1);
      if (this._resetHeld >= FI.resetHold) {
        this.actions.reset = true;
        this._resetHeld = -1e9;      // once per hold
        this.resetProgress = 0;
      }
    } else {
      this._resetHeld = 0;
      this.resetProgress = 0;
    }
    return s;
  }
}
