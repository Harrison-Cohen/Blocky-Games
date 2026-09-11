import './ui/styles.css';
import { Game } from './core/Game.js';

const canvas = document.getElementById('view');
const uiRoot = document.getElementById('ui');

const game = new Game({ canvas, uiRoot });

// Controls card on first launch, as the spec asks. Any key or click starts.
const card = uiRoot.querySelector('.controls-card');
card.hidden = false;
game.paused = true;
const dismiss = (e) => {
  if (e.type === 'keydown' && e.code === 'Escape') return;
  // Setting the volume on the card is not a request to start driving.
  if (e.target && e.target.closest && e.target.closest('.volume-row')) return;
  game.dismissControls();
  window.removeEventListener('keydown', dismiss);
  window.removeEventListener('pointerdown', dismiss);
};
window.addEventListener('keydown', dismiss);
window.addEventListener('pointerdown', dismiss);

game.start();

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
