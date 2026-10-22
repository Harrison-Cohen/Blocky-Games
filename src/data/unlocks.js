// Everything is unlocked for now. Every aircraft, course, mission and arena
// asks here whether it is available, so progression can be added later by
// changing this one function and nothing else.
//
// kind: 'aircraft' | 'airRace' | 'mission' | 'arena' | ...
export function isUnlocked(kind, id) {
  void kind; void id;
  return true;
}
