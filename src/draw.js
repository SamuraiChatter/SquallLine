// Drawing. Everything that paints on the canvas lives here.

import { tuning } from '../tuning.js';

/**
 * Paints the title screen.
 * @param {CanvasRenderingContext2D} ctx
 */
export function draw(ctx) {
  const { width, height } = ctx.canvas;

  ctx.fillStyle = '#0b1118';
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = '#dce6ee';
  ctx.font = `bold ${height / 6}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // The last number squeezes a long title so it still fits on the screen.
  ctx.fillText(tuning.title, width / 2, height / 2, width * 0.9);
}
