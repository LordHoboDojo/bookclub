import mongoose from 'mongoose';
import { Book, BOOK_STATUSES, Note, Review } from '../models/index.js';
import config from '../config/index.js';
import * as openLibrary from '../services/openLibrary.js';
import { indexClubBook, indexReview } from '../services/indexer.js';
import { HttpError } from '../middleware/clubAccess.js';

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export async function search(req, res) {
  const q = String(req.query.q || '').trim().slice(0, 120);
  let catalogResults = [];
  let openLibraryResults = [];
  let openLibraryError = null;
  if (q) {
    const pattern = new RegExp(escapeRegex(q), 'i');
    catalogResults = await Book.find({ $or: [{ title: pattern }, { authors: pattern }] }).limit(8);
    if (config.openLibraryEnabled) {
      try {
        const known = new Set(catalogResults.map((b) => b.openLibraryKey).filter(Boolean));
        openLibraryResults = (await openLibrary.searchBooks(q)).filter((r) => !known.has(r.openLibraryKey));
      } catch (err) {
        openLibraryError = 'Open Library search is unavailable right now; you can still add a book by hand.';
        console.warn(`[books] Open Library search failed: ${err.message}`);
      }
    }
  }
  res.render('books/search', {
    title: 'Add a book',
    q,
    catalogResults,
    openLibraryResults,
    openLibraryError,
  });
}

async function resolveBook(body) {
  if (body.bookId) {
    if (!mongoose.isValidObjectId(body.bookId)) throw new HttpError(400, 'Unknown book');
    const book = await Book.findById(body.bookId);
    if (!book) throw new HttpError(404, 'Book not found');
    return book;
  }

  const title = String(body.title || '').trim().slice(0, 200);
  if (!title) throw new HttpError(422, 'A title is required.');
  const authors = String(body.authors || '')
    .split(/\s*[,;]\s*/)
    .map((a) => a.trim())
    .filter(Boolean)
    .slice(0, 5);

  const olKey = openLibrary.isWorkKey(body.openLibraryKey) ? body.openLibraryKey : null;
  if (olKey) {
    const existing = await Book.findOne({ openLibraryKey: olKey });
    if (existing) return existing;
  }

  const book = new Book({
    title,
    authors,
    publishedYear: Number.parseInt(body.publishedYear, 10) || undefined,
    coverUrl: /^https:\/\/covers\.openlibrary\.org\//.test(body.coverUrl || '') ? body.coverUrl : undefined,
    subjects: openLibrary.cleanSubjects(String(body.subjects || '').split('|')),
    description: String(body.description || '').trim().slice(0, 4000),
    source: olKey ? 'openlibrary' : 'manual',
    openLibraryKey: olKey ?? undefined,
  });

  // Enrich with Open Library's description/subjects; these feed both RAG and recommendations.
  if (olKey && config.openLibraryEnabled) {
    try {
      const work = await openLibrary.fetchWork(olKey);
      if (work.title) book.title = work.title;
      if (!book.description) book.description = work.description;
      if (!book.subjects.length) book.subjects = work.subjects;
      book.coverUrl ??= work.coverUrl;
    } catch (err) {
      console.warn(`[books] could not enrich ${olKey}: ${err.message}`);
    }
  }
  await book.save();
  return book;
}

export async function add(req, res) {
  const book = await resolveBook(req.body);
  const club = req.club;
  if (club.hasBook(book._id)) {
    req.flash('info', `"${book.title}" is already on the club's shelf.`);
  } else {
    const status = req.club.isLeader(req.user._id) && BOOK_STATUSES.includes(req.body.status) ? req.body.status : 'upcoming';
    club.books.push({ book: book._id, status, addedBy: req.user._id });
    await club.save();
    await indexClubBook(club._id, book);
    req.flash('success', `Added "${book.title}" to the shelf.`);
  }
  res.redirect(`/clubs/${club._id}`);
}

function findClubBook(club, bookId) {
  const entry = club.books.find((b) => String(b.book?._id ?? b.book) === String(bookId));
  if (!entry) throw new HttpError(404, 'That book is not on this club\'s shelf.');
  return entry;
}

export async function setStatus(req, res) {
  const entry = findClubBook(req.club, req.params.bookId);
  if (!BOOK_STATUSES.includes(req.body.status)) throw new HttpError(422, 'Unknown status');
  // Only one book is "reading" at a time; the previous one is marked finished.
  if (req.body.status === 'reading') {
    for (const b of req.club.books) if (b.status === 'reading') b.status = 'finished';
  }
  entry.status = req.body.status;
  await req.club.save();
  res.redirect(`/clubs/${req.club._id}`);
}

export async function remove(req, res) {
  findClubBook(req.club, req.params.bookId);
  req.club.books = req.club.books.filter((b) => String(b.book) !== String(req.params.bookId));
  await req.club.save();
  req.flash('success', 'Removed from the shelf.');
  res.redirect(`/clubs/${req.club._id}`);
}

export async function show(req, res) {
  const entry = findClubBook(req.club, req.params.bookId);
  const book = await Book.findById(req.params.bookId);
  if (!book) throw new HttpError(404, 'Book not found');
  const [reviews, notes] = await Promise.all([
    Review.find({ club: req.club._id, book: book._id }).sort({ updatedAt: -1 }).populate('user', 'name email avatarUrl'),
    Note.find({ club: req.club._id, book: book._id }).sort({ meetingDate: -1 }).populate('author', 'name email'),
  ]);
  const mine = reviews.find((r) => String(r.user?._id) === String(req.user._id));
  const average = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : null;
  res.render('books/show', { title: book.title, book, entry, reviews, notes, mine, average, statuses: BOOK_STATUSES });
}

export async function saveReview(req, res) {
  findClubBook(req.club, req.params.bookId);
  const rating = Number.parseInt(req.body.rating, 10);
  if (!(rating >= 1 && rating <= 5)) {
    req.flash('error', 'Pick a rating from 1 to 5.');
    return res.redirect(`/clubs/${req.club._id}/books/${req.params.bookId}#review`);
  }
  const review = await Review.findOneAndUpdate(
    { club: req.club._id, book: req.params.bookId, user: req.user._id },
    { rating, body: String(req.body.body || '').trim().slice(0, 5000) },
    { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true },
  );
  await indexReview(review);
  req.flash('success', 'Thanks! Your review is saved and searchable by "Ask the club".');
  return res.redirect(`/clubs/${req.club._id}/books/${req.params.bookId}#review-${review._id}`);
}
