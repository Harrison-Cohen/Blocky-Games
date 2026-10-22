import './ui/styles.css';
import { Game } from './core/Game.js';
import { controlTip } from './data/controls.js';

const canvas = document.getElementById('view');
const uiRoot = document.getElementById('ui');

// The game opens on its title screen, and on the very first launch shows
// the controls beside it (Game.showTitle).
const game = new Game({ canvas, uiRoot });

game.start();

// Flying is a second game on the same canvas. It is built the first time the
// title's Fly row is chosen, so the car game loads and starts exactly as before.
// The code is fetched while the title is up and the machine is idle, so the row
// rarely waits on it; building the world is the wait, and the loading panel
// (ui/Loading.js) shows its steps.
let flight = null;
let flightCode = null;
const loadFlightCode = () => (flightCode ||= import('./core/FlightGame.js'));
(window.requestIdleCallback || ((f) => setTimeout(f, 1500)))(() => setTimeout(loadFlightCode, 1000), { timeout: 5000 });

game.onFly = () => {
  const first = !flight;
  return game.work({
    title: 'Fly',
    sub: first ? 'The open world' : `${flight.def.name}, ${flight.places.last.name}`,
    tip: controlTip('flying'),
    steps: [...(first ? ['Loading the flight code', 'Building the aircraft'] : []), 'Building the world', 'Compiling shaders'],
  }, async (job) => {
    if (first) {
      await job.step(0);
      const { FlightGame } = await loadFlightCode();
      await job.step(1);
      flight = new FlightGame(game);
      if (import.meta.env.DEV) window.flight = flight;
      job.sub(`${flight.def.name}, ${flight.places.last.name}`);
    }
    await flight.enterAsync(job, first ? 2 : 0);
  });
};

// Dev only: gives the console a handle on the running game, so the loop can be
// stepped by hand and telemetry inspected without a controller in the way.
// Stripped from production builds.
if (import.meta.env.DEV) window.game = game;

// Editing tuning.js is the main thing I do between drives, so Vite swaps the
// module in without a page reload and the car keeps its position and speed.
// Physics reads the tuning objects live, so nothing needs re-wiring.
if (import.meta.hot) {
  import.meta.hot.accept('./data/tuning.js', () => {});
  import.meta.hot.accept('./data/cars.js', () => {});
}
