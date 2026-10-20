// The screens of flight: the Fly menu the title opens, the pause card, and the
// flight controls card. All built from the same Menu as the rest of the game
// (RaceScreens.js), so up and down move, left and right change a setting, Enter
// chooses, Esc goes back, and the gamepad does the same.
//
// The DOM is made here rather than in index.html, so the car game's markup is
// untouched.

import { MenuScreen } from './Screens.js';

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
  ['Z / X', 'Flaps up / down', true],
  ['V', 'Airbrake, held'],
  ['B', 'Wheel brake, held'],
  ['P', 'Autopilot', true],
  ['H', 'Hover assist', true],
  ['C', 'Camera: chase, cockpit, far orbit'],
  ['Right mouse', 'Free look, held'],
  ['U', 'HUD on or off'],
  ['M', 'Map', true],
  ['N', 'Mute'],
  ['T', 'Mouse flight on or off'],
  ['R', 'Hold for a second to reset to the runway'],
  ['Esc', 'Pause'],
];

const PAD = [
  ['Left stick', 'Pitch and roll'],
  ['Right stick X', 'Rudder'],
  ['Right stick Y', 'Throttle'],
  ['R3, held', 'Right stick looks round'],
  ['RT / LT', 'Cannon / wheel brake'],
  ['RB / LB', 'Missile / flares', true],
  ['A / B', 'Afterburner / airbrake, held'],
  ['X / Y', 'Gear / camera'],
  ['D-pad up / down', 'Next target / autopilot', true],
  ['D-pad left / right', 'Flaps up / down', true],
  ['L3', 'HUD'],
  ['Back, tapped', 'Map', true],
  ['Back, held, then A', 'Reset to the runway, held'],
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
    <p class="controls-dev">Mouse flight (T): the mouse moves pitch and roll, the wheel is the throttle, the left button fires the cannon, the right button a missile, the middle button looks round.</p></div>
  </div>`;
  root.append(el);
  return el;
}

export class FlightScreens {
  constructor(uiRoot) {
    this.root = uiRoot;
    this.fly = new MenuScreen(screen(uiRoot, 'fly-screen', 'Fly',
      'The F-22 Raptor on a flat test field. The open world comes next.',
      'Up and down to choose, Enter to go. On a gamepad, the d-pad and A.'));
    this.pause = new MenuScreen(screen(uiRoot, 'flight-pause-screen', 'Paused', '',
      'Esc, or Start on a gamepad, goes back to flying.'));
    this.card = controlsCard(uiRoot);
  }

  get visible() { return this.fly.visible || this.pause.visible; }

  hideAll() {
    this.fly.hide();
    this.pause.hide();
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
  }
}
