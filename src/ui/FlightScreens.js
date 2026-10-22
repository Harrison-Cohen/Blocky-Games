// The screens of flight: the Fly menu the title opens, the pause card, and the
// flight controls card. All built from the same Menu as the rest of the game
// (RaceScreens.js), so up and down move, left and right change a setting, Enter
// chooses, Esc goes back, and the gamepad does the same.
//
// The DOM is made here rather than in index.html, so the car game's markup is
// untouched.

import { MenuScreen } from './Screens.js';
import { MapScreen } from './MapScreen.js';

function screen(root, cls, title, sub, hint) {
  const el = document.createElement('section');
  el.className = `menu-screen ${cls}`;
  el.hidden = true;
  el.innerHTML = `<div class="menu-panel"><h1></h1><p class="menu-sub"></p><ul class="race-rows"></ul><p class="race-hint"></p></div>`;
  el.querySelector('h1').textContent = title;
  el.querySelector('.menu-sub').textContent = sub;
  el.querySelector('.race-hint').textContent = hint;
  root.append(el);
  return el;
}

const KEYS = [
  ['Up / Down', 'Pitch: Up pushes the nose down, Down pulls it up'],
  ['Left / Right', 'Roll'],
  ['A / D', 'Rudder, and nose wheel steering on the ground'],
  ['W / S', 'Throttle up / down, held'],
  ['Left Shift', 'Afterburner, held'],
  ['Space', 'Cannon', true],
  ['F', 'Missile', true],
  ['Q', 'Flares', true],
  ['E', 'Next target', true],
  ['G', 'Landing gear'],
  ['Z / X', 'Flaps up / down, one setting at a time (the 737: up, 5, 15, 30)'],
  ['V', 'Toggle airbrake (the 737\'s spoilers; they also come up by themselves on landing)'],
  ['B', 'Wheel brake, held: it comes on a little at a time'],
  ['P', 'Autopilot: Off, Hold, Route, Off (Route needs an activated map trip). Up / Down altitude, W / S speed; Left / Right heading in Hold'],
  ['H', 'Hover assist', true],
  ['K', 'Cargo hook', true],
  ['C', 'Camera: chase, first person, cockpit, far orbit'],
  ['Right mouse', 'Hold and drag to look; drag down for lower panels'],
  ['U', 'HUD on or off'],
  ['M', 'Map'],
  ['N', 'Mute'],
  ['T', 'Mouse flight on or off'],
  ['Enter', 'Enter the hangar when its prompt is visible (pad A too)'],
  ['R', 'Hold for a second to go back to the hangar'],
  ['Esc', 'Pause'],
];

const PAD = [
  ['Left stick', 'Pitch and roll'],
  ['Right stick X', 'Rudder'],
  ['Right stick Y', 'Throttle'],
  ['R3, held', 'Right stick looks round; down shows lower panels'],
  ['RT / LT', 'Cannon / wheel brake'],
  ['RB / LB', 'Missile / flares', true],
  ['A / B', 'Hold A for afterburner; B toggles airbrake'],
  ['X / Y', 'Gear / camera'],
  ['D-pad up', 'Next target', true],
  ['D-pad down', 'Off, Hold, Route, Off. Left stick Y altitude, X heading in Hold, right stick Y speed'],
  ['D-pad left / right', 'Flaps up / down'],
  ['L3', 'HUD'],
  ['Back, tapped', 'Map'],
  ['Back, held, then A', 'Back to the hangar, held'],
  ['Back, held, then B / X', 'Mute / hover assist (hover later)'],
  ['Start', 'Pause'],
];

function controlsCard(root) {
  const el = document.createElement('section');
  el.className = 'controls-card flight-controls';
  el.hidden = true;
  // Keys whose system is not built yet are listed, so the layout is the one it
  // will keep, and marked.
  const list = (rows) => rows.map(([k, v, later]) => `<dt>${k}</dt><dd${later ? ' class="later"' : ''}>${v}${later ? ' (not built yet)' : ''}</dd>`).join('');
  el.innerHTML = `<h1>Flight controls</h1><div class="controls-grid">
    <div><h2>Keyboard</h2><dl>${list(KEYS)}</dl></div>
    <div><h2>Gamepad</h2><dl>${list(PAD)}</dl>
    <p class="controls-dev">Mouse flight (T): the mouse moves pitch and roll, the wheel is the throttle, the left button fires the cannon, the right button a missile, the middle button looks round. On the ground a low throttle lever holds a taxi speed and brakes for you (0.1 is a walk, 0.25 a jog); stop near a hangar and choose Enter hangar. Airport buildings are solid.</p></div>
  </div>`;
  root.append(el);
  return el;
}

export class FlightScreens {
  constructor(uiRoot) {
    this.root = uiRoot;
    this.fly = new MenuScreen(screen(uiRoot, 'fly-screen', 'Fly',
      'The F-22 Raptor.',
      'Up and down to choose, Enter to go. On a gamepad, the d-pad and A.'));
    this.pause = new MenuScreen(screen(uiRoot, 'flight-pause-screen', 'Paused', '',
      'Esc, or Start on a gamepad, goes back to flying.'));
    // After a crash: where to start again.
    this.crash = new MenuScreen(screen(uiRoot, 'flight-pause-screen', 'Crashed', '',
      'Up and down to choose, Enter to go. On a gamepad, the d-pad and A.'));
    this.card = controlsCard(uiRoot);
    this.map = new MapScreen(uiRoot);
  }

  get visible() { return this.fly.visible || this.pause.visible || this.crash.visible || this.map.visible; }

  hideAll() {
    this.fly.hide();
    this.pause.hide();
    this.crash.hide();
    this.map.hide();
    this.card.hidden = true;
  }

  // The controls card stands beside whichever menu is up.
  showCard(menu, on = this.card.hidden) {
    menu.el.append(this.card);
    this.card.hidden = !on;
  }

  handlePad(m) {
    if (this.fly.visible) this.fly.handlePad(m);
    else if (this.pause.visible) this.pause.handlePad(m);
    else if (this.crash.visible) this.crash.handlePad(m);
    else if (this.map.visible) this.map.handlePad(m);
  }
}
