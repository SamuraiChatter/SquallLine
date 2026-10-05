import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { test } from 'node:test';
import { milesFrom, tierOf } from '../src/map.js';
import { buildNetwork, drive, nearestSpot } from '../src/roads.js';

const file = new URL('./map.json', import.meta.url);
const map = JSON.parse(readFileSync(file, 'utf8'));

test('the map file is under 10 MB', () => {
  assert.ok(statSync(file).size < 10 * 1024 * 1024);
});

test('the map has Oklahoma City, Norman and Edmond', () => {
  const names = map.places.map((/** @type {{ name: string }} */ place) => place.name);
  for (const town of ['Oklahoma City', 'Norman', 'Edmond']) {
    assert.ok(names.includes(town), `${town} is missing`);
  }
});

test('the map has Interstates 35, 40 and 44', () => {
  const refs = new Set(map.roads.flatMap((/** @type {{ ref: string }} */ road) => road.ref.split(';')));
  for (const interstate of ['I 35', 'I 40', 'I 44']) {
    assert.ok(refs.has(interstate), `${interstate} is missing`);
  }
});

test('every road has a class and at least two points', () => {
  for (const road of map.roads) {
    assert.ok(road.class, 'a road has no class');
    assert.ok(road.points.length >= 2, `${road.name || road.class} has fewer than two points`);
  }
});

test('no point lies outside the territory', () => {
  const { south, west, north, east } = map.bounds;
  const lines = [...map.roads.map((/** @type {{ points: number[][] }} */ road) => road.points), ...map.counties];
  for (const points of lines) {
    for (const [lon, lat] of points) {
      assert.ok(lon >= west && lon <= east && lat >= south && lat <= north, `${lon}, ${lat} is outside`);
    }
  }
  for (const place of map.places) {
    assert.ok(place.lon >= west && place.lon <= east && place.lat >= south && place.lat <= north);
  }
});

test('the map file carries the OpenStreetMap credit', () => {
  assert.match(map.credit, /OpenStreetMap contributors/);
});

// The roads as the game drives them.
const toMiles = milesFrom(map.bounds);
const network = buildNetwork(
  map.roads
    .filter((/** @type {{ class: string }} */ road) => tierOf(road.class) >= 0)
    .map((/** @type {{ points: number[][] }} */ road) => road.points.map(([lon, lat]) => toMiles(lon, lat))),
);

/**
 * The point of the network nearest a town.
 * @param {string} name
 */
function pointNear(name) {
  const town = map.places.find((/** @type {{ name: string }} */ place) => place.name === name);
  return nearestSpot(network, toMiles(town.lon, town.lat)).to;
}

test('the car can be driven from Norman to El Reno with the arrow keys alone', () => {
  const start = pointNear('Norman');
  const end = pointNear('El Reno');

  // Find a route, working outward from El Reno: each point remembers the next
  // point on the way there.
  const next = new Map([[end, end]]);
  const queue = [end];
  for (const point of queue) {
    for (const way of network.ways[point]) {
      if (next.has(way)) continue;
      next.set(way, point);
      queue.push(way);
    }
  }
  assert.ok(next.has(start), 'no roads join Norman to El Reno');

  // Drive it one point at a time. At each point some arrow, or pair of
  // arrows, has to take the car to the next one.
  const arrows = [-1, 0, 1].flatMap((x) => [-1, 0, 1].map((y) => ({ x, y }))).filter(({ x, y }) => x || y);
  let spot = { from: start, to: start, miles: 0, moving: false };
  while (spot.to !== end) {
    const target = /** @type {number} */ (next.get(spot.to));
    const miles = Math.hypot(network.xs[target] - network.xs[spot.to], network.ys[target] - network.ys[spot.to]);
    const tries = arrows.map((arrow) => drive(network, spot, arrow, miles));
    const arrived = tries.find((tried) => tried.to === target && tried.miles >= miles);
    assert.ok(arrived, `no arrow drives on from ${network.xs[spot.to]}, ${network.ys[spot.to]}`);
    spot = arrived;
  }
});
