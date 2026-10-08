import assert from 'node:assert/strict';
import { test } from 'node:test';
import { choiceWords, pictureSpot, targetAt } from './taps.js';

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
