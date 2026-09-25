// Dev overlay. Not the game HUD: that arrives in milestone 3 as ui/HUD.js and
// is signage, not telemetry. This one stays for the life of the project as the
// thing you read while editing tuning.js. Toggle with the backtick key.

import { SIM } from '../data/tuning.js';
import { toMph } from './Speedo.js';
import { load, save } from '../core/Storage.js';

export class DebugHud {
  constructor(root) {
    this.el = document.createElement('div');
    this.el.className = 'debug-hud';
    root.appendChild(this.el);
    // Shown until you hide it, and hidden from then on until you show it.
    this.visible = load('telemetry', true) !== false;
    this.el.hidden = !this.visible;
    this._acc = 0;
    this._frames = 0;
    this._fps = 0;
    this._worstSteps = 0;
  }

  toggle() {
    this.visible = !this.visible;
    this.el.hidden = !this.visible;
    save('telemetry', this.visible);
  }

  update(vehicle, loop, camera, frameDelta, track, scene) {
    this._acc += frameDelta;
    this._frames++;
    this._worstSteps = Math.max(this._worstSteps, loop.stepsLastFrame);
    if (this._acc < 0.25) return;
    this._fps = this._frames / this._acc;
    const worst = this._worstSteps;
    this._acc = 0; this._frames = 0; this._worstSteps = 0;
    if (!this.visible) return;

    const p = vehicle.physics;
    const deg = (r) => (r * 180 / Math.PI).toFixed(1);
    // Four full surface names do not fit the panel width, and a wrapped line
    // makes the whole readout jump. Collapse when the car is on one surface.
    const surfaces = p.wheelSurface;
    const uniform = surfaces.every((x) => x === surfaces[0]);
    const surfaceText = uniform
      ? surfaces[0]
      : surfaces.map((x) => x.slice(0, 3)).join(' ');

    // Where round the lap the car is, from the same spline the road came from.
    let lapText = 'no track';
    if (track) {
      const prog = track.progressAt(p.x, p.z, p.y) * track.ds;
      const cp = track.lastCheckpointFor(p.x, p.z, p.y);
      lapText = `${prog.toFixed(0)} / ${track.length.toFixed(0)} m  cp ${cp.index}`;
    }

    const bar = (v, max, width = 10) => {
      const n = Math.round(Math.max(0, Math.min(1, v / max)) * width);
      return '#'.repeat(n) + '.'.repeat(width - n);
    };

    this.el.innerHTML = `
<div class="dbg-row dbg-head">${vehicle.chassis.name}<span>V to swap</span></div>
<div class="dbg-row"><span>fps</span><b>${this._fps.toFixed(0)}</b></div>
<div class="dbg-row"><span>steps/frame</span><b>${loop.stepsLastFrame} peak ${worst}${loop.starved ? ' LATE' : ''}</b></div>
<div class="dbg-row"><span>rate</span><b>${SIM.hz} Hz fixed</b></div>
<div class="dbg-row"><span>resolution</span><b>${scene ? `${Math.round(scene.renderScale * 100)}% x${scene.renderer.getPixelRatio().toFixed(2)}` : '-'}</b></div>
<div class="dbg-row"><span>exposure</span><b>${scene ? scene.renderer.toneMappingExposure.toFixed(2) : '-'}</b></div>
<div class="dbg-sep"></div>
<div class="dbg-row"><span>speed</span><b>${toMph(p.speed).toFixed(1)} mph</b></div>
<div class="dbg-row"><span>long / lat vel</span><b>${p.vLong.toFixed(1)} / ${p.vLat.toFixed(1)}</b></div>
<div class="dbg-row"><span>yaw rate</span><b>${deg(p.yawRate)}&deg;/s</b></div>
<div class="dbg-sep"></div>
<div class="dbg-row"><span>slip front</span><b class="${Math.abs(p.slipFront) > 0.14 ? 'over' : ''}">${deg(p.slipFront)}&deg;</b></div>
<div class="dbg-row"><span>slip rear</span><b class="${Math.abs(p.slipRear) > 0.14 ? 'over' : ''}">${deg(p.slipRear)}&deg;</b></div>
<div class="dbg-row"><span>load F / R</span><b>${(p.frontLoad / 1000).toFixed(1)} / ${(p.rearLoad / 1000).toFixed(1)} kN</b></div>
<div class="dbg-row"><span>pitch / roll</span><b>${deg(p.pitch)}&deg; / ${deg(p.roll)}&deg;</b></div>
<div class="dbg-sep"></div>
<div class="dbg-row"><span>FL</span><b>${bar(p.cornerLoad[0], 12000)}</b></div>
<div class="dbg-row"><span>FR</span><b>${bar(p.cornerLoad[1], 12000)}</b></div>
<div class="dbg-row"><span>RL</span><b>${bar(p.cornerLoad[2], 12000)}</b></div>
<div class="dbg-row"><span>RR</span><b>${bar(p.cornerLoad[3], 12000)}</b></div>
<div class="dbg-sep"></div>
<div class="dbg-row"><span>surface</span><b>${surfaceText}</b></div>
<div class="dbg-row"><span>wheels down</span><b>${p.wheelsOnGround}/4${p.airborne ? ' AIRBORNE' : ''}</b></div>
<div class="dbg-row"><span>on track</span><b class="${p.onTrack ? '' : 'over'}">${p.onTrack ? 'yes' : 'off track'}${p.touchingBarrier ? ' WALL' : ''}</b></div>
<div class="dbg-row"><span>lap progress</span><b>${lapText}</b></div>
<div class="dbg-row"><span>camera</span><b>${camera.modeName}</b></div>
`;
  }
}
