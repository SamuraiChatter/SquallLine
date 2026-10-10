// Starts the game: reads the keys, taps and clicks, steps the rules and
// paints the result, once per frame.

import { tuning } from '../tuning.js';
import { draw, sweepRadar } from './draw.js';
import { drawGarage } from './garage.js';
import { loadMap } from './map.js';
import { silence, soundMix } from './mix.js';
import { drawAbout, drawBriefing, drawDamage, drawDayChoice, drawFinalScore, drawMoney, drawNewGameCheck, drawPause, drawReport, drawSummary, drawTitle, drawTrialNote } from './hud.js';
import { onButton, restStick, showControls, stickNow } from './controls.js';
import { junctionAhead } from './roads.js';
import { beginChase, buy, canAnchor, dayTuning, toggleAnchor, freePlay, headHome, newRun, newSave, nextDay, readSave, resume, runFinished, saveKey, saveOf, spotters, step, strongest, toggleFilming, toggleRadarView } from './rules.js';
import { beep, beginSound, isMuted, setSound, thud, toggleMute } from './sound.js';
import { designKey, readStorm } from './storms.js';
import { chaseButtons, fontAtLeast, input, mustTurn, pictureSpot, smallestWords, targetAt, targets } from './taps.js';
import { drawWindshield } from './windshield.js';

const canvas = /** @type {HTMLCanvasElement} */ (document.querySelector('canvas'));
const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));

document.title = tuning.title;

// On a small screen the picture is shrunk to fit, and its small print with
// it. Every font the painting code asks for goes through here, and one that
// would come out too small to read is raised: see `smallestTextPixels` in
// tuning.js. On a computer or an iPad nothing is small enough to change.
const fontOf = /** @type {PropertyDescriptor} */ (Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'font'));
let smallest = 0;
Object.defineProperty(ctx, 'font', {
  get: () => fontOf.get?.call(ctx),
  set: (font) => fontOf.set?.call(ctx, fontAtLeast(font, smallest)),
});
/** Works out the smallest words for the window as it is now. */
function fit() {
  smallest = smallestWords(tuning.smallestTextPixels, { width: canvas.clientWidth, height: canvas.clientHeight }, canvas);
}
fit();
addEventListener('resize', fit);

// Covers the game while a touch screen is held upright.
const turn = /** @type {HTMLElement} */ (document.querySelector('.turn'));
turn.textContent = tuning.touch.turnWords;

/**
 * Says on the screen that something did not load, and why: otherwise the
 * game is just black.
 * @param {string} words
 * @returns {(error: unknown) => never}
 */
const sayAndStop = (words) => (error) => {
  ctx.fillStyle = '#dce6ee';
  ctx.font = '48px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(words, canvas.width / 2, canvas.height / 2);
  ctx.font = '36px system-ui, sans-serif';
  if (error instanceof Error) ctx.fillText(error.message, canvas.width / 2, canvas.height / 2 + 70, canvas.width * 0.9);
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
      const text = await response.text();
      try {
        return { ...day, ...readStorm(text) };
      } catch (error) {
        // Name the file, so the creative lead knows which one to open.
        throw new Error(`storms/${day.stormFile}: ${error instanceof Error ? error.message : error}`);
      }
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
  counting = false;
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

/**
 * A key pressed, or a choice tapped or clicked that stands for that key.
 * @param {string} key The key, in small letters.
 * @param {boolean} [repeat] True when the key is being held down and this is
 *   not its first press.
 * @returns {boolean} True while there is a chase to drive or film, so the
 *   arrows steer.
 */
function press(key, repeat = false) {
  if (trial && key === 'd') location.href = 'design.html';
  // M switches the sound off and on, on every screen.
  if (key === 'm' && !repeat) toggleMute();
  if (screen !== 'game') {
    if (!repeat) menuKey(key);
    return false;
  }
  // P pauses and carries on. While paused, H heads home and ends the day.
  // A key held down repeats; act only on the first press.
  if (key === 'p' && !repeat && !state.briefing && !state.dayOver) paused = !paused;
  if (key === 'h' && paused) {
    state = headHome(state, game);
    paused = false;
  }
  // In the garage, up and down choose a part and B buys it. Each purchase is
  // saved at once.
  if (state.garage) {
    if (key === 'arrowup') chosen = Math.max(0, chosen - 1);
    if (key === 'arrowdown') chosen = Math.min(run.parts.length - 1, chosen + 1);
    if (key === 'b' && !repeat) {
      state = buy(state, run.parts[chosen].id, run);
      keep(saveOf(state, run));
    }
  }
  // Enter moves on from the briefing, the day summary and the final score.
  // In the middle of a chase it does nothing.
  if (key === 'enter' && !repeat && (state.briefing || state.dayOver)) {
    if (state.briefing) state = beginChase(state);
    // A storm being tried out starts over, with no briefing.
    else if (trial) play(beginChase(newRun(run, map.roads)));
    // A finished run and a free play day both end back at the title screen.
    else if (state.finished || state.freePlay) screen = 'title';
    else play(nextDay(state, run, map.roads));
  }
  if (paused || state.briefing || state.dayOver) return false;

  if (key === 'z' && !repeat && !state.filming) wholeTerritory = !wholeTerritory;
  // V switches the radar between the rain and the wind, in both views.
  if (key === 'v' && !repeat) state = toggleRadarView(state);
  // A drops the skirts and spikes while parked, and A again pulls them up.
  if (key === 'a' && !repeat) state = toggleAnchor(state, game);
  // Space pulls over to film, and Space again drives on.
  if (key === ' ' && !repeat) {
    state = toggleFilming(state);
    // An arrow still held from driving must not swing the camera, nor one
    // held from panning drive the car off. The same goes for the joystick.
    held.clear();
    restStick();
  }
  return true;
}

addEventListener('keydown', (event) => {
  // Leave browser shortcuts such as Alt+Left (go back) alone.
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  // Space and the arrows belong to the game, on every screen: do not let them
  // scroll the page.
  if (event.key === ' ' || event.key.startsWith('Arrow')) event.preventDefault();
  // A keyboard player is told the keys again, and loses the touch controls.
  useTouch(false);
  // Browsers let sound start only from a key press or a tap.
  beginSound();
  if (press(event.key.toLowerCase(), event.repeat) && event.key.startsWith('Arrow')) held.add(event.key);
});
addEventListener('keyup', (event) => held.delete(event.key));
// A key let go while another window is in front never reports back.
addEventListener('blur', () => held.clear());

/**
 * What a tap or click at a spot on the page does: see `targetAt`.
 * @param {MouseEvent} event
 */
const tapped = (event) => targetAt(targets, pictureSpot({ x: event.clientX, y: event.clientY }, canvas.getBoundingClientRect(), canvas, input.touch));

/**
 * Says how the player is playing: with a finger, or with the keys. The page
 * moves the picture up for a finger: see style.css.
 * @param {boolean} touch
 */
function useTouch(touch) {
  input.touch = touch;
  document.body.classList.toggle('touch', touch);
}

// A tablet or phone starts out as touch, so nothing moves at the first tap.
useTouch(matchMedia('(pointer: coarse)').matches);
// A finger on the screen means there may be no keyboard: the choices stop
// naming keys, and a chase gets its touch controls. A mouse changes nothing.
addEventListener('pointerdown', (event) => {
  if (event.pointerType !== 'mouse') useTouch(true);
  beginSound();
});
// A finger counts as a tap, for starting sound, only as it lifts.
addEventListener('pointerup', () => {
  beginSound();
});
// A touch button does what its key does.
onButton(press);
// A long press must not bring up the browser's menu in the middle of a chase.
addEventListener('contextmenu', (event) => {
  if (input.touch) event.preventDefault();
});
// A tap or click on a choice does what its key does. A part in the garage is
// picked out, never bought, by a tap on its row. It acts as the finger lands,
// before a first touch moves the picture up from under it.
canvas.addEventListener('pointerdown', (event) => {
  // Only a finger or the main mouse button: a right-click chooses nothing.
  if (event.button !== 0) return;
  const action = tapped(event);
  if (action.startsWith('part:')) chosen = Number(action.slice(5));
  else if (action) press(action);
});
// The mouse shows a hand over anything that can be clicked.
canvas.addEventListener('pointermove', (event) => {
  canvas.style.cursor = tapped(event) ? 'pointer' : '';
});

/** @param {string} key */
const pressed = (key) => (held.has(key) ? 1 : 0);

// Behind the title screen sits the day the player would carry on with.
let state = trial ? beginChase(newRun(run, map.roads)) : resume(runFinished(saved, run) ? newSave(run) : saved, run, map.roads);
// The numbers today plays by.
let game = dayTuning(run, state.day, state.parts);
// How many debris strikes have been shown, and when the last one landed.
let strikesSeen = 0;
let struckAt = -Infinity;
// True while footage was counting at the last frame, so the camera can beep
// when that changes.
let counting = false;
let last = performance.now();

/** @param {number} now */
function frame(now) {
  // A tab left in the background comes back with a huge gap; cap it so the
  // car does not leap. The very first frame can report a time just before
  // `last`, so never go below zero either.
  const dt = Math.max(0, Math.min((now - last) / 1000, 0.1));
  last = now;
  // Each frame paints its own choices.
  targets.length = 0;

  // A touch screen held upright shows only the message to turn it, and the
  // game waits behind it.
  const turned = mustTurn(input.touch, innerWidth, innerHeight);
  turn.hidden = !turned;
  // The touch controls are up while there is a chase to drive or film.
  showControls(input.touch && !turned && screen === 'game' && !paused && !state.briefing && !state.dayOver, chaseButtons(state, canAnchor(state, game), run.touch.names));
  // The joystick steers when a thumb is on it, and the arrows when not.
  const stick = stickNow();
  const steering =
    stick.x || stick.y
      ? stick
      : {
          x: pressed('ArrowRight') - pressed('ArrowLeft'),
          y: pressed('ArrowUp') - pressed('ArrowDown'),
        };
  if (!paused && !turned) state = spotters(step(state, steering, dt, game, map.roads), dt, game, map.places);
  // Progress is saved as soon as a day is over. Trying out a storm and free
  // play never change it.
  if (state.dayOver && !trial && !state.freePlay && saved.day !== state.day + 1) keep(saveOf(state, run));
  // Remember when debris last hit, so the screen can flash for a moment.
  if (state.debrisStrikes > strikesSeen) {
    strikesSeen = state.debrisStrikes;
    struckAt = now;
    thud();
  }
  // The wind and hail are heard only while the chase is moving.
  const mix = screen === 'game' && !paused && !turned ? soundMix(state, game, run.sound) : silence;
  setSound(mix);
  // The camera beeps as footage starts and stops counting. A pause, or the
  // end of the day, is not the tornado leaving the viewfinder.
  if (mix !== silence && mix.counting !== counting) {
    counting = mix.counting;
    beep(counting);
  }
  sweepRadar(state, game);
  // The briefing sits over the whole territory, with the storm coming in.
  if (state.filming) drawWindshield(ctx, state, game);
  else {
    // The next junction ahead, while there is a chase to drive. A car with
    // off-road tires does not keep to the roads, so it has none.
    const ahead = state.briefing || state.dayOver || game.offRoad ? null : junctionAhead(map.roads, state.road, steering);
    draw(ctx, state, wholeTerritory || state.briefing, map, game, ahead);
  }
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
  else if (paused) drawPause(ctx, isMuted());
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
