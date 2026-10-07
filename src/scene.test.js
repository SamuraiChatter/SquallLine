import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dbzAt, faintestDbz, hailDbz } from './radar.js';
import { funnelOf, hailCore, inHailCore } from './rules.js';
import { funnelHalfWidth, funnelReach, hailAmount, rainAmount, rainSlant, skyDarkness, tornadoShape, treeLean } from './scene.js';

/**
 * A tree's lean at every tenth of a second for a minute.
 * @param {number} mph
 * @param {number} toward
 */
const leans = (mph, toward) => Array.from({ length: 600 }, (_, i) => treeLean(mph, toward, i / 10, 3));
/** @param {number[]} numbers */
const middle = (numbers) => numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
/**
 * How many times a tree swings back through the middle of its sway.
 * @param {number[]} numbers
 */
const swings = (numbers) => {
  const mean = middle(numbers);
  return numbers.filter((n, i) => i > 0 && n > mean !== numbers[i - 1] > mean).length;
};

test('the sky is darkest toward the tornado and lighter either side of it', () => {
  assert.equal(skyDarkness(0), 1);
  assert.ok(skyDarkness(20) < 1);
  assert.ok(skyDarkness(60) < skyDarkness(20));
  assert.equal(skyDarkness(-35), skyDarkness(35));
});

test('far round from the tornado the sky is no darker than anywhere else', () => {
  assert.equal(skyDarkness(120), 0);
  assert.equal(skyDarkness(180), 0);
  assert.equal(skyDarkness(-180), 0);
});

test('with no wind a tree sways gently about upright', () => {
  const still = leans(0, 1);
  assert.ok(Math.abs(middle(still)) < 0.01);
  assert.ok(Math.max(...still) > 0.02, 'it does not move');
  assert.ok(Math.max(...still.map(Math.abs)) < 0.05, 'it moves too far');
});

test('a tree leans toward the tornado, further the harder the wind blows', () => {
  const light = middle(leans(40, 1));
  const strong = middle(leans(120, 1));
  assert.ok(light > 0.1);
  assert.ok(strong > light * 2);
  // The tornado on the other side: the same lean the other way.
  assert.ok(Math.abs(middle(leans(120, -1)) + strong) < 0.02);
});

test('a tree thrashes further and faster as the wind rises', () => {
  const calm = leans(0, 1);
  const windy = leans(120, 1);
  const reach = (/** @type {number[]} */ numbers) => Math.max(...numbers) - Math.min(...numbers);
  assert.ok(reach(windy) > reach(calm) * 3);
  assert.ok(swings(windy) > swings(calm) * 3);
});

test('a tree bends no further in a wind past the strongest it can stand', () => {
  assert.equal(treeLean(150, 1, 2, 5), treeLean(400, 1, 2, 5));
});

test('trees do not all sway together', () => {
  assert.notEqual(treeLean(0, 1, 2, 1), treeLean(0, 1, 2, 2));
});

test('EF0 and EF1 are a rope, EF2 and EF3 a cone, EF4 and EF5 a wedge', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5].map((strength) => tornadoShape(strength).name), ['rope', 'rope', 'cone', 'cone', 'wedge', 'wedge']);
});

test('a rope is thin all the way down, and a wedge is wide even at the ground', () => {
  const widest = (/** @type {number} */ strength) => Math.max(...[0, 0.25, 0.5, 0.75, 1].map((down) => funnelHalfWidth(strength, down, 1)));
  assert.ok(widest(0) < 0.1);
  assert.ok(funnelHalfWidth(2, 0, 1) > widest(0) * 2);
  assert.ok(funnelHalfWidth(4, 1, 1) > funnelHalfWidth(2, 1, 1) * 3);
});

test('every tornado is widest at the cloud and narrows toward the ground', () => {
  for (const strength of [0, 2, 4]) {
    const widths = [0, 0.25, 0.5, 0.75, 1].map((down) => funnelHalfWidth(strength, down, 1));
    for (let i = 1; i < widths.length; i++) assert.ok(widths[i] < widths[i - 1], `EF${strength} at ${i}`);
    assert.ok(widths[4] > 0, 'it has no foot');
  }
});

test('with no hook, and through a false alarm, there is no funnel', () => {
  assert.equal(funnelReach({ tornado: 0, tornadoHook: 0 }, 0.85), 0);
  // A hook still growing, short of where the funnel starts down.
  assert.equal(funnelReach({ tornado: 0, tornadoHook: 0.8 }, 0.85), 0);
});

test('a forming funnel reaches further down as the hook finishes growing, and stays off the ground', () => {
  const early = funnelReach({ tornado: 0, tornadoHook: 0.9 }, 0.85);
  const late = funnelReach({ tornado: 0, tornadoHook: 0.99 }, 0.85);
  assert.ok(early > 0);
  assert.ok(late > early);
  assert.ok(late < 1);
});

test('a tornado on the ground reaches all the way down', () => {
  assert.equal(funnelReach({ tornado: 1, tornadoHook: 1 }, 0.85), 1);
  assert.equal(funnelReach({ tornado: 0.2, tornadoHook: 1 }, 0.85), 1);
});

test('a funnel still in the air comes to a point', () => {
  assert.equal(funnelHalfWidth(2, 1, 0), 0);
  assert.ok(funnelHalfWidth(2, 0, 0) > 0);
});

test('a dying tornado thins out but is still there', () => {
  const full = funnelHalfWidth(2, 0.5, 1);
  const dying = funnelHalfWidth(2, 0.5, 0.1);
  assert.ok(dying < full * 0.5);
  assert.ok(dying > 0);
});

// Rain and hail.

const day = /** @type {import('./rules.js').Tuning} */ (/** @type {unknown} */ ({ hail: { coreMilesLong: 1.5, coreMilesWide: 1 } }));
const stormMiddle = { x: 4, y: -7 };
/** @type {import('./rules.js').Storm} */
const storm = { miles: 0, ...stormMiddle, heading: { x: 1, y: 0 }, hook: 0, tornadoHook: 0, tornado: 0, funnel: funnelOf(stormMiddle), strength: 0, spent: false };

test('where the radar shows no rain, none falls', () => {
  assert.equal(rainAmount(0), 0);
  assert.equal(rainAmount(faintestDbz - 0.1), 0);
  // Twenty miles south-west of the storm.
  assert.equal(rainAmount(dbzAt({ x: storm.x - 14, y: storm.y - 14 }, storm, day, 40)), 0);
});

test('light rain on the radar is a little rain, and heavy rain a lot', () => {
  const light = rainAmount(faintestDbz);
  const yellow = rainAmount(40);
  const red = rainAmount(55);
  assert.ok(light > 0 && light < 0.15);
  assert.ok(yellow > light * 3);
  assert.ok(red > yellow);
  assert.equal(red, 1);
});

test('the rain is at its heaviest in the middle of the storm, where the radar is red or worse', () => {
  assert.equal(rainAmount(dbzAt({ x: storm.x + 0.3, y: storm.y + 0.3 }, storm, day, 40)), 1);
  assert.equal(rainAmount(hailDbz), 1);
});

test('rain slants more as the wind rises, and never lies flat', () => {
  assert.ok(rainSlant(0) > 0);
  assert.ok(rainSlant(60) > rainSlant(0) * 2);
  assert.ok(rainSlant(150) > rainSlant(60));
  assert.equal(rainSlant(400), rainSlant(150));
  assert.ok(rainSlant(400) < Math.PI / 2 - 0.3);
});

/**
 * The hail at a place so many times the hail core's length out from its
 * middle, along its length.
 * @param {number} out 1 is the core's edge.
 */
const hailOut = (out) => {
  const miles = (out * day.hail.coreMilesLong) / Math.SQRT2;
  const core = hailCore(storm, day);
  return hailAmount({ x: core.x + miles, y: core.y + miles }, storm, day);
};

test('well away from the hail core no hail falls', () => {
  assert.equal(hailOut(1.51), 0);
  assert.equal(hailOut(4), 0);
});

test('a few stones fall just outside the hail core', () => {
  const justOutside = hailOut(1.1);
  assert.ok(justOutside > 0);
  assert.ok(justOutside < 0.15);
  assert.ok(hailOut(1.4) < justOutside);
  // Outside the core, where hail does no damage.
  const miles = (1.1 * day.hail.coreMilesLong) / Math.SQRT2;
  const core = hailCore(storm, day);
  assert.equal(inHailCore({ x: core.x + miles, y: core.y + miles }, storm, day), false);
});

test('inside the hail core the hail builds to a barrage', () => {
  assert.ok(hailOut(0.9) > hailOut(1.1));
  assert.ok(hailOut(0.6) > hailOut(0.9) * 2);
  assert.equal(hailOut(0.3), 1);
  assert.equal(hailOut(0), 1);
});

test('hail thins out the same way across the core as along it', () => {
  const core = hailCore(storm, day);
  // Across the core, which is narrower: its edge is nearer.
  const miles = (1.1 * day.hail.coreMilesWide) / Math.SQRT2;
  const across = hailAmount({ x: core.x - miles, y: core.y + miles }, storm, day);
  assert.ok(Math.abs(across - hailOut(1.1)) < 1e-9);
});
