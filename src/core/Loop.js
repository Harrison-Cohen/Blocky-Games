// Fixed timestep loop with an accumulator.
//
// Physics runs at exactly SIM.hz regardless of display refresh, and rendering
// interpolates between the last two physics states. That is what makes handling
// identical on a 60 Hz laptop and a 144 Hz monitor.
//
// The stepping arithmetic is separated from requestAnimationFrame so it can be
// driven with synthetic frame times in a test. See scripts in the repo history.

import { SIM } from '../data/tuning.js';

export class Loop {
  constructor({ step, render }) {
    this.step = step;
    this.render = render;
    this.dt = 1 / SIM.hz;
    this.accumulator = 0;
    this.running = false;
    this.lastTime = 0;
    this.alpha = 0;

    // Diagnostics for the debug overlay.
    this.frameDelta = 0;
    this.stepsLastFrame = 0;
    this.starved = false; // true when we hit the step cap and fell behind

    this._raf = null;
    this._tick = this._tick.bind(this);
    this._onVisibility = this._onVisibility.bind(this);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.accumulator = 0;
    document.addEventListener('visibilitychange', this._onVisibility);
    this._raf = requestAnimationFrame(this._tick);
  }

  stop() {
    this.running = false;
    if (this._raf !== null) cancelAnimationFrame(this._raf);
    this._raf = null;
    document.removeEventListener('visibilitychange', this._onVisibility);
  }

  _onVisibility() {
    // Coming back from a hidden tab, the elapsed time is meaningless. Drop it
    // rather than simulating minutes of frozen input into a wall.
    if (!document.hidden) {
      this.lastTime = performance.now();
      this.accumulator = 0;
    }
  }

  _tick(now) {
    if (!this.running) return;
    this._raf = requestAnimationFrame(this._tick);
    let frameDelta = (now - this.lastTime) / 1000;
    this.lastTime = now;
    this.advance(frameDelta);
  }

  // Pure stepping logic. Given a wall-clock frame delta, run whole physics
  // steps and leave the leftover in the accumulator as the render alpha.
  advance(frameDelta) {
    // A long stall (breakpoint, tab switch, GC pause) is discarded, not
    // simulated. Simulating it is how cars end up inside walls.
    if (frameDelta > SIM.maxFrameDelta) frameDelta = 0;
    if (frameDelta < 0) frameDelta = 0;
    this.frameDelta = frameDelta;

    this.accumulator += frameDelta;

    let steps = 0;
    while (this.accumulator >= this.dt && steps < SIM.maxStepsPerFrame) {
      this.step(this.dt);
      this.accumulator -= this.dt;
      steps++;
    }

    // Hit the cap and still behind: shed the backlog so we run in slow motion
    // instead of spiralling into a freeze.
    this.starved = this.accumulator >= this.dt;
    if (this.starved) this.accumulator = 0;

    this.stepsLastFrame = steps;
    this.alpha = this.accumulator / this.dt;
    if (this.render) this.render(this.alpha, frameDelta);
    return steps;
  }
}
