// The rules of the game. Each rule takes the game as it is now and gives back
// the game as it is next. Nothing in here touches the canvas or the page, so
// the rules also run under Node, which is where the tests check them.

/**
 * The whole game at one moment.
 * @typedef {object} GameState
 * @property {{ x: number, y: number }} car Where the car is, in miles east
 *   and north of the middle of the territory.
 */

/**
 * Which way the player is steering: x is 1 for east and -1 for west, y is 1
 * for north and -1 for south, and 0 means not that way at all.
 * @typedef {{ x: number, y: number }} Steering
 */

/** @typedef {Pick<typeof import('../tuning.js').tuning, 'carMilesPerSecond' | 'territoryMiles'>} Tuning */

/** @returns {GameState} */
export function newGame() {
  return { car: { x: 0, y: 0 } };
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
  };
}
