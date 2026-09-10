// The track registry.
//
// Every .js file in this folder except this one IS a track. There is no list to
// update and no import to add: dropping in a data file is the whole job of
// adding a track, which is what the brief asks for. If a track ever needs a
// change outside its own file, that is a bug in the track system.
//
// Ordering is by each track's `order` field, then filename.

const modules = import.meta.glob('./*.js', { eager: true });

export const TRACKS = Object.entries(modules)
  .filter(([path]) => !/\/index\.js$/.test(path))
  .map(([path, mod]) => ({ path, track: mod.default }))
  .filter((e) => e.track && e.track.id)
  .sort((a, b) => (a.track.order ?? 99) - (b.track.order ?? 99) || a.path.localeCompare(b.path))
  .map((e) => e.track);

export function getTrack(id) {
  return TRACKS.find((t) => t.id === id) || TRACKS[0];
}

export const DEFAULT_TRACK = TRACKS[0]?.id;
