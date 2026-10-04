// The rules of the game. Each rule takes the game as it is now and gives back
// the game as it is next. Nothing in here touches the canvas or the page, so
// the rules also run under Node, which is where the tests check them.

/**
 * A place on the map, in miles east and north of the middle of the territory.
 * @typedef {{ x: number, y: number }} Point
 */

/**
 * The storm at one moment.
 * @typedef {object} Storm
 * @property {number} miles How far along its path the storm has travelled.
 * @property {number} x
 * @property {number} y
 * @property {number} hook How far the hook has grown and tightened: 0 is no
 *   hook, 1 is a full hook with a tornado due or on the ground.
 * @property {number} tornado How big the tornado is: 0 is no tornado, 1 is
 *   full size. There is only ever one.
 */

/**
 * The whole game at one moment.
 * @typedef {object} GameState
 * @property {Point} car
 * @property {Storm} storm
 */

/**
 * Which way the player is steering: x is 1 for east and -1 for west, y is 1
 * for north and -1 for south, and 0 means not that way at all.
 * @typedef {{ x: number, y: number }} Steering
 */

/** @typedef {Pick<typeof import('../tuning.js').tuning, 'carMilesPerSecond' | 'territoryMiles' | 'storm'>} Tuning */

/**
 * @param {Tuning} tuning
 * @returns {GameState}
 */
export function newGame(tuning) {
  return { car: { x: 0, y: 0 }, storm: stormAt(0, tuning.storm) };
}

/**
 * Moves the game on by a moment.
 * @param {GameState} state
 * @param {Steering} steering
 * @param {number} dt Seconds since the last step.
 * @param {Tuning} tuning
 * @returns {GameState}
 */
export function step(state, steering, dt, tuning) {
  // Two arrows at once share the speed, so a diagonal is no faster.
  const miles = (tuning.carMilesPerSecond * dt) / (Math.hypot(steering.x, steering.y) || 1);
  const edge = tuning.territoryMiles / 2;
  /** @param {number} n */
  const inside = (n) => Math.max(-edge, Math.min(edge, n));
  return {
    ...state,
    car: {
      x: inside(state.car.x + steering.x * miles),
      y: inside(state.car.y + steering.y * miles),
    },
    storm: stormAt(state.storm.miles + tuning.storm.milesPerSecond * dt, tuning.storm),
  };
}

/**
 * The storm once it has travelled this many miles along its path.
 * @param {number} miles
 * @param {Tuning['storm']} tuning
 * @returns {Storm}
 */
function stormAt(miles, tuning) {
  const { path } = tuning;
  const legs = path.slice(1).map((to, i) => Math.hypot(to.x - path[i].x, to.y - path[i].y));
  const length = legs.reduce((sum, leg) => sum + leg, 0);
  miles = Math.min(miles, length);

  // Walk the legs of the path until the miles run out.
  let left = miles;
  let i = 0;
  while (i < legs.length - 1 && left > legs[i]) left -= legs[i++];
  const share = legs[i] ? left / legs[i] : 0;
  const x = path[i].x + (path[i + 1].x - path[i].x) * share;
  const y = path[i].y + (path[i + 1].y - path[i].y) * share;

  // Where the storm is as a share of the whole path: 0 at the start, 1 at
  // the end. The tornadoes are set out in these shares.
  const along = length ? miles / length : 1;
  const onGround = tuning.tornadoes.find((t) => along >= t.start && along < t.end);
  const next = tuning.tornadoes.find((t) => t.start > along);

  let hook = 0;
  let tornado = 0;
  if (onGround) {
    hook = 1;
    // Full size at first, shrinking to nothing over its last third.
    tornado = Math.min(1, (3 * (onGround.end - along)) / (onGround.end - onGround.start));
  } else if (next) {
    hook = Math.max(0, 1 - (next.start - along) / tuning.hookLead);
  }
  return { miles, x, y, hook, tornado };
}
