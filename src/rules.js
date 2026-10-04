// The rules of the game. Each rule takes the game as it is now and gives back
// the game as it is next. Nothing in here touches the canvas or the page, so
// the rules also run under Node, which is where the tests check them.

/**
 * The whole game at one moment.
 * @typedef {object} GameState
 * @property {number} seconds How long the game has been running.
 */

/** @returns {GameState} */
export function newGame() {
  return { seconds: 0 };
}

/**
 * Moves the game on by a moment.
 * @param {GameState} state
 * @param {number} dt Seconds since the last step.
 * @returns {GameState}
 */
export function step(state, dt) {
  return { ...state, seconds: state.seconds + dt };
}
