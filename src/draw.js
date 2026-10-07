// Drawing the map view: the real map, the storm on the radar and the car.
// The windshield view is painted by windshield.js.

import { tuning } from '../tuning.js';
import { squareMiles } from './map.js';
import { beamPassed, bearingOf, colourOf, coverOf, dbzAt, inCouplet, rotationOf, velocityAt, velocityColourOf, windCoverOf } from './radar.js';
import { dangerRingMiles, radarMarks } from './rules.js';

/**
 * Paints the game as it is right now.
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('./rules.js').GameState} state
 * @param {boolean} wholeTerritory True to show the whole territory, false to
 *   follow the car.
 * @param {import('./map.js').GameMap} map
 * @param {import('./rules.js').Tuning} day The numbers today plays by.
 * @param {import('./roads.js').JunctionAhead | null} ahead The next junction
 *   ahead of the car, if there is one to show.
 */
export function draw(ctx, state, wholeTerritory, map, day, ahead) {
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
  // The whole territory has too many interchanges to mark: they would hide
  // the freeways.
  if (!wholeTerritory) drawInterchanges(ctx, map, pixelsPerMile);

  // The edge of the territory.
  ctx.lineWidth = 4 / pixelsPerMile;
  ctx.strokeStyle = '#5b7488';
  ctx.strokeRect(-halfWide, -halfTall, halfWide * 2, halfTall * 2);

  drawStorm(ctx, state, pixelsPerMile, day);
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

  // Chevrons at the next junction. They are a driving aid, so they go over
  // the rain, and only in the view the player drives in.
  if (ahead && !wholeTerritory) drawChevrons(ctx, ahead, pixelsPerMile);

  // The car. It keeps its size on screen in both views.
  ctx.beginPath();
  ctx.arc(car.x, car.y, 14 / pixelsPerMile, 0, Math.PI * 2);
  ctx.fillStyle = '#ffd24a';
  ctx.fill();

  // Back to pixels for the minimap. It stands in for the whole-territory
  // view, so it is only there while the view follows the car on a chase.
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  // Which of the radar's pictures is showing, and the key for the other.
  if (!state.briefing && !state.dayOver) {
    ctx.font = '26px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    const words = state.velocityView ? 'Radar: velocity (V: reflectivity)' : 'Radar: reflectivity (V: velocity)';
    const top = 30 + Math.round((tuning.minimapPixels * tuning.territoryMilesTall) / tuning.territoryMilesWide) + 14;
    // A dark edge round the letters keeps them readable over the map.
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#05080c';
    ctx.strokeText(words, width - 30, top);
    ctx.fillStyle = '#a9b8c4';
    ctx.fillText(words, width - 30, top);
  }
  if (!wholeTerritory && !state.dayOver) drawMinimap(ctx, state, map, pixelsPerMile, day);
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
 * @param {import('./rules.js').Tuning} day The numbers today plays by.
 */
function drawMinimap(ctx, state, map, viewPixelsPerMile, day) {
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
  drawStorm(ctx, state, pixelsPerMile, day);
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
 * @param {import('./rules.js').Tuning} day The numbers today plays by.
 */
export function drawDashRadar(ctx, state, box, day) {
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
  drawStorm(ctx, state, pixelsPerMile, day);
  ctx.beginPath();
  ctx.arc(state.car.x, state.car.y, 7 / pixelsPerMile, 0, Math.PI * 2);
  ctx.fillStyle = '#ffd24a';
  ctx.fill();
  ctx.restore();

  ctx.lineWidth = 6;
  ctx.strokeStyle = '#39424c';
  ctx.strokeRect(box.left, box.top, box.wide, box.tall);
  // Which picture the dash radar is showing.
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.font = '22px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText(state.velocityView ? 'Velocity (V)' : 'Reflectivity (V)', box.left + 10, box.top + box.tall - 8);
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

/**
 * Paints a chevron for each road out of the next junction, pointing along
 * it. The one the car will take with the arrows held now is lit.
 * @param {CanvasRenderingContext2D} ctx Already set up to draw in miles.
 * @param {import('./roads.js').JunctionAhead} ahead
 * @param {number} pixelsPerMile
 */
function drawChevrons(ctx, ahead, pixelsPerMile) {
  // How far out from the junction a chevron's point is, and how far back
  // and out to each side its arms reach, in miles. They keep their size on
  // screen.
  const out = 40 / pixelsPerMile;
  const arm = 11 / pixelsPerMile;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // The dark edges first, then the unlit chevrons, then the lit one on top.
  const coats = [
    { colour: '#0b1118', pixels: 9, lit: [true, false] },
    { colour: '#7f909e', pixels: 4, lit: [false] },
    { colour: '#ffd24a', pixels: 5, lit: [true] },
  ];
  for (const coat of coats) {
    ctx.beginPath();
    for (const way of ahead.ways) {
      if (!coat.lit.includes(way.lit)) continue;
      const tipX = ahead.x + way.x * out;
      const tipY = ahead.y + way.y * out;
      ctx.moveTo(tipX - way.x * arm - way.y * arm, tipY - way.y * arm + way.x * arm);
      ctx.lineTo(tipX, tipY);
      ctx.lineTo(tipX - way.x * arm + way.y * arm, tipY - way.y * arm - way.x * arm);
    }
    ctx.lineWidth = coat.pixels / pixelsPerMile;
    ctx.strokeStyle = coat.colour;
    ctx.stroke();
  }
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';
}

/**
 * Paints a small diamond at each place the car can get on or off a freeway.
 * A road that crosses a freeway with no diamond is a bridge.
 * @param {CanvasRenderingContext2D} ctx Already set up to draw in miles.
 * @param {import('./map.js').GameMap} map
 * @param {number} pixelsPerMile
 */
function drawInterchanges(ctx, map, pixelsPerMile) {
  // Half the diamond's width, in miles. It keeps its size on screen.
  const size = 7 / pixelsPerMile;
  ctx.beginPath();
  for (const { x, y } of map.interchanges) {
    ctx.moveTo(x, y + size);
    ctx.lineTo(x + size, y);
    ctx.lineTo(x, y - size);
    ctx.lineTo(x - size, y);
    ctx.closePath();
  }
  // Bright with a dark edge, so it still shows under the radar's rain.
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.lineWidth = 2.5 / pixelsPerMile;
  ctx.strokeStyle = '#0b1118';
  ctx.stroke();
}

// The radar's two pictures, reflectivity (the rain) and velocity (the wind):
// one pixel for each square of the territory that is tuning.radar.pixelMiles
// across, north at the top. The map, the minimap and the dash radar all show
// the same one of the two. They only change where the radar's beam passes, so
// they lag a little behind the real storm.

/**
 * One of the radar's pictures, kept as pixels and as a canvas to draw from.
 * @typedef {{ canvas: HTMLCanvasElement, to: CanvasRenderingContext2D, image: ImageData }} RadarPicture
 */

/**
 * @param {number} wide
 * @param {number} tall
 * @returns {RadarPicture}
 */
function radarPicture(wide, tall) {
  const canvas = document.createElement('canvas');
  canvas.width = wide;
  canvas.height = tall;
  const to = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
  return { canvas, to, image: to.createImageData(wide, tall) };
}

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
    /** @type {RadarPicture | undefined} */
    reflectivity: undefined,
    /** @type {RadarPicture | undefined} */
    velocity: undefined,
    /** @type {import('./rules.js').Tuning | undefined} The day it shows. */
    day: undefined,
    // How far the beam had turned when the picture was last brought up to
    // date.
    beam: 0,
  };
})();

/**
 * Brings the radar's pictures up to date: the pixels the beam has passed over
 * since last time are painted again, as the storm is now. Call it once a
 * frame, before painting.
 * @param {import('./rules.js').GameState} state
 * @param {import('./rules.js').Tuning} day The numbers today plays by.
 */
export function sweepRadar(state, day) {
  const reflectivity = (radar.reflectivity ??= radarPicture(radar.wide, radar.tall));
  const velocity = (radar.velocity ??= radarPicture(radar.wide, radar.tall));
  const { data } = reflectivity.image;
  const wind = velocity.image.data;
  const { hookDbz, lightRainCovers, heavyRainCovers, site } = tuning.radar;
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
    const spot = radar.spotOf(k);
    const dbz = dbzAt(spot, storm, day, hookDbz, seed);
    const colour = colourOf(dbz);
    const at = k * 4;
    // Heavier rain hides more of the map under it.
    const cover = colour ? coverOf(dbz, lightRainCovers, heavyRainCovers) : 0;
    if (colour) {
      data[at] = colour[1];
      data[at + 1] = colour[2];
      data[at + 2] = colour[3];
    }
    data[at + 3] = 2.55 * cover;

    // The velocity picture covers the same pixels as the rain and hides as
    // much of the map. It also shows the wind close in round the couplet,
    // rain or no rain, brighter the faster it blows.
    const near = inCouplet(spot, storm);
    if (!colour && !near) {
      wind[at + 3] = 0;
      continue;
    }
    const mph = velocityAt(spot, storm, site, seed);
    const windColour = velocityColourOf(mph);
    wind[at] = windColour[0];
    wind[at + 1] = windColour[1];
    wind[at + 2] = windColour[2];
    wind[at + 3] = 2.55 * Math.max(cover, near ? windCoverOf(mph, lightRainCovers, heavyRainCovers) : 0);
  }
  reflectivity.to.putImageData(reflectivity.image, 0, 0);
  velocity.to.putImageData(velocity.image, 0, 0);
}

/**
 * Paints the storm the way a radar shows it: blocky pixels coloured by how
 * hard it is raining, from light green through yellow and red to the purple
 * of the hail core, with the map showing through. In the velocity view the
 * same pixels are coloured by the wind: green toward the radar, red away.
 * The radar's beam turns over it.
 * @param {CanvasRenderingContext2D} ctx Already set up to draw in miles.
 * @param {import('./rules.js').GameState} state
 * @param {number} pixelsPerMile
 * @param {import('./rules.js').Tuning} day The numbers today plays by.
 */
function drawStorm(ctx, state, pixelsPerMile, day) {
  const { storm } = state;
  const picture = state.velocityView ? radar.velocity : radar.reflectivity;
  if (picture) {
    ctx.save();
    // The picture's first row is the north edge, so it is drawn upside down
    // in a view where north is up. No smoothing: the pixels stay square.
    ctx.scale(1, -1);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(picture.canvas, -tuning.territoryMilesWide / 2, -tuning.territoryMilesTall / 2, radar.wide * radar.pixelMiles, radar.tall * radar.pixelMiles);
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
  // How big the white tornado marker is, in miles. Nothing with no tornado.
  let marker = 0;
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
    marker = size;
  }

  // What the phased array radar marks. Both keep a size that can be seen on
  // the minimap.
  const marks = radarMarks(storm, day);
  ctx.lineWidth = 3 / pixelsPerMile;
  if (marks.rotation) {
    // A yellow circle on the storm's rotation: this storm is turning.
    const middle = rotationOf(storm);
    ctx.beginPath();
    ctx.arc(middle.x, middle.y, Math.max(1.6, 9 / pixelsPerMile), 0, Math.PI * 2);
    ctx.strokeStyle = '#ffd24a';
    ctx.stroke();
  }
  if (marks.vortex) {
    // A red triangle outline, point down, at the hook's tip: this one is
    // real. It goes round the white marker once the tornado is down.
    const size = Math.max(0.45, 7 / pixelsPerMile, marker + 0.15);
    ctx.beginPath();
    ctx.moveTo(hookX, hookY - size);
    ctx.lineTo(hookX - size, hookY + size);
    ctx.lineTo(hookX + size, hookY + size);
    ctx.closePath();
    ctx.strokeStyle = '#ff4d4d';
    ctx.stroke();
  }
}
