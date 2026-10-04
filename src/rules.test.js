import assert from 'node:assert/strict';
import { test } from 'node:test';
import { newGame, step } from './rules.js';

// The tests bring their own numbers, so retuning the game never breaks them.
const tuning = { carMilesPerSecond: 2, territoryMiles: 60 };

test('a new game starts with the car in the middle of the territory', () => {
  assert.deepEqual(newGame().car, { x: 0, y: 0 });
});

test('holding north drives the car north', () => {
  const state = step(newGame(), { x: 0, y: 1 }, 1.5, tuning);
  assert.deepEqual(state.car, { x: 0, y: 3 });
});

test('holding south, east or west drives the car that way', () => {
  assert.deepEqual(step(newGame(), { x: 0, y: -1 }, 1, tuning).car, { x: 0, y: -2 });
  assert.deepEqual(step(newGame(), { x: 1, y: 0 }, 1, tuning).car, { x: 2, y: 0 });
  assert.deepEqual(step(newGame(), { x: -1, y: 0 }, 1, tuning).car, { x: -2, y: 0 });
});

test('letting go stops the car where it is', () => {
  const driven = step(newGame(), { x: 1, y: 0 }, 1, tuning);
  assert.deepEqual(step(driven, { x: 0, y: 0 }, 5, tuning).car, { x: 2, y: 0 });
});

test('the car cannot leave the territory', () => {
  const far = step(newGame(), { x: 1, y: -1 }, 100, tuning);
  assert.deepEqual(far.car, { x: 30, y: -30 });
});

test('driving on a diagonal is no faster than driving straight', () => {
  const { car } = step(newGame(), { x: 1, y: 1 }, 1, tuning);
  assert.ok(Math.abs(Math.hypot(car.x, car.y) - 2) < 1e-9);
});
