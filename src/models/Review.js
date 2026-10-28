import mongoose from 'mongoose';

const { Schema } = mongoose;

const reviewSchema = new Schema(
  {
    club: { type: Schema.Types.ObjectId, ref: 'Club', required: true },
    book: { type: Schema.Types.ObjectId, ref: 'Book', required: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    body: { type: String, trim: true, maxlength: 5000, default: '' },
  },
  { timestamps: true },
);

// One review per member per book per club; re-submitting edits it.
reviewSchema.index({ club: 1, book: 1, user: 1 }, { unique: true });

export default mongoose.model('Review', reviewSchema);
