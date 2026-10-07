// The windshield view: what the player sees while pulled over to film.
//
// The view is flat layers, painted back to front. Each layer is a placeholder
// drawn in code, named after the picture file that will replace it. The name
// is written on the placeholder so it is easy to see which drawing goes where.

import { tuning } from '../tuning.js';
import { drawDashRadar } from './draw.js';
import { dbzAt } from './radar.js';
import { anchorWait, cameraOffFunnel, inDebrisZone, insideTornado, milesToFunnel, payPerSecond, tornadoInFrame, windMph } from './rules.js';
import { funnelHalfWidth, funnelReach, hailAmount, rainAmount, rainSlant, skyDarkness, tornadoShape, treeLean } from './scene.js';

/**
 * Writes a placeholder's file name on it.
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} fileName
 * @param {number} x
 * @param {number} y
 */
function label(ctx, fileName, x, y) {
  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.font = '22px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(fileName, x, y);
}

// How far down the windshield the storm's cloud base hangs, as a share of
// the windshield's height.
const cloudBase = 0.2;
// How fast the clouds drift across the sky, in degrees round the compass
// each second. The nearer layer goes faster.
const cloudDrift = [0.8, 1.6];

/**
 * How far right of the middle of the view a compass bearing is, in degrees
 * from -180 to 180.
 * @param {import('./rules.js').GameState} state
 * @param {number} bearing In degrees round from north.
 */
function offCamera(state, bearing) {
  return ((((bearing - state.camera) % 360) + 540) % 360) - 180;
}

/**
 * How far across the screen, in pixels, something so many degrees right of
 * the middle of the view is.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} degrees
 */
function acrossOf(ctx, degrees) {
  return ctx.canvas.width * (0.5 + degrees / tuning.camera.viewDegrees);
}

/**
 * Paints the storm sky, the cloud base and the fields. They are fixed to the
 * compass, so they slide across as the camera pans.
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('./rules.js').GameState} state
 * @param {number} seconds The clock.
 * @param {number} horizon How far down the screen the horizon is, in pixels.
 */
function drawSkyAndGround(ctx, state, seconds, horizon) {
  const { width, height } = ctx.canvas;
  const { viewDegrees } = tuning.camera;

  // A storm sky: slate overhead, with a pale, sickly light along the horizon.
  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, '#36424d');
  sky.addColorStop(1, '#8b9a8c');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, horizon);
  // It darkens toward the tornado: a shade across the sky, deepest in the
  // tornado's direction. Not so deep that the tornado is lost in it.
  const offFunnel = cameraOffFunnel(state);
  const shade = ctx.createLinearGradient(0, 0, width, 0);
  const stops = 16;
  for (let stop = 0; stop <= stops; stop++) {
    const degrees = (stop / stops - 0.5) * viewDegrees;
    shade.addColorStop(stop / stops, `rgba(9, 12, 16, ${0.62 * skyDarkness(degrees - offFunnel)})`);
  }
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, width, horizon);

  // The cloud base: two layers of low, dark cloud with a lumpy underside,
  // the nearer one darker, lower and faster.
  cloudDrift.forEach((drift, layer) => {
    const base = height * cloudBase * (0.8 + 0.2 * layer);
    ctx.fillStyle = layer ? '#12161b' : '#222a32';
    ctx.fillRect(0, 0, width, base * 0.75);
    ctx.beginPath();
    // A lump every eight degrees round the compass, each its own size.
    for (let lump = 0; lump < 45; lump++) {
      const degrees = offCamera(state, lump * 8 + layer * 4 + seconds * drift);
      if (Math.abs(degrees) > viewDegrees / 2 + 12) continue;
      const wide = width * (0.075 + ((lump * 7 + layer * 3) % 5) * 0.012);
      const deep = base * (0.3 + ((lump * 3 + layer) % 4) * 0.07);
      const x = acrossOf(ctx, degrees);
      ctx.moveTo(x + wide, base * 0.75);
      ctx.ellipse(x, base * 0.75, wide, deep, 0, 0, Math.PI * 2);
    }
    ctx.fill();
  });

  // The ground: fields, darker toward the car.
  const ground = ctx.createLinearGradient(0, horizon, 0, height);
  ground.addColorStop(0, '#4b5a39');
  ground.addColorStop(1, '#232d1c');
  ctx.fillStyle = ground;
  ctx.fillRect(0, horizon, width, height - horizon);
  // Strips of field across the view, deeper the nearer they are: every other
  // one a paler crop.
  const fields = 7;
  ctx.fillStyle = 'rgba(150, 140, 80, 0.16)';
  for (let field = 1; field < fields; field += 2) {
    const top = horizon + (height - horizon) * (field / fields) ** 2;
    const bottom = horizon + (height - horizon) * ((field + 1) / fields) ** 2;
    ctx.fillRect(0, top, width, bottom - top);
  }
  // The hedges between fields run away from the car to the horizon, one
  // every ten degrees round the compass.
  ctx.beginPath();
  for (let hedge = 0; hedge < 36; hedge++) {
    const degrees = offCamera(state, hedge * 10 + 5);
    if (Math.abs(degrees) > viewDegrees / 2 + 5) continue;
    const x = acrossOf(ctx, degrees);
    ctx.moveTo(x, horizon);
    ctx.lineTo(width / 2 + (x - width / 2) * 3.4, height);
  }
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(22, 30, 18, 0.55)';
  ctx.stroke();
  // A clear horizon.
  ctx.fillStyle = '#1a2217';
  ctx.fillRect(0, horizon - 2, width, 5);
}

/**
 * Paints the line of trees and poles along the horizon. The trees lean
 * toward the tornado and thrash harder as the wind at the car rises: the
 * same wind the roof gauge reads.
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('./rules.js').GameState} state
 * @param {import('./rules.js').Tuning} day The numbers today plays by.
 * @param {number} seconds The clock.
 * @param {number} horizon How far down the screen the horizon is, in pixels.
 */
function drawTreeLine(ctx, state, day, seconds, horizon) {
  const { viewDegrees } = tuning.camera;
  const { storm } = state;
  const mph = storm.tornado > 0 ? windMph(milesToFunnel(state), storm.strength, day) : 0;
  const offFunnel = cameraOffFunnel(state);
  ctx.lineCap = 'round';
  // Something stands every three degrees round the compass: mostly trees,
  // each its own height, and every fifth one a pole.
  for (let n = 0; n < 120; n++) {
    const degrees = offCamera(state, n * 3);
    if (Math.abs(degrees) > viewDegrees / 2 + 4) continue;
    const x = acrossOf(ctx, degrees);
    if (n % 5 === 2) {
      ctx.fillStyle = '#161a16';
      ctx.fillRect(x - 3, horizon - 84, 6, 84);
      ctx.fillRect(x - 22, horizon - 76, 44, 5);
      continue;
    }
    const tall = 48 + ((n * 37) % 5) * 13;
    // A tree to the left of the tornado leans right, toward it. One in line
    // with the tornado, or straight across from it, leans neither way, so
    // no tree snaps from one side to the other as the camera pans.
    const round = ((offFunnel - degrees) * Math.PI) / 180;
    const lean = treeLean(mph, Math.max(-1, Math.min(1, Math.sin(round) * 3)), seconds, n);
    const reach = { x: Math.sin(lean), y: -Math.cos(lean) };
    ctx.beginPath();
    ctx.moveTo(x, horizon);
    ctx.lineTo(x + reach.x * tall * 0.6, horizon + reach.y * tall * 0.6);
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#161a13';
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(x + reach.x * tall * 0.68, horizon + reach.y * tall * 0.68, tall * 0.3, tall * 0.42, lean, 0, Math.PI * 2);
    ctx.fillStyle = '#1c2819';
    ctx.fill();
  }
  ctx.lineCap = 'butt';
}

/**
 * Paints the tornado: a funnel that turns, hanging from the cloud. How far
 * left or right it sits follows its direction from the car, its size how
 * near it is, and its shape its strength. A funnel that is still forming
 * reaches part of the way down.
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('./rules.js').GameState} state
 * @param {number} seconds The clock.
 * @param {number} horizon How far down the screen the horizon is, in pixels.
 */
function drawTornado(ctx, state, seconds, horizon) {
  const { width, height } = ctx.canvas;
  const { storm } = state;
  const reach = funnelReach(storm, tuning.spotters.funnelCloudHook);
  const x = acrossOf(ctx, cameraOffFunnel(state));
  if (!reach || x < -width || x > width * 2) return;

  // Twice as near looks twice as tall, until it fills the sky from the
  // cloud base down.
  const deck = height * cloudBase;
  const tall = Math.min(horizon - deck * 0.85, (horizon * 1.6) / Math.max(milesToFunnel(state), 0.5));
  const top = horizon - tall;
  const { name, top: topWide } = tornadoShape(storm.strength);
  // A rope snakes about; a cone and a wedge hardly bend.
  const bend = name === 'rope' ? 0.07 : name === 'cone' ? 0.02 : 0.008;

  // The storm's own cloud comes down from the cloud base to the top of the
  // funnel: the further off the tornado, the lower on the screen that is.
  ctx.fillStyle = '#171c22';
  ctx.beginPath();
  const lumps = 5;
  for (let lump = 0; lump <= lumps; lump++) {
    const down = lump / lumps;
    const y = deck * 0.8 + (top - deck * 0.8) * down;
    const wide = tall * topWide * (3 - 1.6 * down) + 240 - 190 * down;
    ctx.moveTo(x + wide, y);
    ctx.ellipse(x + Math.sin(lump * 2.1 + seconds * 0.2) * 12, y, wide, Math.max(18, (top - deck * 0.8) / lumps) + 14, 0, 0, Math.PI * 2);
  }
  ctx.fill();

  // The funnel's edges, row by row from the cloud down. They are ragged, and
  // waver with the clock, each side in its own time.
  const rows = 30;
  /** @type {{ y: number, middle: number, half: number }[]} */
  const funnel = [];
  for (let row = 0; row <= rows; row++) {
    const down = row / rows;
    funnel.push({
      y: top + down * reach * tall,
      middle: x + Math.sin(down * 3.2 + seconds * 1.3) * tall * bend * down,
      half: funnelHalfWidth(storm.strength, down, storm.tornado) * tall,
    });
  }
  /**
   * @param {number} row
   * @param {number} side -1 for the left edge, 1 for the right.
   */
  const edge = (row, side) => {
    const { middle, half } = funnel[row];
    const ragged = 1 + 0.07 * Math.sin(row * 0.9 + seconds * 5 * side) + 0.05 * Math.sin(row * 2.3 - seconds * 8 + side);
    return middle + side * (half * ragged + 1.5);
  };
  ctx.save();
  ctx.beginPath();
  for (let row = 0; row <= rows; row++) ctx.lineTo(edge(row, -1), funnel[row].y);
  for (let row = rows; row >= 0; row--) ctx.lineTo(edge(row, 1), funnel[row].y);
  ctx.closePath();
  // Lit from the left, so it reads as round, and pale enough to stand out
  // from the dark sky behind it.
  const body = ctx.createLinearGradient(x - tall * topWide, 0, x + tall * topWide, 0);
  body.addColorStop(0, '#8a9096');
  body.addColorStop(0.45, '#5b6168');
  body.addColorStop(1, '#2b3036');
  ctx.fillStyle = body;
  ctx.fill();

  // What makes it turn: bands and streaks that slide across its face from
  // right to left, quickest in the middle, and are gone round the back.
  ctx.clip();
  ctx.lineCap = 'round';
  const bands = 11;
  for (let band = 0; band < bands; band++) {
    const { y, middle, half } = funnel[Math.round(((band + 0.5) / bands) * rows)];
    for (let streak = 0; streak < 4; streak++) {
      const turned = (seconds * (0.45 + 0.12 * (band % 3)) + streak / 4 + band * 0.37) % 1;
      const facing = Math.sin(turned * Math.PI);
      const across = middle + Math.cos(turned * Math.PI) * half;
      const long = half * 0.45 * facing + 5;
      ctx.beginPath();
      ctx.moveTo(across - long, y + long * 0.22);
      ctx.lineTo(across + long, y - long * 0.22);
      ctx.lineWidth = Math.max(2.5, tall * 0.014);
      ctx.strokeStyle = streak % 2 ? `rgba(214, 220, 224, ${0.34 * facing})` : `rgba(16, 19, 23, ${0.5 * facing})`;
      ctx.stroke();
    }
  }
  ctx.restore();
  ctx.lineCap = 'butt';
  // A collar of cloud hides where the funnel meets the cloud above it.
  ctx.fillStyle = '#171c22';
  ctx.beginPath();
  ctx.ellipse(x, top, tall * topWide * 1.3 + 24, tall * 0.045 + 12, 0, 0, Math.PI * 2);
  ctx.fill();

  // The debris cloud whirls at the foot of a tornado on the ground.
  if (storm.tornado <= 0) return;
  const foot = funnel[rows];
  const wide = foot.half * 2.2 + tall * 0.07 + 6;
  const high = tall * 0.075 + 6;
  ctx.fillStyle = 'rgba(74, 60, 44, 0.9)';
  ctx.beginPath();
  ctx.ellipse(foot.middle, horizon, wide, high, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#5a4732';
  for (let bit = 0; bit < 16; bit++) {
    const round = seconds * (3 + (bit % 3)) + bit * 1.3;
    const size = (3 + (bit % 3) * 2) * Math.max(0.6, tall / 320);
    ctx.fillRect(
      foot.middle + Math.cos(round) * wide * (0.45 + (bit % 4) * 0.22),
      horizon - (0.25 + 0.75 * Math.abs(Math.sin(round * 0.7 + bit))) * high * 1.9,
      size * 1.5,
      size,
    );
  }
}

/**
 * Paints the rain: as hard as the radar shows it at the car, from nothing
 * outside the storm, through thin streaks, to a sheet. It slants toward the
 * tornado, more as the wind at the car rises.
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('./rules.js').GameState} state
 * @param {import('./rules.js').Tuning} day The numbers today plays by.
 * @param {number} seconds The clock.
 */
function drawRain(ctx, state, day, seconds) {
  const { width, height } = ctx.canvas;
  const { storm } = state;
  // The same rain the radar picture is painted from, ragged edges and all.
  const amount = rainAmount(dbzAt(state.car, storm, day, tuning.radar.hookDbz, Math.floor(state.beam)));
  if (!amount) return;

  // Heavy rain greys out the view. It stops short of hiding the tornado.
  ctx.fillStyle = `rgba(150, 165, 176, ${0.45 * amount ** 1.6})`;
  ctx.fillRect(0, 0, width, height);

  const mph = storm.tornado > 0 ? windMph(milesToFunnel(state), storm.strength, day) : 0;
  // Which way the streaks lean as they fall: toward the tornado's side.
  const slant = rainSlant(mph) * (cameraOffFunnel(state) < 0 ? -1 : 1);
  const lean = { x: Math.sin(slant), y: Math.cos(slant) };
  const streaks = Math.round(40 + 660 * amount);
  // How far sideways a streak travels on its way down the view.
  const drift = (height * 1.1 * lean.x) / lean.y;
  /**
   * A steady number from 0 to 1 for each streak, different for each use, so
   * that where a streak is and when it falls have nothing to do with each
   * other.
   * @param {number} streak
   * @param {number} use
   */
  const scatter = (streak, use) => Math.abs((Math.sin(streak * 12.9898 + use * 78.233) * 43758.5453) % 1);
  ctx.beginPath();
  for (let streak = 0; streak < streaks; streak++) {
    const fall = (seconds * (1.7 + (streak % 5) * 0.22) + scatter(streak, 1)) % 1;
    const long = 26 + (streak % 4) * 11 + amount * 34;
    // Each starts above the view, and far enough to one side to slant in.
    const y = fall * height * 1.1 - 60;
    const x = scatter(streak, 2) * (width + Math.abs(drift)) - Math.max(drift, 0) + (y * lean.x) / lean.y;
    ctx.moveTo(x, y);
    ctx.lineTo(x + lean.x * long, y + lean.y * long);
  }
  ctx.lineWidth = 1.5 + amount * 1.5;
  ctx.strokeStyle = `rgba(206, 220, 230, ${0.3 + 0.3 * amount})`;
  ctx.stroke();
}

/**
 * Paints the windshield view.
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('./rules.js').GameState} state
 * @param {import('./rules.js').Tuning} day The numbers today plays by.
 */
export function drawWindshield(ctx, state, day) {
  const { width, height } = ctx.canvas;
  const horizon = height * 0.62;
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  // Everything that moves by itself keeps time by the clock.
  const seconds = performance.now() / 1000;
  drawSkyAndGround(ctx, state, seconds, horizon);

  const { storm } = state;
  drawTornado(ctx, state, seconds, horizon);

  // The trees and poles along the horizon stand in front of the tornado.
  drawTreeLine(ctx, state, day, seconds, horizon);

  // The weather between the car and the tornado. Each streak of rain, bit of
  // debris or hailstone keeps its own track, worked out from its number and
  // the clock.
  drawRain(ctx, state, day, seconds);

  // art/inside-tornado.png: the direct hit. The tornado is all around, so
  // its wall fills the view and whirls past.
  const direct = insideTornado(state, day);
  if (direct) {
    ctx.fillStyle = '#14181d';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#262d35';
    for (let i = 0; i < 9; i++) {
      const across = (seconds * 0.9 + i / 9) % 1;
      ctx.fillRect(across * width * 1.2 - width * 0.2, 0, width * 0.06, height);
    }
    label(ctx, 'art/inside-tornado.png', width * 0.05, height * 0.13);
  }

  // art/debris.png: debris flies across the scene while it is hitting the car.
  if (inDebrisZone(state, day)) {
    ctx.fillStyle = '#6b4a2b';
    for (let i = 0; i < 24; i++) {
      const across = (seconds * (0.9 + (i % 5) * 0.25) + i * 0.137) % 1;
      const y = horizon * (0.15 + ((i * 0.61) % 1) * 0.95) + Math.sin(seconds * 6 + i) * 20;
      const size = 14 + (i % 4) * 9;
      ctx.fillRect(across * width, y, size * 1.6, size);
    }
    label(ctx, 'art/debris.png', width * 0.05, height * 0.2);
  }

  // art/hail.png: hail falls, and bounces off the ground: a few stones just
  // outside the hail core, and a barrage inside it.
  const stones = Math.ceil(hailAmount(state.car, storm, day) * 90);
  if (stones) {
    ctx.fillStyle = '#eef4f8';
    for (let i = 0; i < stones; i++) {
      const fall = (seconds * (1.6 + (i % 3) * 0.4) + i * 0.071) % 1.25;
      const x = ((i * 0.618) % 1) * width;
      // Past the ground, the stone hops back up a little before it is gone.
      const y = fall <= 1 ? fall * horizon * 1.25 : horizon * 1.25 - Math.sin((fall - 1) * 4 * Math.PI) * 40;
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.fill();
    }
    label(ctx, 'art/hail.png', width * 0.05, height * 0.27);
  }

  // art/skirts.png: the skirts come down over the bottom of the windows as
  // the vehicle anchors.
  if (state.anchor > 0) {
    ctx.fillStyle = '#39424c';
    ctx.fillRect(0, height * (0.86 - 0.08 * state.anchor), width, height * 0.08 * state.anchor);
    label(ctx, 'art/skirts.png', width * 0.8, height * (0.86 - 0.08 * state.anchor) + 6);
  }

  // art/dashboard.png: the dashboard along the bottom and a pillar each side.
  ctx.fillStyle = '#0d0f12';
  ctx.fillRect(0, height * 0.86, width, height * 0.14);
  ctx.fillRect(0, 0, width * 0.035, height);
  ctx.fillRect(width * 0.965, 0, width * 0.035, height);
  label(ctx, 'art/dashboard.png', width * 0.05, height * 0.9);

  // art/dash-radar.png: the dash radar stands on the dashboard, to the right.
  if (day.dashRadar) {
    const box = { left: width * 0.72, top: height * 0.6, wide: width * 0.22, tall: height * 0.25 };
    drawDashRadar(ctx, state, box, day);
    label(ctx, 'art/dash-radar.png', box.left + 10, box.top + 8);
  }

  // The viewfinder box: red while the tornado is inside it and being filmed.
  // Inside the tornado there is nothing to aim at, and no box.
  const filming = direct || tornadoInFrame(state, day);
  if (!direct) {
    const boxWide = (day.camera.viewfinderDegrees / tuning.camera.viewDegrees) * width;
    ctx.lineWidth = 5;
    ctx.strokeStyle = filming ? '#ff4d4d' : '#dce6ee';
    ctx.strokeRect((width - boxWide) / 2, height * 0.12, boxWide, height * 0.62);
  }

  // The counter of seconds filmed.
  ctx.fillStyle = filming ? '#ff4d4d' : '#dce6ee';
  ctx.font = 'bold 54px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.fillText(`${filming ? '● REC' : 'REC'}  ${state.footage.toFixed(1)} s`, width * 0.95, height * 0.035);

  ctx.font = '40px system-ui, sans-serif';
  ctx.textAlign = 'center';
  if (direct) {
    ctx.fillText('DIRECT HIT! Filming from inside the tornado.', width / 2, height * 0.5);
  } else if (filming && payPerSecond(milesToFunnel(state), day) === 0) {
    // In the box but outside the footage ring: say why it is not paying.
    const words = day.footage.ringMiles > 0 ? 'Too far away to sell. Get inside the footage ring.' : 'Too far away to sell. Only a direct hit pays today.';
    ctx.fillText(words, width / 2, height * 0.76);
  }

  // What the skirts and spikes are doing, for a vehicle that has them.
  if (day.anchor.ringTimes !== undefined) {
    const wait = anchorWait(state, day).toFixed(1);
    let words = 'A: anchor';
    if (state.anchoring) words = state.anchor < 1 ? `Anchoring… ${wait} s` : 'ANCHORED.  A: pull up';
    else if (state.anchor > 0) words = `Pulling up… ${wait} s`;
    ctx.fillStyle = state.anchor >= 1 ? '#9be28c' : '#dce6ee';
    ctx.textBaseline = 'middle';
    ctx.fillText(words, width / 2, height * 0.93);
  }
}
