// What is written over both views: the money earned, the pause screen and
// the end-of-day summary.

import { tuning } from '../tuning.js';

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
    ctx.fillText(line, width / 2, height * 0.3 + i * 110, width * 0.9);
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
    'Day over',
    `Footage sold to ${tuning.tvStation}: ${dollars(state.money)}`,
    `Balance: ${dollars(state.balance)}`,
    'Refresh the page to play again',
  ]);
}
