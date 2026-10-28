import { test } from 'node:test';
import assert from 'node:assert/strict';
import { historyWeight, topSubjects } from '../src/services/recommender.js';

test('ratings map to signed weights; unrated picks count mildly positive', () => {
  assert.equal(historyWeight({ rating: 5 }), 2.5);
  assert.equal(historyWeight({ rating: 1 }), -1.5);
  assert.equal(historyWeight({ rating: null, status: 'finished' }), 0.75);
  assert.equal(historyWeight({ rating: null, status: 'upcoming' }), 0.5);
});

test('topSubjects ranks themes of liked books and ignores disliked ones', () => {
  const history = [
    { rating: 5, book: { subjects: ['Science Fiction', 'Space'] } },
    { rating: 4, book: { subjects: ['science fiction', 'Robots'] } },
    { rating: 1, book: { subjects: ['Romance', 'Romance'] } },
  ];
  const top = topSubjects(history, 3);
  assert.equal(top[0], 'science fiction');
  assert.ok(!top.includes('romance'));
});
