// Starts the game: reads the keys, steps the rules and paints the result,
// once per frame.

import { tuning } from '../tuning.js';
import { draw } from './draw.js';
import { loadMap } from './map.js';
import { drawDamage, drawMoney, drawPause, drawSummary, drawTrialNote } from './hud.js';
import { headHome, newGame, step, toggleFilming } from './rules.js';
import { designKey, readStorm } from './storms.js';
import { drawWindshield } from './windshield.js';

const canvas = /** @type {HTMLCanvasElement} */ (document.querySelector('canvas'));
const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));

document.title = tuning.title;

/**
 * Says on the screen that something did not load: otherwise the game is just
 * black.
 * @param {string} words
 * @returns {(error: unknown) => never}
 */
const sayAndStop = (words) => (error) => {
  ctx.fillStyle = '#dce6ee';
  ctx.font = '48px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(words, canvas.width / 2, canvas.height / 2);
  throw error;
};

// The game waits here until the map has arrived.
const map = await loadMap().catch(sayAndStop('The map did not load. Try refreshing the page.'));

// True when the design mode has sent a storm over to be tried out.
const trial = new URLSearchParams(location.search).has('trial');

/**
 * The day's designed storm, if it has one: the storm being tried out from
 * the design mode, or else the storm file named in the tuning file.
 * @returns {Promise<import('./storms.js').DesignedStorm | null>}
 */
async function loadStorm() {
  if (trial) {
    const text = sessionStorage.getItem(designKey);
    if (text) return readStorm(text);
  }
  if (!tuning.stormFile) return null;
  const response = await fetch(`storms/${tuning.stormFile}`);
  if (!response.ok) throw new Error(`storms/${tuning.stormFile} answered ${response.status}`);
  return readStorm(await response.text());
}
const designed = await loadStorm().catch(sayAndStop('The storm file did not load. Check its name in tuning.js.'));
// The numbers the rules play by: the tuning file's, with the designed storm's
// path and tornadoes in place of its own.
const game = designed ? { ...tuning, storm: { ...tuning.storm, ...designed } } : tuning;

// The arrow keys being held down right now.
/** @type {Set<string>} */
const held = new Set();
// Z flips between following the car and showing the whole territory.
let wholeTerritory = false;
// True while the pause screen is up. Nothing moves until it goes.
let paused = false;

addEventListener('keydown', (event) => {
  // Leave browser shortcuts such as Alt+Left (go back) alone.
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  // Space and the arrows belong to the game, on every screen: do not let them
  // scroll the page.
  if (event.key === ' ' || event.key.startsWith('Arrow')) event.preventDefault();
  const key = event.key.toLowerCase();
  if (trial && key === 'd') location.href = 'design.html';
  // P pauses and carries on. While paused, H heads home and ends the day.
  // A key held down repeats; act only on the first press.
  if (key === 'p' && !event.repeat && !state.dayOver) paused = !paused;
  if (key === 'h' && paused) {
    state = headHome(state, game);
    paused = false;
  }
  if (paused || state.dayOver) return;

  if (key === 'z' && !event.repeat && !state.filming) wholeTerritory = !wholeTerritory;
  // Space pulls over to film, and Space again drives on.
  if (event.key === ' ') {
    if (!event.repeat) {
      state = toggleFilming(state);
      // An arrow still held from driving must not swing the camera, nor one
      // held from panning drive the car off.
      held.clear();
    }
    event.preventDefault();
  }
  if (!event.key.startsWith('Arrow')) return;
  held.add(event.key);
  event.preventDefault();
});
addEventListener('keyup', (event) => held.delete(event.key));
// A key let go while another window is in front never reports back.
addEventListener('blur', () => held.clear());

/** @param {string} key */
const pressed = (key) => (held.has(key) ? 1 : 0);

let state = newGame(game, map.roads);
// How many debris strikes have been shown, and when the last one landed.
let strikesSeen = 0;
let struckAt = -Infinity;
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
  if (!paused) state = step(state, steering, dt, game, map.roads);
  // Remember when debris last hit, so the screen can flash for a moment.
  if (state.debrisStrikes > strikesSeen) {
    strikesSeen = state.debrisStrikes;
    struckAt = now;
  }
  if (state.filming) drawWindshield(ctx, state);
  else draw(ctx, state, wholeTerritory, map);
  drawMoney(ctx, state);
  drawDamage(ctx, state, now - struckAt < 180);
  if (trial) drawTrialNote(ctx);
  if (state.dayOver) drawSummary(ctx, state);
  else if (paused) drawPause(ctx);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
