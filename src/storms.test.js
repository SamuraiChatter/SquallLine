import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addTornado, moveTornadoEnd, pathMiles, placeAlong, readStorm, shareNearest, townsEntered, writeStorm } from './storms.js';

// A path with easy numbers: 10 miles east, then 10 miles north.
const path = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }];

/**
 * @param {number} actual
 * @param {number} expected
 */
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} is not ${expected}`);

test('a path is as long as its legs together', () => {
  assert.equal(pathMiles(path), 20);
});

test('a share of the way along a path is a place on it, round the corner', () => {
  assert.deepEqual(placeAlong(path, 0), { x: 0, y: 0 });
  assert.deepEqual(placeAlong(path, 0.25), { x: 5, y: 0 });
  assert.deepEqual(placeAlong(path, 0.75), { x: 10, y: 5 });
  assert.deepEqual(placeAlong(path, 1), { x: 10, y: 10 });
});

test('the spot on a path nearest a click is found on the right leg', () => {
  const south = shareNearest(path, { x: 5, y: -2 });
  near(south.share, 0.25);
  near(south.miles, 2);
  const east = shareNearest(path, { x: 11, y: 5 });
  near(east.share, 0.75);
  near(east.miles, 1);
});

test('a click past the end of a path counts as its end', () => {
  near(shareNearest(path, { x: 10, y: 15 }).share, 1);
});

// Tornadoes. One tornado cannot be shorter than 0.02 of the path, nor come
// closer than 0.02 to the next.

test('a tornado is added between the two spots marked, whichever came first', () => {
  assert.deepEqual(addTornado([], 0.6, 0.4, 3), [{ start: 0.4, end: 0.6, strength: 3 }]);
});

test('tornadoes are kept in order along the path', () => {
  const one = addTornado([], 0.6, 0.8, 1);
  const two = addTornado(one, 0.1, 0.3, 2);
  assert.deepEqual(two.map((t) => t.start), [0.1, 0.6]);
});

test('a new tornado is cut short rather than overlap the next one', () => {
  const [added] = addTornado([{ start: 0.5, end: 0.7, strength: 0 }], 0.2, 0.9, 0);
  near(added.start, 0.2);
  near(added.end, 0.48);
});

test('a new tornado that starts inside another starts just after it', () => {
  const [, added] = addTornado([{ start: 0.2, end: 0.4, strength: 0 }], 0.3, 0.6, 0);
  near(added.start, 0.42);
  near(added.end, 0.6);
});

test('a new tornado with no room is not added', () => {
  const tornadoes = [{ start: 0.2, end: 0.4, strength: 0 }, { start: 0.43, end: 0.6, strength: 0 }];
  assert.equal(addTornado(tornadoes, 0.3, 0.5, 0), tornadoes);
});

test('dragging the end of a tornado stops short of the next tornado', () => {
  const tornadoes = [{ start: 0.1, end: 0.3, strength: 0 }, { start: 0.5, end: 0.7, strength: 0 }];
  near(moveTornadoEnd(tornadoes, 0, 'end', 0.9)[0].end, 0.48);
  near(moveTornadoEnd(tornadoes, 1, 'start', 0)[1].start, 0.32);
});

test('dragging one end of a tornado stops short of its other end', () => {
  const tornadoes = [{ start: 0.4, end: 0.6, strength: 0 }];
  near(moveTornadoEnd(tornadoes, 0, 'start', 0.9)[0].start, 0.58);
  near(moveTornadoEnd(tornadoes, 0, 'end', 0)[0].end, 0.42);
});

test('the first tornado can start at the start of the path and the last end at its end', () => {
  const tornadoes = [{ start: 0.4, end: 0.6, strength: 0 }];
  near(moveTornadoEnd(tornadoes, 0, 'start', -1)[0].start, 0);
  near(moveTornadoEnd(tornadoes, 0, 'end', 2)[0].end, 1);
});

// Towns. A town reaches 2 miles from its middle and a village half a mile.
const townMiles = { town: 2, village: 0.5 };
const places = [
  { kind: 'town', name: 'Eastham', x: 5, y: 1 },
  { kind: 'village', name: 'Cornerby', x: 11, y: 1 },
  { kind: 'town', name: 'Faraway', x: 30, y: 30 },
];

test('a tornado whose path enters a town is named with the town', () => {
  assert.deepEqual(townsEntered(path, { start: 0.2, end: 0.3 }, places, townMiles), ['Eastham']);
});

test('a tornado that stops short of a town does not enter it', () => {
  assert.deepEqual(townsEntered(path, { start: 0, end: 0.1 }, places, townMiles), []);
});

test('a village is entered only from close by', () => {
  assert.deepEqual(townsEntered(path, { start: 0.5, end: 0.6 }, places, townMiles), []);
  assert.deepEqual(townsEntered(path, { start: 0.5, end: 0.6 }, places, { ...townMiles, village: 1.5 }), ['Cornerby']);
});

// Storm files.

const storm = {
  path,
  tornadoes: [{ start: 0.25, end: 0.4, strength: 2 }, { start: 0.6, end: 0.8, strength: 5 }],
  falseAlarms: [{ start: 0.05, end: 0.15 }, { start: 0.45, end: 0.5 }],
};

test('a saved storm reads back the same', () => {
  assert.deepEqual(readStorm(writeStorm(storm)), storm);
});

test('a file that is not a storm is turned away', () => {
  for (const text of ['', 'hello', 'null', '[]', '{}', '{"path":[],"tornadoes":[]}', '{"path":"x","tornadoes":[]}']) {
    assert.throws(() => readStorm(text), Error, text);
  }
});

test('a storm with a corner that is not a place on the map is turned away', () => {
  const broken = [
    { x: 0 },
    { x: '1', y: 2 },
    { x: 1e9, y: 0 },
    null,
  ];
  for (const corner of broken) {
    assert.throws(() => readStorm(JSON.stringify({ path: [{ x: 0, y: 0 }, corner], tornadoes: [] })));
  }
});

test('a storm whose tornadoes overlap or run backwards is turned away', () => {
  const broken = [
    [{ start: 0.5, end: 0.4, strength: 0 }],
    [{ start: 0.1, end: 0.5, strength: 0 }, { start: 0.4, end: 0.6, strength: 0 }],
    [{ start: -0.1, end: 0.5, strength: 0 }],
    [{ start: 0.1, end: 1.5, strength: 0 }],
    [{ start: 0.1, end: 0.5, strength: 9 }],
    [{ start: 0.1, end: 0.5, strength: 1.5 }],
  ];
  for (const tornadoes of broken) {
    assert.throws(() => readStorm(JSON.stringify({ path, tornadoes })), Error, JSON.stringify(tornadoes));
  }
});

test('a storm with no tornadoes yet can still be saved and read', () => {
  assert.deepEqual(readStorm(writeStorm({ path, tornadoes: [], falseAlarms: [] })), { path, tornadoes: [], falseAlarms: [] });
});

// False alarms in storm files.

test('a storm file saved before there were false alarms reads with none', () => {
  const old = JSON.stringify({ path, tornadoes: storm.tornadoes });
  assert.deepEqual(readStorm(old), { path, tornadoes: storm.tornadoes, falseAlarms: [] });
});

test('a storm with only false alarms can be saved and read', () => {
  const quiet = { path, tornadoes: [], falseAlarms: [{ start: 0.2, end: 0.4 }] };
  assert.deepEqual(readStorm(writeStorm(quiet)), quiet);
});

test('a false alarm can sit right up against a tornado without touching it', () => {
  const tornadoes = [{ start: 0.4, end: 0.6, strength: 1 }];
  const falseAlarms = [{ start: 0.2, end: 0.39 }, { start: 0.61, end: 0.8 }];
  assert.deepEqual(readStorm(JSON.stringify({ path, tornadoes, falseAlarms })).falseAlarms, falseAlarms);
});

test('a storm whose false alarm overlaps a tornado is turned away, and the message says why', () => {
  const tornadoes = [{ start: 0.4, end: 0.6, strength: 1 }];
  const broken = [
    [{ start: 0.3, end: 0.5 }],
    [{ start: 0.5, end: 0.7 }],
    [{ start: 0.45, end: 0.55 }],
    [{ start: 0.3, end: 0.7 }],
    [{ start: 0.3, end: 0.4 }],
    [{ start: 0.6, end: 0.7 }],
  ];
  for (const falseAlarms of broken) {
    assert.throws(() => readStorm(JSON.stringify({ path, tornadoes, falseAlarms })), /false alarm overlaps a tornado/, JSON.stringify(falseAlarms));
  }
});

test('a storm whose false alarms overlap each other, run backwards or leave the path is turned away', () => {
  const broken = [
    [{ start: 0.1, end: 0.3 }, { start: 0.2, end: 0.4 }],
    [{ start: 0.5, end: 0.6 }, { start: 0.1, end: 0.2 }],
    [{ start: 0.5, end: 0.4 }],
    [{ start: -0.1, end: 0.2 }],
    [{ start: 0.8, end: 1.2 }],
    [{ start: '0.1', end: 0.2 }],
    [null],
    'none',
  ];
  for (const falseAlarms of broken) {
    assert.throws(() => readStorm(JSON.stringify({ path, tornadoes: [], falseAlarms })), /false alarms/, JSON.stringify(falseAlarms));
  }
});

test('a storm with too many false alarms is turned away', () => {
  const falseAlarms = Array.from({ length: 21 }, (_, i) => ({ start: i * 0.04, end: i * 0.04 + 0.01 }));
  assert.throws(() => readStorm(JSON.stringify({ path, tornadoes: [], falseAlarms })), /too many false alarms/);
});
