import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IBuddyGroup extends Document {
  userId: mongoose.Types.ObjectId; // Owner of this group
  name: string;
  buddyIds: mongoose.Types.ObjectId[]; // Buddies in this group
  order: number; // Display order
  createdAt: Date;
  updatedAt: Date;
}

const BuddyGroupSchema: Schema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    buddyIds: [{
      type: Schema.Types.ObjectId,
      ref: 'User',
    }],
    order: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient queries
BuddyGroupSchema.index({ userId: 1, order: 1 });

const BuddyGroup: Model<IBuddyGroup> =
  mongoose.models.BuddyGroup || mongoose.model<IBuddyGroup>('BuddyGroup', BuddyGroupSchema);

export default BuddyGroup;

