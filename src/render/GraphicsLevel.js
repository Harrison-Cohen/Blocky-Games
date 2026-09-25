// Graphics levels: the garage's Low, Medium, High and Ultra.
//
// A level is a set of overrides on GRAPHICS and WORLD (see GRAPHICS_LEVELS in
// tuning.js), written onto those same objects so every system goes on reading
// the one place it always has. The values tuning.js itself declares are
// captured here, before any level touches them, so a level only ever changes
// what it names and Ultra puts back exactly what the file says.
//
// Writing the values is all this does. Whatever was built from them -- the
// post chain, the shadow map, the lamp pool -- has to be built again for a
// change to show; Scene.applyGraphics does that.

import { GRAPHICS, WORLD, GRAPHICS_LEVELS, DEFAULT_GRAPHICS_LEVEL } from '../data/tuning.js';

const TARGETS = { graphics: GRAPHICS, world: WORLD };
const DECLARED = { graphics: { ...GRAPHICS }, world: { ...WORLD } };

export const normalizeGraphicsLevel = (id) =>
  (GRAPHICS_LEVELS.some((l) => l.id === id) ? id : DEFAULT_GRAPHICS_LEVEL);

// Returns the id of the level actually applied.
export function setGraphicsLevel(id) {
  const level = GRAPHICS_LEVELS.find((l) => l.id === normalizeGraphicsLevel(id));
  for (const [part, target] of Object.entries(TARGETS)) {
    // Every setting any level touches goes back to its declared value first,
    // so going from Low to High does not keep what Low changed and High does
    // not mention.
    for (const l of GRAPHICS_LEVELS) {
      for (const k of Object.keys(l[part] || {})) target[k] = DECLARED[part][k];
    }
    Object.assign(target, level[part] || {});
  }
  return level.id;
}
