import mongoose from 'mongoose';

const { Schema } = mongoose;

const recommendationSchema = new Schema(
  {
    book: { type: Schema.Types.ObjectId, ref: 'Book', required: true },
    reason: String,
    score: Number,
  },
  { _id: false },
);

const userSchema = new Schema(
  {
    googleId: { type: String, unique: true, sparse: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, trim: true },
    avatarUrl: String,
    lastLoginAt: Date,
    recommendations: {
      generatedAt: Date,
      source: String,
      model: String,
      items: [recommendationSchema],
    },
  },
  { timestamps: true },
);

userSchema.virtual('displayName').get(function displayName() {
  return this.name || this.email.split('@')[0];
});

userSchema.virtual('initials').get(function initials() {
  return this.displayName
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
});

export { recommendationSchema };
export default mongoose.model('User', userSchema);
