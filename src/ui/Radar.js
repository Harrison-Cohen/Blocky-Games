// The corner radar: a disc that turns with the aircraft's heading (what is ahead is
// up), a compass round its rim that turns the other way, range rings, and what is
// within range: airports (a little runway, the way it points) and race tracks
// (a diamond). It reads a list of contacts, so the aircraft, missiles and targets
// of later milestones are one more kind in the same list.
//
//   contacts  [{ x, z, kind: 'airport' | 'track' | 'aircraft' | 'missile' | 'target',
//                heading, length, hostile }]   world metres, compass radians
//
// The nearest airport is named under the disc, with its bearing and distance.

import { RADAR } from '../data/tuning.js';
import { distanceIn } from '../flight/Units.js';

const TAU = Math.PI * 2;
const css = (hex) => `#${hex.toString(16).padStart(6, '0')}`;

export class Radar {
  constructor(parent) {
    this.root = document.createElement('div');
    this.root.className = 'fhud-radar';
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'fhud-radar-disc';
    this.ctx = this.canvas.getContext('2d');
    this.text = document.createElement('div');
    this.text.className = 'fhud-radar-text';
    this.root.append(this.canvas, this.text);
    parent.append(this.root);
    this.landmarks = [];
    this.range = RADAR.range;
    this._px = 0;
    this._textKey = '';
  }

  setLandmarks(list) { this.landmarks = list; }

  // d: { x, z, heading (radians, compass), units, contacts? }
  update(d) {
    const css0 = RADAR.size;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const px = Math.round(css0 * dpr);
    const c = this.canvas;
    if (this._px !== px) {
      this._px = px;
      c.width = px; c.height = px;
      c.style.width = `${css0}px`; c.style.height = `${css0}px`;
    }
    const g = this.ctx;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, px, px);
    g.scale(dpr, dpr);
    const R = css0 / 2 - 2;
    g.translate(css0 / 2, css0 / 2);

    // The disc.
    g.fillStyle = 'rgba(14, 26, 43, 0.82)';
    g.beginPath(); g.arc(0, 0, R, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(237, 237, 231, 0.18)';
    g.lineWidth = 1;
    for (const f of [0.5, 0.25]) { g.beginPath(); g.arc(0, 0, R * f, 0, TAU); g.stroke(); }
    g.strokeStyle = 'rgba(237, 237, 231, 0.55)';
    g.beginPath(); g.arc(0, 0, R, 0, TAU); g.stroke();

    // The compass: a tick every 10 degrees, longer every 30, the four letters. A
    // bearing b is at b - heading from the top, clockwise.
    const h = d.heading;
    g.font = '600 11px Archivo, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let b = 0; b < 360; b += 10) {
      const a = (b * Math.PI) / 180 - h;
      const long = b % 30 === 0;
      const r0 = R - (long ? 7 : 4);
      g.strokeStyle = b === 0 ? css(RADAR.track) : 'rgba(237, 237, 231, 0.7)';
      g.lineWidth = b % 90 === 0 ? 2 : 1;
      g.beginPath();
      g.moveTo(Math.sin(a) * R, -Math.cos(a) * R); g.lineTo(Math.sin(a) * r0, -Math.cos(a) * r0);
      g.stroke();
    }
    for (const [name, b] of [['N', 0], ['E', 90], ['S', 180], ['W', 270]]) {
      const a = (b * Math.PI) / 180 - h;
      g.fillStyle = b === 0 ? css(RADAR.track) : '#edede7';
      g.fillText(name, Math.sin(a) * (R - 16), -Math.cos(a) * (R - 16));
    }

    // What is in range.
    const range = this.range, inner = R - 22;
    let nearest = null, nd = Infinity;
    const draw = (m) => {
      const dx = m.x - d.x, dz = m.z - d.z;
      const dist = Math.hypot(dx, dz);
      if (m.kind === 'airport' && dist < nd) { nd = dist; nearest = m; nearest.dist = dist; nearest.dx = dx; nearest.dz = dz; }
      if (dist > range) return;
      const bearing = Math.atan2(-dx, dz);
      const a = bearing - h;
      const r = (dist / range) * inner;
      const sx = Math.sin(a) * r, sy = -Math.cos(a) * r;
      if (m.kind === 'airport') {
        // A runway, the way it points.
        const L = Math.max(7, Math.min(16, (m.length || 1000) * (inner / range)));
        const ra = (m.heading || 0) - h;
        g.strokeStyle = css(RADAR.airport); g.lineWidth = 2.5; g.lineCap = 'round';
        g.beginPath();
        g.moveTo(sx - Math.sin(ra) * L / 2, sy + Math.cos(ra) * L / 2); g.lineTo(sx + Math.sin(ra) * L / 2, sy - Math.cos(ra) * L / 2);
        g.stroke();
      } else if (m.kind === 'track') {
        g.fillStyle = css(RADAR.track);
        g.beginPath(); g.moveTo(sx, sy - 4); g.lineTo(sx + 4, sy); g.lineTo(sx, sy + 4); g.lineTo(sx - 4, sy); g.closePath(); g.fill();
      } else {
        g.fillStyle = m.hostile ? css(RADAR.hostile) : '#edede7';
        g.fillRect(sx - 2.5, sy - 2.5, 5, 5);
      }
    };
    for (const m of this.landmarks) draw(m);
    if (d.contacts) for (const m of d.contacts) draw(m);

    // Us, in the middle, pointing up.
    g.fillStyle = '#f5c518';
    g.beginPath(); g.moveTo(0, -6); g.lineTo(4.5, 5); g.lineTo(0, 2.5); g.lineTo(-4.5, 5); g.closePath(); g.fill();

    // The nearest airport, by name.
    let key = '';
    if (nearest) {
      const brg = ((Math.round((Math.atan2(-nearest.dx, nearest.dz) * 180) / Math.PI) % 360) + 360) % 360;
      const dist = distanceIn(nearest.dist, d.units);
      key = `${nearest.name}\n${String(brg).padStart(3, '0')}  ${dist.value.toFixed(dist.value < 10 ? 1 : 0)} ${dist.unit}`;
    }
    if (key !== this._textKey) {
      this._textKey = key;
      const [a, b] = key.split('\n');
      this.text.replaceChildren();
      if (a) {
        const n = document.createElement('div'); n.className = 'fhud-radar-name'; n.textContent = a;
        const m = document.createElement('div'); m.className = 'fhud-radar-sub'; m.textContent = b;
        this.text.append(n, m);
      }
    }
  }
}
