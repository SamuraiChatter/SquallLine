import assert from 'node:assert/strict';
import { test } from 'node:test';
import { headHome, newGame, payPerSecond, step, toggleFilming, tornadoInFrame } from './rules.js';

// The tests bring their own numbers, so retuning the game never breaks them.
const tuning = {
  carMilesPerSecond: 2,
  territoryMilesWide: 60,
  territoryMilesTall: 40,
  storm: { path: [{ x: 0, y: 0 }, { x: 1, y: 0 }], milesPerSecond: 1, hookLead: 0.1, tornadoes: [] },
  camera: { viewfinderDegrees: 20, panDegreesPerSecond: 30 },
  footage: { ringMiles: 10, payAtEdge: 10, payAtTornado: 110 },
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
  assert.deepEqual(far.car, { x: 30, y: -20 });
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
  const noTornadoes = { ...stormTuning, storm: { ...stormTuning.storm, tornadoes: [] } };
  const { x, y } = stormAfter(100, noTornadoes);
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

// Filming. The viewfinder box is 20 degrees wide and the camera pans 30
// degrees a second.
const filmTuning = stormTuning;

/**
 * A game with a tornado on the ground and the car parked due south of it.
 * @param {number} [miles]
 */
function parkedSouthOfTornado(miles = 5) {
  let state = newGame(filmTuning);
  for (let i = 0; i < 44; i++) state = step(state, still, 0.25, filmTuning);
  return { ...state, car: { x: state.storm.funnel.x, y: state.storm.funnel.y - miles } };
}

test('pulling over to film points the camera at the tornado', () => {
  const state = toggleFilming(parkedSouthOfTornado());
  assert.equal(state.filming, true);
  assert.equal(state.camera, 0);
});

test('pulling over a second time goes back to driving', () => {
  assert.equal(toggleFilming(toggleFilming(parkedSouthOfTornado())).filming, false);
});

test('the arrows do not move the car while filming', () => {
  const parked = toggleFilming(parkedSouthOfTornado());
  assert.deepEqual(step(parked, { x: 1, y: 1 }, 1, filmTuning).car, parked.car);
});

test('left and right pan the camera', () => {
  const parked = toggleFilming(parkedSouthOfTornado());
  assert.equal(step(parked, { x: 1, y: 0 }, 1, filmTuning).camera, 30);
  assert.equal(step(parked, { x: -1, y: 0 }, 1, filmTuning).camera, 330);
});

test('the tornado is in frame only inside the viewfinder box', () => {
  const parked = toggleFilming(parkedSouthOfTornado());
  assert.equal(tornadoInFrame({ ...parked, camera: 9 }, filmTuning), true);
  assert.equal(tornadoInFrame({ ...parked, camera: 11 }, filmTuning), false);
  assert.equal(tornadoInFrame({ ...parked, camera: 355 }, filmTuning), true);
});

test('with no tornado on the ground, nothing is in frame', () => {
  assert.equal(tornadoInFrame(toggleFilming(newGame(filmTuning)), filmTuning), false);
});

test('footage counts while the tornado is in the box', () => {
  const parked = toggleFilming(parkedSouthOfTornado());
  assert.equal(step(parked, still, 0.5, filmTuning).footage, 0.5);
});

test('footage does not count once the camera has panned off the tornado', () => {
  const parked = { ...toggleFilming(parkedSouthOfTornado()), camera: 40 };
  assert.equal(step(parked, still, 0.5, filmTuning).footage, 0);
});

test('footage does not count while driving', () => {
  assert.equal(step(parkedSouthOfTornado(), still, 0.5, filmTuning).footage, 0);
});

test('the storm keeps moving while the player films', () => {
  const parked = toggleFilming(parkedSouthOfTornado());
  assert.equal(step(parked, still, 1, filmTuning).storm.miles, parked.storm.miles + 1);
});

// Pay. The footage ring is 10 miles out; a second of footage pays 10 at its
// edge, rising to 110 right at the tornado.

test('footage from outside the ring pays nothing', () => {
  assert.equal(payPerSecond(10.5, filmTuning), 0);
});

test('footage pays more the closer the car is', () => {
  assert.equal(payPerSecond(10, filmTuning), 10);
  assert.equal(payPerSecond(5, filmTuning), 60);
  assert.equal(payPerSecond(0, filmTuning), 110);
});

test('filming from inside the ring earns money', () => {
  const parked = toggleFilming(parkedSouthOfTornado(5));
  assert.ok(step(parked, still, 0.5, filmTuning).money > 0);
});

test('filming from outside the ring earns nothing', () => {
  const parked = toggleFilming(parkedSouthOfTornado(12));
  assert.equal(step(parked, still, 0.5, filmTuning).money, 0);
});

test('the same seconds pay more from half way into the ring than from its edge', () => {
  const near = step(toggleFilming(parkedSouthOfTornado(5)), still, 0.5, filmTuning).money;
  const far = step(toggleFilming(parkedSouthOfTornado(9)), still, 0.5, filmTuning).money;
  assert.ok(near > far && far > 0);
});

test('the day ends when the last tornado dies, and the earnings join the balance', () => {
  let state = { ...parkedSouthOfTornado(), money: 50 };
  for (let i = 0; i < 20; i++) state = step(state, still, 0.25, filmTuning);
  assert.equal(state.dayOver, true);
  assert.equal(state.balance, 50);
});

test('heading home ends the day early with the same sums', () => {
  const state = headHome({ ...parkedSouthOfTornado(), money: 50 });
  assert.equal(state.dayOver, true);
  assert.equal(state.balance, 50);
});

test('once the day is over nothing moves', () => {
  const done = headHome(parkedSouthOfTornado());
  assert.deepEqual(step(done, { x: 1, y: 1 }, 5, filmTuning), done);
});
