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

export class Results {
  constructor(root) {
    this.el = root.querySelector('.results-card');
    this.bestEl = root.querySelector('.results-best');
    this.possibleEl = root.querySelector('.results-possible');
    this.listEl = root.querySelector('.results-laps');
    this.emptyEl = root.querySelector('.results-empty');
    this.visible = false;
    this._builtFor = -1;
  }

  toggle(timer) {
    this.visible = !this.visible;
    this.el.hidden = !this.visible;
    if (this.visible) this.render(timer, true);
    return this.visible;
  }

  close() {
    this.visible = false;
    this.el.hidden = true;
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
