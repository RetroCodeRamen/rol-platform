import mongoose, { Schema, Document, Model } from 'mongoose';

export type MailFolder = 'Inbox' | 'Sent' | 'Drafts' | 'Trash';

export interface IMailMessage extends Document {
  ownerUserId: mongoose.Types.ObjectId; // The mailbox owner (NOT necessarily the sender)
  folder: MailFolder;
  from: string; // Email address (e.g., 'tanuki@ramn.online')
  to: string; // Comma-separated email addresses or JSON array string
  cc?: string; // Comma-separated email addresses or JSON array string
  bcc?: string; // Comma-separated email addresses or JSON array string
  subject: string;
  body: string;
  createdAt: Date;
  readAt?: Date;
  isRead: boolean;
  replyToId?: mongoose.Types.ObjectId; // Optional: reference to message this is replying to
  threadId?: mongoose.Types.ObjectId; // Optional: thread grouping
}

const MailMessageSchema: Schema = new Schema(
  {
    ownerUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true, // Critical for performance - all queries filter by ownerUserId
    },
    folder: {
      type: String,
      enum: ['Inbox', 'Sent', 'Drafts', 'Trash'],
      required: true,
      index: true, // Indexed for folder queries
    },
    from: {
      type: String,
      required: true,
      trim: true,
    },
    to: {
      type: String,
      required: true,
      trim: true,
    },
    cc: {
      type: String,
      trim: true,
    },
    bcc: {
      type: String,
      trim: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
    },
    body: {
      type: String,
      required: true,
    },
    readAt: {
      type: Date,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true, // Indexed for unread count queries
    },
    replyToId: {
      type: Schema.Types.ObjectId,
      ref: 'MailMessage',
    },
    threadId: {
      type: Schema.Types.ObjectId,
      ref: 'MailMessage',
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt automatically
  }
);

// Compound indexes for efficient queries
MailMessageSchema.index({ ownerUserId: 1, folder: 1, createdAt: -1 });
MailMessageSchema.index({ ownerUserId: 1, folder: 1, isRead: 1 });
MailMessageSchema.index({ ownerUserId: 1, isRead: 1 });

const MailMessage: Model<IMailMessage> =
  mongoose.models.MailMessage || mongoose.model<IMailMessage>('MailMessage', MailMessageSchema);

export default MailMessage;

