// The controls chart: one row per action, with its keyboard keys and its gamepad
// button side by side. ui/ControlsChart.js draws it. A key is [label, code]: the
// label is what is printed on the key cap and the code is the KeyboardEvent.code
// the input layer listens for, so `npm run controls` can check that every key in
// the chart really is bound in src/core/Input.js (driving) or FlightInput.js
// (flying). A code of null is a mouse or pad action there is nothing to check.
//
// When a binding changes in the input code, change its row here too: the check
// fails when a key is in the chart and not in the code.

const K = (label, code) => [label, code];

export const CONTROLS = {
  driving: {
    title: 'Driving',
    source: 'core/Input.js',
    rows: [
      { action: 'Throttle', keys: [K('W', 'KeyW'), K('Up', 'ArrowUp')], pad: 'Right trigger' },
      { action: 'Brake, and reverse from a stop', keys: [K('S', 'KeyS'), K('Down', 'ArrowDown')], pad: 'Left trigger' },
      { action: 'Steer', keys: [K('A', 'KeyA'), K('D', 'KeyD'), K('Left', 'ArrowLeft'), K('Right', 'ArrowRight')], pad: 'Left stick' },
      { action: 'Handbrake', keys: [K('Space', 'Space')], pad: 'A' },
      { action: 'Reset to the last checkpoint', keys: [K('R', 'KeyR')], pad: 'Y' },
      { action: 'Camera', keys: [K('C', 'KeyC')], pad: 'X' },
      { action: 'Pause', keys: [K('Esc', 'Escape')], pad: 'Start' },
      { action: 'Session results', keys: [K('Tab', 'Tab')], pad: 'Select' },
      { action: 'Garage', keys: [K('G', 'KeyG')], pad: 'B' },
      { action: 'Ghost car', keys: [K('H', 'KeyH')], pad: 'D-pad up' },
      { action: 'Auto drive', keys: [K('P', 'KeyP')], pad: null },
      { action: 'Track select, race or drag race', keys: [K('N', 'KeyN')], pad: null },
      { action: 'Manual gearbox on or off', keys: [K('B', 'KeyB')], pad: 'D-pad right' },
      { action: 'Shift up, shift down (manual)', keys: [K('Right', 'ArrowRight'), K('Left', 'ArrowLeft')],
        note: 'D A on arrows', pad: 'RB, LB' },
      { action: 'Neutral (manual)', keys: [K('X', 'KeyX')], pad: 'D-pad down' },
      { action: 'Mute', keys: [K('M', 'KeyM')], pad: null },
    ],
    // Smaller shortcuts, and the two player drag keys, under the chart.
    extra: [
      ['V', 'KeyV', 'next car'], ['T', 'KeyT', 'next track'], ['O', 'KeyO', 'pace car'], ['`', 'Backquote', 'telemetry'],
      ['E', 'KeyE', 'player 1 shift up'], ['Q', 'KeyQ', 'player 1 shift down'],
      ['/', 'Slash', 'player 2 up'], ['.', 'Period', 'player 2 down'], [',', 'Comma', 'player 2 neutral'],
    ],
  },
  flying: {
    title: 'Flying',
    source: 'core/FlightInput.js',
    rows: [
      { action: 'Pitch (up pushes the nose down)', keys: [K('Up', 'ArrowUp'), K('Down', 'ArrowDown')], pad: 'Left stick' },
      { action: 'Roll', keys: [K('Left', 'ArrowLeft'), K('Right', 'ArrowRight')], pad: 'Left stick' },
      { action: 'Rudder, and nose wheel steering', keys: [K('A', 'KeyA'), K('D', 'KeyD')], pad: 'Right stick X' },
      { action: 'Throttle lever', keys: [K('W', 'KeyW'), K('S', 'KeyS')], pad: 'Right stick Y' },
      { action: 'Afterburner (held)', keys: [K('Shift', 'ShiftLeft')], pad: 'A (held)' },
      { action: 'Landing gear', keys: [K('G', 'KeyG')], pad: 'X' },
      { action: 'Airbrake or spoilers (toggle)', keys: [K('V', 'KeyV')], pad: 'B' },
      { action: 'Wheel brake (held)', keys: [K('B', 'KeyB')], pad: 'Left trigger' },
      { action: 'Flaps up, flaps down', keys: [K('Z', 'KeyZ'), K('X', 'KeyX')], pad: 'D-pad left, right' },
      { action: 'Autopilot: off, hold, route', keys: [K('P', 'KeyP')], pad: 'D-pad down' },
      { action: 'Camera', keys: [K('C', 'KeyC')], pad: 'Y' },
      { action: 'Look around', keys: [K('Right mouse drag', null)], pad: 'R3 and right stick' },
      { action: 'External HUD on or off', keys: [K('U', 'KeyU')], pad: 'L3' },
      { action: 'Map', keys: [K('M', 'KeyM')], pad: 'Back (tap)' },
      { action: 'Mute', keys: [K('N', 'KeyN')], pad: 'Back (held), then B' },
      { action: 'Mouse flight on or off', keys: [K('T', 'KeyT')], pad: null },
      { action: 'Back to the hangar (held 1 s)', keys: [K('R', 'KeyR')], pad: 'Back (held), then A' },
      { action: 'Enter the hangar when offered', keys: [K('Enter', 'Enter')], pad: 'A' },
      { action: 'Pause', keys: [K('Esc', 'Escape')], pad: 'Start' },
    ],
    extra: [['`', 'Backquote', 'telemetry']],
    foot: 'Mouse flight (T): the mouse moves pitch and roll, the wheel is the throttle and the middle button looks round. On the ground a low throttle lever holds a taxi speed and brakes for you (0.1 is a walk, 0.25 a jog); stop near a hangar and press Enter. Airport buildings are solid. Weapons and targets (Space, F, Q, E; the triggers, bumpers and D-pad up) arrive with milestone 7.',
  },
};

// One line for the loading panel: a real binding from the chart above, a different
// one each time, so a tip can never name a key that does nothing.
let tipAt = 0;
export function controlTip(kind) {
  const rows = CONTROLS[kind].rows.filter((r) => r.keys.length <= 2 && r.action.length <= 34 && !/[,:(]/.test(r.action) && r.keys[0][1]);
  const r = rows[tipAt++ % rows.length];
  return `Tip: ${r.keys.map((k) => k[0]).join(' or ')}, ${r.action.charAt(0).toLowerCase()}${r.action.slice(1)}`;
}
