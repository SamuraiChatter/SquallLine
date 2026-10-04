import assert from 'node:assert/strict';
import { test } from 'node:test';
import { newGame, step } from './rules.js';

test('a new game starts with no time passed', () => {
  assert.equal(newGame().seconds, 0);
});

test('each step adds the time that passed', () => {
  const later = step(step(newGame(), 0.5), 0.25);
  assert.equal(later.seconds, 0.75);
});
