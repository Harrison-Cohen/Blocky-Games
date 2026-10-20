import './ui/styles.css';
import { Game } from './core/Game.js';

const canvas = document.getElementById('view');
const uiRoot = document.getElementById('ui');

// The game opens on its title screen, and on the very first launch shows
// the controls beside it (Game.showTitle).
const game = new Game({ canvas, uiRoot });

game.start();

// Flying is a second game on the same canvas. It is built the first time the
// title's Fly row is chosen, so the car game loads and starts exactly as before.
let flight = null;
game.onFly = async () => {
  if (!flight) {
    const { FlightGame } = await import('./core/FlightGame.js');
    flight = new FlightGame(game);
    if (import.meta.env.DEV) window.flight = flight;
  }
  flight.enter();
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
