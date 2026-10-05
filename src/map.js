// The real map. Loads data/map.json and gets it ready to draw: everything is
// turned from longitude and latitude into miles from the middle of the
// territory, and the roads are sorted into squares so that only the ones near
// the view need drawing.

import { buildNetwork } from './roads.js';

// How many miles across each square is.
export const squareMiles = 4;

// Roads by importance, most important first. A ramp ("_link") counts with the
// road it joins. The last tier is the rural grid of county roads: the bake
// script has already left the city streets out of it.
const tiers = [['motorway'], ['trunk', 'primary'], ['secondary'], ['tertiary', 'unclassified'], ['residential']];

/**
 * @typedef {object} GameMap
 * @property {Map<string, Path2D[]>} squares For each square, named by its
 *   column and row, one path of roads for each tier.
 * @property {Path2D} counties The county lines.
 * @property {{ kind: string, name: string, x: number, y: number }[]} places
 * @property {import('./roads.js').RoadNetwork} roads The roads the car
 *   drives on: every road that is drawn.
 */

/**
 * How to turn longitude and latitude into miles east and north of the middle
 * of the territory.
 * @param {{ south: number, west: number, north: number, east: number }} bounds
 * @returns {(lon: number, lat: number) => { x: number, y: number }}
 */
export function milesFrom(bounds) {
  const { south, west, north, east } = bounds;
  const midLat = (south + north) / 2;
  const midLon = (west + east) / 2;
  // A degree of latitude is about 69 miles everywhere. A degree of longitude
  // shrinks toward the poles.
  const milesPerLat = 69.05;
  const milesPerLon = 69.17 * Math.cos((midLat * Math.PI) / 180);
  return (lon, lat) => ({ x: (lon - midLon) * milesPerLon, y: (lat - midLat) * milesPerLat });
}

/**
 * Which tier a class of road belongs to. A ramp ("_link") counts with the
 * road it joins.
 * @param {string} roadClass
 * @returns {number} Its tier, most important first, or -1 for a class the
 *   game leaves out.
 */
export function tierOf(roadClass) {
  return tiers.findIndex((classes) => classes.includes(roadClass.replace('_link', '')));
}

/** @returns {Promise<GameMap>} */
export async function loadMap() {
  const response = await fetch('data/map.json');
  if (!response.ok) throw new Error(`data/map.json answered ${response.status}`);
  const data = await response.json();
  const toMiles = milesFrom(data.bounds);

  /**
   * @param {Path2D} path
   * @param {{ x: number, y: number }[]} points
   */
  const trace = (path, points) => {
    points.forEach(({ x, y }, i) => (i === 0 ? path.moveTo(x, y) : path.lineTo(x, y)));
  };

  /** @type {GameMap['squares']} */
  const squares = new Map();
  /** @type {{ x: number, y: number }[][]} */
  const lines = [];
  for (const road of data.roads) {
    const tier = tierOf(road.class);
    if (tier < 0) continue;
    const points = road.points.map((/** @type {number[]} */ [lon, lat]) => toMiles(lon, lat));
    lines.push(points);
    // A road goes into every square it could pass through.
    const columns = points.map((/** @type {{ x: number }} */ p) => Math.floor(p.x / squareMiles));
    const rows = points.map((/** @type {{ y: number }} */ p) => Math.floor(p.y / squareMiles));
    for (let column = Math.min(...columns); column <= Math.max(...columns); column++) {
      for (let row = Math.min(...rows); row <= Math.max(...rows); row++) {
        const key = `${column},${row}`;
        let paths = squares.get(key);
        if (!paths) squares.set(key, (paths = tiers.map(() => new Path2D())));
        trace(paths[tier], points);
      }
    }
  }

  const counties = new Path2D();
  for (const line of data.counties) trace(counties, line.map((/** @type {number[]} */ [lon, lat]) => toMiles(lon, lat)));

  const places = data.places.map((/** @type {{ kind: string, name: string, lon: number, lat: number }} */ place) => ({
    kind: place.kind,
    name: place.name,
    ...toMiles(place.lon, place.lat),
  }));

  return { squares, counties, places, roads: buildNetwork(lines) };
}
