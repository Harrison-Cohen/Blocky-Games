// The controls chart: an action per row, the keyboard keys and the gamepad
// button side by side, in tabs for driving and flying. The rows are data
// (data/controls.js); this only draws them. Left and right on the title's
// Controls row, or a click on a tab, switch tabs.

import { CONTROLS } from '../data/controls.js';

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};

export class ControlsChart {
  constructor(root) {
    this.root = root;
    this.names = Object.keys(CONTROLS);
    this.tab = this.names[0];
    this.tabButtons = new Map();

    const head = el('div', 'cc-head');
    head.append(el('h1', '', 'Controls'));
    const tabs = el('div', 'cc-tabs');
    for (const name of this.names) {
      const b = el('button', 'cc-tab', CONTROLS[name].title);
      b.type = 'button';
      b.addEventListener('click', () => this.setTab(name));
      this.tabButtons.set(name, b);
      tabs.append(b);
    }
    head.append(tabs);

    this.table = el('table', 'cc-table');
    this.table.createTHead().innerHTML = '<tr><th>Action</th><th>Keyboard</th><th>Gamepad</th></tr>';
    this.body = this.table.createTBody();
    this.extraEl = el('p', 'cc-extra');
    this.footEl = el('p', 'cc-foot');
    root.replaceChildren(head, this.table, this.extraEl, this.footEl);
    this.setTab(this.tab);
  }

  setTab(name) {
    if (!CONTROLS[name]) return;
    this.tab = name;
    const set = CONTROLS[name];
    for (const [n, b] of this.tabButtons) b.classList.toggle('on', n === name);
    this.body.replaceChildren();
    for (const row of set.rows) {
      const tr = this.body.insertRow();
      tr.insertCell().textContent = row.action;
      const keys = tr.insertCell();
      for (const [label] of row.keys) keys.append(el('kbd', '', label));
      if (row.note) keys.append(el('span', 'cc-note', row.note));
      const pad = tr.insertCell();
      pad.className = row.pad ? 'cc-pad' : 'cc-pad none';
      pad.textContent = row.pad || 'none';
    }
    this.extraEl.replaceChildren();
    for (const [label, , what] of set.extra || []) {
      this.extraEl.append(el('kbd', '', label), el('span', 'cc-what', what));
    }
    this.extraEl.hidden = !(set.extra && set.extra.length);
    this.footEl.textContent = set.foot || '';
    this.footEl.hidden = !set.foot;
  }

  // d is 1 or -1: the next tab or the one before.
  cycleTab(d) {
    const i = this.names.indexOf(this.tab);
    this.setTab(this.names[(i + d + this.names.length) % this.names.length]);
  }
}
