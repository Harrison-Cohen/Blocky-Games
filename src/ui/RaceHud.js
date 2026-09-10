// The race readout: position and the gaps to the cars either side, top left,
// and the start lights.
//
// Owns no state. It reads the race's view each frame and writes to the DOM only
// when a value has actually changed, like the lap HUD.

import { RACE } from '../data/tuning.js';

const gapText = (g) => (g === null || g === undefined ? '--' : `${g >= 0 ? '+' : '-'}${Math.abs(g).toFixed(3)}`);

export class RaceHud {
  constructor(root) {
    this.el = root.querySelector('.race-hud');
    this.posEl = root.querySelector('.race-pos-now');
    this.ofEl = root.querySelector('.race-pos-of');
    this.aheadTime = root.querySelector('.race-gap-ahead .race-gap-time');
    this.aheadName = root.querySelector('.race-gap-ahead .race-gap-name');
    this.aheadRow = root.querySelector('.race-gap-ahead');
    this.behindTime = root.querySelector('.race-gap-behind .race-gap-time');
    this.behindName = root.querySelector('.race-gap-behind .race-gap-name');
    this.behindRow = root.querySelector('.race-gap-behind');
    this.lightsEl = root.querySelector('.start-lights');
    this.lamps = [...root.querySelectorAll('.start-lamp')];
    this.goEl = root.querySelector('.start-go');
    this._cache = {};
  }

  show() { this.el.hidden = false; }

  hide() {
    this.el.hidden = true;
    this.lightsEl.hidden = true;
    this._cache = {};
  }

  _set(key, el, value, prop = 'textContent') {
    if (this._cache[key] === value) return;
    this._cache[key] = value;
    if (prop === 'hidden') el.hidden = value; else el[prop] = value;
  }

  update(view, race) {
    this._set('pos', this.posEl, `P${view.position}`);
    this._set('of', this.ofEl, `/${view.count}`);
    // "Ahead +1.234" is how far you are behind the car in front; "Behind
    // +0.812" is how far the car behind is behind you. Both positive, both
    // read the same way a timing screen reads them.
    this._set('aHide', this.aheadRow, !view.ahead, 'hidden');
    if (view.ahead) {
      this._set('aT', this.aheadTime, gapText(view.ahead.gap));
      this._set('aN', this.aheadName, view.ahead.name);
    }
    this._set('bHide', this.behindRow, !view.behind, 'hidden');
    if (view.behind) {
      this._set('bT', this.behindTime, gapText(view.behind.gap));
      this._set('bN', this.behindName, view.behind.name);
    }

    // Lights: one more lamp each second of the countdown, then all out and
    // "Go" for a second.
    const counting = race.phase === 'countdown';
    const going = !counting && race.clock < 1;
    this._set('lights', this.lightsEl, !(counting || going), 'hidden');
    const lit = counting ? Math.max(0, Math.min(this.lamps.length, Math.ceil(RACE.countdown - race.countdown))) : 0;
    if (this._cache.lit !== lit) {
      this._cache.lit = lit;
      this.lamps.forEach((l, k) => l.classList.toggle('on', k < lit));
    }
    this._set('go', this.goEl, !going, 'hidden');
  }
}
