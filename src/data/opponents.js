// The field.
//
// Data, in the same spirit as the tracks and the garage option lists: an
// opponent is a name, a chassis, a paint job and a driving style, and adding one
// is an entry here. Nothing outside this file decides who is on the grid.
//
// Seven drivers, the most a race can field. A race with fewer takes them from
// the top of this list.
//
// The chassis mix is deliberate. Five identical cars in five colours is not a
// field, it is one car rendered five times -- so the list alternates between
// the quick and the heavy, and the styles are picked to suit what each of them
// is good at.
//
// STYLE is what makes two drivers in the same car look like two drivers:
//
//   gripUse      how close to the tyre's peak they are willing to run. This is
//                the one that decides pace. It feeds the SPEED PROFILE, so a
//                braver driver brakes later everywhere rather than just having
//                a bigger number applied to the same plan.
//   brakeMargin  how hard they are prepared to brake, relative to that. High
//                is a late braker who then has to be patient in the corner.
//   lineBias     metres they habitually sit off the racing line, so they do not
//                run nose to tail down a single groove.
//   wander       metres their aim point drifts, and how fast, and out of phase
//                with each other. Faded out where the road turns, because a
//                driver is untidy on a straight and precise at an apex.
//   reaction     how fast their hands move, in units of lock per second.

export const OPPONENTS = [
  {
    id: 'vera',
    name: 'Vera Okonkwo',
    chassis: 'wedge-one',
    car: { primary: 'violet', secondary: 'ink', livery: 'stripes',
           wheelStyle: 'fivespoke', wheelColor: 'ink', spoiler: 'none',
           roofItem: 'none', headlight: 'cold', number: 4 },
    style: { gripUse: 0.70, brakeMargin: 1.02, lineBias: 0.0,
             wander: 0.22, wanderRate: 0.61, phase: 0.0, reaction: 6.4 },
  },
  {
    id: 'rusk',
    name: 'Danny Rusk',
    chassis: 'boxhauler-v8',
    car: { primary: 'lime', secondary: 'offwhite', livery: 'split',
           wheelStyle: 'deepdish', wheelColor: 'ink', spoiler: 'ducktail',
           roofItem: 'none', headlight: 'warm', number: 21 },
    style: { gripUse: 0.63, brakeMargin: 0.94, lineBias: 0.5,
             wander: 0.45, wanderRate: 0.44, phase: 1.7, reaction: 4.6 },
  },
  {
    id: 'mira',
    name: 'Mira Halvorsen',
    chassis: 'cube-gt',
    car: { primary: 'acid', secondary: 'ink', livery: 'checker',
           wheelStyle: 'fivespoke', wheelColor: 'offwhite', spoiler: 'lip',
           roofItem: 'none', headlight: 'warm', number: 9 },
    style: { gripUse: 0.67, brakeMargin: 0.98, lineBias: -0.4,
             wander: 0.30, wanderRate: 0.53, phase: 3.1, reaction: 5.8 },
  },
  {
    id: 'boone',
    name: 'Cal Boone',
    chassis: 'haul-4x4',
    car: { primary: 'sand', secondary: 'ink', livery: 'quarters',
           wheelStyle: 'knobby', wheelColor: 'ink', spoiler: 'none',
           roofItem: 'lightbar', headlight: 'amber', number: 66 },
    style: { gripUse: 0.61, brakeMargin: 0.90, lineBias: 0.7,
             wander: 0.52, wanderRate: 0.37, phase: 5.0, reaction: 4.2 },
  },
  {
    id: 'tock',
    name: 'Tock',
    chassis: 'bighead',
    car: { primary: 'signal', secondary: 'ink', livery: 'none',
           wheelStyle: 'blocky', wheelColor: 'ink', spoiler: 'wing',
           roofItem: 'box', headlight: 'blue', number: 1 },
    style: { gripUse: 0.65, brakeMargin: 0.96, lineBias: -0.6,
             wander: 0.38, wanderRate: 0.68, phase: 2.4, reaction: 5.2 },
  },
  {
    id: 'varga',
    name: 'Ines Varga',
    chassis: 'cube-gt',
    car: { primary: 'rose', secondary: 'ink', livery: 'stripes',
           wheelStyle: 'fivespoke', wheelColor: 'offwhite', spoiler: 'ducktail',
           roofItem: 'none', headlight: 'cold', number: 17 },
    style: { gripUse: 0.66, brakeMargin: 1.0, lineBias: 0.3,
             wander: 0.28, wanderRate: 0.58, phase: 4.2, reaction: 6.0 },
  },
  {
    id: 'brandt',
    name: 'Otto Brandt',
    chassis: 'wedge-one',
    car: { primary: 'teal', secondary: 'offwhite', livery: 'quarters',
           wheelStyle: 'deepdish', wheelColor: 'ink', spoiler: 'wing',
           roofItem: 'none', headlight: 'warm', number: 33 },
    style: { gripUse: 0.64, brakeMargin: 0.95, lineBias: -0.2,
             wander: 0.34, wanderRate: 0.47, phase: 0.8, reaction: 5.6 },
  },
];

export const getOpponent = (id) => OPPONENTS.find((o) => o.id === id) || OPPONENTS[0];
