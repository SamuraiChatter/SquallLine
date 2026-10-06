// Starts the game: reads the keys, steps the rules and paints the result,
// once per frame.

import { tuning } from '../tuning.js';
import { draw, sweepRadar } from './draw.js';
import { drawGarage } from './garage.js';
import { loadMap } from './map.js';
import { drawAbout, drawBriefing, drawDamage, drawDayChoice, drawFinalScore, drawMoney, drawNewGameCheck, drawPause, drawReport, drawSummary, drawTitle, drawTrialNote } from './hud.js';
import { beginChase, buy, dayTuning, toggleAnchor, freePlay, headHome, newRun, newSave, nextDay, readSave, resume, runFinished, saveKey, saveOf, spotters, step, strongest, toggleFilming } from './rules.js';
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
 * The chase days: the tuning file's, each with its storm file's path and
 * tornadoes in place of its own if it names one.
 */
async function loadDays() {
  // A storm being tried out from the design mode is a run of one day. It
  // plays by the footage numbers of the day with tornadoes of its strength.
  const text = trial && sessionStorage.getItem(designKey);
  if (text) {
    const designed = readStorm(text);
    const like = tuning.days[Math.min(strongest(designed.tornadoes), tuning.days.length - 1)];
    return [{ ...like, ...designed }];
  }
  return Promise.all(
    tuning.days.map(async (day) => {
      if (!day.stormFile) return day;
      const response = await fetch(`storms/${day.stormFile}`);
      if (!response.ok) throw new Error(`storms/${day.stormFile} answered ${response.status}`);
      return { ...day, ...readStorm(await response.text()) };
    }),
  );
}
// The numbers the whole run plays by.
const run = { ...tuning, days: await loadDays().catch(sayAndStop('A storm file did not load. Check its name in tuning.js.')) };

// What is kept between visits. A browser that blocks storage throws when it
// is touched: the game still plays, and says progress will not be saved.
let canSave = true;
let saved = newSave(run);
try {
  saved = readSave(localStorage.getItem(saveKey), run) ?? saved;
} catch {
  canSave = false;
}

/** @param {import('./rules.js').Save} save */
function keep(save) {
  saved = save;
  try {
    localStorage.setItem(saveKey, JSON.stringify(save));
  } catch {
    canSave = false;
  }
}

// Which screen is up: the title screen and the ones it leads to, or the game.
// A storm being tried out from the design mode goes straight to the game.
/** @type {'title' | 'about' | 'new game' | 'free play' | 'game'} */
let screen = trial ? 'game' : 'title';

/**
 * Puts a day on the screen, from its briefing.
 * @param {import('./rules.js').GameState} day
 */
function play(day) {
  state = day;
  game = dayTuning(run, state.day, state.parts);
  chosen = 0;
  strikesSeen = 0;
  wholeTerritory = false;
  paused = false;
  held.clear();
  screen = 'game';
}

/**
 * A key pressed on the title screen or one of the screens it leads to.
 * @param {string} key
 */
function menuKey(key) {
  const back = key === 'escape' || key === 'enter';
  if (screen === 'about') {
    if (back) screen = 'title';
  } else if (screen === 'new game') {
    // Starting again wipes the run and keeps the best final balance.
    if (key === 'y') {
      keep(newSave(run, saved.best));
      play(resume(saved, run, map.roads));
    } else if (key === 'n' || back) screen = 'title';
  } else if (screen === 'free play') {
    const day = Number(key);
    if (day >= 1 && day <= run.days.length) play(freePlay(saved, day, run, map.roads));
    else if (back) screen = 'title';
  } else if (key === 'c' && saved.day > 1 && !runFinished(saved, run)) {
    play(resume(saved, run, map.roads));
  } else if (key === 'f' && runFinished(saved, run)) {
    screen = 'free play';
  } else if (key === 'n') {
    // With nothing to lose there is nothing to ask.
    if (saved.day > 1) screen = 'new game';
    else play(resume(saved, run, map.roads));
  } else if (key === 'a') {
    screen = 'about';
  }
}

// The arrow keys being held down right now.
/** @type {Set<string>} */
const held = new Set();
// Z flips between following the car and showing the whole territory.
let wholeTerritory = false;
// True while the pause screen is up. Nothing moves until it goes.
let paused = false;
// Which part is picked out in the garage, counting from 0.
let chosen = 0;

addEventListener('keydown', (event) => {
  // Leave browser shortcuts such as Alt+Left (go back) alone.
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  // Space and the arrows belong to the game, on every screen: do not let them
  // scroll the page.
  if (event.key === ' ' || event.key.startsWith('Arrow')) event.preventDefault();
  const key = event.key.toLowerCase();
  if (trial && key === 'd') location.href = 'design.html';
  if (screen !== 'game') {
    if (!event.repeat) menuKey(key);
    return;
  }
  // P pauses and carries on. While paused, H heads home and ends the day.
  // A key held down repeats; act only on the first press.
  if (key === 'p' && !event.repeat && !state.briefing && !state.dayOver) paused = !paused;
  if (key === 'h' && paused) {
    state = headHome(state, game);
    paused = false;
  }
  // In the garage, up and down choose a part and B buys it. Each purchase is
  // saved at once.
  if (state.garage) {
    if (key === 'arrowup') chosen = Math.max(0, chosen - 1);
    if (key === 'arrowdown') chosen = Math.min(run.parts.length - 1, chosen + 1);
    if (key === 'b' && !event.repeat) {
      state = buy(state, run.parts[chosen].id, run);
      keep(saveOf(state, run));
    }
  }
  // Enter moves on from the briefing, the day summary and the final score.
  // In the middle of a chase it does nothing.
  if (key === 'enter' && !event.repeat && (state.briefing || state.dayOver)) {
    if (state.briefing) state = beginChase(state);
    // A storm being tried out starts over, with no briefing.
    else if (trial) play(beginChase(newRun(run, map.roads)));
    // A finished run and a free play day both end back at the title screen.
    else if (state.finished || state.freePlay) screen = 'title';
    else play(nextDay(state, run, map.roads));
  }
  if (paused || state.briefing || state.dayOver) return;

  if (key === 'z' && !event.repeat && !state.filming) wholeTerritory = !wholeTerritory;
  // A drops the skirts and spikes while parked, and A again pulls them up.
  if (key === 'a' && !event.repeat) state = toggleAnchor(state, game);
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

// Behind the title screen sits the day the player would carry on with.
let state = trial ? beginChase(newRun(run, map.roads)) : resume(runFinished(saved, run) ? newSave(run) : saved, run, map.roads);
// The numbers today plays by.
let game = dayTuning(run, state.day, state.parts);
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
  if (!paused) state = spotters(step(state, steering, dt, game, map.roads), dt, game, map.places);
  // Progress is saved as soon as a day is over. Trying out a storm and free
  // play never change it.
  if (state.dayOver && !trial && !state.freePlay && saved.day !== state.day + 1) keep(saveOf(state, run));
  // Remember when debris last hit, so the screen can flash for a moment.
  if (state.debrisStrikes > strikesSeen) {
    strikesSeen = state.debrisStrikes;
    struckAt = now;
  }
  sweepRadar(state, game);
  // The briefing sits over the whole territory, with the storm coming in.
  if (state.filming) drawWindshield(ctx, state, game);
  else draw(ctx, state, wholeTerritory || state.briefing, map, game);
  drawMoney(ctx, state);
  drawDamage(ctx, state, now - struckAt < 180, game);
  drawReport(ctx, state);
  if (trial) drawTrialNote(ctx);
  if (screen === 'title') drawTitle(ctx, saved, run.days.length, canSave);
  else if (screen === 'about') drawAbout(ctx);
  else if (screen === 'new game') drawNewGameCheck(ctx);
  else if (screen === 'free play') drawDayChoice(ctx, run.days.length);
  else if (state.briefing) drawBriefing(ctx, state, game, run.days.length);
  else if (state.finished) drawFinalScore(ctx, state);
  else if (state.garage) drawGarage(ctx, state, run, chosen);
  else if (state.dayOver) drawSummary(ctx, state, trial);
  else if (paused) drawPause(ctx);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
