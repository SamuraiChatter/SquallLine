import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { test } from 'node:test';

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
