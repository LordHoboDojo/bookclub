import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chunkText } from '../src/services/chunker.js';

test('short text stays a single chunk; empty text yields none', () => {
  assert.deepEqual(chunkText('A short note.'), ['A short note.']);
  assert.deepEqual(chunkText('   '), []);
  assert.deepEqual(chunkText(null), []);
});

test('long text splits on sentences within the size limit, with overlap', () => {
  const sentences = Array.from({ length: 40 }, (_, i) => `Sentence number ${i} talks about the ending of the book.`);
  const chunks = chunkText(sentences.join(' '), { maxChars: 300, overlap: 80 });
  assert.ok(chunks.length > 3);
  for (const c of chunks) assert.ok(c.length <= 300 + 80, `chunk too long: ${c.length}`);
  // Every sentence survives somewhere.
  for (let i = 0; i < 40; i++) assert.ok(chunks.some((c) => c.includes(`number ${i} `)));
  // Each chunk opens with text carried over from the end of the previous one.
  for (let i = 1; i < chunks.length; i++) {
    assert.ok(chunks[i - 1].slice(-80).includes(chunks[i].slice(0, 20)), `no overlap before chunk ${i}`);
  }
});

test('a single enormous sentence is hard-split', () => {
  const chunks = chunkText('x'.repeat(2500), { maxChars: 900, overlap: 100 });
  assert.ok(chunks.length >= 3);
  assert.ok(chunks.every((c) => c.length <= 900));
});

test('paragraph breaks start a new passage once the current one has substance', () => {
  const para = (topic) => `${topic} came up first. `.repeat(12).trim();
  const chunks = chunkText(`${para('Pacing')}\n\n${para('Gender')}\n\n${para('Friendship')}`, { maxChars: 900 });
  assert.equal(chunks.length, 3);
  assert.ok(chunks[0].startsWith('Pacing') && chunks[1].startsWith('Gender') && chunks[2].startsWith('Friendship'));
});
