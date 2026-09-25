// The session results panel: every lap driven, the best, and the best possible
// lap from the best sectors.
//
// Rebuilt only when it is opened or when a lap has been added since it was last
// built, because this is a list of DOM nodes and rebuilding it every frame for
// a panel that is usually hidden would be silly.
//
// Invalid laps are shown struck through with the reason, not hidden. A lap list
// with gaps in the numbering is confusing, and "why did that not count" is a
// question the panel should answer rather than raise.

import { formatTime, formatDelta } from '../game/LapTimer.js';
import { Menu } from './RaceScreens.js';

export class Results {
  constructor(root) {
    this.el = root.querySelector('.results-card');
    this.bestEl = root.querySelector('.results-best');
    this.possibleEl = root.querySelector('.results-possible');
    this.listEl = root.querySelector('.results-laps');
    this.emptyEl = root.querySelector('.results-empty');
    this.footEl = this.el.querySelector('.controls-foot');
    this.titleEl = this.el.querySelector('h1');
    // Only at the end of a session: the one way on from here.
    this.menu = new Menu(this.el, this.el.querySelector('.results-actions'));
    this.visible = false;
    this._builtFor = -1;
  }

  // Leaving a time trial with laps on the board: the same card, as the
  // session's results, until you choose to go on.
  showEnd(timer, track, onContinue) {
    const go = () => { this.close(); onContinue(); };
    this.visible = true;
    this.el.hidden = false;
    this.titleEl.textContent = `Session results, ${track}`;
    this.footEl.hidden = true;
    this.render(timer, true);
    this.menu.onBack = go;
    this.menu.onPadStart = go;
    this.menu.setRows([{ label: 'Continue', action: go }], 0);
    this.menu.show();
  }

  get ending() { return this.menu.visible; }

  handlePad(m) { this.menu.handlePad(m); }

  toggle(timer) {
    this.visible = !this.visible;
    this.el.hidden = !this.visible;
    if (this.visible) this.render(timer, true);
    return this.visible;
  }

  close() {
    this.visible = false;
    this.el.hidden = true;
    if (this.menu.visible) {
      this.menu.hide();
      this.menu.listEl.replaceChildren();
      this.titleEl.textContent = 'Session';
      this.footEl.hidden = false;
    }
  }

  render(timer, force = false) {
    if (!this.visible) return;
    if (!force && this._builtFor === timer.laps.length) return;
    this._builtFor = timer.laps.length;

    this.bestEl.textContent = timer.best === null ? '--:--.---' : formatTime(timer.best);
    this.bestEl.classList.toggle('record', timer.newRecord);

    const possible = timer.bestPossible;
    this.possibleEl.textContent = possible === null ? '--:--.---' : formatTime(possible);

    const fastest = timer.best;
    this.listEl.replaceChildren();
    for (const lap of timer.laps) {
      const li = document.createElement('li');
      li.className = lap.valid ? '' : 'invalid';
      if (lap.valid && lap.time === fastest) li.classList.add('fastest');

      const no = document.createElement('span');
      no.className = 'lap-no';
      no.textContent = String(lap.number);

      const total = document.createElement('span');
      total.className = 'lap-total';
      total.textContent = formatTime(lap.time);

      const secs = document.createElement('span');
      secs.className = 'lap-secs';
      secs.textContent = lap.sectors.map((s) => s.toFixed(3)).join('  ');

      li.append(no, total, secs);

      if (!lap.valid && lap.reason) {
        const why = document.createElement('span');
        why.className = 'lap-why';
        why.textContent = lap.reason;
        li.append(why);
      } else if (lap.valid && fastest !== null && lap.time !== fastest) {
        const gap = document.createElement('span');
        gap.className = 'lap-why';
        gap.textContent = formatDelta(lap.time - fastest);
        li.append(gap);
      }

      this.listEl.append(li);
    }

    this.emptyEl.hidden = timer.laps.length > 0;
  }
}
