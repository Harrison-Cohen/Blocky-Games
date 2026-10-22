// The loading step panel: what the screen shows while a click is being worked on.
//
// A click is answered on the same frame. The panel goes into the page at once but
// fades in only after MENU.loadingDelay (a CSS animation delay, so it runs on the
// compositor and keeps moving while the main thread is busy), which means a wait
// shorter than the delay never shows anything at all. Longer ones show the steps
// the work really goes through, a bar that fills as they finish, and a moving
// block on the step in hand.
//
//   await loading.run({ title, sub, steps: ['Building the road', ...], tip }, async (job) => {
//     job.step(0);  ...work...
//     job.step(1);  ...work...
//     while (!done) { done = sliceOfWork(MENU.sliceMs); await job.yield(); }
//   });
//
// While it runs, the keys and the mouse do nothing: nothing under the panel can be
// pressed, and what was pressed to start it cannot start it twice.

import { MENU } from '../data/tuning.js';

const SEGMENTS = 10;

// Resolves on the next macrotask, so the browser can paint or take input between
// two slices of work. A MessageChannel has no minimum delay, unlike setTimeout.
const channel = typeof MessageChannel !== 'undefined' ? new MessageChannel() : null;
const waiting = [];
if (channel) channel.port1.onmessage = () => { const r = waiting.shift(); if (r) r(); };
export function yieldNow() {
  if (!channel) return new Promise((r) => setTimeout(r, 0));
  return new Promise((r) => { waiting.push(r); channel.port2.postMessage(0); });
}

// Resolves after the browser has painted a frame: the panel is on the screen (and
// its animation handed to the compositor) before any heavy work starts.
export function nextPaint() {
  return new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
}

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

export class Loading {
  constructor(root) {
    this.root = el('div', 'loading');
    this.root.hidden = true;
    this.root.setAttribute('role', 'status');
    this.panel = el('div', 'loading-panel');
    const head = el('div', 'loading-head');
    this.titleEl = el('div', 'loading-title');
    head.append(this.titleEl, el('div', 'loading-state', 'Loading'));
    this.subEl = el('div', 'loading-sub');
    const th = el('div', 'loading-row loading-th');
    th.append(el('span'), el('span', '', 'Step'), el('span', 'loading-r', 'Status'));
    this.listEl = el('div', 'loading-list');
    this.barEl = el('div', 'loading-bar');
    for (let i = 0; i < SEGMENTS; i++) {
      const b = el('b');
      b.append(el('i'));
      this.barEl.append(b);
    }
    const foot = el('div', 'loading-foot');
    this.tipEl = el('span', 'loading-tip');
    this.pctEl = el('span', 'loading-pct');
    foot.append(this.tipEl, this.pctEl);
    this.panel.append(head, this.subEl, th, this.listEl, this.barEl, foot);
    this.root.append(this.panel);
    root.append(this.root);

    this.busy = false;
    this._done = Promise.resolve();
    this._rows = [];
    this._guard = (e) => { e.stopImmediatePropagation(); e.preventDefault(); };
  }

  // Runs `work(job)` behind the panel. Resolves with what the work returns; the
  // panel is always taken down, even if the work throws.
  async run({ title, sub = '', steps, tip = '' }, work) {
    if (this.busy) return work(NO_JOB);
    this.busy = true;
    this._done = new Promise((r) => { this._finish = r; });
    this._open(title, sub, steps, tip);
    window.addEventListener('keydown', this._guard, true);
    window.addEventListener('keyup', this._guard, true);
    const job = {
      step: (i, f = 0) => { this._set(i, f); return yieldNow(); },
      progress: (f) => this._set(this._at, f),
      yield: () => yieldNow(),
      sub: (text) => { this.subEl.textContent = text; },
      sliceMs: MENU.sliceMs,
    };
    try {
      await nextPaint();
      return await work(job);
    } finally {
      window.removeEventListener('keydown', this._guard, true);
      window.removeEventListener('keyup', this._guard, true);
      this._close();
      this.busy = false;
      this._finish();
    }
  }

  // Resolves when nothing is loading: for a caller that started something and must
  // not look at the result before it is done (the browser scripts).
  whenIdle() { return this._done; }

  _open(title, sub, steps, tip) {
    this.titleEl.textContent = title;
    this.subEl.textContent = sub;
    this.tipEl.textContent = tip;
    this._steps = steps;
    this._at = 0;
    this.listEl.replaceChildren();
    this._rows = steps.map((label, i) => {
      const row = el('div', 'loading-row loading-step');
      const no = el('span', 'loading-no', String(i + 1).padStart(2, '0'));
      const name = el('span', '', label);
      const state = el('span', 'loading-r', '');
      row.append(no, name, state);
      this.listEl.append(row);
      return { row, state };
    });
    this._set(0, 0);
    const s = this.root.style;
    s.setProperty('--load-delay', `${MENU.loadingDelay}ms`);
    s.setProperty('--load-fade', `${MENU.loadingFade}ms`);
    this.root.classList.remove('out');
    this.root.style.animation = '';
    this.root.style.opacity = '';
    this.root.hidden = false;
  }

  // Step i is the one being worked on, f (0 to 1) how far through it the work is.
  _set(i, f) {
    const n = this._steps.length;
    this._at = Math.max(0, Math.min(n - 1, i));
    const frac = Math.max(0, Math.min(1, f));
    this._rows.forEach((r, k) => {
      const done = k < this._at;
      const work = k === this._at;
      r.row.classList.toggle('done', done);
      r.row.classList.toggle('work', work);
      r.row.classList.toggle('wait', !done && !work);
      r.state.textContent = done ? 'Done' : work ? (frac > 0 ? `${Math.round(frac * 100)}%` : 'Working') : 'Waiting';
    });
    const total = (this._at + frac) / n;
    const lit = Math.floor(total * SEGMENTS);
    [...this.barEl.children].forEach((b, k) => {
      b.className = k < lit ? 'on' : k === lit ? 'go' : '';
    });
    this.pctEl.textContent = `${Math.round(total * 100)}%`;
  }

  // Taken down at once if it never became visible; otherwise faded out from
  // however opaque it had got, so a wait just past the delay shows no flash.
  _close() {
    const r = this.root;
    const o = getComputedStyle(r).opacity;
    clearTimeout(this._hide);
    if (+o < 0.02) { r.hidden = true; return; }
    r.style.animation = 'none';
    r.style.opacity = o;
    r.classList.add('out');
    void r.offsetWidth;
    r.style.opacity = '0';
    this._hide = setTimeout(() => { if (!this.busy) r.hidden = true; }, MENU.loadingFade + 40);
  }
}

// What the work is given when a panel is already up: it does the same steps,
// only without showing them again.
const NO_JOB = {
  step: () => Promise.resolve(),
  progress: () => {},
  yield: () => yieldNow(),
  sub: () => {},
  sliceMs: MENU.sliceMs,
};
