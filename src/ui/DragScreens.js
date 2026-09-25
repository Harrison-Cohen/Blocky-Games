// The drag strip's screens: each lane's tree and clock, and the time slip.
// Render time only; everything they show comes from Drag. Players and cars
// are chosen on the track select screen (Screens.js).
//
// The slip is a Menu, like the race screens: up and down move, Enter
// chooses, Esc goes back.

import { Menu } from './RaceScreens.js';

const t3 = (v) => (v === null || v === undefined ? '-' : v.toFixed(3));
const mph1 = (v) => (v === null || v === undefined ? '-' : v.toFixed(1));

// Each lane's tree of lights and its clock, top left of its half.
export class DragHud {
  constructor(root) {
    this.el = root.querySelector('.drag-hud');
    this.lanes = [0, 1].map((k) => this._lane(k));
  }

  _lane(k) {
    const el = document.createElement('div');
    el.className = `drag-lane drag-lane-${k + 1}`;
    const tree = document.createElement('div');
    tree.className = 'drag-tree';
    const lamp = (cls) => {
      const s = document.createElement('span');
      s.className = `tree-lamp ${cls}`;
      tree.append(s);
      return s;
    };
    const stage = lamp('stage');
    const ambers = [lamp('amber'), lamp('amber'), lamp('amber')];
    const green = lamp('green');
    const red = lamp('red');
    const info = document.createElement('div');
    info.className = 'drag-info';
    const name = document.createElement('div');
    name.className = 'drag-name';
    const clock = document.createElement('div');
    clock.className = 'drag-clock';
    const note = document.createElement('div');
    note.className = 'drag-note';
    info.append(name, clock, note);
    el.append(tree, info);
    this.el.append(el);
    return { el, stage, ambers, green, red, name, clock, note, key: '' };
  }

  show(count) {
    this.el.hidden = false;
    this.lanes.forEach((l, k) => { l.el.hidden = k >= count; l.key = ''; });
  }

  hide() { this.el.hidden = true; }

  // notes: a line under each lane's clock before it has a result -- its best.
  update(drag, notes) {
    const tree = drag.tree();
    const done = drag.lanes.some((l) => l.finished) ? drag.results().lanes : null;
    drag.lanes.forEach((lane, k) => {
      const L = this.lanes[k];
      const e = drag.elapsed(k);
      const clock = e === null ? (drag.phase === 'staged' ? 'Staged' : '0.000') : t3(e);
      const note = lane.red ? 'Red light'
        : lane.foul ? 'Crossed the centre line'
          : lane.finished ? `${mph1(done[k].mph)} mph`
            : lane.noTime ? 'No time' : (notes[k] || '');
      const lit = `${tree.staged ? 1 : 0}${tree.ambers}${tree.lanes[k].green ? 1 : 0}${tree.lanes[k].red ? 1 : 0}`;
      const key = `${lane.name}|${clock}|${note}|${lit}`;
      if (key === L.key) return;
      L.key = key;
      L.name.textContent = lane.name;
      L.clock.textContent = clock;
      L.clock.classList.toggle('red', lane.red);
      L.note.textContent = note;
      L.stage.classList.toggle('on', tree.staged);
      L.ambers.forEach((a, i) => a.classList.toggle('on', i < tree.ambers));
      L.green.classList.toggle('on', tree.lanes[k].green);
      L.red.classList.toggle('on', tree.lanes[k].red);
    });
  }
}

// The time slip, as a dragway prints one: every split for each lane, and who
// won by how much.
export class DragSlip {
  constructor(root) {
    this.el = root.querySelector('.drag-slip');
    this.headEl = this.el.querySelector('.drag-slip-head');
    this.sub = this.el.querySelector('.drag-slip-sub');
    this.headRow = this.el.querySelector('thead tr');
    this.body = this.el.querySelector('tbody');
    this.menu = new Menu(this.el, this.el.querySelector('.drag-slip-actions'));
    this.menu.onBack = () => { if (this.onClose) this.onClose(); };
    this.onAgain = null;
    this.onSetup = null;
    this.onClose = null;
  }

  get visible() { return this.menu.visible; }

  // meta: { track, bests: [previous best ET per lane, or null], newBest: [bool] }
  show(res, meta) {
    this._render(res, meta);
    this.menu.setRows([
      { label: 'Run again', action: () => { if (this.onAgain) this.onAgain(); } },
      { label: 'Change players or cars', action: () => { if (this.onSetup) this.onSetup(); } },
      { label: 'Close the slip', action: () => { if (this.onClose) this.onClose(); } },
    ], 0);
    this.menu.show();
  }

  hide() { this.menu.hide(); }

  _headline(res) {
    const L = res.lanes;
    if (L.length === 1) {
      const l = L[0];
      if (l.red) return 'Red light';
      if (!l.finished) return 'No time';
      return `${t3(l.et)} @ ${mph1(l.mph)} mph`;
    }
    if (res.winner === null) return 'No winner: both lanes are out';
    const w = L[res.winner], lose = L[1 - res.winner];
    if (res.why === 'finish') return `${w.name} wins by ${t3(res.margin)} s`;
    if (res.why === 'red') return `${lose.name} red light. ${w.name} wins`;
    if (res.why === 'foul') return `${lose.name} crossed the centre line. ${w.name} wins`;
    return `${lose.name} did not finish. ${w.name} wins`;
  }

  _render(res, meta) {
    this.headEl.textContent = this._headline(res);
    this.headEl.className = `drag-slip-head${res.lanes.length === 1 && meta.newBest[0] ? ' best' : ''}`;
    this.sub.textContent = meta.track;

    this.headRow.replaceChildren();
    const th = (text, cls = '') => {
      const e = document.createElement('th');
      e.textContent = text;
      if (cls) e.className = cls;
      this.headRow.append(e);
    };
    th('');
    res.lanes.forEach((l, k) => th(`${l.name}, ${l.chassis.name}`, res.winner === k ? 'win' : ''));

    const rows = [
      ['Reaction', (l) => t3(l.reaction), (l) => (l.red ? 'red' : '')],
      ['60 ft', (l) => t3(l.sixty)],
      ['330 ft', (l) => t3(l.threeThirty)],
      ['1/8 mile', (l) => t3(l.eighth)],
      ['1/8 mile mph', (l) => mph1(l.eighthMph)],
      ['1000 ft', (l) => t3(l.thousand)],
      ['1/4 mile', (l) => t3(l.et)],
      ['1/4 mile mph', (l) => mph1(l.mph)],
      ['Best ET', (l, k) => (meta.bests[k] === null ? '-' : t3(meta.bests[k])), (l, k) => (meta.newBest[k] ? 'best' : '')],
    ];
    this.body.replaceChildren();
    for (const [label, get, cls] of rows) {
      const tr = document.createElement('tr');
      const td0 = document.createElement('td');
      td0.textContent = label;
      tr.append(td0);
      res.lanes.forEach((l, k) => {
        const td = document.createElement('td');
        td.className = `num ${cls ? cls(l, k) : ''}`;
        td.textContent = get(l, k);
        tr.append(td);
      });
      this.body.append(tr);
    }
  }

  handlePad(m) { this.menu.handlePad(m); }
}
