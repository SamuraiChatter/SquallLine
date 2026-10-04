import assert from 'node:assert/strict';
import { test } from 'node:test';
import { newGame, step } from './rules.js';

// The tests bring their own numbers, so retuning the game never breaks them.
const tuning = {
  carMilesPerSecond: 2,
  territoryMiles: 60,
  storm: { path: [{ x: 0, y: 0 }, { x: 1, y: 0 }], milesPerSecond: 1, hookLead: 0.1, tornadoes: [] },
};

test('a new game starts with the car in the middle of the territory', () => {
  assert.deepEqual(newGame(tuning).car, { x: 0, y: 0 });
});

test('holding north drives the car north', () => {
  const state = step(newGame(tuning), { x: 0, y: 1 }, 1.5, tuning);
  assert.deepEqual(state.car, { x: 0, y: 3 });
});

test('holding south, east or west drives the car that way', () => {
  assert.deepEqual(step(newGame(tuning), { x: 0, y: -1 }, 1, tuning).car, { x: 0, y: -2 });
  assert.deepEqual(step(newGame(tuning), { x: 1, y: 0 }, 1, tuning).car, { x: 2, y: 0 });
  assert.deepEqual(step(newGame(tuning), { x: -1, y: 0 }, 1, tuning).car, { x: -2, y: 0 });
});

test('letting go stops the car where it is', () => {
  const driven = step(newGame(tuning), { x: 1, y: 0 }, 1, tuning);
  assert.deepEqual(step(driven, { x: 0, y: 0 }, 5, tuning).car, { x: 2, y: 0 });
});

test('the car cannot leave the territory', () => {
  const far = step(newGame(tuning), { x: 1, y: -1 }, 100, tuning);
  assert.deepEqual(far.car, { x: 30, y: -30 });
});

test('driving on a diagonal is no faster than driving straight', () => {
  const { car } = step(newGame(tuning), { x: 1, y: 1 }, 1, tuning);
  assert.ok(Math.abs(Math.hypot(car.x, car.y) - 2) < 1e-9);
});

// A storm path with easy numbers: 10 miles east, then 10 miles north, at one
// mile a second. One tornado from half way to three quarters of the way, with
// the hook starting a quarter of the way before it.
const stormTuning = {
  ...tuning,
  storm: {
    path: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }],
    milesPerSecond: 1,
    hookLead: 0.25,
    tornadoes: [{ start: 0.5, end: 0.75 }],
  },
};
const still = { x: 0, y: 0 };

/**
 * The storm after so many seconds, stepped a little at a time like the game.
 * @param {number} seconds
 * @param {typeof stormTuning} [withTuning]
 */
function stormAfter(seconds, withTuning = stormTuning) {
  let state = newGame(withTuning);
  for (let i = 0; i < seconds * 4; i++) state = step(state, still, 0.25, withTuning);
  return state.storm;
}

test('the storm starts at the beginning of its path', () => {
  const { x, y } = newGame(stormTuning).storm;
  assert.deepEqual({ x, y }, { x: 0, y: 0 });
});

test('the storm travels along its path, around the corner', () => {
  const early = stormAfter(5);
  assert.deepEqual({ x: early.x, y: early.y }, { x: 5, y: 0 });
  const later = stormAfter(15);
  assert.deepEqual({ x: later.x, y: later.y }, { x: 10, y: 5 });
});

test('the storm stops at the end of its path', () => {
  const { x, y } = stormAfter(100);
  assert.deepEqual({ x, y }, { x: 10, y: 10 });
});

test('early on there is no hook and no tornado', () => {
  const { hook, tornado } = stormAfter(4);
  assert.deepEqual({ hook, tornado }, { hook: 0, tornado: 0 });
});

test('a hook grows before the tornado touches down', () => {
  const { hook, tornado } = stormAfter(7.5);
  assert.deepEqual({ hook, tornado }, { hook: 0.5, tornado: 0 });
});

test('the tornado touches down at full size with the hook wound tight', () => {
  const { hook, tornado } = stormAfter(11);
  assert.deepEqual({ hook, tornado }, { hook: 1, tornado: 1 });
});

test('the tornado shrinks near the end of its life', () => {
  assert.ok(Math.abs(stormAfter(14).tornado - 0.6) < 1e-9);
});

test('the tornado dies and the hook goes with it', () => {
  const { hook, tornado } = stormAfter(16);
  assert.deepEqual({ hook, tornado }, { hook: 0, tornado: 0 });
});

test('the storm makes as many tornadoes as the tuning lists', () => {
  const three = {
    ...stormTuning,
    storm: {
      ...stormTuning.storm,
      tornadoes: [{ start: 0.1, end: 0.2 }, { start: 0.4, end: 0.5 }, { start: 0.7, end: 0.9 }],
    },
  };
  let touchdowns = 0;
  let state = newGame(three);
  for (let i = 0; i < 100; i++) {
    const next = step(state, still, 0.25, three);
    if (state.storm.tornado === 0 && next.storm.tornado > 0) touchdowns++;
    state = next;
  }
  assert.equal(touchdowns, 3);
});
