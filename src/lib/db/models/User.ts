import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IUser extends Document {
  username: string;
  screenName: string;
  email: string;
  passwordHash: string;
  profile?: {
    bio?: string;
    location?: string;
    interests?: string[];
    favoriteQuote?: string;
    textColor?: string;
    font?: string;
  };
  buddyList?: string[]; // Array of user IDs
  blockedUsers?: string[]; // Array of user IDs
  status: 'online' | 'away' | 'busy' | 'offline' | 'invisible';
  lastSeen?: Date;
  lastActiveAt?: Date; // For presence tracking (30s threshold)
  isManuallyLoggedOff?: boolean; // True if user explicitly logged off
  awayMessage?: string; // Custom away message text
  awayStatus?: 'available' | 'away' | 'busy' | 'invisible'; // Current away status
  weatherZip?: string | null; // ZIP code for weather location
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema: Schema = new Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    screenName: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    profile: {
      bio: String,
      location: String,
      interests: [String],
      favoriteQuote: String,
      textColor: String,
      font: String,
    },
    buddyList: [{
      type: Schema.Types.ObjectId,
      ref: 'User',
    }],
    blockedUsers: [{
      type: Schema.Types.ObjectId,
      ref: 'User',
    }],
    status: {
      type: String,
      enum: ['online', 'away', 'busy', 'offline', 'invisible'],
      default: 'offline',
    },
    lastSeen: Date,
    lastActiveAt: {
      type: Date,
      default: Date.now,
    },
    isManuallyLoggedOff: {
      type: Boolean,
      default: false,
    },
    awayMessage: String,
    awayStatus: {
      type: String,
      enum: ['available', 'away', 'busy', 'invisible'],
      default: 'available',
    },
    weatherZip: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);

export default User;

