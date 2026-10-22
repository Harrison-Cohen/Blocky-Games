// The screens between drives: the title, the pause card and track select.
//
// All three are Menus (RaceScreens.js): up and down move, left and right
// change a setting, Enter chooses, Esc goes back, and the gamepad does the
// same on the d-pad, A and B. What the title and pause rows do is Game's
// business, so Game hands them in; track select owns its own rows because
// they are all settings it hands back in one piece when you start.

import { Menu } from './RaceScreens.js';
import { RACE } from '../data/tuning.js';
import { CHASSIS } from '../data/cars.js';
import { TRACKS } from '../data/tracks/index.js';
import { Track } from '../game/Track.js';
import { formatTime } from '../game/LapTimer.js';
import { load, recordName } from '../core/Storage.js';

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const carName = (id) => CHASSIS.find((c) => c.id === id)?.name ?? id;
const cycle = (list, now, d) => list[(list.indexOf(now) + d + list.length) % list.length];

// The title and the pause card: a heading, a line under it, and rows.
export class MenuScreen {
  constructor(el) {
    this.el = el;
    this.subEl = el.querySelector('.menu-sub');
    this.menu = new Menu(el, el.querySelector('.race-rows'));
  }

  get visible() { return this.menu.visible; }

  // rows as Menu takes them. onBack is Esc and the pad's B, onPadStart the
  // pad's Start. `numbered` numbers the lines that are choices (a row with an
  // action and no value) 01, 02 and so on, in order.
  open(rows, { focus = 0, sub = null, onBack = null, onPadStart = null, numbered = false } = {}) {
    if (this.subEl && sub !== null) this.subEl.textContent = sub;
    this.menu.onBack = onBack;
    this.menu.onPadStart = onPadStart;
    if (numbered) {
      let n = 0;
      for (const r of rows) if (r.action && !r.value && !r.no) r.no = String(++n).padStart(2, '0');
    }
    this.menu.setRows(rows, focus);
    this.menu.show();
  }

  // The focused row, by label, so a screen can come back to where it was.
  get focusLabel() { return this.menu.rows[this.menu.index]?.label; }

  repaint() { if (this.visible) this.menu.paint(); }
  hide() { this.menu.hide(); }
  handlePad(m) { this.menu.handlePad(m); }
}

// What the track select screen is choosing for.
const MODES = {
  trial: { title: 'Time trial', start: 'Start lap', sub: 'Pick a track and a car. The clock starts at the line.' },
  race: { title: 'Race', start: 'Start race', sub: 'Pick a track, a car and the field.' },
  drag: { title: 'Drag race', start: 'Stage the cars', sub: 'A quarter mile against the clock, or a friend.' },
};

// A track belongs to the drag list or the circuit list, never both.
const tracksFor = (mode) => TRACKS.filter((t) => (mode === 'drag') === !!t.drag);

export class TrackSelect {
  constructor(root) {
    this.el = root.querySelector('.track-select');
    this.titleEl = this.el.querySelector('.ts-title');
    this.subEl = this.el.querySelector('.ts-sub');
    this.nameEl = this.el.querySelector('.ts-name');
    this.blurbEl = this.el.querySelector('.ts-blurb');
    this.factsEl = this.el.querySelector('.ts-facts');
    this.bestsHead = this.el.querySelector('.ts-bests-head');
    this.bestsEl = this.el.querySelector('.ts-bests');
    this.canvas = this.el.querySelector('.ts-map');
    this.ctx = this.canvas.getContext('2d');
    this.menu = new Menu(this.el, this.el.querySelector('.ts-rows'));
    this.menu.onBack = () => { if (this.onBack) this.onBack(); };
    this.menu.onFocus = (row) => { if (row.track) this._choose(row.track.id); };
    this.onStart = null; // (pick) => void, see _pick
    this.onBack = null; // () => void
    // Built the first time a track is shown, for its map and its facts. A few
    // milliseconds each, and never the one the game is driving on.
    this._tracks = new Map();
  }

  get visible() { return this.menu.visible; }

  // opts: { mode, trackId, chassisId, race, drag, trial: { pace, ghost },
  //         dragBests, back }
  // trackId is where to start; a track that is not in this mode's list starts
  // on the first one that is.
  open(opts) {
    const mode = MODES[opts.mode] ? opts.mode : 'trial';
    const list = tracksFor(mode);
    this.mode = mode;
    this.dragBests = opts.dragBests || {};
    this.s = {
      trackId: list.some((t) => t.id === opts.trackId) ? opts.trackId : list[0].id,
      chassisId: opts.chassisId,
      race: { ...opts.race },
      drag: { ...opts.drag },
      trial: { ...opts.trial },
    };
    const s = this.s;
    const m = MODES[mode];
    this.titleEl.textContent = m.title;
    this.subEl.textContent = m.sub;

    const start = () => { if (this.onStart) this.onStart(this._pick()); };
    const ids = CHASSIS.map((c) => c.id);
    const onOff = (v) => (v ? 'On' : 'Off');
    // The tracks are a table: number, name, length, surface, light, your best.
    const rows = [{ head: [list.length > 1 ? 'Track' : 'Strip', 'Length', 'Surface', 'Light', 'Your best'], cls: 'ts-head' }];
    list.forEach((t, i) => {
      const f = this._facts(t);
      rows.push({ label: t.name, no: String(i + 1).padStart(2, '0'), track: t, cls: 'ts-track',
        cols: [f.length, f.surface, f.light], value: () => this._bestText(t.id, s.chassisId), action: start });
    });
    const g = s.drag;
    const two = () => g.players === 2;
    rows.push({ section: mode === 'drag' ? 'Drivers' : 'Car' });
    if (mode === 'drag') {
      rows.push({ label: 'Players', value: () => (two() ? 'Two, split screen' : 'One'),
        step: () => { g.players = two() ? 1 : 2; } });
    }
    rows.push({ label: mode === 'drag' ? 'Player 1 car' : 'Car', value: () => carName(s.chassisId),
      step: (d) => { s.chassisId = cycle(ids, s.chassisId, d); this._paintCard(); } });
    if (mode === 'race') {
      const r = s.race;
      const levels = Object.keys(RACE.levels);
      rows.push({ section: 'Race' });
      rows.push({ label: 'Laps', value: () => String(r.laps), step: (d) => { r.laps = clamp(r.laps + d, 1, 10); } });
      rows.push({ label: 'Opponents', value: () => String(r.opponents),
        step: (d) => { r.opponents = clamp(r.opponents + d, 1, RACE.maxOpponents); } });
      rows.push({ label: 'Difficulty', value: () => RACE.levels[r.difficulty].name,
        step: (d) => { r.difficulty = cycle(levels, r.difficulty, d); } });
    } else if (mode === 'drag') {
      rows.push({ label: 'Player 2 car', value: () => (two() ? carName(g.car2) : '-'),
        step: (d) => { if (two()) g.car2 = cycle(ids, g.car2, d); } });
      rows.push({ label: 'Player 2 gearbox', value: () => (two() ? (g.manual2 ? 'Manual' : 'Automatic') : '-'),
        step: () => { if (two()) g.manual2 = !g.manual2; } });
    } else {
      const tt = s.trial;
      rows.push({ section: 'On track' });
      rows.push({ label: 'Pace car', value: () => onOff(tt.pace), step: () => { tt.pace = !tt.pace; } });
      rows.push({ label: 'Ghost of your best lap', value: () => onOff(tt.ghost), step: () => { tt.ghost = !tt.ghost; } });
    }
    rows.push({ label: m.start, cls: 'btn primary', action: start });
    rows.push({ label: opts.back || 'Back', cls: 'btn', action: () => { if (this.onBack) this.onBack(); } });

    // Open on the track you are on, so Enter twice from the title drives it.
    const focus = rows.findIndex((r) => r.track && r.track.id === s.trackId);
    this.menu.setRows(rows, focus);
    this.menu.show();
  }

  hide() { this.menu.hide(); }
  handlePad(m) { this.menu.handlePad(m); }

  // Everything Game needs to start: { mode, trackId, chassisId, race, drag,
  // trial }. Game holds each setting to what it can run.
  _pick() {
    const s = this.s;
    return { mode: this.mode, trackId: s.trackId, chassisId: s.chassisId,
      race: { ...s.race }, drag: { ...s.drag }, trial: { ...s.trial } };
  }

  _best(trackId, chassisId) {
    if (this.mode === 'drag') {
      const b = this.dragBests[chassisId];
      return b && typeof b.et === 'number' ? b.et : null;
    }
    const rec = load(recordName(trackId, chassisId), null);
    return rec && typeof rec.best === 'number' ? rec.best : null;
  }

  _bestText(trackId, chassisId) {
    const b = this._best(trackId, chassisId);
    if (b === null) return this.mode === 'drag' ? '-.---' : '--:--.---';
    return this.mode === 'drag' ? b.toFixed(3) : formatTime(b);
  }

  _track(id) {
    let t = this._tracks.get(id);
    if (!t) {
      t = new Track(TRACKS.find((d) => d.id === id));
      this._tracks.set(id, t);
    }
    return t;
  }

  // What a track is like, as the table and the card both say it. `surface`
  // names only what is not tarmac in the card (`loose`), and `climb` is in feet.
  _facts(data) {
    const t = this._track(data.id);
    let lo = Infinity, hi = -Infinity;
    const surfaces = new Set();
    for (let i = 0; i < t.count; i++) {
      lo = Math.min(lo, t.py[i]);
      hi = Math.max(hi, t.py[i]);
      surfaces.add(t.surface[i]);
    }
    const loose = [...surfaces].filter((x) => x !== 'tarmac');
    return {
      t,
      length: data.drag ? '1/4 mi' : `${(t.length / 1609.344).toFixed(2)} mi`,
      climb: `${Math.round((hi - lo) * 3.28084)} ft`,
      loose,
      surface: loose.length ? 'Mixed' : 'Tarmac',
      light: data.headlights ? 'Night' : 'Day',
    };
  }

  _choose(id) {
    this.s.trackId = id;
    for (const row of this.menu.rows) {
      if (row.track) row._li.classList.toggle('chosen', row.track.id === id);
    }
    this._paintCard();
  }

  // The card: the track's name, its map, what it is like, and the best time
  // every car has set on it, the car you have picked marked.
  _paintCard() {
    const data = TRACKS.find((d) => d.id === this.s.trackId);
    const f = this._facts(data);
    const t = f.t;
    this.nameEl.textContent = data.name;
    this.blurbEl.textContent = data.description || '';

    const facts = data.drag
      ? [['Length', 'Quarter mile'], ['Surface', 'Tarmac'], ['Lanes', 'Two']]
      : [
        ['Length', `${f.length}  (${Math.round(t.length).toLocaleString('en-US')} m)`],
        ['Climb', f.climb],
        ['Surface', f.loose.length ? `Tarmac and ${f.loose.join(' and ')}` : 'Tarmac'],
        ['Lighting', f.light],
      ];
    this.factsEl.replaceChildren();
    for (const [k, v] of facts) {
      const dt = document.createElement('dt');
      dt.textContent = k;
      const dd = document.createElement('dd');
      dd.textContent = v;
      this.factsEl.append(dt, dd);
    }

    this.bestsHead.textContent = data.drag ? 'Best elapsed times' : 'Best laps';
    const times = CHASSIS.map((c) => ({ c, t: this._best(data.id, c.id) }));
    const fastest = times.reduce((m, x) => (x.t !== null && (m === null || x.t < m) ? x.t : m), null);
    this.bestsEl.replaceChildren();
    for (const { c, t: time } of times) {
      const li = document.createElement('li');
      if (c.id === this.s.chassisId) li.className = 'you';
      const name = document.createElement('span');
      name.textContent = c.name;
      // A bar against the fastest time: the quickest car's is full.
      const bar = document.createElement('span');
      bar.className = 'ts-bar';
      if (time !== null && fastest !== null) {
        const fill = document.createElement('i');
        if (time === fastest) fill.className = 'fastest';
        fill.style.width = `${Math.round((fastest / time) * 100)}%`;
        bar.append(fill);
      }
      const val = document.createElement('span');
      val.className = time !== null && time === fastest ? 'num fastest' : 'num';
      val.textContent = this._bestText(data.id, c.id);
      li.append(name, bar, val);
      this.bestsEl.append(li);
    }
    this.menu.rows.forEach((row) => { if (row._value) row._value.textContent = row.value(); });
    this._drawMap(t);
  }

  // The circuit from above, off the same centreline as everything else, with
  // the start line, which way round it goes, and any loose surface dashed.
  // A bridge is drawn last with a gap either side, so a figure 8 reads as one.
  _drawMap(t) {
    const c = this.canvas;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(c.clientWidth * dpr) || c.width;
    const h = Math.round(c.clientHeight * dpr) || c.height;
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    const ctx = this.ctx;
    ctx.clearRect(0, 0, w, h);
    const mm = t.minimap;
    const pad = 18 * dpr;
    const sx = mm.maxX - mm.minX || 1, sz = mm.maxZ - mm.minZ || 1;
    const k = Math.min((w - pad * 2) / sx, (h - pad * 2) / sz);
    // The minimap's own orientation, so this is the map you drive with.
    const ox = (w - sx * k) / 2 - mm.minX * k;
    const oy = (h - sz * k) / 2 - mm.minZ * k;
    const X = (i) => t.px[i] * k + ox;
    const Y = (i) => t.pz[i] * k + oy;
    const n = t.count;
    const road = 5 * dpr;

    const run = (from, to) => {
      ctx.beginPath();
      ctx.moveTo(X(from % n), Y(from % n));
      for (let i = from + 1; i <= to; i++) ctx.lineTo(X(i % n), Y(i % n));
      ctx.stroke();
    };
    // Runs of samples that share a surface and a deck, so each is one stroke.
    const runs = [];
    let s0 = 0;
    for (let i = 1; i <= n; i++) {
      const a = s0 % n, b = i % n;
      if (i === n || t.surface[b] !== t.surface[a] || t.bridge[b] !== t.bridge[a]) {
        runs.push({ from: s0, to: i, loose: t.surface[a] !== 'tarmac', bridge: !!t.bridge[a] });
        s0 = i;
      }
    }
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const pass of [false, true]) {
      for (const r of runs) {
        if (r.bridge !== pass) continue;
        if (pass) {
          ctx.setLineDash([]);
          ctx.lineCap = 'butt';
          ctx.strokeStyle = '#0e1a2b';
          ctx.lineWidth = road + 6 * dpr;
          run(r.from, r.to);
          ctx.lineCap = 'round';
        }
        ctx.strokeStyle = r.loose ? 'rgba(237, 237, 231, 0.55)' : '#edede7';
        ctx.lineWidth = road;
        ctx.setLineDash(r.loose ? [2 * dpr, 7 * dpr] : []);
        run(r.from, r.to);
      }
    }
    ctx.setLineDash([]);

    // The start line across the road, and an arrow just past it.
    const i0 = t.startSample;
    const lx = t.lx[i0], lz = t.lz[i0];
    const half = 9 * dpr;
    ctx.strokeStyle = '#d8c8a0';
    ctx.lineWidth = 3 * dpr;
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.moveTo(X(i0) + lx * half, Y(i0) + lz * half);
    ctx.lineTo(X(i0) - lx * half, Y(i0) - lz * half);
    ctx.stroke();
    const ahead = (i0 + Math.max(4, Math.round(40 / t.ds))) % n;
    const ax = X(ahead), ay = Y(ahead);
    const tx = t.tx[ahead], tz = t.tz[ahead];
    const nx = t.lx[ahead], nz = t.lz[ahead];
    const a = 7 * dpr;
    ctx.fillStyle = '#d8c8a0';
    ctx.beginPath();
    ctx.moveTo(ax + tx * a, ay + tz * a);
    ctx.lineTo(ax - tx * a + nx * a * 0.8, ay - tz * a + nz * a * 0.8);
    ctx.lineTo(ax - tx * a - nx * a * 0.8, ay - tz * a - nz * a * 0.8);
    ctx.closePath();
    ctx.fill();
  }
}
