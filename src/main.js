// Starts the game: reads the keys, steps the rules and paints the result,
// once per frame.

import { tuning } from '../tuning.js';
import { draw } from './draw.js';
import { newGame, step } from './rules.js';

const canvas = /** @type {HTMLCanvasElement} */ (document.querySelector('canvas'));
const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));

document.title = tuning.title;

// The arrow keys being held down right now.
/** @type {Set<string>} */
const held = new Set();
// Z flips between following the car and showing the whole territory.
let wholeTerritory = false;

addEventListener('keydown', (event) => {
  // Leave browser shortcuts such as Alt+Left (go back) alone.
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  // A key held down repeats; flip the view only on the first press.
  if (event.key.toLowerCase() === 'z' && !event.repeat) wholeTerritory = !wholeTerritory;
  if (!event.key.startsWith('Arrow')) return;
  held.add(event.key);
  event.preventDefault();
});
addEventListener('keyup', (event) => held.delete(event.key));
// A key let go while another window is in front never reports back.
addEventListener('blur', () => held.clear());

/** @param {string} key */
const pressed = (key) => (held.has(key) ? 1 : 0);

let state = newGame(tuning);
let last = performance.now();

/** @param {number} now */
function frame(now) {
  // A tab left in the background comes back with a huge gap; cap it so the
  // car does not leap. The very first frame can report a time just before
  // `last`, so never go below zero either.
  const dt = Math.max(0, Math.min((now - last) / 1000, 0.1));
  last = now;

  const steering = {
    x: pressed('ArrowRight') - pressed('ArrowLeft'),
    y: pressed('ArrowUp') - pressed('ArrowDown'),
  };
  state = step(state, steering, dt, tuning);
  draw(ctx, state, wholeTerritory);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
