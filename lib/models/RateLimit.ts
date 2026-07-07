import mongoose from 'mongoose';

const rateLimitSchema = new mongoose.Schema({
  identifier: {
    type: String,
    required: true,
  },
  minuteBucket: {
    type: String, // e.g. "2026-07-07T12:15"
    required: true,
  },
  count: {
    type: Number,
    default: 1,
  },
  expireAt: {
    type: Date,
    default: () => new Date(Date.now() + 60000 * 5), // TTL 5 mins
  }
});

// TTL index to automatically delete old buckets
rateLimitSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.models.RateLimit || mongoose.model('RateLimit', rateLimitSchema);
