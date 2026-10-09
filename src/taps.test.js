import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chaseButtons, choiceWords, fontAtLeast, mustTurn, pictureSpot, smallestWords, stickSteering, targetAt } from './taps.js';

const picture = { width: 1920, height: 1080 };

test('a tap lands on the same spot of the picture when the window is the picture\'s shape', () => {
  const box = { left: 0, top: 0, width: 960, height: 540 };
  assert.deepEqual(pictureSpot({ x: 480, y: 270 }, box, picture), { x: 960, y: 540 });
  assert.deepEqual(pictureSpot({ x: 0, y: 0 }, box, picture), { x: 0, y: 0 });
});

test('black bars above and below the picture are left out', () => {
  // An iPad: squarer than the picture, so there is a bar above and below.
  const box = { left: 0, top: 0, width: 1180, height: 820 };
  const bar = (820 - (1080 * 1180) / 1920) / 2;
  const top = pictureSpot({ x: 590, y: bar }, box, picture);
  assert.ok(Math.abs(top.x - 960) < 1e-9);
  assert.ok(Math.abs(top.y) < 1e-9);
  assert.ok(pictureSpot({ x: 590, y: bar / 2 }, box, picture).y < 0);
});

test('black bars beside the picture are left out', () => {
  // A phone on its side: wider than the picture, so there is a bar each side.
  const box = { left: 0, top: 0, width: 844, height: 390 };
  const bar = (844 - (1920 * 390) / 1080) / 2;
  const left = pictureSpot({ x: bar, y: 195 }, box, picture);
  assert.ok(Math.abs(left.x) < 1e-9);
  assert.ok(Math.abs(left.y - 540) < 1e-9);
});

test('a tap finds the choice it lands on, and nothing between choices', () => {
  const painted = [
    { action: 'n', left: 700, top: 400, wide: 520, tall: 84 },
    { action: 'a', left: 700, top: 510, wide: 520, tall: 84 },
  ];
  assert.equal(targetAt(painted, { x: 960, y: 440 }), 'n');
  assert.equal(targetAt(painted, { x: 960, y: 550 }), 'a');
  assert.equal(targetAt(painted, { x: 960, y: 497 }), '');
  assert.equal(targetAt(painted, { x: 100, y: 440 }), '');
});

test('where two targets overlap, the one painted last is tapped', () => {
  const painted = [
    { action: 'under', left: 0, top: 0, wide: 100, tall: 100 },
    { action: 'over', left: 50, top: 50, wide: 100, tall: 100 },
  ];
  assert.equal(targetAt(painted, { x: 75, y: 75 }), 'over');
  assert.equal(targetAt(painted, { x: 25, y: 25 }), 'under');
});

test('a choice names its key for the keyboard and drops it for touch', () => {
  assert.equal(choiceWords({ key: 'n', words: 'new game' }, false), 'N: new game');
  assert.equal(choiceWords({ key: 'n', words: 'new game' }, true), 'New game');
  assert.equal(choiceWords({ key: 'enter', words: 'start the chase' }, false), 'Enter: start the chase');
  assert.equal(choiceWords({ key: 'enter', words: 'start the chase' }, true), 'Start the chase');
});

test('a picture set against the top has no bar above it', () => {
  const box = { left: 0, top: 0, width: 1180, height: 820 };
  const spot = pictureSpot({ x: 590, y: 0 }, box, picture, true);
  assert.ok(Math.abs(spot.x - 960) < 1e-9);
  assert.equal(spot.y, 0);
  // The strip under the picture is below its bottom edge.
  assert.ok(pictureSpot({ x: 590, y: 700 }, box, picture, true).y > 1080);
});

test('the joystick steers the way the thumb is pushed, up the screen being north', () => {
  assert.deepEqual(stickSteering({ x: 64, y: 0 }, 64, 0.2), { x: 1, y: 0 });
  assert.deepEqual(stickSteering({ x: 0, y: -64 }, 64, 0.2), { x: 0, y: 1 });
  assert.deepEqual(stickSteering({ x: -64, y: 0 }, 64, 0.2), { x: -1, y: 0 });
  assert.deepEqual(stickSteering({ x: 0, y: 64 }, 64, 0.2), { x: 0, y: -1 });
});

test('the joystick steers at any angle, not just eight', () => {
  // Thirty degrees north of east.
  const angle = Math.PI / 6;
  const steering = stickSteering({ x: 50 * Math.cos(angle), y: -50 * Math.sin(angle) }, 64, 0.2);
  assert.ok(Math.abs(Math.atan2(steering.y, steering.x) - angle) < 1e-9);
});

test('a thumb resting near the middle of the joystick steers nowhere', () => {
  assert.deepEqual(stickSteering({ x: 0, y: 0 }, 64, 0.2), { x: 0, y: 0 });
  assert.deepEqual(stickSteering({ x: 8, y: -8 }, 64, 0.2), { x: 0, y: 0 });
  assert.notDeepEqual(stickSteering({ x: 10, y: -10 }, 64, 0.2), { x: 0, y: 0 });
  // Even with no dead middle at all, the very middle steers nowhere.
  assert.deepEqual(stickSteering({ x: 0, y: 0 }, 64, 0), { x: 0, y: 0 });
});

test('the joystick never steers harder than a key, however far the thumb slides', () => {
  const steering = stickSteering({ x: 300, y: -400 }, 64, 0.2);
  assert.ok(Math.abs(Math.hypot(steering.x, steering.y) - 1) < 1e-9);
  // Half way out pans the camera at half speed.
  assert.ok(Math.abs(stickSteering({ x: 32, y: 0 }, 64, 0.2).x - 0.5) < 1e-9);
});

test('a touch screen held upright must be turned, and nothing else must', () => {
  assert.equal(mustTurn(true, 390, 844), true);
  assert.equal(mustTurn(true, 844, 390), false);
  // A narrow window on a computer is the player's business.
  assert.equal(mustTurn(false, 390, 844), false);
});

test('on a phone, small print is raised to a readable size', () => {
  // A phone on its side: the picture is shrunk to 390 tall.
  const smallest = smallestWords(12, { width: 844, height: 390 }, picture);
  assert.ok(Math.abs(smallest - (12 * 1080) / 390) < 1e-9);
  const font = fontAtLeast('22px system-ui, sans-serif', smallest);
  assert.equal(font, '33.2px system-ui, sans-serif');
  // What that comes out as on the screen.
  assert.ok(Math.abs((33.2 * 390) / 1080 - 12) < 0.05);
  assert.equal(fontAtLeast('bold 26px system-ui, sans-serif', smallest), 'bold 33.2px system-ui, sans-serif');
  // Words that are big enough already are left alone.
  assert.equal(fontAtLeast('bold 54px system-ui, sans-serif', smallest), 'bold 54px system-ui, sans-serif');
});

test('on a computer or an iPad no words change size', () => {
  for (const box of [{ width: 1920, height: 1080 }, { width: 1366, height: 768 }, { width: 1180, height: 820 }, { width: 1080, height: 810 }]) {
    const smallest = smallestWords(12, box, picture);
    assert.equal(fontAtLeast('22px system-ui, sans-serif', smallest), '22px system-ui, sans-serif');
  }
  // Before the page has a size, nothing changes either.
  assert.equal(fontAtLeast('22px system-ui, sans-serif', smallestWords(12, { width: 0, height: 0 }, picture)), '22px system-ui, sans-serif');
});

const names = { film: 'Film', driveOn: 'Drive on', anchor: 'Anchor', pullUp: 'Pull up', radar: 'Radar', map: 'Map', pause: 'Pause' };

test('while driving, the buttons are film, radar, map and pause', () => {
  assert.deepEqual(chaseButtons({ filming: false, anchoring: false }, false, names), { ' ': 'Film', a: '', v: 'Radar', z: 'Map', p: 'Pause' });
});

test('while filming, film reads drive on and the map button goes', () => {
  assert.deepEqual(chaseButtons({ filming: true, anchoring: false }, false, names), { ' ': 'Drive on', a: '', v: 'Radar', z: '', p: 'Pause' });
});

test('the anchor button shows only when the vehicle can anchor, and reads pull up once it has', () => {
  assert.equal(chaseButtons({ filming: true, anchoring: false }, true, names).a, 'Anchor');
  assert.equal(chaseButtons({ filming: true, anchoring: true }, true, names).a, 'Pull up');
  assert.equal(chaseButtons({ filming: true, anchoring: false }, false, names).a, '');
});
