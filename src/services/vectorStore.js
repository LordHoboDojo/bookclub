// MongoDB-backed vector store for the club knowledge base.
//
// Retrieval is hybrid: exact cosine similarity over a club's chunk embeddings, plus a small
// keyword-overlap boost so exact terms ("slow", a character's name) aren't lost by the embedding.
// A club has at most a few thousand passages, so scoring in the app is fast, exact, and portable
// across MongoDB, DocumentDB and Atlas. At larger scale, swap `search` for Atlas $vectorSearch
// or a DocumentDB vector index; callers don't change.
import { Chunk } from '../models/index.js';
import { embedText, embedTexts, getEmbedder } from './ai/embeddings.js';
import { dot } from './vectorMath.js';

export async function replaceSourceChunks({ club, sourceType, sourceId, book, title, texts }) {
  const embedder = getEmbedder();
  const passages = texts.filter((t) => t && t.trim());
  const vectors = passages.length ? await embedTexts(passages) : [];
  await Chunk.deleteMany({ sourceType, sourceId, club });
  if (!passages.length) return 0;
  await Chunk.insertMany(
    passages.map((text, position) => ({
      club,
      sourceType,
      sourceId,
      book,
      title,
      text,
      position,
      embedding: vectors[position],
      embeddingModel: embedder.name,
    })),
  );
  return passages.length;
}

export function deleteSourceChunks(sourceType, sourceId) {
  return Chunk.deleteMany({ sourceType, sourceId });
}

const KEYWORD_WEIGHT = 0.2;
const STOPWORDS = new Set(
  'a an and are as at be but by did do does for from had has have he her his how i in into is it its me my of on or our she so than that the their them they this to was we were what when where which who whom why will with would you your about any anyone people book books think thought say said'.split(' '),
);

// Crude stemmer: enough to match "struggled"/"struggle", "endings"/"ending", "cry"/"cried".
const stem = (word) => word.replace(/(?:ies|ied)$/, 'y').replace(/(?:ing|ed|es|s)$/, '');

export function keywordTerms(text) {
  const words = String(text).toLowerCase().match(/[a-z][a-z'-]+/g) ?? [];
  return [...new Set(words.filter((w) => w.length > 2 && !STOPWORDS.has(w)).map(stem))];
}

/** Fraction of the query's content words that appear in the passage. */
export function keywordScore(queryTerms, text) {
  if (!queryTerms.length) return 0;
  const passage = new Set(keywordTerms(text));
  return queryTerms.filter((t) => passage.has(t)).length / queryTerms.length;
}

/** Top-k passages from a club's knowledge base for a natural-language query. */
export async function search(clubId, query, { k = 6, minScore = 0.15 } = {}) {
  const embedder = getEmbedder();
  const queryVector = await embedText(query);
  const queryTerms = keywordTerms(query);
  const chunks = await Chunk.find({ club: clubId, embeddingModel: embedder.name })
    .select('sourceType sourceId book title text position embedding')
    .lean();

  // Vectors are unit-normalized at write time, so the dot product is the cosine similarity.
  return chunks
    .map((chunk) => ({
      chunk,
      score: dot(queryVector, chunk.embedding) + KEYWORD_WEIGHT * keywordScore(queryTerms, `${chunk.title} ${chunk.text}`),
    }))
    .filter((hit) => hit.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map(({ chunk, score }) => {
      delete chunk.embedding;
      return { chunk, score };
    });
}

export function countForClub(clubId) {
  return Chunk.countDocuments({ club: clubId, embeddingModel: getEmbedder().name });
}
