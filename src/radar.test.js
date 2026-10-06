import assert from 'node:assert/strict';
import { test } from 'node:test';
import { beamPassed, bearingOf, colourOf, coverOf, coupletOf, dbzAt, hailDbz, hookSpot, inCouplet, rotationOf, velocityAt, velocityColourOf, windCoverOf } from './radar.js';
import { funnelOf, inHailCore } from './rules.js';

const day = /** @type {import('./rules.js').Tuning} */ (/** @type {unknown} */ ({ hail: { coreMilesLong: 1.5, coreMilesWide: 1 } }));

/**
 * A storm with its middle at a spot.
 * @param {Partial<import('./rules.js').Storm>} [more]
 * @returns {import('./rules.js').Storm}
 */
function stormAt(more = {}) {
  const middle = { x: 4, y: -7 };
  return { miles: 0, ...middle, heading: { x: 1, y: 0 }, hook: 0, tornadoHook: 0, tornado: 0, funnel: funnelOf(middle), strength: 0, spent: false, ...more };
}

/** @param {import('./rules.js').Storm} storm */
const atFunnel = (storm, hookDbz = 40) => dbzAt(storm.funnel, storm, day, hookDbz);

test('every spot inside the hail core is at hail strength, and no spot outside it is', () => {
  const storm = stormAt({ hook: 1, tornado: 1, strength: 5 });
  let inside = 0;
  for (let x = storm.x - 9; x <= storm.x + 14; x += 0.07) {
    for (let y = storm.y - 9; y <= storm.y + 14; y += 0.07) {
      const hail = inHailCore({ x, y }, storm, day);
      assert.equal(dbzAt({ x, y }, storm, day, 40) >= hailDbz, hail, `at ${x}, ${y}`);
      if (hail) inside += 1;
    }
  }
  assert.ok(inside > 100);
});

test('the tip of a fully grown hook is at the funnel', () => {
  const storm = stormAt();
  const tip = hookSpot(storm, 1);
  assert.ok(Math.hypot(tip.x - storm.funnel.x, tip.y - storm.funnel.y) < 1e-9);
});

test('a fully grown hook brings rain to the funnel, and a half grown one does not reach it', () => {
  const none = atFunnel(stormAt());
  assert.ok(atFunnel(stormAt({ hook: 1 })) > none + 10);
  assert.ok(Math.abs(atFunnel(stormAt({ hook: 0.5 })) - none) < 1);
});

test('the hook leaves the storm before it reaches its tip', () => {
  const half = stormAt({ hook: 0.5 });
  const root = hookSpot(half, 0.25);
  assert.ok(dbzAt(root, half, day, 40) > dbzAt(root, stormAt(), day, 40) + 5);
});

test('a stronger hook echo rains harder along the hook', () => {
  const storm = stormAt({ hook: 1 });
  assert.ok(atFunnel(storm, 50) > atFunnel(storm, 30) + 10);
});

test('a tornado on the ground throws up a debris ball at the funnel', () => {
  const hook = atFunnel(stormAt({ hook: 1 }));
  assert.ok(atFunnel(stormAt({ hook: 1, tornado: 1 })) > hook + 10);
});

test('far from the storm it is dry', () => {
  const storm = stormAt({ hook: 1, tornado: 1 });
  assert.equal(dbzAt({ x: storm.x - 20, y: storm.y }, storm, day, 40), 0);
  assert.equal(dbzAt({ x: storm.x, y: storm.y + 20 }, storm, day, 40), 0);
});

test('the big shield of rain is ahead of the storm, to its north-east', () => {
  const storm = stormAt();
  const ahead = dbzAt({ x: storm.x + 4, y: storm.y + 4 }, storm, day, 40);
  const behind = dbzAt({ x: storm.x - 4, y: storm.y - 4 }, storm, day, 40);
  assert.ok(ahead > 30);
  assert.ok(behind < 20);
});

test('rain too light to show has no colour, and hail is purple', () => {
  assert.equal(colourOf(19.9), undefined);
  assert.deepEqual(colourOf(20), [20, 0x02, 0xfd, 0x02]);
  assert.deepEqual(colourOf(hailDbz), [65, 0xf8, 0x00, 0xfd]);
  assert.deepEqual(colourOf(90), [70, 0x98, 0x54, 0xc6]);
});

test('light rain covers little of the map and heavy rain most of it', () => {
  assert.equal(coverOf(20, 35, 75), 35);
  assert.equal(coverOf(65, 35, 75), 75);
  assert.equal(coverOf(70, 35, 75), 75);
  assert.ok(coverOf(40, 35, 75) > 35 && coverOf(40, 35, 75) < 75);
});

// The sweeping beam. Bearings and the beam are in turns clockwise from north.

test('a bearing is how far round from north a spot is, as seen from the radar', () => {
  const site = { x: 10, y: 5 };
  assert.equal(bearingOf({ x: 10, y: 9 }, site), 0);
  assert.equal(bearingOf({ x: 13, y: 5 }, site), 0.25);
  assert.equal(bearingOf({ x: 10, y: 0 }, site), 0.5);
  assert.equal(bearingOf({ x: 2, y: 5 }, site), 0.75);
});

test('the beam has passed the bearings it turned through, and no others', () => {
  // A tenth of a turn, ending a quarter of the way round.
  assert.equal(beamPassed(0.2, 0.25, 0.1), true);
  assert.equal(beamPassed(0.25, 0.25, 0.1), true);
  assert.equal(beamPassed(0.14, 0.25, 0.1), false);
  assert.equal(beamPassed(0.26, 0.25, 0.1), false);
});

test('the beam passes bearings either side of north as it comes round', () => {
  // A tenth of a turn, ending just past north on its fourth time round.
  assert.equal(beamPassed(0.97, 3.03, 0.1), true);
  assert.equal(beamPassed(0.01, 3.03, 0.1), true);
  assert.equal(beamPassed(0.05, 3.03, 0.1), false);
  assert.equal(beamPassed(0.9, 3.03, 0.1), false);
});

test('a beam that has turned all the way round has passed everything', () => {
  assert.equal(beamPassed(0.6, 0.25, 1), true);
  assert.equal(beamPassed(0.26, 0.25, 1.5), true);
});

test('a beam that has not turned has passed nothing', () => {
  assert.equal(beamPassed(0.25, 0.25, 0), false);
});

test("the middle of the storm's rotation is inside the hook's curl, close to the funnel", () => {
  const storm = stormAt();
  const middle = rotationOf(storm);
  assert.ok(Math.abs(Math.hypot(middle.x - storm.funnel.x, middle.y - storm.funnel.y) - 0.9) < 1e-9);
  // Every spot on the hook is further from the middle than its tip is.
  for (let tenth = 0; tenth < 10; tenth++) {
    const spot = hookSpot(storm, tenth / 10);
    assert.ok(Math.hypot(spot.x - middle.x, spot.y - middle.y) > 0.9);
  }
});

// The velocity view: the wind along the radar's beam, in miles an hour. More
// than nothing is blowing away from the radar, less is blowing toward it.

// The storm of these tests is at 4 east, 7 south. One radar stands well to
// its north-east, as the game's does, and one well to its south-west.
const northEast = { x: 20, y: 9 };
const southWest = { x: -12, y: -23 };

/**
 * The spots one couplet's width either side of the middle of a storm's
 * rotation, across the beam: to the left and to the right, looking out from
 * the radar.
 * @param {import('./rules.js').Storm} storm
 * @param {import('./rules.js').Point} site
 */
function eitherSide(storm, site) {
  const couplet = coupletOf(storm);
  const far = Math.hypot(couplet.x - site.x, couplet.y - site.y);
  const out = { x: (couplet.x - site.x) / far, y: (couplet.y - site.y) / far };
  const left = { x: couplet.x - out.y * couplet.miles, y: couplet.y + out.x * couplet.miles };
  const right = { x: couplet.x + out.y * couplet.miles, y: couplet.y - out.x * couplet.miles };
  return { left: velocityAt(left, storm, site), right: velocityAt(right, storm, site) };
}

test('with no hook the wind is the broad flow of the storm, with no fast pair anywhere', () => {
  const storm = stormAt();
  for (let x = storm.x - 8; x <= storm.x + 13; x += 0.25) {
    for (let y = storm.y - 8; y <= storm.y + 13; y += 0.25) {
      assert.ok(Math.abs(velocityAt({ x, y }, storm, northEast)) < 30, `at ${x}, ${y}`);
    }
  }
});

test("the storm's own travel blows toward a radar ahead of it and away from one behind it", () => {
  // The storm is heading east.
  const storm = stormAt();
  assert.ok(velocityAt({ x: storm.x, y: storm.y }, storm, { x: storm.x + 20, y: storm.y }) < -10);
  assert.ok(velocityAt({ x: storm.x, y: storm.y }, storm, { x: storm.x - 20, y: storm.y }) > 10);
});

test('with a tornado on the ground a fast pair sits at the funnel, one side toward the radar and one away', () => {
  const storm = stormAt({ hook: 1, tornadoHook: 1, tornado: 1 });
  const couplet = coupletOf(storm);
  assert.ok(Math.hypot(couplet.x - storm.funnel.x, couplet.y - storm.funnel.y) < 1e-9);
  const { left, right } = eitherSide(storm, northEast);
  assert.ok(left < -30 && right > 30, `${left}, ${right}`);
});

test('the side toward the radar is the same way round for a storm on either side of the radar', () => {
  // The storm turns anticlockwise, so looking out from the radar the wind on
  // the left of the rotation comes toward it and the wind on the right goes
  // away, wherever the radar stands.
  for (const site of [northEast, southWest]) {
    for (const hook of [0.6, 1]) {
      const { left, right } = eitherSide(stormAt({ hook }), site);
      assert.ok(left < 0 && right > 0, `${JSON.stringify(site)} ${hook}: ${left}, ${right}`);
      assert.ok(right - left > 40);
    }
  }
});

test('the pair starts at the middle of the rotation and moves to the funnel as the hook grows', () => {
  const start = coupletOf(stormAt({ hook: 0.01 }));
  const middle = rotationOf(stormAt());
  assert.ok(Math.hypot(start.x - middle.x, start.y - middle.y) < 0.05);
  const storm = stormAt({ hook: 1 });
  const full = coupletOf(storm);
  assert.ok(Math.hypot(full.x - storm.funnel.x, full.y - storm.funnel.y) < 1e-9);
});

test('the pair gets tighter and faster as the hook grows', () => {
  const faint = coupletOf(stormAt({ hook: 0.2 }));
  const half = coupletOf(stormAt({ hook: 0.5 }));
  const full = coupletOf(stormAt({ hook: 1 }));
  assert.ok(faint.miles > half.miles && half.miles > full.miles);
  assert.ok(faint.mph < half.mph && half.mph < full.mph);
  assert.equal(coupletOf(stormAt()).mph, 0);
  // And so does what the radar sees of it.
  const wide = eitherSide(stormAt({ hook: 0.2 }), northEast);
  const tight = eitherSide(stormAt({ hook: 1 }), northEast);
  assert.ok(tight.right - tight.left > 2 * (wide.right - wide.left));
});

test('a false alarm has a pair like a real hook, which loosens as the hook fades', () => {
  const held = stormAt({ hook: 1, tornadoHook: 0 });
  const fading = stormAt({ hook: 0.4, tornadoHook: 0 });
  assert.deepEqual(coupletOf(held), coupletOf(stormAt({ hook: 1, tornadoHook: 1 })));
  assert.ok(coupletOf(fading).miles > coupletOf(held).miles);
  assert.ok(coupletOf(fading).mph < coupletOf(held).mph);
});

test('far from the storm there is no wind to show', () => {
  const storm = stormAt({ hook: 1 });
  assert.equal(velocityAt({ x: storm.x - 20, y: storm.y }, storm, northEast), 0);
});

test('wind toward the radar is green, wind away is red, faster is brighter and nearly still is dull', () => {
  const [stillRed, stillGreen, stillBlue] = velocityColourOf(0);
  assert.ok(Math.abs(stillRed - stillGreen) < 40 && Math.abs(stillGreen - stillBlue) < 40);
  assert.deepEqual(velocityColourOf(3), velocityColourOf(-3));
  for (const mph of [10, 25, 40, 70]) {
    const [awayRed, awayGreen] = velocityColourOf(mph);
    const [towardRed, towardGreen] = velocityColourOf(-mph);
    assert.ok(awayRed > awayGreen + 60, `${mph} away`);
    assert.ok(towardGreen > towardRed + 60, `${mph} toward`);
  }
  assert.ok(velocityColourOf(70)[0] > velocityColourOf(10)[0]);
  assert.ok(velocityColourOf(-70)[1] > velocityColourOf(-10)[1]);
});

test('the radar reads the wind close in round a couplet, where too little rain falls to show', () => {
  const storm = stormAt({ hook: 0.5 });
  const couplet = coupletOf(storm);
  // The middle of the rotation is in the hook's curl: dry on the reflectivity view.
  assert.equal(colourOf(dbzAt(couplet, storm, day, 40)), undefined);
  assert.equal(inCouplet(couplet, storm), true);
  assert.equal(inCouplet({ x: couplet.x + couplet.miles, y: couplet.y }, storm), true);
  assert.equal(inCouplet({ x: couplet.x + couplet.miles * 2, y: couplet.y }, storm), false);
});

test('with no hook there is no couplet for the radar to read', () => {
  const storm = stormAt();
  assert.equal(inCouplet(rotationOf(storm), storm), false);
  assert.equal(inCouplet(storm.funnel, storm), false);
});

test('a tight couplet is read over a smaller patch than a wide one', () => {
  const full = stormAt({ hook: 1 });
  const spot = { x: full.funnel.x + 1.5, y: full.funnel.y };
  assert.equal(inCouplet(spot, full), false);
  const faint = stormAt({ hook: 0.2 });
  const wide = coupletOf(faint);
  assert.equal(inCouplet({ x: wide.x + 1.5, y: wide.y }, faint), true);
});

test('faster wind hides more of the map, up to the most', () => {
  assert.equal(windCoverOf(0, 35, 75), 35);
  assert.equal(windCoverOf(60, 35, 75), 75);
  assert.equal(windCoverOf(-60, 35, 75), 75);
  assert.equal(windCoverOf(200, 35, 75), 75);
  assert.ok(windCoverOf(30, 35, 75) > 35 && windCoverOf(30, 35, 75) < 75);
});
