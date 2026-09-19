import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DISHES, dishIndex, dishName } from '../dishes.js';

test('every dish name is unique', () => {
  assert.equal(new Set(DISHES).size, DISHES.length);
});

test('dishIndex/dishName wrap once the level count passes the list', () => {
  assert.equal(dishIndex(0), 0);
  assert.equal(dishIndex(DISHES.length), 0);
  assert.equal(dishIndex(DISHES.length + 3), 3);
  assert.equal(dishName(DISHES.length), DISHES[0]);
});
