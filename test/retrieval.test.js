import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keywordScore, keywordTerms } from '../src/services/vectorStore.js';

test('keywordTerms drops stopwords and normalizes simple inflections', () => {
  assert.deepEqual(keywordTerms('Who struggled with the invented vocabulary?'), ['struggl', 'invent', 'vocabulary']);
  assert.deepEqual(keywordTerms('Which book made someone cry?'), keywordTerms('which BOOK made someone cried'));
});

test('keywordScore is the share of query terms present in the passage', () => {
  const terms = keywordTerms('struggled with invented vocabulary');
  assert.equal(keywordScore(terms, 'Priya struggles with the invented vocabulary (kemmer).'), 1);
  assert.equal(keywordScore(terms, 'Nothing relevant here.'), 0);
  assert.equal(keywordScore([], 'anything'), 0);
});
