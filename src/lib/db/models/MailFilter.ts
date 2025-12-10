import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IMailFilter extends Document {
  userId: mongoose.Types.ObjectId;
  name: string; // User-friendly filter name
  enabled: boolean; // Can enable/disable filters
  conditions: {
    field: 'from' | 'to' | 'subject' | 'body';
    operator: 'contains' | 'equals' | 'startsWith' | 'endsWith';
    value: string;
  }[];
  actions: {
    moveToFolder?: 'Inbox' | 'Sent' | 'Drafts' | 'Trash';
    markAsRead?: boolean;
    delete?: boolean; // Delete immediately (move to trash)
  };
  order: number; // Execution order (lower = first)
  createdAt: Date;
  updatedAt: Date;
}

const MailFilterSchema: Schema = new Schema(
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
      maxlength: 100,
    },
    enabled: {
      type: Boolean,
      default: true,
    },
    conditions: [
      {
        field: {
          type: String,
          enum: ['from', 'to', 'subject', 'body'],
          required: true,
        },
        operator: {
          type: String,
          enum: ['contains', 'equals', 'startsWith', 'endsWith'],
          required: true,
        },
        value: {
          type: String,
          required: true,
          trim: true,
        },
      },
    ],
    actions: {
      moveToFolder: {
        type: String,
        enum: ['Inbox', 'Sent', 'Drafts', 'Trash'],
      },
      markAsRead: {
        type: Boolean,
      },
      delete: {
        type: Boolean,
      },
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient filtering queries
MailFilterSchema.index({ userId: 1, enabled: 1, order: 1 });

const MailFilter: Model<IMailFilter> =
  mongoose.models.MailFilter || mongoose.model<IMailFilter>('MailFilter', MailFilterSchema);

export default MailFilter;


