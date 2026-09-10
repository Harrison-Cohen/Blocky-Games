// The race setup card and the race results screen.
//
// Both are a list of rows with one focus, like the garage: up and down move
// between rows, left and right change a setting, Enter chooses a button, Esc
// goes back. The buttons are rows too, so the gamepad never needs a cursor.
// Milestone 9's track select screen takes over the setup; the settings and
// their defaults are the same ones (RACE in tuning.js).

import { RACE } from '../data/tuning.js';
import { formatTime } from '../game/LapTimer.js';
import { hexToCss } from '../data/palette.js';

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

class Menu {
  constructor(el, listEl) {
    this.el = el;
    this.listEl = listEl;
    this.rows = [];
    this.index = 0;
    this.visible = false;
    this.onBack = null;
    this._onKeyDown = this._onKeyDown.bind(this);
  }

  setRows(rows, focus = 0) {
    this.rows = rows;
    this.index = clamp(focus, 0, rows.length - 1);
    this.listEl.replaceChildren();
    rows.forEach((row, i) => {
      const li = document.createElement('li');
      li.className = row.action ? 'race-row race-row-action' : 'race-row';
      const label = document.createElement('span');
      label.className = 'race-row-label';
      label.textContent = row.label;
      li.append(label);
      if (!row.action) {
        row._value = document.createElement('span');
        row._value.className = 'race-row-value';
        li.append(row._value);
      }
      li.addEventListener('click', () => { this.index = i; this._activate(); });
      row._li = li;
      this.listEl.append(li);
    });
    this.paint();
  }

  paint() {
    this.rows.forEach((row, i) => {
      row._li.classList.toggle('focused', i === this.index);
      if (row._value) row._value.textContent = row.value();
    });
  }

  show() {
    if (this.visible) return;
    this.visible = true;
    this.el.hidden = false;
    window.addEventListener('keydown', this._onKeyDown);
  }

  hide() {
    if (!this.visible) return;
    this.visible = false;
    this.el.hidden = true;
    window.removeEventListener('keydown', this._onKeyDown);
  }

  _move(d) { this.index = (this.index + d + this.rows.length) % this.rows.length; this.paint(); }

  _step(d) {
    const row = this.rows[this.index];
    if (row && row.step) { row.step(d); this.paint(); }
  }

  _activate() {
    const row = this.rows[this.index];
    if (!row) return;
    if (row.action) row.action();
    else this._step(1);
  }

  _onKeyDown(e) {
    if (!this.visible) return;
    const c = e.code;
    if (c === 'ArrowUp' || c === 'KeyW') this._move(-1);
    else if (c === 'ArrowDown' || c === 'KeyS') this._move(1);
    else if (c === 'ArrowLeft' || c === 'KeyA') this._step(-1);
    else if (c === 'ArrowRight' || c === 'KeyD') this._step(1);
    else if (c === 'Enter' || c === 'Space') this._activate();
    else if (c === 'Escape') { if (this.onBack) this.onBack(); }
    else return;
    e.preventDefault();
  }

  handlePad(m) {
    if (!this.visible) return;
    if (m.up) this._move(-1);
    if (m.down) this._move(1);
    if (m.left) this._step(-1);
    if (m.right) this._step(1);
    if (m.confirm) this._activate();
    if (m.back && this.onBack) this.onBack();
  }
}

export class RaceSetup {
  constructor(root) {
    const el = root.querySelector('.race-setup');
    this.menu = new Menu(el, el.querySelector('.race-rows'));
    this.menu.onBack = () => this.close();
    this.settings = null;
    this.onStart = null;   // (settings) => void
    this.onLeave = null;   // () => void, leave the race in progress
    this.onClose = null;   // () => void, back to whatever was happening
  }

  get visible() { return this.menu.visible; }

  open(settings, inRace) {
    this.settings = { ...settings };
    const s = this.settings;
    const levels = Object.keys(RACE.levels);
    const rows = [
      { label: 'Laps', value: () => String(s.laps), step: (d) => { s.laps = clamp(s.laps + d, 1, 10); } },
      { label: 'Opponents', value: () => String(s.opponents),
        step: (d) => { s.opponents = clamp(s.opponents + d, 1, RACE.maxOpponents); } },
      { label: 'Difficulty', value: () => RACE.levels[s.difficulty].name,
        step: (d) => { s.difficulty = levels[(levels.indexOf(s.difficulty) + d + levels.length) % levels.length]; } },
      { label: inRace ? 'Restart race' : 'Start race', action: () => { if (this.onStart) this.onStart({ ...s }); } },
    ];
    if (inRace) rows.push({ label: 'Leave race', action: () => { if (this.onLeave) this.onLeave(); } });
    rows.push({ label: inRace ? 'Back to race' : 'Back to time trial', action: () => this.close() });
    this.menu.setRows(rows, 3);
    this.menu.show();
  }

  hide() { this.menu.hide(); }

  close() {
    this.menu.hide();
    if (this.onClose) this.onClose();
  }

  handlePad(m) { this.menu.handlePad(m); }
}

export class RaceResults {
  constructor(root) {
    this.el = root.querySelector('.race-results');
    this.body = this.el.querySelector('tbody');
    this.sub = this.el.querySelector('.race-results-sub');
    this.menu = new Menu(this.el, this.el.querySelector('.race-results-actions'));
    this.menu.onBack = () => { if (this.onLeave) this.onLeave(); };
    this.onAgain = null;
    this.onLeave = null;
    this._key = '';
  }

  get visible() { return this.menu.visible; }

  show(results, meta) {
    this._key = '';
    this.render(results, meta);
    this.menu.setRows([
      { label: 'Race again', action: () => { if (this.onAgain) this.onAgain(); } },
      { label: 'Back to time trial', action: () => { if (this.onLeave) this.onLeave(); } },
    ], 0);
    this.menu.show();
  }

  hide() { this.menu.hide(); }

  // Called every frame while the screen is up, because the cars behind you
  // are still finishing. Rebuilt only when somebody has.
  render(results, meta) {
    const key = results.map((r) => `${r.name}:${r.finished ? 1 : 0}`).join('|') + `|${meta.done}`;
    if (key === this._key) return;
    this._key = key;
    this.sub.textContent = `${meta.track}, ${meta.laps} ${meta.laps === 1 ? 'lap' : 'laps'}, ${meta.difficulty}`;
    this.body.replaceChildren();
    for (const r of results) {
      const tr = document.createElement('tr');
      if (r.isPlayer) tr.className = 'you';
      const cell = (text, cls = '') => {
        const td = document.createElement('td');
        if (cls) td.className = cls;
        td.textContent = text;
        tr.append(td);
        return td;
      };
      cell(String(r.position), 'num');
      const who = cell('');
      const sw = document.createElement('span');
      sw.className = 'race-swatch';
      sw.style.background = hexToCss(r.color);
      who.append(sw, `#${r.number}  ${r.name}${r.assisted ? ' (auto drive)' : ''}`);
      cell(r.chassis);
      cell(r.finished ? formatTime(r.total) : (meta.done ? 'Did not finish' : 'Running'), 'num');
      cell(r.gap !== null ? `+${r.gap.toFixed(3)}` : '', 'num');
      cell(r.best !== null ? formatTime(r.best) : '--:--.---', r.fastest ? 'num fastest' : 'num');
      this.body.append(tr);
    }
  }

  handlePad(m) { this.menu.handlePad(m); }
}
