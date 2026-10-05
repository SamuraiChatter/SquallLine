import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildNetwork, drive, nearestSpot, placeOf } from './roads.js';

// A small map with easy numbers:
//  - Main Street runs west to east through the middle, from 10 miles west to
//    10 miles east, with a point every 5 miles.
//  - Broadway runs south to north through the middle and crosses it there.
//  - A diagonal road runs north-east from the east end of Main Street.
//  - An interstate runs south to north 5 miles west, straight over Main
//    Street with no junction: none of its points is one of Main Street's.
//  - A ramp joins the interstate to Main Street further on.
//  - Main Street ends in the west at West Road, which runs south to north.
const network = buildNetwork([
  [{ x: -10, y: 0 }, { x: -5, y: 0 }, { x: 0, y: 0 }, { x: 5, y: 0 }, { x: 10, y: 0 }],
  [{ x: 0, y: -10 }, { x: 0, y: 0 }, { x: 0, y: 10 }],
  [{ x: 10, y: 0 }, { x: 13, y: 3 }, { x: 16, y: 6 }],
  [{ x: -5.5, y: -10 }, { x: -5.5, y: -1 }, { x: -5.5, y: 1 }, { x: -5.5, y: 10 }],
  [{ x: -5.5, y: 1 }, { x: -5, y: 0 }],
  [{ x: -10, y: -5 }, { x: -10, y: 0 }, { x: -10, y: 5 }],
]);

const north = { x: 0, y: 1 };
const south = { x: 0, y: -1 };
const east = { x: 1, y: 0 };
const west = { x: -1, y: 0 };
const none = { x: 0, y: 0 };

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
 * @param {{ x: number, y: number }} place
 * @param {{ x: number, y: number }} expected
 */
function assertAt(place, expected) {
  assert.ok(Math.hypot(place.x - expected.x, place.y - expected.y) < 1e-9, `at ${place.x}, ${place.y}`);
}

test('roads that share a point are joined there', () => {
  const middle = nearestSpot(network, { x: 0, y: 0 }).to;
  assert.equal(network.ways[middle].length, 4);
});

test('roads that cross without sharing a point are not joined', () => {
  const below = nearestSpot(network, { x: -5.5, y: -1 }).to;
  const above = nearestSpot(network, { x: -5.5, y: 1 }).to;
  assert.deepEqual(network.ways[below].length, 2);
  assert.ok(network.ways[below].includes(above));
});

test('the car is put down on the nearest point of a road', () => {
  assertAt(placeOf(network, nearestSpot(network, { x: 4, y: 2 })), { x: 5, y: 0 });
});

test('holding up on a north-south road drives north', () => {
  assertAt(driven({ x: 0, y: -10 }, [north, 4]), { x: 0, y: -6 });
});

test('holding an arrow square to the road does not start the car', () => {
  assertAt(driven({ x: 0, y: -10 }, [east, 4]), { x: 0, y: -10 });
});

test('letting go stops the car', () => {
  assertAt(driven({ x: 0, y: -10 }, [north, 4], [none, 4]), { x: 0, y: -6 });
});

test('at a crossroads, holding right turns east', () => {
  assertAt(driven({ x: 0, y: -10 }, [north, 10], [east, 3]), { x: 3, y: 0 });
});

test('an arrow held early turns at the next junction', () => {
  // Driving north with only right held: on to the crossroads, then east.
  assertAt(driven({ x: 0, y: -10 }, [north, 2], [east, 11]), { x: 3, y: 0 });
});

test('holding the same arrow goes straight over a crossroads', () => {
  assertAt(driven({ x: 0, y: -10 }, [north, 14]), { x: 0, y: 4 });
});

test('holding the arrow against the road turns the car round', () => {
  assertAt(driven({ x: 0, y: -10 }, [north, 4], [south, 2]), { x: 0, y: -8 });
});

test('on a road running north-east, holding either up or right drives along it', () => {
  const along = 2 / Math.SQRT2;
  assertAt(driven({ x: 10, y: 0 }, [north, 2]), { x: 10 + along, y: along });
  assertAt(driven({ x: 10, y: 0 }, [east, 2]), { x: 10 + along, y: along });
});

test('the car stops at the end of a road', () => {
  assertAt(driven({ x: 0, y: 0 }, [north, 30]), { x: 0, y: 10 });
});

test('the car stops where its road ends at another, until an arrow picks a way', () => {
  // West along Main Street to West Road, which runs north and south.
  assertAt(driven({ x: -5, y: 0 }, [west, 8]), { x: -10, y: 0 });
  assertAt(driven({ x: -5, y: 0 }, [west, 8], [north, 2]), { x: -10, y: 2 });
});

test('the car cannot switch roads where one crosses over another', () => {
  // West along Main Street, holding up from just before the interstate: the
  // car passes under it and never gets onto it.
  const place = driven({ x: -5, y: 0 }, [west, 0.25], [north, 3]);
  assert.equal(place.y, 0);
  assertAt(place, { x: -8.25, y: 0 });
});

test('a ramp joins an interstate to another road', () => {
  // North up the interstate, then right at the ramp, down it and on east
  // along Main Street.
  const ramp = Math.hypot(0.5, 1);
  assertAt(driven({ x: -5.5, y: -10 }, [north, 11], [east, 3]), { x: -5 + 3 - ramp, y: 0 });
});
