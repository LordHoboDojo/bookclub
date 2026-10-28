// Hybrid book recommender.
//
//   1. Taste profile  - weighted centroid of the embeddings of books the club (or reader) has read;
//                       weights come from ratings, so disliked books push the profile away.
//   2. Candidates     - the shared catalog, expanded on demand from Open Library using the
//                       themes of well-liked books.
//   3. Shortlist      - cosine similarity to the taste profile, diversified with MMR.
//   4. Re-rank        - Claude picks the final set from the shortlist and explains each pick
//                       (structured JSON output, ids validated against the shortlist).
//   Without an LLM (or if Claude declines / errors) step 4 falls back to similarity order with
//   "because you liked X" explanations, so the feature always works.
import config from '../config/index.js';
import { Book, Club, Review } from '../models/index.js';
import { embedTexts, getEmbedder } from './ai/embeddings.js';
import { createMessage, llmEnabled, llmLabel, textOf } from './ai/llm.js';
import * as openLibrary from './openLibrary.js';
import { cosine, mmr, weightedCentroid } from './vectorMath.js';

const CANDIDATE_LIMIT = 500;
const SHORTLIST_SIZE = 12;
const DEFAULT_PICKS = 5;

const EMBEDDING_FIELDS = '+embedding +embeddingModel';

// ---------------------------------------------------------------------------------------------
// Embeddings

export async function ensureBookEmbeddings(books) {
  const embedder = getEmbedder();
  const missing = books.filter((b) => !b.embedding?.length || b.embeddingModel !== embedder.name);
  if (missing.length) {
    const vectors = await embedTexts(missing.map((b) => b.embeddingText()));
    await Book.bulkWrite(
      missing.map((b, i) => ({
        updateOne: {
          filter: { _id: b._id },
          update: { $set: { embedding: vectors[i], embeddingModel: embedder.name } },
        },
      })),
    );
    missing.forEach((b, i) => {
      b.embedding = vectors[i];
      b.embeddingModel = embedder.name;
    });
  }
  return books;
}

// ---------------------------------------------------------------------------------------------
// History -> weights

/** Rating 1-5 maps to a weight in [-1.5, 2.5]; unrated books the group picked count mildly positive. */
export function historyWeight({ rating, status }) {
  if (rating != null) return rating - 2.5;
  return status === 'upcoming' ? 0.5 : 0.75;
}

async function clubHistory(club) {
  const bookIds = club.books.map((b) => b.book?._id ?? b.book);
  const [books, reviews] = await Promise.all([
    Book.find({ _id: { $in: bookIds } }).select(EMBEDDING_FIELDS),
    Review.find({ club: club._id }).lean(),
  ]);
  return books.map((book) => {
    const forBook = reviews.filter((r) => String(r.book) === String(book._id));
    const rating = forBook.length ? forBook.reduce((s, r) => s + r.rating, 0) / forBook.length : null;
    const status = club.books.find((b) => String(b.book?._id ?? b.book) === String(book._id))?.status;
    return {
      book,
      rating,
      status,
      excerpts: forBook.filter((r) => r.body).slice(0, 3).map((r) => `${r.rating}/5 - ${r.body.slice(0, 280)}`),
    };
  });
}

async function readerHistory(user) {
  const reviews = await Review.find({ user: user._id }).lean();
  // A reader may have reviewed the same book in two clubs; average those.
  const byBook = new Map();
  for (const r of reviews) {
    const entry = byBook.get(String(r.book)) ?? { ratings: [], excerpts: [] };
    entry.ratings.push(r.rating);
    if (r.body) entry.excerpts.push(`${r.rating}/5 - ${r.body.slice(0, 280)}`);
    byBook.set(String(r.book), entry);
  }
  const books = await Book.find({ _id: { $in: [...byBook.keys()] } }).select(EMBEDDING_FIELDS);
  return books.map((book) => {
    const { ratings, excerpts } = byBook.get(String(book._id));
    return {
      book,
      rating: ratings.reduce((a, b) => a + b, 0) / ratings.length,
      status: 'finished',
      excerpts: excerpts.slice(0, 2),
    };
  });
}

// ---------------------------------------------------------------------------------------------
// Candidates

const recentlyFetchedSubjects = new Map(); // subject -> timestamp
const SUBJECT_TTL_MS = 12 * 60 * 60 * 1000;

export function topSubjects(history, n = 3) {
  const counts = new Map();
  for (const h of history) {
    const w = historyWeight(h);
    if (w <= 0) continue;
    for (const s of h.book.subjects ?? []) {
      const key = s.toLowerCase();
      counts.set(key, (counts.get(key) ?? 0) + w);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([s]) => s);
}

async function expandCatalog(history) {
  if (!config.openLibraryEnabled) return;
  const subjects = topSubjects(history).filter(
    (s) => Date.now() - (recentlyFetchedSubjects.get(s) ?? 0) > SUBJECT_TTL_MS,
  );
  await Promise.all(
    subjects.map(async (subject) => {
      try {
        const works = await openLibrary.subjectWorks(subject, 15);
        recentlyFetchedSubjects.set(subject, Date.now());
        if (!works.length) return;
        await Book.bulkWrite(
          works.map((w) => ({
            updateOne: {
              filter: { openLibraryKey: w.openLibraryKey },
              update: { $setOnInsert: { ...w, source: 'openlibrary' } },
              upsert: true,
            },
          })),
          { ordered: false },
        );
      } catch (err) {
        console.warn(`[recommender] Open Library expansion for "${subject}" skipped: ${err.message}`);
      }
    }),
  );
}

// ---------------------------------------------------------------------------------------------
// Explanations

function similarityReason(candidate, history, audience) {
  const liked = history.filter((h) => historyWeight(h) > 0 && h.book.embedding?.length);
  if (!liked.length) return 'A widely loved pick that tends to spark good discussion.';
  const nearest = liked.reduce((best, h) =>
    cosine(candidate.vector, h.book.embedding) > cosine(candidate.vector, best.book.embedding) ? h : best,
  );
  const shared = candidate.book.subjects
    .filter((s) => nearest.book.subjects.some((t) => t.toLowerCase() === s.toLowerCase()))
    .slice(0, 3);
  const rated = nearest.rating != null ? `, which ${audience.pronoun} rated ${nearest.rating.toFixed(1)}/5` : '';
  return `Close in spirit to "${nearest.book.title}"${rated}.${shared.length ? ` Shared themes: ${shared.join(', ')}.` : ''}`;
}

const RERANK_SYSTEM = `You recommend books for readers. You get a reading history (with ratings and short review excerpts when available) and a shortlist of candidate books that a similarity model pulled from the catalog.

Pick the candidates the audience is most likely to enjoy, balancing close fit with a little variety. For each pick, write one or two warm, specific sentences addressed to the audience ("you") that explain the recommendation by connecting it to particular books, ratings, or opinions in their history. Choose only from the shortlist and refer to each candidate by its id. Don't state facts about a book beyond what's given or widely known.`;

const RERANK_SCHEMA = {
  type: 'object',
  properties: {
    picks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          candidate_id: { type: 'string' },
          reason: { type: 'string' },
        },
        required: ['candidate_id', 'reason'],
        additionalProperties: false,
      },
    },
  },
  required: ['picks'],
  additionalProperties: false,
};

function describeHistory(history) {
  return history
    .map((h) => {
      const rating = h.rating != null ? `rated ${h.rating.toFixed(1)}/5` : `on the ${h.status} list, not yet rated`;
      const excerpts = h.excerpts.length ? ` Reviews: ${h.excerpts.map((e) => `"${e}"`).join(' ')}` : '';
      return `- "${h.book.title}" by ${h.book.authorLine}: ${rating}.${excerpts}`;
    })
    .join('\n');
}

function describeCandidate(id, book) {
  const year = book.publishedYear ? ` (${book.publishedYear})` : '';
  const themes = book.subjects.length ? ` Themes: ${book.subjects.slice(0, 8).join(', ')}.` : '';
  const blurb = book.description ? ` Blurb: ${book.description.slice(0, 400)}` : '';
  return `${id}: "${book.title}" by ${book.authorLine}${year}.${themes}${blurb}`;
}

async function rerankWithClaude({ shortlist, history, audience, limit }) {
  const ids = new Map(shortlist.map((c, i) => [`c${i + 1}`, c]));
  const prompt = [
    `<audience>${audience.description}</audience>`,
    `<reading_history>\n${describeHistory(history)}\n</reading_history>`,
    `<shortlist>\n${[...ids].map(([id, c]) => describeCandidate(id, c.book)).join('\n')}\n</shortlist>`,
    `Choose the ${limit} best picks from the shortlist, best first.`,
  ].join('\n\n');

  const message = await createMessage({
    system: RERANK_SYSTEM,
    output_config: { effort: 'medium', format: { type: 'json_schema', schema: RERANK_SCHEMA } },
    messages: [{ role: 'user', content: prompt }],
  });

  const parsed = JSON.parse(textOf(message));
  const seen = new Set();
  return parsed.picks
    .filter((p) => ids.has(p.candidate_id) && !seen.has(p.candidate_id) && seen.add(p.candidate_id))
    .slice(0, limit)
    .map((p) => ({ ...ids.get(p.candidate_id), reason: p.reason.trim() }));
}

// ---------------------------------------------------------------------------------------------
// Core

export async function recommend({ history, excludeIds, audience, limit = DEFAULT_PICKS }) {
  await ensureBookEmbeddings(history.map((h) => h.book));
  const taste = weightedCentroid(
    history.map((h) => h.book.embedding),
    history.map(historyWeight),
  );

  if (taste) await expandCatalog(history);

  const excluded = new Set(excludeIds.map(String));
  const candidates = (
    await Book.find({ _id: { $nin: [...excluded] } }).select(EMBEDDING_FIELDS).limit(CANDIDATE_LIMIT)
  ).filter((b) => !excluded.has(String(b._id)));
  await ensureBookEmbeddings(candidates);

  if (!taste) {
    // Cold start: nothing read or rated yet. Offer a diverse spread of the catalog,
    // seeded from a random starting book so it varies between users.
    const shuffled = candidates.map((book) => ({ book, sort: Math.random() })).sort((a, b) => a.sort - b.sort);
    const spread = mmr(
      shuffled.map(({ book }) => ({ book, vector: book.embedding, score: 0 })),
      { k: limit, lambda: 0 },
    );
    return {
      source: 'starter',
      items: spread.map((c) => ({ book: c.book, score: null, reason: 'A widely loved pick that tends to spark good discussion.' })),
    };
  }

  const ranked = candidates
    .map((book) => ({ book, vector: book.embedding, score: cosine(taste, book.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 60);
  const shortlist = mmr(ranked, { k: SHORTLIST_SIZE, lambda: 0.75 });

  let picks = null;
  let source = 'similarity';
  if (llmEnabled() && shortlist.length) {
    try {
      picks = await rerankWithClaude({ shortlist, history, audience, limit });
      source = 'claude';
    } catch (err) {
      console.warn(`[recommender] Claude re-rank unavailable, using similarity order: ${err.message}`);
    }
  }

  // Top up from the shortlist if Claude returned fewer picks than asked.
  const chosen = picks ?? [];
  for (const c of shortlist) {
    if (chosen.length >= limit) break;
    if (!chosen.some((p) => String(p.book._id) === String(c.book._id))) {
      chosen.push({ ...c, reason: similarityReason(c, history, audience) });
    }
  }

  return {
    source,
    items: chosen.map((c) => ({ book: c.book, score: c.score, reason: c.reason })),
  };
}

export async function recommendForClub(club, { limit } = {}) {
  const history = await clubHistory(club);
  const result = await recommend({
    history,
    excludeIds: history.map((h) => h.book._id),
    audience: { description: `The members of a book club called "${club.name}".`, pronoun: 'the club' },
    limit,
  });
  await Club.updateOne(
    { _id: club._id },
    {
      $set: {
        recommendations: {
          generatedAt: new Date(),
          source: result.source,
          model: result.source === 'claude' ? llmLabel() : undefined,
          items: result.items.map((i) => ({ book: i.book._id, reason: i.reason, score: i.score })),
        },
      },
    },
  );
  return result;
}

export async function recommendForReader(user, { limit } = {}) {
  const history = await readerHistory(user);
  const clubs = await Club.find({ 'members.user': user._id }).select('books.book').lean();
  const clubBookIds = clubs.flatMap((c) => c.books.map((b) => b.book));
  const result = await recommend({
    history,
    excludeIds: [...history.map((h) => h.book._id), ...clubBookIds],
    audience: { description: `A reader named ${user.displayName}.`, pronoun: 'you' },
    limit,
  });
  user.recommendations = {
    generatedAt: new Date(),
    source: result.source,
    model: result.source === 'claude' ? llmLabel() : undefined,
    items: result.items.map((i) => ({ book: i.book._id, reason: i.reason, score: i.score })),
  };
  await user.save();
  return result;
}
