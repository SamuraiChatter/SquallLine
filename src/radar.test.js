import assert from 'node:assert/strict';
import { test } from 'node:test';
import { colourOf, coverOf, dbzAt, hailDbz, hookSpot } from './radar.js';
import { funnelOf, inHailCore } from './rules.js';

const day = /** @type {import('./rules.js').Tuning} */ (/** @type {unknown} */ ({ hail: { coreMilesLong: 1.5, coreMilesWide: 1 } }));

/**
 * A storm with its middle at a spot.
 * @param {Partial<import('./rules.js').Storm>} [more]
 * @returns {import('./rules.js').Storm}
 */
function stormAt(more = {}) {
  const middle = { x: 4, y: -7 };
  return { miles: 0, ...middle, hook: 0, tornado: 0, funnel: funnelOf(middle), strength: 0, spent: false, ...more };
}

/** @param {import('./rules.js').Storm} storm */
const atFunnel = (storm, hookDbz = 40) => dbzAt(storm.funnel, storm, day, hookDbz);

test('every spot inside the hail core is at hail strength, and no spot outside it is', () => {
  const storm = stormAt({ hook: 1, tornado: 1, strength: 5 });
  let inside = 0;
  for (let x = storm.x - 9; x <= storm.x + 14; x += 0.07) {
    for (let y = storm.y - 9; y <= storm.y + 14; y += 0.07) {
      const hail = inHailCore({ x, y }, storm, day);
      assert.equal(dbzAt({ x, y }, storm, day, 40) >= hailDbz, hail, `at ${x}, ${y}`);
      if (hail) inside += 1;
    }
  }
  assert.ok(inside > 100);
});

test('the tip of a fully grown hook is at the funnel', () => {
  const storm = stormAt();
  const tip = hookSpot(storm, 1);
  assert.ok(Math.hypot(tip.x - storm.funnel.x, tip.y - storm.funnel.y) < 1e-9);
});

test('a fully grown hook brings rain to the funnel, and a half grown one does not reach it', () => {
  const none = atFunnel(stormAt());
  assert.ok(atFunnel(stormAt({ hook: 1 })) > none + 10);
  assert.ok(Math.abs(atFunnel(stormAt({ hook: 0.5 })) - none) < 1);
});

test('the hook leaves the storm before it reaches its tip', () => {
  const half = stormAt({ hook: 0.5 });
  const root = hookSpot(half, 0.25);
  assert.ok(dbzAt(root, half, day, 40) > dbzAt(root, stormAt(), day, 40) + 5);
});

test('a stronger hook echo rains harder along the hook', () => {
  const storm = stormAt({ hook: 1 });
  assert.ok(atFunnel(storm, 50) > atFunnel(storm, 30) + 10);
});

test('a tornado on the ground throws up a debris ball at the funnel', () => {
  const hook = atFunnel(stormAt({ hook: 1 }));
  assert.ok(atFunnel(stormAt({ hook: 1, tornado: 1 })) > hook + 10);
});

test('far from the storm it is dry', () => {
  const storm = stormAt({ hook: 1, tornado: 1 });
  assert.equal(dbzAt({ x: storm.x - 20, y: storm.y }, storm, day, 40), 0);
  assert.equal(dbzAt({ x: storm.x, y: storm.y + 20 }, storm, day, 40), 0);
});

test('the big shield of rain is ahead of the storm, to its north-east', () => {
  const storm = stormAt();
  const ahead = dbzAt({ x: storm.x + 4, y: storm.y + 4 }, storm, day, 40);
  const behind = dbzAt({ x: storm.x - 4, y: storm.y - 4 }, storm, day, 40);
  assert.ok(ahead > 30);
  assert.ok(behind < 20);
});

test('rain too light to show has no colour, and hail is purple', () => {
  assert.equal(colourOf(19.9), undefined);
  assert.deepEqual(colourOf(20), [20, 0x02, 0xfd, 0x02]);
  assert.deepEqual(colourOf(hailDbz), [65, 0xf8, 0x00, 0xfd]);
  assert.deepEqual(colourOf(90), [70, 0x98, 0x54, 0xc6]);
});

test('light rain covers little of the map and heavy rain most of it', () => {
  assert.equal(coverOf(20, 35, 75), 35);
  assert.equal(coverOf(65, 35, 75), 75);
  assert.equal(coverOf(70, 35, 75), 75);
  assert.ok(coverOf(40, 35, 75) > 35 && coverOf(40, 35, 75) < 75);
});
