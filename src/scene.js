// The sums behind the filming view's scenery: how dark the sky is in each
// direction, how the trees move in the wind, and the shape of the tornado. Nothing in here touches the
// canvas or the page, so it runs under Node for the tests.

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
