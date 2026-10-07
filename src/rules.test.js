import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildNetwork } from './roads.js';
import { anchorWait, windMph, beginChase, buy, dangerRingMiles, dayTuning, freePlay, insideTornado, hailCore, headHome, inHailCore, newGame, newRun, newSave, nextDay, payPerSecond, readSave, resume, runFinished, saveOf, step, strongest, toggleAnchor, toggleFilming, tornadoInFrame, whyNotBuy, windDamagePerSecond } from './rules.js';

// The tests bring their own numbers, so retuning the game never breaks them.
const tuning = {
  carMilesPerSecond: 2,
  carStart: { x: 0, y: 0 },
  storm: { path: [{ x: 0, y: 0 }, { x: 1, y: 0 }], milesPerSecond: 1, hookLead: 0.1, tornadoes: [] },
  camera: { viewfinderDegrees: 20, panDegreesPerSecond: 30 },
  footage: { ringMiles: 10, payAtEdge: 10, payAtTornado: 110 },
  danger: { ringMiles: 4, windDamageAtTornado: 0.8, flipMiles: 0.5, fullRepairCost: 400 },
  debris: { zoneMiles: 1, strikeEverySeconds: 0.5, damagePerStrike: 0.1 },
  hail: { coreMilesLong: 2, coreMilesWide: 1, damagePerSecond: 0.2 },
  anchor: { downSeconds: 2, upSeconds: 1 },
  wind: { mphAtTornado: [100, 120, 140, 160, 180, 200], reachMiles: 10, bonusPerMph: 2 },
  radar: { sweepSeconds: 4 },
};

// Two roads that cross in the middle of the territory: one from 30 miles west
// to 30 miles east, the other from 20 miles south to 20 miles north. How the
// car picks its way along roads is tested in roads.test.js.
const roads = buildNetwork([
  [{ x: -30, y: 0 }, { x: 0, y: 0 }, { x: 30, y: 0 }],
  [{ x: 0, y: -20 }, { x: 0, y: 0 }, { x: 0, y: 20 }],
]);

test('a new game starts with the car on the road nearest its start point', () => {
  assert.deepEqual(newGame(tuning, roads).car, { x: 0, y: 0 });
  assert.deepEqual(newGame({ ...tuning, carStart: { x: 28, y: 3 } }, roads).car, { x: 30, y: 0 });
});

test('holding north drives the car north', () => {
  const state = step(newGame(tuning, roads), { x: 0, y: 1 }, 1.5, tuning, roads);
  assert.deepEqual(state.car, { x: 0, y: 3 });
});

test('holding south, east or west drives the car that way', () => {
  assert.deepEqual(step(newGame(tuning, roads), { x: 0, y: -1 }, 1, tuning, roads).car, { x: 0, y: -2 });
  assert.deepEqual(step(newGame(tuning, roads), { x: 1, y: 0 }, 1, tuning, roads).car, { x: 2, y: 0 });
  assert.deepEqual(step(newGame(tuning, roads), { x: -1, y: 0 }, 1, tuning, roads).car, { x: -2, y: 0 });
});

test('letting go stops the car where it is', () => {
  const driven = step(newGame(tuning, roads), { x: 1, y: 0 }, 1, tuning, roads);
  assert.deepEqual(step(driven, { x: 0, y: 0 }, 5, tuning, roads).car, { x: 2, y: 0 });
});

test('the car cannot drive past the end of the road', () => {
  const far = step(newGame(tuning, roads), { x: 1, y: 0 }, 100, tuning, roads);
  assert.deepEqual(far.car, { x: 30, y: 0 });
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
  let state = newGame(withTuning, roads);
  for (let i = 0; i < seconds * 4; i++) state = step(state, still, 0.25, withTuning, roads);
  return state.storm;
}

test('the storm starts at the beginning of its path', () => {
  const { x, y } = newGame(stormTuning, roads).storm;
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
  let state = newGame(three, roads);
  for (let i = 0; i < 100; i++) {
    const next = step(state, still, 0.25, three, roads);
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
  let state = newGame(filmTuning, roads);
  for (let i = 0; i < 44; i++) state = step(state, still, 0.25, filmTuning, roads);
  // The storm started on top of the car, so wipe the hail damage from that.
  return { ...state, car: { x: state.storm.funnel.x, y: state.storm.funnel.y - miles }, damage: 0 };
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
  assert.deepEqual(step(parked, { x: 1, y: 1 }, 1, filmTuning, roads).car, parked.car);
});

test('left and right pan the camera', () => {
  const parked = toggleFilming(parkedSouthOfTornado());
  assert.equal(step(parked, { x: 1, y: 0 }, 1, filmTuning, roads).camera, 30);
  assert.equal(step(parked, { x: -1, y: 0 }, 1, filmTuning, roads).camera, 330);
});

test('the tornado is in frame only inside the viewfinder box', () => {
  const parked = toggleFilming(parkedSouthOfTornado());
  assert.equal(tornadoInFrame({ ...parked, camera: 9 }, filmTuning), true);
  assert.equal(tornadoInFrame({ ...parked, camera: 11 }, filmTuning), false);
  assert.equal(tornadoInFrame({ ...parked, camera: 355 }, filmTuning), true);
});

test('with no tornado on the ground, nothing is in frame', () => {
  assert.equal(tornadoInFrame(toggleFilming(newGame(filmTuning, roads)), filmTuning), false);
});

test('footage counts while the tornado is in the box', () => {
  const parked = toggleFilming(parkedSouthOfTornado());
  assert.equal(step(parked, still, 0.5, filmTuning, roads).footage, 0.5);
});

test('footage does not count once the camera has panned off the tornado', () => {
  const parked = { ...toggleFilming(parkedSouthOfTornado()), camera: 40 };
  assert.equal(step(parked, still, 0.5, filmTuning, roads).footage, 0);
});

test('footage does not count while driving', () => {
  assert.equal(step(parkedSouthOfTornado(), still, 0.5, filmTuning, roads).footage, 0);
});

test('the storm keeps moving while the player films', () => {
  const parked = toggleFilming(parkedSouthOfTornado());
  assert.equal(step(parked, still, 1, filmTuning, roads).storm.miles, parked.storm.miles + 1);
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
  assert.ok(step(parked, still, 0.5, filmTuning, roads).money > 0);
});

test('filming from outside the ring earns nothing', () => {
  const parked = toggleFilming(parkedSouthOfTornado(12));
  assert.equal(step(parked, still, 0.5, filmTuning, roads).money, 0);
});

test('the same seconds pay more from half way into the ring than from its edge', () => {
  const near = step(toggleFilming(parkedSouthOfTornado(5)), still, 0.5, filmTuning, roads).money;
  const far = step(toggleFilming(parkedSouthOfTornado(9)), still, 0.5, filmTuning, roads).money;
  assert.ok(near > far && far > 0);
});

test('the day ends when the last tornado dies, and the earnings join the balance', () => {
  let state = { ...parkedSouthOfTornado(), money: 50 };
  for (let i = 0; i < 20; i++) state = step(state, still, 0.25, filmTuning, roads);
  assert.equal(state.dayOver, true);
  assert.equal(state.balance, 50);
});

test('heading home ends the day early with the same sums', () => {
  const state = headHome({ ...parkedSouthOfTornado(), money: 50 }, filmTuning);
  assert.equal(state.dayOver, true);
  assert.equal(state.balance, 50);
});

test('once the day is over nothing moves', () => {
  const done = headHome(parkedSouthOfTornado(), filmTuning);
  assert.deepEqual(step(done, { x: 1, y: 1 }, 5, filmTuning, roads), done);
});

// Damage. The danger ring is 4 miles out. Wind damage climbs steeply from
// nothing at its edge to 0.8 of the meter a second right at the tornado.
// Within half a mile the car flips. A full meter costs 400 to repair.

test('there is no wind damage outside the danger ring', () => {
  assert.equal(windDamagePerSecond(4.5, filmTuning), 0);
});

test('wind damage climbs steeply toward the tornado', () => {
  assert.equal(windDamagePerSecond(4, filmTuning), 0);
  assert.equal(windDamagePerSecond(2, filmTuning), 0.2);
  assert.equal(windDamagePerSecond(0, filmTuning), 0.8);
});

test('outside the danger ring the damage meter does not move', () => {
  assert.equal(step(parkedSouthOfTornado(5), still, 0.25, filmTuning, roads).damage, 0);
});

test('inside the danger ring the meter fills faster the closer the car is', () => {
  const near = step(parkedSouthOfTornado(1), still, 0.25, filmTuning, roads).damage;
  const far = step(parkedSouthOfTornado(3), still, 0.25, filmTuning, roads).damage;
  assert.ok(near > far && far > 0);
});

test('damage applies while filming too', () => {
  const filming = toggleFilming(parkedSouthOfTornado(1));
  assert.ok(step(filming, still, 0.25, filmTuning, roads).damage > 0);
});

test('with no tornado on the ground there is no damage', () => {
  const calm = newGame(filmTuning, roads);
  const atFunnel = { ...calm, car: { ...calm.storm.funnel } };
  assert.equal(step(atFunnel, still, 0.25, filmTuning, roads).damage, 0);
});

test('driving into the tornado flips the car and ends the day', () => {
  const state = step(parkedSouthOfTornado(0), still, 0.25, filmTuning, roads);
  assert.equal(state.wrecked, true);
  assert.equal(state.dayOver, true);
});

test('a full damage meter wrecks the car and ends the day', () => {
  const state = step({ ...parkedSouthOfTornado(1), damage: 0.99 }, still, 0.25, filmTuning, roads);
  assert.equal(state.wrecked, true);
  assert.equal(state.dayOver, true);
});

test('the repair bill is in proportion to the damage', () => {
  const state = headHome({ ...parkedSouthOfTornado(), money: 500, damage: 0.5 }, filmTuning);
  assert.equal(state.repairBill, 200);
  assert.equal(state.balance, 300);
});

test('a wreck still sells its footage, and the balance never goes below zero', () => {
  const state = step({ ...parkedSouthOfTornado(0), money: 300 }, still, 0.25, filmTuning, roads);
  assert.equal(state.repairBill, 400);
  assert.equal(state.balance, 0);
});

test('a day with no damage has no repair bill', () => {
  assert.equal(headHome({ ...parkedSouthOfTornado(), money: 500 }, filmTuning).repairBill, 0);
});

// Debris and hail. Debris strikes within a mile of the tornado, once every
// half second, each adding a tenth of the meter. The hail core is 2 miles
// long (south-west to north-east) and 1 mile wide, and fills a fifth of the
// meter a second.

// The same game with the storm held still, so the car stays where it was put.
const stillStorm = { ...filmTuning, storm: { ...filmTuning.storm, milesPerSecond: 0 } };

/**
 * Steps a game for so many seconds, a quarter second at a time.
 * @param {ReturnType<typeof newGame>} state
 * @param {number} seconds
 * @param {typeof filmTuning} withTuning
 */
function after(state, seconds, withTuning) {
  for (let i = 0; i < seconds * 4; i++) state = step(state, still, 0.25, withTuning, roads);
  return state;
}

test('the hail core is the long purple shape in the middle of the storm', () => {
  const { storm } = newGame(filmTuning, roads);
  const core = hailCore(storm, filmTuning);
  assert.equal(inHailCore({ x: core.x, y: core.y }, storm, filmTuning), true);
  // 1.5 miles along its length is inside; 1.5 miles across it is not.
  assert.equal(inHailCore({ x: core.x + 1.06, y: core.y + 1.06 }, storm, filmTuning), true);
  assert.equal(inHailCore({ x: core.x - 1.06, y: core.y + 1.06 }, storm, filmTuning), false);
});

test('parking in the purple core raises the damage meter', () => {
  const game = newGame(stillStorm, roads);
  const core = hailCore(game.storm, stillStorm);
  const state = after({ ...game, car: { x: core.x, y: core.y } }, 0.5, stillStorm);
  assert.ok(Math.abs(state.damage - 0.1) < 1e-9);
});

test('parking in the red or yellow, outside the core, does no damage', () => {
  const game = newGame(stillStorm, roads);
  const core = hailCore(game.storm, stillStorm);
  const state = after({ ...game, car: { x: core.x - 1.06, y: core.y + 1.06 } }, 0.5, stillStorm);
  assert.equal(state.damage, 0);
});

test('near the tornado, debris strikes in bursts', () => {
  const parked = parkedSouthOfTornado(0.8);
  assert.equal(after(parked, 0.25, stillStorm).debrisStrikes, 0);
  assert.equal(after(parked, 0.5, stillStorm).debrisStrikes, 1);
  assert.equal(after(parked, 1, stillStorm).debrisStrikes, 2);
});

test('each debris strike adds damage on top of the wind', () => {
  const noDebris = { ...stillStorm, debris: { ...stillStorm.debris, damagePerStrike: 0 } };
  const parked = parkedSouthOfTornado(0.8);
  const extra = after(parked, 1, stillStorm).damage - after(parked, 1, noDebris).damage;
  assert.ok(Math.abs(extra - 0.2) < 1e-9);
});

test('outside the debris zone nothing strikes', () => {
  assert.equal(after(parkedSouthOfTornado(2), 1, stillStorm).debrisStrikes, 0);
});

// A run of three short days. Each storm crosses in ten seconds with one
// tornado, well away from the crossroads where the car starts.
const runTuning = {
  ...tuning,
  startingBalance: 50,
  // One part for each thing a part can do, and one that needs another first.
  parts: [
    { id: 'windows', price: 100, hailDamageTimes: 0 },
    { id: 'camera', price: 200, payTimes: 1.5 },
    { id: 'engine', price: 300, speedTimes: 2 },
    { id: 'armour', price: 400, debrisDamageTimes: 0.5, dangerRingTimes: 0.5 },
    { id: 'cage', price: 500, flipDamage: 0.6 },
    { id: 'spoiler', price: 10, needs: 'engine' },
    { id: 'skirts', price: 600, anchoredRingTimes: 0.5 },
    { id: 'spikes', price: 700, needs: 'skirts', anchorHolds: true },
    { id: 'radar', price: 800, dashRadar: true },
    { id: 'gauge', price: 900, windGauge: true },
    { id: 'turret', price: 1000, viewfinderTimes: 2 },
  ],
  days: [0, 1, 2].map((strength) => ({
    path: [{ x: 20, y: 20 }, { x: 30, y: 20 }],
    tornadoes: [{ start: 0.2, end: 0.8, strength }],
    footage: { ringMiles: 10 - strength * 5, payAtEdge: 10 + strength, payAtTornado: 110 },
  })),
};

/**
 * Sits out the chase without touching the keys until the day ends.
 * @param {import('./rules.js').GameState} state
 */
function sitOut(state) {
  const day = dayTuning(runTuning, state.day);
  for (let i = 0; i < 200 && !state.dayOver; i++) state = step(state, still, 0.25, day, roads);
  return state;
}

test("a run starts at day one's briefing with the starting balance", () => {
  const state = newRun(runTuning, roads);
  assert.equal(state.day, 1);
  assert.equal(state.briefing, true);
  assert.equal(state.balance, 50);
});

test('nothing moves during the briefing', () => {
  const state = newRun(runTuning, roads);
  assert.equal(step(state, { x: 1, y: 0 }, 1, dayTuning(runTuning, 1), roads), state);
});

test('each day plays by its own storm and footage numbers', () => {
  const second = { ...runTuning.days[1], path: [{ x: 5, y: 5 }, { x: 6, y: 5 }] };
  const day = dayTuning({ ...runTuning, days: [runTuning.days[0], second] }, 2);
  assert.deepEqual(day.footage, { ringMiles: 5, payAtEdge: 11, payAtTornado: 110 });
  const { x, y } = newGame(day, roads).storm;
  assert.deepEqual({ x, y }, { x: 5, y: 5 });
  // What the days share comes through untouched.
  assert.equal(day.storm.milesPerSecond, runTuning.storm.milesPerSecond);
});

test('a run goes briefing, chase, summary for every day and ends on the final score', () => {
  let state = newRun(runTuning, roads);
  const seen = [];
  while (!state.finished) {
    assert.equal(state.briefing, true);
    seen.push(state.day);
    state = beginChase(state);
    assert.equal(state.dayOver, false);
    state = sitOut(state);
    assert.equal(state.dayOver, true);
    assert.equal(state.finished, false);
    assert.equal(state.garage, false);
    state = nextDay(state, runTuning, roads);
    // The garage comes between every summary and the next briefing, but not
    // after the last day.
    if (state.day < 3) {
      assert.equal(state.garage, true);
      state = nextDay(state, runTuning, roads);
      assert.equal(state.garage, false);
    }
  }
  assert.deepEqual(seen, [1, 2, 3]);
});

test('a day with no earnings still moves on to the next', () => {
  const ended = sitOut(beginChase(newRun(runTuning, roads)));
  assert.equal(ended.money, 0);
  const next = nextDay(nextDay(ended, runTuning, roads), runTuning, roads);
  assert.equal(next.day, 2);
  assert.equal(next.briefing, true);
});

test('the next day starts fresh but keeps the balance', () => {
  const ended = headHome({ ...beginChase(newRun(runTuning, roads)), money: 300, damage: 0.25 }, dayTuning(runTuning, 1));
  // 50 in the bank, 300 earned, a quarter of the 400 repair cost.
  assert.equal(ended.balance, 250);
  const next = nextDay(nextDay(ended, runTuning, roads), runTuning, roads);
  assert.equal(next.balance, 250);
  assert.equal(next.money, 0);
  assert.equal(next.damage, 0);
  assert.equal(next.dayOver, false);
});

test('the day cannot move on while the chase is still running', () => {
  const chasing = beginChase(newRun(runTuning, roads));
  assert.equal(nextDay(chasing, runTuning, roads), chasing);
});

test("the final score is the balance after the last day's repair bill", () => {
  const lastDay = { ...beginChase(newRun(runTuning, roads)), day: 3, balance: 1000, money: 200, damage: 0.5 };
  const final = nextDay(headHome(lastDay, dayTuning(runTuning, 3)), runTuning, roads);
  assert.equal(final.finished, true);
  assert.equal(final.balance, 1000);
  assert.equal(final.best, 1000);
});

test('the best final balance is kept when a later run scores less', () => {
  const lastDay = { ...beginChase(newRun(runTuning, roads, 5000)), day: 3, balance: 1000 };
  const final = nextDay(headHome(lastDay, dayTuning(runTuning, 3)), runTuning, roads);
  assert.equal(final.balance, 1000);
  assert.equal(final.best, 5000);
});

test('a later day has a smaller footage ring, and a ring of no miles pays nothing', () => {
  assert.ok(dayTuning(runTuning, 1).footage.ringMiles > dayTuning(runTuning, 2).footage.ringMiles);
  const last = dayTuning(runTuning, 3);
  assert.equal(last.footage.ringMiles, 0);
  assert.equal(payPerSecond(0.1, last), 0);
  assert.equal(payPerSecond(0, last), 0);
});

test('the storm carries the strength of its tornado, and the day that of its strongest', () => {
  const day = {
    ...runTuning.days[0],
    tornadoes: [{ start: 0.2, end: 0.4, strength: 1 }, { start: 0.6, end: 0.8, strength: 4 }],
  };
  const two = dayTuning({ ...runTuning, days: [day] }, 1);
  assert.equal(strongest(day.tornadoes), 4);
  assert.equal(strongest([]), 0);
  // Up to the end of the first tornado it is the first one's strength, then
  // the second's.
  let state = newGame(two, roads);
  assert.equal(state.storm.strength, 1);
  state = step(state, still, 3, two, roads);
  assert.equal(state.storm.strength, 1);
  state = step(state, still, 2, two, roads);
  assert.equal(state.storm.strength, 4);
});

/**
 * Plays a day to its summary, earning and breaking this much on the way.
 * @param {import('./rules.js').GameState} state A day's briefing.
 * @param {number} money
 * @param {number} [damage]
 */
function playDay(state, money, damage = 0) {
  return headHome({ ...beginChase(state), money, damage }, dayTuning(runTuning, state.day));
}

test('a new save starts at day one with the starting balance and keeps the best', () => {
  assert.deepEqual(newSave(runTuning), { day: 1, balance: 50, best: 0, parts: [] });
  assert.deepEqual(newSave(runTuning, 900), { day: 1, balance: 50, best: 900, parts: [] });
});

test('after a day the save holds the next day and the balance', () => {
  const ended = playDay(newRun(runTuning, roads, 700), 300);
  assert.deepEqual(saveOf(ended, runTuning), { day: 2, balance: 350, best: 700, parts: [] });
});

test('a save read back resumes at the next briefing with the same balance', () => {
  const save = saveOf(playDay(newRun(runTuning, roads, 700), 300), runTuning);
  const back = readSave(JSON.stringify(save), runTuning);
  assert.deepEqual(back, save);
  const state = resume(/** @type {import('./rules.js').Save} */ (back), runTuning, roads);
  assert.equal(state.day, 2);
  assert.equal(state.briefing, true);
  assert.equal(state.balance, 350);
  assert.equal(state.best, 700);
  assert.equal(state.money, 0);
});

test('the save after the last day is of a finished run, with the best brought up to date', () => {
  const ended = playDay({ ...newRun(runTuning, roads, 700), day: 3 }, 1000);
  const save = saveOf(ended, runTuning);
  assert.deepEqual(save, { day: 4, balance: 1050, best: 1050, parts: [] });
  assert.equal(runFinished(save, runTuning), true);
  assert.equal(runFinished({ ...save, day: 3 }, runTuning), false);
  // A lower final balance leaves the best alone.
  assert.equal(saveOf(playDay({ ...newRun(runTuning, roads, 5000), day: 3 }, 0), runTuning).best, 5000);
});

test('a missing or damaged save is turned away', () => {
  assert.equal(readSave(null, runTuning), null);
  assert.equal(readSave('', runTuning), null);
  assert.equal(readSave('not a save', runTuning), null);
  assert.equal(readSave('null', runTuning), null);
  assert.equal(readSave('{"day":2}', runTuning), null);
  assert.equal(readSave('{"day":0,"balance":10,"best":0}', runTuning), null);
  assert.equal(readSave('{"day":1.5,"balance":10,"best":0}', runTuning), null);
  assert.equal(readSave('{"day":2,"balance":-10,"best":0}', runTuning), null);
  assert.equal(readSave('{"day":2,"balance":"lots","best":0}', runTuning), null);
  assert.equal(readSave('{"day":2,"balance":10,"best":null}', runTuning), null);
});

test('a save from when there were more days counts as a finished run', () => {
  assert.deepEqual(readSave('{"day":9,"balance":10,"best":20}', runTuning), { day: 4, balance: 10, best: 20, parts: [] });
});

test('free play replays any day and leaves the recorded score alone', () => {
  const save = { day: 4, balance: 1050, best: 2000, parts: ['engine'] };
  const state = freePlay(save, 2, runTuning, roads);
  assert.equal(state.day, 2);
  assert.equal(state.briefing, true);
  // With the vehicle as it stands.
  assert.deepEqual(state.parts, ['engine']);
  const ended = playDay(state, 400, 0.5);
  assert.equal(ended.dayOver, true);
  assert.equal(ended.money, 400);
  assert.equal(ended.repairBill, 200);
  assert.equal(ended.balance, 1050);
  assert.equal(ended.best, 2000);
  // And it does not lead on to the next day or a second final score.
  assert.equal(nextDay(ended, runTuning, roads), ended);
});

/**
 * The garage after day one, with this much in the bank.
 * @param {number} balance
 * @param {string[]} [parts] Parts already on the vehicle.
 */
function inGarage(balance, parts = []) {
  const ended = { ...playDay(newRun(runTuning, roads), 0), balance, parts };
  return nextDay(ended, runTuning, roads);
}

test('buying a part takes its price off the balance and puts it on the vehicle', () => {
  const bought = buy(inGarage(1000), 'camera', runTuning);
  assert.equal(bought.balance, 800);
  assert.deepEqual(bought.parts, ['camera']);
});

test('a part is bought only once', () => {
  const once = buy(inGarage(1000), 'camera', runTuning);
  assert.equal(whyNotBuy(once, runTuning.parts[1]), 'owned');
  assert.equal(buy(once, 'camera', runTuning), once);
});

test('a part that costs more than the balance cannot be bought', () => {
  const poor = inGarage(199);
  assert.equal(whyNotBuy(poor, runTuning.parts[1]), 'money');
  assert.equal(buy(poor, 'camera', runTuning), poor);
  // Exactly enough is enough.
  assert.equal(buy(inGarage(200), 'camera', runTuning).balance, 0);
});

test('a part that needs another cannot be bought until the other is owned', () => {
  const garage = inGarage(1000);
  assert.equal(whyNotBuy(garage, runTuning.parts[5]), 'needs');
  assert.equal(buy(garage, 'spoiler', runTuning), garage);
  assert.deepEqual(buy(buy(garage, 'engine', runTuning), 'spoiler', runTuning).parts, ['engine', 'spoiler']);
});

test('parts are only bought in the garage, and only parts the garage sells', () => {
  const summary = { ...playDay(newRun(runTuning, roads), 0), balance: 1000 };
  assert.equal(buy(summary, 'camera', runTuning), summary);
  const garage = inGarage(1000);
  assert.equal(buy(garage, 'rocket', runTuning), garage);
});

test('the parts and what is left of the balance go on to the next day and into the save', () => {
  const bought = buy(inGarage(1000), 'engine', runTuning);
  assert.deepEqual(saveOf(bought, runTuning), { day: 2, balance: 700, best: 0, parts: ['engine'] });
  const next = nextDay(bought, runTuning, roads);
  assert.equal(next.day, 2);
  assert.equal(next.briefing, true);
  assert.equal(next.garage, false);
  assert.equal(next.balance, 700);
  assert.deepEqual(next.parts, ['engine']);
});

test('a save keeps its parts, less any the garage no longer sells', () => {
  const text = JSON.stringify({ day: 2, balance: 10, best: 0, parts: ['cage', 'rocket', 'engine', 'engine', 7] });
  assert.deepEqual(readSave(text, runTuning)?.parts, ['engine', 'cage']);
  assert.deepEqual(readSave('{"day":2,"balance":10,"best":0,"parts":"engine"}', runTuning)?.parts, []);
});

test('with no parts the day plays by the plain numbers', () => {
  const plain = dayTuning(runTuning, 1);
  assert.equal(plain.carMilesPerSecond, tuning.carMilesPerSecond);
  assert.deepEqual(plain.footage, runTuning.days[0].footage);
  assert.equal(plain.danger.ringMiles, tuning.danger.ringMiles);
  assert.equal(plain.danger.flipDamage, undefined);
  assert.deepEqual(plain.debris, tuning.debris);
  assert.deepEqual(plain.hail, tuning.hail);
});

// A storm that sits still with a tornado on the ground all day. Its funnel
// is 2.6 miles south-west of its middle, so this one's is at the crossroads
// where the car starts, and its hail core is far away.
/** @param {string[]} parts @param {number} x Where the funnel is, in miles east of the car. */
const parked = (parts, x) => ({
  ...dayTuning(runTuning, 1, parts),
  storm: { path: [{ x: x + 2.6, y: 2.6 }, { x: x + 2.6, y: 2.6001 }], milesPerSecond: 0, hookLead: 0.1, tornadoes: [{ start: 0, end: 1 }] },
});

test('with the windows, sitting in the hail core does no damage', () => {
  // The hail core is just north-east of the storm's middle.
  const inCore = { carStart: { x: 0, y: 0 }, storm: { path: [{ x: -0.3, y: -0.3 }, { x: -0.3, y: -0.2999 }], milesPerSecond: 0, hookLead: 0.1, tornadoes: [] } };
  const bare = { ...dayTuning(runTuning, 1), ...inCore };
  const glazed = { ...dayTuning(runTuning, 1, ['windows']), ...inCore };
  assert.ok(step(newGame(bare, roads), still, 1, bare, roads).damage > 0);
  assert.equal(step(newGame(glazed, roads), still, 1, glazed, roads).damage, 0);
});

test('with the camera, footage pays more', () => {
  assert.equal(payPerSecond(0, dayTuning(runTuning, 1, ['camera'])), 1.5 * payPerSecond(0, dayTuning(runTuning, 1)));
  assert.equal(payPerSecond(10, dayTuning(runTuning, 1, ['camera'])), 1.5 * payPerSecond(10, dayTuning(runTuning, 1)));
});

test('with the engine, the car drives faster', () => {
  const fast = dayTuning(runTuning, 1, ['engine']);
  assert.deepEqual(step(newGame(fast, roads), { x: 1, y: 0 }, 1, fast, roads).car, { x: 4, y: 0 });
});

test('with the armour, debris does less damage and the danger ring is smaller', () => {
  const armoured = dayTuning(runTuning, 1, ['armour']);
  assert.equal(armoured.danger.ringMiles, tuning.danger.ringMiles / 2);
  // Three miles out is inside the plain ring and outside the armoured one.
  assert.ok(windDamagePerSecond(3, dayTuning(runTuning, 1)) > 0);
  assert.equal(windDamagePerSecond(3, armoured), 0);

  // Close in, 0.8 miles from the funnel: one debris strike in half a second.
  const hit = (/** @type {string[]} */ parts) => {
    const day = { ...parked(parts, 0.8), danger: { ...tuning.danger, windDamageAtTornado: 0 } };
    return step(newGame(day, roads), still, 0.5, day, roads).damage;
  };
  assert.ok(Math.abs(hit([]) - 0.1) < 1e-9);
  assert.ok(Math.abs(hit(['armour']) - 0.05) < 1e-9);
});

test('without the roll cage a flip wrecks the car and ends the day', () => {
  const day = parked([], 0.2);
  const state = step(newGame(day, roads), still, 0.01, day, roads);
  assert.equal(state.wrecked, true);
  assert.equal(state.dayOver, true);
});

test('with the roll cage a flip costs heavy damage and the day runs on', () => {
  const caged = parked(['cage'], 0.2);
  const day = { ...caged, danger: { ...caged.danger, windDamageAtTornado: 0 }, debris: { ...caged.debris, damagePerStrike: 0 } };
  let state = step(newGame(day, roads), still, 0.01, day, roads);
  assert.equal(state.dayOver, false);
  assert.equal(state.wrecked, false);
  assert.equal(state.flipped, true);
  assert.equal(state.damage, 0.6);
  // Lying there costs nothing more for the same flip.
  state = step(state, still, 1, day, roads);
  assert.equal(state.damage, 0.6);
});

test('a second flip on top of the first wrecks even a car with a roll cage', () => {
  const caged = parked(['cage'], 0.2);
  const day = { ...caged, danger: { ...caged.danger, windDamageAtTornado: 0 }, debris: { ...caged.debris, damagePerStrike: 0 } };
  const flipped = step(newGame(day, roads), still, 0.01, day, roads);
  // Out of the tornado, then caught again.
  const away = step({ ...flipped, car: { x: 5, y: 0 } }, still, 0.01, day, roads);
  assert.equal(away.flipped, false);
  const again = step({ ...away, car: { x: 0, y: 0 } }, still, 0.01, day, roads);
  assert.equal(again.wrecked, true);
  assert.equal(again.dayOver, true);
});

/**
 * The vehicle parked with its skirts and spikes all the way down, the
 * tornado still far off.
 * @param {string[]} parts
 */
function anchoredWith(parts) {
  const far = parked(parts, 20);
  const state = toggleAnchor(toggleFilming(newGame(far, roads)), far);
  return step(state, still, 2, far, roads);
}

/**
 * A stationary tornado this many miles east of the car, with the wind and
 * debris switched off so that only flips and footage count.
 * @param {string[]} parts
 * @param {number} x
 */
function calm(parts, x) {
  const day = parked(parts, x);
  return { ...day, danger: { ...day.danger, windDamageAtTornado: 0 }, debris: { ...day.debris, damagePerStrike: 0 } };
}

test('A does nothing without skirts', () => {
  const day = parked([], 20);
  const filming = toggleFilming(newGame(day, roads));
  assert.equal(toggleAnchor(filming, day), filming);
});

test('with skirts, A starts anchoring, and it takes its time', () => {
  const day = parked(['skirts'], 20);
  let state = toggleAnchor(toggleFilming(newGame(day, roads)), day);
  assert.equal(state.anchoring, true);
  assert.equal(state.anchor, 0);
  assert.equal(anchorWait(state, day), 2);
  state = step(state, still, 0.5, day, roads);
  assert.equal(state.anchor, 0.25);
  assert.equal(anchorWait(state, day), 1.5);
  state = step(state, still, 1.5, day, roads);
  assert.equal(state.anchor, 1);
  assert.equal(anchorWait(state, day), 0);
  // And it stays down.
  assert.equal(step(state, still, 5, day, roads).anchor, 1);
});

test('the vehicle only anchors while parked', () => {
  const day = parked(['skirts'], 20);
  const driving = newGame(day, roads);
  assert.equal(toggleAnchor(driving, day), driving);
});

test('the car cannot drive off until the skirts and spikes are up', () => {
  const day = parked(['skirts', 'spikes'], 20);
  const down = anchoredWith(['skirts', 'spikes']);
  // Space does nothing while they are down or on their way down.
  assert.equal(toggleFilming(down), down);
  const rising = step(toggleAnchor(down, day), still, 0.5, day, roads);
  assert.equal(rising.anchor, 0.5);
  assert.equal(anchorWait(rising, day), 0.5);
  assert.equal(toggleFilming(rising), rising);
  // Holding an arrow does not move the car either.
  assert.deepEqual(step(rising, { x: 0, y: 1 }, 0.1, day, roads).car, down.car);
  const up = step(rising, still, 0.5, day, roads);
  assert.equal(up.anchor, 0);
  assert.equal(toggleFilming(up).filming, false);
});

test('anchored with skirts, the danger ring shrinks and the same wind does less damage', () => {
  const day = parked(['skirts'], 3);
  const loose = toggleFilming(newGame(day, roads));
  const down = anchoredWith(['skirts']);
  assert.equal(dangerRingMiles(loose, day), 4);
  assert.equal(dangerRingMiles(down, day), 2);
  // Three miles from the tornado: inside the plain ring, outside the
  // anchored one.
  assert.ok(step(loose, still, 1, day, roads).damage > 0);
  assert.equal(step(down, still, 1, day, roads).damage, 0);
  // One mile out both are damaged, the anchored one less.
  const near = parked(['skirts'], 1);
  const looseDamage = step(loose, still, 1, near, roads).damage;
  const downDamage = step(down, still, 1, near, roads).damage;
  assert.ok(downDamage > 0 && downDamage < looseDamage);
});

test('a tornado passing over a vehicle that is not anchored flips it', () => {
  const day = calm(['skirts', 'spikes'], 0.2);
  const state = step(toggleFilming(newGame(day, roads)), still, 0.01, day, roads);
  assert.equal(state.wrecked, true);
});

test('a tornado passing over a vehicle anchored with skirts only flips it', () => {
  const state = step(anchoredWith(['skirts']), still, 0.01, calm(['skirts'], 0.2), roads);
  assert.equal(state.wrecked, true);
});

test('still anchoring when the tornado arrives is not anchored', () => {
  const far = parked(['skirts', 'spikes'], 20);
  const half = step(toggleAnchor(toggleFilming(newGame(far, roads)), far), still, 1, far, roads);
  assert.equal(half.anchor, 0.5);
  assert.equal(step(half, still, 0.01, calm(['skirts', 'spikes'], 0.2), roads).wrecked, true);
});

test('anchored with skirts and spikes, the tornado passes over without a flip and pays the top rate', () => {
  const day = calm(['skirts', 'spikes'], 0.2);
  // The camera points away from the tornado: there is nothing to aim at.
  const down = { ...anchoredWith(['skirts', 'spikes']), camera: 270 };
  assert.equal(insideTornado(down, day), false);
  const state = step(down, still, 2, day, roads);
  assert.equal(insideTornado(state, day), true);
  assert.equal(state.wrecked, false);
  assert.equal(state.dayOver, false);
  assert.equal(state.footage, down.footage + 2);
  assert.equal(state.money, 2 * day.footage.payAtTornado);
});

test('on the last day only an anchored direct hit earns anything', () => {
  // Day three's footage ring is the tornado itself.
  const lastDay = { ...calm(['skirts', 'spikes'], 0.2), footage: dayTuning(runTuning, 3).footage };
  assert.equal(lastDay.footage.ringMiles, 0);
  const down = anchoredWith(['skirts', 'spikes']);
  assert.equal(step(down, still, 1, lastDay, roads).money, lastDay.footage.payAtTornado);

  // Filming it from a mile off, anchored or not, earns nothing.
  const off = { ...lastDay, storm: calm([], 1).storm };
  assert.equal(step(down, still, 1, off, roads).money, 0);
  const loose = toggleFilming(newGame(off, roads));
  assert.equal(tornadoInFrame(loose, off), true);
  assert.equal(step(loose, still, 1, off, roads).money, 0);
});

test('the dash radar is there only with the part', () => {
  assert.equal(dayTuning(runTuning, 1).dashRadar, false);
  assert.equal(dayTuning(runTuning, 1, ['radar']).dashRadar, true);
});

test('with the turret, the viewfinder box is wider and holds a tornado further off centre', () => {
  const plain = dayTuning(runTuning, 1);
  const turret = dayTuning(runTuning, 1, ['turret']);
  assert.equal(plain.camera.viewfinderDegrees, 20);
  assert.equal(turret.camera.viewfinderDegrees, 40);
  // The camera points 15 degrees off the tornado: outside a 20 degree box,
  // inside a 40 degree one.
  const day = parked([], 5);
  const filming = toggleFilming(newGame(day, roads));
  const off = { ...filming, camera: filming.camera + 15 };
  assert.equal(tornadoInFrame(off, { ...day, camera: plain.camera }), false);
  assert.equal(tornadoInFrame(off, { ...day, camera: turret.camera }), true);
});

test('the wind is fastest at the tornado, faster for a stronger one, and dies away with distance', () => {
  assert.equal(windMph(0, 0, tuning), 100);
  assert.equal(windMph(0, 5, tuning), 200);
  assert.equal(windMph(5, 0, tuning), 50);
  assert.equal(windMph(10, 5, tuning), 0);
  assert.equal(windMph(30, 5, tuning), 0);
});

test('without the wind gauge nothing is recorded and no bonus is paid', () => {
  const day = calm([], 5);
  const state = step(newGame(day, roads), still, 1, day, roads);
  assert.equal(state.topWind, 0);
  const ended = headHome(state, day);
  assert.equal(ended.scienceBonus, 0);
  assert.equal(ended.balance, 0);
});

test('with the wind gauge, the day keeps its top wind and the summary pays a bonus for it', () => {
  const far = calm(['gauge'], 8);
  const near = calm(['gauge'], 5);
  let state = step(newGame(far, roads), still, 1, far, roads);
  assert.ok(Math.abs(state.topWind - 20) < 1e-9);
  // Closer, the reading climbs; further off again, it keeps the highest.
  state = step(state, still, 1, near, roads);
  assert.equal(state.topWind, 50);
  state = step(state, still, 1, far, roads);
  assert.equal(state.topWind, 50);
  const ended = headHome({ ...state, money: 30 }, far);
  assert.equal(ended.scienceBonus, 100);
  assert.equal(ended.balance, 130);
});

test('a closer pass gives a higher reading and a bigger bonus', () => {
  const pass = (/** @type {number} */ miles) => {
    const day = calm(['gauge'], miles);
    return headHome(step(newGame(day, roads), still, 1, day, roads), day);
  };
  assert.ok(pass(2).topWind > pass(6).topWind);
  assert.ok(pass(2).scienceBonus > pass(6).scienceBonus);
});

test('the gauge reads nothing when no tornado is on the ground', () => {
  const day = { ...dayTuning(runTuning, 1, ['gauge']), storm: { ...tuning.storm, tornadoes: [] } };
  assert.equal(step(newGame(day, roads), still, 1, day, roads).topWind, 0);
});

test('in free play the science bonus is shown but the score stays the same', () => {
  const save = { day: 4, balance: 1050, best: 2000, parts: ['gauge'] };
  const day = calm(['gauge'], 5);
  const state = step(beginChase(freePlay(save, 1, runTuning, roads)), still, 1, day, roads);
  const ended = headHome(state, day);
  assert.equal(ended.scienceBonus, 100);
  assert.equal(ended.balance, 1050);
});

// The radar's beam.

test('the radar beam starts pointing north and turns once in its turn time', () => {
  let state = newGame(stormTuning, roads);
  assert.equal(state.beam, 0);
  for (let i = 0; i < 4; i++) state = step(state, still, 0.25, stormTuning, roads);
  assert.ok(Math.abs(state.beam - 1 / stormTuning.radar.sweepSeconds) < 1e-9);
  for (let i = 0; i < 12; i++) state = step(state, still, 0.25, stormTuning, roads);
  assert.ok(Math.abs(state.beam - 1) < 1e-9);
});

test('a beam with half the turn time turns twice as fast', () => {
  const fast = { ...stormTuning, radar: { sweepSeconds: stormTuning.radar.sweepSeconds / 2 } };
  const slow = step(newGame(stormTuning, roads), still, 0.25, stormTuning, roads);
  const quick = step(newGame(fast, roads), still, 0.25, fast, roads);
  assert.ok(Math.abs(quick.beam - 2 * slow.beam) < 1e-9);
});

test('the beam keeps turning while the player films', () => {
  const filming = toggleFilming(newGame(stormTuning, roads));
  assert.ok(step(filming, still, 0.25, stormTuning, roads).beam > 0);
});

test('the beam stands still during the briefing and once the day is over', () => {
  const briefing = newRun(runTuning, roads);
  assert.equal(step(briefing, still, 1, dayTuning(runTuning, 1), roads).beam, 0);
  const over = headHome(step(newGame(stormTuning, roads), still, 1, stormTuning, roads), stormTuning);
  assert.equal(step(over, still, 1, stormTuning, roads).beam, over.beam);
});

test('each day starts with the beam pointing north again', () => {
  let state = sitOut(beginChase(newRun(runTuning, roads)));
  assert.ok(state.beam > 0);
  state = nextDay(nextDay(state, runTuning, roads), runTuning, roads);
  assert.equal(state.day, 2);
  assert.equal(state.beam, 0);
});
