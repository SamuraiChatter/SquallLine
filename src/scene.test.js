import assert from 'node:assert/strict';
import { test } from 'node:test';
import { skyDarkness, treeLean } from './scene.js';

/**
 * A tree's lean at every tenth of a second for a minute.
 * @param {number} mph
 * @param {number} toward
 */
const leans = (mph, toward) => Array.from({ length: 600 }, (_, i) => treeLean(mph, toward, i / 10, 3));
/** @param {number[]} numbers */
const middle = (numbers) => numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
/**
 * How many times a tree swings back through the middle of its sway.
 * @param {number[]} numbers
 */
const swings = (numbers) => {
  const mean = middle(numbers);
  return numbers.filter((n, i) => i > 0 && n > mean !== numbers[i - 1] > mean).length;
};

test('the sky is darkest toward the tornado and lighter either side of it', () => {
  assert.equal(skyDarkness(0), 1);
  assert.ok(skyDarkness(20) < 1);
  assert.ok(skyDarkness(60) < skyDarkness(20));
  assert.equal(skyDarkness(-35), skyDarkness(35));
});

test('far round from the tornado the sky is no darker than anywhere else', () => {
  assert.equal(skyDarkness(120), 0);
  assert.equal(skyDarkness(180), 0);
  assert.equal(skyDarkness(-180), 0);
});

test('with no wind a tree sways gently about upright', () => {
  const still = leans(0, 1);
  assert.ok(Math.abs(middle(still)) < 0.01);
  assert.ok(Math.max(...still) > 0.02, 'it does not move');
  assert.ok(Math.max(...still.map(Math.abs)) < 0.05, 'it moves too far');
});

test('a tree leans toward the tornado, further the harder the wind blows', () => {
  const light = middle(leans(40, 1));
  const strong = middle(leans(120, 1));
  assert.ok(light > 0.1);
  assert.ok(strong > light * 2);
  // The tornado on the other side: the same lean the other way.
  assert.ok(Math.abs(middle(leans(120, -1)) + strong) < 0.02);
});

test('a tree thrashes further and faster as the wind rises', () => {
  const calm = leans(0, 1);
  const windy = leans(120, 1);
  const reach = (/** @type {number[]} */ numbers) => Math.max(...numbers) - Math.min(...numbers);
  assert.ok(reach(windy) > reach(calm) * 3);
  assert.ok(swings(windy) > swings(calm) * 3);
});

test('a tree bends no further in a wind past the strongest it can stand', () => {
  assert.equal(treeLean(150, 1, 2, 5), treeLean(400, 1, 2, 5));
});

test('trees do not all sway together', () => {
  assert.notEqual(treeLean(0, 1, 2, 1), treeLean(0, 1, 2, 2));
});
