import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeReturnTo } from '../src/middleware/auth.js';
import { cleanSubjects, isWorkKey } from '../src/services/openLibrary.js';
import { sourceLink } from '../src/services/rag.js';

test('safeReturnTo only allows same-site relative paths', () => {
  assert.equal(safeReturnTo('/clubs/123'), '/clubs/123');
  assert.equal(safeReturnTo('//evil.example'), '/dashboard');
  assert.equal(safeReturnTo('https://evil.example'), '/dashboard');
  assert.equal(safeReturnTo(undefined), '/dashboard');
});

test('Open Library helpers validate keys and drop noise subjects', () => {
  assert.ok(isWorkKey('/works/OL45804W'));
  assert.ok(!isWorkKey('/works/OL45804W/../../admin'));
  assert.ok(!isWorkKey('https://evil.example/works/OL1W'));
  assert.deepEqual(cleanSubjects(['Fiction', 'Dystopias', 'dystopias', 'Accessible book', 'nyt:bestseller', 'Space']), ['Dystopias', 'Space']);
});

test('RAG citations link back to the record they came from', () => {
  const chunk = { sourceType: 'review', sourceId: 'r1', book: 'b1' };
  assert.equal(sourceLink('c1', chunk), '/clubs/c1/books/b1#review-r1');
  assert.equal(sourceLink('c1', { sourceType: 'note', sourceId: 'n1' }), '/clubs/c1/notes/n1');
  assert.equal(sourceLink('c1', { sourceType: 'book', book: 'b1' }), '/clubs/c1/books/b1');
});
