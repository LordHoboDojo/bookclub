import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cosine, mmr, normalize, weightedCentroid } from '../src/services/vectorMath.js';

test('cosine similarity of identical, orthogonal and opposite vectors', () => {
  assert.equal(cosine([1, 2, 3], [1, 2, 3]).toFixed(6), '1.000000');
  assert.equal(cosine([1, 0], [0, 1]), 0);
  assert.equal(cosine([1, 0], [-1, 0]), -1);
  assert.equal(cosine([0, 0], [1, 1]), 0);
});

test('weightedCentroid is unit length and negative weights push away', () => {
  const liked = [1, 0];
  const disliked = [0.6, 0.8];
  const taste = weightedCentroid([liked, disliked], [2, -1]);
  assert.ok(Math.abs(Math.hypot(...taste) - 1) < 1e-9);
  assert.ok(cosine(taste, liked) > cosine(taste, disliked));
  assert.ok(cosine(taste, disliked) < cosine(liked, disliked));
});

test('weightedCentroid returns null for empty or cancelling input', () => {
  assert.equal(weightedCentroid([], []), null);
  assert.equal(weightedCentroid([[1, 0], [1, 0]], [1, -1]), null);
});

test('mmr prefers a diverse item over a near-duplicate of the top pick', () => {
  const a = { id: 'a', vector: normalize([1, 0, 0]), score: 0.95 };
  const aDup = { id: 'a-dup', vector: normalize([0.99, 0.01, 0]), score: 0.94 };
  const b = { id: 'b', vector: normalize([0, 1, 0]), score: 0.8 };
  const picked = mmr([a, aDup, b], { k: 2, lambda: 0.6 }).map((c) => c.id);
  assert.deepEqual(picked, ['a', 'b']);
  // Pure relevance keeps score order.
  assert.deepEqual(mmr([a, aDup, b], { k: 2, lambda: 1 }).map((c) => c.id), ['a', 'a-dup']);
});
