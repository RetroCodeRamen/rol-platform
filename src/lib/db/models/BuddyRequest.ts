import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IBuddyRequest extends Document {
  requesterId: mongoose.Types.ObjectId; // User who sent the request
  recipientId: mongoose.Types.ObjectId; // User who receives the request
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: Date;
  updatedAt: Date;
}

const BuddyRequestSchema: Schema = new Schema(
  {
    requesterId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    recipientId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected'],
      default: 'pending',
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to prevent duplicate requests
BuddyRequestSchema.index({ requesterId: 1, recipientId: 1 }, { unique: true });

const BuddyRequest: Model<IBuddyRequest> =
  mongoose.models.BuddyRequest || mongoose.model<IBuddyRequest>('BuddyRequest', BuddyRequestSchema);

export default BuddyRequest;

