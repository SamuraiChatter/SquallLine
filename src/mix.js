// The sums behind the sound: how loud the wind and hail are at any moment of
// a chase, and whether the camera is counting footage. They never touch the
// page or make a sound, so they run under Node, where the tests check them.
// sound.js turns the answers into sound.

import { footageCounting, inHailCore, milesToFunnel } from './rules.js';

/**
 * What can be heard at one moment.
 * @typedef {object} Mix
 * @property {number} wind How loud the wind is: 0 is silent, 1 is the wind
 *   right at a tornado.
 * @property {number} near How close a tornado on the ground is: 0 is out of
 *   earshot, or no tornado; 1 is right at it. The wind deepens as this rises.
 * @property {boolean} hail True while hail is hitting the car.
 * @property {boolean} outside True while filming: the player is out of the
 *   car, so nothing is muffled.
 * @property {number} loud How loud the wind and hail come through: 1 when
 *   outside, less from inside the car.
 * @property {boolean} counting True while footage is counting.
 */

/**
 * Nothing to hear: no chase is under way.
 * @type {Mix}
 */
export const silence = { wind: 0, near: 0, hail: false, outside: false, loud: 0, counting: false };

/**
 * What can be heard right now.
 * @param {import('./rules.js').GameState} state
 * @param {import('./rules.js').Tuning} tuning
 * @param {import('./rules.js').TuningFile['sound']} sound
 * @returns {Mix}
 */
export function soundMix(state, tuning, sound) {
  if (state.briefing || state.dayOver) return silence;
  const { storm } = state;
  // The tornado's wind dies away over the same miles as the roof gauge's
  // reading, and grows in as the tornado does.
  const near = Math.min(1, storm.tornado) * Math.max(0, 1 - milesToFunnel(state) / tuning.wind.reachMiles);
  return {
    wind: sound.breeze + (1 - sound.breeze) * near,
    near,
    hail: inHailCore(state.car, storm, tuning),
    outside: state.filming,
    loud: state.filming ? 1 : sound.inCarLoudness,
    counting: footageCounting(state, tuning),
  };
}
