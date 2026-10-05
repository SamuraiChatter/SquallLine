// Bakes the territory's roads, towns and county lines into data/map.json.
//
//   node tools/bake-map.js
//
// Run it by hand when the territory changes, then commit the new file. It is
// the only thing that ever contacts OpenStreetMap: the game itself just loads
// the file. The data is © OpenStreetMap contributors, under the ODbL.

import { writeFileSync } from 'node:fs';
import { gridRoads, withoutDeadEnds } from './grid-roads.js';

// The territory: central Oklahoma around Norman, about 56 miles from west to
// east and 62 from south to north.
const bounds = { south: 34.8, west: -98.0, north: 35.7, east: -97.0 };

const query = `
[out:json][timeout:300][bbox:${bounds.south},${bounds.west},${bounds.north},${bounds.east}];
(
  way[highway~"^(motorway|trunk|primary|secondary|tertiary|unclassified)(_link)?$"];
  way[highway=residential];
  node[place~"^(city|town|village)$"];
  relation[boundary=administrative][admin_level=6];
);
out geom;`;

const response = await fetch('https://overpass-api.de/api/interpreter', {
  method: 'POST',
  headers: { 'User-Agent': 'SquallLine map bake (github.com/SamuraiChatter/SquallLine)' },
  body: new URLSearchParams({ data: query }),
});
if (!response.ok) throw new Error(`Overpass answered ${response.status}: ${await response.text()}`);
const { elements, remark } = await response.json();
// A query that runs out of time still answers "OK", with a remark and only
// part of the data. Stop before that overwrites a good file.
if (remark || !elements.length) throw new Error(`Overpass gave up part way: ${remark ?? 'nothing came back'}`);

/**
 * Five decimal places is about a yard. Rounding the same way everywhere keeps
 * a point shared by two roads identical in both.
 * @param {number} n
 */
const round = (n) => Math.round(n * 1e5) / 1e5;

/**
 * Cuts a line at the edge of the territory. A line that leaves and comes back
 * becomes several pieces.
 * @param {{ lon: number, lat: number }[]} line
 * @returns {number[][][]} Pieces, each a list of [lon, lat] points.
 */
function clip(line) {
  /** @type {number[][][]} */
  const pieces = [];
  /** @type {number[][] | null} */
  let piece = null;
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1];
    const b = line[i];
    // Find the part of the step from a to b that is inside: from share t0 of
    // the way along to share t1.
    let t0 = 0;
    let t1 = 1;
    const dx = b.lon - a.lon;
    const dy = b.lat - a.lat;
    const edges = [
      [-dx, a.lon - bounds.west],
      [dx, bounds.east - a.lon],
      [-dy, a.lat - bounds.south],
      [dy, bounds.north - a.lat],
    ];
    for (const [p, q] of edges) {
      if (p === 0) {
        if (q < 0) t0 = 2;
      } else if (p < 0) {
        t0 = Math.max(t0, q / p);
      } else {
        t1 = Math.min(t1, q / p);
      }
    }
    // Nothing inside, or only a touch on the edge.
    if (t0 >= t1) {
      piece = null;
      continue;
    }
    const from = [round(a.lon + dx * t0), round(a.lat + dy * t0)];
    const to = [round(a.lon + dx * t1), round(a.lat + dy * t1)];
    if (!piece || t0 > 0) {
      piece = [from];
      pieces.push(piece);
    }
    // Two points under a yard apart round to the same place; keep one.
    const end = /** @type {number[]} */ (piece.at(-1));
    if (to[0] !== end[0] || to[1] !== end[1]) piece.push(to);
    if (t1 < 1) piece = null;
  }
  return pieces.filter((points) => points.length >= 2);
}

const roads = [];
const places = [];
const counties = [];
const countyWaysSeen = new Set();

for (const element of elements) {
  if (element.type === 'way') {
    for (const points of clip(element.geometry)) {
      roads.push({
        class: element.tags.highway,
        name: element.tags.name ?? '',
        // A road with several numbers lists them as "I 35;US 77", with no
        // spaces around the semicolons.
        ref: (element.tags.ref ?? '').split(';').map((/** @type {string} */ part) => part.trim()).join(';'),
        points,
      });
    }
  } else if (element.type === 'node') {
    places.push({
      kind: element.tags.place,
      name: element.tags.name ?? '',
      lon: round(element.lon),
      lat: round(element.lat),
    });
  } else {
    // A county. Its neighbours share its border ways, so keep each way once.
    for (const member of element.members) {
      if (member.type !== 'way' || !member.geometry || countyWaysSeen.has(member.ref)) continue;
      countyWaysSeen.add(member.ref);
      counties.push(...clip(member.geometry));
    }
  }
}

// OpenStreetMap calls both the rural one-mile grid and city streets
// "residential". Keep the grid and leave the streets out.
const mainRoads = roads.filter((road) => road.class !== 'residential');
const grid = withoutDeadEnds(
  gridRoads(roads.filter((road) => road.class === 'residential'), bounds),
  mainRoads,
);

const map = {
  credit: '© OpenStreetMap contributors, ODbL 1.0. https://www.openstreetmap.org/copyright',
  bounds,
  roads: [...mainRoads, ...grid],
  places,
  counties,
};
const file = new URL('../data/map.json', import.meta.url);
writeFileSync(file, JSON.stringify(map));
console.log(`${mainRoads.length} main roads, ${grid.length} grid roads, ${places.length} places, ${counties.length} county lines`);
