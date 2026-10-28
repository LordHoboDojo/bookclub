import crypto from 'node:crypto';
import mongoose from 'mongoose';

const { Schema } = mongoose;

// Invite tokens are only ever stored hashed; the raw token exists solely in the emailed link.
const inviteSchema = new Schema(
  {
    club: { type: Schema.Types.ObjectId, ref: 'Club', required: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    invitedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'declined', 'revoked'],
      default: 'pending',
    },
    expiresAt: { type: Date, required: true },
    lastSentAt: Date,
    sendCount: { type: Number, default: 0 },
    respondedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    respondedAt: Date,
  },
  { timestamps: true },
);

inviteSchema.statics.hashToken = function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
};

inviteSchema.statics.generateToken = function generateToken() {
  const token = crypto.randomBytes(32).toString('base64url');
  return { token, tokenHash: this.hashToken(token) };
};

inviteSchema.statics.findByToken = function findByToken(token) {
  return this.findOne({ tokenHash: this.hashToken(token) });
};

inviteSchema.virtual('isExpired').get(function isExpired() {
  return this.expiresAt.getTime() < Date.now();
});

inviteSchema.virtual('isOpen').get(function isOpen() {
  return this.status === 'pending' && !this.isExpired;
});

export default mongoose.model('Invite', inviteSchema);
