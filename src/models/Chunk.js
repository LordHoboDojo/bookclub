import mongoose from 'mongoose';

const { Schema } = mongoose;

// A retrievable passage in a club's knowledge base (book blurb, review, or meeting-note excerpt)
// stored next to its embedding vector. This collection is the RAG vector store.
const chunkSchema = new Schema(
  {
    club: { type: Schema.Types.ObjectId, ref: 'Club', required: true },
    sourceType: { type: String, enum: ['book', 'review', 'note'], required: true },
    sourceId: { type: Schema.Types.ObjectId, required: true },
    book: { type: Schema.Types.ObjectId, ref: 'Book' },
    title: { type: String, required: true },
    text: { type: String, required: true },
    position: { type: Number, default: 0 },
    embedding: { type: [Number], required: true },
    embeddingModel: { type: String, required: true },
  },
  { timestamps: true },
);

chunkSchema.index({ club: 1, embeddingModel: 1 });
chunkSchema.index({ sourceType: 1, sourceId: 1 });

export default mongoose.model('Chunk', chunkSchema);
