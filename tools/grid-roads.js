// Tells the rural one-mile grid from city streets.
//
// OpenStreetMap tags both the same way here, as "residential". What sets them
// apart is how tightly the roads are packed: a one-mile grid has about 2
// miles of road in every square mile, and a town has 10 or more.

import { milesFrom } from '../src/map.js';

// The roads are counted in squares this many miles across. A stretch of road
// is judged by its own square and the eight around it.
const squareMiles = 0.5;

// The most road, in miles for each square mile, that still counts as open
// country.
const mostMilesPerSquareMile = 3;

// A long straight stretch is counted in bits no longer than this, in miles,
// so that it is shared out among the squares it passes through.
const bitMiles = 0.25;

/**
 * Picks out the roads that run through open country. A road is kept or left
 * out whole, by how tightly roads are packed along it on average.
 * @template {{ points: number[][] }} Road
 * @param {Road[]} roads The roads OpenStreetMap calls residential. Each
 *   point is [longitude, latitude].
 * @param {{ south: number, west: number, north: number, east: number }} bounds
 * @returns {Road[]}
 */
export function gridRoads(roads, bounds) {
  const toMiles = milesFrom(bounds);
  const bits = roads.map((road) => bitsOf(road.points.map(([lon, lat]) => toMiles(lon, lat))));

  // How many miles of road each square holds.
  /** @type {Map<string, number>} */
  const held = new Map();
  for (const bit of bits.flat()) {
    const key = `${Math.floor(bit.x / squareMiles)},${Math.floor(bit.y / squareMiles)}`;
    held.set(key, (held.get(key) ?? 0) + bit.miles);
  }

  /**
   * How tightly roads are packed around a place, in miles for each square
   * mile.
   * @param {{ x: number, y: number }} place
   */
  const packed = ({ x, y }) => {
    const column = Math.floor(x / squareMiles);
    const row = Math.floor(y / squareMiles);
    let miles = 0;
    for (let across = -1; across <= 1; across++) {
      for (let up = -1; up <= 1; up++) miles += held.get(`${column + across},${row + up}`) ?? 0;
    }
    return miles / (9 * squareMiles * squareMiles);
  };

  return roads.filter((road, i) => {
    let miles = 0;
    let sum = 0;
    for (const bit of bits[i]) {
      miles += bit.miles;
      sum += packed(bit) * bit.miles;
    }
    return miles > 0 && sum / miles <= mostMilesPerSquareMile;
  });
}

/**
 * Cuts a road into short bits.
 * @param {{ x: number, y: number }[]} points
 * @returns {{ x: number, y: number, miles: number }[]} Each bit's middle and
 *   its length.
 */
function bitsOf(points) {
  const bits = [];
  for (let i = 1; i < points.length; i++) {
    const from = points[i - 1];
    const to = points[i];
    const miles = Math.hypot(to.x - from.x, to.y - from.y);
    const count = Math.ceil(miles / bitMiles);
    for (let n = 0; n < count; n++) {
      const share = (n + 0.5) / count;
      bits.push({ x: from.x + (to.x - from.x) * share, y: from.y + (to.y - from.y) * share, miles: miles / count });
    }
  }
  return bits;
}

/**
 * Trims away the stretches of road that lead nowhere: driveways, culs-de-sac
 * and the tail of a road past its last junction. What is left of each road
 * joins another road at both ends.
 * @template {{ points: number[][] }} Road
 * @param {Road[]} roads The roads to trim.
 * @param {{ points: number[][] }[]} others The roads they may join, which
 *   are left alone.
 * @returns {Road[]}
 */
export function withoutDeadEnds(roads, others) {
  /** @param {number[]} point */
  const name = ([lon, lat]) => `${lon},${lat}`;

  // For each point, the points one step along a road from it.
  /** @type {Map<string, Set<string>>} */
  const ways = new Map();
  for (const road of [...roads, ...others]) {
    for (let i = 1; i < road.points.length; i++) {
      const from = name(road.points[i - 1]);
      const to = name(road.points[i]);
      if (from === to) continue;
      if (!ways.has(from)) ways.set(from, new Set());
      if (!ways.has(to)) ways.set(to, new Set());
      ways.get(from)?.add(to);
      ways.get(to)?.add(from);
    }
  }

  /**
   * Whether a point is the loose end of a road: only one way leads from it.
   * @param {number[]} point
   */
  const loose = (point) => (ways.get(name(point))?.size ?? 0) <= 1;
  /**
   * Forgets the step between two points.
   * @param {number[]} a
   * @param {number[]} b
   */
  const forget = (a, b) => {
    ways.get(name(a))?.delete(name(b));
    ways.get(name(b))?.delete(name(a));
  };

  // Trimming one loose end can leave another, so go round until none is left.
  let trimmed = roads.map((road) => ({ ...road, points: [...road.points] }));
  let changed = true;
  while (changed) {
    changed = false;
    for (const { points } of trimmed) {
      while (points.length >= 2 && loose(points[0])) {
        forget(points[0], points[1]);
        points.shift();
        changed = true;
      }
      while (points.length >= 2 && loose(/** @type {number[]} */ (points.at(-1)))) {
        forget(/** @type {number[]} */ (points.at(-1)), /** @type {number[]} */ (points.at(-2)));
        points.pop();
        changed = true;
      }
    }
    trimmed = trimmed.filter(({ points }) => points.length >= 2);
  }
  return trimmed;
}
