// The sums behind the sound: how loud the wind and hail are at any moment of
// a chase, whether the camera is counting footage, and how far the music has
// built. They never touch the
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

/**
 * What the music is doing at one moment.
 * @typedef {object} Music
 * @property {boolean} playing True while driving in a chase: the music plays
 *   only in the car.
 * @property {number} intensity How far the music has built: 0 is only the
 *   drone and crackle, 1 is everything.
 */

/**
 * No music: no chase is under way, or the player is out of the car filming.
 * @type {Music}
 */
export const noMusic = { playing: false, intensity: 0 };

/**
 * What the music is doing right now. It builds as the car closes in on a
 * tornado. With none on the ground it follows the storm's hook, and stays in
 * its quieter half.
 * @param {import('./rules.js').GameState} state
 * @param {import('./rules.js').TuningFile['music']} music
 * @returns {Music}
 */
export function musicMix(state, music) {
  if (state.briefing || state.dayOver || state.filming) return noMusic;
  const { storm } = state;
  const { startMiles, peakMiles } = music;
  const close = Math.max(0, Math.min(1, (startMiles - milesToFunnel(state)) / Math.max(startMiles - peakMiles, 0.001)));
  // A full hook counts for half a tornado.
  const danger = Math.max(Math.min(1, storm.tornado), 0.5 * Math.min(1, storm.hook));
  return { playing: true, intensity: close * danger };
}

/**
 * How far something has come between two marks, from 0 at or before the
 * first to 1 at or past the second.
 * @param {number} from
 * @param {number} to
 * @param {number} at
 */
const between = (from, to, at) => Math.max(0, Math.min(1, (at - from) / (to - from)));

/**
 * How loud each part of the music is at an intensity, each from 0 to 1. The
 * drone and crackle always play. The beat comes in first, then gets busier,
 * and the bass thump joins last. Each part fades in over a stretch, so
 * nothing jumps.
 * @param {number} intensity
 */
export function musicLayers(intensity) {
  return {
    beat: between(0.15, 0.4, intensity),
    busy: between(0.45, 0.75, intensity),
    thump: between(0.7, 0.9, intensity),
  };
}
