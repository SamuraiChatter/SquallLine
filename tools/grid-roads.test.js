import assert from 'node:assert/strict';
import { test } from 'node:test';
import { milesFrom } from '../src/map.js';
import { gridRoads, withoutDeadEnds } from './grid-roads.js';

// A small sample: open country about 14 miles across and 11 miles tall, with
// a town in it.
const bounds = { south: 35, west: -98, north: 35.16, east: -97.75 };

// The sample is set out in miles east and north of its south-west corner, and
// turned into longitude and latitude here.
const toMiles = milesFrom(bounds);
const corner = toMiles(bounds.west, bounds.south);
const milesPerLon = toMiles(bounds.west + 1, bounds.south).x - corner.x;
const milesPerLat = toMiles(bounds.west, bounds.south + 1).y - corner.y;
/**
 * @param {number} x
 * @param {number} y
 */
const at = (x, y) => [bounds.west + x / milesPerLon, bounds.south + y / milesPerLat];

/**
 * A straight road with a point every so often.
 * @param {string} name
 * @param {number[]} from In miles, [east, north].
 * @param {number[]} to
 * @param {number} every How many miles between points.
 */
function road(name, [x0, y0], [x1, y1], every) {
  const steps = Math.round(Math.hypot(x1 - x0, y1 - y0) / every);
  const points = [];
  for (let i = 0; i <= steps; i++) points.push(at(x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps));
  return { name, points };
}

// The one-mile grid: a road every mile, 12 miles west to east and 10 south to
// north.
const grid = [];
for (let x = 1; x <= 12; x++) grid.push(road(`grid north ${x}`, [x, 1], [x, 10], 1));
for (let y = 1; y <= 10; y++) grid.push(road(`grid east ${y}`, [1, y], [12, y], 1));

// The town: a square mile of streets a tenth of a mile apart, between the
// grid roads at 6 and 7 miles east and at 5 and 6 miles north.
const town = [];
for (let n = 1; n <= 9; n++) {
  town.push(road(`town north ${n}`, [6 + n / 10, 5], [6 + n / 10, 6], 0.1));
  town.push(road(`town east ${n}`, [6, 5 + n / 10], [7, 5 + n / 10], 0.1));
}

/** @param {{ name: string }[]} roads */
const names = (roads) => roads.map((r) => r.name).sort();

// The four grid roads that run along the town's edge. The rule may take
// them for streets or not, so the tests leave them be.
const edge = ['grid north 6', 'grid north 7', 'grid east 5', 'grid east 6'];

test('every road of the one-mile grid away from the town is kept', () => {
  const kept = names(gridRoads([...grid, ...town], bounds));
  for (const { name } of grid) {
    if (!edge.includes(name)) assert.ok(kept.includes(name), `${name} was left out`);
  }
});

test('every street in the town is left out', () => {
  const kept = names(gridRoads([...grid, ...town], bounds));
  for (const { name } of town) assert.ok(!kept.includes(name), `${name} was kept`);
});

test('a short road in open country is kept', () => {
  const lane = road('lane', [2.5, 2], [2.5, 2.4], 0.2);
  assert.ok(names(gridRoads([...grid, ...town, lane], bounds)).includes('lane'));
});

test('a short road beside the town is left out', () => {
  const lane = road('lane', [5.9, 5.3], [5.9, 5.7], 0.2);
  assert.ok(!names(gridRoads([...grid, ...town, lane], bounds)).includes('lane'));
});

// Dead ends. Two main roads run west to east, a mile apart.
const mains = [road('main south', [0, 0], [4, 0], 1), road('main north', [0, 1], [4, 1], 1)];

/** @param {{ points: number[][] }} trimmed */
const ends = ({ points }) => [points[0], points.at(-1)];

test('a road that joins another road at both ends is kept whole', () => {
  const through = road('through', [1, 0], [1, 1], 0.5);
  assert.deepEqual(withoutDeadEnds([through], mains), [through]);
});

test('a road that leads nowhere is left out', () => {
  const driveway = road('driveway', [2, 0], [2, 0.5], 0.25);
  assert.deepEqual(withoutDeadEnds([driveway], mains), []);
});

test('the tail of a road past its last junction is trimmed off', () => {
  const long = road('long', [1, 0], [1, 1.5], 0.5);
  const [trimmed] = withoutDeadEnds([long], mains);
  assert.deepEqual(ends(trimmed), [at(1, 0), at(1, 1)]);
});

test('a dead end off a dead end goes too', () => {
  const stub = road('stub', [2, 0], [2, 0.5], 0.25);
  const twig = road('twig', [2, 0.5], [2.5, 0.5], 0.25);
  assert.deepEqual(withoutDeadEnds([stub, twig], mains), []);
});

test('two roads that join each other between the main roads are kept', () => {
  const south = road('south half', [3, 0], [3, 0.5], 0.25);
  const north = road('north half', [3, 0.5], [3, 1], 0.25);
  assert.deepEqual(names(withoutDeadEnds([south, north], mains)), ['north half', 'south half']);
});

test('the main roads are never trimmed, and the roads given are not changed', () => {
  const long = road('long', [1, 0], [1, 1.5], 0.5);
  const before = JSON.stringify([long, mains]);
  withoutDeadEnds([long], mains);
  assert.equal(JSON.stringify([long, mains]), before);
});
