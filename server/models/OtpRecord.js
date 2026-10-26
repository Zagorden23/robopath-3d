import mongoose from 'mongoose';

const otpRecordSchema = new mongoose.Schema(
  {
    identifier: { type: String, required: true, lowercase: true, trim: true },
    channel: { type: String, enum: ['email', 'phone'], required: true },
    // Locally generated OTPs are hashed; Twilio Verify retains its own code.
    otpHash: { type: String, default: null },
    provider: {
      type: String,
      enum: ['local', 'twilio-verify'],
      default: 'local',
    },
    attempts: { type: Number, default: 0, min: 0 },
    maxAttempts: { type: Number, default: 5, min: 1 },
    expiresAt: { type: Number, required: true },
    cooldownUntil: { type: Number, required: true },
  },
  { timestamps: true }
);

otpRecordSchema.index({ identifier: 1, channel: 1 }, { unique: true });

export const OtpRecord =
  mongoose.models.OtpRecord || mongoose.model('OtpRecord', otpRecordSchema);
