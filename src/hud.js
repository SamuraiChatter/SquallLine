// What is written over both views: the money earned, the damage meter, the
// pause screen and the end-of-day summary. Also the screens around the game:
// the title screen, the briefing and the final score.

import { tuning } from '../tuning.js';
import { dangerRingMiles, inDebrisZone, inHailCore, milesToFunnel, strongest } from './rules.js';
import { choiceWords, input, targets } from './taps.js';

/** @param {number} amount */
const dollars = (amount) => `$${Math.round(amount).toLocaleString('en-US')}`;

/**
 * Paints the money earned today in the top left corner.
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('./rules.js').GameState} state
 */
export function drawMoney(ctx, state) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#9be28c';
  ctx.font = 'bold 54px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(dollars(state.money), ctx.canvas.width * 0.05, ctx.canvas.height * 0.035);
  // The roof wind gauge's reading, once it has one.
  if (state.topWind > 0) {
    ctx.fillStyle = '#dce6ee';
    ctx.font = '30px system-ui, sans-serif';
    ctx.fillText(`Top wind: ${Math.round(state.topWind)} mph`, ctx.canvas.width * 0.05, ctx.canvas.height * 0.095);
  }
}

/**
 * Says, in the bottom left corner, that this is a storm being tried out from
 * the design mode.
 * @param {CanvasRenderingContext2D} ctx
 */
export function drawTrialNote(ctx) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#dce6ee';
  ctx.font = '30px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText('Trying your storm. Press D to go back to the design.', ctx.canvas.width * 0.05, ctx.canvas.height * 0.97);
}

/**
 * Paints the damage meter along the top, in the middle.
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('./rules.js').GameState} state
 * @param {boolean} struck True for a moment after debris hits the car.
 * @param {import('./rules.js').Tuning} day The numbers today plays by.
 */
export function drawDamage(ctx, state, struck, day) {
  const { width, height } = ctx.canvas;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  // A debris strike flashes the whole screen.
  if (struck) {
    ctx.fillStyle = 'rgba(255, 140, 60, 0.3)';
    ctx.fillRect(0, 0, width, height);
  }
  const wide = width * 0.25;
  const left = (width - wide) / 2;
  const top = height * 0.045;
  ctx.fillStyle = 'rgba(5, 8, 12, 0.7)';
  ctx.fillRect(left, top, wide, 36);
  ctx.fillStyle = '#ff4d4d';
  ctx.fillRect(left, top, wide * Math.min(1, state.damage), 36);
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#dce6ee';
  ctx.strokeRect(left, top, wide, 36);
  // A dark edge round the letters keeps them readable over the red.
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#05080c';
  ctx.strokeText('DAMAGE', width / 2, top + 19);
  ctx.fillStyle = '#dce6ee';
  ctx.fillText('DAMAGE', width / 2, top + 19);

  // A warning on both views, naming the worst thing hitting the car.
  const miles = milesToFunnel(state);
  const tornado = state.storm.tornado > 0;
  let warning = '';
  if (inHailCore(state.car, state.storm, day)) warning = 'HAIL! It is damaging the car.';
  if (tornado && miles < dangerRingMiles(state, day)) warning = 'TOO CLOSE! The wind is damaging the car.';
  if (inDebrisZone(state, day)) warning = 'DEBRIS! Get out of here.';
  if (warning) {
    ctx.fillStyle = '#ff4d4d';
    ctx.font = 'bold 40px system-ui, sans-serif';
    ctx.fillText(warning, width / 2, top + 70);
  }
}

/**
 * Writes the spotters' newest report along the bottom of both views, for a
 * few seconds after it comes in.
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('./rules.js').GameState} state
 */
export function drawReport(ctx, state) {
  const newest = state.reports.at(-1);
  if (!newest || newest.age >= tuning.spotters.wordsSeconds || state.dayOver) return;
  const { width, height } = ctx.canvas;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.font = '40px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const wide = ctx.measureText(newest.words).width + 60;
  ctx.fillStyle = 'rgba(11, 17, 24, 0.85)';
  ctx.fillRect((width - wide) / 2, height * 0.84 - 34, wide, 68);
  ctx.fillStyle = '#ff8f6b';
  ctx.fillText(newest.words, width / 2, height * 0.84);
}

/**
 * Paints a choice in a box with its middle on a spot, and makes the box
 * something to tap or click.
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('./taps.js').Choice} choice
 * @param {number} x
 * @param {number} y
 * @param {boolean} [open] False for a choice that cannot be made right now:
 *   it is painted dim, and a tap on it does nothing.
 * @param {number} [widest] The widest the box can be. Longer words are
 *   squeezed to fit.
 */
export function drawChoice(ctx, choice, x, y, open = true, widest = ctx.canvas.width * 0.9) {
  const { tall, narrowest } = tuning.choices;
  const words = choiceWords(choice, input.touch);
  ctx.font = '54px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const wide = Math.max(narrowest, Math.min(ctx.measureText(words).width + 80, widest));
  const left = x - wide / 2;
  const top = y - tall / 2;
  ctx.fillStyle = '#1c2a38';
  ctx.fillRect(left, top, wide, tall);
  ctx.lineWidth = 3;
  ctx.strokeStyle = open ? '#dce6ee' : '#5b6875';
  ctx.strokeRect(left, top, wide, tall);
  ctx.fillStyle = ctx.strokeStyle;
  ctx.fillText(words, x, y, wide - 80);
  if (open) targets.push({ action: choice.key, left, top, wide, tall });
}

/**
 * How far down the screen a line of a screen's text sits, counting from 0.
 * @param {number} height The picture's height.
 * @param {number} i
 */
const lineY = (height, i) => height * 0.22 + i * 110;

/**
 * Dims the screen and writes lines of text in the middle, the first one big.
 * A line that is a choice is painted in a box that can be tapped.
 * @param {CanvasRenderingContext2D} ctx
 * @param {(string | import('./taps.js').Choice)[]} lines
 */
function drawScreen(ctx, lines) {
  const { width, height } = ctx.canvas;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = 'rgba(5, 8, 12, 0.8)';
  ctx.fillRect(0, 0, width, height);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  lines.forEach((line, i) => {
    if (typeof line !== 'string') {
      drawChoice(ctx, line, width / 2, lineY(height, i));
      return;
    }
    ctx.fillStyle = '#dce6ee';
    ctx.font = i === 0 ? 'bold 120px system-ui, sans-serif' : '54px system-ui, sans-serif';
    ctx.fillText(line, width / 2, lineY(height, i), width * 0.9);
  });
}

/**
 * Paints the pause screen.
 * @param {CanvasRenderingContext2D} ctx
 */
export function drawPause(ctx) {
  drawScreen(ctx, ['Paused', 'P: carry on', 'H: head home and end the day']);
}

/**
 * Paints the title screen.
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('./rules.js').Save} save
 * @param {number} days How many days there are.
 * @param {boolean} canSave False when the browser will not keep progress.
 */
export function drawTitle(ctx, save, days, canSave) {
  const finished = save.day > days;
  drawScreen(ctx, [
    tuning.title,
    `by ${tuning.studio}`,
    ...(finished ? [{ key: 'f', words: `free play (final score ${dollars(save.balance)})` }] : []),
    ...(!finished && save.day > 1 ? [{ key: 'c', words: `continue (day ${save.day}, ${dollars(save.balance)})` }] : []),
    { key: 'n', words: 'new game' },
    { key: 'a', words: 'about' },
    ...(save.best > 0 ? [`Best final score: ${dollars(save.best)}`] : []),
    ...(canSave ? [] : ['Progress will not be saved in this window.']),
  ]);
}

/**
 * Paints the about screen, with the credits.
 * @param {CanvasRenderingContext2D} ctx
 */
export function drawAbout(ctx) {
  drawScreen(ctx, ['About', `${tuning.title} is made by ${tuning.studio}.`, 'Map data © OpenStreetMap contributors.', 'The link is in the corner of the page.', { key: 'enter', words: 'back' }]);
}

/**
 * Asks before a new game wipes the run.
 * @param {CanvasRenderingContext2D} ctx
 */
export function drawNewGameCheck(ctx) {
  drawScreen(ctx, ['New game?', 'This run will be wiped.', 'The best final score is kept.', { key: 'y', words: 'start again' }, { key: 'n', words: 'go back' }]);
}

/**
 * Asks which day to replay in free play, with a numbered tile for each day.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} days How many days there are.
 */
export function drawDayChoice(ctx, days) {
  const { width, height } = ctx.canvas;
  const { dayTile, dayGap } = tuning.choices;
  // The third line is left empty for the row of tiles.
  drawScreen(ctx, ['Free play', input.touch ? 'Pick a day.' : `Press 1 to ${days} to pick a day.`, '', 'Free play never changes the final score.', { key: 'enter', words: 'back' }]);
  const first = (width - days * dayTile - (days - 1) * dayGap) / 2;
  const top = lineY(height, 2) - dayTile / 2;
  ctx.font = 'bold 72px system-ui, sans-serif';
  ctx.lineWidth = 3;
  for (let day = 1; day <= days; day++) {
    const left = first + (day - 1) * (dayTile + dayGap);
    ctx.fillStyle = '#1c2a38';
    ctx.fillRect(left, top, dayTile, dayTile);
    ctx.strokeStyle = '#dce6ee';
    ctx.strokeRect(left, top, dayTile, dayTile);
    ctx.fillStyle = '#dce6ee';
    ctx.fillText(String(day), left + dayTile / 2, top + dayTile / 2);
    targets.push({ action: String(day), left, top, wide: dayTile, tall: dayTile });
  }
}

/**
 * Paints the forecast briefing before a chase.
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('./rules.js').GameState} state
 * @param {import('./rules.js').Tuning} day The numbers today plays by.
 * @param {number} days How many days there are.
 */
export function drawBriefing(ctx, state, day, days) {
  const { ringMiles } = day.footage;
  drawScreen(ctx, [
    state.freePlay ? `Free play: day ${state.day}` : `Day ${state.day} of ${days}`,
    `Forecast: tornadoes up to EF${strongest(day.storm.tornadoes)}`,
    ringMiles > 0 ? `Footage ring: ${ringMiles} ${ringMiles === 1 ? 'mile' : 'miles'}` : 'Footage ring: the tornado itself',
    { key: 'enter', words: 'start the chase' },
  ]);
}

/**
 * Paints the final score, after the last day.
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('./rules.js').GameState} state
 */
export function drawFinalScore(ctx, state) {
  drawScreen(ctx, ['Final score', dollars(state.balance), `Best so far: ${dollars(state.best)}`, { key: 'enter', words: 'back to the title screen' }]);
}

/**
 * Paints the end-of-day summary.
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('./rules.js').GameState} state
 * @param {boolean} trial True for a storm being tried out from the design
 *   mode.
 */
export function drawSummary(ctx, state, trial) {
  drawScreen(ctx, [
    state.wrecked ? 'Wrecked' : 'Day over',
    // Nobody is ever hurt in this game.
    ...(state.wrecked ? ['The crew walked away safe. The car was towed home.'] : []),
    `Footage sold to ${tuning.tvStation}: ${dollars(state.money)}`,
    ...(state.topWind > 0 ? [`Top wind ${Math.round(state.topWind)} mph. Science bonus: ${dollars(state.scienceBonus)}`] : []),
    ...(state.repairBill > 0 ? [`Repair bill: ${dollars(state.repairBill)}`] : []),
    // Free play leaves the balance, which is the final score, alone.
    state.freePlay ? `Free play: the final score stays ${dollars(state.balance)}` : `Balance: ${dollars(state.balance)}`,
    { key: 'enter', words: trial ? 'try the storm again' : state.freePlay ? 'back to the title screen' : 'carry on' },
  ]);
}
