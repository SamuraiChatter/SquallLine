// The sums behind the filming view's scenery: how dark the sky is in each
// direction, and how the trees move in the wind. Nothing in here touches the
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
