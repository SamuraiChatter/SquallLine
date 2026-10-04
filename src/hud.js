// What is written over both views: the money earned, the damage meter, the
// pause screen and the end-of-day summary.

import { tuning } from '../tuning.js';
import { milesToFunnel } from './rules.js';

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
}

/**
 * Paints the damage meter along the top, in the middle.
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('./rules.js').GameState} state
 */
export function drawDamage(ctx, state) {
  const { width, height } = ctx.canvas;
  const wide = width * 0.25;
  const left = (width - wide) / 2;
  const top = height * 0.045;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
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

  // A warning on both views while the car is inside the danger ring.
  if (state.storm.tornado > 0 && milesToFunnel(state) < tuning.danger.ringMiles) {
    ctx.fillStyle = '#ff4d4d';
    ctx.font = 'bold 40px system-ui, sans-serif';
    ctx.fillText('TOO CLOSE! The wind is damaging the car.', width / 2, top + 70);
  }
}

/**
 * Dims the screen and writes lines of text in the middle, the first one big.
 * @param {CanvasRenderingContext2D} ctx
 * @param {string[]} lines
 */
function drawScreen(ctx, lines) {
  const { width, height } = ctx.canvas;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = 'rgba(5, 8, 12, 0.8)';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#dce6ee';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  lines.forEach((line, i) => {
    ctx.font = i === 0 ? 'bold 120px system-ui, sans-serif' : '54px system-ui, sans-serif';
    ctx.fillText(line, width / 2, height * 0.22 + i * 110, width * 0.9);
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
 * Paints the end-of-day summary.
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('./rules.js').GameState} state
 */
export function drawSummary(ctx, state) {
  drawScreen(ctx, [
    state.wrecked ? 'Wrecked' : 'Day over',
    // Nobody is ever hurt in this game.
    ...(state.wrecked ? ['The crew walked away safe. The car was towed home.'] : []),
    `Footage sold to ${tuning.tvStation}: ${dollars(state.money)}`,
    ...(state.repairBill > 0 ? [`Repair bill: ${dollars(state.repairBill)}`] : []),
    `Balance: ${dollars(state.balance)}`,
    'Refresh the page to play again',
  ]);
}
