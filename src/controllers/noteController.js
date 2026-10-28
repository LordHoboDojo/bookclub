import mongoose from 'mongoose';
import { Note } from '../models/index.js';
import { indexNote } from '../services/indexer.js';
import { deleteSourceChunks } from '../services/vectorStore.js';
import { HttpError } from '../middleware/clubAccess.js';

export async function create(req, res) {
  const title = String(req.body.title || '').trim().slice(0, 140);
  const body = String(req.body.body || '').trim().slice(0, 20000);
  const bookId = mongoose.isValidObjectId(req.body.book) && req.club.hasBook(req.body.book) ? req.body.book : undefined;
  if (!title || !body) {
    req.flash('error', 'Notes need a title and some text.');
    return res.redirect(`/clubs/${req.club._id}#notes`);
  }
  const meetingDate = req.body.meetingDate ? new Date(req.body.meetingDate) : new Date();
  const note = await Note.create({
    club: req.club._id,
    book: bookId,
    author: req.user._id,
    title,
    body,
    meetingDate: Number.isNaN(meetingDate.getTime()) ? new Date() : meetingDate,
  });
  await indexNote(note);
  req.flash('success', 'Meeting notes saved and added to the club knowledge base.');
  return res.redirect(`/clubs/${req.club._id}/notes/${note._id}`);
}

async function findNote(req) {
  if (!mongoose.isValidObjectId(req.params.noteId)) throw new HttpError(404, 'Note not found');
  const note = await Note.findOne({ _id: req.params.noteId, club: req.club._id })
    .populate('author', 'name email')
    .populate('book', 'title authors');
  if (!note) throw new HttpError(404, 'Note not found');
  return note;
}

export async function show(req, res) {
  const note = await findNote(req);
  res.render('notes/show', { title: note.title, note });
}

export async function remove(req, res) {
  const note = await findNote(req);
  if (String(note.author._id) !== String(req.user._id) && !req.club.isLeader(req.user._id)) {
    throw new HttpError(403, 'Only the author or the club leader can delete these notes.');
  }
  await Promise.all([note.deleteOne(), deleteSourceChunks('note', note._id)]);
  req.flash('success', 'Notes deleted.');
  res.redirect(`/clubs/${req.club._id}#notes`);
}
