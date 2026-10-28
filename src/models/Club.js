import mongoose from 'mongoose';
import { recommendationSchema } from './User.js';

const { Schema } = mongoose;

export const BOOK_STATUSES = ['upcoming', 'reading', 'finished'];

const memberSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['leader', 'member'], default: 'member' },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const clubBookSchema = new Schema(
  {
    book: { type: Schema.Types.ObjectId, ref: 'Book', required: true },
    status: { type: String, enum: BOOK_STATUSES, default: 'upcoming' },
    addedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    addedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const clubSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, trim: true, maxlength: 1000, default: '' },
    leader: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    members: { type: [memberSchema], default: [] },
    books: { type: [clubBookSchema], default: [] },
    recommendations: {
      generatedAt: Date,
      source: String,
      model: String,
      items: [recommendationSchema],
    },
  },
  { timestamps: true },
);

clubSchema.index({ 'members.user': 1 });

const idOf = (ref) => String(ref?._id ?? ref);

clubSchema.methods.isMember = function isMember(userId) {
  return this.members.some((m) => idOf(m.user) === String(userId));
};

clubSchema.methods.isLeader = function isLeader(userId) {
  return idOf(this.leader) === String(userId);
};

clubSchema.methods.hasBook = function hasBook(bookId) {
  return this.books.some((b) => idOf(b.book) === String(bookId));
};

clubSchema.methods.booksWithStatus = function booksWithStatus(status) {
  return this.books.filter((b) => b.status === status);
};

clubSchema.statics.forUser = function forUser(userId) {
  return this.find({ 'members.user': userId }).sort({ updatedAt: -1 });
};

export default mongoose.model('Club', clubSchema);
