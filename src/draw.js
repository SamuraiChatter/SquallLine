// Drawing. Everything that paints on the canvas lives here.

import { tuning } from '../tuning.js';

/**
 * Paints the game as it is right now: the map around the car, then the car.
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('./rules.js').GameState} state
 */
export function draw(ctx, state) {
  const { width, height } = ctx.canvas;
  const { car } = state;
  const pixelsPerMile = width / tuning.viewMiles;
  const edge = tuning.territoryMiles / 2;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#0b1118';
  ctx.fillRect(0, 0, width, height);

  // From here on, draw in miles with the car in the middle of the screen and
  // north at the top.
  ctx.translate(width / 2, height / 2);
  ctx.scale(pixelsPerMile, -pixelsPerMile);
  ctx.translate(-car.x, -car.y);

  // A faint line every mile, so the driving shows until the real map arrives.
  ctx.beginPath();
  for (let mile = Math.ceil(-edge); mile <= edge; mile++) {
    ctx.moveTo(mile, -edge);
    ctx.lineTo(mile, edge);
    ctx.moveTo(-edge, mile);
    ctx.lineTo(edge, mile);
  }
  ctx.lineWidth = 1 / pixelsPerMile;
  ctx.strokeStyle = '#1c2a36';
  ctx.stroke();

  // The edge of the territory.
  ctx.lineWidth = 4 / pixelsPerMile;
  ctx.strokeStyle = '#5b7488';
  ctx.strokeRect(-edge, -edge, edge * 2, edge * 2);

  // The car.
  ctx.beginPath();
  ctx.arc(car.x, car.y, 14 / pixelsPerMile, 0, Math.PI * 2);
  ctx.fillStyle = '#ffd24a';
  ctx.fill();
}
