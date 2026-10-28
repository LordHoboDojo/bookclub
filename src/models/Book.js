import mongoose from 'mongoose';

const { Schema } = mongoose;

// Global catalog shared by every club. Embeddings power the recommender's similarity search.
const bookSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    authors: { type: [String], default: [] },
    description: { type: String, default: '' },
    subjects: { type: [String], default: [] },
    coverUrl: String,
    publishedYear: Number,
    openLibraryKey: { type: String, unique: true, sparse: true }, // e.g. /works/OL45804W
    source: { type: String, enum: ['seed', 'openlibrary', 'manual'], default: 'manual' },
    embedding: { type: [Number], select: false },
    embeddingModel: { type: String, select: false },
  },
  { timestamps: true },
);

bookSchema.index({ title: 1 });

bookSchema.virtual('authorLine').get(function authorLine() {
  return this.authors.length ? this.authors.join(', ') : 'Unknown author';
});

// The text we embed for similarity: what the book is, who wrote it, what it's about.
bookSchema.methods.embeddingText = function embeddingText() {
  const parts = [`${this.title} by ${this.authorLine}.`];
  if (this.subjects.length) parts.push(`Themes: ${this.subjects.slice(0, 10).join(', ')}.`);
  if (this.description) parts.push(this.description.slice(0, 1500));
  return parts.join(' ');
};

export default mongoose.model('Book', bookSchema);
