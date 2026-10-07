// The sums behind the filming view's scenery: how dark the sky is in each
// direction, how the trees move in the wind, the shape of the tornado, and
// how much rain and hail falls. Nothing in here touches the canvas or the
// page, so it runs under Node for the tests.

import { faintestDbz } from './radar.js';
import { hailCoreOut } from './rules.js';

// The sky is at its darkest toward the tornado, and no darker than anywhere
// else this many degrees round from it.
const darkSkyDegrees = 120;
// The wind, in miles an hour, that bends a tree as far over as it will go.
const fullLeanMph = 150;
// How far a tree leans in that wind, and how far it sways each way in none
// and in that wind, all in radians. 0.7 is about 40 degrees.
const fullLean = 0.7;
const calmSway = 0.03;
const fullSway = 0.2;
// How fast a tree sways in no wind, and in that wind: a full sway takes about
// six seconds, down to under one.
const calmSwaySpeed = 1;
const fullSwaySpeed = 9;

/**
 * How dark the storm makes the sky in one direction.
 * @param {number} offDegrees How many degrees round from the tornado that
 *   direction is, either way.
 * @returns {number} From 1, right at the tornado, down to 0.
 */
export function skyDarkness(offDegrees) {
  return Math.max(0, 1 - Math.abs(offDegrees) / darkSkyDegrees) ** 2;
}

/**
 * How far a tree is leaning at one moment. It leans steadily toward the
 * tornado, more the harder the wind blows, and sways about that: gently in
 * still air, and harder and faster as the wind rises.
 * @param {number} mph The wind at the car, as the roof gauge reads it.
 * @param {number} toward Which side of the tree the tornado is on the screen:
 *   1 for its right, -1 for its left, and in between for a tornado nearly in
 *   line with the tree.
 * @param {number} seconds The clock.
 * @param {number} tree Which tree, so that they do not all sway together.
 * @returns {number} The lean in radians. More than zero leans to the right.
 */
export function treeLean(mph, toward, seconds, tree) {
  const blow = Math.min(Math.max(mph, 0) / fullLeanMph, 1);
  const sway = Math.sin(seconds * (calmSwaySpeed + blow * (fullSwaySpeed - calmSwaySpeed)) + tree * 1.7);
  return toward * blow * fullLean + sway * (calmSway + blow * (fullSway - calmSway));
}

// The tornado's shape, weakest first: a rope for EF0 and EF1, a cone for EF2
// and EF3, a wedge for EF4 and EF5. Each is so wide at the cloud and at the
// ground, from its middle to its edge, as a share of how tall it is.
const shapes = [
  { name: 'rope', top: 0.09, foot: 0.03 },
  { name: 'cone', top: 0.3, foot: 0.05 },
  { name: 'wedge', top: 0.55, foot: 0.3 },
];
// How far down toward the ground a funnel reaches just before it touches
// down, as a share of the way.
const aloftReach = 0.85;
// How thin a dying tornado gets before it is gone, as a share of its full
// width.
const dyingWidth = 0.35;

/**
 * The shape of a tornado of some strength.
 * @param {number} strength From 0 for EF0 to 5 for EF5.
 */
export function tornadoShape(strength) {
  return shapes[Math.max(0, Math.min(shapes.length - 1, Math.floor(strength / 2)))];
}

/**
 * How far down from the cloud base the funnel reaches. A funnel starts down
 * as a real tornado's hook finishes growing, and is on the ground once the
 * tornado is. A false alarm never grows one.
 * @param {Pick<import('./rules.js').Storm, 'tornado' | 'tornadoHook'>} storm
 * @param {number} funnelCloudHook How far the hook has grown when the
 *   funnel starts down: the same moment spotters start to say "funnel cloud".
 * @returns {number} From 0, no funnel, to 1, on the ground.
 */
export function funnelReach(storm, funnelCloudHook) {
  if (storm.tornado > 0) return 1;
  if (funnelCloudHook >= 1) return 0;
  return Math.max(0, Math.min(1, (storm.tornadoHook - funnelCloudHook) / (1 - funnelCloudHook))) * aloftReach;
}

/**
 * How wide the funnel is at some height, from its middle to its edge, as a
 * share of how tall a full tornado is.
 * @param {number} strength From 0 for EF0 to 5 for EF5.
 * @param {number} down How far down the funnel: 0 is at the cloud, 1 is its
 *   bottom end.
 * @param {number} tornado How big the tornado on the ground is, from 0 to 1,
 *   or 0 for a funnel that has not touched down.
 */
export function funnelHalfWidth(strength, down, tornado) {
  const { top, foot } = tornadoShape(strength);
  // A funnel still in the air narrows to a point.
  if (tornado <= 0) return top * (1 - down) ** 1.2;
  // On the ground it narrows quickly below the cloud, then more slowly. A
  // dying tornado thins out to a rope.
  const thin = dyingWidth + (1 - dyingWidth) * Math.min(tornado, 1);
  return (top + (foot - top) * down ** 0.6) * thin;
}

// How hard it has to rain, in dBZ, for the rain to be a blinding sheet: where
// the radar's red sets in. The lightest rain the radar shows falls as this
// much of that.
const sheetDbz = 55;
const lightestRain = 0.08;
// How far rain slants in still air and in the wind that bends a tree right
// over, in radians. 1 is nearly 60 degrees.
const calmSlant = 0.1;
const fullSlant = 1;
// Hail starts this many times the hail core's size out from its middle, with
// this much of a barrage falling at the core's edge. The full barrage falls
// from this far in toward the middle.
const hailStartsAt = 1.5;
const hailAtEdge = 0.15;
const barrageAt = 0.4;

/**
 * How much rain falls on the car, for rain the radar reads as so many dBZ.
 * @param {number} dbz
 * @returns {number} From 0, none, where the radar shows nothing, through a
 *   few thin streaks in its lightest green, to 1, a blinding sheet, in its
 *   red.
 */
export function rainAmount(dbz) {
  if (dbz < faintestDbz) return 0;
  return lightestRain + (1 - lightestRain) * Math.min(1, (dbz - faintestDbz) / (sheetDbz - faintestDbz));
}

/**
 * How far the rain slants from straight down, in radians: more as the wind
 * at the car rises.
 * @param {number} mph The wind at the car, as the roof gauge reads it.
 */
export function rainSlant(mph) {
  return calmSlant + (fullSlant - calmSlant) * Math.min(Math.max(mph, 0) / fullLeanMph, 1);
}

/**
 * How much hail falls at a place: a few stones just outside the storm's hail
 * core, building to a barrage inside it.
 * @param {import('./rules.js').Point} point
 * @param {import('./rules.js').Storm} storm
 * @param {import('./rules.js').Tuning} day The numbers today plays by.
 * @returns {number} From 0, none, to 1, a barrage.
 */
export function hailAmount(point, storm, day) {
  // The same measure that decides where hail damages the car: 1 is the
  // core's edge.
  const out = hailCoreOut(point, storm, day);
  if (out >= hailStartsAt) return 0;
  if (out >= 1) return (hailAtEdge * (hailStartsAt - out)) / (hailStartsAt - 1);
  return hailAtEdge + (1 - hailAtEdge) * Math.min(1, (1 - out) / (1 - barrageAt));
}
