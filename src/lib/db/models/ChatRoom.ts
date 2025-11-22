import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IChatRoom extends Document {
  name: string;
  description?: string;
  category: string; // e.g., "Teens", "Computers", "Games", "Romance", etc.
  isPrivate: boolean;
  owner: mongoose.Types.ObjectId;
  moderators: mongoose.Types.ObjectId[];
  members: mongoose.Types.ObjectId[];
  maxMembers?: number;
  createdAt: Date;
  updatedAt: Date;
}

const ChatRoomSchema: Schema = new Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    description: String,
    category: {
      type: String,
      required: true,
      default: 'General',
    },
    isPrivate: {
      type: Boolean,
      default: false,
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    moderators: [{
      type: Schema.Types.ObjectId,
      ref: 'User',
    }],
    members: [{
      type: Schema.Types.ObjectId,
      ref: 'User',
    }],
    maxMembers: Number,
  },
  {
    timestamps: true,
  }
);

const ChatRoom: Model<IChatRoom> = mongoose.models.ChatRoom || mongoose.model<IChatRoom>('ChatRoom', ChatRoomSchema);

export default ChatRoom;

