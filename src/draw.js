// Drawing the map view: the real map, the storm on the radar and the car.
// The windshield view is painted by windshield.js.

import { tuning } from '../tuning.js';
import { squareMiles } from './map.js';
import { beamPassed, bearingOf, colourOf, coverOf, dbzAt } from './radar.js';
import { dangerRingMiles } from './rules.js';

/**
 * Paints the game as it is right now.
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('./rules.js').GameState} state
 * @param {boolean} wholeTerritory True to show the whole territory, false to
 *   follow the car.
 * @param {import('./map.js').GameMap} map
 * @param {import('./rules.js').Tuning} day The numbers today plays by.
 */
export function draw(ctx, state, wholeTerritory, map, day) {
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

  drawStorm(ctx, state, pixelsPerMile);
  drawReports(ctx, state, pixelsPerMile);

  if (storm.tornado > 0) {
    // The footage ring: film from inside it to get paid. A ring of no miles
    // is the tornado itself, so there is nothing to draw.
    if (day.footage.ringMiles > 0) {
      ctx.beginPath();
      ctx.arc(storm.funnel.x, storm.funnel.y, day.footage.ringMiles, 0, Math.PI * 2);
      ctx.lineWidth = 3 / pixelsPerMile;
      ctx.setLineDash([14 / pixelsPerMile, 10 / pixelsPerMile]);
      ctx.strokeStyle = '#9be28c';
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // The danger ring: inside it the wind damages the car.
    ctx.beginPath();
    ctx.arc(storm.funnel.x, storm.funnel.y, dangerRingMiles(state, day), 0, Math.PI * 2);
    ctx.lineWidth = 4 / pixelsPerMile;
    ctx.strokeStyle = '#ff4d4d';
    ctx.stroke();

    // The debris zone: inside it flying debris hits the car.
    ctx.beginPath();
    ctx.arc(storm.funnel.x, storm.funnel.y, day.debris.zoneMiles, 0, Math.PI * 2);
    ctx.lineWidth = 4 / pixelsPerMile;
    ctx.setLineDash([5 / pixelsPerMile, 7 / pixelsPerMile]);
    ctx.strokeStyle = '#c98a4b';
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // The car. It keeps its size on screen in both views.
  ctx.beginPath();
  ctx.arc(car.x, car.y, 14 / pixelsPerMile, 0, Math.PI * 2);
  ctx.fillStyle = '#ffd24a';
  ctx.fill();

  // Back to pixels for the minimap. It stands in for the whole-territory
  // view, so it is only there while the view follows the car on a chase.
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (!wholeTerritory && !state.dayOver) drawMinimap(ctx, state, map, pixelsPerMile);
}

// The minimap's map: the county lines and main roads of the whole territory.
// It is painted once, at twice the size so its lines stay sharp, and reused
// every frame.
/** @type {HTMLCanvasElement | undefined} */
let minimapMap;

/**
 * Paints the minimap in the top right corner: the whole territory, with the
 * storm, the car and a box round what the main view shows.
 * @param {CanvasRenderingContext2D} ctx Set up to draw in pixels.
 * @param {import('./rules.js').GameState} state
 * @param {import('./map.js').GameMap} map
 * @param {number} viewPixelsPerMile How many pixels a mile takes up in the
 *   main view.
 */
function drawMinimap(ctx, state, map, viewPixelsPerMile) {
  const { width, height } = ctx.canvas;
  const { car } = state;
  const wide = tuning.minimapPixels;
  const tall = Math.round((wide * tuning.territoryMilesTall) / tuning.territoryMilesWide);
  const left = width - wide - 30;
  const top = 30;
  const pixelsPerMile = wide / tuning.territoryMilesWide;

  if (!minimapMap) {
    minimapMap = document.createElement('canvas');
    minimapMap.width = wide * 2;
    minimapMap.height = tall * 2;
    const to = /** @type {CanvasRenderingContext2D} */ (minimapMap.getContext('2d'));
    to.fillStyle = '#0b1118';
    to.fillRect(0, 0, minimapMap.width, minimapMap.height);
    to.translate(wide, tall);
    to.scale(pixelsPerMile * 2, -pixelsPerMile * 2);
    // No town names: they would not fit.
    drawMap(to, { ...map, places: [] }, true, { x: 0, y: 0 }, pixelsPerMile * 2);
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(left, top, wide, tall);
  ctx.clip();
  ctx.drawImage(minimapMap, left, top, wide, tall);

  // Draw in miles with north at the top, as the map does.
  ctx.translate(left + wide / 2, top + tall / 2);
  ctx.scale(pixelsPerMile, -pixelsPerMile);
  drawStorm(ctx, state, pixelsPerMile);
  drawReports(ctx, state, pixelsPerMile);
  // What the main view shows, and the car in the middle of it.
  const viewWide = width / viewPixelsPerMile;
  const viewTall = height / viewPixelsPerMile;
  ctx.lineWidth = 2 / pixelsPerMile;
  ctx.strokeStyle = '#dce6ee';
  ctx.strokeRect(car.x - viewWide / 2, car.y - viewTall / 2, viewWide, viewTall);
  ctx.beginPath();
  ctx.arc(car.x, car.y, 5 / pixelsPerMile, 0, Math.PI * 2);
  ctx.fillStyle = '#ffd24a';
  ctx.fill();
  ctx.restore();

  ctx.lineWidth = 4;
  ctx.strokeStyle = '#39424c';
  ctx.strokeRect(left, top, wide, tall);
}

/**
 * Paints the dash radar: a small radar with the car in the middle, for the
 * windshield view.
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('./rules.js').GameState} state
 * @param {{ left: number, top: number, wide: number, tall: number }} box
 *   Where on the screen it goes, in pixels.
 */
export function drawDashRadar(ctx, state, box) {
  const pixelsPerMile = box.wide / tuning.camera.dashRadarMiles;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.beginPath();
  ctx.rect(box.left, box.top, box.wide, box.tall);
  ctx.clip();
  ctx.fillStyle = '#0b1118';
  ctx.fillRect(box.left, box.top, box.wide, box.tall);

  // Draw in miles with north at the top, as the map does.
  ctx.translate(box.left + box.wide / 2, box.top + box.tall / 2);
  ctx.scale(pixelsPerMile, -pixelsPerMile);
  ctx.translate(-state.car.x, -state.car.y);
  drawStorm(ctx, state, pixelsPerMile);
  ctx.beginPath();
  ctx.arc(state.car.x, state.car.y, 7 / pixelsPerMile, 0, Math.PI * 2);
  ctx.fillStyle = '#ffd24a';
  ctx.fill();
  ctx.restore();

  ctx.lineWidth = 6;
  ctx.strokeStyle = '#39424c';
  ctx.strokeRect(box.left, box.top, box.wide, box.tall);
}

/**
 * Paints the spotters' reports: a ring and a dot at each reported spot, which
 * fade away as the report gets old.
 * @param {CanvasRenderingContext2D} ctx Already set up to draw in miles.
 * @param {import('./rules.js').GameState} state
 * @param {number} pixelsPerMile
 */
function drawReports(ctx, state, pixelsPerMile) {
  for (const report of state.reports) {
    const colour = `rgba(255, 143, 107, ${Math.max(0, 1 - report.age / tuning.spotters.ringSeconds)})`;
    ctx.beginPath();
    ctx.arc(report.x, report.y, 9 / pixelsPerMile + 0.25, 0, Math.PI * 2);
    ctx.lineWidth = 4 / pixelsPerMile;
    ctx.strokeStyle = colour;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(report.x, report.y, 3 / pixelsPerMile, 0, Math.PI * 2);
    ctx.fillStyle = colour;
    ctx.fill();
  }
}

// How each tier of road is drawn, most important first: its colour and its
// width in pixels. Interstates are the brightest.
const roadStyles = [
  { colour: '#c4d2dc', width: 3.5 },
  { colour: '#7f909e', width: 2.2 },
  { colour: '#4d5d6b', width: 1.5 },
  { colour: '#303d49', width: 1 },
  { colour: '#2c3742', width: 1 },
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
export function drawMap(ctx, map, wholeTerritory, middle, pixelsPerMile) {
  const { width, height } = ctx.canvas;
  const halfWide = width / 2 / pixelsPerMile;
  const halfTall = height / 2 / pixelsPerMile;

  ctx.lineWidth = 1.5 / pixelsPerMile;
  ctx.strokeStyle = '#3f5870';
  ctx.stroke(map.counties);

  // Only the squares of road the view touches. The whole-territory view
  // shows the two most important tiers: the rest would be a grey blur.
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

// The radar picture: one pixel for each square of the territory that is
// tuning.radar.pixelMiles across, north at the top. The map, the minimap and
// the dash radar all show this one picture. It only changes where the radar's
// beam passes, so it lags a little behind the real storm.
const radar = (() => {
  const { pixelMiles, site } = tuning.radar;
  const wide = Math.ceil(tuning.territoryMilesWide / pixelMiles);
  const tall = Math.ceil(tuning.territoryMilesTall / pixelMiles);
  const west = -tuning.territoryMilesWide / 2;
  const north = tuning.territoryMilesTall / 2;
  /**
   * The middle of a pixel.
   * @param {number} k Which pixel, counting along the rows from the top.
   */
  const spotOf = (k) => ({ x: west + ((k % wide) + 0.5) * pixelMiles, y: north - (Math.floor(k / wide) + 0.5) * pixelMiles });
  return {
    pixelMiles,
    wide,
    tall,
    spotOf,
    // Which way each pixel is from the radar.
    bearings: Float32Array.from({ length: wide * tall }, (_, k) => bearingOf(spotOf(k), site)),
    /** @type {HTMLCanvasElement | undefined} */
    canvas: undefined,
    /** @type {ImageData | undefined} */
    image: undefined,
    /** @type {import('./rules.js').Tuning | undefined} The day it shows. */
    day: undefined,
    // How far the beam had turned when the picture was last brought up to
    // date.
    beam: 0,
  };
})();

/**
 * Brings the radar picture up to date: the pixels the beam has passed over
 * since last time are painted again, as the storm is now. Call it once a
 * frame, before painting.
 * @param {import('./rules.js').GameState} state
 * @param {import('./rules.js').Tuning} day The numbers today plays by.
 */
export function sweepRadar(state, day) {
  if (!radar.canvas) {
    radar.canvas = document.createElement('canvas');
    radar.canvas.width = radar.wide;
    radar.canvas.height = radar.tall;
  }
  const to = /** @type {CanvasRenderingContext2D} */ (radar.canvas.getContext('2d'));
  radar.image ??= to.createImageData(radar.wide, radar.tall);
  const { data } = radar.image;
  const { hookDbz, lightRainCovers, heavyRainCovers } = tuning.radar;
  const { storm, beam } = state;

  // A new day, or a day started over, begins with the whole picture painted,
  // so the player never sees half a storm.
  const turned = day === radar.day && beam >= radar.beam ? beam - radar.beam : 1;
  if (turned <= 0) return;
  radar.day = day;
  radar.beam = beam;
  // The storm's ragged edges change a little with each turn of the beam.
  const seed = Math.floor(beam);

  for (let k = 0; k < radar.bearings.length; k++) {
    if (!beamPassed(radar.bearings[k], beam, turned)) continue;
    // The rain at the middle of the pixel colours the whole pixel.
    const dbz = dbzAt(radar.spotOf(k), storm, day, hookDbz, seed);
    const colour = colourOf(dbz);
    const at = k * 4;
    if (!colour) {
      data[at + 3] = 0;
      continue;
    }
    data[at] = colour[1];
    data[at + 1] = colour[2];
    data[at + 2] = colour[3];
    // Heavier rain hides more of the map under it.
    data[at + 3] = 2.55 * coverOf(dbz, lightRainCovers, heavyRainCovers);
  }
  to.putImageData(radar.image, 0, 0);
}

/**
 * Paints the storm the way a radar shows it: blocky pixels coloured by how
 * hard it is raining, from light green through yellow and red to the purple
 * of the hail core, with the map showing through. The radar's beam turns
 * over it.
 * @param {CanvasRenderingContext2D} ctx Already set up to draw in miles.
 * @param {import('./rules.js').GameState} state
 * @param {number} pixelsPerMile
 */
function drawStorm(ctx, state, pixelsPerMile) {
  const { storm } = state;
  if (radar.canvas) {
    ctx.save();
    // The picture's first row is the north edge, so it is drawn upside down
    // in a view where north is up. No smoothing: the pixels stay square.
    ctx.scale(1, -1);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(radar.canvas, -tuning.territoryMilesWide / 2, -tuning.territoryMilesTall / 2, radar.wide * radar.pixelMiles, radar.tall * radar.pixelMiles);
    ctx.restore();
  }

  // The beam: a thin bright line from the radar, long enough to cross the
  // whole territory and cut off at its edge, with a short glow trailing
  // behind it.
  const { site } = tuning.radar;
  ctx.save();
  ctx.beginPath();
  ctx.rect(-tuning.territoryMilesWide / 2, -tuning.territoryMilesTall / 2, tuning.territoryMilesWide, tuning.territoryMilesTall);
  ctx.clip();
  for (let i = 0; i < 14; i++) {
    const angle = state.beam * Math.PI * 2 - i * 0.012;
    ctx.beginPath();
    ctx.moveTo(site.x, site.y);
    ctx.lineTo(site.x + 120 * Math.sin(angle), site.y + 120 * Math.cos(angle));
    ctx.lineWidth = (i === 0 ? 2.5 : 5) / pixelsPerMile;
    ctx.strokeStyle = `rgba(150, 255, 170, ${i === 0 ? 0.55 : 0.1 * (1 - i / 14)})`;
    ctx.stroke();
  }
  ctx.restore();

  const { x: hookX, y: hookY } = storm.funnel;
  // The tornado marker sits at the hook's tip: a white triangle, point down.
  // A stronger tornado has a bigger one, and it shrinks as the tornado dies.
  if (storm.tornado > 0) {
    const { mapMiles } = tuning.tornado;
    const size = mapMiles[Math.min(storm.strength, mapMiles.length - 1)] * (0.33 + 0.67 * storm.tornado);
    ctx.beginPath();
    ctx.moveTo(hookX, hookY - size);
    ctx.lineTo(hookX - size, hookY + size);
    ctx.lineTo(hookX + size, hookY + size);
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  }
}
