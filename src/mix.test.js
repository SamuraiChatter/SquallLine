import assert from 'node:assert/strict';
import { test } from 'node:test';
import { silence, soundMix } from './mix.js';
import { buildNetwork } from './roads.js';
import { beginChase, funnelOf, hailCore, newGame } from './rules.js';

// The tests bring their own numbers, so retuning the game never breaks them.
// The tornado's wind reaches 10 miles, and the car lets in half the sound.
const tuning = {
  carMilesPerSecond: 2,
  carStart: { x: 0, y: 0 },
  territoryMilesWide: 60,
  territoryMilesTall: 40,
  storm: { path: [{ x: 0, y: 0 }, { x: 1, y: 0 }], milesPerSecond: 1, hookLead: 0.1, tornadoes: [] },
  camera: { viewfinderDegrees: 20, panDegreesPerSecond: 30 },
  footage: { ringMiles: 10, payAtEdge: 10, payAtTornado: 110 },
  danger: { ringMiles: 4, windDamageAtTornado: 0.8, flipMiles: 0.5, fullRepairCost: 400 },
  debris: { zoneMiles: 1, strikeEverySeconds: 0.5, damagePerStrike: 0.1 },
  hail: { coreMilesLong: 2, coreMilesWide: 1, damagePerSecond: 0.2 },
  anchor: { downSeconds: 2, upSeconds: 1 },
  wind: { mphAtTornado: [100, 120, 140, 160, 180, 200], reachMiles: 10, bonusPerMph: 2 },
  radar: { sweepSeconds: 4, vortexHook: 0.85 },
  spotters: { everySeconds: 3, offMiles: 1, ringSeconds: 5, wordsSeconds: 2, funnelCloudHook: 0.85 },
};
const sound = { loudness: 1, breeze: 0.1, inCarLoudness: 0.5, files: { wind: '', hail: '', thud: '', beep: '' } };
const roads = buildNetwork([[{ x: -30, y: 0 }, { x: 30, y: 0 }]]);

// A storm far to the north-east, clear of the car, with a tornado on the
// ground or without one.
const storm = { x: 20, y: 15 };
/**
 * A chase with the car this many miles west of the tornado.
 * @param {number} miles
 * @param {Partial<import('./rules.js').GameState>} [more]
 * @param {number} [tornado]
 * @returns {import('./rules.js').GameState}
 */
function chase(miles, more = {}, tornado = 1) {
  const game = beginChase(newGame(tuning, roads));
  const funnel = funnelOf(storm);
  return { ...game, storm: { ...game.storm, ...storm, funnel, tornado }, car: { x: funnel.x - miles, y: funnel.y }, ...more };
}
/** @param {import('./rules.js').GameState} state */
const mixOf = (state) => soundMix(state, tuning, sound);

test('the wind grows steadily louder and deeper as the car nears a tornado', () => {
  const miles = [12, 10, 8, 6, 4, 2, 0];
  const mixes = miles.map((far) => mixOf(chase(far)));
  for (let i = 2; i < mixes.length; i++) {
    assert.ok(mixes[i].wind > mixes[i - 1].wind);
    assert.ok(mixes[i].near > mixes[i - 1].near);
  }
  assert.equal(mixes.at(-1)?.wind, 1);
  // Driving away quiets it by the same steps.
  assert.ok(mixOf(chase(8)).wind < mixOf(chase(2)).wind);
});

test('out of the tornado\'s reach, or with no tornado, there is only the breeze', () => {
  assert.equal(mixOf(chase(12)).wind, 0.1);
  assert.equal(mixOf(chase(10)).near, 0);
  assert.equal(mixOf(chase(1, {}, 0)).wind, 0.1);
});

test('the wind grows in as the tornado touches down', () => {
  assert.ok(mixOf(chase(2, {}, 0.5)).wind < mixOf(chase(2)).wind);
});

test('the wind and hail are louder outside filming than inside the car, at the same spot', () => {
  const driving = mixOf(chase(3));
  const filming = mixOf(chase(3, { filming: true }));
  assert.equal(driving.wind, filming.wind);
  assert.equal(driving.loud, 0.5);
  assert.equal(filming.loud, 1);
  assert.equal(driving.outside, false);
  assert.equal(filming.outside, true);
});

test('hail is heard only inside the hail core', () => {
  const core = hailCore(chase(3).storm, tuning);
  assert.equal(mixOf(chase(3)).hail, false);
  assert.equal(mixOf({ ...chase(3), car: { x: core.x, y: core.y } }).hail, true);
});

test('footage counts while filming with the tornado in the viewfinder', () => {
  // The tornado is due east of the car: 90 degrees round from north.
  assert.equal(mixOf(chase(3, { filming: true, camera: 90 })).counting, true);
  assert.equal(mixOf(chase(3, { filming: true, camera: 180 })).counting, false);
  assert.equal(mixOf(chase(3, { camera: 90 })).counting, false);
  assert.equal(mixOf(chase(3, { filming: true, camera: 90 }, 0)).counting, false);
});

test('there is nothing to hear during the briefing or once the day is over', () => {
  assert.equal(mixOf(chase(1, { briefing: true })), silence);
  assert.equal(mixOf(chase(1, { dayOver: true })), silence);
});
