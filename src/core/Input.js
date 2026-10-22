// Keyboard and gamepad, both live at once, no config screen.
//
// One note on gamepad triggers, because the obvious reading is wrong: in the
// W3C standard mapping the analog triggers are NOT axes. They are
// buttons[6] and buttons[7], and each carries a float `.value` in 0..1.
// They are analog buttons. Reading them off the axes array returns garbage on
// most controllers. Non-standard pads do put them on axes, so there is a
// fallback for `mapping: ''` below.
//
// Analog channels are passed through to the physics untouched. Digital ones
// are flagged so the physics can ramp them on the fixed clock: smoothing here
// would run at display rate and make the car handle differently at 144 Hz.

import { INPUT } from '../data/tuning.js';

const KEY_BINDINGS = {
  throttle: ['KeyW', 'ArrowUp'],
  brake: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  handbrake: ['Space'],
};

// Gamepad buttons read as one-shot edges while driving. Every other button's
// state is recorded as it stands, so a menu opening later does not see a
// button that was already held as a fresh press.
const PAD_EDGES = new Set([9, 3, 2, 8, 1, 12, 5, 4, 13, 15]);

// The two keyboard driving sets. In manual, the left and right keys of the set
// you are NOT driving with are the shifters: right up, left down. Driving on
// W A S D shifts on the arrows, driving on the arrows shifts on D and A.
const SETS = {
  wasd: { pedals: ['KeyW', 'KeyS'], left: 'KeyA', right: 'KeyD', up: 'D', down: 'A' },
  arrows: { pedals: ['ArrowUp', 'ArrowDown'], left: 'ArrowLeft', right: 'ArrowRight', up: '→', down: '←' },
};
const OTHER = { wasd: 'arrows', arrows: 'wasd' };

function deadzone(v, dz) {
  const a = Math.abs(v);
  if (a < dz) return 0;
  return Math.sign(v) * ((a - dz) / (1 - dz));
}

export class Input {
  constructor() {
    this.keys = new Set();
    this.gamepadIndex = null;

    // What the physics reads.
    this.state = {
      throttle: 0,
      brake: 0,
      steer: 0,
      handbrake: 0,
      steerIsAnalog: false,
      pedalsAreAnalog: false,
      // Manual gearbox. Written by the game from its Gearbox, not by poll():
      // the gear is state the player sets, not a key being held. 0 is neutral.
      manual: false,
      gear: 1,
    };

    // One-shot actions, consumed by the game and cleared each frame.
    this.actions = {
      reset: false, pause: false, cycleCamera: false,
      nextChassis: false, nextTrack: false, rivals: false, autoDrive: false, race: false,
      toggleDebug: false, results: false,
      garage: false, ghost: false, mute: false,
      manual: false, shiftUp: false, shiftDown: false, neutral: false,
      // Player 2's, in two-player mode.
      shiftUp2: false, shiftDown2: false, neutral2: false, cycleCamera2: false,
    };

    // Menu navigation, produced from the gamepad only. The keyboard half is
    // handled by whichever screen is open, because a menu wants key repeat and
    // digits and the driving path wants neither.
    // alt is X / square: deletes a preset of your own in the garage's list.
    // start is Start: the title screen starts, the pause card resumes.
    // prev and next are the bumpers: the Garage and the Hangar change tab.
    this.menu = { up: false, down: false, left: false, right: false, confirm: false, back: false, alt: false, start: false, prev: false, next: false };

    // Set while a screen owns the input. Driving keys stop accumulating and
    // driving actions stop firing, but menu edges keep coming through.
    this.suspended = false;

    // Manual gearbox on the keyboard. The game sets manualKeys when manual is
    // switched on or off. The set you drive with is whichever one's throttle
    // or brake you pressed last, and the other set's left and right shift.
    this.manualKeys = false;
    this.drivingSet = 'wasd';

    // Two players, on the drag strip: W A S D and the first gamepad drive
    // `state`, the arrows and the second gamepad drive `state2`. In manual,
    // player 1 shifts on E and Q, player 2 on / and . with , for neutral.
    this.twoPlayer = false;
    this.state2 = {
      throttle: 0, brake: 0, steer: 0, handbrake: 0,
      steerIsAnalog: false, pedalsAreAnalog: false, manual: false, gear: 1,
    };
    this._prevButtons2 = [];

    this._prevButtons = [];
    this._stickLatch = 0;
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._onBlur = this._onBlur.bind(this);
    this._onGamepad = this._onGamepad.bind(this);
  }

  attach() {
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
    window.addEventListener('gamepadconnected', this._onGamepad);
    window.addEventListener('gamepaddisconnected', this._onGamepad);
  }

  detach() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('blur', this._onBlur);
    window.removeEventListener('gamepadconnected', this._onGamepad);
    window.removeEventListener('gamepaddisconnected', this._onGamepad);
  }

  _onKeyDown(e) {
    // A text box (the garage's number and preset name) gets its keys, spaces
    // included, and none of them drive the car.
    const t = e.target;
    if (t && t.tagName === 'INPUT' && t.type === 'text') return;
    // Stop the page scrolling out from under the game, whoever is listening.
    if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    if (e.repeat || this.suspended) return;
    this.keys.add(e.code);

    // The pedals you press say which set you are driving with.
    if (SETS.wasd.pedals.includes(e.code)) this.drivingSet = 'wasd';
    else if (SETS.arrows.pedals.includes(e.code)) this.drivingSet = 'arrows';

    // Gearbox: B switches between automatic and manual. In manual the other
    // set's right and left shift up and down, and X drops to neutral.
    if (e.code === 'KeyB') this.actions.manual = true;
    if (this.twoPlayer) {
      // Each player's own shifters, clear of both sets of driving keys.
      if (e.code === 'Slash') e.preventDefault(); // Firefox's quick find
      if (e.code === 'KeyE') this.actions.shiftUp = true;
      if (e.code === 'KeyQ') this.actions.shiftDown = true;
      if (e.code === 'Slash') this.actions.shiftUp2 = true;
      if (e.code === 'Period') this.actions.shiftDown2 = true;
      if (e.code === 'Comma') this.actions.neutral2 = true;
    } else if (this.manualKeys) {
      const shifter = SETS[OTHER[this.drivingSet]];
      if (e.code === shifter.right) this.actions.shiftUp = true;
      if (e.code === shifter.left) this.actions.shiftDown = true;
    }
    if (e.code === 'KeyX') this.actions.neutral = true;

    if (e.code === 'KeyG') this.actions.garage = true;
    if (e.code === 'KeyR') this.actions.reset = true;
    if (e.code === 'Escape') this.actions.pause = true;
    if (e.code === 'KeyC') this.actions.cycleCamera = true;
    if (e.code === 'KeyV') this.actions.nextChassis = true;
    // The next circuit where you stand. The track select screen is the way
    // in; this is a shortcut for comparing tracks, with the same standing as V.
    if (e.code === 'KeyT') this.actions.nextTrack = true;
    if (e.code === 'KeyO') this.actions.rivals = true;
    if (e.code === 'KeyP') this.actions.autoDrive = true;
    if (e.code === 'KeyN') this.actions.race = true;
    if (e.code === 'KeyH') this.actions.ghost = true;
    if (e.code === 'KeyM') this.actions.mute = true;
    if (e.code === 'Backquote') this.actions.toggleDebug = true;
    // Tab would otherwise move focus off the canvas and stop the game hearing
    // the keyboard at all, so it is claimed here.
    if (e.code === 'Tab') { e.preventDefault(); this.actions.results = true; }
  }

  _onKeyUp(e) {
    this.keys.delete(e.code);
  }

  _onBlur() {
    // Losing focus mid-corner should not leave the throttle pinned.
    this.keys.clear();
  }

  _onGamepad() {
    this.gamepadIndex = null; // re-detected on the next poll
  }

  _held(list) {
    for (const code of list) if (this.keys.has(code)) return true;
    return false;
  }

  _findGamepad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (let i = 0; i < pads.length; i++) {
      if (pads[i] && pads[i].connected) return pads[i];
    }
    return null;
  }

  // Polled once per rendered frame. Cheap, no allocation beyond getGamepads().
  poll() {
    const s = this.state;

    if (this.suspended) {
      this.keys.clear();
      s.throttle = 0; s.brake = 0; s.steer = 0; s.handbrake = 0;
      s.steerIsAnalog = false; s.pedalsAreAnalog = false;
      const s2 = this.state2;
      s2.throttle = 0; s2.brake = 0; s2.steer = 0; s2.handbrake = 0;
      s2.steerIsAnalog = false; s2.pedalsAreAnalog = false;
      this._pollMenuPad();
      return s;
    }

    if (this.twoPlayer) return this._pollTwo();

    // --- keyboard ---
    let kThrottle = this._held(KEY_BINDINGS.throttle) ? 1 : 0;
    let kBrake = this._held(KEY_BINDINGS.brake) ? 1 : 0;
    let kSteer;
    if (this.manualKeys) {
      // In manual only the set you drive with steers: the other set's left
      // and right are the shifters, and a shift must not also turn the car.
      const set = SETS[this.drivingSet];
      kSteer = (this.keys.has(set.right) ? 1 : 0) - (this.keys.has(set.left) ? 1 : 0);
    } else {
      kSteer = (this._held(KEY_BINDINGS.right) ? 1 : 0) - (this._held(KEY_BINDINGS.left) ? 1 : 0);
    }
    let kHandbrake = this._held(KEY_BINDINGS.handbrake) ? 1 : 0;

    // --- gamepad ---
    let gThrottle = 0, gBrake = 0, gSteer = 0, gHandbrake = 0;
    let padSteerActive = false, padPedalsActive = false;

    const pad = this._findGamepad();
    if (pad) {
      this.gamepadIndex = pad.index;

      // Steering: left stick X, with a deadzone and a gamma curve for fine
      // control near center.
      const raw = deadzone(pad.axes[0] ?? 0, INPUT.stickDeadzone);
      gSteer = Math.sign(raw) * Math.pow(Math.abs(raw), INPUT.steerGamma);
      padSteerActive = Math.abs(raw) > 0;

      // Triggers. Standard mapping: analog buttons 6 (left) and 7 (right).
      const lt = pad.buttons[6], rt = pad.buttons[7];
      if (lt && typeof lt.value === 'number' && rt && typeof rt.value === 'number' &&
          (pad.mapping === 'standard' || lt.value > 0 || rt.value > 0 || pad.buttons.length > 7)) {
        gThrottle = deadzone(rt.value, INPUT.triggerDeadzone);
        gBrake = deadzone(lt.value, INPUT.triggerDeadzone);
      } else {
        // Non-standard pad: triggers commonly land on axes 2 and 5, resting
        // at -1 and running to +1.
        const a2 = pad.axes[2], a5 = pad.axes[5];
        if (typeof a2 === 'number') gBrake = deadzone((a2 + 1) * 0.5, INPUT.triggerDeadzone);
        if (typeof a5 === 'number') gThrottle = deadzone((a5 + 1) * 0.5, INPUT.triggerDeadzone);
      }
      padPedalsActive = gThrottle > 0 || gBrake > 0;

      // A / cross for handbrake, analog if the pad reports it.
      const a = pad.buttons[0];
      if (a) gHandbrake = typeof a.value === 'number' ? a.value : (a.pressed ? 1 : 0);

      // Edge-triggered pad buttons.
      const edge = (i) => {
        const b = pad.buttons[i];
        const now = !!(b && b.pressed);
        const was = !!this._prevButtons[i];
        this._prevButtons[i] = now;
        return now && !was;
      };
      if (edge(9)) this.actions.pause = true; // Start
      if (edge(3)) this.actions.reset = true; // Y / triangle
      if (edge(2)) this.actions.cycleCamera = true; // X / square
      if (edge(8)) this.actions.results = true; // Select / share
      if (edge(1)) this.actions.garage = true; // B / circle
      if (edge(12)) this.actions.ghost = true; // D-pad up
      // Gearbox: the bumpers shift, d-pad down is neutral, d-pad right
      // switches between automatic and manual.
      if (edge(5)) this.actions.shiftUp = true; // RB / R1
      if (edge(4)) this.actions.shiftDown = true; // LB / L1
      if (edge(13)) this.actions.neutral = true; // D-pad down
      if (edge(15)) this.actions.manual = true; // D-pad right
      for (let i = 0; i < pad.buttons.length; i++) {
        if (!PAD_EDGES.has(i)) this._prevButtons[i] = pad.buttons[i].pressed;
      }
    } else {
      this.gamepadIndex = null;
    }

    // --- merge: whichever device is actually being used wins ---
    // The steer sign is flipped exactly once, here. The world frame puts the
    // car's right side at -X: the nose points along +Z and up is +Y, and in a
    // right-handed frame right = forward x up = -X. So "steer right" is a
    // negative steer angle. Flipping at the boundary keeps every sign in the
    // model self-consistent instead of scattering minus signs through it.
    s.steerIsAnalog = padSteerActive;
    s.pedalsAreAnalog = padPedalsActive;
    s.steer = -(padSteerActive ? gSteer : kSteer);
    s.throttle = padPedalsActive ? gThrottle : kThrottle;
    s.brake = padPedalsActive ? gBrake : kBrake;
    s.handbrake = Math.max(kHandbrake, gHandbrake);

    return s;
  }

  setTwoPlayer(on) {
    this.twoPlayer = !!on;
    const s = this.state2;
    s.throttle = 0; s.brake = 0; s.steer = 0; s.handbrake = 0;
    this._prevButtons2 = [];
  }

  // Two players: each has one keyboard set and, if there is one, a gamepad of
  // their own, the first connected for player 1 and the second for player 2.
  _pollTwo() {
    const pads = [];
    const all = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of all) if (p && p.connected) pads.push(p);
    this._drivePlayer(this.state, SETS.wasd, pads[0] || null, this._prevButtons, true);
    this._drivePlayer(this.state2, SETS.arrows, pads[1] || null, this._prevButtons2, false);
    return this.state;
  }

  _drivePlayer(s, set, pad, prev, first) {
    let throttle = this.keys.has(set.pedals[0]) ? 1 : 0;
    let brake = this.keys.has(set.pedals[1]) ? 1 : 0;
    let steer = (this.keys.has(set.right) ? 1 : 0) - (this.keys.has(set.left) ? 1 : 0);
    let handbrake = first && this.keys.has('Space') ? 1 : 0;
    let steerAnalog = false, pedalAnalog = false;
    if (pad) {
      const raw = deadzone(pad.axes[0] ?? 0, INPUT.stickDeadzone);
      if (raw) {
        steer = Math.sign(raw) * Math.pow(Math.abs(raw), INPUT.steerGamma);
        steerAnalog = true;
      }
      const value = (b) => (b ? (typeof b.value === 'number' ? b.value : (b.pressed ? 1 : 0)) : 0);
      const gT = deadzone(value(pad.buttons[7]), INPUT.triggerDeadzone);
      const gB = deadzone(value(pad.buttons[6]), INPUT.triggerDeadzone);
      if (gT > 0 || gB > 0) { throttle = gT; brake = gB; pedalAnalog = true; }
      handbrake = Math.max(handbrake, value(pad.buttons[0]));
      const edge = (i) => {
        const b = pad.buttons[i];
        const now = !!(b && b.pressed);
        const was = !!prev[i];
        prev[i] = now;
        return now && !was;
      };
      const A = this.actions;
      if (edge(9)) A.pause = true; // Start
      if (edge(5)) A[first ? 'shiftUp' : 'shiftUp2'] = true; // RB
      if (edge(4)) A[first ? 'shiftDown' : 'shiftDown2'] = true; // LB
      if (edge(13)) A[first ? 'neutral' : 'neutral2'] = true; // D-pad down
      if (edge(2)) A[first ? 'cycleCamera' : 'cycleCamera2'] = true; // X
      if (edge(3) && first) A.reset = true; // Y
    }
    s.steerIsAnalog = steerAnalog;
    s.pedalsAreAnalog = pedalAnalog;
    // The same one sign flip as poll(): see there.
    s.steer = -steer;
    s.throttle = throttle;
    s.brake = brake;
    s.handbrake = handbrake;
  }

  // Menu edges. Read while a screen is open, from the d-pad, the left stick
  // and the face buttons. The stick is edge-triggered off a threshold so a
  // held stick steps one row rather than scrolling the whole list away.
  _pollMenuPad() {
    const m = this.menu;
    m.up = m.down = m.left = m.right = m.confirm = m.back = m.alt = m.start = m.prev = m.next = false;

    const pad = this._findGamepad();
    if (!pad) { this._stickLatch = 0; return; }
    this.gamepadIndex = pad.index;

    const edge = (i) => {
      const b = pad.buttons[i];
      const now = !!(b && b.pressed);
      const was = !!this._prevButtons[i];
      this._prevButtons[i] = now;
      return now && !was;
    };
    if (edge(12)) m.up = true;
    if (edge(13)) m.down = true;
    if (edge(14)) m.left = true;
    if (edge(15)) m.right = true;
    if (edge(0)) m.confirm = true;
    if (edge(1)) m.back = true;
    if (edge(2)) m.alt = true;
    if (edge(9)) m.start = true;
    // The bumpers change tab in the Garage and the Hangar.
    if (edge(4)) m.prev = true;
    if (edge(5)) m.next = true;
    for (let i = 0; i < pad.buttons.length; i++) {
      if (i > 15 || i > 2 && i < 12 && i !== 9 && i !== 4 && i !== 5) this._prevButtons[i] = pad.buttons[i].pressed;
    }

    const x = pad.axes[0] ?? 0;
    const y = pad.axes[1] ?? 0;
    const dir = Math.abs(y) > 0.6 ? (y < 0 ? 1 : 2) : Math.abs(x) > 0.6 ? (x < 0 ? 3 : 4) : 0;
    if (dir && dir !== this._stickLatch) {
      if (dir === 1) m.up = true;
      else if (dir === 2) m.down = true;
      else if (dir === 3) m.left = true;
      else m.right = true;
    }
    this._stickLatch = dir;
  }

  consumeAction(name) {
    if (this.actions[name]) {
      this.actions[name] = false;
      return true;
    }
    return false;
  }

  // The keys that shift right now, as the on-screen hint should name them.
  shiftKeyNames() {
    const shifter = SETS[OTHER[this.drivingSet]];
    return { up: shifter.up, down: shifter.down };
  }
}
