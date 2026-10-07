import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { test } from 'node:test';
import { drivingLines } from '../src/freeways.js';
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
/** @type {{ class: string, points: { x: number, y: number }[] }[]} */
const roads = map.roads
  .filter((/** @type {{ class: string }} */ road) => tierOf(road.class) >= 0)
  .map((/** @type {{ class: string, points: number[][] }} */ road) => ({
    class: road.class,
    points: road.points.map(([lon, lat]) => toMiles(lon, lat)),
  }));
const driving = drivingLines(roads);
const network = buildNetwork(driving.lines);
// The rural grid is the roads OpenStreetMap calls residential.
const gridRoads = roads.filter((road) => road.class === 'residential');

/**
 * The point of the network nearest a town.
 * @param {string} name
 */
function pointNear(name) {
  const town = map.places.find((/** @type {{ name: string }} */ place) => place.name === name);
  return nearestSpot(network, toMiles(town.lon, town.lat)).to;
}

const arrows = [-1, 0, 1].flatMap((x) => [-1, 0, 1].map((y) => ({ x, y }))).filter(({ x, y }) => x || y);

/**
 * Drives from the first point to each of the others in turn, each one step
 * along a road from the one before. At each point some arrow, or pair of
 * arrows, has to take the car to the next one.
 * @param {number[]} points
 * @returns {string} What went wrong, or '' if the car arrived.
 */
function driveAlong(points) {
  let spot = { from: points[0], to: points[0], miles: 0, moving: false };
  for (const target of points.slice(1)) {
    const miles = Math.hypot(network.xs[target] - network.xs[spot.to], network.ys[target] - network.ys[spot.to]);
    const tries = arrows.map((arrow) => drive(network, spot, arrow, miles));
    const arrived = tries.find((tried) => tried.to === target && tried.miles >= miles);
    if (!arrived) return `no arrow drives on from ${network.xs[spot.to]}, ${network.ys[spot.to]}`;
    spot = arrived;
  }
  return '';
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

  const route = [start];
  while (route.at(-1) !== end) route.push(/** @type {number} */ (next.get(/** @type {number} */ (route.at(-1)))));
  assert.equal(driveAlong(route), '');
});

/**
 * How many miles along a straight line each road crosses it.
 * @param {{ x: number, y: number }} from
 * @param {{ x: number, y: number }} to
 */
function crossings(from, to) {
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  const hits = [];
  for (const { points } of roads) {
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1];
      const b = points[i];
      const d = (to.x - from.x) * (b.y - a.y) - (to.y - from.y) * (b.x - a.x);
      if (!d) continue;
      const along = ((a.x - from.x) * (b.y - a.y) - (a.y - from.y) * (b.x - a.x)) / d;
      const across = ((a.x - from.x) * (to.y - from.y) - (a.y - from.y) * (to.x - from.x)) / d;
      if (along >= 0 && along <= 1 && across >= 0 && across < 1) hits.push(along * length);
    }
  }
  hits.sort((a, b) => a - b);
  // A road made of several pieces, or a divided one, counts once.
  return hits.filter((hit, i) => i === 0 || hit - hits[i - 1] > 0.1);
}

test('in open country south-west of Norman, roads are about a mile apart', () => {
  // Ten-mile lines across the country around Cole and Dibble: three from west
  // to east and three from south to north.
  const lines = [
    ...[-12.3, -10.3, -9.3].map((y) => [{ x: -8, y }, { x: 2, y }]),
    ...[-6.3, -2.3, 0.7].map((x) => [{ x, y: -16 }, { x, y: -6 }]),
  ];
  for (const [from, to] of lines) {
    const hits = crossings(from, to);
    const gaps = hits.slice(1).map((hit, i) => hit - hits[i]);
    // Most sections have a road on every side. Where one is missing the gap
    // is two miles, and now and then three.
    const mile = gaps.filter((gap) => gap > 0.85 && gap < 1.15).length;
    assert.ok(mile >= gaps.length / 2 - 1, `from ${from.x}, ${from.y}: gaps of ${gaps.map((gap) => gap.toFixed(1))}`);
    assert.ok(Math.max(...gaps) < 3.2, `from ${from.x}, ${from.y}: a gap of ${Math.max(...gaps).toFixed(1)} miles`);
  }
});

test('inside Norman, Moore and Oklahoma City there are no grid roads', () => {
  for (const name of ['Norman', 'Moore', 'Oklahoma City']) {
    const town = map.places.find((/** @type {{ name: string }} */ place) => place.name === name);
    const middle = toMiles(town.lon, town.lat);
    for (const { points } of gridRoads) {
      for (const { x, y } of points) {
        assert.ok(Math.hypot(x - middle.x, y - middle.y) > 2, `a grid road comes within two miles of the middle of ${name}`);
      }
    }
  }
});

test('the car can turn from a main road onto a grid road and back', () => {
  /** @param {{ x: number, y: number }} point */
  const pointAt = ({ x, y }) => nearestSpot(network, { x, y }).to;
  // Open country south-west of Norman: every place there where a grid road
  // ends at a main road.
  const onMainRoad = new Set(
    roads.filter((road) => road.class !== 'residential').flatMap((road) => road.points.map(({ x, y }) => `${x},${y}`)),
  );
  let turns = 0;
  for (const { points } of gridRoads) {
    const [end, inner] = points;
    if (end.x < -8 || end.x > 2 || end.y < -16 || end.y > -6) continue;
    const junction = pointAt(end);
    const onGrid = pointAt(inner);
    const onMain = network.ways[junction].find((point) => onMainRoad.has(`${network.xs[point]},${network.ys[point]}`));
    if (onMain === undefined) continue;
    assert.equal(driveAlong([onMain, junction, onGrid]), '');
    assert.equal(driveAlong([onGrid, junction, onMain]), '');
    turns++;
  }
  assert.ok(turns > 20, `only ${turns} junctions were tried`);
});

/**
 * How many roads lead out of the busiest point within a few yards of a place.
 * @param {{ x: number, y: number }} place
 */
function waysNear(place) {
  let most = 0;
  for (let point = 0; point < network.xs.length; point++) {
    if (Math.hypot(network.xs[point] - place.x, network.ys[point] - place.y) < 0.03) most = Math.max(most, network.ways[point].length);
  }
  return most;
}

test('Robinson Street meets Interstate 35 in Norman at one four-way junction', () => {
  assert.equal(waysNear({ x: 0.813, y: -1.177 }), 4);
});

test('Rock Creek Road crosses Interstate 35 in Norman on a bridge, with no junction', () => {
  assert.equal(waysNear({ x: 0.812, y: -0.146 }), 2);
});

/**
 * How many interchanges are marked within so many miles of a place.
 * @param {{ x: number, y: number }} place
 * @param {number} miles
 */
const interchangesNear = (place, miles) =>
  driving.interchanges.filter((/** @type {{ x: number, y: number }} */ at) => Math.hypot(at.x - place.x, at.y - place.y) < miles).length;

test('Robinson Street at Interstate 35 is marked as one interchange', () => {
  assert.equal(interchangesNear({ x: 0.813, y: -1.177 }, 0.2), 1);
});

test('Rock Creek Road, a bridge over Interstate 35, is not marked', () => {
  assert.equal(interchangesNear({ x: 0.812, y: -0.146 }, 0.2), 0);
});

test('every interchange marked is a junction the car can turn at', () => {
  for (const at of driving.interchanges) {
    const point = nearestSpot(network, at).to;
    assert.ok(Math.hypot(network.xs[point] - at.x, network.ys[point] - at.y) < 1e-9, `no point at ${at.x}, ${at.y}`);
    assert.ok(network.ways[point].length >= 3, `no junction at ${at.x}, ${at.y}`);
  }
});

test('no ramp off a freeway is left to drive on', () => {
  const driven = new Set(network.xs.map((x, point) => `${x},${network.ys[point]}`));
  const onOtherRoads = new Set(
    roads.filter((road) => road.class !== 'motorway_link').flatMap((road) => road.points.map(({ x, y }) => `${x},${y}`)),
  );
  const onFreeway = new Set(
    roads.filter((road) => road.class === 'motorway').flatMap((road) => road.points.map(({ x, y }) => `${x},${y}`)),
  );
  for (const road of roads) {
    if (road.class !== 'motorway_link' || !road.points.some(({ x, y }) => onFreeway.has(`${x},${y}`))) continue;
    for (const { x, y } of road.points) {
      assert.ok(onOtherRoads.has(`${x},${y}`) || !driven.has(`${x},${y}`), `a ramp can be driven at ${x}, ${y}`);
    }
  }
});

test('driving each freeway as one line cuts no road off from the rest', () => {
  /**
   * The places that can be reached from Norman.
   * @param {import('../src/roads.js').RoadNetwork} roadNetwork
   */
  const reachable = (roadNetwork) => {
    const norman = map.places.find((/** @type {{ name: string }} */ place) => place.name === 'Norman');
    const reached = new Set([nearestSpot(roadNetwork, toMiles(norman.lon, norman.lat)).to]);
    for (const point of reached) for (const way of roadNetwork.ways[point]) reached.add(way);
    return new Set([...reached].map((point) => `${roadNetwork.xs[point]},${roadNetwork.ys[point]}`));
  };
  const before = reachable(buildNetwork(roads.map((road) => road.points)));
  const after = reachable(network);
  // Everything still on the map that could be reached before still can be.
  for (let point = 0; point < network.xs.length; point++) {
    const place = `${network.xs[point]},${network.ys[point]}`;
    assert.ok(!before.has(place) || after.has(place), `${place} is cut off`);
  }
});
