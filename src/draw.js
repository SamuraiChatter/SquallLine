// Drawing. Everything that paints on the canvas lives here.

import { tuning } from '../tuning.js';

/**
 * Paints the game as it is right now.
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('./rules.js').GameState} state
 * @param {boolean} wholeTerritory True to show the whole territory, false to
 *   follow the car.
 */
export function draw(ctx, state, wholeTerritory) {
  const { width, height } = ctx.canvas;
  const { car, storm } = state;
  const edge = tuning.territoryMiles / 2;

  // The middle of the view, and how many pixels a mile takes up.
  const middle = wholeTerritory ? { x: 0, y: 0 } : car;
  const pixelsPerMile = wholeTerritory
    ? Math.min(width, height) / (tuning.territoryMiles * 1.05)
    : width / tuning.viewMiles;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#0b1118';
  ctx.fillRect(0, 0, width, height);

  // From here on, draw in miles with north at the top.
  ctx.translate(width / 2, height / 2);
  ctx.scale(pixelsPerMile, -pixelsPerMile);
  ctx.translate(-middle.x, -middle.y);

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

  drawStorm(ctx, storm);

  // The car. It keeps its size on screen in both views.
  ctx.beginPath();
  ctx.arc(car.x, car.y, 14 / pixelsPerMile, 0, Math.PI * 2);
  ctx.fillStyle = '#ffd24a';
  ctx.fill();

  // Back to pixels for the arrow that points at a storm out of view.
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const stormX = width / 2 + (storm.x - middle.x) * pixelsPerMile;
  const stormY = height / 2 - (storm.y - middle.y) * pixelsPerMile;
  // The storm is lopsided: its rain reaches about 9 miles north and east of
  // its middle, and about 5 miles south and west with the hook. It is out of
  // view only when that whole box is off the screen.
  const far = 9 * pixelsPerMile;
  const near = 5 * pixelsPerMile;
  if (stormX + far < 0 || stormX - near > width || stormY + near < 0 || stormY - far > height) {
    const margin = 60;
    ctx.translate(
      Math.max(margin, Math.min(width - margin, stormX)),
      Math.max(margin, Math.min(height - margin, stormY)),
    );
    ctx.rotate(Math.atan2(stormY - height / 2, stormX - width / 2));
    ctx.beginPath();
    ctx.moveTo(40, 0);
    ctx.lineTo(-25, -28);
    ctx.lineTo(-25, 28);
    ctx.closePath();
    ctx.fillStyle = '#ff4d4d';
    ctx.fill();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
}

/**
 * Paints the storm the way a radar shows it: light rain in green on the
 * outside, through yellow and red, to a purple core.
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('./rules.js').Storm} storm
 */
function drawStorm(ctx, storm) {
  // Each ring: its colour, how far it stretches, and how far its middle sits
  // to the north-east of the storm's own middle. All in miles.
  const rings = [
    { colour: '#1f9d3a', long: 7, wide: 4.5, shift: 2.2 },
    { colour: '#e8d21d', long: 5, wide: 3.1, shift: 1.4 },
    { colour: '#e02a1f', long: 3.2, wide: 2, shift: 0.7 },
    { colour: '#b03be0', long: 1.5, wide: 1, shift: 0.3 },
  ];
  ctx.save();
  ctx.globalAlpha = 0.85;
  for (const ring of rings) {
    ctx.beginPath();
    ctx.ellipse(storm.x + ring.shift, storm.y + ring.shift, ring.long, ring.wide, Math.PI / 4, 0, Math.PI * 2);
    ctx.fillStyle = ring.colour;
    ctx.fill();
  }

  // The hook curls out of the storm's south-west side. As it grows it gets
  // longer and winds tighter.
  const hookX = storm.x - 2.6;
  const hookY = storm.y - 2.6;
  if (storm.hook > 0) {
    ctx.beginPath();
    ctx.arc(hookX, hookY, 1.9 - 0.8 * storm.hook, 0.25 * Math.PI, (0.25 - 1.5 * storm.hook) * Math.PI, true);
    ctx.lineWidth = 0.9;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#e02a1f';
    ctx.stroke();
  }
  ctx.restore();

  // The tornado marker sits inside the hook: a white triangle, point down.
  if (storm.tornado > 0) {
    const size = 0.4 + 0.8 * storm.tornado;
    ctx.beginPath();
    ctx.moveTo(hookX, hookY - size);
    ctx.lineTo(hookX - size, hookY + size);
    ctx.lineTo(hookX + size, hookY + size);
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  }
}
