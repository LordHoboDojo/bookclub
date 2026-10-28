// Keeps the club knowledge base (Chunk collection) in sync with books, reviews and notes.
// Indexing failures are logged but never block the user's write; `npm run reindex` repairs.
import { Book, Club, Note, Review, User } from '../models/index.js';
import { chunkText } from './chunker.js';
import { replaceSourceChunks } from './vectorStore.js';

async function safely(label, fn) {
  try {
    return await fn();
  } catch (err) {
    console.warn(`[indexer] ${label} failed: ${err.message}`);
    return null;
  }
}

export function indexClubBook(clubId, book) {
  return safely(`book ${book._id}`, () => {
    const text = [
      `"${book.title}" by ${book.authorLine}${book.publishedYear ? ` (${book.publishedYear})` : ''}.`,
      book.subjects.length ? `Themes: ${book.subjects.slice(0, 10).join(', ')}.` : '',
      book.description,
    ]
      .filter(Boolean)
      .join(' ');
    return replaceSourceChunks({
      club: clubId,
      sourceType: 'book',
      sourceId: book._id,
      book: book._id,
      title: `About "${book.title}"`,
      texts: chunkText(text),
    });
  });
}

export async function indexReview(review) {
  return safely(`review ${review._id}`, async () => {
    const [user, book] = await Promise.all([User.findById(review.user), Book.findById(review.book)]);
    if (!user || !book) return 0;
    const text = `${user.displayName} rated "${book.title}" ${review.rating} out of 5.${review.body ? ` ${review.body}` : ''}`;
    return replaceSourceChunks({
      club: review.club,
      sourceType: 'review',
      sourceId: review._id,
      book: book._id,
      title: `${user.displayName}'s review of "${book.title}"`,
      texts: chunkText(text),
    });
  });
}

export async function indexNote(note) {
  return safely(`note ${note._id}`, async () => {
    const book = note.book ? await Book.findById(note.book) : null;
    const date = (note.meetingDate || note.createdAt || new Date()).toISOString().slice(0, 10);
    const prefix = `Meeting notes "${note.title}"${book ? ` about "${book.title}"` : ''}, ${date}:`;
    return replaceSourceChunks({
      club: note.club,
      sourceType: 'note',
      sourceId: note._id,
      book: book?._id,
      title: `Meeting notes: ${note.title}`,
      texts: chunkText(note.body).map((passage) => `${prefix} ${passage}`),
    });
  });
}

/** Rebuild one club's knowledge base from scratch. */
export async function reindexClub(clubId) {
  const club = await Club.findById(clubId).populate('books.book');
  if (!club) return { books: 0, reviews: 0, notes: 0 };
  const reviews = await Review.find({ club: clubId });
  const notes = await Note.find({ club: clubId });
  for (const entry of club.books) if (entry.book) await indexClubBook(club._id, entry.book);
  for (const review of reviews) await indexReview(review);
  for (const note of notes) await indexNote(note);
  return { books: club.books.length, reviews: reviews.length, notes: notes.length };
}
