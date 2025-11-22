import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IMessage extends Document {
  from: mongoose.Types.ObjectId;
  to?: mongoose.Types.ObjectId; // For IM messages
  roomId?: mongoose.Types.ObjectId; // For chat room messages
  content: string;
  type: 'im' | 'room' | 'system';
  timestamp: Date;
  editedAt?: Date;
  deleted: boolean;
  readAt?: Date; // When message was read (for IMs)
  attachments?: mongoose.Types.ObjectId[]; // Array of FileAttachment IDs
}

const MessageSchema: Schema = new Schema(
  {
    from: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    to: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    roomId: {
      type: Schema.Types.ObjectId,
      ref: 'ChatRoom',
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ['im', 'room', 'system'],
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    editedAt: Date,
    deleted: {
      type: Boolean,
      default: false,
    },
    readAt: Date, // For IM messages - when recipient read it
    attachments: [
      {
        type: Schema.Types.ObjectId,
        ref: 'FileAttachment',
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
MessageSchema.index({ roomId: 1, timestamp: -1 });
MessageSchema.index({ from: 1, to: 1, timestamp: -1 });
MessageSchema.index({ type: 1, timestamp: -1 });

const Message: Model<IMessage> = mongoose.models.Message || mongoose.model<IMessage>('Message', MessageSchema);

export default Message;

