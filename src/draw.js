// Drawing the map view: the real map, the storm on the radar and the car.
// The windshield view is painted by windshield.js.

import { tuning } from '../tuning.js';
import { squareMiles } from './map.js';

/**
 * Paints the game as it is right now.
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('./rules.js').GameState} state
 * @param {boolean} wholeTerritory True to show the whole territory, false to
 *   follow the car.
 * @param {import('./map.js').GameMap} map
 */
export function draw(ctx, state, wholeTerritory, map) {
  const { width, height } = ctx.canvas;
  const { car, storm } = state;
  const halfWide = tuning.territoryMilesWide / 2;
  const halfTall = tuning.territoryMilesTall / 2;

  // The middle of the view, and how many pixels a mile takes up.
  const middle = wholeTerritory ? { x: 0, y: 0 } : car;
  const pixelsPerMile = wholeTerritory
    ? Math.min(width / tuning.territoryMilesWide, height / tuning.territoryMilesTall) / 1.05
    : width / tuning.viewMiles;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#0b1118';
  ctx.fillRect(0, 0, width, height);

  // From here on, draw in miles with north at the top.
  ctx.translate(width / 2, height / 2);
  ctx.scale(pixelsPerMile, -pixelsPerMile);
  ctx.translate(-middle.x, -middle.y);

  drawMap(ctx, map, wholeTerritory, middle, pixelsPerMile);

  // The edge of the territory.
  ctx.lineWidth = 4 / pixelsPerMile;
  ctx.strokeStyle = '#5b7488';
  ctx.strokeRect(-halfWide, -halfTall, halfWide * 2, halfTall * 2);

  drawStorm(ctx, storm);

  // The footage ring: film from inside it to get paid.
  if (storm.tornado > 0) {
    ctx.beginPath();
    ctx.arc(storm.funnel.x, storm.funnel.y, tuning.footage.ringMiles, 0, Math.PI * 2);
    ctx.lineWidth = 3 / pixelsPerMile;
    ctx.setLineDash([14 / pixelsPerMile, 10 / pixelsPerMile]);
    ctx.strokeStyle = '#9be28c';
    ctx.stroke();
    ctx.setLineDash([]);
  }

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

// How each tier of road is drawn, most important first: its colour and its
// width in pixels. Interstates are the brightest.
const roadStyles = [
  { colour: '#c4d2dc', width: 3.5 },
  { colour: '#7f909e', width: 2.2 },
  { colour: '#4d5d6b', width: 1.5 },
  { colour: '#303d49', width: 1 },
];

// The size of a place's name in pixels, by what kind of place it is.
/** @type {Record<string, number>} */
const nameSizes = { city: 38, town: 26, village: 20 };

/**
 * Paints the county lines, the roads and the town names.
 * @param {CanvasRenderingContext2D} ctx Already set up to draw in miles.
 * @param {import('./map.js').GameMap} map
 * @param {boolean} wholeTerritory
 * @param {import('./rules.js').Point} middle The middle of the view.
 * @param {number} pixelsPerMile
 */
function drawMap(ctx, map, wholeTerritory, middle, pixelsPerMile) {
  const { width, height } = ctx.canvas;
  const halfWide = width / 2 / pixelsPerMile;
  const halfTall = height / 2 / pixelsPerMile;

  ctx.lineWidth = 1.5 / pixelsPerMile;
  ctx.strokeStyle = '#3f5870';
  ctx.stroke(map.counties);

  // Only the squares of road the view touches. The whole-territory view
  // leaves out the two least important tiers, which would be a grey blur.
  const tiers = wholeTerritory ? 2 : roadStyles.length;
  for (let tier = tiers - 1; tier >= 0; tier--) {
    ctx.lineWidth = roadStyles[tier].width / pixelsPerMile;
    ctx.strokeStyle = roadStyles[tier].colour;
    for (let column = Math.floor((middle.x - halfWide) / squareMiles); column <= (middle.x + halfWide) / squareMiles; column++) {
      for (let row = Math.floor((middle.y - halfTall) / squareMiles); row <= (middle.y + halfTall) / squareMiles; row++) {
        const paths = map.squares.get(`${column},${row}`);
        if (paths) ctx.stroke(paths[tier]);
      }
    }
  }

  // Names are written in pixels, so they stay the right way up and the same
  // size in both views. The whole-territory view leaves out the villages.
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#a9b8c4';
  for (const place of map.places) {
    if (wholeTerritory && place.kind === 'village') continue;
    const x = width / 2 + (place.x - middle.x) * pixelsPerMile;
    const y = height / 2 - (place.y - middle.y) * pixelsPerMile;
    if (x < -200 || x > width + 200 || y < -50 || y > height + 50) continue;
    ctx.font = `${nameSizes[place.kind]}px system-ui, sans-serif`;
    ctx.fillText(place.name, x, y);
  }
  ctx.restore();
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
  // A soft glow, so the storm stands out over the map.
  ctx.shadowColor = '#6dff8a';
  ctx.shadowBlur = 40;
  for (const ring of rings) {
    ctx.beginPath();
    ctx.ellipse(storm.x + ring.shift, storm.y + ring.shift, ring.long, ring.wide, Math.PI / 4, 0, Math.PI * 2);
    ctx.fillStyle = ring.colour;
    ctx.fill();
  }

  // The hook curls out of the storm's south-west side. As it grows it gets
  // longer and winds tighter.
  const { x: hookX, y: hookY } = storm.funnel;
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
