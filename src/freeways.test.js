import assert from 'node:assert/strict';
import { test } from 'node:test';
import { drivingLines } from './freeways.js';
import { buildNetwork, drive, nearestSpot, placeOf } from './roads.js';

/**
 * A road through some points.
 * @param {string} roadClass
 * @param {number[][]} points Each as miles east, then miles north.
 */
const road = (roadClass, ...points) => ({ class: roadClass, points: points.map(([x, y]) => ({ x, y })) });

// A small map, stored the way the real one is:
//  - An interstate runs south to north through the middle. Its northbound
//    side is a hundredth of a mile east of the middle and its southbound side
//    a hundredth west, and each side is in two pieces.
//  - Main Street crosses it at a diamond interchange: four ramps, which come
//    down to Main Street a tenth of a mile either side of the bridge.
//  - Bridge Road crosses it two miles north with no ramps.
//  - End Road comes in from the east four miles north and ends at two ramps.
//  - A second interstate crosses it three miles south, with a ramp between
//    the two.
//  - A spur freeway comes in from the east a mile south and ends at ramps
//    onto the interstate.
const roads = [
  road('motorway', [0.01, -5], [0.01, -3.3], [0.01, -1.3], [0.01, -0.7], [0.01, -0.3], [0.01, 0.3]),
  road('motorway', [0.01, 0.3], [0.01, 3.8], [0.01, 4.2], [0.01, 5]),
  road('motorway', [-0.01, 5], [-0.01, 0.3], [-0.01, -0.3]),
  road('motorway', [-0.01, -0.3], [-0.01, -5]),
  road('secondary', [-3, 0], [-0.1, 0], [0.1, 0], [3, 0]),
  road('motorway_link', [0.01, -0.3], [0.08, -0.15], [0.1, 0]),
  road('motorway_link', [0.1, 0], [0.01, 0.3]),
  road('motorway_link', [-0.01, 0.3], [-0.1, 0]),
  road('motorway_link', [-0.1, 0], [-0.01, -0.3]),
  road('tertiary', [-3, 2], [3, 2]),
  road('tertiary', [3, 4], [0.2, 4]),
  road('motorway_link', [0.01, 3.8], [0.2, 4]),
  road('motorway_link', [0.2, 4], [0.01, 4.2]),
  road('motorway', [-5, -3.01], [0.3, -3.01], [5, -3.01]),
  road('motorway', [5, -2.99], [-5, -2.99]),
  road('motorway_link', [0.01, -3.3], [0.3, -3.01]),
  road('motorway', [0.3, -1.01], [3, -1.01]),
  road('motorway', [3, -0.99], [0.3, -0.99]),
  road('motorway_link', [0.01, -1.3], [0.3, -1.01]),
  road('motorway_link', [0.3, -0.99], [0.01, -0.7]),
];
const network = buildNetwork(drivingLines(roads));

const north = { x: 0, y: 1 };
const south = { x: 0, y: -1 };
const east = { x: 1, y: 0 };
const west = { x: -1, y: 0 };

/**
 * Where the car ends up after starting stopped near a place and holding one
 * arrow after another, each for so many miles.
 * @param {{ x: number, y: number }} place
 * @param {[{ x: number, y: number }, number][]} legs
 */
function driven(place, ...legs) {
  let spot = nearestSpot(network, place);
  for (const [steering, miles] of legs) {
    // A quarter mile at a time, as the game does it frame by frame.
    for (let gone = 0; gone < miles; gone += 0.25) spot = drive(network, spot, steering, 0.25);
  }
  return placeOf(network, spot);
}

/**
 * Checks a number is within a fiftieth of a mile of another: as near as the
 * two sides of a freeway are to its middle.
 * @param {number} actual
 * @param {number} expected
 */
function assertNear(actual, expected) {
  assert.ok(Math.abs(actual - expected) < 0.02, `${actual} is not near ${expected}`);
}

test('a freeway is one line: only one of its two sides can be driven', () => {
  const sides = new Set(network.xs.filter((x, point) => Math.abs(x) === 0.01 && Math.abs(network.ys[point]) > 4));
  assert.equal(sides.size, 1);
});

test('the ramps cannot be driven', () => {
  assert.ok(!network.xs.some((x, point) => x === 0.08 && network.ys[point] === -0.15));
});

test('holding one arrow along a freeway carries the car through its interchanges', () => {
  const place = driven({ x: 0, y: -5 }, [north, 10]);
  assertNear(place.x, 0);
  assert.equal(place.y, 5);
});

test('holding the arrow toward the cross road at an interchange leaves the freeway', () => {
  // Northbound, with right held from half a mile before Main Street.
  const eastward = driven({ x: 0, y: -5 }, [north, 4.5], [east, 3]);
  assertNear(eastward.x, 2.5);
  assert.equal(eastward.y, 0);
  // And southbound, with left held.
  const westward = driven({ x: 0, y: 5 }, [south, 4.5], [west, 3]);
  assertNear(westward.x, -2.5);
  assert.equal(westward.y, 0);
});

test('holding the arrow along the freeway at an interchange leaves the cross road', () => {
  const northward = driven({ x: -3, y: 0 }, [east, 2.5], [north, 2]);
  assertNear(northward.x, 0);
  assertNear(northward.y, 1.5);
  const southward = driven({ x: 3, y: 0 }, [west, 2.5], [south, 2]);
  assertNear(southward.x, 0);
  assertNear(southward.y, -1.5);
});

test('a road that crosses a freeway with no ramps does not join it', () => {
  const place = driven({ x: -3, y: 2 }, [east, 2.5], [north, 2]);
  assert.equal(place.y, 2);
  assertNear(place.x, 1.5);
});

test('two freeways that cross make one four-way junction', () => {
  // North up one, then each way along the other.
  const eastward = driven({ x: 0, y: -5 }, [north, 1.5], [east, 2.5]);
  assertNear(eastward.x, 2);
  assertNear(eastward.y, -3);
  const westward = driven({ x: 0, y: -5 }, [north, 1.5], [west, 2.5]);
  assertNear(westward.x, -2);
  assertNear(westward.y, -3);
});

test('a road that ends at ramps is joined straight to the freeway', () => {
  const place = driven({ x: 3, y: 4 }, [west, 5], [north, 0.5]);
  assertNear(place.x, 0);
  assertNear(place.y, 4.5);
});

test('a freeway that ends at ramps onto another carries on to it', () => {
  const place = driven({ x: 3, y: -1 }, [west, 5], [south, 1]);
  assertNear(place.x, 0);
  assertNear(place.y, -2);
});

test('a ramp between two ordinary roads, which reaches no freeway, can still be driven', () => {
  const slip = buildNetwork(
    drivingLines([...roads, road('secondary', [-3, 0], [-3, 1]), road('motorway_link', [-3, 1], [-2.5, 1.5], [-2, 2]), road('tertiary', [-3, 2], [-2, 2])]),
  );
  assert.ok(slip.xs.some((x, point) => x === -2.5 && slip.ys[point] === 1.5));
});

test('where two lines of freeway run side by side, an interchange joins the cross road to both', () => {
  // A second line of freeway, with no other side of its own, which crosses
  // Main Street a twentieth of a mile east of the interstate.
  const beside = buildNetwork(drivingLines([...roads, road('motorway', [-0.34, -0.3], [0.46, 0.3])]));
  const crossing = nearestSpot(beside, { x: 0.06, y: 0 }).to;
  assert.ok(Math.hypot(beside.xs[crossing] - 0.06, beside.ys[crossing]) < 1e-9);
  assert.equal(beside.ways[crossing].length, 4);
});

test('a map with no freeways is left as it is', () => {
  const plain = [road('secondary', [0, 0], [1, 0]), road('tertiary', [1, 0], [1, 1])];
  assert.deepEqual(drivingLines(plain), plain.map(({ points }) => points));
});
