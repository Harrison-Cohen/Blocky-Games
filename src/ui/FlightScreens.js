// The screens of flight: the Fly menu the title opens, the pause card, the crash
// menu and the map. All built from the same Menu as the rest of the game
// (RaceScreens.js), so up and down move, left and right change a setting, Enter
// chooses, Esc goes back, and the gamepad does the same. The controls card is the
// same chart the title has (ControlsChart.js), on its Flying tab.
//
// The DOM is made here rather than in index.html, so the car game's markup is
// untouched.

import { MenuScreen } from './Screens.js';
import { MapScreen } from './MapScreen.js';
import { ControlsChart } from './ControlsChart.js';

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
    this.card = document.createElement('section');
    this.card.className = 'controls-card controls-chart flight-controls';
    this.card.hidden = true;
    uiRoot.append(this.card);
    this.chart = new ControlsChart(this.card);
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
    this.chart.setTab('flying');
    this.card.hidden = !on;
  }

  handlePad(m) {
    if (this.fly.visible) this.fly.handlePad(m);
    else if (this.pause.visible) this.pause.handlePad(m);
    else if (this.crash.visible) this.crash.handlePad(m);
    else if (this.map.visible) this.map.handlePad(m);
  }
}
