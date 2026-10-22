// The race results screen, and the Menu every card in the game is built on.
//
// A Menu is a list of rows with one focus, like the garage: up and down move
// between rows, left and right change a setting, Enter chooses a button, Esc
// goes back. The buttons are rows too, so the gamepad never needs a cursor.
// The race settings themselves live on the track select screen (Screens.js).

import { formatTime } from '../game/LapTimer.js';
import { hexToCss } from '../data/palette.js';

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

// A span with a class and some text, for the cells of a line.
function cell(cls, text) {
  const s = document.createElement('span');
  s.className = cls;
  s.textContent = text;
  return s;
}

export class Menu {
  constructor(el, listEl) {
    this.el = el;
    this.listEl = listEl;
    this.rows = [];
    this.index = 0;
    this.visible = false;
    this.onBack = null;
    // The pad's Start button: whatever the card means by it (the title
    // screen starts, the pause card resumes). Unset, it does nothing.
    this.onPadStart = null;
    // Told whenever the focus lands on a row, with the row.
    this.onFocus = null;
    this._onKeyDown = this._onKeyDown.bind(this);
  }

  // A row is { label, value() , step(d) } for a setting, { label, action() }
  // for a button, { section } for a heading the focus passes over, or
  // { head: [titles] } for column titles over a table of lines. `cls` adds
  // classes to its line. A line can also carry `no` (a number shown before the
  // label), `cols` (fixed columns after it, for a table) and `hint` (a dim note
  // on the right, text or a function).
  setRows(rows, focus = 0) {
    this.rows = rows;
    this.index = clamp(focus, 0, rows.length - 1);
    if (rows[this.index] && (rows[this.index].section || rows[this.index].head)) this.index = this._next(this.index, 1);
    this.listEl.replaceChildren();
    const numbered = rows.some((r) => r.no);
    rows.forEach((row, i) => {
      const li = document.createElement('li');
      if (row.section) {
        li.className = 'race-section';
        li.textContent = row.section;
        row._li = li;
        this.listEl.append(li);
        return;
      }
      if (row.head) {
        li.className = `race-head${row.cls ? ` ${row.cls}` : ''}`;
        li.append(cell('race-ptr', ''), cell('race-no', ''), cell('race-row-label', row.head[0]));
        for (const t of row.head.slice(1, -1)) li.append(cell('race-col', t));
        if (row.head.length > 1) li.append(cell('race-row-value', row.head[row.head.length - 1]));
        row._li = li;
        this.listEl.append(li);
        return;
      }
      // A row with a value is a line in a list, even when Enter on it does
      // something (a track you can start on); one without is a button.
      li.className = row.action && !row.value ? 'race-row race-row-action' : 'race-row';
      if (row.cls) li.className += ` ${row.cls}`;
      li.append(cell('race-ptr', '>'));
      // In a list where lines are numbered, an unnumbered one keeps the column.
      if (row.no || (numbered && !/\bbtn\b/.test(row.cls || ''))) li.append(cell('race-no', row.no || ''));
      const label = document.createElement('span');
      label.className = 'race-row-label';
      label.textContent = row.label;
      li.append(label);
      if (row.cols) for (const t of row.cols) li.append(cell('race-col', t));
      if (row.hint) {
        row._hint = cell('race-row-hint', '');
        li.append(row._hint);
      }
      if (row.value) {
        row._value = document.createElement('span');
        row._value.className = 'race-row-value';
        // A setting gets a - and a + either side of its value, for the mouse.
        if (row.step) {
          const box = document.createElement('span');
          box.className = 'race-stepper';
          const btn = (text, d) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'race-step';
            b.textContent = text;
            b.tabIndex = -1;
            b.addEventListener('click', (e) => { e.stopPropagation(); this.index = i; this._step(d); });
            return b;
          };
          box.append(btn('\u2212', -1), row._value, btn('+', 1));
          // Optional native slider; existing setting rows retain their stepper behavior.
          if(row.range){
            const r=row.range,input=document.createElement('input');
            input.type='range';input.className='race-range';input.min=r.min;input.max=r.max;input.step=r.step;
            input.setAttribute('aria-label',row.label);
            input.addEventListener('focus',()=>{this.index=i;this.paint();});
            input.addEventListener('click',e=>e.stopPropagation());
            input.addEventListener('input',()=>{this.index=i;r.set(input.valueAsNumber);this.paint();});
            row._range=input;box.insertBefore(input,row._value);
          }
          li.append(box);
        } else {
          li.append(row._value);
        }
      }
      // A click on a list line that can also start something picks it first
      // and starts it on the second click, so looking is not committing.
      li.addEventListener('click', () => {
        const again = this.index === i;
        this.index = i;
        if (row.value && row.action && !again) this.paint();
        else this._activate();
      });
      row._li = li;
      this.listEl.append(li);
    });
    this.paint();
  }

  paint() {
    this.rows.forEach((row, i) => {
      if (row.section || row.head) return;
      row._li.classList.toggle('focused', i === this.index);
      if (row._hint) row._hint.textContent = typeof row.hint === 'function' ? row.hint() : row.hint;
      if (row._value) row._value.textContent = row.value();
      if (row._range) row._range.value = row.range.get();
    });
    const row = this.rows[this.index];
    if (row && row._li.scrollIntoView) row._li.scrollIntoView({ block: 'nearest' });
    if (this.onFocus && row) this.onFocus(row);
  }

  // The next row from i in direction d that the focus can land on.
  _next(i, d) {
    const n = this.rows.length;
    for (let k = 1; k <= n; k++) {
      const j = (i + d * k + n * k) % n;
      if (!this.rows[j].section && !this.rows[j].head) return j;
    }
    return i;
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

  _move(d) { this.index = this._next(this.index, d); this.paint(); }

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
    else if (m.start && this.onPadStart) this.onPadStart();
  }
}

export class RaceResults {
  constructor(root) {
    this.el = root.querySelector('.race-results');
    this.body = this.el.querySelector('tbody');
    this.sub = this.el.querySelector('.race-results-sub');
    this.menu = new Menu(this.el, this.el.querySelector('.race-results-actions'));
    this.menu.onBack = () => { if (this.onLeave) this.onLeave(); };
    this.onAgain = null;
    this.onTracks = null;
    this.onLeave = null;
    this._key = '';
  }

  get visible() { return this.menu.visible; }

  show(results, meta) {
    this._key = '';
    this.render(results, meta);
    this.menu.setRows([
      { label: 'Race again', action: () => { if (this.onAgain) this.onAgain(); } },
      { label: 'Change track or settings', action: () => { if (this.onTracks) this.onTracks(); } },
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
