// The flat test field of milestone 1: a plain with a runway on it.
//
// It implements the ground contract every ground in the game will:
//
//   sample(x, z, y) -> { height, normal: {x, y, z}, surface }
//
// analytic and allocation free, so the aircraft's landing gear and hull can
// call it a few dozen times a physics step. The world of milestone 2 replaces
// this with World.sample and nothing that calls it changes.
//
// The runway runs north (+z) from z = 0 to z = runwayLength, centred on x = 0.

import { FIELD } from '../data/tuning.js';

export class TestField {
  constructor() {
    this._out = { height: 0, normal: { x: 0, y: 1, z: 0 }, surface: 'grass' };
    this.half = FIELD.half;
  }

  sample(x, z) {
    const out = this._out;
    out.height = 0;
    const hw = FIELD.runwayWidth / 2;
    out.surface = (x >= -hw && x <= hw && z >= 0 && z <= FIELD.runwayLength) ? 'runway' : 'grass';
    return out;
  }

  // Where the aircraft starts on the runway, heading north.
  spawn() {
    return { x: 0, y: 0, z: FIELD.startOffset, heading: 0 };
  }
}
