import mongoose from 'mongoose';

const { Schema } = mongoose;

// Meeting notes / discussion write-ups. Indexed into the club's RAG knowledge base.
const noteSchema = new Schema(
  {
    club: { type: Schema.Types.ObjectId, ref: 'Club', required: true, index: true },
    book: { type: Schema.Types.ObjectId, ref: 'Book' },
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true, maxlength: 140 },
    body: { type: String, required: true, trim: true, maxlength: 20000 },
    meetingDate: Date,
  },
  { timestamps: true },
);

export default mongoose.model('Note', noteSchema);
